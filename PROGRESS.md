# r4mi-ai — Build Progress & Debug Log

## Status: E2E Test Suite Green (2026-03-13)

All 7 demo beats pass end-to-end. The Playwright test suite in `e2e/` is the source of truth.

---

## How to Resume Testing

### Prerequisites
- Backend running: `uvicorn main:app --reload --port 8000` (from `backend/` with venv activated)
- Frontend running: `npm run dev` (from `frontend/`)
- Or: `docker compose up --build`

### Run tests
```bash
cd e2e
npx playwright test health    # fast sanity (5s, no Gemini)
npx playwright test demo      # full 7-beat flow (20-90s)
npx playwright test demo --headed   # watch browser
npx playwright show-report          # view failure artifacts
```

### Gemini API note
The test suite makes ~4 real Gemini calls per run:
- Beat 2: `text-embedding-004` (cosine similarity → OPTIMIZATION_OPPORTUNITY SSE)
- Beat 4: `gemini-2.5-flash` (spec regeneration with correction)
- Beat 5: `gemini-2.5-flash` + `text-embedding-004` (publish = build spec + embed it)

If Gemini quota is exhausted, tests will timeout at Beat 2 or Beat 4. Reset quota or wait before re-running.

---

## Playwright Test Configuration (`e2e/`)

```
e2e/
  playwright.config.ts      timeout: 180_000 (per test), expect.timeout: 30_000
  tests/
    health.spec.ts           6 checks: /health, /api/stubs/applications (9 rows),
                             session_001 exists, inbox renders, tab bar visible, GIS stub
    demo.spec.ts             7-beat flow as one serial test with test.step()
```

### Per-beat timeouts in demo.spec.ts
| Beat | Element waited for | Timeout |
|------|--------------------|---------|
| 2 | `[data-testid="optimization-badge"]` | 45,000ms |
| 4 | `AGENT SPEC PREVIEW` | 45,000ms |
| 5 | `Agent published to Agentverse` | 30,000ms |

---

## What's Working (Confirmed by E2E)

- **Health layer**: backend, seed data (9 applications, 2 prior fence_variance sessions), frontend
- **Beat 1 — The Work**: inbox → GIS lookup (parcel R2-0041-BW → R-2) → Policy Reference (§14.3) → form submit (field-zone, field-max-height, field-notes filled + submitted)
- **Beat 2 — The Detection**: Gemini embedding fires; cosine similarity ≥ 0.85 vs both seed sessions; `OPTIMIZATION_OPPORTUNITY` SSE → badge appears
- **Beat 3 — The Replay**: `SessionReplay` animation shows field sequence with `from GIS API` / `from PDF §14.3` source tags; "Looks good — continue" advances to CorrectionInput
- **Beat 4 — The Correction**: CorrectionInput "Show me" enters recording mode; PolicyReference PDF tab auto-selected; paragraph click registers source; "Confirm & continue" triggers Gemini spec regeneration
- **Beat 5 — The Publish**: SpecSummary renders with ACTION SEQUENCE + KNOWLEDGE SOURCES; ValidationReplay animates; "Publish to Agentverse" → AGENT_PUBLISHED SSE → done screen
- **Beat 6 — The Payoff**: PRM-2024-0042 opened; published agent matches; auto-fill animates field-zone="R-2" and field-max-height="6 ft" with source tags
- **Beat 7 — Agentverse**: panel shows agent card with SUPERVISED trust badge and run count

---

## All Bugs Fixed (Chronological)

### Session 1 (2026-03-09)
1. `requirements.txt` had `python>=3.12` — pip treats it as a package; **removed**
2. `load_dotenv()` called after imports — Gemini services failed with KeyError; **moved to top of main.py**
3. `AGENT_PUBLISHED` SSE used `spec_id` key — Zustand expected `id`; **fixed key name**
4. Run endpoint returned `StreamingResponse` — frontend has no second SSE consumer; **changed to background task via sse_bus**
5. `ApplicationInbox` row click never triggered agent run — **added match-by-permit_type + POST /api/agents/{id}/run**
6. Pattern detection permit_type mismatch — seed sessions were `fence_variance`, live sessions defaulted to `general`; **fixed: frontend now sends `permit_type` in every observe event**

### Session 2 (2026-03-11)
7. `ValidationReplay` filtered action_sequence to only `input`/`type` verbs — LLM uses `fill`, `enter`, `set`; **replaced with INPUT_VERBS set + field check**
8. GIS/owner seed files missing parcel records for PRM-2024-0043/0044/0045 — **added to gis_results.json and owner_registry.json**
9. `SessionReplay` animation did not complete (stuck waiting for `sources`); **fixed sequence**
10. `ApplicationForm` `navigateTo` handler crashed if called with unknown screen; **added default case**
11. `LegacyPermitApp` missing screen routing for CorrectionInput "Show me" navigation; **fixed**
12. `PolicyReference` PDF paragraph click did not close recording mode; **fixed**
13. `CorrectionInput` did not update textarea after PDF source confirmed; **fixed**
14. `OptimizationPanel` did not advance from `spec` step to `validation` step on "Review & Validate"; **fixed step transition**
15. `SpecSummary` "Review & Validate" button missing inside optimization flow vs standalone spec view; **fixed**

### Session 3 (2026-03-13)
16. `NarrowAgent._execute_step` used combined context string for routing — description text containing "zone" caused `max_permitted_height` step to return "R-2" instead of "6 ft"; **rewrote to exact field-name matching first (zone_classification, max_permitted_height, decision_notes, applicant_name)**
17. `SpecBuilderAgent` prompt did not mandate specific field names — LLM used varied names breaking NarrowAgent routing; **added MANDATORY FIELD NAMES section to prompt**
18. Beat 2 SSE timeout (30s) too short for Gemini API latency spikes; **increased to 45s**
19. Beat 4 spec regeneration timeout (30s) too short; **increased to 45s**
20. Beat 5 publish timeout (10s) too short (two Gemini calls happen); **increased to 30s**
21. Overall test timeout 90s insufficient; **increased to 180s**

---

## data-testid Attributes Added (Required by Tests)

| Component | Attribute |
|-----------|-----------|
| `ApplicationInbox.tsx` | `data-testid={`app-row-${app.application_id}`}` on each `<tr>` |
| `ApplicationForm.tsx` | `data-testid="field-zone"`, `data-testid="field-max-height"`, `data-testid="field-notes"` |
| `PolicyReference.tsx` | `data-testid={`pdf-section-${section.id}`}` on each PDF section div |
| `TabProgressionBar.tsx` | `data-testid="optimization-badge"` on notification button |
| `AgentversePanel.tsx` | `data-testid="agent-card"` on each agent card |

---

## Key File Locations

| What | Where |
|------|-------|
| E2E tests | `e2e/tests/demo.spec.ts`, `e2e/tests/health.spec.ts` |
| Playwright config | `e2e/playwright.config.ts` |
| NarrowAgent field routing | `backend/agents/narrow_agent.py` → `_execute_step()` |
| SpecBuilderAgent prompt | `backend/agents/spec_builder_agent.py` → `PROMPT` constant |
| Gemini calls | `backend/services/embedding_service.py`, `backend/services/vision_service.py` |
| SSE events | `backend/routers/sse.py`, `frontend/src/hooks/useSSE.tsx` |
| Store | `frontend/src/store/r4mi.store.ts` |
| Optimization flow | `frontend/src/components/overlay/OptimizationPanel.tsx` |

---

## Environment Setup

```bash
# Backend (from repo root)
cd backend
python -m venv .venv
.venv/Scripts/activate      # Windows: .venv\Scripts\activate.bat
pip install -r requirements.txt
# .env must have GEMINI_API_KEY, DEMO_SESSION_SEED=true
uvicorn main:app --reload --port 8000

# Frontend (from repo root)
cd frontend
npm install
npm run dev

# Docker (alternative)
docker compose up --build
```

`.env` at repo root (copied from `.env.example`):
```
GEMINI_API_KEY=your_key_here
DEMO_SESSION_SEED=true
DATABASE_URL=sqlite:///./r4mi.db
PATTERN_THRESHOLD=3
PATTERN_CONFIDENCE_MIN=0.85
```

---

## Cloud Deployment

See `DEPLOY.md` for Google Cloud Run setup. `cloudbuild.yaml` automates subsequent deploys.
Manual steps required once: project, Artifact Registry, Secret Manager, IAM grants.
