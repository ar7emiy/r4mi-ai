from __future__ import annotations

import json
from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field
from sqlmodel import SQLModel, Field as SQLField


class ObservationSession(SQLModel, table=True):
    __tablename__ = "observationsession"

    id: str = SQLField(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = "demo_user"
    permit_type: str = "fence_variance_r2"
    # Events stored as JSON string (list of UIEvent dicts)
    events: Optional[str] = SQLField(default="[]")
    # Screenshots: only last 10 kept, stored as JSON list of base64 strings
    screenshots: Optional[str] = SQLField(default="[]")
    # Pattern detector state (0-9 stage index)
    pattern_stage: int = 0
    pattern_confidence: float = 0.0
    # Reference to the ActionTrace produced for this session
    action_trace_confirmed: bool = False
    knowledge_sources_confirmed: bool = False
    created_at: datetime = SQLField(default_factory=datetime.utcnow)
    updated_at: datetime = SQLField(default_factory=datetime.utcnow)

    def get_events(self) -> list[dict]:
        return json.loads(self.events or "[]")

    def append_event(self, event_dict: dict) -> None:
        events = self.get_events()
        events.append(event_dict)
        self.events = json.dumps(events)
        self.updated_at = datetime.utcnow()

    def get_screenshots(self) -> list[str]:
        return json.loads(self.screenshots or "[]")

    def append_screenshot(self, b64: str) -> None:
        shots = self.get_screenshots()
        shots.append(b64)
        # Keep only the last 10
        self.screenshots = json.dumps(shots[-10:])
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "permit_type": self.permit_type,
            "event_count": len(self.get_events()),
            "pattern_stage": self.pattern_stage,
            "pattern_confidence": self.pattern_confidence,
            "action_trace_confirmed": self.action_trace_confirmed,
            "knowledge_sources_confirmed": self.knowledge_sources_confirmed,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class ReplayFrame(BaseModel):
    """A single step in the session replay playback."""
    frame_index: int
    event: dict  # serialized UIEvent
    highlighted_element: Optional[str] = None  # CSS selector to highlight
    knowledge_source: Optional[dict] = None  # associated KnowledgeSource if any
    timestamp_ms: int = 0  # offset from session start, scaled to 0.5x speed
    screen_name: str = ""
    action_label: str = ""  # human-readable description: "Opened GIS System", "Entered parcel ID"
