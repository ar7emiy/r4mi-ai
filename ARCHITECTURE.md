# r4mi-ai — Architecture Decisions

Hard decisions that Claude Code must not second-guess or deviate from.
Each decision includes rationale so context is never lost.

---

## What We Are NOT Building

- **No Chatwoot** — replaced by a purpose-built mock legacy permit UI
- **No real database integrations** — all external systems are stub APIs reading from JSON
- **No authentication system** — single hardcoded user for the demo
- **No cloud deployment** — everything runs locally via Docker Compose for the demo

**capture.js exists and is the real capture layer.** `frontend/public/capture.js` is a vanilla JS DOM observer included in `index.html` via a single script tag. It listens to real DOM events, extracts `element_context` from ARIA labels/roles/landmarks, and POSTs enriched UIEvents to `/api/observe`. It only activates when the host sets `data-session-id` on `<body>`, so the React test harness and E2E suite are unaffected. This is the enterprise integration model.

---

## Frontend

**Stack:** React 18 + TypeScript + Vite 6 + Tailwind CSS v4 + shadcn/ui

**Key decision — Mock Legacy UI:**
The permit system UI must look like 2008 government software. This is intentional and critical to the demo narrative. Do not make it look modern. See `frontend/DESIGN.md` for the exact aesthetic brief.

**Key decision — No polling:**
All real-time updates from the backend arrive via Server-Sent Events (SSE).
The frontend connects once to `/api/sse` on load and maintains that connection.
No `setInterval`, no polling endpoints.

**Key decision — Tab Progression Bar:**
A persistent component fixed to the bottom of the screen showing active agent tasks.
It is always visible regardless of which screen the user is on.
It is the only place where r4mi-ai surfaces its presence during normal work.
It must never interrupt the user's current workflow.

**Key decision — Mermaid diagram:**
The system architecture diagram (UML activity, 3 swimlanes) is rendered client-side
using `mermaid` npm package. It lives at `/system` route and is accessible from
the tab bar. Source file: `frontend/src/assets/system-diagram.mermaid`.

---

## Backend

**Stack:** FastAPI 0.133.1 + Python 3.12 + SQLModel + SQLite + uvicorn

**Key decision — SSE over WebSockets:**
The backend pushes events to the frontend via SSE (`sse-starlette`).
WebSockets are bidirectional and more complex. The frontend only needs to receive
— it sends commands via normal REST POST calls. SSE is sufficient and simpler.

**Key decision — SQLite for agent market:**
The agentverse (published narrow agent specs) persists to SQLite via SQLModel.
In-memory store is not sufficient — agents must survive server restarts for demo realism.
SQLite requires zero infrastructure and is appropriate for demo scale.

**Key decision — JSON files for stub data:**
All simulated external systems (GIS, code enforcement, owner registry, etc.) are
stub API endpoints that read from JSON seed files in `backend/seed/`.
Do not use a second database. Do not call real APIs. JSON files are intentional.

**Key decision — 10-stage pattern detection state machine:**
The ObserverAgent pattern detector has 10 stages:
1. IDLE — waiting for events
2. COLLECTING — accumulating events for current session
3. FINGERPRINTING — hashing action sequence for comparison
4. COMPARING — comparing against previous session fingerprints
5. CANDIDATE — potential pattern identified, needs more evidence
6. CONFIRMING — pattern seen N times (threshold: 3), building confidence
7. READY — pattern mature, ready to surface to user
8. REPLAYING — user opened optimization tab, replay in progress
9. BUILDING — user confirmed, SpecBuilderAgent generating spec
10. PUBLISHED — narrow agent published to agentverse

State persists in SQLite. Each session has its own state machine instance.

---

## AI Layer

**Model:** `gemini-2.5-flash` for all agents
**SDK:** `google-genai` (new unified SDK) — import as `from google import genai`
**Agent framework:** `google-adk` — `from google.adk.agents import Agent`

**Do NOT use:**
- `google-generativeai` (legacy, deprecated June 2026)
- `google-cloud-aiplatform` generative AI modules (deprecated June 2026)
- Any OpenAI SDK

**Four agents:**

### ObserverAgent
- Receives UIEvent stream from `/api/observe`
- In teach-me mode (`capture_mode="teach"`): calls StepLabeller for Gemini-generated step descriptions per event
- Uses Gemini Vision to identify unstructured text regions in screenshots (on `screen_switch` events)
- Runs pattern state machine (COLLECTING → FINGERPRINTING → COMPARING → CANDIDATE → READY)
- On pattern READY: MarketMatcher runs automatically — emits `AGENT_MATCH_FOUND` if match ≥ 0.85, else `OPTIMIZATION_OPPORTUNITY`
- On `OPTIMIZATION_OPPORTUNITY`: kicks off SpecBuilderAgent as a background task (pre-generation)

### SpecBuilderAgent
- Input: confirmed action trace + confirmed knowledge sources; optionally a correction string
- Uses `gemini-2.5-flash` with structured output (JSON schema enforced)
- Prompt is causally threaded: for each input event, includes which knowledge source the worker had just read and what it said — this is the structural advantage over macro recorders
- Pre-generation: runs as `asyncio.create_task` with its own `Session(engine)` — safe after request closes
- Also handles the correction flow: appends correction to prompt, regenerates spec via real Gemini call

### MarketMatcher
- Now runs at PATTERN READY time, not at publish time
- Input: session trace embedding (`list[float]`) via `find_match_by_vector()`
- Cosine similarity of trace embedding vs all published spec embeddings
- Returns `(NarrowAgentSpec, score)` if score ≥ 0.85, else None
- The comparison is trace-vs-spec (different text representations). Log scores in CLI panel — tune `AGENTVERSE_MATCH_THRESHOLD` if scores are systematically below 0.85

### StepLabeller (new)
- Called from ObserverAgent for teach-mode events (`capture_mode="teach"`)
- One Gemini Flash micro-call per event: generates a one-line natural language description of the step
- `STEP_LABEL_MODE=realtime` (default) | `batch` — batch defers all labels to session end
- Labels stored in `UIEvent.step_description`, passed to SpecBuilderAgent for richer prompts

### NarrowAgent
- Input: published `NarrowAgentSpec` + current permit application data
- Executes the action sequence against stub APIs
- Streams execution steps as SSE events so frontend can show live demo
- Reports confidence per step

---

## Data Flow

```
Browser (mock legacy UI + capture.js or synthetic test harness)
  → UIEvent POSTed to /api/observe
  → ObserverAgent: accumulates events, vision on screen_switch, step label on teach-mode
  → Pattern state machine advances
  → When READY:
      MarketMatcher.find_match_by_vector(trace_embedding, db)
        → match found:  SSE AGENT_MATCH_FOUND  → adopt card in OptimizationPanel
        → no match:     SSE OPTIMIZATION_OPPORTUNITY
                        asyncio.create_task(_pre_generate_spec(session_id))
                          → gemini-2.5-flash builds NarrowAgentSpec
                          → stored in session.candidate_spec_draft
                          → SSE SPEC_GENERATED (spec available before user opens panel)
  → TabProgressionBar shows notification badge (green=adopt, indigo=build)
  → User opens panel:
      adopt path:  Activate Agent → ValidationReplay with matched spec
                   Fork & Customise → enters build path with matched spec pre-loaded
      build path:  SessionReplay → CorrectionInput → SpecSummary (no spinner — already generated)
                   → ValidationReplay → POST /api/agents/publish
                   → SSE AGENT_PUBLISHED → agent card in AgentversePanel
  → Subsequent READY for same permit type: MarketMatcher finds published spec → AGENT_MATCH_FOUND
```

---

## Docker Compose Services

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes: ["./backend/seed:/app/seed"]
    env_file: .env

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
```

No other services. No Redis. No Elasticsearch. No Chatwoot.

---

## Environment Variables

```bash
GEMINI_API_KEY=                         # required
GOOGLE_GENAI_USE_VERTEXAI=false
DATABASE_URL=sqlite:///./r4mi.db
PATTERN_THRESHOLD=3                     # sessions before pattern is READY
PATTERN_CONFIDENCE_MIN=0.85
AGENTVERSE_MATCH_THRESHOLD=0.85
TRUST_PROMOTION_MIN_RUNS=10
TRUST_PROMOTION_MAX_FAILURE_RATE=0.05
DEMO_USER_ID=permit-tech-001
DEMO_SESSION_SEED=true                  # pre-loads 2 seeded sessions per workflow type on startup
VISION_CACHE_TTL=300
STEP_LABEL_MODE=realtime                # realtime | batch (batch defers step labels to session end)
```

`DEMO_SESSION_SEED=true` pre-loads 2 completed sessions (per workflow type) on startup so the first live submission immediately triggers READY state. No agents are pre-seeded — the first run builds and publishes, the second run triggers the adopt path.

**DB reset required** when upgrading from a version that used `gemini-embedding-001`. Delete `backend/r4mi.db` before the first run — `DEMO_SESSION_SEED=true` will re-create and re-embed everything with `text-embedding-004`.
