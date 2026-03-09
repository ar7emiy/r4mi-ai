# r4mi-ai — Build Progress & Debug Log

## Status: In Progress (2026-03-09)

---

## What's Working

- **Backend boots**: FastAPI starts, DB initializes, seed sessions load
- **Frontend boots**: Vite dev server, React app renders correctly
- **Legacy permit UI**: Application Inbox, Application Form, GIS Lookup, Policy Reference screens all render
- **Stub APIs**: All `/api/stubs/*` endpoints return correct seed data
- **Gemini embeddings**: Real `gemini-embedding-001` calls fire on session submit; vectors logged with dims + latency
- **Cosine similarity**: Computed correctly in Python with numpy; scores logged in CLI panel
- **SSE bus**: All events broadcast through `/api/sse`; CLI panel consumes `/api/logs` in real time
- **Pattern detection**: Fires correctly after threshold sessions; `OPTIMIZATION_OPPORTUNITY` SSE emitted
- **Optimization panel**: Opens on opportunity; `SPEC_GENERATED` SSE triggers spec view
- **SpecBuilderAgent**: Real `gemini-2.5-flash` call builds `NarrowAgentSpec`
- **Publish flow**: Agent publishes to agentverse; `AGENT_PUBLISHED` SSE received by frontend store
- **Agentverse panel**: Published agents appear in card grid with trust badges
- **Auto-run trigger**: Opening a new application row that matches a published agent's `permit_type` fires `POST /api/agents/{id}/run`
- **Agent run execution**: `NarrowAgent.execute()` yields step events via SSE bus; `AGENT_DEMO_STEP` events arrive at frontend
- **Form auto-fill**: `ApplicationForm` watches `demoSteps` and animates typing into fields

---

## Bugs Fixed This Session

### 1. pip install failed — `python>=3.12` in requirements.txt
`requirements.txt` had `python>=3.12` as a line item. pip treats it as a package name and fails.
- **Fix**: Removed the line. Python version constraints belong in `pyproject.toml`, not `requirements.txt`.
- **File**: `backend/requirements.txt`

### 2. `KeyError: 'GEMINI_API_KEY'` on uvicorn startup
Services (`vision_service.py`, `embedding_service.py`) call `os.environ["GEMINI_API_KEY"]` in their
`__init__` bodies, which run at module import time. `load_dotenv()` was called after the imports.
- **Fix**: Moved `from dotenv import load_dotenv; load_dotenv()` to the very top of `main.py`, before all other imports.
- **File**: `backend/main.py`

### 3. `AGENT_PUBLISHED` SSE payload used wrong key (`spec_id` instead of `id`)
The Zustand `AgentSpec` interface declares `id: string`. The publish and tune endpoints were broadcasting
`"spec_id": spec.id`, so `publishedAgents[x].id` was always `undefined`. The auto-run call became
`POST /api/agents/undefined/run` and silently failed.
- **Fix**: Changed `"spec_id"` → `"id"` in both `publish_agent` and `tune_agent` endpoints.
- **File**: `backend/routers/agents.py`

### 4. Run endpoint returned `StreamingResponse` that no frontend code consumed
`/api/agents/{spec_id}/run` previously streamed its own SSE response. The frontend has no code
to consume a second SSE stream — it only listens to `/api/sse`. Steps were never received.
- **Fix**: Changed to `asyncio.create_task(_run())` background task that broadcasts each step through
  `sse_bus`. Returns `{"status": "running"}` immediately. Background task creates its own DB session
  (the FastAPI-injected session closes when the request ends).
- **File**: `backend/routers/agents.py`

### 5. `ApplicationInbox` did not trigger agent run on row click
Clicking a row set the active application but never checked for or triggered a matching published agent.
- **Fix**: Added `publishedAgents` and `clearDemoSteps` from store; added match-by-`permit_type` check;
  calls `POST /api/agents/{id}/run` if a matching agent is found.
- **File**: `frontend/src/components/legacy/ApplicationInbox.tsx`

---

## Known Issue: Pattern Detection Triggers Too Late

### Symptom
`OPTIMIZATION_OPPORTUNITY` only fires after 4–5 manual submissions instead of after 1.
The CLI log shows all sessions as `permit_type=general`, so seed sessions (`fence_variance`) are
never compared against live sessions.

### Root Cause
`ObserverAgent._infer_permit_type()` is called on the **first event** for a new session.
That event has `screen_name="APPLICATION_INBOX"`, which contains no keywords matching
fence/adu/sign/demo/str. The fallback is `"general"`.

Seed sessions seeded at startup have `permit_type="fence_variance"`.
`PatternDetector` only compares sessions with identical `permit_type`.
Result: live sessions are never compared against seed sessions.

### Fix Attempted (not yet confirmed working)
Three-file change to pass permit_type explicitly from the frontend:

1. **`backend/models/event.py`** — Added `permit_type: Optional[str] = None` to `UIEvent`
2. **`backend/agents/observer_agent.py`** — Use `event.permit_type or self._infer_permit_type(event)`
   so explicit value wins over inference
3. **`frontend/src/components/legacy/ApplicationForm.tsx`** — Read `app.permit_type` from the loaded
   application object; include `permit_type: permitType` in every event body sent to `/api/observe`

### Why It May Still Not Work
- If `app` (from the React Query hook) is `null` or stale when `handleSubmit` fires, `app?.permit_type`
  evaluates to `undefined` and the `?? 'general'` fallback kicks in.
- Old sessions with `permit_type=general` remain in the DB from prior runs. Deleting `backend/r4mi.db`
  and restarting is required — but only if the DB file actually existed (SQLite creates `r4mi.db` in
  the CWD where uvicorn runs, which may differ from `backend/`).

### Next Debugging Steps

**Step 1 — Confirm permit_type is being sent**
Open browser DevTools → Network tab → filter for `/api/observe`.
Click a form event and inspect the request body. Verify `"permit_type": "fence_variance"` is present.
If it shows `"permit_type": "general"` or is missing: `app` is null when submit fires.

**Step 2 — Confirm the DB is clean**
```bash
# Find where the DB actually lives
find /c/Users/yalov/r4mi-ai/backend -name "*.db"
# Delete it
rm backend/r4mi.db   # adjust path if different
```
Restart uvicorn and confirm CLI log shows:
```
[Seed] Session session_001 seeded (permit_type=fence_variance, ...)
[Seed] Session session_002 seeded (permit_type=fence_variance, ...)
```
If it shows "already exists, skipping" — the old DB with wrong data is still there.

**Step 3 — Check similarity log after first submit**
After one form submission, the CLI should show:
```
[Similarity] Comparing against 2 prior sessions (permit_type=fence_variance)
[Similarity] vs session_001: cosine=0.9x ✓
[Similarity] vs session_002: cosine=0.9x ✓
[Detector]   Pattern READY — 2/2 sessions exceed similarity threshold
```
If it shows `(permit_type=general)` and 0 prior sessions — fix did not take; restart frontend dev server.

**Step 4 — If app is null on submit**
The `useQuery` for the application is keyed on `activeApplicationId`. If the application data hasn't
loaded before the user clicks Submit, `app` will be undefined. Guard: add a `disabled={!app}` to the
Submit button in `ApplicationForm.tsx`.

**Step 5 — Alternative: set permit_type on session update, not creation**
Instead of inferring at session creation time, scan all accumulated events at submit time and derive
permit_type from the element selectors or values (e.g., `zone_classification` → `fence_variance`).
Update `SessionRecord.permit_type` just before calling `pattern_detector.process_session_complete()`.

---

## Environment Setup

```bash
# Backend
cd backend
python -m venv .venv
.venv/Scripts/activate      # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

`.env` required at `backend/.env` (or project root):
```
GEMINI_API_KEY=your_key_here
DEMO_SESSION_SEED=true
DATABASE_URL=sqlite:///./r4mi.db
```

---

## File Change Index

| File | Change |
|------|--------|
| `backend/requirements.txt` | Removed `python>=3.12` |
| `backend/main.py` | `load_dotenv()` moved before all imports |
| `backend/models/event.py` | Added `permit_type: Optional[str]` to `UIEvent` |
| `backend/agents/observer_agent.py` | Use `event.permit_type` before inference fallback |
| `backend/routers/agents.py` | Fixed `id` key in `AGENT_PUBLISHED`; run endpoint → background task via sse_bus |
| `frontend/src/components/legacy/ApplicationInbox.tsx` | Auto-run logic on row click |
| `frontend/src/components/legacy/ApplicationForm.tsx` | Pass `permit_type` in observe events |
