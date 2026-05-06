"""SpecBuilder — site-agnostic NarrowAgentSpec generation.

Replaces the previous permit-domain prompt. The spec language is now five
canonical actions (READ/FETCH/REASON/WRITE/ASSERT). Each step references
either a target_fingerprint (a selector-free element identifier captured
by capture.js) or a source_fetch (a URL template extracted from the host
app's actually-observed network calls). No domain-specific field names,
no "well-known" lookups — every step is grounded in the worker's recorded
trace.
"""
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


# ─── Output schema ───────────────────────────────────────────────────────────
ELEMENT_FINGERPRINT_SCHEMA = {
    "type": "object",
    "properties": {
        "role": {"type": "string"},
        "accessible_name": {"type": "string"},
        "landmark": {"type": "string"},
        "surrounding_text": {"type": "string"},
        "position_signature": {"type": "string"},
        "url_pattern": {"type": "string"},
    },
    "required": ["role", "accessible_name"],
}

SOURCE_FETCH_SCHEMA = {
    "type": "object",
    "properties": {
        "method": {"type": "string"},
        "url_template": {"type": "string"},
        "expected_status": {"type": "integer"},
        "response_jsonpath": {"type": "string"},
    },
    "required": ["method", "url_template"],
}

STEP_SCHEMA = {
    "type": "object",
    "properties": {
        "step": {"type": "integer"},
        "action": {
            "type": "string",
            "enum": ["read", "fetch", "reason", "write", "assert"],
        },
        "description": {"type": "string"},
        "target_fingerprint": ELEMENT_FINGERPRINT_SCHEMA,
        "source_fetch": SOURCE_FETCH_SCHEMA,
        "value_template": {"type": "string"},
        "reasoning_prompt": {"type": "string"},
        "prerequisites": {"type": "array", "items": {"type": "integer"}},
    },
    "required": ["step", "action", "description"],
}

SPEC_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "description": {"type": "string"},
        "trigger_pattern": {
            "type": "object",
            "properties": {
                "url_pattern": {"type": "string"},
                "conditions": {"type": "array", "items": {"type": "string"}},
            },
        },
        "action_sequence": {"type": "array", "items": STEP_SCHEMA},
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
    "required": ["name", "description", "trigger_pattern",
                 "action_sequence", "knowledge_sources"],
}


class SpecBuilderAgent:
    def __init__(self):
        self._client: Optional[genai.Client] = None

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
        # ── Build event lines with semantic context ──
        sources = session.confirmed_sources or session.knowledge_sources or []
        sources_by_screen: dict[str, dict] = {}
        for s in sources:
            screen = s.get("screen_name")
            if screen:
                sources_by_screen[screen] = s

        active_source: Optional[dict] = None
        event_lines: list[str] = []
        for e in (session.events or []):
            screen = e.get("screen_name")
            if screen and screen in sources_by_screen:
                active_source = sources_by_screen[screen]

            # Prefer element_fingerprint over element_selector — fingerprint
            # is what NarrowAgent will resolve at run time.
            fp = e.get("element_fingerprint") or {}
            target_desc = ""
            if fp:
                target_desc = (
                    f"role={fp.get('role', '?')} "
                    f"name=\"{fp.get('accessible_name', '')[:60]}\" "
                    f"landmark={fp.get('landmark', '?')}"
                )
            else:
                target_desc = e.get("element_selector", "")

            line = (
                f"  [{e.get('event_type')}] screen={screen} "
                f"target=({target_desc}) "
                f"value={(str(e.get('element_value', '')) or '')[:60]}"
            )
            step_desc = e.get("step_description", "")
            if step_desc:
                line += f"\n    description: {step_desc}"
            if active_source and e.get("event_type") in ("input", "write", "submit"):
                line += (
                    f"\n    causal_context: worker had just read "
                    f"\"{active_source.get('text_snippet', '')[:80]}\" "
                    f"from {active_source.get('selector_description', '')} "
                    f"(conf={active_source.get('confidence', 0):.2f})"
                )
            event_lines.append(line)

        events_summary = "\n".join(event_lines) or "  (none)"

        # ── Captured network calls ──
        network_lines: list[str] = []
        for nc in (session.network_calls or []):
            body_preview = (nc.get("response_body") or "")[:200].replace("\n", " ")
            network_lines.append(
                f"  {nc.get('method', '?')} {nc.get('url', '')} "
                f"→ {nc.get('response_status', '?')} "
                f"body: {body_preview}"
            )
        network_summary = "\n".join(network_lines) or "  (no network calls captured)"

        # ── Knowledge sources ──
        sources_summary = "\n".join(
            f"  - [{s.get('source_type')}] {s.get('selector_description')} "
            f"(screen={s.get('screen_name')}, conf={s.get('confidence', 0):.2f}): "
            f"{(s.get('text_snippet') or '')[:120]}"
            for s in sources
        ) or "  (none)"

        correction_block = ""
        if correction:
            correction_block = f"""

### CRITICAL EXPERT CORRECTION ###
The expert has identified an error in the observed workflow or the previous draft.
CORRECTION: {correction}

INSTRUCTIONS:
1. You MUST prioritize this correction over the observed action trace and knowledge sources.
2. If the expert says "the source should be X, not Y", update knowledge_sources accordingly.
3. If the expert specifies a different rule or decision logic, update the action_sequence steps.
4. The expert's correction is the ground truth.
##################################
"""

        return f"""You are building a NarrowAgentSpec — a precise specification for a narrow AI agent
that automates a repetitive workflow inside a web application. The workflow is identified by
the sessions's discovered cluster (cluster_id={session.cluster_id or 'pending'},
cluster_label={session.cluster_label or 'pending'}).

The spec language is five canonical actions:
  - read   : extract a value from a fingerprinted DOM element
  - fetch  : replay a captured HTTP call (URL template, method) — request goes through
             the host page so cookies/auth carry over
  - reason : evaluate a rule using values produced by prior steps (LLM call at run time)
  - write  : type/select a value into a fingerprinted DOM element
  - assert : validate a boolean condition before proceeding

Each step MUST specify either:
  - a `target_fingerprint` (for read/write/assert) — copy the fingerprint shape from the
    observed events, choosing the element that the worker actually interacted with
  - a `source_fetch` (for fetch) — copy the URL/method from the captured network calls
    below, parameterising any per-case identifiers as {{placeholder}} in url_template

Field naming: when a step writes a value, derive the description from the target's
accessible_name. Do NOT invent domain-specific field names like "zone_classification" or
"max_permitted_height" — those are application concerns, not spec concerns.

OBSERVED EVENT TRACE:
{events_summary}

CAPTURED NETWORK CALLS (the host app made these — your `fetch` steps MUST come from this list):
{network_summary}

KNOWLEDGE SOURCES (Vision-extracted regions the worker consulted):
{sources_summary}
{correction_block}

Generate a NarrowAgentSpec that distills this workflow. Aim for 2–6 steps. Steps that
purely navigate (clicks on tab links, etc.) should NOT appear — collapse them by
reading directly from the source_fetch they imply, or by writing directly to the
target_fingerprint of the final input.

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

        # Embed the spec text for market matching
        spec_text = f"{raw['name']} {raw['description']} {json.dumps(raw['action_sequence'])}"
        embedding = await embedding_service.embed(
            spec_text, cache_key=f"spec:draft:{session.session_id}"
        )

        spec = NarrowAgentSpec(
            id=str(uuid4()),
            name=raw["name"],
            description=raw["description"],
            cluster_id=session.cluster_id,
            cluster_label=session.cluster_label,
            trigger_pattern=raw.get("trigger_pattern", {}),
            action_sequence=raw["action_sequence"],
            knowledge_sources=raw.get("knowledge_sources", []),
            embedding=embedding,
            trust_level=TrustLevel.SUPERVISED,
            source_session_id=session.session_id,
            contributions=[
                {"user_id": session.user_id, "role": "author", "share_pct": 100}
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
            cluster_id=draft.get("cluster_id") or session.cluster_id,
            cluster_label=draft.get("cluster_label") or session.cluster_label,
            trigger_pattern=draft.get("trigger_pattern", {}),
            action_sequence=draft["action_sequence"],
            knowledge_sources=draft.get("knowledge_sources", []),
            embedding=embedding,
            trust_level=TrustLevel.SUPERVISED,
            source_session_id=session.session_id,
            contributions=[
                {"user_id": session.user_id, "role": "author", "share_pct": 100}
            ],
        )


spec_builder_agent = SpecBuilderAgent()
