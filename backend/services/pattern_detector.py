from __future__ import annotations
import os
from typing import Optional

from sqlmodel import Session, select

from models.session import SessionRecord, PatternState
from models.event import ActionTrace, UIEvent, SSEEventType
from services.embedding_service import embedding_service
from services.log_streamer import logger

PATTERN_THRESHOLD = int(os.getenv("PATTERN_THRESHOLD", "3"))
PATTERN_CONFIDENCE_MIN = float(os.getenv("PATTERN_CONFIDENCE_MIN", "0.85"))


class PatternDetector:
    """
    Manages the 10-stage state machine per permit_type.
    Stage transitions happen here; SSE broadcasting happens in the router.
    """

    async def process_session_complete(
        self,
        session: SessionRecord,
        db: Session,
    ) -> Optional[str]:
        """
        Called when a session is marked complete. Embeds the trace, compares
        against prior completed sessions for the same permit_type, and advances
        state. Returns SSEEventType string if an event should be broadcast.
        """
        trace = ActionTrace(
            session_id=session.session_id,
            user_id=session.user_id,
            permit_type=session.permit_type,
            events=[UIEvent(**e) for e in session.events],
            completed_at=session.completed_at,
        )

        trace_text = embedding_service.serialize_trace(trace)
        vector = await embedding_service.embed(
            trace_text, cache_key=f"session:{session.session_id}"
        )
        session.embedding = vector
        session.state = PatternState.FINGERPRINTING
        db.add(session)
        db.commit()

        # Compare against prior completed sessions (same permit_type, not seeded context)
        prior_sessions = db.exec(
            select(SessionRecord).where(
                SessionRecord.permit_type == session.permit_type,
                SessionRecord.session_id != session.session_id,
                SessionRecord.completed_at != None,
            )
        ).all()

        logger.info(
            f"[Similarity] Comparing against {len(prior_sessions)} prior sessions "
            f"(permit_type={session.permit_type})"
        )

        session.state = PatternState.COMPARING
        db.add(session)
        db.commit()

        matches = 0
        for prior in prior_sessions:
            if not prior.embedding:
                continue
            score = embedding_service.cosine_similarity(vector, prior.embedding)
            threshold = PATTERN_CONFIDENCE_MIN
            flag = "✓" if score >= threshold else "✗"
            logger.info(
                f"[Similarity] vs {prior.session_id}: cosine={score} {flag} "
                f"(threshold: {threshold})"
            )
            if score >= threshold:
                matches += 1

        total_sessions = len(prior_sessions) + 1  # include current
        logger.info(
            f"[Detector]  Pattern matches: {matches}/{len(prior_sessions)} "
            f"sessions exceed similarity threshold"
        )

        if total_sessions >= PATTERN_THRESHOLD and matches >= PATTERN_THRESHOLD - 1:
            session.state = PatternState.READY
            db.add(session)
            db.commit()
            logger.info(
                f"[Detector]  Pattern READY — {matches}/{len(prior_sessions)} sessions "
                f"exceed similarity threshold"
            )
            logger.info(f"[SSE]       → OPTIMIZATION_OPPORTUNITY sent to frontend")
            return SSEEventType.OPTIMIZATION_OPPORTUNITY
        else:
            session.state = PatternState.CANDIDATE
            db.add(session)
            db.commit()
            logger.info(
                f"[Detector]  Pattern CANDIDATE — need more sessions "
                f"({total_sessions}/{PATTERN_THRESHOLD})"
            )
            return SSEEventType.PATTERN_CANDIDATE


pattern_detector = PatternDetector()
