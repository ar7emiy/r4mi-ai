from __future__ import annotations
import json
import os
import time
from typing import Optional
from uuid import uuid4

from google import genai

from models.agent_spec import NarrowAgentSpec, TrustLevel
from models.session import SessionRecord
from services.embedding_service import embedding_service
from services.log_streamer import logger


SPEC_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "description": {"type": "string"},
        "permit_type": {"type": "string"},
        "trigger_pattern": {
            "type": "object",
            "properties": {
                "permit_type": {"type": "string"},
                "conditions": {"type": "array", "items": {"type": "string"}},
            },
        },
        "action_sequence": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "step": {"type": "integer"},
                    "action": {"type": "string"},
                    "source": {"type": "string"},
                    "field": {"type": "string"},
                    "description": {"type": "string"},
                },
            },
        },
        "knowledge_sources": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string"},
                    "name": {"type": "string"},
                    "reference": {"type": "string"},
                    "confidence": {"type": "number"},
                },
            },
        },
    },
    "required": ["name", "description", "permit_type", "trigger_pattern",
                 "action_sequence", "knowledge_sources"],
}


class SpecBuilderAgent:
    def __init__(self):
        self.client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    def _build_prompt(
        self,
        session: SessionRecord,
        correction: Optional[str] = None,
    ) -> str:
        events_summary = "\n".join(
            f"  - [{e.get('event_type')}] screen={e.get('screen_name')} "
            f"element={e.get('element_selector')} value={e.get('element_value', '')}"
            for e in (session.events or [])
        )
        sources_summary = "\n".join(
            f"  - [{s.get('source_type')}] {s.get('selector_description')} "
            f"(conf={s.get('confidence', 0):.2f}): {s.get('text_snippet', '')[:100]}"
            for s in (session.confirmed_sources or session.knowledge_sources or [])
        )
        correction_block = ""
        if correction:
            correction_block = f"""
CORRECTION FROM EXPERT:
{correction}

Apply this correction when regenerating the spec. The expert's input takes priority
over any defaults inferred from the action trace.
"""

        return f"""You are building a NarrowAgentSpec — a precise specification for a narrow AI agent
that automates a repetitive permit processing workflow.

OBSERVED ACTION TRACE (permit_type={session.permit_type}):
{events_summary}

CONFIRMED KNOWLEDGE SOURCES:
{sources_summary}
{correction_block}
Generate a NarrowAgentSpec that captures the distilled, optimized version of this workflow.
The agent should eliminate unnecessary navigation by calling APIs directly.
Be specific about which API endpoints and policy sections to use.
The action_sequence should be 2-4 steps maximum.
knowledge_sources must accurately reflect the sources the agent will consult.

Return valid JSON matching the schema. No markdown, no explanation.
"""

    async def build_spec(
        self,
        session: SessionRecord,
        correction: Optional[str] = None,
    ) -> NarrowAgentSpec:
        prompt = self._build_prompt(session, correction)
        token_estimate = len(prompt.split())

        logger.info(
            f"[SpecBuilder] gemini-2.5-flash-lite called (prompt: ~{token_estimate} tokens)"
        )
        t0 = time.time()

        response = await self.client.aio.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": SPEC_SCHEMA,
            },
        )
        latency_ms = int((time.time() - t0) * 1000)

        raw = json.loads(response.text)
        logger.info(
            f"[SpecBuilder] Spec {'regenerated' if correction else 'generated'} | "
            f"{latency_ms}ms | name='{raw.get('name', '')}'"
        )
        if correction:
            # Log what changed
            ks = raw.get("knowledge_sources", [])
            logger.info(
                f"[SpecBuilder] knowledge_sources updated: "
                + ", ".join(s.get("reference", "") for s in ks)
            )

        # Embed the spec text for market matching
        spec_text = f"{raw['name']} {raw['description']} {json.dumps(raw['action_sequence'])}"
        embedding = await embedding_service.embed(
            spec_text, cache_key=f"spec:draft:{session.session_id}"
        )

        spec = NarrowAgentSpec(
            id=str(uuid4()),
            name=raw["name"],
            description=raw["description"],
            permit_type=raw["permit_type"],
            trigger_pattern=raw["trigger_pattern"],
            action_sequence=raw["action_sequence"],
            knowledge_sources=raw["knowledge_sources"],
            embedding=embedding,
            trust_level=TrustLevel.SUPERVISED,
            source_session_id=session.session_id,
            contributions=[
                {
                    "user_id": session.user_id,
                    "role": "author",
                    "share_pct": 100,
                }
            ],
        )
        return spec


spec_builder_agent = SpecBuilderAgent()
