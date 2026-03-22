from __future__ import annotations
import os
from typing import TYPE_CHECKING

from models.agent_spec import NarrowAgentSpec, TrustLevel
from services.log_streamer import logger

if TYPE_CHECKING:
    from sqlmodel import Session

TRUST_PROMOTION_MIN_RUNS = int(os.getenv("TRUST_PROMOTION_MIN_RUNS", "10"))
TRUST_PROMOTION_MAX_FAILURE_RATE = float(
    os.getenv("TRUST_PROMOTION_MAX_FAILURE_RATE", "0.05")
)
TRUST_STALE_THRESHOLD_RUNS = int(os.getenv("TRUST_STALE_THRESHOLD_RUNS", "50"))

# Batch size bounds
BATCH_SIZE_MIN = 1
BATCH_SIZE_MAX = 20  # effectively "whole workflow" once reached


def evaluate_trust(spec: NarrowAgentSpec) -> TrustLevel:
    """Compute the correct trust level based on run history."""
    total = spec.successful_runs + spec.failed_runs
    if total == 0:
        return TrustLevel.SUPERVISED

    failure_rate = spec.failed_runs / total if total > 0 else 0.0

    if total >= TRUST_PROMOTION_MIN_RUNS and failure_rate <= TRUST_PROMOTION_MAX_FAILURE_RATE:
        return TrustLevel.AUTONOMOUS

    if total >= TRUST_STALE_THRESHOLD_RUNS and failure_rate > 0.1:
        return TrustLevel.STALE

    return TrustLevel.SUPERVISED


def get_batch_size(agent_id: str, db: "Session") -> int:
    """
    Return the current approved batch window for an agent.

    Algorithm:
    - Pull correction history for this agent from the DB.
    - Count how many of the last N runs had corrections.
    - If correction rate < threshold → increment batch size (up to max).
    - If multiple corrections in a single run (divergence signal) → reset to 1.
    - Batch size is derived fresh each call; not persisted separately.
    """
    from models.session import AgentCorrection
    from sqlmodel import select

    corrections = db.exec(
        select(AgentCorrection)
        .where(AgentCorrection.agent_id == agent_id)
        .order_by(AgentCorrection.created_at)  # type: ignore[arg-type]
    ).all()

    if not corrections:
        return BATCH_SIZE_MIN

    # Group corrections by session to detect divergence (>1 correction in same session)
    sessions_with_corrections: dict[str, int] = {}
    for c in corrections:
        sessions_with_corrections[c.session_id] = sessions_with_corrections.get(c.session_id, 0) + 1

    total_corrected_sessions = len(sessions_with_corrections)
    divergence_sessions = sum(1 for count in sessions_with_corrections.values() if count > 1)

    if divergence_sessions > 0:
        # Divergence detected — shrink batch size
        batch = max(BATCH_SIZE_MIN, BATCH_SIZE_MIN + 1 - divergence_sessions)
        logger.info(f"[TrustEngine] {agent_id[:8]} | batch_size={batch} (divergence detected in {divergence_sessions} sessions)")
        return batch

    # No divergence — compute batch size from overall correction rate across runs
    spec = db.exec(
        select(NarrowAgentSpec).where(NarrowAgentSpec.id == agent_id)
    ).first()
    total_runs = (spec.successful_runs + spec.failed_runs) if spec else total_corrected_sessions
    if total_runs == 0:
        return BATCH_SIZE_MIN

    correction_rate = total_corrected_sessions / total_runs
    if correction_rate <= TRUST_PROMOTION_MAX_FAILURE_RATE:
        # Clean run history — expand batch
        batch = min(BATCH_SIZE_MAX, 1 + int(total_runs / TRUST_PROMOTION_MIN_RUNS))
    else:
        batch = BATCH_SIZE_MIN

    logger.info(
        f"[TrustEngine] {agent_id[:8]} | batch_size={batch} "
        f"(correction_rate={correction_rate:.2%}, runs={total_runs})"
    )
    return batch


def apply_trust_transition(spec: NarrowAgentSpec) -> bool:
    """Update spec.trust_level in place. Returns True if level changed."""
    new_level = evaluate_trust(spec)
    if new_level != spec.trust_level:
        logger.info(
            f"[TrustEngine] {spec.id} | {spec.trust_level} → {new_level} "
            f"(runs={spec.successful_runs + spec.failed_runs}, "
            f"failures={spec.failed_runs})"
        )
        spec.trust_level = new_level
        return True
    return False
