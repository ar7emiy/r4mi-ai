from __future__ import annotations

import asyncio
import json
from collections import defaultdict, deque
from typing import AsyncGenerator


class SSEEventBus:
    """
    In-memory pub/sub bus for SSE events.
    Each session_id has its own list of subscriber queues.
    Maintains a small ring buffer of recent events per session
    so reconnecting clients can catch up on missed events.
    """

    RING_BUFFER_SIZE = 20

    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._ring_buffers: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=self.RING_BUFFER_SIZE)
        )

    def subscribe(self, session_id: str) -> asyncio.Queue:
        """Register a new SSE listener for session_id. Returns its queue."""
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers[session_id].append(q)
        return q

    def unsubscribe(self, session_id: str, q: asyncio.Queue) -> None:
        """Remove a queue when the SSE connection closes."""
        subs = self._subscribers.get(session_id, [])
        if q in subs:
            subs.remove(q)

    async def publish(self, session_id: str, event_type: str, data: dict) -> None:
        """Broadcast an event to all subscribers of session_id."""
        msg = {"type": event_type, "data": data}
        self._ring_buffers[session_id].append(msg)
        for q in list(self._subscribers.get(session_id, [])):
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                pass  # drop if consumer is too slow

    def get_recent_events(self, session_id: str) -> list[dict]:
        """Return buffered events for a reconnecting client."""
        return list(self._ring_buffers.get(session_id, []))


# Module-level singleton used by all routers and services
event_bus = SSEEventBus()
