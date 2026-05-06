# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# r4mi-ai — Claude Code Master Build Instructions

Read this file first. Then read ARCHITECTURE.md, WORKFLOWS.md, DEMO_SCRIPT.md, and DESIGN.md before writing a single line of code.

---

## Commands

### Dev servers (e2e expects backend on :8000, r4mi on :3000, permit-app on :4000)
```bash
# Backend
cd backend && uvicorn main:app --reload --port 8000
# r4mi sidebar + utility routes
cd frontend && npm run dev                 # vite on :3000
# Mock permit site (host page)
cd mock-sites/permit-app && npm run dev    # vite on :4000
# One-shot full stack
docker compose up                          # backend + r4mi + permit-app
```

### Frontend build / typecheck
```bash
cd frontend && npm run build                # tsc -b && vite build (typecheck is part of build)
cd frontend && npm run preview              # serve built dist
```
There is no separate lint/format step configured. TypeScript errors from `tsc -b` are the gate.

### Tests (Playwright E2E — servers must already be running)
```bash
cd e2e
npm run test:health            # fast sanity, no Gemini calls (~5s)
npm run test:demo              # full 7-beat demo flow, real Gemini (20–90s)
npm run test:headed            # watch browser with slow-mo
npm run test:ui                # interactive Playwright UI
npm run test:beat -- "Beat 3"  # run a single beat by grep
npx playwright show-report     # view last run's report (failures + traces)
```
Playwright config (`e2e/playwright.config.ts`): serial (`fullyParallel: false` — beats are stateful), 180s per-test timeout, 30s expect timeout for SSE-driven UI. Flakiness is almost always Gemini API latency — retry before debugging.

### No Python test suite is wired up beyond the e2e Playwright flow. Do not assume `pytest` is runnable.

---

## Current Implementation Notes

### Sidebar is a phase-based state machine
- [frontend/src/sidebar/SidebarApp.tsx](frontend/src/sidebar/SidebarApp.tsx) defines `type Phase = 'idle' | 'recording' | 'detected' | 'replay' | 'publishing' | 'agents'` and switches the whole sidebar UI on it. There is no more independent chat thread + buttons model; the sidebar renders a different surface per phase.
- The sidebar is persistent (iframe always mounted, collapsed until opened) and chat-first. A dark/light theme is driven by a `CLR` CSS-variable object exported from `SidebarApp.tsx` and mutated on theme toggle. **Reuse `CLR` for any new sidebar styling** — do not hardcode hex colors.
- Sidebar tabs: `chat` and `activity`. The activity tab shows `captureLogs` from `capture.js` narration events.

### HITL replay replaced per-field gates during replay
- [frontend/src/sidebar/components/HITLReplay.tsx](frontend/src/sidebar/components/HITLReplay.tsx) owns the `replay` phase. It calls `POST /api/agents/preview` on mount to resolve every step's value + source tag, then walks the user through step-by-step approve/correct with `data-testid="replay-approve"` buttons.
- As each step becomes current, HITLReplay posts `r4mi:navigate-tab` and `r4mi:demo-step` messages to the parent via postMessage. The host page is driven by `r4mi-loader.js`, not React state.
- `ApprovalGate.tsx` still exists and is used for real agent runs (Beat 6), but the replay path no longer touches it.

### `POST /api/agents/preview` (new endpoint)
- Defined at [backend/routers/agents.py:281](backend/routers/agents.py#L281). Dry-runs `NarrowAgent._execute_step` against `seed/applications.json` for each step in the draft spec **without persisting**. Classifies each step to a host screen (`gis` / `policy` / `form`) based on its `source` field (contains `"gis"`/`"parcel"` → gis; contains `§` or `"pdf"`/`"policy"`/`"municipal"` → policy; else form). Any change to `_execute_step` must keep this dry-run path working.

### `r4mi-loader.js` is now a thick client, not just a relay
[frontend/public/r4mi-loader.js](frontend/public/r4mi-loader.js) is vanilla JS but now handles:
- **Guided auto-fill popup**: on `OPTIMIZATION_OPPORTUNITY` SSE it pops a "✨ guided auto-fill available" bubble next to the toggle button; click opens the sidebar and posts `r4mi:automation-alert` with `session_id`.
- **`r4mi:navigate-tab` handler**: receives from sidebar → dispatches a `r4mi:navigate-tab` window event that `LegacyPermitApp` listens for to switch tabs.
- **`r4mi:demo-step` handler**: receives each resolved step from HITLReplay and drives the host page animation. For editable inputs it does a typing animation directly on the DOM; **for read-only elements it overlays a dashed amber virtual-input box with the value**. The source tag label is appended as an absolutely-positioned span. Field routing: `zone*` → `[data-testid="field-zone"]`, `note*`/`decision*` → `[data-testid="field-notes"]`, `height*`/`max*` → `[data-testid="field-max-height"]`.
- Toggle button uses the `r4mi-ai-logo.png` image with an orange gradient background (not the old indigo plus-circle SVG).

### React ApplicationForm no longer animates demo fills
- [frontend/src/components/legacy/ApplicationForm.tsx](frontend/src/components/legacy/ApplicationForm.tsx) lost its `demoSteps` subscription, `typeValue` helper, `sourceTags` state, and `testId`/`sourceTag` props on `FormRow`. All of that logic moved into `r4mi-loader.js`'s `r4mi:demo-step` handler (see above). **Do not re-add typing animation to React** — the loader owns it.
- The form now resets its local state on `activeApplicationId` change.

### Legacy tabs are kept mounted (display toggle, not unmount)
- [frontend/src/components/legacy/LegacyPermitApp.tsx](frontend/src/components/legacy/LegacyPermitApp.tsx) renders all tab components simultaneously and toggles `display: none`. This is load-bearing: the demo test asserts `field-zone` still has value `R-2` after the user switches tabs. Do not regress to conditional mounting.
- `LegacyPermitApp` also listens for the `r4mi:navigate-tab` window event to drive tab switches from the sidebar.

### Backend demo cleanup on startup
- [backend/main.py](backend/main.py) lifespan, when `DEMO_SESSION_SEED=true`, **deletes all `NarrowAgentSpec` rows and all non-seeded `SessionRecord` rows before re-seeding**. This is what keeps the demo idempotent across restarts. `SessionRecord.is_seeded` is the flag used to discriminate.
- Seeding happens in a background task (`asyncio.create_task`) so uvicorn doesn't block on Gemini calls at boot.

### Chat system prompt rewritten
- [backend/routers/chat.py](backend/routers/chat.py)'s `SYSTEM_PROMPT` now emphasizes `/suggest-flow` commands, describing agents (utility/goals/inputs/outputs), and explaining r4mi's current understanding of the webpage and user intent. Keep that framing if you touch the prompt.

### Recording pause enforced at capture layer
- [frontend/public/capture.js](frontend/public/capture.js) `postEvent` drops the POST early if `localStorage.r4mi_pause_recording === 'true'`. The sidebar's pause toggle writes that key. **Any new capture-side POST must respect this flag.**
- `capture.js` dispatches `r4mi:capture-live` CustomEvents with narration payloads that feed `CaptureFeedback.tsx`. Do not regress that event shape.

### CaptureFeedback + AgentverseDrawer
- [frontend/src/sidebar/components/CaptureFeedback.tsx](frontend/src/sidebar/components/CaptureFeedback.tsx) renders live narration from `capture.js` during teach-me mode.
- [frontend/src/sidebar/components/AgentverseDrawer.tsx](frontend/src/sidebar/components/AgentverseDrawer.tsx) was restyled to the `CLR` theme and now uses plain-text clickable targets (`run`, `agents`) rather than `<button role=…>` — the e2e test matches them via `getByText('agents', { exact: true })` and `getByText('run')`.

### E2E demo test was rewritten around the new flow
[e2e/tests/demo.spec.ts](e2e/tests/demo.spec.ts) beats were restructured. When touching any of these, re-run the full demo:
- **Beat 2**: asserts `/pattern detected/i` and `/review replay/i` in sidebar (not "Build Agent from Pattern").
- **Beat 3**: clicks `/review replay/i` text (not a button) to enter `replay` phase.
- **Beat 4** (now "HITL Step Approval"): loops up to 8 times clicking `sidebar.getByTestId('replay-approve')` with a 5s visibility timeout per iteration, breaking when the button no longer appears. Expects `/review complete|all.*steps reviewed/i` at the end. The old "Show me → click §14.3 PDF → Confirm & continue" correction flow is **gone** from the happy path.
- **Beat 5**: clicks `getByText(/publish agent/i)`, expects `/published/i`.
- **Beat 6**: asserts zone value persists via mounted tabs, opens agents view via `getByText('agents', { exact: true })`, clicks `getByText('run')`.
- **Beat 1 extra**: asserts `R-2` in `field-zone` after switching tabs — load-bearing for the mounted-tabs architecture.

### CI workflow
- [.github/workflows/e2e-demo.yml](.github/workflows/e2e-demo.yml) now runs `npm ci` inside `e2e/` **before** `npx playwright install` (previously it skipped the dep install and relied on npx-on-demand). It also uses `npx -y` consistently to skip prompts.

### System view route
- The `/system` route renders `frontend/src/assets/system-diagram.mermaid` via the mermaid npm package plus additional context — check [frontend/src/pages/SystemPage.tsx](frontend/src/pages/SystemPage.tsx) before assuming the mermaid file is the only source.

### Backend router set
- `chat.py` and `_sse_bus.py` are active routers beyond what the Project Structure section lists.
- `services/exceptions.py` defines `QuotaExhaustedException`; the agents router catches it and surfaces Gemini quota errors to the UI.
- `services/sse_bus.py` (imported as `sse_bus`) is the canonical broadcast channel for non-log SSE events.

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
┌─────────────────────────────────────────────────────────────────────────┐
│                    HOST WEB APPLICATION (any site)                      │
│  [Existing UI — unmodified]              [r4mi-loader.js injected]      │
│  User works normally in their familiar   Sidebar iframe (r4mi React app)│
│  interface. Fields populated by agent    Chat thread · Record btn        │
│  via postMessage relay. Tab-progression  Agents drawer · Notifications  │
│  gates render inline on host form fields.                               │
└───────────────────────────┬─────────────────────────┬───────────────────┘
                capture.js  │ UIEvents (POST)          │ SSE /api/sse
                r4mi-loader │ postMessage relay        │ REST /api/*
┌───────────────────────────▼─────────────────────────▼───────────────────┐
│                      BACKEND (FastAPI 0.133.1)                          │
│  POST /api/observe                POST /api/agents/build                │
│  GET  /api/session/{id}/replay    POST /api/agents/publish              │
│  POST /api/agents/{id}/tune       POST /api/agents/{id}/correction      │
│  GET  /api/evidence/{session_id}  GET  /api/sse                         │
│  GET  /api/logs                   GET  /api/stubs/*                     │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
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
├── mock-sites/                 ← standalone host-page test harnesses (not r4mi product code)
│   └── permit-app/             ← City of Riverdale MPPS — runs on :4000
│       ├── index.html          ← loads r4mi-loader.js via <script src="http://localhost:3000/...">
│       ├── vite.config.ts      ← port 4000, proxies /api → :8000
│       └── src/
│           ├── context/
│           │   └── PermitContext.tsx  ← activeApplicationId + demoMode (no Zustand)
│           └── components/     ← all legacy permit UI components
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
│   │   ├── logs.py
│   │   ├── chat.py
│   │   └── _sse_bus.py
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
    ├── public/
    │   ├── r4mi-loader.js          ← injected into host page; manages sidebar iframe + postMessage relay
    │   └── capture.js              ← DOM observer; extracts element_context; POSTs UIEvents to /api/observe
    └── src/
        ├── sidebar/                ← the r4mi UI — runs as iframe inside any host page
        │   ├── SidebarApp.tsx      ← root; chat thread + record button + agents drawer
        │   ├── hooks/
        │   │   ├── useSidebarSSE.ts   ← maps SSE events to chat messages
        │   │   └── useChatMessages.ts ← message state management
        │   └── components/
        │       ├── ChatMessage.tsx     ← renders notification/spec/agent-step/error messages + action buttons
        │       ├── ChatInput.tsx       ← correction input + teach-me toggle
        │       ├── RecordButton.tsx    ← enters teach-me mode; signals capture.js via postMessage
        │       ├── ReplayPreview.tsx   ← step-by-step action sequence preview with source tags
        │       └── AgentverseDrawer.tsx← agent marketplace
        ├── pages/
        │   ├── EvidencePage.tsx    ← CLI evidence panel at /evidence
        │   └── SystemPage.tsx      ← system architecture at /system (renders system-diagram.mermaid)
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
    event_type: Literal["click", "navigate", "input", "screen_switch", "submit", "hover", "scroll", "copy"]
    screen_name: str
    element_selector: str
    element_value: Optional[str] = None
    backend_call: Optional[dict] = None
    screenshot_b64: Optional[str] = None   # screen_switch only in obs mode; every interaction in teach mode
    element_context: Optional[dict] = None  # teach mode: { label, role, text, position, landmark }
    step_description: Optional[str] = None  # teach mode: voice transcription or Gemini-generated label
    is_input_variable: Optional[bool] = None  # teach mode: True = value varies per case
    capture_mode: Literal["obs", "teach"] = "obs"
    permit_type: Optional[str] = None
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
- The system must ALWAYS seek to align with the ethos of README.md - never hard coding optimizations or detections because the optimization detection must be authentic, automation tuning with HITL must be authentic, we must seek to create a platform that will be able to be UI agnostic even if right now we are testing it within a mock UI.
- **r4mi UI lives in the sidebar — not in overlays injected into the host page.** The sidebar is an iframe. The host page is only touched by `r4mi-loader.js` for: field population (postMessage relay) and tab-progression gate overlays per field. Do not create overlay React components that embed into the host app.
- **Agent population writes to real host form fields** — never to a simulated UI. The replay preview in the sidebar is descriptive (step summaries + source tags), not a mock form.
- **TrustLevel drives badge display only** — it must not gate or skip HITL confirmation steps. Every agent run goes through tab-progression verification regardless of trust level.
- **capture.js and r4mi-loader.js are vanilla JS** — no React, no bundler dependencies. They must be includable via a plain `<script>` tag in any web application. 