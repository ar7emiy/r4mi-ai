from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlmodel import Session, select

from db import get_db
from models.event import UIEvent
from models.session import ObservationSession

router = APIRouter()


@router.post("")
async def receive_event(event: UIEvent, background_tasks: BackgroundTasks):
    """
    Receive a UIEvent from the browser extension (or simulation script).
    Stores the event, then triggers pattern detection + Gemini Vision asynchronously.
    """
    with get_db() as db:
        # Upsert the observation session
        session = db.get(ObservationSession, event.session_id)
        if not session:
            session = ObservationSession(
                id=event.session_id,
                user_id=event.user_id,
            )
            db.add(session)

        session.append_event(event.model_dump(mode="json"))

        # Store screenshot (last 10 kept)
        if event.screenshot_b64:
            session.append_screenshot(event.screenshot_b64)

        db.commit()
        db.refresh(session)

    # Kick off pattern detection + optional Gemini Vision in background
    background_tasks.add_task(_process_event_async, event)

    return {
        "status": "received",
        "session_id": event.session_id,
        "event_type": event.event_type,
    }


@router.get("/sessions")
async def list_sessions():
    """List all active observation sessions."""
    with get_db() as db:
        sessions = db.exec(select(ObservationSession)).all()
    return [s.to_dict() for s in sessions]


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get a single observation session by ID."""
    with get_db() as db:
        session = db.get(ObservationSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.to_dict()


async def _process_event_async(event: UIEvent) -> None:
    """
    Background task: runs pattern detection and Gemini Vision.
    Imported lazily to avoid circular imports at module level.
    """
    try:
        from services.pattern_detector import pattern_detector
        from services.event_bus import event_bus
        from models.sse_events import SSEEventType

        confidence = await pattern_detector.process_event(event)

        # Emit pattern update SSE
        await event_bus.publish(event.session_id, SSEEventType.PATTERN_UPDATE, {
            "session_id": event.session_id,
            "confidence": confidence,
            "stage": pattern_detector.get_stage(event.session_id),
        })

        # If a screenshot is present on a screen_switch, run Gemini Vision
        if event.event_type == "screen_switch" and event.screenshot_b64:
            from services.knowledge_extractor import extract_from_screenshot
            await extract_from_screenshot(
                session_id=event.session_id,
                screen_name=event.screen_name,
                b64=event.screenshot_b64,
            )

    except Exception as exc:
        # Never crash the request — pattern detection is best-effort
        import logging
        logging.getLogger(__name__).error(f"Event processing error: {exc}", exc_info=True)
