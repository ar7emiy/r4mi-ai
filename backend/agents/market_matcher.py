from __future__ import annotations

import logging
import math
import os
from typing import Optional

from sqlmodel import select

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
AGENTVERSE_MATCH_THRESHOLD = float(os.getenv("AGENTVERSE_MATCH_THRESHOLD", "0.85"))


async def get_embedding(text: str) -> list[float]:
    """
    Get a Gemini text embedding for cosine similarity search.
    Falls back to a simple deterministic hash-based pseudo-embedding if no API key.
    """
    if not GEMINI_API_KEY:
        return _pseudo_embedding(text)

    try:
        from google import genai  # type: ignore

        client = genai.Client(api_key=GEMINI_API_KEY)
        response = await client.aio.models.embed_content(
            model="gemini-embedding-004",
            contents=text,
        )
        return response.embeddings[0].values
    except Exception as exc:
        logger.warning(f"Embedding call failed: {exc} — using pseudo-embedding")
        return _pseudo_embedding(text)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def find_similar_agent(description: str) -> Optional[object]:
    """
    Find the most similar NarrowAgentSpec in the DB using cosine similarity.
    Returns the spec if similarity > AGENTVERSE_MATCH_THRESHOLD, else None.
    """
    from db import get_db
    from models.agent_spec import NarrowAgentSpec

    query_embedding = await get_embedding(description)

    with get_db() as db:
        all_specs = db.exec(select(NarrowAgentSpec)).all()

    best_match: Optional[NarrowAgentSpec] = None
    best_score = 0.0

    for spec in all_specs:
        spec_embedding = spec.get_embedding()
        if not spec_embedding:
            continue
        score = cosine_similarity(query_embedding, spec_embedding)
        if score > best_score:
            best_score = score
            best_match = spec

    if best_score >= AGENTVERSE_MATCH_THRESHOLD:
        logger.info(f"Market match found: {best_match.name} (score={best_score:.3f})")
        return best_match

    logger.info(f"No market match found (best score={best_score:.3f})")
    return None


def _pseudo_embedding(text: str, dim: int = 256) -> list[float]:
    """
    Deterministic pseudo-embedding for offline/no-key development.
    Not semantically meaningful — only useful for testing the pipeline flow.
    """
    h = hash(text.lower())
    result = []
    for i in range(dim):
        h = (h * 1664525 + 1013904223) & 0xFFFFFFFF
        result.append((h / 0xFFFFFFFF) * 2 - 1)
    # Normalize
    norm = math.sqrt(sum(x * x for x in result))
    return [x / norm for x in result] if norm > 0 else result
