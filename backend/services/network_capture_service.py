"""Network call ingest for site-agnostic r4mi.

capture.js wraps the host application's fetch/XHR and POSTs each call here.
Records are stored on SessionRecord.network_calls and become ground truth for
"what data does this workflow consume" — SpecBuilder uses them, NarrowAgent
replays them at run time via the host page (so cookies/auth context apply).
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlmodel import Session

from models.session import SessionRecord
from services.log_streamer import logger

# Skip our own backend's API endpoints to avoid recording r4mi's own SSE/observe
# round-trips when capture.js is loaded on a host that proxies to r4mi.
SELF_PATH_PREFIXES = (
    "/api/observe",
    "/api/sse",
    "/api/logs",
    "/api/agents",
    "/api/session",
    "/api/chat",
    "/api/evidence",
)

# Hard cap on stored response body size to avoid bloating session rows.
MAX_BODY_CHARS = 8192


class NetworkCall(BaseModel):
    session_id: str
    method: str
    url: str
    request_body: Optional[str] = None
    response_status: Optional[int] = None
    response_body: Optional[str] = None
    response_headers: Optional[dict] = None
    timestamp: datetime
    screen_at_request: Optional[str] = None
    duration_ms: Optional[int] = None


def is_self_url(url: str) -> bool:
    """True if the URL targets r4mi's own backend (skip recording)."""
    if not url:
        return False
    # Strip protocol/host to get path
    path = url
    if "://" in url:
        try:
            from urllib.parse import urlparse
            path = urlparse(url).path or "/"
        except Exception:
            pass
    return any(path.startswith(p) for p in SELF_PATH_PREFIXES)


def _truncate(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    if len(s) <= MAX_BODY_CHARS:
        return s
    return s[:MAX_BODY_CHARS] + f"…[truncated {len(s) - MAX_BODY_CHARS}c]"


class NetworkCaptureService:
    def record(self, call: NetworkCall, db: Session) -> bool:
        """Append a network call to its session record. Returns True if stored."""
        if is_self_url(call.url):
            return False

        session = db.get(SessionRecord, call.session_id)
        if session is None:
            # Session not yet created — likely race with first navigate event.
            # Drop silently; future calls in same session will be captured.
            return False

        entry = {
            "method": call.method,
            "url": call.url,
            "request_body": _truncate(call.request_body),
            "response_status": call.response_status,
            "response_body": _truncate(call.response_body),
            "response_headers": call.response_headers,
            "timestamp": call.timestamp.isoformat(),
            "screen_at_request": call.screen_at_request,
            "duration_ms": call.duration_ms,
        }
        existing = list(session.network_calls or [])
        existing.append(entry)
        session.network_calls = existing
        db.add(session)
        db.commit()
        logger.info(
            f"[NetworkCapture] {call.method} {call.url} → "
            f"{call.response_status or '?'} ({call.duration_ms or '?'}ms) "
            f"[session={call.session_id}]"
        )
        return True


network_capture_service = NetworkCaptureService()
