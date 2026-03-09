from __future__ import annotations
import json
import os
import time
from typing import Optional

from google import genai

from models.event import KnowledgeSource
from services.log_streamer import logger


class VisionService:
    def __init__(self):
        self.client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        self._cache: dict[str, list[KnowledgeSource]] = {}

    def _cache_key(self, session_id: str, screen_name: str) -> str:
        return f"{session_id}::{screen_name}"

    def invalidate_session(self, session_id: str) -> None:
        keys = [k for k in self._cache if k.startswith(f"{session_id}::")]
        for k in keys:
            del self._cache[k]

    async def extract_knowledge_sources(
        self,
        screenshot_b64: str,
        screen_name: str,
        session_id: str,
    ) -> list[KnowledgeSource]:
        key = self._cache_key(session_id, screen_name)
        if key in self._cache:
            logger.info(f"[Vision] {screen_name} — cache hit")
            return self._cache[key]

        logger.info(f"[Observer] Screen switch → {screen_name} | sending screenshot to Gemini Vision...")
        t0 = time.time()

        response = await self.client.aio.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[
                {
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": screenshot_b64,
                            }
                        },
                        {
                            "text": f"""This is a screenshot of the '{screen_name}' screen in a municipal permit system.
Identify all regions containing unstructured text that a worker would read to make a permit decision
(policy paragraphs, case notes, freetext fields, regulation excerpts).
Return a JSON array only, no markdown, no explanation:
[{{"selector_description": "...", "text_snippet": "...", "confidence": 0.0, "source_type": "..."}}]
source_type must be one of: policy_text, case_note, freetext, table"""
                        },
                    ]
                }
            ],
        )
        latency_ms = int((time.time() - t0) * 1000)

        sources = self._parse_response(response.text, screen_name)
        self._cache[key] = sources

        region_summary = ", ".join(
            f"({s.selector_description}, conf={s.confidence})" for s in sources
        )
        logger.info(
            f"[Vision]   Regions identified: {len(sources)} | {latency_ms}ms | {region_summary}"
        )
        return sources

    def _parse_response(
        self, text: str, screen_name: str
    ) -> list[KnowledgeSource]:
        try:
            # Strip markdown code fences if present
            clean = text.strip()
            if clean.startswith("```"):
                clean = clean.split("```")[1]
                if clean.startswith("json"):
                    clean = clean[4:]
            raw = json.loads(clean.strip())
            return [
                KnowledgeSource(screen_name=screen_name, **item)
                for item in raw
                if isinstance(item, dict)
            ]
        except Exception as exc:
            logger.warning(f"[Vision] Failed to parse response: {exc}")
            return []


vision_service = VisionService()
