from __future__ import annotations
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from db import create_db_and_tables, engine
from services.log_streamer import logger
from models.session import SessionRecord, PatternState
from models.event import UIEvent, ActionTrace

# ── routers ──────────────────────────────────────────────────────────────────
from routers import observe, session, agents, evidence, stubs, sse, logs


async def _seed_demo_sessions():
    """
    Pre-load 2 completed Fence Variance sessions so the 3rd live walkthrough
    immediately triggers READY state (DEMO_SESSION_SEED=true).
    """
    from services.embedding_service import embedding_service

    base_events_1 = [
        UIEvent(
            session_id="session_001",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 10, 9, 0, 0),
            event_type="navigate",
            screen_name="APPLICATION_INBOX",
            element_selector="app_row_PRM-2024-0001",
        ),
        UIEvent(
            session_id="session_001",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 10, 9, 1, 0),
            event_type="screen_switch",
            screen_name="GIS_LOOKUP",
            element_selector="tab_gis",
        ),
        UIEvent(
            session_id="session_001",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 10, 9, 2, 0),
            event_type="input",
            screen_name="GIS_LOOKUP",
            element_selector="parcel_id_input",
            element_value="R2-SEED-001",
        ),
        UIEvent(
            session_id="session_001",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 10, 9, 3, 0),
            event_type="navigate",
            screen_name="APPLICATION_FORM",
            element_selector="tab_form",
        ),
        UIEvent(
            session_id="session_001",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 10, 9, 4, 0),
            event_type="input",
            screen_name="APPLICATION_FORM",
            element_selector="zone_classification",
            element_value="R-2",
        ),
        UIEvent(
            session_id="session_001",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 10, 9, 5, 0),
            event_type="screen_switch",
            screen_name="POLICY_REFERENCE",
            element_selector="tab_policy",
        ),
        UIEvent(
            session_id="session_001",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 10, 9, 7, 0),
            event_type="navigate",
            screen_name="APPLICATION_FORM",
            element_selector="tab_form",
        ),
        UIEvent(
            session_id="session_001",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 10, 9, 8, 0),
            event_type="input",
            screen_name="APPLICATION_FORM",
            element_selector="max_permitted_height",
            element_value="6 ft",
        ),
        UIEvent(
            session_id="session_001",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 10, 9, 9, 0),
            event_type="submit",
            screen_name="APPLICATION_FORM",
            element_selector="submit_btn",
        ),
    ]

    base_events_2 = [
        UIEvent(
            session_id="session_002",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 11, 10, 0, 0),
            event_type="navigate",
            screen_name="APPLICATION_INBOX",
            element_selector="app_row_PRM-2024-0015",
        ),
        UIEvent(
            session_id="session_002",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 11, 10, 1, 0),
            event_type="screen_switch",
            screen_name="GIS_LOOKUP",
            element_selector="tab_gis",
        ),
        UIEvent(
            session_id="session_002",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 11, 10, 2, 30),
            event_type="input",
            screen_name="GIS_LOOKUP",
            element_selector="parcel_id_input",
            element_value="R2-SEED-002",
        ),
        UIEvent(
            session_id="session_002",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 11, 10, 3, 0),
            event_type="navigate",
            screen_name="APPLICATION_FORM",
            element_selector="tab_form",
        ),
        UIEvent(
            session_id="session_002",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 11, 10, 4, 0),
            event_type="input",
            screen_name="APPLICATION_FORM",
            element_selector="zone_classification",
            element_value="R-2",
        ),
        UIEvent(
            session_id="session_002",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 11, 10, 5, 0),
            event_type="screen_switch",
            screen_name="POLICY_REFERENCE",
            element_selector="tab_policy",
        ),
        UIEvent(
            session_id="session_002",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 11, 10, 7, 30),
            event_type="navigate",
            screen_name="APPLICATION_FORM",
            element_selector="tab_form",
        ),
        UIEvent(
            session_id="session_002",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 11, 10, 8, 0),
            event_type="input",
            screen_name="APPLICATION_FORM",
            element_selector="max_permitted_height",
            element_value="6 ft",
        ),
        UIEvent(
            session_id="session_002",
            user_id="permit-tech-001",
            timestamp=datetime(2024, 3, 11, 10, 9, 0),
            event_type="submit",
            screen_name="APPLICATION_FORM",
            element_selector="submit_btn",
        ),
    ]

    seed_data = [
        ("session_001", base_events_1, datetime(2024, 3, 10, 9, 9, 30)),
        ("session_002", base_events_2, datetime(2024, 3, 11, 10, 9, 30)),
    ]

    with Session(engine) as db:
        for session_id, events, completed_at in seed_data:
            existing = db.get(SessionRecord, session_id)
            if existing:
                logger.info(f"[Seed] Session {session_id} already exists, skipping")
                continue

            trace = ActionTrace(
                session_id=session_id,
                user_id="permit-tech-001",
                permit_type="fence_variance",
                events=events,
                completed_at=completed_at,
            )
            trace_text = embedding_service.serialize_trace(trace)
            vector = await embedding_service.embed(
                trace_text, cache_key=f"session:{session_id}"
            )

            record = SessionRecord(
                session_id=session_id,
                user_id="permit-tech-001",
                permit_type="fence_variance",
                state=PatternState.CANDIDATE,
                events=[e.model_dump(mode="json") for e in events],
                embedding=vector,
                knowledge_sources=[
                    {
                        "selector_description": "section_14_3_paragraph",
                        "text_snippet": "shall not exceed six feet (6') in height",
                        "confidence": 0.91,
                        "source_type": "policy_text",
                        "screen_name": "POLICY_REFERENCE",
                    }
                ],
                completed_at=completed_at,
                is_seeded=True,
            )
            db.add(record)
            db.commit()
            logger.info(
                f"[Seed] Session {session_id} seeded "
                f"(permit_type=fence_variance, {len(events)} events)"
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
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
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
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


@app.get("/health")
def health():
    return {"status": "ok", "service": "r4mi-ai"}
