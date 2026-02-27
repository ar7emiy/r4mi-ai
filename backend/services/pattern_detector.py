from __future__ import annotations

import os
from collections import defaultdict
from enum import IntEnum

from models.event import UIEvent
from models.sse_events import SSEEventType

PATTERN_CONFIDENCE_THRESHOLD = float(
    os.getenv("PATTERN_CONFIDENCE_THRESHOLD", "0.75")
)


class PatternStage(IntEnum):
    IDLE = 0
    FIRST_OCCURRENCE = 1
    COLLECTING = 2
    SEQUENCE_EXTRACTED = 3
    SECOND_OCCURRENCE = 4
    CROSS_SESSION_MATCH = 5
    KNOWLEDGE_SOURCES_IDENTIFIED = 6
    CONFIDENCE_SCORED = 7
    THRESHOLD_REACHED = 8
    OPPORTUNITY_EMITTED = 9


STAGE_NAMES = {
    PatternStage.IDLE: "idle",
    PatternStage.FIRST_OCCURRENCE: "first_occurrence",
    PatternStage.COLLECTING: "collecting",
    PatternStage.SEQUENCE_EXTRACTED: "sequence_extracted",
    PatternStage.SECOND_OCCURRENCE: "second_occurrence",
    PatternStage.CROSS_SESSION_MATCH: "cross_session_match",
    PatternStage.KNOWLEDGE_SOURCES_IDENTIFIED: "knowledge_sources_identified",
    PatternStage.CONFIDENCE_SCORED: "confidence_scored",
    PatternStage.THRESHOLD_REACHED: "threshold_reached",
    PatternStage.OPPORTUNITY_EMITTED: "opportunity_emitted",
}


class PatternDetector:
    """
    10-stage state machine that tracks UI event sequences across sessions.
    Advances stage as it sees repeated screen navigation patterns.
    Emits SSEEventType.OPTIMIZATION_OPPORTUNITY when confidence > threshold.
    """

    def __init__(self) -> None:
        # Per-session: list of screen_name sequences seen
        self._session_screens: dict[str, list[str]] = defaultdict(list)
        # Per-session: current stage
        self._session_stages: dict[str, PatternStage] = defaultdict(lambda: PatternStage.IDLE)
        # Per-session: confidence score
        self._session_confidence: dict[str, float] = defaultdict(float)
        # Cross-session: screen sequences by permit_type
        self._sequences_by_type: dict[str, list[list[str]]] = defaultdict(list)
        # Track how many unique sessions contributed to each pattern
        self._sessions_per_type: dict[str, set[str]] = defaultdict(set)

    async def process_event(self, event: UIEvent) -> float:
        """
        Process one UIEvent. Advances the state machine and returns updated confidence.
        Publishes OPTIMIZATION_OPPORTUNITY SSE when confidence > threshold.
        """
        sid = event.session_id

        # Record screen visits
        if event.screen_name and (
            not self._session_screens[sid]
            or self._session_screens[sid][-1] != event.screen_name
        ):
            self._session_screens[sid].append(event.screen_name)

        # Count total events in this session for stage advancement
        event_count = len(self._session_screens[sid])

        # Determine permit type (from event metadata or infer from screen names)
        permit_type = self._infer_permit_type(event)
        self._sessions_per_type[permit_type].add(sid)

        # Advance state machine
        stage = self._session_stages[sid]
        new_stage = self._advance_stage(sid, stage, event, permit_type)
        self._session_stages[sid] = new_stage

        # Compute confidence
        confidence = self._compute_confidence(sid, permit_type)
        self._session_confidence[sid] = confidence

        # Emit SSE if threshold crossed and not already emitted
        if (
            confidence >= PATTERN_CONFIDENCE_THRESHOLD
            and new_stage < PatternStage.OPPORTUNITY_EMITTED
        ):
            self._session_stages[sid] = PatternStage.OPPORTUNITY_EMITTED

            from services.event_bus import event_bus

            sessions_count = len(self._sessions_per_type[permit_type])
            await event_bus.publish(
                sid,
                SSEEventType.OPTIMIZATION_OPPORTUNITY,
                {
                    "session_id": sid,
                    "permit_type": permit_type,
                    "confidence": confidence,
                    "sessions_count": sessions_count,
                    "screens": self._session_screens[sid],
                    "message": (
                        f"I noticed you process {permit_type.replace('_', ' ')} "
                        f"{sessions_count} times. Watch the replay and confirm."
                    ),
                },
            )

        return confidence

    def get_stage(self, session_id: str) -> int:
        return int(self._session_stages.get(session_id, PatternStage.IDLE))

    def get_stage_name(self, session_id: str) -> str:
        stage = self._session_stages.get(session_id, PatternStage.IDLE)
        return STAGE_NAMES.get(stage, "idle")

    def get_confidence(self, session_id: str) -> float:
        return self._session_confidence.get(session_id, 0.0)

    def get_event_count(self, session_id: str) -> int:
        return len(self._session_screens.get(session_id, []))

    def get_session_count(self) -> int:
        return len(self._session_stages)

    def get_all_patterns(self) -> list[dict]:
        return [
            {
                "session_id": sid,
                "stage": int(stage),
                "stage_name": STAGE_NAMES.get(stage, "idle"),
                "confidence": self._session_confidence.get(sid, 0.0),
                "screens": self._session_screens.get(sid, []),
            }
            for sid, stage in self._session_stages.items()
        ]

    def _advance_stage(
        self, session_id: str, current: PatternStage, event: UIEvent, permit_type: str
    ) -> PatternStage:
        screens = self._session_screens[session_id]
        n_screens = len(screens)
        n_sessions = len(self._sessions_per_type[permit_type])

        if current == PatternStage.IDLE and n_screens >= 1:
            return PatternStage.FIRST_OCCURRENCE
        if current == PatternStage.FIRST_OCCURRENCE and n_screens >= 2:
            return PatternStage.COLLECTING
        if current == PatternStage.COLLECTING and event.event_type in ("submit", "click"):
            # Record this session's sequence
            seq = list(screens)
            self._sequences_by_type[permit_type].append(seq)
            return PatternStage.SEQUENCE_EXTRACTED
        if current == PatternStage.SEQUENCE_EXTRACTED and n_sessions >= 2:
            return PatternStage.SECOND_OCCURRENCE
        if current == PatternStage.SECOND_OCCURRENCE:
            if self._sequences_match(permit_type):
                return PatternStage.CROSS_SESSION_MATCH
        if current == PatternStage.CROSS_SESSION_MATCH and event.screenshot_b64:
            return PatternStage.KNOWLEDGE_SOURCES_IDENTIFIED
        if current == PatternStage.KNOWLEDGE_SOURCES_IDENTIFIED and n_sessions >= 3:
            return PatternStage.CONFIDENCE_SCORED
        if current == PatternStage.CONFIDENCE_SCORED:
            confidence = self._compute_confidence(session_id, permit_type)
            if confidence >= PATTERN_CONFIDENCE_THRESHOLD:
                return PatternStage.THRESHOLD_REACHED

        return current

    def _compute_confidence(self, session_id: str, permit_type: str) -> float:
        """
        Confidence = weighted average of:
          - Session repetition ratio (n_sessions / 3) * 0.5
          - Sequence similarity across sessions * 0.4
          - Current stage ratio * 0.1
        """
        n_sessions = len(self._sessions_per_type[permit_type])
        repetition = min(n_sessions / 3, 1.0)

        similarity = self._sequences_match(permit_type, return_score=True)  # type: ignore[arg-type]
        stage_ratio = int(self._session_stages[session_id]) / 9

        return round(repetition * 0.5 + similarity * 0.4 + stage_ratio * 0.1, 3)

    def _sequences_match(self, permit_type: str, return_score: bool = False) -> bool | float:
        """Check if recorded sequences for this permit_type are similar (>= 80% overlap)."""
        seqs = self._sequences_by_type.get(permit_type, [])
        if len(seqs) < 2:
            return 0.0 if return_score else False

        # Compare first two sequences via Jaccard similarity on screen name sets
        a = set(seqs[0])
        b = set(seqs[1])
        intersection = len(a & b)
        union = len(a | b)
        score = intersection / union if union > 0 else 0.0

        if return_score:
            return score
        return score >= 0.8

    def _infer_permit_type(self, event: UIEvent) -> str:
        """Infer permit type from screen names if not provided explicitly."""
        screen = event.screen_name.upper()
        if "ADU" in screen or "MIXED" in screen:
            return "adu_mixed_zone"
        if "SIGN" in screen or "COMMERCIAL" in screen:
            return "commercial_signage"
        return "fence_variance_r2"  # default


# Module-level singleton
pattern_detector = PatternDetector()
