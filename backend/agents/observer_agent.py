from __future__ import annotations

"""
ObserverAgent: ADK agent that watches the UI event stream, extracts patterns,
and identifies unstructured knowledge sources via Gemini Vision.

The actual pattern detection is handled by services/pattern_detector.py and
services/knowledge_extractor.py. This module wires them into the ADK Agent framework.
"""

import logging
import os

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ADK Agent instance — initialized lazily so the app starts even without google-adk installed
_observer_agent = None


def get_observer_agent():
    """Return (and lazily init) the ADK ObserverAgent."""
    global _observer_agent
    if _observer_agent is not None:
        return _observer_agent

    try:
        from google.adk.agents import Agent  # type: ignore
        from services.pattern_detector import pattern_detector
        from services.knowledge_extractor import analyze_screenshot

        async def detect_pattern_tool(session_id: str, screen_sequence: list[str]) -> dict:
            """Tool: check if a screen navigation sequence matches a known pattern."""
            confidence = pattern_detector.get_confidence(session_id)
            stage = pattern_detector.get_stage_name(session_id)
            return {
                "session_id": session_id,
                "confidence": confidence,
                "stage": stage,
                "screen_count": len(screen_sequence),
            }

        async def extract_knowledge_sources_tool(
            session_id: str, screen_name: str, screenshot_b64: str
        ) -> dict:
            """Tool: run Gemini Vision on a screenshot and return knowledge source regions."""
            regions = await analyze_screenshot(session_id, screen_name, screenshot_b64)
            return {"session_id": session_id, "screen_name": screen_name, "regions": regions}

        _observer_agent = Agent(
            name="observer_agent",
            model="gemini-2.5-flash",
            instruction="""
You receive a stream of UI events from a permit processing worker.
Your job is to:
1. Identify repetitive decision patterns across sessions
2. Extract which unstructured text regions the worker consulted
3. Assign confidence scores to each knowledge source
4. Flag when a pattern is mature enough to propose automation

Use detect_pattern_tool to check confidence after every screen_switch event.
Use extract_knowledge_sources_tool when a screen_switch event includes a screenshot.
""",
            tools=[detect_pattern_tool, extract_knowledge_sources_tool],
        )
        logger.info("ObserverAgent (ADK) initialized")
    except ImportError:
        logger.warning("google-adk not installed — ObserverAgent will use direct Gemini calls")
        _observer_agent = None

    return _observer_agent
