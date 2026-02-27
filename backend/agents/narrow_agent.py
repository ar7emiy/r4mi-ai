from __future__ import annotations

"""
NarrowAgent: executes a published NarrowAgentSpec against incoming permit data.
Emits AGENT_DEMO_STEP SSE events for live frontend playback.
"""

import asyncio
import logging

logger = logging.getLogger(__name__)


async def execute_spec(spec_id: str, permit_data: dict, session_id: str) -> bool:
    """
    Execute a NarrowAgentSpec step-by-step against permit_data.
    Emits SSE events for each action so the frontend can show live execution.
    Returns True on success, False on failure.
    """
    from db import get_db
    from models.agent_spec import NarrowAgentSpec
    from services.event_bus import event_bus
    from models.sse_events import SSEEventType
    from services.trust_engine import trust_engine

    with get_db() as db:
        spec = db.get(NarrowAgentSpec, spec_id)
    if not spec:
        logger.error(f"Spec {spec_id} not found")
        return False

    actions = spec.get_action_sequence()

    await event_bus.publish(session_id, SSEEventType.AGENT_STATUS_UPDATE, {
        "status": "running",
        "agent_id": spec_id,
        "agent_name": spec.name,
        "total_steps": len(actions),
    })

    success = True
    try:
        for i, action in enumerate(actions):
            await asyncio.sleep(1.5)  # 0.5x speed simulation

            # Check if this action requires a decision that might fail
            field_value = _resolve_field_value(action, permit_data)

            await event_bus.publish(session_id, SSEEventType.AGENT_DEMO_STEP, {
                "step_index": i,
                "total_steps": len(actions),
                "action": action,
                "field_id": _extract_field_id(action.get("element_selector", "")),
                "value": field_value,
                "screen_name": action.get("screen_name", ""),
                "rationale": action.get("rationale", ""),
            })

    except Exception as exc:
        logger.error(f"Agent execution error: {exc}")
        success = False

        await event_bus.publish(session_id, SSEEventType.EXCEPTION_FLAGGED, {
            "agent_id": spec_id,
            "error": str(exc),
            "message": "Agent encountered an exception — routing to human review",
        })

    # Record run outcome and check trust promotion
    new_trust = await trust_engine.record_run(spec_id, success)

    await event_bus.publish(session_id, SSEEventType.AGENT_COMPLETED, {
        "agent_id": spec_id,
        "agent_name": spec.name,
        "success": success,
        "new_trust_level": new_trust,
        "steps_completed": len(actions),
    })

    return success


def _resolve_field_value(action: dict, permit_data: dict) -> str:
    """Resolve the value for an action, using permit_data where available."""
    # Check if the action has a direct value
    if action.get("element_value"):
        return str(action["element_value"])
    # Try to map field_id to permit_data
    field_id = _extract_field_id(action.get("element_selector", ""))
    return str(permit_data.get(field_id, ""))


def _extract_field_id(selector: str) -> str:
    if "data-field-id='" in selector:
        return selector.split("data-field-id='")[1].rstrip("']")
    return selector
