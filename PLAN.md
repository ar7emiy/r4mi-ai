# r4mi-ai — Architecture & Interaction Design Plan

> **Two-Mode Capture · Market-First Detection · Teach-Me Quality Parity**
>
> March 2026 — Working Draft

---

## Contents

1. [Vision Alignment](#1-vision-alignment)
2. [Architecture Plan](#2-architecture-plan)
3. [Implementation Plan](#3-implementation-plan)
4. [Example Workflows](#4-example-workflows)
5. [Open Questions](#5-open-questions)

---

## 1. Vision Alignment

r4mi-ai is a UI workflow observation and automation factory. It watches a permit technician work inside any web-based system, silently detects repetitive patterns using real Gemini AI, then collaboratively builds narrow agents that progressively take over that work.

> **Core principle:** the system notices patterns before the user does, and arrives at the "teach me" moment with a prepared solution — not an empty recording form.

### 1.1 Comparison with Claude in Chrome Teach-Me

Claude in Chrome's teach-me feature is a manual macro recorder: the user presses record, demonstrates steps, stops, and saves a shortcut. It uses **rrweb** for full DOM capture and **claude-haiku-4-5** to label each step in natural language. The result is a parameterised prompt template with named input variables.

| Claude in Chrome Teach-Me | r4mi-ai Target |
|---|---|
| User decides when to record | System detects repetition proactively, then invites recording |
| Single-site macro replay | Site-agnostic spec that reasons about intent, not just clicks |
| Parameterised prompt template | Structured `NarrowAgentSpec` with typed `action_sequence` |
| No marketplace / no prior art search | MarketMatcher checks for existing agents before building |
| rrweb full DOM capture always-on | Lightweight observation mode + rich teach-me mode |
| Speech narration as primary intent signal | Gemini Vision knowledge-source extraction per screen |
| Haiku step labels per interaction | Step descriptions needed — **currently missing** |
| `element_context` from real DOM | `element_context` not yet captured — **gap to close** |

### 1.2 Site-Agnostic Goal

The current demo runs inside r4mi's own mock permit UI, where `screen_name` is an application-defined constant (`GIS_LOOKUP`, `POLICY_REFERENCE` etc.). The target is a capture layer that derives context from the real DOM — URL, page title, ARIA landmarks, element roles and labels — so it can be dropped into any government portal, insurance intake, or back-office web system without cooperation from the host application.

> **Immediate action:** design the UIEvent model now to accommodate DOM-native fields, even while the demo harness populates them synthetically. This means no schema migration when the real capture layer is built.

---

## 2. Architecture Plan

### 2.1 Two-Mode Capture

The most important structural change is separating capture into two distinct modes with different data richness. A single heavy capture mode would be too expensive for passive observation; a single light mode would not give the teach-me phase enough context to generate high-quality specs.

| Observation Mode (passive, always-on) | Teach-Me Mode (active, on invitation) |
|---|---|
| Lightweight — minimal overhead on worker | Rich — full context per interaction |
| UIEvent: 5 event types, `screen_name`, selector, value | UIEvent: + `element_context`, step screenshot, `step_description` |
| Screenshot only on `screen_switch` | Screenshot on every meaningful interaction |
| No per-step LLM calls | Haiku call per step — generates natural language label |
| Purpose: detect repetition via embedding similarity | Purpose: build a high-quality NarrowAgentSpec |
| Input to PatternDetector + MarketMatcher | Input to SpecBuilderAgent |
| Captures: *is this the same workflow again?* | Captures: *what exactly was the worker deciding and why?* |

### 2.2 Enhanced UIEvent Model

The UIEvent model gains an optional `element_context` block and a `capture_mode` flag. Observation mode leaves new fields null; teach-me mode populates them from the real DOM. The demo harness synthesises plausible values so the schema is validated end-to-end before the real capture layer exists.

| Field | Obs. Mode | Teach-Me Mode | Notes |
|---|---|---|---|
| `session_id` | required | required | No change |
| `user_id` | required | required | No change |
| `event_type` | required | required | Extend enum: + `hover`, `scroll`, `copy` |
| `screen_name` | required | derived | Teach-me derives from URL + ARIA landmark |
| `element_selector` | required | required | CSS selector string |
| `element_value` | optional | required | Input value, selected option, etc. |
| `element_context` | null | **required** | `{ label, role, text, position, landmark }` |
| `screenshot_b64` | screen_switch only | **required** | Per meaningful interaction |
| `step_description` | null | **required** | Haiku-generated natural language label |
| `is_input_variable` | null | **required** | `true` = value varies per case; `false` = constant |
| `capture_mode` | `obs` | `teach` | Enum: `obs \| teach` |
| `permit_type` | required | required | Still required in both modes |
| `backend_call` | optional | optional | No change |

### 2.3 Market-First Detection Flow

Currently, when a pattern is detected (`OPTIMIZATION_OPPORTUNITY`), the system always goes to the build path — starting SpecBuilderAgent from scratch. The new flow checks MarketMatcher first, producing two distinct invitation paths.

| # | Actor | Action / System Response |
|---|---|---|
| 1 | PatternDetector | Session completes. Embeds trace with `text-embedding-004`. Compares cosine similarity against prior sessions of same `permit_type`. |
| 2 | PatternDetector | Similarity ≥ 0.85 for N-1 prior sessions → `state = READY`. |
| 3 | **MarketMatcher** | **Immediately checks published NarrowAgentSpecs for a match ≥ 0.85 using the current session's trace embedding. [NEW STEP]** |
| 4a | SSE Bus | **Match found → fire `AGENT_MATCH_FOUND` with `{ matched_spec_id, score, name, trust_level }`. [NEW SSE TYPE]** |
| 4b | SSE Bus | No match → fire `OPTIMIZATION_OPPORTUNITY` as today. Simultaneously kick off SpecBuilderAgent as background task. [ENHANCED] |
| 5a | Frontend | **Adopt path:** badge shows "We found an agent for this" with match score. One-click activation. Fork option for power users. |
| 5b | Frontend | **Build path:** badge shows "We detected a pattern." When user opens panel, draft spec is already displayed (pre-generated in background). |

### 2.4 Pre-Generation at Detection Time

The "already prepared" feeling requires the spec to be done before the user gets to the panel. Fix: kick off SpecBuilderAgent as an `asyncio` background task the moment READY triggers. Store the draft on `SessionRecord.candidate_spec_draft`. When the user opens OptimizationPanel, display the draft immediately. The correction flow then refines rather than waits for initial generation.

```python
# pattern_detector.py — when READY
if state == READY:
    asyncio.create_task(_pre_generate_spec(session, all_matching_sessions, db))
    return SSEEventType.OPTIMIZATION_OPPORTUNITY

async def _pre_generate_spec(session, matching_sessions, db):
    spec = await spec_builder_agent.build(session, matching_sessions)
    session.candidate_spec_draft = spec.model_dump()
    db.commit()
    await sse_bus.broadcast(SSEEventType.SPEC_GENERATED, spec)
```

> **Optional enhancement:** run a speculative draft at CANDIDATE state (2nd session). Refine at READY (3rd session). By the time the badge appears, the spec has been through two generations.

### 2.5 Step Description Generation (Haiku Labelling)

Claude in Chrome uses `claude-haiku-4-5` to generate a one-line natural language description of each captured step in real time. r4mi currently has no equivalent.

After each UIEvent in teach-me mode, call Gemini Flash with a micro-prompt:

```
# Step context
screen: {screen_name}  element: {label} ({role})
action: {event_type}  value: {element_value}

# Task
Write one plain-English sentence describing what the worker
just did and why. Max 15 words. No jargon.
```

The generated label is stored in `UIEvent.step_description` and passed to SpecBuilderAgent. The prompt then works from a sequence of labelled, human-readable steps rather than raw event data.

### 2.6 SpecBuilderAgent Prompt Enhancement

After teach-me mode changes, SpecBuilderAgent should receive labelled steps with causal knowledge source threading: for each step, the prompt includes which knowledge source the worker was consulting (from VisionService) and how it informed the field value.

> **Example:** "At step 5 (entered zone code R-2), the worker had just read PDF §14.3 which states that R-2 zones permit fences up to 6ft. The system should verify `[zone_code]` against this policy before filling `[field-max-height]`."
>
> This causal link is r4mi's structural advantage over Claude in Chrome, which captures *what* was clicked but not *why*.

---

## 3. Implementation Plan

Each initiative is independently testable. The existing 7-beat E2E suite must remain green after every item.

| Initiative | Priority | Effort | Files Changed |
|---|---|---|---|
| Move MarketMatcher to detection time | **P0** | S (0.5d) | `pattern_detector.py`, `sse.py`, `r4mi.store.ts`, `OptimizationPanel.tsx` |
| Add `AGENT_MATCH_FOUND` SSE + adopt-path UI | **P0** | M (1d) | `models/event.py`, `sse.py`, `OptimizationPanel.tsx`, `AgentversePanel.tsx` |
| Pre-generate spec as background task on READY | **P0** | S (0.5d) | `pattern_detector.py`, `spec_builder_agent.py`, `models/session.py` |
| Add `element_context` to UIEvent model | P1 | S (0.5d) | `models/event.py`, demo harness, seed sessions |
| Add `capture_mode` + `is_input_variable` to UIEvent | P1 | S (0.5d) | `models/event.py`, `observer_agent.py` |
| Step description generation (Haiku call per event) | P1 | M (1d) | `services/step_labeller.py` (new), `observer_agent.py`, `log_streamer.py` |
| Thread knowledge sources into SpecBuilderAgent prompt | P1 | M (1d) | `spec_builder_agent.py` |
| Teach-me mode: screenshot per interaction | P2 | M (1d) | `models/event.py`, `vision_service.py`, demo harness |
| Derive `screen_name` from URL + ARIA landmarks | P2 | L (2d) | `observer_agent.py`, demo harness, future JS capture layer |
| JS capture snippet (site-agnostic observe layer) | P3 | XL (1w) | New: `capture.js`, injected via bookmarklet or extension |

### 3.1 P0 — Quick Wins (This Sprint)

Three items that are pure backend wiring with minimal frontend change. They deliver the market-first detection and the "already prepared" feeling.

**P0-A: Move MarketMatcher to detection time**
- In `pattern_detector.py`, after `state = READY`: call `market_matcher.find_match()` using the current session's trace embedding compared against all published spec embeddings
- If match ≥ threshold: return `SSEEventType.AGENT_MATCH_FOUND` with payload `{ matched_spec_id, score }`
- If no match: return `SSEEventType.OPTIMIZATION_OPPORTUNITY` as today
- Add `AGENT_MATCH_FOUND` to `SSEEventType` enum in `models/event.py`
- In `r4mi.store.ts`: handle `AGENT_MATCH_FOUND` — set `matchedAgent` state, show badge in adopt-path style

**P0-B: Pre-generate spec as background task**
- Add `candidate_spec_draft: Optional[dict]` to `SessionRecord` model
- In `pattern_detector.py`, when `OPTIMIZATION_OPPORTUNITY` fires: `asyncio.create_task(_pre_generate_spec(session, db))`
- `_pre_generate_spec()` calls SpecBuilderAgent, stores result in `session.candidate_spec_draft`, fires `SPEC_GENERATED` SSE
- `OptimizationPanel`: check store for existing spec draft before showing loading state

**P0-C: Adopt-path UI in OptimizationPanel**
- When `store.matchedAgent` is set: render adopt card showing agent name, trust badge, run count, and match percentage
- Primary CTA: "Activate Agent" — skips spec building, goes directly to ValidationReplay with matched agent's `action_sequence`
- Secondary CTA: "Fork & Customise" — enters build path with matched spec pre-loaded into SpecBuilderAgent as starting point

---

## 4. Example Workflows

Three full interaction walkthroughs showing the target experience from both user and system perspective.

### 4.1 Scenario A — Adopt Path (Existing Agent Found)

**Context:** Maria is a permit technician. She has just completed her third fence variance application in two weeks. An agent for this workflow was published by her colleague two months ago.

| # | Actor | Action / System Response |
|---|---|---|
| 1 | Maria | Opens PRM-2024-0043 from inbox. Navigates: Inbox → GIS Lookup → Policy Reference → Application Form. Fills zone code, max height, notes. Clicks Submit. |
| 2 | Backend | Session completes. PatternDetector embeds the action trace (real `text-embedding-004` call). Cosine similarity: 0.93 vs session_001, 0.91 vs session_002. State = READY. |
| 3 | **Backend** | **MarketMatcher runs immediately. Finds "Fence Variance — R-2 Zone Check" at cosine 0.94. Fires `AGENT_MATCH_FOUND` SSE.** |
| 4 | Frontend | Tab Progression Bar badge appears. Label: "We found an agent for this." Different styling from build-path badge. Maria finishes her current thought before clicking. |
| 5 | Maria | Clicks badge. OptimizationPanel opens. Adopt card: agent name, SUPERVISED trust badge, "47 successful runs", "94% match". Primary button: "Activate Agent". |
| 6 | Maria | Reads the agent card. Clicks "Activate Agent". No spec building. ValidationReplay starts immediately. |
| 7 | Frontend | ValidationReplay animates action_sequence against PRM-2024-0043 fields: auto-fills zone=R-2, max-height=6ft, notes prefilled. Source tags shown ("from GIS API", "from PDF §14.3"). |
| 8 | Maria | Confirms. Agent is now active for her session. Next fence variance: agent auto-fills immediately, no interaction required. |
| 9 | Maria *(optional)* | Notices max-height rule has changed to 8ft in her jurisdiction. Clicks "Fork & Edit" from agent card. Enters teach-me mode on the specific step. |
| 10 | Backend | Fork creates new NarrowAgentSpec with `parent_spec_id` set. Attribution split between original author and Maria. New agent published to Agentverse. |

> **Total friction for Maria:** one badge click + one "Activate" click. She never leaves her workflow for more than 30 seconds. The agent finds her; she does not go looking for it.

---

### 4.2 Scenario B — Build Path (No Existing Agent)

**Context:** James handles commercial signage permits. This workflow has never been automated. He has just completed his third signage permit this month.

| # | Actor | Action / System Response |
|---|---|---|
| 1 | James | Completes third commercial signage permit: Inbox → GIS Lookup (commercial zone check) → Code Enforcement (sign dimensions) → Fee Schedule → Application Form. Submits. |
| 2 | Backend | Session completes. PatternDetector embeds trace. Cosine similarity: 0.89 vs session_011, 0.91 vs session_012. State = READY. |
| 3 | **Backend** | **MarketMatcher runs. No published spec scores ≥ 0.85 for commercial signage. Fires `OPTIMIZATION_OPPORTUNITY`. Simultaneously kicks off SpecBuilderAgent as background task.** |
| 4 | Backend | SpecBuilderAgent (`gemini-2.5-flash`) builds draft NarrowAgentSpec from the three session traces + confirmed knowledge sources. Stores in `session.candidate_spec_draft`. Fires `SPEC_GENERATED` SSE. |
| 5 | Frontend | Badge appears: "We detected a repeating pattern." James finishes his current task. |
| 6 | James | Clicks badge. OptimizationPanel opens. **Draft spec is already displayed — no loading spinner.** Shows ACTION SEQUENCE (4 steps) and KNOWLEDGE SOURCES: "Commercial Zone Map", "Sign Bylaw §8.2". |
| 7 | James | Reads the spec. Sees knowledge source is "Commercial Zone Map (wiki)" but the real source is the GIS PDF export. Types correction: "Use the GIS PDF, not the zone map wiki." |
| 8 | Backend | Correction appended to SpecBuilderAgent prompt. Real `gemini-2.5-flash` call regenerates spec. `knowledge_sources` updated: "GIS PDF (parcel export)". `SPEC_UPDATED` SSE fires. |
| 9 | James | Sees updated spec. Clicks "Review & Validate". ValidationReplay animates against a sample application. Fields auto-fill correctly. |
| 10 | James | Clicks "Publish to Agentverse". Spec embedded (real `text-embedding-004` call). Agent ID assigned. Trust: SUPERVISED. `AGENT_PUBLISHED` SSE fires. |
| 11 | Frontend | Agentverse panel shows new agent card: "Commercial Signage — Zone + Sign Check" with SUPERVISED badge and 0 runs. |
| 12 | Future | Next technician opens a commercial signage permit. MarketMatcher finds this agent at step 3. They follow Scenario A. James's contribution is recorded. |

---

### 4.3 Scenario C — Teach-Me Mode (Step-Level Correction)

**Context:** Same as Scenario B, but James corrects a specific step by demonstrating it rather than typing a text correction. This is the full teach-me experience that achieves parity with Claude in Chrome.

| # | Actor | Action / System Response |
|---|---|---|
| 1 | James | In OptimizationPanel, clicks "Show me" next to the incorrect knowledge source step instead of typing a correction. |
| 2 | Frontend | System enters teach-me mode. Recording indicator appears. James is prompted: "Navigate to the correct source for this step." |
| 3 | Backend | Capture switches to teach-me mode. UIEvents now include: `element_context` (label, role, ARIA landmark), `screenshot_b64` per interaction, `capture_mode = "teach"`. |
| 4 | **Backend** | **On each UIEvent in teach-me mode, micro-prompt call to Gemini generates `step_description` inline: e.g. "Opened the GIS PDF export for parcel R2-0041." Logged to CLI panel in real time.** |
| 5 | James | Navigates to the GIS PDF. Clicks on the relevant section (parcel data block). System highlights the region. James clicks "Confirm source." |
| 6 | Backend | VisionService analyses screenshot at click position. Confirms: `source_type=pdf`, `confidence=0.96`, `text_snippet="Parcel R2-0041-BW — Commercial C-2 zone."` |
| 7 | Backend | Teach-me mode ends. Enriched event sequence (with `step_descriptions` and `element_context`) appended to correction prompt. SpecBuilderAgent regenerates spec. |
| 8 | James | Updated spec shows corrected knowledge source with exact PDF section and confidence score. He publishes. |

> **The teach-me quality difference:** James never typed the source name manually. The system captured exactly which element he clicked, its DOM role and label, what Gemini Vision extracted from the screenshot, and generated a human-readable step label automatically. This is parity with Claude in Chrome's teach-me — except r4mi also knows *why* the value was chosen from *which policy source*, which Claude in Chrome cannot do.

---

## 5. Decisions

All open questions resolved.

**Q1 — MarketMatcher similarity metric: trace-vs-spec ✓**
The adopt-path comparison runs the current session's trace embedding against published NarrowAgentSpec embeddings (spec text: name + description + action sequence). Spec embeddings are already computed at publish time, so no extra API call is needed. Trace-vs-spec answers "does this agent's stated capability cover what I just observed?" — which is exactly the right question for the adopt path.

**Q2 — Trust levels and human confirmation ✓**
There is always a user-facing prompt before automation executes — no silent autonomous mode. The distinction between trust levels is the *weight* of confirmation required:

- **SUPERVISED** (new agent, <10 runs): confirm each individual step as it executes — e.g. "About to fill zone field with R-2 from GIS API. Proceed?"
- **AUTONOMOUS** (proven agent, high success rate): single upfront prompt covering the whole workflow — "Automation available. Run it?" — then all steps execute in one pass.

Color coding communicates trust at a glance: orange badge for SUPERVISED, green for AUTONOMOUS. The adopt card shows run count and trust level so the user can make an informed choice before activating.

**Q3 — Teach-me mode activation: both ✓**
Teach-me mode is available in two ways:
1. **Correction flow** — "Show me" button on a specific step in OptimizationPanel, for correcting a step in an already-detected pattern.
2. **Standalone record button** — user can initiate proactively before the system has detected three similar sessions. Power users who know they'll repeat a workflow can build the agent immediately.

**Q4 — Step labelling: real-time with batching option ✓**
Default: Gemini generates the step label immediately after each UIEvent in teach-me mode. Labels appear in the CLI panel as the user acts. A config flag (`STEP_LABEL_MODE=batch`) switches to batch mode — all labels generated at session end. Same code path, just deferred. Batch mode for cost-sensitive deployments.

**Q5 — Demo capture strategy: `capture.js` script tag ✓**
This is an enterprise product — the host cooperates by including a script tag. The right demo path is to build `capture.js` as a self-contained vanilla JS observer (~150 lines) that:
- Listens to real DOM events (clicks, inputs, form submissions, navigation)
- Extracts `element_context` from the actual DOM (ARIA labels, roles, landmark)
- POSTs enriched UIEvents to `/api/observe` automatically

Included in the mock permit UI via:
```html
<script src="/capture.js" data-api="http://localhost:8000"></script>
```

This is exactly the enterprise integration model — one script tag, one config attribute, zero changes to the host app. The demo and the product are the same thing. File lives at `frontend/public/capture.js` so Vite serves it as a static asset. Replaces the synthetic test harness for live demos while the E2E suite continues using seeded events.

The `capture.js` item is promoted from P3 to **P1** given it directly enables authentic demo capture and validates the enterprise integration model early.

---

## 6. Enterprise Integration Model

r4mi-ai is designed as an enterprise product where the host application cooperates with the observer. This means:

- The host includes `capture.js` via a script tag — no browser extension required, no IT approval process beyond a script deployment
- Agents and specs stay **host-agnostic** — they reference semantic field identities (`zone_classification`, `max_permitted_height`) not UI-specific selectors (`#form > div:nth-child(3) > input`)
- The host exposes stable semantic names for fields it wants to be automatable — this is the cooperation surface, kept deliberately minimal
- `capture.js` derives `screen_name` from URL + ARIA landmarks, not from application-defined constants — no r4mi-specific code needs to be written per deployment

The goal is: one `capture.js` drop-in works across any web-based back-office system. Agents built on one deployment can be matched and adopted by another deployment of the same workflow type.
