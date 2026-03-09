from __future__ import annotations
import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from services.log_streamer import log_handler

router = APIRouter()


@router.get("/api/logs")
async def log_stream():
    """SSE stream of backend log lines — replays history then streams live."""

    async def generator() -> AsyncIterator[dict]:
        # Replay history
        for line in list(log_handler.history):
            yield {"data": line}
            await asyncio.sleep(0)

        # Stream live
        while True:
            try:
                line = await asyncio.wait_for(log_handler.queue.get(), timeout=30.0)
                yield {"data": line}
            except asyncio.TimeoutError:
                yield {"data": ": keepalive"}

    return EventSourceResponse(generator())
