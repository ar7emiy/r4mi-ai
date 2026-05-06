from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlmodel import Session

from models.event import UIEvent, SSEEventType
from models.session import SessionRecord, PatternState
from services.knowledge_detector import knowledge_detector
from services.pattern_detector import pattern_detector
from services.step_labeller import step_labeller
from services.log_streamer import logger


class ObserverAgent:
    """Receives UIEvents and drives the per-session state machine.

    Vision calls happen on screen_switch events (until knowledge_detector
    takes over in Step 5). Pattern detection happens on session complete
    (submit event). No domain inference: permit_type is no longer derived
    from screen names. Workflow type is discovered post-hoc by
    services/cluster_service.py.
    """

    async def handle_event(
        self,
        event: UIEvent,
        db: Session,
    ) -> tuple[Optional[str], Optional[object]]:
        session = db.get(SessionRecord, event.session_id)
        if session is None:
            session = SessionRecord(
                session_id=event.session_id,
                user_id=event.user_id,
                # permit_type stays as a column for legacy reads but we no
                # longer infer or rely on it. Empty string keeps the NOT NULL
                # constraint satisfied; cluster_id replaces it.
                permit_type=event.permit_type or "",
                state=PatternState.COLLECTING,
                events=[],
                started_at=datetime.utcnow(),
            )
            db.add(session)
            db.commit()
            logger.info(f"[Observer] Session {event.session_id} started")

        # In teach-me mode: generate step description in realtime
        if event.capture_mode == "teach" and not event.step_description:
            try:
                description = await step_labeller.label_event(event)
                if description:
                    event = event.model_copy(update={"step_description": description})
            except Exception:
                pass  # step label failure is non-fatal

        # Accumulate events
        events_list = list(session.events or [])
        events_list.append(event.model_dump(mode="json"))
        session.events = events_list
        db.add(session)
        db.commit()

        sse_type: Optional[str] = None

        # Knowledge-source detection — site-agnostic. The detector decides
        # which event types trigger Vision (screen_switch, dwell, selection,
        # scroll) based on interaction signals rather than a fixed allowlist
        # of permit-specific screen names.
        sources = await knowledge_detector.process_event(event, session, db)
        if sources:
            sse_type = SSEEventType.KNOWLEDGE_EXTRACTED

        # Pattern detection on submit
        if event.event_type == "submit":
            session.state = PatternState.FINGERPRINTING
            session.completed_at = datetime.utcnow()
            db.add(session)
            db.commit()

            logger.info("[Observer] Session complete — embedding action trace...")
            result = await pattern_detector.process_session_complete(session, db)
            if result:
                sse_type = result

        return sse_type, session


observer_agent = ObserverAgent()
