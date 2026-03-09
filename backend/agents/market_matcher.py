from __future__ import annotations
import os
from typing import Optional

from sqlmodel import Session, select

from models.agent_spec import NarrowAgentSpec
from services.embedding_service import embedding_service
from services.log_streamer import logger

AGENTVERSE_MATCH_THRESHOLD = float(
    os.getenv("AGENTVERSE_MATCH_THRESHOLD", "0.85")
)


class MarketMatcher:
    async def find_match(
        self,
        candidate: NarrowAgentSpec,
        db: Session,
    ) -> Optional[tuple[NarrowAgentSpec, float]]:
        """
        Compare candidate spec embedding against all published specs.
        Returns (matching_spec, score) or None.
        """
        published = db.exec(select(NarrowAgentSpec)).all()
        if not published:
            logger.info("[MarketMatcher] No published agents to compare against")
            return None

        best_match: Optional[NarrowAgentSpec] = None
        best_score = 0.0

        for spec in published:
            if not spec.embedding:
                continue
            score = embedding_service.cosine_similarity(
                candidate.embedding, spec.embedding
            )
            logger.info(
                f"[MarketMatcher] vs '{spec.name}': cosine={score}"
            )
            if score > best_score:
                best_score = score
                best_match = spec

        if best_match and best_score >= AGENTVERSE_MATCH_THRESHOLD:
            logger.info(
                f"[MarketMatcher] Match found: '{best_match.name}' (score={best_score})"
            )
            return best_match, best_score

        logger.info(
            f"[MarketMatcher] No match above threshold {AGENTVERSE_MATCH_THRESHOLD}"
        )
        return None


market_matcher = MarketMatcher()
