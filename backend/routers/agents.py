from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from db import get_db
from models.agent_spec import NarrowAgentSpec, TrustLevel

router = APIRouter()


class PublishAgentRequest(BaseModel):
    name: str
    description: str
    trigger_pattern: dict
    action_sequence: list
    knowledge_sources: list
    permit_type: Optional[str] = None
    user_id: str = "demo_user"


class ForkAgentRequest(BaseModel):
    tuning_delta: dict  # describes what changed: {"action_sequence": [...], "notes": "..."}
    user_id: str = "demo_user"


@router.get("")
async def list_agents(trust_level: Optional[str] = None, permit_type: Optional[str] = None):
    """List all published agents, optionally filtered by trust level or permit type."""
    with get_db() as db:
        specs = db.exec(select(NarrowAgentSpec)).all()

    results = [s.to_dict() for s in specs]

    if trust_level:
        results = [r for r in results if r["trust_level"] == trust_level]
    if permit_type:
        results = [r for r in results if r.get("permit_type") == permit_type]

    return results


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    """Get a single agent spec by ID."""
    with get_db() as db:
        spec = db.get(NarrowAgentSpec, agent_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Agent not found")
    return spec.to_dict()


@router.post("")
async def publish_agent(req: PublishAgentRequest, background_tasks: BackgroundTasks):
    """
    Publish a new NarrowAgentSpec to the agentverse.
    Computes an embedding for cosine similarity matching.
    """
    spec = NarrowAgentSpec(
        id=str(uuid4()),
        name=req.name,
        description=req.description,
        permit_type=req.permit_type,
        trust_level=TrustLevel.SUPERVISED,
    )
    spec.set_trigger_pattern(req.trigger_pattern)
    spec.set_action_sequence(req.action_sequence)
    spec.set_knowledge_sources(req.knowledge_sources)
    spec.set_contributions([{"user_id": req.user_id, "score": 1.0}])

    with get_db() as db:
        db.add(spec)
        db.commit()
        db.refresh(spec)
        result = spec.to_dict()

    # Compute embedding in the background (non-blocking)
    background_tasks.add_task(_compute_and_store_embedding, spec.id, req.name, req.description)

    return result


@router.post("/{agent_id}/fork")
async def fork_agent(agent_id: str, req: ForkAgentRequest):
    """
    Fork an existing agent with tuning changes.
    Computes a contribution split between original author(s) and the new contributor.
    """
    with get_db() as db:
        original = db.get(NarrowAgentSpec, agent_id)
        if not original:
            raise HTTPException(status_code=404, detail="Agent not found")

        from services.contribution_tracker import compute_delta_ratio, split_contributions

        original_sequence = original.get_action_sequence()
        tuned_sequence = req.tuning_delta.get("action_sequence", original_sequence)
        delta = compute_delta_ratio(original_sequence, tuned_sequence)

        original_contributions = [
            type("C", (), c)() if not hasattr(c, "user_id") else c
            for c in original.get_contributions()
        ]
        new_contributions = split_contributions(
            original.get_contributions(), req.user_id, delta
        )

        fork = NarrowAgentSpec(
            id=str(uuid4()),
            name=f"{original.name} (fork)",
            description=original.description,
            trust_level=TrustLevel.SUPERVISED,
            parent_id=original.id,
            permit_type=original.permit_type,
        )
        fork.set_trigger_pattern(original.get_trigger_pattern())
        fork.set_action_sequence(tuned_sequence)
        fork.set_knowledge_sources(original.get_knowledge_sources())
        fork.set_contributions(new_contributions)
        fork.set_embedding(original.get_embedding())

        db.add(fork)
        db.commit()
        db.refresh(fork)
        return fork.to_dict()


@router.post("/{agent_id}/run")
async def record_agent_run(agent_id: str, success: bool = True):
    """Record a completed agent run and check for trust level promotion."""
    from services.trust_engine import trust_engine
    new_level = await trust_engine.record_run(agent_id, success)
    return {"agent_id": agent_id, "trust_level": new_level}


@router.post("/{agent_id}/demo")
async def demo_agent(agent_id: str, session_id: str, background_tasks: BackgroundTasks):
    """
    Trigger a live demo execution of an agent spec.
    Emits AGENT_DEMO_STEP SSE events that drive the frontend AgentDemo component.
    """
    with get_db() as db:
        spec = db.get(NarrowAgentSpec, agent_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Agent not found")

    background_tasks.add_task(_run_agent_demo, spec.to_dict(), session_id)
    return {"status": "demo_started", "agent_id": agent_id, "session_id": session_id}


async def _compute_and_store_embedding(agent_id: str, name: str, description: str) -> None:
    """Background task: compute Gemini embedding and store it in the DB."""
    try:
        from agents.market_matcher import get_embedding
        embedding = await get_embedding(f"{name} {description}")
        with get_db() as db:
            spec = db.get(NarrowAgentSpec, agent_id)
            if spec:
                spec.set_embedding(embedding)
                db.add(spec)
                db.commit()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(f"Embedding error for {agent_id}: {exc}")


async def _run_agent_demo(spec_dict: dict, session_id: str) -> None:
    """Simulate agent execution, emitting AGENT_DEMO_STEP SSE events per action."""
    import asyncio
    from services.event_bus import event_bus
    from models.sse_events import SSEEventType

    actions = spec_dict.get("action_sequence", [])

    await event_bus.publish(session_id, SSEEventType.AGENT_STATUS_UPDATE, {
        "status": "running",
        "agent_name": spec_dict["name"],
        "total_steps": len(actions),
    })

    for i, action in enumerate(actions):
        await asyncio.sleep(1.5)  # simulate 0.5x speed
        await event_bus.publish(session_id, SSEEventType.AGENT_DEMO_STEP, {
            "step_index": i,
            "total_steps": len(actions),
            "action": action,
            "field_id": _extract_field_id(action.get("element_selector", "")),
            "value": action.get("element_value", ""),
            "screen_name": action.get("screen_name", ""),
        })

    await event_bus.publish(session_id, SSEEventType.AGENT_COMPLETED, {
        "agent_name": spec_dict["name"],
        "steps_completed": len(actions),
        "success": True,
    })


def _extract_field_id(selector: str) -> str:
    """Extract field ID from a CSS selector like [data-field-id='parcel_id']."""
    if "data-field-id='" in selector:
        return selector.split("data-field-id='")[1].rstrip("']")
    return selector
