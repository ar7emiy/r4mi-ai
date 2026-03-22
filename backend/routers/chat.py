from __future__ import annotations
import json
import os
import time
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select, func
from google import genai

from db import get_session
from models.agent_spec import NarrowAgentSpec
from models.session import SessionRecord, PatternState
from services.log_streamer import logger

router = APIRouter()

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))

SYSTEM_PROMPT = """You are r4mi-ai, an AI assistant embedded in a municipal permit processing system.
You help permit technicians by:
- Detecting repetitive workflows and building narrow automation agents
- Answering questions about available agents, their trust levels, and capabilities
- Explaining how the system works (passive observation → pattern detection → agent creation)
- Guiding users through recording workflows and publishing agents

Keep responses concise (2-4 sentences). Use plain language. You're talking to government workers, not developers.
Do not use markdown formatting — plain text only.
"""


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


@router.post("/api/chat")
async def chat(body: ChatRequest, db: Session = Depends(get_session)):
    """Handle a free-text chat message from the sidebar."""

    # Gather system context
    agents = db.exec(select(NarrowAgentSpec)).all()
    agent_summary = ", ".join(
        f"{a.name} ({a.trust_level}, {a.successful_runs} runs)"
        for a in agents
    ) or "No agents published yet."

    active_sessions = db.exec(
        select(func.count())
        .where(SessionRecord.state.in_([PatternState.COLLECTING, PatternState.CANDIDATE, PatternState.READY]))
    ).one()

    ready_sessions = db.exec(
        select(SessionRecord)
        .where(SessionRecord.state == PatternState.READY)
    ).all()
    ready_info = ""
    if ready_sessions:
        ready_info = f"\nSessions with detected patterns ready for agent creation: {', '.join(s.session_id for s in ready_sessions)}"

    context = f"""Current system state:
- Published agents: {len(agents)} [{agent_summary}]
- Active/pending sessions: {active_sessions}{ready_info}
"""

    prompt = f"""{SYSTEM_PROMPT}

{context}

User message: {body.message}"""

    t0 = time.time()
    try:
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        reply = response.text.strip()
        latency_ms = int((time.time() - t0) * 1000)
        logger.info(f"[Chat] Gemini responded in {latency_ms}ms | {len(reply)} chars")
    except Exception as e:
        msg = str(e)
        logger.warning(f"[Chat] Gemini error: {msg[:120]}")
        if any(k in msg for k in ("429", "quota", "RESOURCE_EXHAUSTED")):
            reply = "I'm temporarily unable to respond — the AI quota has been reached. Try again in a minute, or use /help for available commands."
        else:
            reply = "I wasn't able to process that. Try /help for available commands, or ask me about agents and workflows."

    return {"reply": reply}
