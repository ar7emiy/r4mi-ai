from enum import Enum


class SSEEventType(str, Enum):
    """All typed SSE events emitted by the backend to the frontend."""
    CONNECTED = "CONNECTED"
    PING = "PING"
    # Pattern detection
    OPTIMIZATION_OPPORTUNITY = "OPTIMIZATION_OPPORTUNITY"
    PATTERN_UPDATE = "PATTERN_UPDATE"
    # Session replay + confirmation flow
    REPLAY_FRAME = "REPLAY_FRAME"
    SOURCE_HIGHLIGHT = "SOURCE_HIGHLIGHT"
    SPEC_READY = "SPEC_READY"
    # Agent market
    AGENTVERSE_MATCH = "AGENTVERSE_MATCH"
    AGENTVERSE_NO_MATCH = "AGENTVERSE_NO_MATCH"
    # Agent execution
    AGENT_DEMO_STEP = "AGENT_DEMO_STEP"
    AGENT_STATUS_UPDATE = "AGENT_STATUS_UPDATE"
    AGENT_COMPLETED = "AGENT_COMPLETED"
    # Trust lifecycle
    TRUST_LEVEL_CHANGED = "TRUST_LEVEL_CHANGED"
    # Exceptions
    EXCEPTION_FLAGGED = "EXCEPTION_FLAGGED"
