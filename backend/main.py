from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

from db import create_db_and_tables
from routers import agents, observe, patterns, session, sse

# ── Frontend serving ──────────────────────────────────────────────────────────
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="r4mi-ai",
    version="1.0.0",
    description="UI workflow observation and automation factory",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(observe.router, prefix="/observe", tags=["observe"])
app.include_router(patterns.router, prefix="/patterns", tags=["patterns"])
app.include_router(agents.router, prefix="/agents", tags=["agents"])
app.include_router(session.router, prefix="/session", tags=["session"])
app.include_router(sse.router, prefix="/sse", tags=["sse"])

# Legacy compat: mount old /api/* routes so existing Factory.tsx still works
# during the frontend migration. Remove after frontend is fully migrated.
try:
    import sys

    sys.path.insert(0, str(Path(__file__).parent / "app"))
    from app.main import app as legacy_app  # type: ignore

    # Mount legacy routes at /api prefix
    app.mount("/api", legacy_app)
except Exception:
    pass  # legacy app not available — that's fine


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Frontend static files ─────────────────────────────────────────────────────
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/")
    def dev_root():
        return {
            "message": "r4mi-ai backend running. Start frontend with: cd frontend && npm run dev",
            "docs": "/docs",
            "health": "/health",
        }
