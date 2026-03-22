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
5. [Decisions](#5-decisions)
6. [Enterprise Integration Model](#6-enterprise-integration-model)

---

## 1. Vision Alignment

r4mi-ai is a UI workflow observation and automation factory. It watches a permit technician work inside any web-based system, silently detects repetitive patterns using real Gemini AI, then collaboratively builds narrow agents that progressively take over that work.

> **Core principle:** the system notices patterns before the user does, and arrives at the "teach me" moment with a prepared solution — not an empty recording form. Workers never stop working. r4mi finds them; they do not go looking for it.

### 1.1 Primary User Experience

The user opens their normal, familiar web interface — which may be old, unattractive, and uncooperative. They do their job. r4mi observes silently from a sidebar panel injected by a single script tag. When the system detects a repeating pattern, a notification appears in the sidebar. The user is never blocked or interrupted — the notification is one click away, not in their face.

When the user is ready, they click the notification. The sidebar delivers a short presentation:
1. A chat message summarising what the system detected and why it thinks it can help.
2. A visual replay of the action sequence — showing what the agent would do, step by step, with source annotations ("from GIS API", "from PDF §14.3").
3. A closing message explaining the decision logic.

The system then populates the real fields in the host web UI automatically. The user tabs through each filled field to verify or correct inline. This tab-progression verification happens inside the actual host form — not a simulation. When the user confirms, the agent is either created, updated, or verified as correct. The user continues their day.

Next time they land on the same workflow page, the same sidebar notification appears. One click — fields auto-fill — tab to verify — done. The interaction surface stays minimal.

### 1.2 Comparison with Claude in Chrome Teach-Me

Claude in Chrome's teach-me feature is a manual macro recorder: the user presses record, demonstrates steps, stops, and saves a shortcut. It uses **rrweb** for full DOM capture and **claude-haiku-4-5** to label each step in natural language. The result is a parameterised prompt template with named input variables.

| Claude in Chrome Teach-Me | r4mi-ai Target |
|---|---|
| User decides when to record | System detects repetition proactively, then invites recording |
| Single-site macro replay | Site-agnostic spec that reasons about intent, not just clicks |
| Parameterised prompt template | Structured `NarrowAgentSpec` with typed `action_sequence` |
| No marketplace / no prior art search | MarketMatcher checks for existing agents before building |
| rrweb full DOM capture always-on | Lightweight observation mode + rich teach-me mode |
| Speech narration as primary intent signal | Gemini Vision knowledge-source extraction per screen |
| Haiku step labels per interaction | Step descriptions generated per UIEvent in teach-me mode |
| `element_context` from real DOM | `element_context` captured via `capture.js` DOM extraction |

### 1.3 Passive Observation is Primary

Passive observation is the default, always-on mode. The system watches every session without any worker action and surfaces opportunities autonomously. This is the primary detection path — it requires zero behavioural change from the worker.

Teach-me mode is a secondary accelerant. It exists for two cases:
1. **Step-level correction** — worker clicks "Show me" to demonstrate the correct behaviour for a specific step in an already-detected pattern.
2. **Standalone proactive capture** — worker knows they will repeat a workflow and wants to build an agent before the system has seen three sessions.

Both paths feed the same funnel (`NarrowAgentSpec` → `MarketMatcher` → Agentverse). The distinction is only in data richness: observation mode uses lightweight events; teach-me mode uses `element_context`, per-interaction screenshots, and `step_description` labels.

> **This principle is permanent.** Future implementations must not require workers to initiate recording as a prerequisite for automation. The system finds them; they do not go looking.

### 1.4 Trust Level is Emergent, Not Assigned

All agents run through the same always-on HITL tab-approval-progression. Trust level is a statistical badge reflecting how large a batch the agent has earned the right to fill without triggering a correction gate.

**The model:**
- New agent: batch size = 1 field per gate
- As correction rate drops below `TRUST_PROMOTION_MAX_FAILURE_RATE` → batch size increases
- If a batch causes divergence → batch size shrinks; divergence point becomes the precise gate boundary
- "AUTONOMOUS" = batch size covers the whole workflow with a single end gate — earned, never assigned

**The HITL tab-approval-progression flow (always-on, every agent, every run):**
1. Agent populates field(s) in the current batch directly in the host UI → pauses at a gate
2. User tabs through filled fields, approves or edits each inline in the real form
3. If a correction is made → optional popup "What was wrong? (optional)" — skippable
4. Correction + optional reason logged to `AgentCorrection` table
5. After 3+ corrections to the same field across runs → spec improvement suggestion surfaces in sidebar
6. Agent proceeds to next batch

> `TrustLevel` enum stays for display. It must not drive behavioral branching.

---

## 2. Architecture Plan

### 2.1 Sidebar as Primary UI Surface

r4mi's UI is a collapsible sidebar panel injected into the host page by `r4mi-loader.js`. The sidebar runs as a cross-origin iframe embedding the sidebar React app (built separately from any host app). It communicates with the host page via `postMessage`.

**The sidebar contains:**
- Chat message thread — all system notifications, presentation steps, agent run summaries
- Record button — enters teach-me mode
- Agents drawer — Agentverse marketplace accessible from header

**The host page is untouched except:**
- `capture.js` observing DOM events and POSTing UIEvents
- Agent population writing values into real form fields (via `postMessage` to `capture.js`)
- Tab-progression gates rendering inline within the actual form (lightweight DOM overlay per field)

The sidebar never reproduces the host UI. All agent interaction — population, verification, correction — happens inside the real form. The sidebar is the observer and communicator; the host page is the execution surface.

### 2.2 Sidebar–Host Communication Protocol

```
Sidebar iframe  ←──postMessage──→  r4mi-loader.js  ←──direct DOM──→  Host page
```

| Message type | Direction | Purpose |
|---|---|---|
| `r4mi:opened` | loader → sidebar | Sidebar became visible |
| `r4mi:close` | sidebar → loader | User clicked close |
| `r4mi:set-session` | sidebar → loader | Begin/end capture session with sessionId |
| `r4mi:populate` | sidebar → loader | Fill field `{ selector, value }` in host form |
| `r4mi:gate` | sidebar → loader | Render approval gate overlay on a field |
| `r4mi:gate-response` | loader → sidebar | User approved or corrected a gate |
| `r4mi:event` | loader → sidebar | UIEvent captured from host DOM |

### 2.3 Two-Mode Capture

The most important structural separation: two distinct capture modes with different data richness.

| Observation Mode (passive, always-on) | Teach-Me Mode (active, on invitation) |
|---|---|
| Lightweight — minimal overhead on worker | Rich — full context per interaction |
| UIEvent: 5 event types, `screen_name`, selector, value | UIEvent: + `element_context`, step screenshot, `step_description` |
| Screenshot only on `screen_switch` | Screenshot on every meaningful interaction |
| No per-step LLM calls | Gemini Flash call per step — generates natural language label |
| Purpose: detect repetition via embedding similarity | Purpose: build a high-quality NarrowAgentSpec |
| Input to PatternDetector + MarketMatcher | Input to SpecBuilderAgent |
| Captures: *is this the same workflow again?* | Captures: *what exactly was the worker deciding and why?* |

Teach-me mode is activated by the Record button in the sidebar header. While recording, the user optionally narrates each step by voice (Web Speech API in `capture.js`) — narration is transcribed and stored as `step_description`, achieving parity with Claude in Chrome's voice narration model.

### 2.4 Enhanced UIEvent Model

The UIEvent model carries an optional `element_context` block and a `capture_mode` flag. Observation mode leaves new fields null; teach-me mode populates them from the real DOM.

| Field | Obs. Mode | Teach-Me Mode | Notes |
|---|---|---|---|
| `session_id` | required | required | No change |
| `user_id` | required | required | No change |
| `event_type` | required | required | Enum: `click`, `navigate`, `input`, `screen_switch`, `submit`, `hover`, `scroll`, `copy` |
| `screen_name` | required | derived | Teach-me derives from URL + ARIA landmark |
| `element_selector` | required | required | CSS selector string |
| `element_value` | optional | required | Input value, selected option, etc. |
| `element_context` | null | **required** | `{ label, role, text, position, landmark }` |
| `screenshot_b64` | screen_switch only | **required** | Per meaningful interaction |
| `step_description` | null | **required** | Voice transcription or Gemini-generated label |
| `is_input_variable` | null | **required** | `true` = value varies per case; `false` = constant |
| `capture_mode` | `obs` | `teach` | Enum: `obs \| teach` |
| `permit_type` | required | required | Still required in both modes |
| `backend_call` | optional | optional | No change |

### 2.5 Market-First Detection Flow

When a pattern is detected, MarketMatcher runs immediately before any build path is taken.

| # | Actor | Action |
|---|---|---|
| 1 | PatternDetector | Session completes. Embeds trace with `text-embedding-004`. Cosine similarity ≥ 0.85 for N-1 prior sessions → `state = READY`. |
| 2 | **MarketMatcher** | **Immediately checks published NarrowAgentSpecs for a match ≥ 0.85 using the current session's trace embedding.** |
| 3a | SSE Bus | **Match found → fire `AGENT_MATCH_FOUND` with `{ matched_spec_id, score, name, trust_level }`.** |
| 3b | SSE Bus | No match → fire `OPTIMIZATION_OPPORTUNITY`. Simultaneously kick off SpecBuilderAgent as background task. |
| 4a | Sidebar | **Adopt path:** notification card showing agent name, trust badge, match score. |
| 4b | Sidebar | **Build path:** notification card showing "repeating pattern detected." Draft spec pre-generated in background. |

### 2.6 Pre-Generation at Detection Time

The spec must be ready before the user opens the sidebar panel. When `OPTIMIZATION_OPPORTUNITY` fires, SpecBuilderAgent runs as an `asyncio` background task and stores the draft in `SessionRecord.candidate_spec_draft`. When the sidebar's build flow begins, the draft is immediately available — no loading spinner.

```python
# pattern_detector.py — when READY, no market match
asyncio.create_task(_pre_generate_spec(session, all_matching_sessions, db))
```

### 2.7 Sidebar Optimization Presentation Flow

When the user clicks the notification in the sidebar, the flow proceeds as a chat-style presentation:

**Adopt path (existing agent found):**
1. Sidebar shows adopt card: agent name, trust badge, run count, match score
2. User clicks "Activate Agent"
3. Sidebar narrates: "Running [agent name] on this case..."
4. Agent populates real host form fields one batch at a time
5. Sidebar shows gate prompt; user tabs through fields in the real form to verify
6. Sidebar confirms run complete

**Build path (no existing agent):**
1. Sidebar shows notification: "I've seen this workflow N times."
2. User clicks "Review"
3. Sidebar shows pre-generated spec summary: action sequence steps, knowledge sources
4. Sidebar animates a replay preview inline (step-by-step descriptions with source tags)
5. User can type a correction in sidebar chat input or click "Show me" for teach-me correction
6. After confirmation, user clicks "Publish"
7. Agent published to Agentverse; sidebar confirms with agent card

### 2.8 Step Description Generation

After each UIEvent in teach-me mode, Gemini generates a one-line natural language description:

```
screen: {screen_name}  element: {label} ({role})
action: {event_type}  value: {element_value}

Write one plain-English sentence describing what the worker just did and why. Max 15 words. No jargon.
```

The generated label is stored in `UIEvent.step_description` and passed to SpecBuilderAgent. A `STEP_LABEL_MODE=realtime|batch` config flag controls whether labels are generated inline or deferred to session end.

### 2.9 SpecBuilderAgent Prompt Enhancement

SpecBuilderAgent receives labelled steps with causal knowledge source threading: for each step, the prompt includes which knowledge source the worker was consulting and how it informed the field value.

> **Example:** "At step 5 (entered zone code R-2), the worker had just read PDF §14.3 which states that R-2 zones permit fences up to 6ft."

This causal link is r4mi's structural advantage over macro recorders: it captures *why* the value was chosen, not just *what* was clicked.

---

## 3. Implementation Plan

Each initiative is independently testable. The existing E2E suite must remain green after every item.

| Initiative | Priority | Effort | Key Files |
|---|---|---|---|
| Sidebar SSE → chat presentation (adopt + build paths) | **P0** | M (1d) | `sidebar/SidebarApp.tsx`, `sidebar/hooks/useSidebarSSE.ts` |
| Adopt-path card with Activate + Fork CTAs | **P0** | S (0.5d) | `sidebar/components/ChatMessage.tsx` |
| Sidebar replay preview (step-by-step with source tags) | **P0** | M (1d) | `sidebar/components/ReplayPreview.tsx` (new) |
| Host UI field population via postMessage | **P0** | M (1d) | `frontend/public/r4mi-loader.js`, `capture.js` |
| Tab-progression gate overlay on host form fields | **P0** | M (1d) | `frontend/public/r4mi-loader.js` |
| Voice narration in teach-me mode (Web Speech API) | P1 | M (1d) | `frontend/public/capture.js` |
| Step description generation (Gemini per teach event) | P1 | S | `services/step_labeller.py` ✅ already built |
| Thread knowledge sources into SpecBuilderAgent prompt | P1 | S | `agents/spec_builder_agent.py` ✅ already built |
| AGENT_MATCH_FOUND SSE → sidebar adopt notification | P1 | S | `sidebar/hooks/useSidebarSSE.ts` ✅ partial |
| Sidebar correction input → spec regeneration | P1 | S | `sidebar/SidebarApp.tsx` — extend handleAction |
| NPM package wrapper (`@r4mi/capture`) | P2 | M (1d) | New: `capture-pkg/` |
| Derive `screen_name` from URL + ARIA landmarks | P2 | S | `frontend/public/capture.js` ✅ already built |
| JS capture: `element_context` from real DOM | P2 | S | `frontend/public/capture.js` ✅ already built |

### Already Built (Backend — No Changes Required)

All backend P0/P1 items from the previous sprint are complete and correct:

- ✅ `UIEvent` model: `element_context`, `capture_mode`, `is_input_variable`, `step_description`, extended event types
- ✅ `SSEEventType.AGENT_MATCH_FOUND` in `models/event.py`
- ✅ MarketMatcher called at READY in `pattern_detector.py`
- ✅ Pre-generation background task in `pattern_detector.py`
- ✅ `SessionRecord.candidate_spec_draft` in `models/session.py`
- ✅ Causal knowledge source threading in `spec_builder_agent.py`
- ✅ `step_labeller.py` with `STEP_LABEL_MODE` config
- ✅ `capture.js` — real DOM extraction, site-agnostic, served from `frontend/public/`
- ✅ `r4mi.store.ts` — `matchedAgent`, `matchScore`, `AGENT_MATCH_FOUND` handler

### Current Frontend Gap

The sidebar exists and handles basic SSE events, but the following are not yet built:
- Replay preview component (step-by-step with source tags, inside sidebar)
- Host UI field population (sidebar → postMessage → loader → DOM write)
- Tab-progression gate overlay (inline per field in real host form)
- Voice narration wiring in `capture.js`
- Full adopt-path card with Activate Agent / Fork & Customise CTAs

---

## 4. Example Workflows

### 4.1 Scenario A — Adopt Path (Existing Agent Found)

**Context:** Maria is a permit technician. She has just completed her third fence variance application in two weeks. An agent for this workflow was published by her colleague two months ago.

| # | Actor | Action |
|---|---|---|
| 1 | Maria | Opens PRM-2024-0043. Works normally: Inbox → GIS Lookup → Policy Reference → Application Form. Fills zone code, max height, notes. Clicks Submit. |
| 2 | Backend | PatternDetector embeds trace. Cosine: 0.93 vs session_001, 0.91 vs session_002. State = READY. MarketMatcher finds "Fence Variance — R-2 Zone Check" at 0.94. Fires `AGENT_MATCH_FOUND`. |
| 3 | Sidebar | Notification appears in sidebar chat: "Found matching agent: Fence Variance — R-2 Zone Check (94% match)". Maria finishes her current thought. |
| 4 | Maria | Glances at sidebar. Clicks notification. |
| 5 | Sidebar | Adopt card appears: agent name, SUPERVISED badge, "47 successful runs", "94% match". Two buttons: "Activate Agent" and "Fork & Customise". |
| 6 | Maria | Clicks "Activate Agent". |
| 7 | Sidebar / Host UI | Sidebar narrates: "Running Fence Variance agent on PRM-2024-0043..." Agent populates real form fields: zone=R-2, max-height=6ft, notes prefilled. Source tags annotate each field. |
| 8 | Sidebar | Gate appears: "Review filled fields — tab through to confirm." |
| 9 | Maria | Tabs through fields in the actual host form. All correct. Presses Enter to confirm. |
| 10 | Sidebar | Run confirmed. "Agent run complete — 3 fields processed." Maria continues her day. |
| 11 | Next visit | Maria lands on a fence variance permit. Same notification. One click. Fields auto-fill. Tab-verify. Done. |

> **Total friction:** one notification click + tab-through verification. Maria never leaves the host UI for more than a few seconds.

---

### 4.2 Scenario B — Build Path (No Existing Agent)

**Context:** James handles commercial signage permits. No agent exists yet. He has just completed his third signage permit this month.

| # | Actor | Action |
|---|---|---|
| 1 | James | Completes third commercial signage permit. Submits. |
| 2 | Backend | PatternDetector: similarity 0.89 + 0.91. READY. MarketMatcher: no match. Fires `OPTIMIZATION_OPPORTUNITY`. Background task kicks off SpecBuilderAgent immediately. |
| 3 | Backend | SpecBuilderAgent generates draft NarrowAgentSpec. Stores in `session.candidate_spec_draft`. Fires `SPEC_GENERATED` SSE. |
| 4 | Sidebar | Notification: "I've seen this workflow 3 times. I think I can help." |
| 5 | James | Clicks notification when ready. |
| 6 | Sidebar | Chat message: "Here's what I'd automate..." Draft spec displayed: 4 action steps, knowledge sources "Commercial Zone Map", "Sign Bylaw §8.2". |
| 7 | Sidebar | Replay preview animates: each step described in plain English with source tag. No loading spinner — spec was already built. |
| 8 | James | Sees knowledge source is wrong. Types in sidebar: "Use the GIS PDF, not the zone map wiki." |
| 9 | Backend | Correction appended to SpecBuilderAgent prompt. `gemini-2.5-flash` regenerates spec. `SPEC_UPDATED` SSE fires. |
| 10 | Sidebar | Updated spec shown inline. James clicks "Publish". |
| 11 | Backend | Spec embedded (`text-embedding-004`). Agent ID assigned. Trust: SUPERVISED. `AGENT_PUBLISHED` SSE fires. |
| 12 | Sidebar | "Agent published: Commercial Signage — Zone + Sign Check (SUPERVISED)." James continues his day. |
| 13 | Future | Next technician on this workflow → Scenario A. James's contribution is attributed. |

---

### 4.3 Scenario C — Teach-Me Mode (Step-Level Correction with Voice)

**Context:** Same as Scenario B, but James demonstrates the correct step rather than typing a text correction. This is the full teach-me experience with voice narration.

| # | Actor | Action |
|---|---|---|
| 1 | James | In sidebar, clicks "Show me" next to the incorrect knowledge source step. |
| 2 | Sidebar | Enters teach-me mode. Recording indicator appears in sidebar header. Prompt: "Navigate to the correct source for this step." |
| 3 | Host UI | `capture.js` switches to teach-me mode. Microphone activates (Web Speech API). James narrates as he works. |
| 4 | James | "I'm going to the GIS export..." — navigates to GIS PDF in host UI. Clicks the relevant parcel section. |
| 5 | Backend | Per-interaction screenshot sent to VisionService. `step_description` = "Navigated to GIS PDF export for parcel R2-0041." Logged to CLI panel. |
| 6 | James | Clicks "Confirm source" in sidebar. |
| 7 | Backend | VisionService confirms region: `source_type=pdf`, `confidence=0.96`. Teach-me session ends. Enriched events (with `step_descriptions` + `element_context`) passed to SpecBuilderAgent. |
| 8 | Sidebar | Updated spec shows corrected knowledge source: "GIS PDF — parcel export (conf 0.96)". James publishes. |

> **The teach-me advantage:** James narrated instead of typed. The system captured exactly which element he clicked, its DOM role and label, what Gemini Vision extracted from the screenshot, and generated a human-readable step label — automatically. r4mi also knows *why* the value was chosen from *which policy source*, which macro recorders cannot.

---

### 4.4 Scenario D — Standalone Proactive Teach-Me

**Context:** Ahmed is an experienced technician. He knows he'll repeat the same demolition permit workflow all month. He wants to build the agent now, before the system has seen three sessions.

| # | Actor | Action |
|---|---|---|
| 1 | Ahmed | Opens sidebar. Clicks Record button in header. |
| 2 | Sidebar | "Recording started. Work through the workflow. Click Stop when done." Microphone activates. |
| 3 | Ahmed | Works through demolition permit normally, narrating key decisions aloud. |
| 4 | capture.js | Sends rich UIEvents with `capture_mode=teach`, `element_context`, per-step screenshots, voice `step_descriptions`. |
| 5 | Ahmed | Clicks Stop. |
| 6 | Backend | Session finalized. SpecBuilderAgent builds spec from rich teach-me events. Fires `SPEC_GENERATED`. |
| 7 | Sidebar | Spec summary displayed. Ahmed reviews, publishes. Demolition permit agent live immediately — without waiting for three passive observations. |

---

## 5. Decisions

**Q1 — MarketMatcher similarity metric: trace-vs-spec ✓**
The adopt-path comparison runs the current session's trace embedding against published NarrowAgentSpec embeddings. Spec embeddings are computed at publish time. Trace-vs-spec answers "does this agent's stated capability cover what I just observed?" — the right question for the adopt path.

**Q2 — Trust levels and human confirmation ✓**
There is always a user-facing gate before automation executes — no silent autonomous mode. The distinction between trust levels is the *weight* of confirmation required:
- **SUPERVISED** (new agent, <10 runs): confirm each individual field batch as it fills
- **AUTONOMOUS** (proven agent, high success rate): single upfront prompt covering the whole workflow, then all fields fill in one pass

Color coding: orange badge for SUPERVISED, green for AUTONOMOUS.

**Q3 — Teach-me mode activation: both ✓**
1. **Correction flow** — "Show me" button on a specific step in sidebar for an already-detected pattern.
2. **Standalone record button** — proactive capture before three passive sessions.

**Q4 — Step labelling: real-time with voice ✓**
In teach-me mode, `step_description` comes from voice transcription first (Web Speech API), with Gemini Flash as fallback if no narration. A `STEP_LABEL_MODE=realtime|batch` flag switches between inline and deferred generation.

**Q5 — Demo capture strategy: `capture.js` script tag ✓**
Enterprise integration model: one script tag, one config attribute, zero changes to the host app. `capture.js` is a self-contained vanilla JS observer (~250 lines) that listens to real DOM events, extracts `element_context` from ARIA landmarks, and POSTs enriched UIEvents to `/api/observe`.

```html
<script src="/r4mi-loader.js" data-api="http://localhost:8000"></script>
```

**Q6 — Frontend architecture: sidebar, not overlay ✓**
All r4mi UI lives in the sidebar panel (iframe). The host UI is not modified with overlay components. Agent population and tab-progression gates are the only DOM interactions with the host page, and these happen via `r4mi-loader.js` postMessage relay — not via React components injected into the host.

**Q7 — NPM package as long-term integration target ✓**
The dream integration: `npm install @r4mi/capture` (or `npx r4mi-ai init`). This wraps `capture.js` + `r4mi-loader.js` as a package a site administrator deploys in one command. No code changes to the host application. The script tag model and the npm model are the same underlying files — the package just manages versioning and delivery.

---

## 6. Enterprise Integration Model

r4mi-ai is designed as an enterprise product where the host application cooperates minimally with the observer. The cooperation surface is deliberately kept small.

**Integration surface:**
- Host includes `r4mi-loader.js` via a script tag (or npm package)
- Host exposes stable `data-field-id` attributes on automatable fields — these are the semantic field identities (`zone_classification`, `max_permitted_height`)
- No other host-side code is required

**What r4mi does not require from the host:**
- No host-specific constants in r4mi code
- No API cooperation from the host application
- No browser extension or IT approval beyond script deployment

**What r4mi derives automatically from the host DOM:**
- `screen_name` — from URL + document title + ARIA landmarks
- `element_context` — from ARIA labels, roles, landmark regions, element position
- Navigation events — from `popstate`, `hashchange`, History API

**Agent portability:**
- Agents reference semantic field identities, not CSS selectors
- An agent built on one deployment can be matched and adopted by another deployment of the same workflow type
- MarketMatcher operates on embedding similarity — no workflow-specific configuration needed

**Integration steps for a site administrator:**
```bash
# Option A — script tag (any web app)
<script src="https://cdn.r4mi.ai/loader.js" data-api="https://your-r4mi-instance.com"></script>

# Option B — npm (Node-based apps)
npm install @r4mi/capture
# then in your app entry point:
import '@r4mi/capture'   # self-initialising, reads data-r4mi-api attribute from <script> tag

# Option C — npx one-liner (future target)
npx r4mi-ai init         # downloads loader, adds script tag to index.html, sets up .env
```

The goal: a site administrator with no r4mi expertise can have the system running in under five minutes.
