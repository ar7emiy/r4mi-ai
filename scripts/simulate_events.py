#!/usr/bin/env python3
"""
Simulate UIEvent sequences for 3 permit types.
This replaces the browser extension for the hackathon demo.

Usage:
    python scripts/simulate_events.py --permit fence_variance_r2 --reps 3
    python scripts/simulate_events.py --permit adu_mixed_zone --reps 1
    python scripts/simulate_events.py --permit commercial_signage --reps 1
    python scripts/simulate_events.py --demo   # full demo sequence
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timezone, timedelta
from uuid import uuid4

import httpx

BASE_URL = "http://localhost:8000"

# ── Permit scenarios ──────────────────────────────────────────────────────────
SCENARIOS: dict[str, list[dict]] = {
    "fence_variance_r2": [
        {"event_type": "navigate",     "screen_name": "INBOX",          "element_selector": ".permit-inbox"},
        {"event_type": "click",        "screen_name": "INBOX",          "element_selector": ".permit-item", "element_value": "P-2025-0847"},
        {"event_type": "screen_switch","screen_name": "GIS_SYSTEM",     "element_selector": ".gis-panel"},
        {"event_type": "click",        "screen_name": "GIS_SYSTEM",     "element_selector": "[data-source-id='gis_data']"},
        {"event_type": "screen_switch","screen_name": "CODE_ENFORCEMENT","element_selector": ".enforcement-log"},
        {"event_type": "click",        "screen_name": "CODE_ENFORCEMENT","element_selector": "[data-source-id='violation_history']"},
        {"event_type": "screen_switch","screen_name": "POLICY_WIKI",    "element_selector": ".policy-panel"},
        {"event_type": "click",        "screen_name": "POLICY_WIKI",    "element_selector": "[data-source-id='policy_text']"},
        {"event_type": "screen_switch","screen_name": "PERMIT_FORM",    "element_selector": ".permit-form"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='parcel_id']",         "element_value": "APN-0847-2284"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='zone_classification']","element_value": "R-2"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='setback_compliance']", "element_value": "compliant"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='routing_decision']",   "element_value": "auto_approve"},
        {"event_type": "submit",       "screen_name": "PERMIT_FORM",    "element_selector": "button[type='submit']"},
    ],
    "adu_mixed_zone": [
        {"event_type": "navigate",     "screen_name": "INBOX",          "element_selector": ".permit-inbox"},
        {"event_type": "click",        "screen_name": "INBOX",          "element_selector": ".permit-item", "element_value": "P-2025-1103"},
        {"event_type": "screen_switch","screen_name": "GIS_SYSTEM",     "element_selector": ".gis-panel"},
        {"event_type": "screen_switch","screen_name": "CODE_ENFORCEMENT","element_selector": ".enforcement-log"},
        {"event_type": "screen_switch","screen_name": "POLICY_WIKI",    "element_selector": ".policy-panel"},
        {"event_type": "screen_switch","screen_name": "PERMIT_FORM",    "element_selector": ".permit-form"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='parcel_id']",              "element_value": "APN-1103-5567"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='zone_classification']",     "element_value": "R-2/C-1 Mixed"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='violation_history_flag']",  "element_value": "resolved"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='escalation_decision']",     "element_value": "manual_review"},
        {"event_type": "submit",       "screen_name": "PERMIT_FORM",    "element_selector": "button[type='submit']"},
    ],
    "commercial_signage": [
        {"event_type": "navigate",     "screen_name": "INBOX",          "element_selector": ".permit-inbox"},
        {"event_type": "click",        "screen_name": "INBOX",          "element_selector": ".permit-item", "element_value": "P-2025-2291"},
        {"event_type": "screen_switch","screen_name": "GIS_SYSTEM",     "element_selector": ".gis-panel"},
        {"event_type": "screen_switch","screen_name": "POLICY_WIKI",    "element_selector": ".policy-panel"},
        {"event_type": "click",        "screen_name": "POLICY_WIKI",    "element_selector": "[data-source-id='policy_text']", "element_value": "Section 5.3 Signage Setbacks"},
        {"event_type": "screen_switch","screen_name": "PERMIT_FORM",    "element_selector": ".permit-form"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='parcel_id']",              "element_value": "APN-2291-0034"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='sign_type']",              "element_value": "freestanding"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='setback_distance']",       "element_value": "15"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='policy_section_applied']", "element_value": "Section 5.3.2"},
        {"event_type": "input",        "screen_name": "PERMIT_FORM",    "element_selector": "[data-field-id='approval_status']",        "element_value": "approved_with_conditions"},
        {"event_type": "submit",       "screen_name": "PERMIT_FORM",    "element_selector": "button[type='submit']"},
    ],
}


async def post_event(client: httpx.AsyncClient, event: dict) -> bool:
    try:
        r = await client.post(f"{BASE_URL}/observe", json=event, timeout=10)
        status = "✓" if r.status_code == 200 else "✗"
        print(f"  {status} [{r.status_code}] {event['event_type']:15s} {event['screen_name']}")
        return r.status_code == 200
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        return False


async def simulate_session(
    permit_type: str,
    session_id: str | None = None,
    user_id: str = "demo_tech",
    base_delay: float = 0.3,
) -> str:
    sid = session_id or str(uuid4())
    print(f"\n{'='*60}")
    print(f"Session: {sid[:8]}...  Permit: {permit_type}")
    print(f"{'='*60}")

    events = SCENARIOS.get(permit_type, [])
    start_time = datetime.now(timezone.utc)

    async with httpx.AsyncClient() as client:
        for i, ev_template in enumerate(events):
            event = {
                "session_id": sid,
                "user_id": user_id,
                "timestamp": (start_time + timedelta(seconds=i * 2)).isoformat(),
                **ev_template,
            }
            await post_event(client, event)
            await asyncio.sleep(base_delay)

    print(f"\n  → {len(events)} events sent for session {sid[:8]}")
    return sid


async def run_demo() -> None:
    """Full demo sequence: 3× fence_variance_r2 → triggers OPTIMIZATION_OPPORTUNITY."""
    print("\n🚀 r4mi-ai Demo Simulation")
    print("  Running 3 fence_variance_r2 sessions to trigger pattern detection...")

    session_ids = []
    for i in range(3):
        print(f"\n  [Session {i+1}/3] Fence Variance R-2")
        sid = await simulate_session("fence_variance_r2", base_delay=0.1)
        session_ids.append(sid)
        await asyncio.sleep(0.5)

    print(f"\n✅ Done. Sessions: {[s[:8] for s in session_ids]}")
    print(f"\n   Check /sse/{{session_id}} for OPTIMIZATION_OPPORTUNITY event")
    print(f"   Check /patterns/{{session_id}} for pattern confidence")


async def main() -> None:
    parser = argparse.ArgumentParser(description="r4mi-ai UIEvent simulator")
    parser.add_argument(
        "--permit",
        choices=list(SCENARIOS.keys()),
        default="fence_variance_r2",
        help="Permit type to simulate",
    )
    parser.add_argument("--reps", type=int, default=1, help="Number of repetitions")
    parser.add_argument("--delay", type=float, default=0.3, help="Delay between events (seconds)")
    parser.add_argument("--demo", action="store_true", help="Run full demo sequence")
    parser.add_argument("--url", default=BASE_URL, help="Backend URL")
    args = parser.parse_args()

    global BASE_URL
    BASE_URL = args.url

    if args.demo:
        await run_demo()
    else:
        for i in range(args.reps):
            if args.reps > 1:
                print(f"\n[Repetition {i+1}/{args.reps}]")
            await simulate_session(args.permit, base_delay=args.delay)


if __name__ == "__main__":
    asyncio.run(main())
