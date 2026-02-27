from __future__ import annotations

from difflib import SequenceMatcher


def compute_delta_ratio(original_sequence: list, tuned_sequence: list) -> float:
    """
    Compute the tuner's contribution share as an edit distance ratio.
    Returns a float in [0.0, 0.9] — original author always keeps at least 10%.
    """
    orig_str = str(original_sequence)
    tuned_str = str(tuned_sequence)
    similarity = SequenceMatcher(None, orig_str, tuned_str).ratio()
    delta = 1.0 - similarity
    return round(min(delta, 0.9), 3)


def split_contributions(
    original_contributions: list[dict],
    new_user_id: str,
    delta_ratio: float,
) -> list[dict]:
    """
    Scale existing contributions by (1 - delta_ratio) and add the new contributor.

    Example:
        original: [{"user_id": "alice", "score": 1.0}], delta=0.2
        result:   [{"user_id": "alice", "score": 0.8}, {"user_id": "bob", "score": 0.2}]
    """
    retain = 1.0 - delta_ratio
    scaled = [
        {"user_id": c["user_id"], "score": round(c["score"] * retain, 3)}
        for c in original_contributions
    ]
    # Merge if the new user already contributed
    existing_ids = {c["user_id"] for c in scaled}
    if new_user_id in existing_ids:
        for c in scaled:
            if c["user_id"] == new_user_id:
                c["score"] = round(c["score"] + delta_ratio, 3)
    else:
        scaled.append({"user_id": new_user_id, "score": round(delta_ratio, 3)})

    return scaled
