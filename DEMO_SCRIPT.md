# r4mi-ai — Demo Script (3 Minutes)

This is the exact sequence the demo video follows.
Every UI component must be built to serve a specific beat in this script.
Do not build features that don't appear here. Do not omit anything that does.

---

## Setup State (before recording starts)

- Backend running with `DEMO_SESSION_SEED=true`
- 2 prior sessions already seeded for Workflow 1 (Fence Variance)
- Agentverse is empty — no published agents yet
- Mock legacy UI open on Application Inbox screen
- Tab Progression Bar visible at bottom, showing "No active agents"

---

## Beat 1 — The Work (0:00–0:40)

**What the viewer sees:**
The operator (on screen, no face cam needed) is working in a visibly clunky
government-style permit system. The UI looks like it was built in 2008.

**Actions:**
1. Click application `PRM-2024-0041` (Margaret Hollis, fence variance) in inbox
2. Application form opens — several fields are empty, waiting to be filled
3. Navigate to GIS Parcel Lookup tab — type in parcel ID `R2-0041-BW`
4. GIS result loads — read zone classification "R-2" off the screen
5. Navigate back to Application Form — manually type "R-2" into zone field
6. Navigate to Policy Reference tab — scroll to find Section 14.3
7. Read the fence height rule — "shall not exceed six feet"
8. Navigate back to Application Form — type "6 ft" into Max Permitted Height field
9. Type decision notes: "Exceeds R-2 max by 1ft. Variance required per §14.3"
10. Hit Submit

**Voiceover (optional):** "I just processed a routine fence variance — the same
workflow I've done dozens of times this week."

**UI requirements for this beat:**
- Application Inbox with 5 permit applications listed
- Tabbed navigation between: Inbox / Application Form / GIS Lookup / Policy Reference / Code Enforcement / Owner Registry / Utilities
- GIS Lookup screen with parcel ID search field and result display
- Policy Reference screen showing actual §14.3 text, scrollable
- Application Form with all fields from Workflow 1
- Submit button that marks application as processed

---

## Beat 2 — The Detection (0:40–0:55)

**What the viewer sees:**
Immediately after submitting, a subtle notification appears in the Tab Progression
Bar at the bottom. It doesn't interrupt. It just glows.

**Actions:**
1. Tab Progression Bar notification appears: "🔍 Optimization opportunity detected"
2. Operator pauses, notices it
3. Clicks the notification tab

**UI requirements for this beat:**
- Tab Progression Bar must show a glowing/pulsing notification badge
- Notification must not be a modal, alert, or popup that interrupts the screen
- Clicking opens the Optimization Panel as a right-side drawer or bottom sheet
- Optimization Panel header: "r4mi-ai detected a repetitive workflow"
- Subtext: "I've seen this pattern 3 times. Here's what I observed."

---

## Beat 3 — The Replay (0:55–1:25)

**What the viewer sees:**
The system plays back a distilled version of the workflow — fewer steps than what
the operator just did. The operator watches it happen automatically.

**Actions:**
1. Optimization Panel shows: "You completed this in 5 screens. Here's the distilled version:"
2. Agent demo begins — animated replay showing:
   - Form field "Zone" auto-populated (no GIS navigation)
   - Form field "Max Permitted Height" auto-populated (no policy navigation)
   - Decision note auto-generated
3. Replay completes. Panel shows: "3 screens → 1 screen. Same result."
4. Below: two confirmation prompts visible

**UI requirements for this beat:**
- Replay must visually show form fields being filled one by one with a typing animation
- Each field fill should show a small source tag: e.g. "from GIS API" / "from §14.3"
- Replay speed: comfortable to watch, ~2 seconds per field
- After replay: show side-by-side "Your path: 5 screens" vs "Agent path: 1 screen"

---

## Beat 4 — The Correction (1:25–2:00)

**What the viewer sees:**
The operator spots something wrong. The distilled version uses the wiki for the
policy lookup, but the operator knows the authoritative source is the PDF, not the wiki.

**Actions:**
1. Operator reads the source tags on the replay
2. Notices: "Policy Source: Internal Wiki §14.3"
3. Types into correction field: "The policy source should be the PDF document,
   not the wiki. The wiki is sometimes outdated."
4. Hits "Show me" button — system prompts: "Can you demonstrate the correct source?"
5. Operator navigates to Policy Reference tab, scrolls to the PDF viewer section
   (not the wiki text), clicks the relevant paragraph
6. Returns to Optimization Panel — system shows updated replay with corrected source tag
7. Operator confirms: "Yes, that's correct"

**UI requirements for this beat:**
- Correction text input field in Optimization Panel (multiline, min 3 rows)
- "Show me" button that puts the UI into "demonstration mode"
- In demonstration mode: a subtle red border around the screen + banner:
  "r4mi-ai is watching — navigate to the correct source"
- Policy Reference screen must have both a Wiki tab and a PDF Viewer tab
- Clicking a paragraph in PDF Viewer in demonstration mode registers it as a source
- After demonstration: system confirms "Source updated: PDF §14.3 (Page 4)"

---

## Beat 5 — Publish (2:00–2:25)

**What the viewer sees:**
The corrected agent spec is shown. The operator approves and publishes.

**Actions:**
1. Optimization Panel shows final spec summary:
   - Name: "Fence Variance — R-2 Zone Check"
   - Actions: 3 steps (load application → fetch zone from GIS → fetch height limit from PDF §14.3)
   - Knowledge sources: GIS API, PDF Policy Doc §14.3
2. Operator clicks "Publish to Agentverse"
3. Confirmation animation plays — agent card appears in agentverse

**UI requirements for this beat:**
- Spec summary must be human-readable — no raw JSON visible
- Publish button is prominent, green
- After publish: a brief "published" animation (card flies into agentverse panel)
- Tab Progression Bar updates: "1 agent active"

---

## Beat 6 — The Payoff (2:25–2:50)

**What the viewer sees:**
The operator opens the next permit in the inbox — a second fence variance.
This time, the agent handles it automatically.

**Actions:**
1. Operator clicks next application in inbox — another fence variance (`PRM-2024-0042`)
2. Application Form opens
3. Without any navigation, fields begin auto-filling:
   - Zone: "R-2" (populates automatically, source tag visible)
   - Max Permitted Height: "6 ft" (populates automatically)
   - Decision Notes: auto-generated
4. Tab Progression Bar shows: "✅ Agent: Fence Variance — completed"
5. Operator reviews, clicks Submit

**UI requirements for this beat:**
- Second application must be pre-seeded in the inbox
- Auto-fill must visually animate (not instant — typing effect)
- Source tags must be visible on each auto-filled field
- Tab Progression Bar updates in real time

---

## Beat 7 — The Agentverse (2:50–3:00)

**What the viewer sees:**
A brief cut to the Agentverse panel showing the published agent with its metadata.

**Actions:**
1. Click "Agentverse" tab in Tab Progression Bar
2. Agentverse panel shows the published agent card:
   - Name: "Fence Variance — R-2 Zone Check"
   - Author: current user
   - Trust Level: Supervised
   - Successful Runs: 1
   - Contribution: 100%
3. End screen / logo

**UI requirements for this beat:**
- Agentverse panel is a clean card grid (not a table)
- Each card shows: name, author, trust badge, run count, contribution %
- Trust badge colors: Supervised = yellow, Autonomous = green, Stale = red

---

## Total Runtime: ~3 minutes

| Beat | Content | Duration |
|------|---------|----------|
| 1 | The Work | 0:40 |
| 2 | The Detection | 0:15 |
| 3 | The Replay | 0:30 |
| 4 | The Correction | 0:35 |
| 5 | Publish | 0:25 |
| 6 | The Payoff | 0:25 |
| 7 | Agentverse | 0:10 |

---

## Scenario A — Adopt Path (Second Run, same permit type)

This scenario plays out automatically the second time the same permit type is submitted
**after** an agent has already been published (i.e. Beat 5 has completed).
No script change is needed — the system detects the published agent via MarketMatcher.

**Setup:**
- One run of Beats 1–5 has already completed — "Fence Variance — R-2 Zone Check" is published
- Operator opens a new fence variance application (`PRM-2024-0042`)

**What happens (no extra UI steps required):**
1. Operator works normally through the permit (Beat 1 actions repeat)
2. On submit, `pattern_detector` runs MarketMatcher at READY state
3. MarketMatcher finds the published spec — cosine similarity ≥ 0.85
4. Backend emits `AGENT_MATCH_FOUND` SSE event (not `OPTIMIZATION_OPPORTUNITY`)
5. Tab Progression Bar badge turns **green**: "We found an agent for this"
6. Operator clicks the badge — Optimization Panel opens in **adopt mode**:
   - Shows agent card: name, trust badge (orange = SUPERVISED), run count, match score
   - Two CTAs: **"Activate Agent"** (runs the agent immediately) | **"Fork & Customise"** (enters build path with pre-loaded spec)
7. Operator clicks "Activate Agent" — NarrowAgent executes, fields auto-fill (Beat 6 animation)
8. Tab Progression Bar: "✅ Agent: Fence Variance — completed"

**Key difference from build path:**
- No replay, no correction, no spec generation spinner — agent already exists
- `SPEC_GENERATED` SSE is never sent on the adopt path (no pre-generation needed)
- "Fork & Customise" is the escape hatch if the operator wants to tune the matched agent

**UI requirements specific to adopt path:**
- `OptimizationPanel` renders adopt card when `store.matchedAgent` is set
- Green badge in `TabProgressionBar` (distinct from indigo build-path badge)
- Trust badge colours: SUPERVISED = orange, AUTONOMOUS = green, STALE = grey
- Match score displayed as a percentage (e.g. "91% match")

---

## What This Demo Proves

1. The system observes without interrupting
2. It distills — not just replays — meaning it found a shorter path
3. The expert's correction is captured and applied — human stays in control
4. The published agent immediately works on the next real permit
5. The agentverse is a real artifact — agents accumulate and are attributed

These are the five claims the system needs to prove in 3 minutes.
Every component should serve one of these five claims or it shouldn't be built.
