from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
# In production (Cloud Run), serve built React from dist/. In dev, Vite runs on :5173.
SERVE_DIR = FRONTEND_DIST if FRONTEND_DIST.exists() else FRONTEND_DIR


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class SessionEvent:
    ts: str
    app: str
    action: str
    details: str = ""


@dataclass
class Session:
    id: str
    ticket_type: str
    created_at: str
    events: list[SessionEvent] = field(default_factory=list)
    screenshots: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Opportunity:
    id: str
    session_id: str
    name: str
    confidence: float
    complexity: str
    requires_screen_capture: bool
    status: str
    rationale: str
    created_at: str


@dataclass
class CaptureEvent:
    ts: str
    action: str
    target: str
    notes: str = ""


@dataclass
class Capture:
    id: str
    opportunity_id: str
    started_at: str
    events: list[CaptureEvent] = field(default_factory=list)
    closed_at: str | None = None


@dataclass
class AutomationSpec:
    id: str
    opportunity_id: str
    version: int
    trigger: str
    steps: list[dict[str, Any]]
    exceptions: list[str]
    success_criteria: str
    open_questions: list[str]
    status: str
    created_at: str


@dataclass
class AutomationModule:
    id: str
    spec_id: str
    version: int
    code_stub: str
    test_results: list[dict[str, Any]] = field(default_factory=list)
    feedback_history: list[str] = field(default_factory=list)
    status: str = "generated"
    created_at: str = field(default_factory=utc_now)


@dataclass
class Store:
    sessions: dict[str, Session] = field(default_factory=dict)
    opportunities: dict[str, Opportunity] = field(default_factory=dict)
    captures: dict[str, Capture] = field(default_factory=dict)
    specs: dict[str, AutomationSpec] = field(default_factory=dict)
    modules: dict[str, AutomationModule] = field(default_factory=dict)


store = Store()


class StartSessionRequest(BaseModel):
    ticket_type: str = Field(default="billing_dispute")


class SessionEventRequest(BaseModel):
    app: str
    action: str
    details: str = ""


class StartCaptureRequest(BaseModel):
    opportunity_id: str


class CaptureEventRequest(BaseModel):
    action: str
    target: str
    notes: str = ""


class CloseCaptureRequest(BaseModel):
    capture_id: str


class ApproveSpecRequest(BaseModel):
    spec_id: str


class BuildModuleRequest(BaseModel):
    spec_id: str


class TestModuleRequest(BaseModel):
    module_id: str


class TuneModuleRequest(BaseModel):
    module_id: str
    feedback: str


class PromoteModuleRequest(BaseModel):
    module_id: str


class ScreenshotRequest(BaseModel):
    screenshot_base64: str
    timestamp: str = ""


app = FastAPI(title="Support Automation Factory", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "time": utc_now()}


@app.post("/api/sessions")
def start_session(payload: StartSessionRequest) -> dict[str, Any]:
    sid = f"sess_{uuid4().hex[:8]}"
    session = Session(id=sid, ticket_type=payload.ticket_type, created_at=utc_now())
    store.sessions[sid] = session
    return {"session": asdict(session)}


@app.post("/api/sessions/{session_id}/events")
def add_session_event(session_id: str, payload: SessionEventRequest) -> dict[str, Any]:
    session = store.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    event = SessionEvent(ts=utc_now(), app=payload.app, action=payload.action, details=payload.details)
    session.events.append(event)
    return {"event": asdict(event), "event_count": len(session.events)}


@app.post("/api/sessions/{session_id}/screenshot")
def add_screenshot(session_id: str, payload: ScreenshotRequest) -> dict[str, Any]:
    session = store.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    entry = {"base64": payload.screenshot_base64, "timestamp": payload.timestamp or utc_now()}
    session.screenshots.append(entry)
    session.screenshots = session.screenshots[-10:]  # cap at 10 to limit memory
    return {"screenshot_count": len(session.screenshots), "timestamp": entry["timestamp"]}


@app.post("/api/sessions/{session_id}/detect")
def detect_opportunity(session_id: str) -> dict[str, Any]:
    session = store.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.events:
        raise HTTPException(status_code=400, detail="No events to analyze")

    joined = " ".join(f"{e.app}:{e.action}:{e.details}" for e in session.events).lower()
    refund_like = "refund" in joined or "billing" in joined
    repeated_actions = len(session.events) >= 6

    complexity = "medium"
    if len(session.events) > 12:
        complexity = "high"
    elif len(session.events) <= 5:
        complexity = "low"

    requires_screen_capture = complexity in {"medium", "high"} and repeated_actions
    confidence = 0.88 if refund_like else 0.69

    oid = f"opp_{uuid4().hex[:8]}"
    opportunity = Opportunity(
        id=oid,
        session_id=session_id,
        name="Refund Eligibility + Execution" if refund_like else "Repeatable Support Resolution Flow",
        confidence=confidence,
        complexity=complexity,
        requires_screen_capture=requires_screen_capture,
        status="detected",
        rationale=(
            "Detected repeated navigation across CRM, billing admin, and policy lookup with decision latency."
            if refund_like
            else "Detected repeated multi-app workflow with consistent step sequence and low variance."
        ),
        created_at=utc_now(),
    )
    store.opportunities[oid] = opportunity
    return {"opportunity": asdict(opportunity)}


@app.post("/api/captures/start")
def start_capture(payload: StartCaptureRequest) -> dict[str, Any]:
    opportunity = store.opportunities.get(payload.opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    cid = f"cap_{uuid4().hex[:8]}"
    capture = Capture(id=cid, opportunity_id=payload.opportunity_id, started_at=utc_now())
    store.captures[cid] = capture

    opportunity.status = "capture_in_progress"
    return {"capture": asdict(capture), "opportunity": asdict(opportunity)}


@app.post("/api/captures/{capture_id}/events")
def add_capture_event(capture_id: str, payload: CaptureEventRequest) -> dict[str, Any]:
    capture = store.captures.get(capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")
    if capture.closed_at:
        raise HTTPException(status_code=400, detail="Capture already closed")

    event = CaptureEvent(ts=utc_now(), action=payload.action, target=payload.target, notes=payload.notes)
    capture.events.append(event)
    return {"event": asdict(event), "event_count": len(capture.events)}


def _synthesize_steps(capture: Capture) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    for index, event in enumerate(capture.events, start=1):
        step = {
            "index": index,
            "action": event.action,
            "target": event.target,
            "notes": event.notes,
            "automatable": event.action not in {"free_text_reasoning", "manual_policy_judgement"},
        }
        steps.append(step)
    return steps


@app.post("/api/captures/close")
def close_capture(payload: CloseCaptureRequest) -> dict[str, Any]:
    capture = store.captures.get(payload.capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")
    if capture.closed_at:
        raise HTTPException(status_code=400, detail="Capture already closed")

    capture.closed_at = utc_now()
    opportunity = store.opportunities[capture.opportunity_id]
    opportunity.status = "spec_generated"

    steps = _synthesize_steps(capture)
    open_questions: list[str] = []
    if any(not s["automatable"] for s in steps):
        open_questions.append("When policy is ambiguous, should the flow escalate or skip?")
    if len(steps) < 4:
        open_questions.append("Do you always verify billing profile before refund execution?")

    spec_id = f"spec_{uuid4().hex[:8]}"
    spec = AutomationSpec(
        id=spec_id,
        opportunity_id=opportunity.id,
        version=1,
        trigger="Incoming support ticket tagged billing_dispute",
        steps=steps,
        exceptions=["Fraud flag present", "Refund exceeds policy threshold"],
        success_criteria="Resolve ticket within 3 minutes with policy-compliant refund decision",
        open_questions=open_questions,
        status="awaiting_human_approval",
        created_at=utc_now(),
    )
    store.specs[spec_id] = spec
    return {"capture": asdict(capture), "spec": asdict(spec), "opportunity": asdict(opportunity)}


@app.post("/api/specs/approve")
def approve_spec(payload: ApproveSpecRequest) -> dict[str, Any]:
    spec = store.specs.get(payload.spec_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Spec not found")
    spec.status = "approved"
    opportunity = store.opportunities[spec.opportunity_id]
    opportunity.status = "approved_for_build"
    return {"spec": asdict(spec), "opportunity": asdict(opportunity)}


@app.post("/api/modules/build")
def build_module(payload: BuildModuleRequest) -> dict[str, Any]:
    spec = store.specs.get(payload.spec_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Spec not found")
    if spec.status != "approved":
        raise HTTPException(status_code=400, detail="Spec must be approved before build")

    mid = f"mod_{uuid4().hex[:8]}"
    module = AutomationModule(
        id=mid,
        spec_id=spec.id,
        version=1,
        code_stub=(
            "def run_refund_automation(ticket):\n"
            "    # Generated stub for hackathon demo.\n"
            "    if ticket.get('fraud_flag'):\n"
            "        return {'status': 'escalate', 'reason': 'fraud_flag'}\n"
            "    return {'status': 'approve_refund', 'amount': ticket.get('eligible_amount', 0)}\n"
        ),
    )
    module.status = "built_pending_test"
    store.modules[mid] = module

    opportunity = store.opportunities[spec.opportunity_id]
    opportunity.status = "module_built"

    return {"module": asdict(module), "opportunity": asdict(opportunity)}


@app.post("/api/modules/test")
def test_module(payload: TestModuleRequest) -> dict[str, Any]:
    module = store.modules.get(payload.module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    test_results = [
        {"name": "standard_refund", "result": "pass"},
        {"name": "fraud_flag_escalation", "result": "pass"},
        {"name": "policy_threshold", "result": "needs_tuning"},
    ]
    module.test_results = test_results
    module.status = "testing_complete"
    return {"module": asdict(module)}


@app.post("/api/modules/tune")
def tune_module(payload: TuneModuleRequest) -> dict[str, Any]:
    module = store.modules.get(payload.module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    module.feedback_history.append(payload.feedback)
    module.version += 1
    module.code_stub += "\n# Tune update applied from SME feedback.\n"
    module.status = "retuned_ready_for_retest"
    return {"module": asdict(module)}


@app.post("/api/modules/promote")
def promote_module(payload: PromoteModuleRequest) -> dict[str, Any]:
    module = store.modules.get(payload.module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if module.status not in {"testing_complete", "retuned_ready_for_retest"}:
        raise HTTPException(status_code=400, detail="Module must be tested before promotion")

    module.status = "production_shadow_mode"
    spec = store.specs[module.spec_id]
    opportunity = store.opportunities[spec.opportunity_id]
    opportunity.status = "deployed_shadow"

    return {
        "module": asdict(module),
        "opportunity": asdict(opportunity),
        "notification": "Automation deployed in shadow mode. SME notified for live validation.",
    }


@app.get("/api/templates")
def get_templates() -> dict[str, Any]:
    from app.workflow_templates import list_templates
    return {"templates": list_templates()}


@app.get("/api/state")
def get_state() -> dict[str, Any]:
    return {
        "sessions": [asdict(x) for x in store.sessions.values()],
        "opportunities": [asdict(x) for x in store.opportunities.values()],
        "captures": [asdict(x) for x in store.captures.values()],
        "specs": [asdict(x) for x in store.specs.values()],
        "modules": [asdict(x) for x in store.modules.values()],
    }


@app.get("/")
def index() -> FileResponse:
    index_file = SERVE_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend not built — run: cd frontend && npm run build")
    return FileResponse(index_file)


if SERVE_DIR.exists():
    app.mount("/", StaticFiles(directory=SERVE_DIR, html=True), name="frontend")
