# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# r4mi-ai — site-agnostic UI workflow automation factory

r4mi observes a worker using **any** web application, detects repetitive workflows by clustering action-trace embeddings, and builds narrow AI agents that replay the captured workflow against new cases. The mock permit app at `mock-sites/permit-app/` is **one example host** for testing — r4mi proper carries zero domain knowledge.

Read this file first. Then read ARCHITECTURE.md, WORKFLOWS.md, DEMO_SCRIPT.md, and DESIGN.md.

---

## Commands

### Dev servers
```bash
# Backend — site-agnostic
cd backend && uvicorn main:app --reload --port 8000
# r4mi sidebar
cd frontend && npm run dev                 # vite on :3000
# Mock permit site (host page) — fully self-contained, serves its own /api/stubs/*
cd mock-sites/permit-app && npm run dev    # vite on :4000
# One-shot full stack
docker compose up                          # backend + r4mi + permit-app
```

### Frontend build / typecheck
```bash
cd frontend && npm run build                # tsc -b && vite build
cd mock-sites/permit-app && npm run build   # tsc -b && vite build
```
TypeScript errors from `tsc -b` are the gate.

### E2E tests (servers must already be running)
```bash
cd e2e
npm run test:health                                # fast sanity, no Gemini (~5s)
npm run test:demo                                  # full 7-beat flow, real Gemini (20–90s)
MIN_CLUSTER_SIZE=1 npm run test:demo               # backend env required for first-session detection
npm run test:headed                                # watch browser with slow-mo
npm run test:beat -- "Beat 3"                      # run a single beat by grep
npx playwright show-report                         # view last run's report
```
Playwright config: serial (`fullyParallel: false` — beats are stateful), 180s per-test timeout, 30s expect timeout for SSE-driven UI, `baseURL` is the permit-app host on :4000. Default slowMo is 800ms — set `PWSLOWMO=0` for full speed. Flakiness is almost always Gemini latency — retry before debugging.

To reset backend state between E2E runs: start the backend with `ALLOW_RESET=true`, then `curl -X DELETE http://localhost:8000/api/observe/reset`.

### CI
`.github/workflows/e2e-demo.yml` runs the health + demo suites on every push to `main` against real Gemini (`GEMINI_API_KEY` repo secret, `MIN_CLUSTER_SIZE=1`, `ALLOW_RESET=true`). Test recordings and the Playwright report are uploaded as artifacts on every run.

---

## Architectural pillars (site-agnostic)

### 1. Selector-free semantic fingerprints
- [backend/models/event.py](backend/models/event.py) defines `ElementFingerprint` (role, accessible_name, landmark, surrounding_text, position_signature, url_pattern). Every captured event carries one.
- [frontend/public/capture.js](frontend/public/capture.js) builds fingerprints from the accessibility tree.
- [frontend/public/element_resolver.js](frontend/public/element_resolver.js) (vanilla JS, runs in the host page) resolves a fingerprint back to a DOM element using fuzzy match: role+accessible_name first, then landmark+surrounding_text, then position. Exposed as `window.r4mi.resolve(fingerprint)`.
- **Never reference CSS testids in agent code.** Resolution at runtime is fingerprint-based.

### 2. Network-call interception (no backend stubs)
- [frontend/public/capture.js](frontend/public/capture.js) wraps `window.fetch` and `XMLHttpRequest.prototype.send` to record every host-app fetch (URL, method, request/response body, headers, timestamp). Records POST to `/api/observe/network`.
- [backend/services/network_capture_service.py](backend/services/network_capture_service.py) ingests them onto `SessionRecord.network_calls`. r4mi's own URLs (`/api/observe`, `/api/sse`, etc.) are filtered to avoid recursion.
- SpecBuilder treats captured network calls as ground truth for "what data does this workflow consume". NarrowAgent's FETCH steps replay them; for run-time fetches, the agent posts `r4mi:resolve-and-fetch` to r4mi-loader so the request fires from the host's origin (cookies/auth carry over).
- `backend/routers/stubs.py` and `backend/seed/` no longer exist — domain test data lives entirely in `mock-sites/permit-app/src/mockData/` and is served by [mock-sites/permit-app/src/mockApi/plugin.ts](mock-sites/permit-app/src/mockApi/plugin.ts).

### 3. Five-action spec language
- Every NarrowAgentSpec step is one of: `read | fetch | reason | write | assert`.
- Schema: `{action, description, target_fingerprint?, source_fetch?, value_template?, reasoning_prompt?, prerequisites?}`.
- [backend/agents/narrow_agent.py](backend/agents/narrow_agent.py) `_execute_step` is a clean 5-way switch. No field-name branches, no `R-2` defaults, no `$535` literals, no source-keyword heuristics. Template interpolation supports `{step.N.value}` substitution.

### 4. Cluster-discovered workflow types (no `permit_type`)
- [backend/services/cluster_service.py](backend/services/cluster_service.py) greedily clusters completed sessions by cosine similarity (threshold `CLUSTER_THRESHOLD`, default 0.85). When a cluster reaches `MIN_CLUSTER_SIZE` (default 3), Gemini generates a one-line `cluster_label` for it.
- [backend/services/pattern_detector.py](backend/services/pattern_detector.py) calls cluster_service on session complete. There is no `permit_type` filter.
- `SessionRecord.permit_type` and `NarrowAgentSpec.permit_type` are deprecated columns kept for legacy-read compatibility. New code uses `cluster_id` + `cluster_label`. **Do not write to or filter on `permit_type` in new code.**

### 5. Generic SpecBuilder prompt
- [backend/agents/spec_builder_agent.py](backend/agents/spec_builder_agent.py) builds the prompt from observed events (with element_fingerprints), captured network_calls, and Vision-extracted knowledge sources. The "well-known field names" guidance is gone. Causal context is derived from temporal proximity of knowledge events to subsequent input events — not a hardcoded screen-name allowlist.

### 6. Knowledge-detection by interaction signal
- [backend/services/knowledge_detector.py](backend/services/knowledge_detector.py) decides when an event represents a knowledge-consumption moment worth invoking Vision. Generic event-type allowlist (`screen_switch | dwell | selection | scroll`) replaces the previous `("POLICY_REFERENCE", "CODE_ENFORCEMENT")` hardcoded screen names.
- capture.js fires `dwell` (long mouse hover on text-rich elements), `selection` (text selected for >600ms), and `scroll` (scroll-stall on long content) events.
- Per-session Vision budget: `VISION_PER_SESSION_BUDGET` env var (default 8).

### 7. Sidebar UI is the r4mi product
- [frontend/src/sidebar/SidebarApp.tsx](frontend/src/sidebar/SidebarApp.tsx) is the iframe-loaded UI. Phase state machine: `idle | recording | detected | replay | publishing | agents`.
- [frontend/src/sidebar/components/HITLReplay.tsx](frontend/src/sidebar/components/HITLReplay.tsx) drives the replay phase. Step display is generic — no `gis|policy|form` literal types, no `SCREEN_LABELS` constants. Each step shows its `action`, `target_fingerprint.accessible_name` (or `source_fetch.url_template`), and resolved value.
- [frontend/src/sidebar/components/AgentverseDrawer.tsx](frontend/src/sidebar/components/AgentverseDrawer.tsx) shows `cluster_label` on each agent card.
- Sidebar styling driven by the `CLR` CSS-variable object exported from `SidebarApp.tsx` — reuse, don't hardcode hex colors.

### 8. r4mi-loader is the host-side coordinator
- [frontend/public/r4mi-loader.js](frontend/public/r4mi-loader.js) injects element_resolver + capture into the host page.
- `r4mi:demo-step` postMessage handler resolves the step's `target_fingerprint` via `window.r4mi.resolve(fp)` and animates the value in (or overlays a virtual-input box for read-only targets).
- `r4mi:resolve-and-fetch` postMessage handler executes a captured fetch through the host's `window.fetch` so cookies/auth apply, then posts `r4mi:fetch-result` back to the sidebar.
- **No hardcoded testids.** All routing is fingerprint-based.

---

## Real AI vs scaffolded

### REAL Gemini API calls
1. **Trace embedding** — `models/text-embedding-004` per session.
2. **Cluster labelling** — `gemini-2.5-flash` once per cluster crossing MIN_CLUSTER_SIZE.
3. **Vision** — `gemini-2.5-flash` on knowledge-rich events, budgeted per session.
4. **SpecBuilderAgent** — `gemini-2.5-flash` structured output.
5. **NarrowAgent REASON steps** — `gemini-2.5-flash` for in-spec rule evaluation.
6. **StepLabeller** — `gemini-2.5-flash` for teach-mode step descriptions.

### SCAFFOLDED (test-only)
- `mock-sites/permit-app/` — example host application; not r4mi product code.
- `mock-sites/permit-app/src/mockData/` — JSON files served by the permit app's own Vite middleware.
- `mock-sites/permit-app/src/mockApi/plugin.ts` — in-process mock API for the permit app.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HOST WEB APPLICATION (any site)                      │
│  [Existing UI — unmodified]              [r4mi-loader.js injected]      │
│  Worker uses normally; r4mi observes     Sidebar iframe (r4mi React)    │
│  via accessibility tree fingerprints     element_resolver.js (host-side)│
│  AND wraps fetch/XHR for ground truth.                                  │
└───────────────────────────┬─────────────────────────┬───────────────────┘
                capture.js  │ UIEvents + network calls │ SSE + REST
                            │ (POST /api/observe[/network])
┌───────────────────────────▼─────────────────────────▼───────────────────┐
│                      BACKEND (FastAPI 0.133.1)                          │
│  POST /api/observe                POST /api/agents/build                │
│  POST /api/observe/network        POST /api/agents/publish              │
│  POST /api/agents/preview         POST /api/agents/{id}/run             │
│  POST /api/agents/{id}/correction GET  /api/sse                         │
│  GET  /api/logs                                                         │
│                                                                         │
│  Note: there is NO /api/stubs/* endpoint. Domain test data lives        │
│  inside the host site (mock-sites/<host>/), served by its own server.   │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────────┐
│              AI LAYER (google-genai)                                     │
│  EmbeddingService  ← REAL: text-embedding-004                            │
│  ClusterService    ← REAL: gemini-2.5-flash (cluster labelling)          │
│  KnowledgeDetector → VisionService (gemini-2.5-flash)                    │
│  SpecBuilderAgent  ← REAL: gemini-2.5-flash structured output            │
│  StepLabeller      ← REAL: gemini-2.5-flash (teach-mode step labels)     │
│  MarketMatcher     ← REAL: cosine similarity on embeddings               │
│  NarrowAgent       ← 5-action dispatch over captured network_calls       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
r4mi-ai/
├── CLAUDE.md
├── ARCHITECTURE.md, WORKFLOWS.md, DEMO_SCRIPT.md, DESIGN.md
├── docker-compose.yml
├── e2e/                        ← Playwright suite (health, demo, sidebar specs)
│
├── mock-sites/
│   └── permit-app/             ← one example host site, fully self-contained
│       ├── vite.config.ts      ← uses permitMockApiPlugin
│       └── src/
│           ├── components/     ← all permit-domain UI components
│           ├── mockData/       ← JSON test data (gis, policy, applications, etc.)
│           └── mockApi/
│               └── plugin.ts   ← Vite plugin: serves /api/stubs/* in-process
│
├── backend/                    ← ZERO domain knowledge
│   ├── main.py                 ← lifespan = create tables + migrate; no seeding
│   ├── agents/
│   │   ├── observer_agent.py     ← session state machine, no permit inference
│   │   ├── narrow_agent.py       ← 5-action dispatch (READ/FETCH/REASON/WRITE/ASSERT)
│   │   ├── spec_builder_agent.py ← generic prompt, fingerprint inputs
│   │   └── market_matcher.py     ← pure cosine similarity
│   ├── routers/
│   │   ├── observe.py            ← /api/observe and /api/observe/network
│   │   ├── agents.py             ← preview/build/publish/run/correction/tune
│   │   ├── session.py, evidence.py, sse.py, logs.py, chat.py
│   │   └── (no stubs.py — deleted)
│   ├── services/
│   │   ├── cluster_service.py        ← workflow discovery via cosine clustering
│   │   ├── network_capture_service.py← /api/observe/network ingest
│   │   ├── knowledge_detector.py     ← when to invoke Vision (signal-based)
│   │   ├── pattern_detector.py       ← uses cluster_service, not permit_type
│   │   ├── embedding_service.py, vision_service.py, step_labeller.py
│   │   ├── trust_engine.py, sse_bus.py, exceptions.py, log_streamer.py
│   ├── models/
│   │   ├── event.py    ← UIEvent + ElementFingerprint + KnowledgeSource
│   │   ├── session.py  ← SessionRecord with cluster_id/cluster_label/network_calls
│   │   └── agent_spec.py ← NarrowAgentSpec with cluster_id/cluster_label
│   └── db.py
│   (no seed/ directory — deleted)
│
└── frontend/
    ├── public/
    │   ├── r4mi-loader.js       ← injected into host page; coordinator
    │   ├── element_resolver.js  ← window.r4mi.resolve(fingerprint)
    │   └── capture.js           ← fingerprints, fetch/XHR interception, signals
    └── src/
        ├── App.tsx              ← /sidebar, /evidence, /system routes
        ├── sidebar/             ← the r4mi UI (iframe)
        │   ├── SidebarApp.tsx   ← phase state machine
        │   ├── hooks/{useSidebarSSE.ts, useChatMessages.ts}
        │   └── components/{ChatMessage, ChatInput, RecordButton, HITLReplay,
        │                   ReplayPreview, CaptureFeedback, AgentverseDrawer}.tsx
        └── pages/{EvidencePage, SystemPage}.tsx
```

---

## Environment Variables

```bash
GEMINI_API_KEY=                         # required
GOOGLE_GENAI_USE_VERTEXAI=false
DATABASE_URL=sqlite:///./r4mi.db

# Cluster discovery (replaces PATTERN_THRESHOLD)
CLUSTER_THRESHOLD=0.85                  # cosine threshold for joining a cluster
MIN_CLUSTER_SIZE=3                      # set to 1 for E2E demo testing

# Agent matching
AGENTVERSE_MATCH_THRESHOLD=0.85

# Trust engine
TRUST_PROMOTION_MIN_RUNS=10
TRUST_PROMOTION_MAX_FAILURE_RATE=0.05
TRUST_STALE_THRESHOLD_RUNS=50           # runs without use before an agent goes STALE

# Vision budget
VISION_PER_SESSION_BUDGET=8             # max Gemini Vision calls per session

# Teach-mode step labelling
STEP_LABEL_MODE=realtime                # realtime | batch

# Server / testing
CORS_ORIGINS=*                          # comma-separated allowed origins
ALLOW_RESET=false                       # true enables DELETE /api/observe/reset (E2E only)
```

`DEMO_SESSION_SEED`, `PATTERN_THRESHOLD`, and `VISION_CACHE_TTL` no longer exist.

**Stale docs warning:** `README.md`, `.env.example`, and `DEPLOY.md` predate the site-agnostic rewrite — they still reference `PATTERN_THRESHOLD`, `DEMO_SESSION_SEED`, and a backend `/api/stubs/*` endpoint, none of which exist. Trust this file and the code over them.

---

## Hard Rules for Claude Code

- **Zero domain knowledge in `backend/`.** No references to permits, zones, parcels, fences, fees, GIS, or any other application-specific concept in agent/service/router/model code. If `grep -rEi "permit|zone|parcel|fence|adu|gis|policy_section" backend/agents backend/services backend/routers backend/models` returns any match outside of comments documenting deprecations, it's a bug.
- **Test data lives in `mock-sites/<app>/src/mockData/` only.** Never under `backend/`.
- **All execution actions are READ, FETCH, REASON, WRITE, or ASSERT.** No new action verbs.
- **Element identification uses ElementFingerprint, not CSS selectors.** Selectors stay only as a legacy field on UIEvent for backwards compatibility.
- **Sessions are auto-bounded by capture.js.** Hosts must not be required to set `data-session-id`.
- **Cluster labelling is the only naming source for workflow types.** Never hardcode a workflow taxonomy.
- **Numpy** for cosine similarity — do not implement from scratch.
- **All Gemini calls go through their service** (EmbeddingService, VisionService, StepLabeller, ClusterService, SpecBuilderAgent, NarrowAgent's `_reason_client`). Never call the API directly from a router.
- **Log every Gemini call**: model, token count or output preview, latency.
- **Never mutate a published `NarrowAgentSpec`** — always fork (set `parent_spec_id`).
- **Frontend never polls** — all updates via SSE.
- **TrustLevel drives badge display only** — it must not gate or skip HITL confirmation.
- **capture.js, r4mi-loader.js, element_resolver.js are vanilla JS** — no React, no bundler dependencies. Includable via `<script>` in any web app.
- **r4mi UI lives in the sidebar — not in overlays injected into the host page.** The sidebar is an iframe. The host page is touched only by r4mi-loader for fingerprint-based field population.
