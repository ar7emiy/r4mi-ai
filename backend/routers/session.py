from __future__ import annotations
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from db import get_session
from models.session import SessionRecord, PatternState
from models.event import UIEvent
from services.log_streamer import logger

router = APIRouter()


class ConfirmSequenceRequest(BaseModel):
    confirmed_steps: list[dict]


class ConfirmSourcesRequest(BaseModel):
    confirmed_sources: list[dict]


@router.get("/api/session/{session_id}")
def get_session_record(session_id: str, db: Session = Depends(get_session)):
    record = db.get(SessionRecord, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return record


@router.get("/api/session/{session_id}/replay")
def get_replay_frames(session_id: str, db: Session = Depends(get_session)):
    """Return replay frames for the Optimization Panel."""
    record = db.get(SessionRecord, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    record.state = PatternState.REPLAYING
    db.add(record)
    db.commit()

    logger.info(f"[Replay] Session {session_id} — generating replay frames")

    frames = []
    for i, evt in enumerate(record.events or []):
        frames.append({
            "frame_index": i,
            "event_type": evt.get("event_type"),
            "screen_name": evt.get("screen_name"),
            "element_selector": evt.get("element_selector"),
            "element_value": evt.get("element_value"),
            "timestamp": evt.get("timestamp"),
        })

    return {
        "session_id": session_id,
        "permit_type": record.permit_type,
        "total_frames": len(frames),
        "frames": frames,
        "knowledge_sources": record.knowledge_sources or [],
    }


@router.post("/api/session/{session_id}/confirm/sequence")
def confirm_sequence(
    session_id: str,
    body: ConfirmSequenceRequest,
    db: Session = Depends(get_session),
):
    record = db.get(SessionRecord, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    record.confirmed_sequence = body.confirmed_steps
    record.state = PatternState.BUILDING
    db.add(record)
    db.commit()

    logger.info(
        f"[Session] {session_id} — sequence confirmed "
        f"({len(body.confirmed_steps)} steps)"
    )
    return {"status": "ok", "state": record.state}


@router.post("/api/session/{session_id}/confirm/sources")
def confirm_sources(
    session_id: str,
    body: ConfirmSourcesRequest,
    db: Session = Depends(get_session),
):
    record = db.get(SessionRecord, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    record.confirmed_sources = body.confirmed_sources
    db.add(record)
    db.commit()

    logger.info(
        f"[Session] {session_id} — sources confirmed "
        f"({len(body.confirmed_sources)} sources)"
    )
    return {"status": "ok"}
