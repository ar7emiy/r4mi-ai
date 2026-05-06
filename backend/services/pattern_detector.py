"""Site-agnostic pattern detection.

Replaces the previous permit_type-filtered comparison. Flow on session
complete:

    1. Embed the trace.
    2. Check the published agent market — if a published spec already
       matches this trace by cosine similarity, fire AGENT_MATCH_FOUND.
    3. Otherwise assign a cluster via cluster_service. Clusters are
       discovered greedily by cosine similarity over all completed sessions.
    4. If the cluster crosses MIN_CLUSTER_SIZE (default 3) for the first
       time, fire OPTIMIZATION_OPPORTUNITY and pre-generate a draft spec.
    5. Else fire PATTERN_CANDIDATE.
"""
from __future__ import annotations
import asyncio
from typing import Optional

from sqlmodel import Session

from models.session import SessionRecord, PatternState
from models.event import ActionTrace, UIEvent, SSEEventType
from services.cluster_service import cluster_service
from services.embedding_service import embedding_service
from services.log_streamer import logger
from agents.market_matcher import market_matcher


class PatternDetector:
    async def process_session_complete(
        self,
        session: SessionRecord,
        db: Session,
    ) -> Optional[str]:
        """Embed, cluster, and optionally trigger an opportunity SSE event."""
        trace = ActionTrace(
            session_id=session.session_id,
            user_id=session.user_id,
            permit_type=session.permit_type or "",
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

        # 1. Market check — does an existing published agent already cover this?
        logger.info("[MarketMatcher] Checking published agents for existing match...")
        match_result = await market_matcher.find_match_by_vector(vector, db)
        if match_result:
            matched_spec, match_score = match_result
            logger.info(
                f"[SSE] → AGENT_MATCH_FOUND | spec='{matched_spec.name}' "
                f"score={match_score} trust={matched_spec.trust_level}"
            )
            session.matched_spec_id = matched_spec.id
            session.state = PatternState.READY
            db.add(session)
            db.commit()
            return SSEEventType.AGENT_MATCH_FOUND

        # 2. Cluster discovery — replaces the permit_type filter.
        session.state = PatternState.COMPARING
        db.add(session)
        db.commit()

        assignment = await cluster_service.assign_cluster(session, db)
        logger.info(
            f"[Detector] Cluster {assignment.cluster_id[:8]} | size={assignment.cluster_size} "
            f"| label={assignment.cluster_label!r}"
        )

        if assignment.crossed_threshold:
            session.state = PatternState.READY
            db.add(session)
            db.commit()
            logger.info("[SSE] → OPTIMIZATION_OPPORTUNITY sent to frontend")
            asyncio.create_task(_pre_generate_spec(session.session_id))
            return SSEEventType.OPTIMIZATION_OPPORTUNITY

        session.state = PatternState.CANDIDATE
        db.add(session)
        db.commit()
        logger.info(
            f"[Detector] Pattern CANDIDATE — cluster {assignment.cluster_id[:8]} "
            f"size {assignment.cluster_size}/{cluster_service.__class__.__module__}"
        )
        return SSEEventType.PATTERN_CANDIDATE


pattern_detector = PatternDetector()


async def _pre_generate_spec(session_id: str) -> None:
    """Background task: build a NarrowAgentSpec draft and persist it on the session."""
    from db import engine  # avoid circular at module level
    from agents.spec_builder_agent import spec_builder_agent
    from services.sse_bus import sse_bus

    logger.info(f"[SpecBuilder] Pre-generating spec for session {session_id}...")
    try:
        with Session(engine) as db:
            session = db.get(SessionRecord, session_id)
            if not session:
                logger.warning(f"[SpecBuilder] Session {session_id} not found")
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
