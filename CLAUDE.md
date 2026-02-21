# Support Automation Factory

Hackathon MVP: a UI navigator agent that observes repetitive support workflows, detects automation opportunities, runs guided behavior capture, auto-generates specs/modules, and keeps humans in the loop.

## Tech Stack

- **Backend:** FastAPI + Uvicorn + Pydantic (Python 3.12)
- **Frontend:** Vanilla JS + HTML5 + CSS3 (no framework)
- **Deployment:** Docker → Google Cloud Run
- **Planned integrations:** Gemini Live API, ADK, Firestore, Pub/Sub

## Running Locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

App served at `http://localhost:8000` (frontend is mounted as static files by FastAPI).

## Key Files

| File | Purpose |
|------|---------|
| [backend/app/main.py](backend/app/main.py) | FastAPI app, state machine, all API endpoints, in-memory data store |
| [backend/app/integrations/google_stack.py](backend/app/integrations/google_stack.py) | Adapter stubs for Gemini Live, ADK, Cloud services |
| [frontend/index.html](frontend/index.html) | Single-page operator UI |
| [frontend/app.js](frontend/app.js) | UI orchestration and API calls |
| [frontend/styles.css](frontend/styles.css) | Responsive styling |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and Google Cloud mapping |
| [docs/HACKATHON_CHECKLIST.md](docs/HACKATHON_CHECKLIST.md) | Submission requirements tracker |

## Architecture

The backend uses an **in-memory store** with dataclasses (`Session`, `Opportunity`, `Capture`, `AutomationSpec`, `AutomationModule`). No database — all state is lost on restart.

**10-stage workflow state machine:**
`Session → Opportunity (detected) → Capture (in_progress) → Spec (generated) → Opportunity (approved_for_build) → Module (built) → Module (tested) → Module (shadow_mode) → Opportunity (deployed_shadow)`

**API base:** `/api/` — 20+ endpoints for session management, capture workflow, spec lifecycle, module pipeline, and state inspection.

## Deployment

```bash
# Cloud Build + Cloud Run
gcloud builds submit --config cloudbuild.yaml
# See docs/DEPLOY_CLOUD_RUN.md for full commands
```

## What's Real vs. Stub

- **Complete:** Full UI + API workflow, state machine, Docker config, Cloud Build config
- **Stubs (need real impl):** Gemini Live API ingestion, ADK multi-agent orchestration, Firestore persistence, Pub/Sub async queuing
