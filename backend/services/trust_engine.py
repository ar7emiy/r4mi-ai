from __future__ import annotations

import logging
import os

from models.agent_spec import NarrowAgentSpec, TrustLevel

logger = logging.getLogger(__name__)

TRUST_PROMOTION_MIN_RUNS = int(os.getenv("TRUST_PROMOTION_MIN_RUNS", "10"))
TRUST_PROMOTION_MAX_FAILURE_RATE = float(os.getenv("TRUST_PROMOTION_MAX_FAILURE_RATE", "0.05"))


class TrustEngine:
    """
    Manages trust level transitions for NarrowAgentSpec records.
    SUPERVISED → AUTONOMOUS: successful_runs >= threshold AND failure_rate < max
    AUTONOMOUS → STALE: failure_rate exceeds threshold or policy hash changes
    """

    async def record_run(self, agent_id: str, success: bool) -> str:
        """Update run counts, check promotion, emit TRUST_LEVEL_CHANGED SSE if promoted."""
        from db import get_db
        from services.event_bus import event_bus
        from models.sse_events import SSEEventType

        with get_db() as db:
            spec = db.get(NarrowAgentSpec, agent_id)
            if not spec:
                logger.warning(f"Agent {agent_id} not found for trust recording")
                return TrustLevel.SUPERVISED

            if success:
                spec.successful_runs += 1
            else:
                spec.failed_runs += 1

            old_level = spec.trust_level
            new_level = self._compute_trust(spec)

            if new_level != old_level:
                spec.trust_level = new_level
                logger.info(f"Agent {agent_id} trust: {old_level} → {new_level}")

                await event_bus.publish(agent_id, SSEEventType.TRUST_LEVEL_CHANGED, {
                    "agent_id": agent_id,
                    "old_level": old_level,
                    "new_level": new_level,
                    "successful_runs": spec.successful_runs,
                    "failed_runs": spec.failed_runs,
                })

            from datetime import datetime
            spec.updated_at = datetime.utcnow()
            db.add(spec)
            db.commit()

            return str(spec.trust_level)

    def _compute_trust(self, spec: NarrowAgentSpec) -> TrustLevel:
        total = spec.successful_runs + spec.failed_runs
        failure_rate = spec.failed_runs / total if total > 0 else 0.0

        if spec.trust_level == TrustLevel.SUPERVISED:
            if (
                spec.successful_runs >= TRUST_PROMOTION_MIN_RUNS
                and failure_rate < TRUST_PROMOTION_MAX_FAILURE_RATE
            ):
                return TrustLevel.AUTONOMOUS

        elif spec.trust_level == TrustLevel.AUTONOMOUS:
            # Degrade to STALE if failure rate climbs above 10%
            if failure_rate > 0.10 and total >= 5:
                return TrustLevel.STALE

        return spec.trust_level

    async def mark_stale(self, agent_id: str, reason: str = "manual") -> None:
        """Force an agent to STALE (e.g. when referenced policy docs change)."""
        from db import get_db
        from services.event_bus import event_bus
        from models.sse_events import SSEEventType

        with get_db() as db:
            spec = db.get(NarrowAgentSpec, agent_id)
            if spec:
                spec.trust_level = TrustLevel.STALE
                from datetime import datetime
                spec.updated_at = datetime.utcnow()
                db.add(spec)
                db.commit()

        await event_bus.publish(agent_id, SSEEventType.TRUST_LEVEL_CHANGED, {
            "agent_id": agent_id,
            "new_level": TrustLevel.STALE,
            "reason": reason,
        })


# Module-level singleton
trust_engine = TrustEngine()
