from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from db import get_db
from models.session import ObservationSession, ReplayFrame

router = APIRouter()


class ConfirmSequenceRequest(BaseModel):
    approved: bool
    removed_indices: list[int] = []  # step indices the user wants removed


class ConfirmSourcesRequest(BaseModel):
    approved_sources: list[dict]  # list of KnowledgeSource dicts (may include replacements)


@router.post("/new")
async def create_session(user_id: str = "demo_user", permit_type: str = "fence_variance_r2"):
    """Create a new observation session and return its ID."""
    from uuid import uuid4
    session_id = str(uuid4())
    with get_db() as db:
        session = ObservationSession(
            id=session_id,
            user_id=user_id,
            permit_type=permit_type,
        )
        db.add(session)
        db.commit()
    return {"session_id": session_id, "permit_type": permit_type}


@router.get("/{session_id}/status")
async def get_session_status(session_id: str):
    """Get the current status of a session."""
    with get_db() as db:
        session = db.get(ObservationSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.to_dict()


@router.get("/{session_id}/replay")
async def get_replay_frames(session_id: str):
    """
    Return ordered ReplayFrames for a session.
    Each frame maps to one UIEvent with display metadata.
    Timestamps are offset from session start, scaled to 0.5x speed.
    """
    with get_db() as db:
        session = db.get(ObservationSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    events = session.get_events()
    frames = []
    start_ts: Optional[float] = None

    for i, event in enumerate(events):
        # Parse timestamp
        from datetime import datetime
        ts_str = event.get("timestamp", "")
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp()
        except Exception:
            ts = 0.0

        if start_ts is None:
            start_ts = ts

        real_offset_ms = int((ts - start_ts) * 1000)
        # 0.5x speed: double the time offset for playback
        playback_ms = real_offset_ms * 2

        # Build action label
        label = _build_action_label(event)

        frame = ReplayFrame(
            frame_index=i,
            event=event,
            highlighted_element=event.get("element_selector", ""),
            timestamp_ms=playback_ms,
            screen_name=event.get("screen_name", ""),
            action_label=label,
        )
        frames.append(frame.model_dump())

    return {"session_id": session_id, "frames": frames, "total": len(frames)}


@router.post("/{session_id}/confirm-sequence")
async def confirm_action_sequence(
    session_id: str,
    req: ConfirmSequenceRequest,
    background_tasks: BackgroundTasks,
):
    """
    Step 1 of 2-step confirmation flow.
    User approves (or edits) the captured action sequence.
    On approval, triggers knowledge source extraction via Gemini Vision.
    """
    with get_db() as db:
        session = db.get(ObservationSession, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if req.approved:
            # Remove any steps the user flagged
            if req.removed_indices:
                events = session.get_events()
                filtered = [e for i, e in enumerate(events) if i not in req.removed_indices]
                import json
                session.events = json.dumps(filtered)

            session.action_trace_confirmed = True
            db.add(session)
            db.commit()

            # Trigger knowledge source extraction in background
            background_tasks.add_task(_extract_knowledge_sources, session_id)

    return {"status": "confirmed", "session_id": session_id}


@router.post("/{session_id}/confirm-sources")
async def confirm_knowledge_sources(
    session_id: str,
    req: ConfirmSourcesRequest,
    background_tasks: BackgroundTasks,
):
    """
    Step 2 of 2-step confirmation flow.
    User approves (or replaces) the knowledge sources Gemini identified.
    On confirmation, triggers agentverse match + spec building.
    """
    with get_db() as db:
        session = db.get(ObservationSession, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        session.knowledge_sources_confirmed = True
        db.add(session)
        db.commit()

    # Trigger market match → spec build pipeline
    background_tasks.add_task(
        _match_and_build_spec, session_id, req.approved_sources
    )

    return {"status": "sources_confirmed", "session_id": session_id}


def _build_action_label(event: dict) -> str:
    etype = event.get("event_type", "")
    screen = event.get("screen_name", "")
    selector = event.get("element_selector", "")
    value = event.get("element_value", "")

    if etype == "screen_switch":
        return f"Opened {screen.replace('_', ' ').title()}"
    if etype == "navigate":
        return f"Navigated to {screen}"
    if etype == "input" and value:
        field = selector.replace("[data-field-id='", "").replace("']", "").replace("_", " ")
        return f"Entered '{value}' in {field}"
    if etype == "click":
        return f"Clicked {selector}"
    if etype == "submit":
        return "Submitted form"
    return f"{etype} on {screen}"


async def _extract_knowledge_sources(session_id: str) -> None:
    """Background: run Gemini Vision on session screenshots to extract knowledge sources."""
    try:
        from services.knowledge_extractor import extract_from_session
        from services.event_bus import event_bus
        from models.sse_events import SSEEventType

        sources = await extract_from_session(session_id)

        await event_bus.publish(session_id, SSEEventType.SOURCE_HIGHLIGHT, {
            "session_id": session_id,
            "sources": [s if isinstance(s, dict) else s.model_dump() for s in sources],
            "step": "awaiting_source_confirmation",
        })
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(f"Knowledge extraction error: {exc}", exc_info=True)


async def _match_and_build_spec(session_id: str, approved_sources: list[dict]) -> None:
    """Background: run MarketMatcher then either demo existing agent or build new spec."""
    try:
        from services.event_bus import event_bus
        from models.sse_events import SSEEventType
        from db import get_db

        with get_db() as db:
            session = db.get(ObservationSession, session_id)
            if not session:
                return
            events = session.get_events()
            permit_type = session.permit_type

        # Build a description from the session for market matching
        description = f"Handles {permit_type.replace('_', ' ')} permit processing"
        screen_names = list({e.get("screen_name", "") for e in events if e.get("screen_name")})
        description += f" involving screens: {', '.join(screen_names)}"

        # Attempt market match
        from agents.market_matcher import find_similar_agent
        match = await find_similar_agent(description)

        if match:
            await event_bus.publish(session_id, SSEEventType.AGENTVERSE_MATCH, {
                "session_id": session_id,
                "agent": match.to_dict(),
                "message": f"Similar agent found: {match.name}",
            })
        else:
            # Build new spec from confirmed trace
            await event_bus.publish(session_id, SSEEventType.AGENTVERSE_NO_MATCH, {
                "session_id": session_id,
                "message": "No existing agent found — building new spec...",
            })
            from agents.spec_builder_agent import build_spec_from_session
            spec = await build_spec_from_session(session_id, approved_sources)
            if spec:
                await event_bus.publish(session_id, SSEEventType.SPEC_READY, {
                    "session_id": session_id,
                    "spec": spec.to_dict(),
                })

    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(f"Match/build error: {exc}", exc_info=True)
