from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Literal, Optional
from pydantic import BaseModel


class SSEEventType(str, Enum):
    SCREEN_SWITCH            = "SCREEN_SWITCH"
    KNOWLEDGE_EXTRACTED      = "KNOWLEDGE_EXTRACTED"
    PATTERN_CANDIDATE        = "PATTERN_CANDIDATE"
    OPTIMIZATION_OPPORTUNITY = "OPTIMIZATION_OPPORTUNITY"
    REPLAY_FRAME             = "REPLAY_FRAME"
    SPEC_GENERATED           = "SPEC_GENERATED"
    SPEC_UPDATED             = "SPEC_UPDATED"
    AGENT_DEMO_STEP          = "AGENT_DEMO_STEP"
    AGENT_PUBLISHED          = "AGENT_PUBLISHED"
    AGENT_RUN_COMPLETE       = "AGENT_RUN_COMPLETE"
    AGENT_EXCEPTION          = "AGENT_EXCEPTION"


class UIEvent(BaseModel):
    session_id: str
    user_id: str
    timestamp: datetime
    event_type: Literal["click", "navigate", "input", "screen_switch", "submit"]
    screen_name: str
    element_selector: str
    element_value: Optional[str] = None
    permit_type: Optional[str] = None  # explicit permit type, bypasses inference
    backend_call: Optional[dict] = None
    screenshot_b64: Optional[str] = None  # only on screen_switch events


class ActionTrace(BaseModel):
    session_id: str
    user_id: str
    permit_type: str
    events: list[UIEvent]
    embedding: Optional[list[float]] = None
    completed_at: datetime


class KnowledgeSource(BaseModel):
    selector_description: str
    text_snippet: str
    confidence: float
    source_type: str  # "policy_text" | "case_note" | "freetext" | "table"
    screen_name: str
