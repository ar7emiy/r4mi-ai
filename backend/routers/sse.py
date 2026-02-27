from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from models.sse_events import SSEEventType
from services.event_bus import event_bus

router = APIRouter()


@router.get("/{session_id}")
async def sse_stream(session_id: str):
    """
    Server-Sent Events stream for a specific session.
    The frontend connects here and receives all typed SSE events.
    Reconnects automatically via EventSource; recent events are replayed on reconnect.
    """

    async def generator():
        q = event_bus.subscribe(session_id)

        # Send connection confirmation
        yield {
            "data": json.dumps({
                "type": SSEEventType.CONNECTED,
                "session_id": session_id,
            })
        }

        # Replay buffered events for reconnecting clients
        for buffered in event_bus.get_recent_events(session_id):
            yield {"data": json.dumps(buffered)}

        try:
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=25)
                    yield {"data": json.dumps(msg)}
                except asyncio.TimeoutError:
                    # Keepalive ping to prevent proxy/LB from closing the connection
                    yield {"data": json.dumps({"type": SSEEventType.PING})}
        finally:
            event_bus.unsubscribe(session_id, q)

    return EventSourceResponse(generator())
