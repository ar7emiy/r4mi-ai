# r4mi-ai

> **UI workflow observation and automation factory** — watches permit technicians work, silently detects repetitive patterns, then collaboratively builds and publishes narrow AI agents that progressively take over the repetitive work.

Built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/) · **UI Navigators** category · Deadline: March 16 2026

---

## What it does

A permit technician processes the same 15-step workflow dozens of times a day. r4mi-ai:

1. **Observes passively** — a browser extension (or simulation script) streams `UIEvent` objects to the backend as the tech works normally
2. **Detects repetition** — a 10-stage state machine tracks screen navigation patterns and confidence-scores them with Gemini Vision
3. **Surfaces an opportunity** — when confidence > 75%, a glowing tab appears in the bottom bar (non-blocking — the tech opens it when ready)
4. **Replays the session** — step-by-step at 0.5× speed with element highlights; tech confirms or scrubs back to edit
5. **Confirms knowledge sources** — Gemini identifies unstructured text regions (GIS data, policy wiki, violation history) with confidence %; tech approves or swaps sources
6. **Matches the agentverse** — cosine similarity search over published agent specs; if found (> 85% match), demos the existing agent live
7. **Builds a new agent** — if no match, `SpecBuilderAgent` converts the confirmed trace into a `NarrowAgentSpec` via Gemini 2.5 Flash
8. **Earns autonomy** — agents run supervised, promote to autonomous after 10 clean runs, go stale when policies change
9. **Tracks contributions** — forking an agent splits credit by edit-distance delta

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                FRONTEND  (React 19 + Vite 7)                │
│  TabProgressionBar  │  SessionReplay  │  SourceHighlight    │
│  AgentDemo          │  TuningPanel    │  AgentMarket        │
└──────────────┬──────────────────────────────┬──────────────┘
               │ SSE  /sse/{session_id}        │ REST
┌──────────────▼──────────────────────────────▼──────────────┐
│               BACKEND  (FastAPI 0.133.1)                    │
│  POST /observe   GET /patterns   CRUD /agents               │
│  GET  /session/{id}/replay       POST confirm-sequence      │
│  GET  /sse/{session_id}          POST confirm-sources       │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│          AI LAYER  (google-adk + google-genai)              │
│  ObserverAgent      — Gemini Vision, pattern state machine  │
│  SpecBuilderAgent   — confirmed trace → NarrowAgentSpec     │
│  MarketMatcher      — cosine sim over spec embeddings       │
│  NarrowAgent        — executes a published workflow spec    │
└─────────────────────────────────────────────────────────────┘
```

The frontend is **entirely SSE-driven** — it never polls. Every state transition (pattern detected, source highlighted, agent step completed, trust promoted) arrives as a typed `SSEEventType` event.

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12 · FastAPI 0.133.1 · SQLModel + SQLite · sse-starlette |
| AI | google-genai ≥ 1.0.0 · google-adk ≥ 1.0.0 · Gemini 2.5 Flash |
| Frontend | React 19 · TypeScript 5.9 · Vite 7 · Tailwind 4 · Zustand 5 |
| Infra | Docker · Google Cloud Run |

---

## Run locally

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp ../.env.example ../.env   # add your GEMINI_API_KEY
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Vite proxies `/observe`, `/agents`, `/session`, `/sse` → `localhost:8000`.

### Simulate permit events (no browser extension needed)

```bash
# Trigger OPTIMIZATION_OPPORTUNITY by repeating the fence variance workflow 3×
python scripts/simulate_events.py --demo

# Single permit type
python scripts/simulate_events.py --permit fence_variance_r2 --reps 3
python scripts/simulate_events.py --permit adu_mixed_zone
python scripts/simulate_events.py --permit commercial_signage
```

### Docker (full stack)

```bash
docker-compose up              # r4mi-ai on :8080
docker-compose --profile chatwoot up   # + Chatwoot on :3000
```

---

## Project structure

```
r4mi-ai/
├── backend/
│   ├── main.py                   FastAPI entrypoint + lifespan DB init
│   ├── db.py                     SQLModel + SQLite engine
│   ├── models/
│   │   ├── event.py              UIEvent · ActionTrace · KnowledgeSource
│   │   ├── agent_spec.py         NarrowAgentSpec (SQLModel) · TrustLevel · Contribution
│   │   ├── session.py            ObservationSession · ReplayFrame
│   │   └── sse_events.py         SSEEventType enum (14 event types)
│   ├── routers/
│   │   ├── observe.py            POST /observe
│   │   ├── patterns.py           GET  /patterns/{session_id}
│   │   ├── agents.py             CRUD /agents + /fork + /demo
│   │   ├── session.py            replay frames · 2-step confirm flow
│   │   └── sse.py                GET  /sse/{session_id}
│   ├── agents/
│   │   ├── observer_agent.py     ADK ObserverAgent + Gemini Vision tools
│   │   ├── spec_builder_agent.py Gemini 2.5 Flash trace → NarrowAgentSpec
│   │   ├── market_matcher.py     Gemini text-embedding-004 cosine similarity
│   │   └── narrow_agent.py       executes a published spec step-by-step
│   └── services/
│       ├── event_bus.py          async SSE pub/sub with ring buffer
│       ├── pattern_detector.py   10-stage state machine
│       ├── knowledge_extractor.py Gemini Vision + LRU cache
│       ├── trust_engine.py       SUPERVISED → AUTONOMOUS → STALE
│       └── contribution_tracker.py edit-distance attribution split
│
├── frontend/src/
│   ├── store/r4mi.store.ts       Zustand 5 global state + SSE dispatcher
│   ├── hooks/
│   │   ├── useSSE.ts             EventSource + auto-reconnect
│   │   ├── useAgentMarket.ts     React Query /agents CRUD
│   │   └── useReplay.ts          0.5× playback state machine
│   ├── assets/
│   │   └── system-diagram.mermaid  3-swimlane UML activity diagram
│   └── components/
│       ├── TabProgressionBar.tsx  fixed bottom bar · amber opportunity glow
│       ├── OptimizationTab.tsx    non-blocking drawer · confidence bar
│       ├── SessionReplay.tsx      step scrubber · element highlights · confirm
│       ├── SourceHighlight.tsx    DOM-positioned Gemini Vision overlays
│       ├── AgentDemo.tsx          live SSE-driven step panel
│       ├── TuningPanel.tsx        diff view · contribution split preview
│       ├── AgentMarket.tsx        agent grid · trust badges · demo/fork
│       └── SystemDiagram.tsx      Mermaid.js renderer
│
├── scripts/
│   └── simulate_events.py        3-permit-type UIEvent simulator + --demo mode
├── docker-compose.yml            r4mi-ai + Chatwoot (profile-gated)
├── .env.example                  all environment variables documented
└── CLAUDE.md                     full build specification for Claude Code
```

---

## Environment variables

```bash
# Copy .env.example → .env
GEMINI_API_KEY=...                      # required for Gemini Vision + ADK
GOOGLE_GENAI_USE_VERTEXAI=false         # set true for Vertex AI
DATABASE_URL=sqlite:///./r4mi.db
PATTERN_CONFIDENCE_THRESHOLD=0.75       # when to surface the opportunity tab
AGENTVERSE_MATCH_THRESHOLD=0.85         # cosine sim threshold for market match
TRUST_PROMOTION_MIN_RUNS=10             # runs before SUPERVISED → AUTONOMOUS
TRUST_PROMOTION_MAX_FAILURE_RATE=0.05   # max failure rate for promotion
```

All values have sensible defaults; the app runs without a Gemini key using fixture data and pseudo-embeddings.

---

## Demo scenario (4-minute walkthrough)

| Time | What happens |
|------|-------------|
| 0:00–0:30 | Permit tech processes fence variance permit normally — r4mi-ai observes silently |
| 0:30–1:30 | After 3rd repetition, amber tab glows in bottom bar · tech opens OptimizationTab |
| 1:30–2:30 | SessionReplay shows every step · tech confirms sequence → SourceHighlight glows over GIS + policy text |
| 2:30–3:30 | Agentverse match found · AgentDemo streams agent executing the 4th permit live |
| 3:30–4:00 | Trust score increments · architecture diagram · Cloud Run URL proof |

---

## Hackathon submission checklist

- [x] Uses a Gemini model (`gemini-2.5-flash` for Vision + spec building)
- [x] Uses Google GenAI SDK (`from google import genai`)
- [x] Uses Google ADK (`from google.adk.agents import Agent`)
- [x] Multimodal — Gemini Vision on screenshots for source identification
- [x] Public GitHub repository
- [ ] Google Cloud Run deployment
- [ ] Demo video ≤ 4 min
- [ ] Devpost submission
