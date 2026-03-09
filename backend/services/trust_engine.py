from __future__ import annotations
import os

from models.agent_spec import NarrowAgentSpec, TrustLevel
from services.log_streamer import logger

TRUST_PROMOTION_MIN_RUNS = int(os.getenv("TRUST_PROMOTION_MIN_RUNS", "10"))
TRUST_PROMOTION_MAX_FAILURE_RATE = float(
    os.getenv("TRUST_PROMOTION_MAX_FAILURE_RATE", "0.05")
)
TRUST_STALE_THRESHOLD_RUNS = int(os.getenv("TRUST_STALE_THRESHOLD_RUNS", "50"))


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
