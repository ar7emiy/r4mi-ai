from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from db import get_session
from models.session import SessionRecord
from services.embedding_service import embedding_service

router = APIRouter()


@router.get("/api/evidence/{session_id}")
def get_evidence(session_id: str, db: Session = Depends(get_session)):
    """
    Full proof for judges: action traces, cosine similarity matrix,
    embedding metadata, raw vectors (truncated to 10 dims for display).
    """
    target = db.get(SessionRecord, session_id)
    if not target:
        raise HTTPException(status_code=404, detail="Session not found")

    all_sessions = db.exec(
        select(SessionRecord).where(
            SessionRecord.permit_type == target.permit_type,
            SessionRecord.completed_at != None,
        )
    ).all()

    sessions_out = []
    for s in all_sessions:
        sessions_out.append({
            "session_id": s.session_id,
            "is_seeded": s.is_seeded,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "event_count": len(s.events or []),
            "events": s.events or [],
            "embedding_dims": len(s.embedding or []),
            "embedding_preview": (s.embedding or [])[:10],
        })

    # Build cosine matrix
    matrix = []
    for a in all_sessions:
        row = []
        for b in all_sessions:
            if a.embedding and b.embedding:
                score = embedding_service.cosine_similarity(a.embedding, b.embedding)
            else:
                score = None
            row.append(score)
        matrix.append(row)

    threshold = float(__import__("os").getenv("PATTERN_CONFIDENCE_MIN", "0.85"))

    return {
        "target_session_id": session_id,
        "permit_type": target.permit_type,
        "sessions": sessions_out,
        "similarity_matrix": matrix,
        "similarity_threshold": threshold,
        "embedding_model": "text-embedding-004",
        "embedding_dims": 768,
    }
