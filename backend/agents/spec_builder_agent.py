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
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            self._client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        return self._client

    def _build_prompt(
        self,
        session: SessionRecord,
        correction: Optional[str] = None,
    ) -> str:
        # Build a causally-threaded event summary: for teach-mode events, include
        # step_description (Gemini-generated label) and the active knowledge source.
        sources = session.confirmed_sources or session.knowledge_sources or []
        active_source: Optional[dict] = None
        event_lines = []
        for e in (session.events or []):
            # Track the last knowledge source seen before this event
            if e.get("screen_name") in ("POLICY_REFERENCE", "CODE_ENFORCEMENT"):
                for s in sources:
                    if s.get("screen_name") == e.get("screen_name"):
                        active_source = s
                        break

            step_desc = e.get("step_description", "")
            causal = ""
            if active_source and e.get("event_type") == "input":
                causal = (
                    f" [worker had just read: \"{active_source.get('text_snippet', '')[:80]}\" "
                    f"from {active_source.get('selector_description', '')} "
                    f"conf={active_source.get('confidence', 0):.2f}]"
                )

            line = (
                f"  - [{e.get('event_type')}] screen={e.get('screen_name')} "
                f"element={e.get('element_selector')} value={e.get('element_value', '')}"
            )
            if step_desc:
                line += f"\n    description: {step_desc}"
            if causal:
                line += f"\n    causal context:{causal}"
            event_lines.append(line)

        events_summary = "\n".join(event_lines)
        sources_summary = "\n".join(
            f"  - [{s.get('source_type')}] {s.get('selector_description')} "
            f"(conf={s.get('confidence', 0):.2f}): {s.get('text_snippet', '')[:100]}"
            for s in sources
        )
        correction_block = ""
        if correction:
            correction_block = f"""
### CRITICAL EXPERT CORRECTION ###
The expert has identified an error in the observed workflow or the previous draft.
CORRECTION: {correction}

INSTRUCTIONS:
1. You MUST prioritize this correction over the observed action trace and knowledge sources.
2. If the expert says "the source should be X, not Y", update `knowledge_sources` accordingly.
3. If the expert specifies a different rule or decision logic, update the `action_sequence` descriptions.
4. The expert's correction is the ground truth. DO NOT ignore it.
##################################
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

FIELD NAMING RULES:
- Use snake_case field names that describe the semantic purpose of the field for this specific permit type.
- Well-known field names to reuse when applicable: "zone_classification" (GIS parcel zone lookup),
  "max_permitted_height" (fence/structure height limit), "decision_notes" (final assessment notes),
  "applicant_name" (owner/applicant registry lookup). For other permit types, choose descriptive names.
- Each step's `source` MUST clearly name the system or document (e.g. "GIS API", "PDF §14.3",
  "Municipal Code §9.7", "Fee Schedule", "Owner Registry"). This is critical for agent execution.

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
            f"[SpecBuilder] gemini-2.5-flash called (prompt: ~{token_estimate} tokens)"
        )
        t0 = time.time()

        response = await self.client.aio.models.generate_content(
            model="gemini-2.5-flash",
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

    async def spec_from_draft(
        self,
        draft: dict,
        session: SessionRecord,
    ) -> NarrowAgentSpec:
        """Reconstruct a NarrowAgentSpec from a cached draft dict (no Gemini call)."""
        spec_text = f"{draft['name']} {draft['description']} {json.dumps(draft['action_sequence'])}"
        embedding = await embedding_service.embed(
            spec_text, cache_key=f"spec:draft:{session.session_id}"
        )
        return NarrowAgentSpec(
            id=str(uuid4()),
            name=draft["name"],
            description=draft["description"],
            permit_type=draft["permit_type"],
            trigger_pattern=draft["trigger_pattern"],
            action_sequence=draft["action_sequence"],
            knowledge_sources=draft["knowledge_sources"],
            embedding=embedding,
            trust_level=TrustLevel.SUPERVISED,
            source_session_id=session.session_id,
            contributions=[
                {"user_id": session.user_id, "role": "author", "share_pct": 100}
            ],
        )


spec_builder_agent = SpecBuilderAgent()
