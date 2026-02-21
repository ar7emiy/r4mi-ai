"""Google integration adapters for the hackathon path.

This file keeps concrete interfaces so the demo backend can be upgraded to:
- Gemini Live API session ingestion (audio/video/screen).
- ADK agent orchestration for detector/spec-builder/code-builder agents.
- Google Cloud persistence and queueing (Firestore, Pub/Sub, Cloud Run jobs).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class LiveObservation:
    session_id: str
    modality: str
    payload: dict[str, Any]


class GeminiLiveAdapter:
    """Placeholder adapter for Gemini Live API event ingestion."""

    def ingest(self, observation: LiveObservation) -> dict[str, Any]:
        # Replace with actual Live API calls and auth flow (ephemeral tokens for client sessions).
        return {
            "session_id": observation.session_id,
            "status": "queued_for_analysis",
            "modality": observation.modality,
        }


class AdkAgentOrchestrator:
    """Placeholder adapter for ADK multi-agent workflow execution."""

    def run_detector(self, session_events: list[dict[str, Any]]) -> dict[str, Any]:
        return {"status": "ok", "opportunity_score": 0.84, "pipeline": "detector_agent"}

    def run_spec_builder(self, captured_steps: list[dict[str, Any]]) -> dict[str, Any]:
        return {"status": "ok", "pipeline": "spec_builder_agent", "questions": []}

    def run_module_builder(self, spec: dict[str, Any]) -> dict[str, Any]:
        return {"status": "ok", "pipeline": "module_builder_agent", "version": 1}


class GoogleCloudOps:
    """Placeholder adapter for cloud persistence, events, and notifications."""

    def persist_state(self, namespace: str, payload: dict[str, Any]) -> dict[str, str]:
        return {"namespace": namespace, "status": "stored"}

    def publish_event(self, topic: str, payload: dict[str, Any]) -> dict[str, str]:
        return {"topic": topic, "status": "published"}

    def notify_reviewer(self, reviewer_id: str, message: str) -> dict[str, str]:
        return {"reviewer_id": reviewer_id, "status": "notified", "message": message}
