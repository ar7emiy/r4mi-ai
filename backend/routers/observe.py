from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from db import get_session
from models.event import UIEvent, SSEEventType
from models.agent_spec import NarrowAgentSpec
from agents.observer_agent import observer_agent
from services.sse_bus import sse_bus
from services.exceptions import QuotaExhaustedException

router = APIRouter()


@router.post("/api/observe")
async def observe(
    event: UIEvent,
    db: Session = Depends(get_session),
):
    """Receive a UIEvent from the test harness or demo script."""
    try:
        sse_type, session = await observer_agent.handle_event(event, db)
    except QuotaExhaustedException:
        await sse_bus.publish("AGENT_EXCEPTION", {"reason": "quota_exhausted"})
        return {"status": "quota_exhausted", "session_id": event.session_id}

    if sse_type:
        payload: dict = {"session_id": event.session_id}
        if session:
            payload["permit_type"] = session.permit_type
            # Enrich AGENT_MATCH_FOUND with matched spec details
            if sse_type == SSEEventType.AGENT_MATCH_FOUND and session.matched_spec_id:
                matched = db.get(NarrowAgentSpec, session.matched_spec_id)
                if matched:
                    payload["matched_spec"] = {
                        "id": matched.id,
                        "name": matched.name,
                        "description": matched.description,
                        "trust_level": matched.trust_level,
                        "successful_runs": matched.successful_runs,
                        "action_sequence": matched.action_sequence,
                        "knowledge_sources": matched.knowledge_sources,
                    }
        await sse_bus.publish(sse_type, payload)

    return {"status": "ok", "session_id": event.session_id, "sse_emitted": sse_type}
