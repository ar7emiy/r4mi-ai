# r4mi-ai — Claude Code Master Build Instructions

Read this file first. Then read ARCHITECTURE.md, WORKFLOWS.md, DEMO_SCRIPT.md, and DESIGN.md before writing a single line of code.

---

## What This System Is

r4mi-ai is a **UI workflow observation and automation factory**. It watches a human permit technician work inside a legacy government software system, silently detects repetitive patterns using real Gemini AI calls, then collaboratively builds and publishes narrow AI agents that progressively take over their repetitive work.

**Key properties:**
- Workers never stop working — the system observes passively and surfaces opportunities in a non-blocking tab
- No automatic approvals — the expert always confirms action sequences and knowledge sources
- Agent market (agentverse) with trust lifecycle — supervised → autonomous → stale
- Contribution tracking — when an existing agent is tuned and forked, attribution is split

**What is NOT being built:**
- No Chatwoot — replaced by a purpose-built mock legacy permit UI (see DESIGN.md)
- No browser extension — UI event capture is simulated by a test harness
- No real external APIs — all external systems are stubs reading from JSON seed files
- No authentication — single hardcoded demo user
- No cloud deployment — Docker Compose, runs locally

---

## The Most Important Design Decision: Real AI vs Scaffolded

This distinction is critical. Everything must be technically honest.

### REAL Gemini API calls — do not fake these

**1. Session trace embedding (pattern detection)**
Every completed session's action trace is embedded via the Gemini embedding API.
Cosine similarity is computed in Python between the current session and prior sessions.
The similarity scores are REAL numbers from REAL API calls.
This is what justifies the "repetition detected" claim.

```python
from google import genai

async def embed_trace(trace: ActionTrace) -> list[float]:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    trace_text = serialize_trace_to_text(trace)
    result = await client.aio.models.embed_content(
        model="models/text-embedding-004",
        contents=trace_text,
    )
    return result.embeddings[0].values
```

**2. Knowledge source extraction (Gemini Vision)**
When the user switches screens, a screenshot is sent to Gemini Vision.
Gemini returns which regions contain unstructured text the worker is consulting.
Confidence scores per region are REAL Gemini outputs.

```python
async def extract_knowledge_sources(screenshot_b64: str, screen_name: str) -> list[KnowledgeSource]:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=[{
            "parts": [
                {"inline_data": {"mime_type": "image/png", "data": screenshot_b64}},
                {"text": f"""
                    This is a screenshot of the '{screen_name}' screen in a municipal permit system.
                    Identify all regions containing unstructured text that a worker would read to
                    make a permit decision (policy paragraphs, case notes, freetext fields).
                    Return JSON array: [{{selector_description, text_snippet, confidence, source_type}}]
                """}
            ]
        }]
    )
    return parse_knowledge_sources(response.text)
```

**3. Spec generation (SpecBuilderAgent)**
Given confirmed action trace and confirmed knowledge sources, a real Gemini call
generates the NarrowAgentSpec. Output is real LLM reasoning, not a template fill.

**4. Correction handling**
When the user types a correction, it is appended to the SpecBuilderAgent prompt
and the spec is genuinely regenerated. The new spec is a real Gemini output.

### SCAFFOLDED — explicitly allowed

- Stub APIs for GIS, code enforcement, owner registry, sewer/water — JSON seed files
- Pre-seeded prior sessions for demo setup (DEMO_SESSION_SEED=true)
- UI replay animation — presentation layer, not AI
- 10-stage state machine transitions — logic, not AI
- Trust engine promotion math — simple arithmetic

---

## The Evidence Panel (CLI Split-Screen)

The demo runs as a split screen: legacy permit UI on the left, CLI terminal panel on the right.
The CLI streams live backend logs showing actual Gemini calls and real similarity scores.
This is how the demo proves the AI is real without stopping the narrative.

**CLI output during a live session:**
```
[Observer] Session PRM-2024-0041 started
[Observer] Screen switch → GIS_LOOKUP | sending screenshot to Gemini Vision...
[Vision]   Regions identified: 1 (parcel_data_block, confidence=0.94)
[Observer] Screen switch → POLICY_REFERENCE | sending screenshot to Gemini Vision...
[Vision]   Regions identified: 2 (section_14_3_paragraph, conf=0.91), (toc, conf=0.43)
[Observer] Session complete — embedding action trace...
[Embedding] text-embedding-004 called (trace: 247 tokens)
[Embedding] Vector: 768 dimensions
[Similarity] vs session_001: cosine=0.91 ✓ (threshold: 0.85)
[Similarity] vs session_002: cosine=0.88 ✓ (threshold: 0.85)
[Detector]  Pattern READY — 2/2 sessions exceed similarity threshold
[SSE]       → OPTIMIZATION_OPPORTUNITY sent to frontend
```

**CLI output during correction + publish:**
```
[Correction] User: "use PDF source not wiki"
[SpecBuilder] gemini-2.5-flash called (prompt: 1,243 tokens)
[SpecBuilder] Spec regenerated — knowledge_source updated: PDF §14.3
[Agentverse] Publishing: "Fence Variance — R-2 Zone Check"
[Agentverse] Embedding spec for market index...
[Agentverse] Agent ID: agt_7f3a9b2c | Trust: SUPERVISED
[SSE]        → AGENT_PUBLISHED broadcast to all clients
```

**Implementation:**
- Backend uses Python `logging` with a custom SSE handler (`log_streamer.py`)
- `/api/logs` SSE endpoint streams log lines to frontend in real time
- On connect, replays last 500 log lines so the panel has context
- Frontend `CLIPanel.tsx` is a dark scrolling `<pre>` component consuming `/api/logs`
- Every Gemini call logs: model name, token count, latency, result summary

**The `/evidence` route** shows the full technical proof for anyone who wants depth:
- Three session action traces side by side
- Real cosine similarity matrix with scores and threshold line highlighted
- Embedding model name, dimensions, token counts
- "View raw vectors" toggle showing actual float arrays (truncated to 10 dims for display)

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│           FRONTEND (React 18 + Vite + TypeScript)            │
│  Mock Legacy Permit UI  │  Tab Progression Bar (bottom)      │
│  Optimization Panel     │  CLI Evidence Panel (split screen) │
│  Agentverse View        │  /evidence + /system routes        │
└──────────────┬──────────────────────────┬────────────────────┘
               │ SSE /api/sse             │ REST
               │ SSE /api/logs            │
┌──────────────▼──────────────────────────▼────────────────────┐
│                   BACKEND (FastAPI 0.133.1)                   │
│  POST /api/observe                                           │
│  GET  /api/session/{id}/replay                               │
│  POST /api/session/{id}/confirm/sequence                     │
│  POST /api/session/{id}/confirm/sources                      │
│  GET  /api/agents/match                                      │
│  POST /api/agents/publish                                    │
│  POST /api/agents/{id}/tune                                  │
│  GET  /api/evidence/{session_id}                             │
│  GET  /api/sse                                               │
│  GET  /api/logs                                              │
│  GET  /api/stubs/*  (GIS, violations, registry, fees...)     │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│              AI LAYER (google-genai + google-adk)            │
│  EmbeddingService  ← REAL: text-embedding-004                │
│  VisionService     ← REAL: gemini-2.5-flash Vision           │
│  SpecBuilderAgent  ← REAL: gemini-2.5-flash structured output│
│  MarketMatcher     ← REAL: cosine similarity on embeddings   │
│  NarrowAgent       ← executes published NarrowAgentSpec      │
└──────────────────────────────────────────────────────────────┘
```

---

## Package Versions (Confirmed Feb 26, 2026)

### Python
```
python>=3.12
fastapi==0.133.1
uvicorn[standard]>=0.34.0
google-genai>=1.0.0          # unified SDK — NOT google-generativeai (legacy/deprecated)
google-adk>=1.0.0
pydantic>=2.12.0
python-dotenv>=1.0.0
sse-starlette>=2.1.0
sqlmodel>=0.0.21
httpx>=0.28.0
numpy>=2.0.0                 # cosine similarity
pytest>=8.3.0
pytest-asyncio>=0.25.0
```

### Frontend
```json
{
  "react": "^18.3.0",
  "typescript": "^5.7.0",
  "vite": "^6.1.0",
  "@vitejs/plugin-react": "^4.3.0",
  "tailwindcss": "^4.0.0",
  "zustand": "^5.0.0",
  "@tanstack/react-query": "^5.0.0",
  "mermaid": "^11.0.0"
}
```

### SDK rules
- `from google import genai` — NOT `import google.generativeai`
- Generation model: `gemini-2.5-flash`
- Embedding model: `models/text-embedding-004`
- ADK: `from google.adk.agents import Agent`

---

## Project Structure

```
r4mi-ai/
├── CLAUDE.md
├── ARCHITECTURE.md
├── WORKFLOWS.md
├── DEMO_SCRIPT.md
├── DESIGN.md
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── seed/
│   │   ├── applications.json
│   │   ├── gis_results.json
│   │   ├── code_enforcement.json
│   │   ├── owner_registry.json
│   │   ├── hazmat_registry.json
│   │   ├── sewer_capacity.json
│   │   ├── water_capacity.json
│   │   ├── policy_sections.txt
│   │   └── fee_schedules.json
│   ├── agents/
│   │   ├── observer_agent.py
│   │   ├── spec_builder_agent.py
│   │   ├── market_matcher.py
│   │   └── narrow_agent.py
│   ├── routers/
│   │   ├── observe.py
│   │   ├── session.py
│   │   ├── agents.py
│   │   ├── evidence.py
│   │   ├── stubs.py
│   │   ├── sse.py
│   │   └── logs.py
│   ├── models/
│   │   ├── event.py
│   │   ├── agent_spec.py
│   │   └── session.py
│   ├── services/
│   │   ├── pattern_detector.py
│   │   ├── embedding_service.py    ← wraps Gemini embedding + cosine math
│   │   ├── vision_service.py       ← wraps Gemini Vision + caching
│   │   ├── trust_engine.py
│   │   └── log_streamer.py         ← logging handler → SSE
│   └── db.py
│
└── frontend/
    └── src/
        ├── components/
        │   ├── legacy/
        │   │   ├── ApplicationInbox.tsx
        │   │   ├── ApplicationForm.tsx
        │   │   ├── GISLookup.tsx
        │   │   ├── PolicyReference.tsx
        │   │   ├── CodeEnforcement.tsx
        │   │   ├── OwnerRegistry.tsx
        │   │   └── UtilityCapacity.tsx
        │   └── overlay/
        │       ├── TabProgressionBar.tsx
        │       ├── OptimizationPanel.tsx
        │       ├── SessionReplay.tsx
        │       ├── SourceHighlight.tsx
        │       ├── CorrectionInput.tsx
        │       ├── SpecSummary.tsx
        │       ├── AgentversePanel.tsx
        │       └── CLIPanel.tsx
        ├── hooks/
        │   ├── useSSE.ts
        │   ├── useLogs.ts
        │   └── useAgentverse.ts
        ├── store/
        │   └── r4mi.store.ts
        └── assets/
            └── system-diagram.mermaid
```

---

## Core Data Models

### UIEvent
```python
class UIEvent(BaseModel):
    session_id: str
    user_id: str
    timestamp: datetime
    event_type: Literal["click", "navigate", "input", "screen_switch", "submit"]
    screen_name: str
    element_selector: str
    element_value: Optional[str] = None
    backend_call: Optional[dict] = None
    screenshot_b64: Optional[str] = None   # included on screen_switch events only
```

### ActionTrace
```python
class ActionTrace(BaseModel):
    session_id: str
    user_id: str
    permit_type: str
    events: list[UIEvent]
    embedding: Optional[list[float]] = None   # populated after embed call
    completed_at: datetime
```

### NarrowAgentSpec
```python
class TrustLevel(str, Enum):
    SUPERVISED = "supervised"
    AUTONOMOUS = "autonomous"
    STALE = "stale"

class NarrowAgentSpec(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str
    permit_type: str
    trigger_pattern: dict
    action_sequence: list[dict]
    knowledge_sources: list[dict]
    embedding: list[float]           # real Gemini embedding of spec text
    trust_level: TrustLevel = TrustLevel.SUPERVISED
    successful_runs: int = 0
    failed_runs: int = 0
    contributions: list[dict] = Field(default_factory=list)
    parent_spec_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

### SSEEventType enum — use everywhere, no raw strings
```python
class SSEEventType(str, Enum):
    SCREEN_SWITCH             = "SCREEN_SWITCH"
    KNOWLEDGE_EXTRACTED       = "KNOWLEDGE_EXTRACTED"
    PATTERN_CANDIDATE         = "PATTERN_CANDIDATE"
    OPTIMIZATION_OPPORTUNITY  = "OPTIMIZATION_OPPORTUNITY"
    REPLAY_FRAME              = "REPLAY_FRAME"
    SPEC_GENERATED            = "SPEC_GENERATED"
    SPEC_UPDATED              = "SPEC_UPDATED"
    AGENT_DEMO_STEP           = "AGENT_DEMO_STEP"
    AGENT_PUBLISHED           = "AGENT_PUBLISHED"
    AGENT_RUN_COMPLETE        = "AGENT_RUN_COMPLETE"
    AGENT_EXCEPTION           = "AGENT_EXCEPTION"
```

---

## Embedding Service

```python
# services/embedding_service.py
import numpy as np
from google import genai

class EmbeddingService:
    def __init__(self):
        self.client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        self._cache: dict[str, list[float]] = {}

    async def embed(self, text: str, cache_key: str) -> list[float]:
        if cache_key in self._cache:
            return self._cache[cache_key]
        result = await self.client.aio.models.embed_content(
            model="models/text-embedding-004",
            contents=text,
        )
        vector = result.embeddings[0].values
        self._cache[cache_key] = vector
        logger.info(f"[Embedding] {cache_key} — {len(vector)} dims")
        return vector

    def cosine_similarity(self, a: list[float], b: list[float]) -> float:
        va, vb = np.array(a), np.array(b)
        return round(float(np.dot(va, vb) / (np.linalg.norm(va) * np.linalg.norm(vb))), 4)

    def serialize_trace(self, trace: ActionTrace) -> str:
        lines = [f"permit_type:{trace.permit_type}"]
        for e in trace.events:
            lines.append(f"{e.event_type}:{e.screen_name}:{e.element_selector}")
        return " | ".join(lines)
```

---

## Log Streamer

```python
# services/log_streamer.py
import logging, asyncio
from collections import deque

class SSELogHandler(logging.Handler):
    def __init__(self, maxlen=500):
        super().__init__()
        self.queue: asyncio.Queue = asyncio.Queue()
        self.history: deque = deque(maxlen=maxlen)

    def emit(self, record):
        msg = self.format(record)
        self.history.append(msg)
        try:
            self.queue.put_nowait(msg)
        except asyncio.QueueFull:
            pass

log_handler = SSELogHandler()
logger = logging.getLogger("r4mi")
logger.addHandler(log_handler)
logger.setLevel(logging.INFO)
```

`/api/logs` replays `log_handler.history` on connect then streams new entries live.

---

## Build Order

Do not skip steps. Each is independently testable.

1. Seed data files — all JSON under `backend/seed/` from WORKFLOWS.md
2. Backend scaffolding — FastAPI, SQLModel DB, stub routers, health check
3. Data models — all Pydantic/SQLModel with full validation
4. Log streamer + `/api/logs` SSE — build early, makes everything debuggable
5. Stub API endpoints — `/api/stubs/*` reading from seed files
6. Embedding service — real Gemini embedding + cosine similarity + cache
7. Vision service — real Gemini Vision + cache per screen
8. ObserverAgent — wires embedding + vision into 10-stage state machine
9. `/api/observe` endpoint — receives UIEvent stream, feeds ObserverAgent
10. Session replay endpoints — store sessions, generate replay frames
11. SpecBuilderAgent — real gemini-2.5-flash structured output
12. Correction handling — append correction to prompt, regenerate spec
13. MarketMatcher — cosine similarity over published spec embeddings
14. Trust engine — SUPERVISED → AUTONOMOUS → STALE transitions
15. Evidence endpoint — `/api/evidence/{session_id}`
16. SSE event layer — typed SSEEventType, broadcast to all clients
17. Frontend: legacy permit UI — all screens per DESIGN.md Layer 1
18. Frontend: Tab Progression Bar + Optimization Panel — Layer 2 overlay
19. Frontend: Session Replay + Source Highlight
20. Frontend: Correction Input + Spec Summary
21. Frontend: CLI Panel — consumes `/api/logs`, dark terminal aesthetic
22. Frontend: Agentverse Panel — card grid with trust badges
23. Frontend: `/evidence` route — similarity matrix
24. Frontend: `/system` route — Mermaid diagram
25. Demo harness — test script POSTing 2 seeded UIEvent sequences to `/api/observe`
26. DEMO_SESSION_SEED startup script — pre-loads 2 completed sessions on boot
27. Docker Compose — single `docker compose up` starts everything

---

## Environment Variables

```bash
GEMINI_API_KEY=                         # required
GOOGLE_GENAI_USE_VERTEXAI=false
DATABASE_URL=sqlite:///./r4mi.db
PATTERN_THRESHOLD=3
PATTERN_CONFIDENCE_MIN=0.85
AGENTVERSE_MATCH_THRESHOLD=0.85
TRUST_PROMOTION_MIN_RUNS=10
TRUST_PROMOTION_MAX_FAILURE_RATE=0.05
DEMO_USER_ID=permit-tech-001
DEMO_SESSION_SEED=true                  # pre-loads 2 sessions — required for demo
VISION_CACHE_TTL=300
```

---

## Hard Rules for Claude Code

- `numpy` for cosine similarity — do not implement from scratch
- All Gemini calls go through EmbeddingService or VisionService — never call the API from a router
- Log every Gemini call: model, token count, latency, result summary
- Never mutate a published NarrowAgentSpec — always fork (set parent_spec_id)
- Frontend never polls — all updates via SSE
- Screenshots are cached per session_id + screen_name — invalidate on new session
- DEMO_SESSION_SEED=true means 2 prior sessions exist at startup so the third live walkthrough immediately triggers READY
- The UML activity diagram lives at `frontend/src/assets/system-diagram.mermaid` and is rendered at `/system` via mermaid npm package
