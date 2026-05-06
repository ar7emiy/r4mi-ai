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


class ElementFingerprint(BaseModel):
    """Selector-free semantic identification of a DOM element.

    Built by capture.js from the accessibility tree at observation time and
    resolved back to a DOM element at agent-run time by element_resolver.js.
    The fingerprint must survive CSS-class refactors, testid renames, and
    minor DOM reshuffles — match strategies use accessible name + role +
    landmark first, falling back to position_signature.
    """
    role: str                  # button | input | textbox | link | heading | combobox | ...
    accessible_name: str       # aria-label | <label> | placeholder | nearby text | inner text
    landmark: str              # main | nav | form | aside | header | footer | section | body
    surrounding_text: str      # excerpt of nearby text (parent + prior sibling label)
    position_signature: str    # "{landmark}:{role}:{ordinal}" among same-role siblings in landmark
    url_pattern: str           # pathname at observation time (templated at resolution time)


class UIEvent(BaseModel):
    session_id: str
    user_id: str
    timestamp: datetime
    event_type: Literal["click", "navigate", "input", "screen_switch", "submit", "hover", "scroll", "copy", "selection", "dwell"]
    screen_name: str
    element_selector: str
    element_value: Optional[str] = None
    # DEPRECATED — kept only for legacy reads, never written by site-agnostic
    # capture.js. Removed entirely once cluster_service replaces permit_type
    # filtering (see Plan Step 4).
    permit_type: Optional[str] = None
    backend_call: Optional[dict] = None
    screenshot_b64: Optional[str] = None  # on screen_switch (obs mode) or per-interaction (teach mode)
    # Selector-free identification — preferred over element_selector for agent execution.
    element_fingerprint: Optional[ElementFingerprint] = None
    # Teach-me mode fields (populated when capture_mode="teach")
    element_context: Optional[dict] = None  # legacy {label, role, text, position, landmark}; superseded by element_fingerprint
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
