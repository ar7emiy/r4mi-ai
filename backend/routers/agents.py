from __future__ import annotations
import asyncio
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from db import get_session
from models.agent_spec import NarrowAgentSpec, TrustLevel
from models.session import SessionRecord, PatternState
from agents.spec_builder_agent import spec_builder_agent
from agents.market_matcher import market_matcher
from agents.narrow_agent import narrow_agent
from services.trust_engine import apply_trust_transition
from services.log_streamer import logger
from services.exceptions import QuotaExhaustedException
from services.sse_bus import sse_bus

router = APIRouter()


class BuildSpecRequest(BaseModel):
    session_id: str
    correction: Optional[str] = None


class PublishRequest(BaseModel):
    session_id: str
    spec_id: Optional[str] = None  # if already built, pass id; else build fresh


class TuneRequest(BaseModel):
    correction: str
    user_id: str = "permit-tech-001"


@router.post("/api/agents/build")
async def build_spec(
    body: BuildSpecRequest,
    db: Session = Depends(get_session),
):
    """Build (or rebuild with correction) a NarrowAgentSpec for a session."""
    record = db.get(SessionRecord, body.session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        spec = await spec_builder_agent.build_spec(record, correction=body.correction)
    except QuotaExhaustedException:
        await sse_bus.publish("AGENT_EXCEPTION", {"reason": "quota_exhausted"})
        raise HTTPException(status_code=503, detail="quota_exhausted")

    # Check market for existing match
    match_result = await market_matcher.find_match(spec, db)

    event_type = "SPEC_UPDATED" if body.correction else "SPEC_GENERATED"
    await sse_bus.publish(event_type, {
        "session_id": body.session_id,
        "spec": {
            "id": spec.id,
            "name": spec.name,
            "description": spec.description,
            "permit_type": spec.permit_type,
            "action_sequence": spec.action_sequence,
            "knowledge_sources": spec.knowledge_sources,
        },
        "market_match": {
            "spec_id": match_result[0].id,
            "name": match_result[0].name,
            "score": match_result[1],
        } if match_result else None,
    })

    return {
        "spec": spec.model_dump(exclude={"embedding"}),
        "market_match": {
            "spec_id": match_result[0].id,
            "score": match_result[1],
        } if match_result else None,
    }


@router.get("/api/agents/match")
async def match_agents(session_id: str, db: Session = Depends(get_session)):
    """Find existing published agents matching the session pattern."""
    record = db.get(SessionRecord, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    draft_spec = await spec_builder_agent.build_spec(record)
    match_result = await market_matcher.find_match(draft_spec, db)

    if match_result:
        spec, score = match_result
        return {"match": spec.model_dump(exclude={"embedding"}), "score": score}
    return {"match": None, "score": 0.0}


@router.post("/api/agents/publish")
async def publish_agent(
    body: PublishRequest,
    db: Session = Depends(get_session),
):
    """Build and publish a NarrowAgentSpec to the agentverse."""
    record = db.get(SessionRecord, body.session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")

    # Return existing spec if already published — prevents duplicates
    if record.generated_spec_id:
        existing = db.get(NarrowAgentSpec, record.generated_spec_id)
        if existing:
            logger.info(f"[Agentverse] Session {body.session_id} already published as {existing.id[:8]}, returning existing spec")
            return existing.model_dump(exclude={"embedding"})

    try:
        spec = await spec_builder_agent.build_spec(record)
    except QuotaExhaustedException:
        await sse_bus.publish("AGENT_EXCEPTION", {"reason": "quota_exhausted"})
        raise HTTPException(status_code=503, detail="quota_exhausted")
    spec.updated_at = datetime.utcnow()

    db.add(spec)
    db.commit()
    db.refresh(spec)

    record.state = PatternState.PUBLISHED
    record.generated_spec_id = spec.id
    db.add(record)
    db.commit()

    logger.info(f"[Agentverse] Publishing: \"{spec.name}\"")
    logger.info(f"[Agentverse] Embedding spec for market index...")
    logger.info(f"[Agentverse] Agent ID: {spec.id[:8]} | Trust: {spec.trust_level.upper()}")
    logger.info(f"[SSE]        → AGENT_PUBLISHED broadcast to all clients")

    await sse_bus.publish("AGENT_PUBLISHED", {
        "id": spec.id,
        "name": spec.name,
        "permit_type": spec.permit_type,
        "trust_level": spec.trust_level,
        "contributions": spec.contributions,
    })

    return spec.model_dump(exclude={"embedding"})


@router.get("/api/agents")
def list_agents(db: Session = Depends(get_session)):
    specs = db.exec(select(NarrowAgentSpec)).all()
    return [s.model_dump(exclude={"embedding"}) for s in specs]


@router.get("/api/agents/{spec_id}")
def get_agent(spec_id: str, db: Session = Depends(get_session)):
    spec = db.get(NarrowAgentSpec, spec_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Agent not found")
    return spec.model_dump(exclude={"embedding"})


@router.post("/api/agents/{spec_id}/tune")
async def tune_agent(
    spec_id: str,
    body: TuneRequest,
    db: Session = Depends(get_session),
):
    """Fork an existing agent with a correction. Preserves parent attribution."""
    parent = db.get(NarrowAgentSpec, spec_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Find source session for context
    source_session = None
    if parent.source_session_id:
        source_session = db.get(SessionRecord, parent.source_session_id)

    if not source_session:
        raise HTTPException(status_code=400, detail="No source session for spec")

    forked = await spec_builder_agent.build_spec(source_session, correction=body.correction)
    forked.parent_spec_id = parent.id

    # Split attribution
    forked.contributions = [
        *[
            {**c, "share_pct": int(c["share_pct"] * 0.7)}
            for c in parent.contributions
        ],
        {"user_id": body.user_id, "role": "tuner", "share_pct": 30},
    ]

    db.add(forked)
    db.commit()
    db.refresh(forked)

    logger.info(
        f"[Agentverse] Agent tuned and forked: '{forked.name}' "
        f"(parent={spec_id[:8]})"
    )
    await sse_bus.publish("AGENT_PUBLISHED", {
        "id": forked.id,
        "name": forked.name,
        "permit_type": forked.permit_type,
        "trust_level": forked.trust_level,
        "contributions": forked.contributions,
        "parent_spec_id": forked.parent_spec_id,
    })

    return forked.model_dump(exclude={"embedding"})


@router.post("/api/agents/{spec_id}/run")
async def run_agent(
    spec_id: str,
    application_id: str,
    db: Session = Depends(get_session),
):
    """Run a published agent. Broadcasts steps via SSE bus; returns immediately."""
    import pathlib
    spec = db.get(NarrowAgentSpec, spec_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Agent not found")

    seed_path = pathlib.Path(__file__).parent.parent / "seed" / "applications.json"
    applications = json.loads(seed_path.read_text())
    application = next(
        (a for a in applications if a["application_id"] == application_id), {}
    )

    async def _run():
        from sqlmodel import Session as DBSession
        from db import engine
        with DBSession(engine) as task_db:
            task_spec = task_db.get(NarrowAgentSpec, spec_id)
            async for payload in narrow_agent.execute(task_spec, application, task_db):
                await sse_bus.publish(payload["event"], payload["data"])
            apply_trust_transition(task_spec)
            task_db.add(task_spec)
            task_db.commit()

    asyncio.create_task(_run())
    return {"status": "running", "spec_id": spec_id}
