from __future__ import annotations
import asyncio
import json
import os
from typing import AsyncIterator

from sqlmodel import Session

from models.agent_spec import NarrowAgentSpec, TrustLevel
from models.event import SSEEventType
from services.log_streamer import logger


class NarrowAgent:
    """
    Executes a published NarrowAgentSpec against the stub APIs.
    Streams AGENT_DEMO_STEP events for each action.
    """

    async def execute(
        self,
        spec: NarrowAgentSpec,
        application: dict,
        db: Session,
    ) -> AsyncIterator[dict]:
        """
        Generator yielding SSE payload dicts for each step.
        Updates spec run counters in db.
        """
        logger.info(
            f"[NarrowAgent] Starting execution: '{spec.name}' "
            f"(trust={spec.trust_level}, app={application.get('application_id', '?')})"
        )

        steps = spec.action_sequence or []
        completed_steps = []
        failed = False

        for step_def in steps:
            step_num = step_def.get("step", 0)
            action = step_def.get("action", "")
            source = step_def.get("source", "")
            field = step_def.get("field", "")
            description = step_def.get("description", "")

            logger.info(
                f"[NarrowAgent] Step {step_num}: {action} | source={source}"
            )

            # Simulate execution against stub data
            result = await self._execute_step(
                step_def, application, spec.knowledge_sources
            )

            step_result = {
                "step": step_num,
                "action": action,
                "field": field,
                "value": result.get("value", ""),
                "source_tag": result.get("source_tag", source),
                "confidence": result.get("confidence", 0.9),
                "description": description,
                "status": "ok" if result.get("value") else "empty",
            }
            completed_steps.append(step_result)

            yield {
                "event": SSEEventType.AGENT_DEMO_STEP,
                "data": step_result,
            }
            await asyncio.sleep(0.1)  # allow SSE flush

        # Update run counters
        db.refresh(spec)
        if failed:
            spec.failed_runs += 1
        else:
            spec.successful_runs += 1
        db.add(spec)
        db.commit()

        logger.info(
            f"[NarrowAgent] Complete: '{spec.name}' | "
            f"runs={spec.successful_runs + spec.failed_runs}"
        )
        yield {
            "event": SSEEventType.AGENT_RUN_COMPLETE,
            "data": {
                "spec_id": spec.id,
                "steps": completed_steps,
                "trust_level": spec.trust_level,
                "successful_runs": spec.successful_runs,
            },
        }

    async def _execute_step(
        self,
        step: dict,
        application: dict,
        knowledge_sources: list,
    ) -> dict:
        """Simulate executing one step against stub data."""
        field = step.get("field", "").lower()
        source = step.get("source", "").lower()

        # Exact field-name routing — SpecBuilderAgent mandates these names
        if field == "zone_classification":
            return {
                "value": "R-2",
                "source_tag": "from GIS API",
                "confidence": 0.97,
            }

        if field == "max_permitted_height":
            return {
                "value": "6 ft",
                "source_tag": "from PDF §14.3",
                "confidence": 0.94,
            }

        if field == "applicant_name":
            return {
                "value": application.get("applicant", ""),
                "source_tag": "from Owner Registry",
                "confidence": 0.99,
            }

        if field == "decision_notes":
            return {
                "value": "Auto-assessed per policy. Variance required.",
                "source_tag": "from SpecBuilderAgent",
                "confidence": 0.88,
            }

        # Fallback: source-only fuzzy matching for non-standard fields
        if "gis" in source or "parcel" in source:
            return {
                "value": "R-2",
                "source_tag": "from GIS API",
                "confidence": 0.97,
            }

        if "pdf" in source or "§" in source or "municipal" in source or "zoning code" in source:
            return {
                "value": "6 ft",
                "source_tag": "from PDF §14.3",
                "confidence": 0.94,
            }

        if "fee" in source:
            return {
                "value": "$535",
                "source_tag": "from Fee Schedule",
                "confidence": 0.99,
            }

        if "owner" in source or "registry" in source:
            return {
                "value": application.get("applicant", ""),
                "source_tag": "from Owner Registry",
                "confidence": 0.99,
            }

        return {"value": "", "source_tag": step.get("source", ""), "confidence": 0.5}


narrow_agent = NarrowAgent()
