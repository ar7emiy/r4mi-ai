from __future__ import annotations
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from db import create_db_and_tables, engine
from services.log_streamer import logger
from models.session import SessionRecord, PatternState, AgentCorrection  # noqa: F401
from models.agent_spec import NarrowAgentSpec  # noqa: F401
from models.event import UIEvent, ActionTrace  # noqa: F401

# ── routers ──────────────────────────────────────────────────────────────────
# Note: the legacy `stubs` router was deleted as part of the site-agnostic
# rewrite. Domain-specific test data now lives inside each mock host site
# (e.g. mock-sites/permit-app/src/mockData/) and is served by that site's
# own dev-server middleware. r4mi backend has zero domain knowledge.
from routers import observe, session, agents, evidence, sse, logs, chat


def _migrate_db():
    """Add new columns to existing tables. SQLite doesn't support IF NOT EXISTS on ALTER TABLE."""
    new_columns = [
        ("sessions", "matched_spec_id", "TEXT"),
        ("sessions", "candidate_spec_draft", "JSON"),
        ("sessions", "network_calls", "JSON"),
        ("sessions", "cluster_id", "TEXT"),
        ("sessions", "cluster_label", "TEXT"),
        ("narrow_agent_specs", "cluster_id", "TEXT"),
        ("narrow_agent_specs", "cluster_label", "TEXT"),
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
app.include_router(sse.router)
app.include_router(logs.router)
app.include_router(chat.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "r4mi-ai"}
