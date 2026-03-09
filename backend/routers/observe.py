from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from db import get_session
from models.event import UIEvent
from agents.observer_agent import observer_agent
from routers._sse_bus import sse_bus

router = APIRouter()


@router.post("/api/observe")
async def observe(
    event: UIEvent,
    db: Session = Depends(get_session),
):
    """Receive a UIEvent from the test harness or demo script."""
    sse_type = await observer_agent.handle_event(event, db)

    if sse_type:
        await sse_bus.publish(
            sse_type,
            {
                "session_id": event.session_id,
                "permit_type": event.screen_name,
            },
        )

    return {"status": "ok", "session_id": event.session_id, "sse_emitted": sse_type}
