# r4mi-ai — Architecture Decisions

Hard decisions that Claude Code must not second-guess or deviate from.
Each decision includes rationale so context is never lost.

---

## What We Are NOT Building

- **No Chatwoot** — replaced by a purpose-built mock legacy permit UI
- **No real database integrations** — all external systems are stub APIs reading from JSON
- **No browser extension** — UI event capture is simulated via a test harness that POSTs mock UIEvent sequences
- **No authentication system** — single hardcoded user for the demo
- **No cloud deployment** — everything runs locally via Docker Compose for the demo

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
- Receives UIEvent stream
- Uses Gemini Vision to identify unstructured text regions in screenshots
- Runs pattern state machine
- Emits `OPTIMIZATION_OPPORTUNITY` SSE event when pattern is ready

### SpecBuilderAgent
- Input: confirmed action trace + confirmed knowledge sources
- Output: `NarrowAgentSpec` JSON
- Must produce valid JSON matching the schema — use structured output mode
- Also handles the correction flow: receives typed correction text, regenerates spec

### MarketMatcher
- Input: new `NarrowAgentSpec` candidate
- Uses Gemini embedding API to generate spec embeddings
- Cosine similarity search over published spec embeddings
- Returns match if similarity > 0.85, with contribution metadata

### NarrowAgent
- Input: published `NarrowAgentSpec` + current permit application data
- Executes the action sequence against stub APIs
- Streams execution steps as SSE events so frontend can show live demo
- Reports confidence per step

---

## Data Flow

```
Browser (mock legacy UI)
  → user interacts with permit form
  → UIEvent POSTed to /api/observe (simulated by test harness in demo)
  → ObserverAgent processes event stream
  → Pattern state machine advances
  → When READY: SSE event sent to frontend
  → TabProgressionBar shows notification tab
  → User opens tab, GET /api/session/{id}/replay
  → Frontend plays back replay frames
  → User confirms: POST /api/session/{id}/confirm/sequence
  → User confirms sources: POST /api/session/{id}/confirm/sources
  → MarketMatcher runs: GET /api/agents/match
  → If match: NarrowAgent demo streams via SSE
  → User tunes (optional): POST /api/agents/{id}/tune
  → Publish: POST /api/agents/publish
  → SSE: AGENT_PUBLISHED event to all connected clients
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
GEMINI_API_KEY=                      # required
GOOGLE_GENAI_USE_VERTEXAI=false
DATABASE_URL=sqlite:///./r4mi.db
PATTERN_THRESHOLD=3                  # sessions before pattern is READY
PATTERN_CONFIDENCE_MIN=0.75
AGENTVERSE_MATCH_THRESHOLD=0.85
TRUST_PROMOTION_MIN_RUNS=10
TRUST_PROMOTION_MAX_FAILURE_RATE=0.05
DEMO_USER_ID=permit-tech-001
DEMO_SESSION_SEED=true               # if true, pre-load 2 completed sessions on startup
```

`DEMO_SESSION_SEED=true` is critical — it means when the demo starts, the pattern
detector already has 2 prior sessions logged, so the first live walkthrough
immediately triggers the READY state. Without this the demo would require 3 full
walkthroughs before anything happens.
