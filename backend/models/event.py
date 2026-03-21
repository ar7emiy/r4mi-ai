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
    AGENT_MATCH_FOUND        = "AGENT_MATCH_FOUND"
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
    event_type: Literal["click", "navigate", "input", "screen_switch", "submit", "hover", "scroll", "copy"]
    screen_name: str
    element_selector: str
    element_value: Optional[str] = None
    permit_type: Optional[str] = None  # explicit permit type, bypasses inference
    backend_call: Optional[dict] = None
    screenshot_b64: Optional[str] = None  # on screen_switch (obs mode) or per-interaction (teach mode)
    # Teach-me mode fields (populated when capture_mode="teach")
    element_context: Optional[dict] = None  # {label, role, text, position, landmark}
    capture_mode: Optional[Literal["obs", "teach"]] = "obs"
    step_description: Optional[str] = None  # Gemini-generated natural language label
    is_input_variable: Optional[bool] = None  # True = value varies per case


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
