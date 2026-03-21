from __future__ import annotations
import os
import time
from typing import Optional

from google import genai

from models.event import UIEvent
from services.log_streamer import logger
from services.exceptions import QuotaExhaustedException

_STEP_LABEL_MODE = os.getenv("STEP_LABEL_MODE", "realtime")  # realtime | batch


class StepLabeller:
    """
    Generates a one-line natural language description of each UIEvent
    in teach-me mode (capture_mode="teach") using Gemini Flash.

    In realtime mode: called immediately after each event.
    In batch mode: all events labelled at session end (cost-sensitive deployments).
    """

    def __init__(self):
        self.client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    def _build_prompt(self, event: UIEvent) -> str:
        label = ""
        role = ""
        if event.element_context:
            label = event.element_context.get("label", "")
            role = event.element_context.get("role", "")

        return (
            f"# Step context\n"
            f"screen: {event.screen_name}  "
            f"element: {label or event.element_selector} ({role or 'unknown'})\n"
            f"action: {event.event_type}  value: {event.element_value or ''}\n\n"
            f"# Task\n"
            f"Write one plain-English sentence describing what the worker "
            f"just did and why. Max 15 words. No jargon."
        )

    async def label_event(self, event: UIEvent) -> Optional[str]:
        """
        Returns a natural-language step description for a single teach-mode event.
        Returns None if STEP_LABEL_MODE=batch (deferred to session end).
        """
        if _STEP_LABEL_MODE != "realtime":
            return None
        return await self._call_gemini(event)

    async def _call_gemini(self, event: UIEvent) -> Optional[str]:
        """Single Gemini call; shared by realtime and batch paths."""
        prompt = self._build_prompt(event)
        t0 = time.time()
        try:
            response = await self.client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"max_output_tokens": 40},
            )
        except Exception as e:
            msg = str(e)
            if any(k in msg for k in ("429", "quota", "RESOURCE_EXHAUSTED", "Quota")):
                raise QuotaExhaustedException(msg) from e
            logger.warning(f"[StepLabel] Failed to label event: {e}")
            return None
        latency_ms = int((time.time() - t0) * 1000)
        description = (response.text or "").strip().strip('"').strip("'")
        logger.info(
            f"[StepLabel] gemini-2.5-flash | screen={event.screen_name} "
            f"element={event.element_selector} | {latency_ms}ms | \"{description}\""
        )
        return description or None

    async def label_batch(self, events: list[UIEvent]) -> list[Optional[str]]:
        """Label all events at once (used when STEP_LABEL_MODE=batch)."""
        return [await self._call_gemini(e) for e in events]


step_labeller = StepLabeller()
