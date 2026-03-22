from __future__ import annotations
import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from services.sse_bus import sse_bus

router = APIRouter()


@router.get("/api/sse")
async def sse_stream():
    """Main SSE stream — typed domain events."""

    async def event_generator() -> AsyncIterator[dict]:
        queue: asyncio.Queue = asyncio.Queue()
        sse_bus.subscribe(queue)
        try:
            while True:
                event = await queue.get()
                # Send as unnamed "message" event so EventSource.onmessage fires.
                # The event type is included in the JSON payload for client-side routing.
                yield {"data": json.dumps({"event": event["type"], "data": event["data"]})}
        finally:
            sse_bus.unsubscribe(queue)

    return EventSourceResponse(event_generator())
