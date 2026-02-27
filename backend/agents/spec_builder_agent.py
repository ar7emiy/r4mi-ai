from __future__ import annotations

"""
SpecBuilderAgent: converts a confirmed action trace + knowledge sources
into a NarrowAgentSpec JSON object via Gemini 2.5 Flash.
"""

import json
import logging
import os
from typing import Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


async def build_spec_from_session(
    session_id: str, approved_sources: list[dict]
) -> Optional[object]:
    """
    Build and persist a NarrowAgentSpec from the confirmed session trace.
    Returns the persisted spec, or None on error.
    """
    from db import get_db
    from models.session import ObservationSession
    from models.agent_spec import NarrowAgentSpec, TrustLevel

    with get_db() as db:
        session = db.get(ObservationSession, session_id)
        if not session:
            logger.warning(f"Session {session_id} not found for spec building")
            return None
        events = session.get_events()
        permit_type = session.permit_type

    if GEMINI_API_KEY:
        spec_data = await _generate_spec_via_gemini(events, approved_sources, permit_type)
    else:
        spec_data = _generate_spec_from_heuristics(events, approved_sources, permit_type)

    # Persist the spec
    spec = NarrowAgentSpec(
        id=str(uuid4()),
        name=spec_data.get("name", f"{permit_type.replace('_', ' ').title()} Agent"),
        description=spec_data.get("description", "Auto-generated from observed workflow"),
        trust_level=TrustLevel.SUPERVISED,
        permit_type=permit_type,
    )
    spec.set_trigger_pattern(spec_data.get("trigger_pattern", {}))
    spec.set_action_sequence(spec_data.get("action_sequence", events))
    spec.set_knowledge_sources(approved_sources)
    spec.set_contributions([{"user_id": "demo_user", "score": 1.0}])

    with get_db() as db:
        db.add(spec)
        db.commit()
        db.refresh(spec)
        result = spec

    # Compute embedding in background
    try:
        from agents.market_matcher import get_embedding
        embedding = await get_embedding(f"{spec.name} {spec.description}")
        with get_db() as db:
            s = db.get(NarrowAgentSpec, spec.id)
            if s:
                s.set_embedding(embedding)
                db.add(s)
                db.commit()
    except Exception as e:
        logger.warning(f"Embedding failed for new spec: {e}")

    logger.info(f"Spec built and persisted: {spec.id} — {spec.name}")
    return result


async def _generate_spec_via_gemini(
    events: list[dict], sources: list[dict], permit_type: str
) -> dict:
    """Call Gemini to generate a structured NarrowAgentSpec from the trace."""
    try:
        from google import genai  # type: ignore

        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = f"""
You are a workflow automation expert. Given this confirmed action trace from a permit technician,
generate a NarrowAgentSpec JSON object.

Permit type: {permit_type}

Action trace (UIEvents):
{json.dumps(events, indent=2, default=str)}

Confirmed knowledge sources:
{json.dumps(sources, indent=2)}

Generate a JSON object with these fields:
{{
  "name": "short descriptive name for this agent (e.g. 'Fence Variance R-2 Agent')",
  "description": "one sentence describing what this agent automates",
  "trigger_pattern": {{
    "permit_type": "{permit_type}",
    "conditions": ["list of conditions that activate this agent"]
  }},
  "action_sequence": [
    {{
      "step": 1,
      "screen_name": "...",
      "element_selector": "...",
      "action_type": "navigate|click|input|submit",
      "element_value": "...",
      "rationale": "why this step is taken"
    }}
  ],
  "decision_rule": "human-readable rule describing the decision logic"
}}

Return ONLY valid JSON. No prose.
"""
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={"response_mime_type": "application/json"},
        )
        return json.loads(response.text)
    except Exception as exc:
        logger.warning(f"Gemini spec building failed: {exc} — using heuristics")
        return _generate_spec_from_heuristics(events, sources, permit_type)


def _generate_spec_from_heuristics(
    events: list[dict], sources: list[dict], permit_type: str
) -> dict:
    """Fallback: build a spec from the raw events without Gemini."""
    screens = list({e.get("screen_name", "") for e in events if e.get("screen_name")})
    action_steps = [
        {
            "step": i + 1,
            "screen_name": e.get("screen_name", ""),
            "element_selector": e.get("element_selector", ""),
            "action_type": e.get("event_type", "click"),
            "element_value": e.get("element_value", ""),
        }
        for i, e in enumerate(events)
    ]
    return {
        "name": f"{permit_type.replace('_', ' ').title()} Agent",
        "description": f"Automates {permit_type.replace('_', ' ')} permit processing",
        "trigger_pattern": {
            "permit_type": permit_type,
            "screens_involved": screens,
        },
        "action_sequence": action_steps,
        "decision_rule": "If permit type matches and no violations, route to auto-approve.",
    }
