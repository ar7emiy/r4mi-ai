from __future__ import annotations
import asyncio
import os
from typing import Optional

from sqlmodel import Session, select

from models.session import SessionRecord, PatternState
from models.event import ActionTrace, UIEvent, SSEEventType
from services.embedding_service import embedding_service
from services.log_streamer import logger
from agents.market_matcher import market_matcher

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

            # Market-first: check for an existing published agent before building
            logger.info("[MarketMatcher] Checking published agents for existing match...")
            match_result = await market_matcher.find_match_by_vector(vector, db)
            if match_result:
                matched_spec, match_score = match_result
                logger.info(
                    f"[SSE]       → AGENT_MATCH_FOUND | spec='{matched_spec.name}' "
                    f"score={match_score} trust={matched_spec.trust_level}"
                )
                session.matched_spec_id = matched_spec.id
                db.add(session)
                db.commit()
                return SSEEventType.AGENT_MATCH_FOUND

            logger.info(f"[SSE]       → OPTIMIZATION_OPPORTUNITY sent to frontend")
            # Kick off spec pre-generation so the panel has a draft ready immediately
            asyncio.create_task(_pre_generate_spec(session.session_id))
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


async def _pre_generate_spec(session_id: str) -> None:
    """
    Background task: build a NarrowAgentSpec draft from the completed session and
    store it on SessionRecord.candidate_spec_draft. Fires SPEC_GENERATED SSE when done.
    Uses its own DB session — safe to run after the originating request has completed.
    """
    from db import engine  # avoid circular at module level
    from agents.spec_builder_agent import spec_builder_agent
    from services.sse_bus import sse_bus

    logger.info(f"[SpecBuilder] Pre-generating spec for session {session_id}...")
    try:
        with Session(engine) as db:
            session = db.get(SessionRecord, session_id)
            if not session:
                logger.warning(f"[SpecBuilder] Session {session_id} not found for pre-generation")
                return

            spec = await spec_builder_agent.build_spec(session)

            session.candidate_spec_draft = spec.model_dump(mode="json")
            db.add(session)
            db.commit()

        logger.info(f"[SpecBuilder] Draft stored for session {session_id} — name='{spec.name}'")
        await sse_bus.publish(
            SSEEventType.SPEC_GENERATED,
            {"session_id": session_id, "spec": spec.model_dump(mode="json")},
        )
    except Exception as exc:
        logger.error(f"[SpecBuilder] Pre-generation failed for {session_id}: {exc}")
