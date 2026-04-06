# r4mi-ai — Build Progress & Debug Log

## Status: Modernized Sidebar UI and Persistent Contextual Chat (2026-04-05)

The sidebar has been redesigned from a chat-thread model to a **phase-based state machine** with a CLI/terminal aesthetic. The HITL replay now **visually navigates the host page** — switching tabs, filling fields, and waiting for user approval at each step.

**Primary goal:** System verification — proving the full detect → replay → approve → publish → reuse loop works with real Gemini AI calls and visible host page navigation.

---

## How to Verify the System (Local — Recommended)

### Prerequisites
- Backend running: `uvicorn main:app --reload --port 8000` (from `backend/` with venv activated)
- Frontend running: `npm run dev` (from `frontend/`)
- Or: `docker compose up --build`
- `.env` must have `GEMINI_API_KEY` and `DEMO_SESSION_SEED=true`

### Run tests
```bash
cd e2e
npx playwright test health           # fast sanity, no Gemini (5s)
npx playwright test demo             # full 7-beat flow (20-90s)
npx playwright test demo --headed    # watch browser — best way to see HITL replay
npx playwright show-report           # view failure artifacts
```

Video recordings are saved to `e2e/test-results/` on every run (configured in `playwright.config.ts`: `video: { mode: 'on' }`).

### Gemini API note
The test suite makes ~4 real Gemini calls per run:
- Beat 2: `gemini-embedding-001` (cosine similarity → OPTIMIZATION_OPPORTUNITY SSE)
- Beat 3: `gemini-2.5-flash` + `gemini-embedding-001` (spec build + embed)
- Beat 5: `gemini-2.5-flash` + `gemini-embedding-001` (publish = build spec + embed it)

If Gemini quota is exhausted, tests will timeout at Beat 2 or Beat 3. Reset quota or wait before re-running.

---

## Sidebar Architecture (Phase-Based UX)

The sidebar is a **phase state machine**, not a chat thread. Each phase is a distinct screen:

```
idle → detected → replay (HITL) → publishing → agents
         ↑
    recording (teach-me)
```

### Phases

| Phase | What the user sees | Entry |
|-------|-------------------|-------|
| **idle** | Log lines showing system status + "teach me" button | Default |
| **recording** | Live capture feedback: voice transcript, last action, step count | User clicks "teach me" |
| **detected** | Pattern summary: permit_type, match count, confidence | SSE `OPTIMIZATION_OPPORTUNITY` |
| **replay** | HITL step-by-step: host page navigates, fields fill, user approves each | User clicks "review replay" |
| **publishing** | Confirmation: agent is live in agentverse | After publish |
| **agents** | Browse/run published agents | User clicks "agents" |

### Two entry points, one shared flow

1. **Passive detection**: user works normally → r4mi detects pattern → `detected` phase → "review replay"
2. **Active teach-me**: user presses "teach me" → records workflow → stops → r4mi processes → `detected` phase → same "review replay"

Both converge on the **HITL replay**, where the agent steps through the host page visually with per-step approval.

### HITL Replay Flow

During replay, for each step in the spec:
1. **Navigate** — sidebar sends `r4mi:navigate-tab` to switch the host page to the right tab (GIS, Policy, Form)
2. **Fill** — sidebar sends `r4mi:replay-step` to fill the field with typing animation
3. **Wait** — sidebar shows step details (field, value, source) and asks user to approve or correct
4. **Approve/Correct** — user approves → next step. User corrects → correction recorded, next step.
5. After all steps: **publish** (with corrections applied if any) or **replay again**.

### CLI Aesthetic

The sidebar uses monospace fonts (`JetBrains Mono`, `Consolas`, `monospace`), dark terminal colors, log-line style output, and minimal UI chrome. It looks like a developer tool, not a chat app.

---

## What's Working (Confirmed by Local E2E)

- **Health layer**: backend, seed data (9 applications, 2+ prior sessions per workflow type), frontend
- **Beat 1 — The Work**: inbox → GIS lookup (parcel R2-0041-BW → R-2) → Policy Reference (§14.3) → form submit. Form state persists across tab switches.
- **Beat 2 — The Detection**: Gemini embedding fires; cosine similarity ≥ 0.85 vs both seed sessions; `OPTIMIZATION_OPPORTUNITY` SSE → badge pulses → sidebar transitions to `detected` phase
- **Beat 3 — The Replay**: click "review replay" → spec builds (Gemini) → preview endpoint resolves step values → HITL replay begins with host page navigation
- **Beat 4 — HITL Approval**: each step navigates the host page (GIS tab, Policy tab, Form tab), fills fields visually, user approves each step
- **Beat 5 — The Publish**: all steps approved → "publish agent" → Gemini embeds spec → AGENT_PUBLISHED SSE → sidebar transitions to `publishing` phase
- **Beat 6 — The Payoff**: PRM-2024-0042 opened → Agentverse drawer → run agent → zone and height fields auto-fill with source tags
- **Beat 7 — Agentverse**: agent card shows SUPERVISED trust badge and fence_variance type

### What's NOT covered by the E2E test
- CLI evidence panel (log streaming at `/evidence`)
- `/system` route (Mermaid architecture diagram)
- `/kanban` route (story status board)
- Adopt path (existing agent auto-matching — Scenario A from PLAN.md)
- Standalone teach-me recording mode (Scenario D from PLAN.md)
- Voice narration during recording
- Multi-workflow seeding (solar, home occupation, tree removal, deck — seeded but no E2E coverage)

---

## Sprint History

### Sprint 1 — Sidebar UI, Teach-Me Flow, Agentverse (US-01–09) ✓
Committed: `08f1a3c` (2026-03-22)

Made the demo believable. Wired up the sidebar with replay preview, correction flow, teach-me "Show me" bridge, voice narration, screenshots, Agentverse run button, and /kanban dev route.

### Sprint 2 — Host UI Cleanup, Capture Feedback, Dedup, CI (US-10–13) ✓
Committed: `016d84c` (2026-03-22)

Fixed the architecture violation (automation UI was on the host page, not the sidebar). Added live capture feedback during recording, suppressed duplicate notifications, and set up Playwright video recording + GitHub Actions workflow.

### Sprint 3 — CI Stabilisation (US-14–15) ✓
Commits: `7b10cd2`, `e655fd8`

Attempted to fix GitHub Actions CI. Applied `npx -y` flags, `npm ci` for e2e deps, diagnostic logging. CI still blocked — decision made to prioritize UX over CI debugging.

### Sprint 4 — Sidebar Redesign + HITL Visual Replay (US-16–19) (current)

Complete UX overhaul:
- **US-16**: Phase-based sidebar state machine (idle → detected → replay → publishing → agents)
- **US-17**: HITL replay drives host page navigation (tab switches + field fills with approval gates)
- **US-18**: CLI/terminal aesthetic — monospace fonts, dark theme, log-style output
- **US-19**: Bug fixes — form state persistence across tabs, stale agent cleanup on demo startup, inbox navigation after submission

---

## CI Blocker: GitHub Actions E2E

**Status:** Deprioritized. Local Playwright runs are sufficient for system verification.

**Symptom:** `wait-on http://localhost:8000/health` times out at 90s — the backend never starts.

**Decision:** Option A — run Playwright locally with `--headed` and screen-record if a shareable video is needed.

**Workflow file:** `.github/workflows/e2e-demo.yml`

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
9–15. Various UI routing, navigation, and step transition bugs — **all fixed**

### Session 3 (2026-03-13)
16. `NarrowAgent._execute_step` used combined context string — description text containing "zone" caused wrong field routing; **rewrote to exact field-name matching**
17. `SpecBuilderAgent` prompt did not mandate specific field names; **added MANDATORY FIELD NAMES section**
18–21. Timeout increases for Gemini API latency spikes — **applied across all beats**

### Session 4 (2026-03-22) — Sprint 2 cleanup + CI
22. Unused TypeScript variables — **removed** (`e655fd8`)
23. Background seeding blocked server startup — **made non-blocking via asyncio.create_task** (`7b10cd2`)
24. CI `npx` commands hang — **added `-y` flag** (pending verification)
25. CI missing `npm ci` for E2E deps — **added step** (pending verification)

### Session 5 (2026-03-22) — Sprint 4 sidebar redesign
26. Form state lost on tab switch — tabs unmount/remount; **changed to display:none** (tabs stay mounted)
27. Submitted state persists across applications — **reset all form state on activeApplicationId change**
28. Stale published agent causes AGENT_MATCH_FOUND instead of OPTIMIZATION_OPPORTUNITY — **demo startup now clears agents + non-seeded sessions**

### Session 6 (2026-04-05) — Sprint 5 Sidebar Chat & Bubble UI
29. Modernized Sidebar UX — Implemented glassmorphism aesthetics, warm gradients for the bubble UI and the `r4mi-logo.png` injection within the host UI.
30. Persistent Chat — Chat surface is now permanently visible in the sidebar, moving away from explicit isolated phase-blocks.
31. Automated notification flow — Bubble now emits "guided auto-fill available" popup that maps to new Agent description flows inside the Chat payload.
32. Context Chat — Added `/suggest-flow` and capability-query routing to backend, allowing contextual guidance of system abilities to end users.

---

## Key File Locations

| What | Where |
|------|-------|
| E2E tests | `e2e/tests/demo.spec.ts`, `e2e/tests/health.spec.ts` |
| Playwright config | `e2e/playwright.config.ts` |
| CI workflow | `.github/workflows/e2e-demo.yml` |
| Kanban board | `backend/seed/kanban.json` → served at `/kanban` |
| Sidebar root | `frontend/src/sidebar/SidebarApp.tsx` (phase state machine) |
| HITL replay | `frontend/src/sidebar/components/HITLReplay.tsx` |
| Agentverse | `frontend/src/sidebar/components/AgentverseDrawer.tsx` |
| Loader (vanilla JS) | `frontend/public/r4mi-loader.js` |
| Capture (vanilla JS) | `frontend/public/capture.js` |
| Preview endpoint | `backend/routers/agents.py` → `POST /api/agents/preview` |
| NarrowAgent field routing | `backend/agents/narrow_agent.py` → `_execute_step()` |
| SpecBuilderAgent prompt | `backend/agents/spec_builder_agent.py` → `PROMPT` constant |
| Gemini calls | `backend/services/embedding_service.py`, `backend/services/vision_service.py` |
| SSE events | `backend/routers/sse.py`, `backend/services/sse_bus.py` |
| Store | `frontend/src/store/r4mi.store.ts` |

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
