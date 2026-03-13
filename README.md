# r4mi-ai

**UI Workflow Observation and Automation Factory**

r4mi-ai watches a human permit technician work inside a legacy government software system, silently detects repetitive patterns using real Gemini AI, then collaboratively builds and publishes narrow AI agents that progressively take over their repetitive work.

---

## What Makes It Real

This is not a prototype with mocked AI. The core intelligence uses genuine Gemini API calls:

- **Real Gemini embeddings** (`text-embedding-004`) — every completed session's action trace is embedded and compared via cosine similarity. The similarity scores are real numbers from real API calls. This is what justifies the "repetition detected" claim.
- **Real Gemini Vision** (`gemini-2.5-flash`) — when the worker switches screens, a screenshot is sent to Gemini Vision to identify which text regions they're consulting (policy paragraphs, case notes, freetext fields).
- **Real Gemini structured output** (`gemini-2.5-flash`) — confirmed action sequences and knowledge sources are assembled into an executable `NarrowAgentSpec` via a real LLM call, not a template fill.
- **Real correction handling** — when the user types a correction, it's appended to the SpecBuilderAgent prompt and the spec is genuinely regenerated.

All stub data (GIS, code enforcement, owner registry) is simulated via JSON seed files. The AI calls are genuine.

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- A Gemini API key ([get one free at Google AI Studio](https://aistudio.google.com))

### Run with Docker Compose

```bash
cp .env.example .env
# Edit .env — set GEMINI_API_KEY=your_key_here
docker compose up --build
```

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000        |
| Backend   | http://localhost:8000        |
| API docs  | http://localhost:8000/docs   |

---

## Local Development (without Docker)

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env      # set GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
# Proxies /api/* to localhost:8000 via Vite dev server
```

---

## Reproducible Testing

The full 7-beat demo flow is covered by a Playwright E2E test suite. Tests require live servers and a valid Gemini API key — the suite makes real AI calls, which is what it's testing.

### Install

```bash
cd e2e
npm install
npx playwright install chromium
```

Start servers first (either Docker Compose or local dev as above).

### Health Checks — fast, no Gemini

```bash
cd e2e
npx playwright test health
```

Verifies backend is alive, seed data is loaded (9 applications, 2 prior sessions), and the frontend renders the Application Inbox. Runs in ~5 seconds.

### Full 7-Beat Demo Test

```bash
cd e2e
npx playwright test demo
```

Walks through the complete demo script end-to-end in a single browser session:

| Beat | What it tests |
|------|---------------|
| 1 — The Work       | Permit tech navigates inbox → GIS lookup → Policy Reference → submits form |
| 2 — The Detection  | Gemini embedding call fires; `optimization-badge` appears in ≤45s via SSE |
| 3 — The Replay     | SessionReplay animation shows observed workflow with `from GIS API` / `from PDF §14.3` source tags |
| 4 — The Correction | User redirects knowledge source; spec regenerated via Gemini in ≤45s |
| 5 — The Publish    | HITL validation replay → agent published to Agentverse |
| 6 — The Payoff     | New application opens; published agent auto-fills `field-zone` and `field-max-height` |
| 7 — Agentverse     | Agent card shows trust level (SUPERVISED) and run count |

**Expected duration:** 20–90 seconds depending on Gemini API latency.

### Run a Specific Beat

```bash
cd e2e
npx playwright test --grep "Beat 4"
```

### View Failure Report

```bash
cd e2e
npx playwright show-report
```

Failure artifacts (trace, screenshots, video) are captured automatically and viewable in the HTML report.

### Interactive UI Mode

```bash
cd e2e
npx playwright test --ui
```

Visual runner with step-by-step replay, DOM inspection, and re-run on demand.

### Watch the Browser

```bash
cd e2e
npx playwright test demo --headed
```

---

## Demo Script

The full 7-beat narrative is documented in [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

The live system architecture diagram is rendered at http://localhost:3000/system.

The CLI Evidence Panel (`CLI` button in the tab bar) streams real backend logs showing Gemini calls, token counts, and cosine similarity scores in real time.

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions and [WORKFLOWS.md](WORKFLOWS.md) for the 10-stage state machine.

```
Browser
  └── React SPA (Vite + TypeScript + Zustand)
        ├── Legacy Permit UI    — mock 2008 government software
        ├── Tab Progression Bar — bottom bar, always visible
        ├── Optimization Panel  — side panel, surfaces AI findings
        └── SSE hook            — receives real-time events from backend

FastAPI Backend
  ├── /api/observe              — receives UIEvent stream
  ├── /api/sse                  — pushes typed events to frontend
  ├── /api/logs                 — streams live Gemini call logs
  ├── /api/agents/*             — agent market endpoints
  └── /api/stubs/*              — GIS, registry, policy (JSON seed files)

AI Layer (google-genai SDK)
  ├── EmbeddingService          — text-embedding-004, cosine similarity
  ├── VisionService             — gemini-2.5-flash Vision, cached per screen
  ├── SpecBuilderAgent          — gemini-2.5-flash structured output
  └── NarrowAgent               — executes published NarrowAgentSpec
```

---

## Cloud Deployment

See [DEPLOY.md](DEPLOY.md) for Google Cloud Run deployment instructions, manual setup steps, and the automated `cloudbuild.yaml` pipeline.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | **required** | Gemini API key from Google AI Studio |
| `GOOGLE_GENAI_USE_VERTEXAI` | `false` | Use Vertex AI instead of AI Studio |
| `DATABASE_URL` | `sqlite:///./r4mi.db` | SQLite path |
| `PATTERN_THRESHOLD` | `3` | Sessions before pattern detection fires |
| `PATTERN_CONFIDENCE_MIN` | `0.85` | Cosine similarity threshold |
| `AGENTVERSE_MATCH_THRESHOLD` | `0.85` | Agent matching threshold for auto-fill |
| `TRUST_PROMOTION_MIN_RUNS` | `10` | Successful runs before SUPERVISED → AUTONOMOUS |
| `TRUST_PROMOTION_MAX_FAILURE_RATE` | `0.05` | Max failure rate to stay AUTONOMOUS |
| `DEMO_SESSION_SEED` | `true` | Pre-load 2 prior fence-variance sessions on startup |
| `DEMO_USER_ID` | `permit-tech-001` | Hardcoded demo user |
| `VISION_CACHE_TTL` | `300` | Vision API cache TTL in seconds |
