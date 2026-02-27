from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UIEvent(BaseModel):
    """Raw event streamed from the browser extension (or simulation script)."""
    session_id: str
    user_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    event_type: str  # "click" | "navigate" | "input" | "screen_switch"
    screen_name: str  # e.g. "GIS_SYSTEM" | "CODE_ENFORCEMENT" | "POLICY_WIKI"
    element_selector: str
    element_value: Optional[str] = None
    backend_call: Optional[dict] = None  # captured XHR/fetch payload
    screenshot_b64: Optional[str] = None  # base64 PNG for Gemini Vision


class ActionTrace(BaseModel):
    """Ordered sequence of UIEvents that form a complete workflow instance."""
    session_id: str
    user_id: str
    permit_type: str
    events: list[UIEvent] = []
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    confirmed: bool = False


class KnowledgeSource(BaseModel):
    """An unstructured text region identified by Gemini Vision as a knowledge source."""
    screen_name: str
    element_selector: str  # CSS selector or descriptive label
    confidence: float = Field(ge=0.0, le=1.0)
    text_excerpt: Optional[str] = None  # snippet of text content identified
    source_type: str = "unstructured"  # "unstructured" | "pdf" | "wiki" | "table"
    confirmed: bool = False
    replacement_url: Optional[str] = None  # user-specified alternative source
