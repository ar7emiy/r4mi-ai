from __future__ import annotations

import json
import logging
import os
import time

from models.event import KnowledgeSource

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Cache: {session_id:screen_name → analysis result}
_cache: dict[str, dict] = {}
_cache_timestamps: dict[str, float] = {}
CACHE_TTL_SECONDS = 1800  # 30 minutes

# Fallback highlights for when no API key is set or Gemini returns bad JSON
FALLBACK_HIGHLIGHTS: dict[str, list[dict]] = {
    "GIS_SYSTEM": [
        {
            "element_selector": "[data-source-id='gis_data']",
            "region_type": "gis_data",
            "confidence": 0.91,
            "text_preview": "Parcel APN-0847-2284, Zone R-2, Lot 8400 sq ft...",
        }
    ],
    "CODE_ENFORCEMENT": [
        {
            "element_selector": "[data-source-id='violation_history']",
            "region_type": "violation_history",
            "confidence": 0.85,
            "text_preview": "No active violations on record. Case closed 2021...",
        }
    ],
    "POLICY_WIKI": [
        {
            "element_selector": "[data-source-id='policy_text']",
            "region_type": "policy_text",
            "confidence": 0.88,
            "text_preview": "Section 4.7.2 — Fence variance: setback minimum 3ft...",
        }
    ],
    "PERMIT_FORM": [],
    "INBOX": [],
}


def _get_cache_key(session_id: str, screen_name: str) -> str:
    return f"{session_id}:{screen_name}"


async def analyze_screenshot(
    session_id: str, screen_name: str, b64: str
) -> list[dict]:
    """
    Call Gemini Vision on a screenshot to identify unstructured knowledge source regions.
    Returns list of region dicts with element_selector, region_type, confidence, text_preview.
    Results are cached per session+screen.
    """
    cache_key = _get_cache_key(session_id, screen_name)
    now = time.time()

    # Return cached result if fresh
    if cache_key in _cache and now - _cache_timestamps[cache_key] < CACHE_TTL_SECONDS:
        logger.debug(f"Cache hit for {cache_key}")
        return _cache[cache_key]

    # Emit SOURCE_HIGHLIGHT SSE event via event_bus (imported lazily to avoid circular)
    result = await _call_gemini_vision(screen_name, b64)

    _cache[cache_key] = result
    _cache_timestamps[cache_key] = now

    # Push to SSE
    try:
        from services.event_bus import event_bus
        from models.sse_events import SSEEventType
        await event_bus.publish(session_id, SSEEventType.SOURCE_HIGHLIGHT, {
            "screen_name": screen_name,
            "regions": result,
        })
    except Exception as e:
        logger.warning(f"Failed to publish SOURCE_HIGHLIGHT SSE: {e}")

    return result


async def _call_gemini_vision(screen_name: str, b64: str) -> list[dict]:
    """Call Gemini Vision API. Falls back to fixture data if API key missing."""
    if not GEMINI_API_KEY:
        logger.info(f"No GEMINI_API_KEY — using fallback highlights for {screen_name}")
        return FALLBACK_HIGHLIGHTS.get(screen_name, [])

    prompt = """
Analyze this screenshot from a municipal permit processing system.
Identify all unstructured text regions that a permit technician would read to make a decision.
For each region, return a JSON object with:
- element_selector: CSS selector or descriptive identifier (e.g. ".gis-panel", ".policy-section")
- region_type: one of "gis_data" | "violation_history" | "policy_text" | "email_thread" | "pdf_excerpt" | "notes"
- confidence: float 0-1 (how confident you are this region is being consulted)
- text_preview: first 100 characters of visible text in that region

Return ONLY a JSON array of region objects. No other text.
"""
    try:
        from google import genai  # type: ignore

        client = genai.Client(api_key=GEMINI_API_KEY)
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "image/png", "data": b64}},
                    ],
                }
            ],
            config={"response_mime_type": "application/json"},
        )
        regions = json.loads(response.text)
        if not isinstance(regions, list):
            raise ValueError("Expected JSON array")
        return regions
    except Exception as exc:
        logger.warning(f"Gemini Vision call failed for {screen_name}: {exc} — using fallback")
        return FALLBACK_HIGHLIGHTS.get(screen_name, [])


async def extract_from_session(session_id: str) -> list[KnowledgeSource]:
    """
    Extract knowledge sources from all screen_switch events in a session that have screenshots.
    Returns deduplicated list of KnowledgeSource objects.
    """
    from db import get_db
    from models.session import ObservationSession

    with get_db() as db:
        session = db.get(ObservationSession, session_id)
    if not session:
        return []

    events = session.get_events()
    screenshots = session.get_screenshots()
    sources: list[KnowledgeSource] = []
    seen: set[str] = set()

    shot_idx = 0
    for event in events:
        if event.get("event_type") == "screen_switch":
            screen_name = event.get("screen_name", "")
            b64 = event.get("screenshot_b64") or (
                screenshots[shot_idx] if shot_idx < len(screenshots) else None
            )
            if shot_idx < len(screenshots):
                shot_idx += 1

            if screen_name not in seen and b64:
                seen.add(screen_name)
                regions = await analyze_screenshot(session_id, screen_name, b64)
                for r in regions:
                    sources.append(
                        KnowledgeSource(
                            screen_name=screen_name,
                            element_selector=r.get("element_selector", ""),
                            confidence=r.get("confidence", 0.5),
                            text_excerpt=r.get("text_preview", ""),
                            source_type=r.get("region_type", "unstructured"),
                        )
                    )

    return sources


async def extract_from_screenshot(session_id: str, screen_name: str, b64: str) -> list[dict]:
    """Convenience wrapper called from observe.py background task."""
    return await analyze_screenshot(session_id, screen_name, b64)
