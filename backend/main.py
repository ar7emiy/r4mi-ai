from __future__ import annotations
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
from sqlalchemy import text

from db import create_db_and_tables, engine
from services.log_streamer import logger
from models.session import SessionRecord, PatternState, AgentCorrection  # noqa: F401
from models.event import UIEvent, ActionTrace

# ── routers ──────────────────────────────────────────────────────────────────
from routers import observe, session, agents, evidence, stubs, sse, logs, chat, kanban


def _make_events(session_id: str, user_id: str, base_time: datetime,
                 parcel_id: str, zone: str,
                 constraint_field: str, constraint_value: str) -> list[UIEvent]:
    """Build a canonical event sequence for any permit type."""
    t = base_time
    return [
        UIEvent(session_id=session_id, user_id=user_id,
                timestamp=t, event_type="navigate",
                screen_name="APPLICATION_INBOX",
                element_selector=f"app_row_{session_id}"),
        UIEvent(session_id=session_id, user_id=user_id,
                timestamp=t + timedelta(minutes=1), event_type="screen_switch",
                screen_name="GIS_LOOKUP", element_selector="tab_gis"),
        UIEvent(session_id=session_id, user_id=user_id,
                timestamp=t + timedelta(minutes=2), event_type="input",
                screen_name="GIS_LOOKUP", element_selector="parcel_id_input",
                element_value=parcel_id),
        UIEvent(session_id=session_id, user_id=user_id,
                timestamp=t + timedelta(minutes=3), event_type="navigate",
                screen_name="APPLICATION_FORM", element_selector="tab_form"),
        UIEvent(session_id=session_id, user_id=user_id,
                timestamp=t + timedelta(minutes=4), event_type="input",
                screen_name="APPLICATION_FORM", element_selector="zone_classification",
                element_value=zone),
        UIEvent(session_id=session_id, user_id=user_id,
                timestamp=t + timedelta(minutes=5), event_type="screen_switch",
                screen_name="POLICY_REFERENCE", element_selector="tab_policy"),
        UIEvent(session_id=session_id, user_id=user_id,
                timestamp=t + timedelta(minutes=7), event_type="navigate",
                screen_name="APPLICATION_FORM", element_selector="tab_form"),
        UIEvent(session_id=session_id, user_id=user_id,
                timestamp=t + timedelta(minutes=8), event_type="input",
                screen_name="APPLICATION_FORM", element_selector=constraint_field,
                element_value=constraint_value),
        UIEvent(session_id=session_id, user_id=user_id,
                timestamp=t + timedelta(minutes=9), event_type="submit",
                screen_name="APPLICATION_FORM", element_selector="submit_btn"),
    ]


async def _seed_sessions_for_type(
    db: Session,
    embedding_service,
    permit_type: str,
    session_ids: list[str],
    parcel_ids: list[str],
    base_times: list[datetime],
    zone: str,
    constraint_field: str,
    constraint_value: str,
    knowledge_source: dict,
):
    for session_id, parcel_id, base_time in zip(session_ids, parcel_ids, base_times):
        existing = db.get(SessionRecord, session_id)
        if existing:
            logger.info(f"[Seed] Session {session_id} already exists, skipping")
            continue

        events = _make_events(session_id, "permit-tech-001", base_time,
                              parcel_id, zone, constraint_field, constraint_value)
        completed_at = base_time + timedelta(minutes=9, seconds=30)

        trace = ActionTrace(
            session_id=session_id,
            user_id="permit-tech-001",
            permit_type=permit_type,
            events=events,
            completed_at=completed_at,
        )
        trace_text = embedding_service.serialize_trace(trace)
        vector = await embedding_service.embed(trace_text, cache_key=f"session:{session_id}")

        record = SessionRecord(
            session_id=session_id,
            user_id="permit-tech-001",
            permit_type=permit_type,
            state=PatternState.CANDIDATE,
            events=[e.model_dump(mode="json") for e in events],
            embedding=vector,
            knowledge_sources=[knowledge_source],
            completed_at=completed_at,
            is_seeded=True,
        )
        db.add(record)
        db.commit()
        logger.info(
            f"[Seed] Session {session_id} seeded "
            f"(permit_type={permit_type}, {len(events)} events)"
        )


async def _seed_demo_sessions():
    """
    Pre-load 2 completed sessions per workflow type so the first live
    submission by any public user immediately triggers READY state
    (DEMO_SESSION_SEED=true).
    """
    from services.embedding_service import embedding_service

    WORKFLOW_SEEDS = [
        {
            "permit_type": "fence_variance",
            "session_ids": ["session_001", "session_002"],
            "parcel_ids": ["R2-SEED-001", "R2-SEED-002"],
            "base_times": [datetime(2024, 3, 10, 9, 0, 0), datetime(2024, 3, 11, 10, 0, 0)],
            "zone": "R-2",
            "constraint_field": "max_permitted_height",
            "constraint_value": "6 ft",
            "knowledge_source": {
                "selector_description": "section_14_3_paragraph",
                "text_snippet": "shall not exceed six feet (6') in height",
                "confidence": 0.91,
                "source_type": "policy_text",
                "screen_name": "POLICY_REFERENCE",
            },
        },
        {
            "permit_type": "solar_permit",
            "session_ids": ["session_solar_001", "session_solar_002"],
            "parcel_ids": ["R2-SOL-001", "R2-SOL-002"],
            "base_times": [datetime(2024, 3, 12, 9, 0, 0), datetime(2024, 3, 13, 10, 0, 0)],
            "zone": "R-2",
            "constraint_field": "max_permitted_height",
            "constraint_value": "20 kW max system size",
            "knowledge_source": {
                "selector_description": "section_22_1_solar_access",
                "text_snippet": "residential solar PV systems shall not exceed 20kW nameplate capacity",
                "confidence": 0.89,
                "source_type": "policy_text",
                "screen_name": "POLICY_REFERENCE",
            },
        },
        {
            "permit_type": "home_occupation",
            "session_ids": ["session_ho_001", "session_ho_002"],
            "parcel_ids": ["R2-HO-001", "R2-HO-002"],
            "base_times": [datetime(2024, 3, 14, 9, 0, 0), datetime(2024, 3, 15, 10, 0, 0)],
            "zone": "R-2",
            "constraint_field": "max_permitted_height",
            "constraint_value": "Allowed — no exterior alterations",
            "knowledge_source": {
                "selector_description": "section_18_4_home_occupation",
                "text_snippet": "home occupations are permitted accessory uses in R-2 zones subject to no exterior evidence",
                "confidence": 0.88,
                "source_type": "policy_text",
                "screen_name": "POLICY_REFERENCE",
            },
        },
        {
            "permit_type": "tree_removal",
            "session_ids": ["session_tr_001", "session_tr_002"],
            "parcel_ids": ["R2-TR-001", "R2-TR-002"],
            "base_times": [datetime(2024, 3, 16, 9, 0, 0), datetime(2024, 3, 17, 10, 0, 0)],
            "zone": "R-2",
            "constraint_field": "max_permitted_height",
            "constraint_value": "Removal approved — replacement required 1:1",
            "knowledge_source": {
                "selector_description": "section_9_7_tree_preservation",
                "text_snippet": "removal of protected trees requires replacement planting at a 1:1 ratio",
                "confidence": 0.87,
                "source_type": "policy_text",
                "screen_name": "POLICY_REFERENCE",
            },
        },
        {
            "permit_type": "deck_permit",
            "session_ids": ["session_dk_001", "session_dk_002"],
            "parcel_ids": ["R2-DK-001", "R2-DK-002"],
            "base_times": [datetime(2024, 3, 18, 9, 0, 0), datetime(2024, 3, 19, 10, 0, 0)],
            "zone": "R-2",
            "constraint_field": "max_permitted_height",
            "constraint_value": "30 in max height without railing permit",
            "knowledge_source": {
                "selector_description": "section_16_2_accessory_structures",
                "text_snippet": "decks 30 inches or less above grade do not require guard rails; setback 5ft from rear",
                "confidence": 0.90,
                "source_type": "policy_text",
                "screen_name": "POLICY_REFERENCE",
            },
        },
    ]

    with Session(engine) as db:
        for seed in WORKFLOW_SEEDS:
            await _seed_sessions_for_type(
                db=db,
                embedding_service=embedding_service,
                **seed,
            )



def _migrate_db():
    """Add new columns to existing tables. SQLite doesn't support IF NOT EXISTS on ALTER TABLE."""
    new_columns = [
        ("sessions", "matched_spec_id", "TEXT"),
        ("sessions", "candidate_spec_draft", "JSON"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in new_columns:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
                logger.info(f"[DB] Migration: added {table}.{col}")
            except Exception:
                pass  # column already exists


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    _migrate_db()
    logger.info("[r4mi-ai] Database initialized")

    if os.getenv("DEMO_SESSION_SEED", "false").lower() == "true":
        logger.info("[r4mi-ai] DEMO_SESSION_SEED=true — seeding prior sessions...")
        await _seed_demo_sessions()
        logger.info("[r4mi-ai] Demo sessions ready")

    logger.info("[r4mi-ai] Backend started — listening on :8000")
    yield
    logger.info("[r4mi-ai] Backend shutting down")


app = FastAPI(title="r4mi-ai", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(observe.router)
app.include_router(session.router)
app.include_router(agents.router)
app.include_router(evidence.router)
app.include_router(stubs.router)
app.include_router(sse.router)
app.include_router(logs.router)
app.include_router(chat.router)
app.include_router(kanban.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "r4mi-ai"}
