from __future__ import annotations
import os
import time
import numpy as np
from google import genai

from services.log_streamer import logger
from services.exceptions import QuotaExhaustedException
from models.event import ActionTrace


class EmbeddingService:
    def __init__(self):
        self.client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        self._cache: dict[str, list[float]] = {}

    async def embed(self, text: str, cache_key: str) -> list[float]:
        if cache_key in self._cache:
            logger.info(f"[Embedding] {cache_key} — cache hit")
            return self._cache[cache_key]

        t0 = time.time()
        try:
            result = await self.client.aio.models.embed_content(
                model="models/gemini-embedding-001",
                contents=text,
            )
        except Exception as e:
            msg = str(e)
            if any(k in msg for k in ("429", "quota", "RESOURCE_EXHAUSTED", "Quota")):
                logger.warning(f"[Embedding] QUOTA EXHAUSTED — {msg[:120]}")
                raise QuotaExhaustedException(msg) from e
            raise
        latency_ms = int((time.time() - t0) * 1000)
        vector = result.embeddings[0].values
        self._cache[cache_key] = vector

        token_estimate = len(text.split())
        logger.info(
            f"[Embedding] gemini-embedding-001 called | key={cache_key} | "
            f"~{token_estimate} tokens | {len(vector)} dims | {latency_ms}ms"
        )
        return vector

    def cosine_similarity(self, a: list[float], b: list[float]) -> float:
        va = np.array(a, dtype=np.float64)
        vb = np.array(b, dtype=np.float64)
        denom = np.linalg.norm(va) * np.linalg.norm(vb)
        if denom == 0:
            return 0.0
        return round(float(np.dot(va, vb) / denom), 4)

    def serialize_trace(self, trace: ActionTrace) -> str:
        lines = [f"permit_type:{trace.permit_type}"]
        for e in trace.events:
            parts = [e.event_type, e.screen_name, e.element_selector]
            if e.element_value:
                parts.append(e.element_value[:50])
            lines.append(":".join(parts))
        return " | ".join(lines)


embedding_service = EmbeddingService()
