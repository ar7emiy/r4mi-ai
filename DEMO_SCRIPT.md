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
- r4mi sidebar visible on the right, showing an empty chat thread

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
Immediately after submitting, a notification appears in the r4mi sidebar. It doesn't
interrupt. The operator is free to keep working.

**Actions:**
1. Sidebar chat shows a notification message: "I've seen this workflow 3 times. I think I can help."
2. Operator pauses, glances at sidebar
3. Clicks the notification / "Review" button

**UI requirements for this beat:**
- Sidebar notification must appear without any modal, alert, or popup on the host page
- The host page is untouched — only the sidebar chat thread updates
- Notification shows match count and a brief description of the detected pattern
- "Review" button or clickable notification opens the build/adopt flow within the sidebar

---

## Beat 3 — The Replay (0:55–1:25)

**What the viewer sees:**
The sidebar presents a short summary then a step-by-step preview of what the agent
would do. The actual host form fields fill automatically.

**Actions:**
1. Sidebar shows a summary chat message: "You navigated 5 screens. Here's the distilled version:"
2. Sidebar replay preview animates step descriptions one by one:
   - "Fetching zone classification from GIS API... R-2" (source tag: "from GIS API")
   - "Looking up max height from PDF §14.3... 6 ft" (source tag: "from PDF §14.3")
   - "Generating decision notes..."
3. Simultaneously, host form fields fill with typing animation
4. Sidebar confirms: "3 screens → 1 screen. Same result."

**UI requirements for this beat:**
- Replay preview is inside the sidebar (step descriptions + source tags), not a reproduced form
- Actual field population happens in the real host form via postMessage relay
- Each field fill animates with a typing effect
- Source tags visible on each auto-filled field in the host form
- Replay speed: comfortable to watch, ~2 seconds per field

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
- Correction text input is the sidebar chat input (multiline)
- "Show me" button appears in the sidebar on the relevant step card
- In teach-me mode: a subtle banner on the host page: "r4mi-ai is watching — navigate to the correct source" (injected by r4mi-loader.js, not a React overlay component)
- Policy Reference screen must have both a Wiki tab and a PDF Viewer tab
- Clicking a paragraph in PDF Viewer while in teach-me mode registers it as a source (capture.js intercepts the click)
- After demonstration: sidebar confirms "Source updated: PDF §14.3 (Page 4)"

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
- Spec summary is displayed as a chat message in the sidebar — human-readable, no raw JSON
- Publish button is prominent, green, inside the sidebar
- After publish: sidebar shows agent card confirmation ("Agent published: Fence Variance — R-2 Zone Check")

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
- Auto-fill animates with typing effect in the real host form (not instant)
- Source tags visible on each auto-filled field in the host form
- Sidebar shows agent run status: "Running Fence Variance agent..." then "Run complete — 3 fields processed"

---

## Beat 7 — The Agentverse (2:50–3:00)

**What the viewer sees:**
A brief cut to the Agentverse panel showing the published agent with its metadata.

**Actions:**
1. Click "Agents" button in sidebar header
2. Agentverse drawer opens showing the published agent card:
   - Name: "Fence Variance — R-2 Zone Check"
   - Author: current user
   - Trust Level: Supervised
   - Successful Runs: 1
   - Contribution: 100%
3. End screen / logo

**UI requirements for this beat:**
- Agentverse is a drawer inside the sidebar (not a separate page or overlay)
- Agent cards: name, author, trust badge, run count, contribution %
- Trust badge colors: Supervised = orange, Autonomous = green, Stale = red

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

## What This Demo Proves

1. The system observes without interrupting
2. It distills — not just replays — meaning it found a shorter path
3. The expert's correction is captured and applied — human stays in control
4. The published agent immediately works on the next real permit
5. The agentverse is a real artifact — agents accumulate and are attributed

These are the five claims the system needs to prove in 3 minutes.
Every component should serve one of these five claims or it shouldn't be built.
