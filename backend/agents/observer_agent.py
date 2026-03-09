from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from models.event import UIEvent, SSEEventType
from models.session import SessionRecord, PatternState
from services.vision_service import vision_service
from services.pattern_detector import pattern_detector
from services.log_streamer import logger


class ObserverAgent:
    """
    Receives UIEvents and drives the per-session state machine.
    Vision calls happen on screen_switch events.
    Pattern detection happens on session complete (submit event).
    """

    async def handle_event(
        self,
        event: UIEvent,
        db: Session,
    ) -> Optional[str]:
        """Process one UIEvent. Returns SSEEventType if broadcast needed."""

        session = db.get(SessionRecord, event.session_id)
        if session is None:
            permit_type = event.permit_type or self._infer_permit_type(event)
            session = SessionRecord(
                session_id=event.session_id,
                user_id=event.user_id,
                permit_type=permit_type,
                state=PatternState.COLLECTING,
                events=[],
                started_at=datetime.utcnow(),
            )
            db.add(session)
            db.commit()
            logger.info(f"[Observer] Session {event.session_id} started")

        # Accumulate events
        events_list = list(session.events or [])
        events_list.append(event.model_dump(mode="json"))
        session.events = events_list
        db.add(session)
        db.commit()

        sse_type: Optional[str] = None

        # Vision extraction on screen_switch
        if event.event_type == "screen_switch" and event.screenshot_b64:
            sources = await vision_service.extract_knowledge_sources(
                screenshot_b64=event.screenshot_b64,
                screen_name=event.screen_name,
                session_id=event.session_id,
            )
            existing = list(session.knowledge_sources or [])
            for s in sources:
                existing.append(s.model_dump())
            session.knowledge_sources = existing
            db.add(session)
            db.commit()

            if sources:
                sse_type = SSEEventType.KNOWLEDGE_EXTRACTED

        # Pattern detection on submit
        if event.event_type == "submit":
            session.state = PatternState.FINGERPRINTING
            session.completed_at = datetime.utcnow()
            db.add(session)
            db.commit()

            logger.info(
                f"[Observer] Session complete — embedding action trace..."
            )
            result = await pattern_detector.process_session_complete(session, db)
            if result:
                sse_type = result

        return sse_type

    def _infer_permit_type(self, event: UIEvent) -> str:
        screen = event.screen_name.lower()
        if "fence" in screen:
            return "fence_variance"
        if "adu" in screen:
            return "adu_addition"
        if "sign" in screen:
            return "commercial_signage"
        if "demo" in screen:
            return "demolition"
        if "str" in screen or "rental" in screen:
            return "str_registration"
        return "general"


observer_agent = ObserverAgent()
