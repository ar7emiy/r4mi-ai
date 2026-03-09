from __future__ import annotations
import asyncio
import json
from typing import Any


class SSEBus:
    """Simple in-process pub/sub for SSE clients."""

    def __init__(self):
        self._subscribers: list[asyncio.Queue] = []

    def subscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.append(queue)

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        try:
            self._subscribers.remove(queue)
        except ValueError:
            pass

    async def publish(self, event_type: str, data: Any) -> None:
        payload = {"type": event_type, "data": data}
        dead = []
        for q in self._subscribers:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self.unsubscribe(q)


sse_bus = SSEBus()
