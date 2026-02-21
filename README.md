# Support Automation Factory (Hackathon Ready MVP)

A hackathon-focused vertical slice for building a UI navigator agent that:
- observes repetitive support workflows,
- detects automation opportunities,
- runs guided behavior capture,
- auto-generates automation specs/modules,
- keeps humans in the loop for approvals and tuning.

## What This MVP Includes
- End-to-end demo flow in one UI:
  1. Start support session
  2. Log session events
  3. Detect automation opportunity
  4. Start guided capture (auto-nav simulation)
  5. Generate spec from captured behavior
  6. Approve spec
  7. Build module
  8. Test module
  9. Tune with SME feedback
  10. Promote to shadow mode
- State snapshot panel for live demo transparency.
- Integration adapter stubs for Gemini Live API + ADK + Google Cloud.

## Stack
- Backend: FastAPI
- Frontend: Vanilla JS + CSS
- Runtime: Local dev server (deployable to Cloud Run)

## Run Locally
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open:
- `http://localhost:8000`

## Demo Script (2-3 min)
1. Start session, push sample events, click detect.
2. Show detected opportunity confidence and complexity.
3. Start guided capture, record 3-5 steps, close capture.
4. Show generated spec and open questions.
5. Approve spec, build module, run tests.
6. Tune module with one SME feedback line.
7. Promote to shadow mode and show status transition.

## Repo Layout
- `backend/app/main.py`: API + workflow state machine.
- `backend/app/integrations/google_stack.py`: Google integration adapters.
- `frontend/index.html`: operator UI.
- `frontend/app.js`: UI orchestration.
- `frontend/styles.css`: responsive visual system.
- `docs/ARCHITECTURE.md`: architecture and cloud mapping.
- `docs/DEPLOY_CLOUD_RUN.md`: Cloud Run deployment commands.
- `docs/HACKATHON_CHECKLIST.md`: submission checklist.

## Next Steps for Submission Compliance
1. Replace adapter stubs with real Gemini Live API ingestion and ADK orchestration.
2. Persist state in Firestore and move async steps to Pub/Sub/Cloud Tasks.
3. Add recorded multimodal demo clip proving live behavior observation.
4. Deploy on Cloud Run and attach URL + architecture screenshot in Devpost.
