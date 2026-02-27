from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/{session_id}")
async def get_pattern_status(session_id: str):
    """
    Returns the current state machine status for a session's pattern detection.
    The frontend polls this (or receives SSE PATTERN_UPDATE events) to show progress.
    """
    from services.pattern_detector import pattern_detector
    return {
        "session_id": session_id,
        "stage": pattern_detector.get_stage(session_id),
        "stage_name": pattern_detector.get_stage_name(session_id),
        "confidence": pattern_detector.get_confidence(session_id),
        "event_count": pattern_detector.get_event_count(session_id),
        "sessions_with_pattern": pattern_detector.get_session_count(),
    }


@router.get("")
async def list_all_patterns():
    """Returns all active pattern detection contexts (one per user_id + permit_type combination)."""
    from services.pattern_detector import pattern_detector
    return pattern_detector.get_all_patterns()
