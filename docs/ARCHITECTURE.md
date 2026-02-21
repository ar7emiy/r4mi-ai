# Architecture (Hackathon Vertical Slice)

## Goal
Build a customer support UI navigator that observes repetitive human workflows and converts them into testable automation modules with human-in-the-loop approval.

## Core Flow
1. Observe support session behavior across CRM, billing admin, KB, and web search.
2. Detect repeatable automation opportunity.
3. Auto-navigate user to guided capture workspace.
4. Capture user behavior (events + screen context in production variant).
5. Generate AutomationSpec and ask only targeted gaps.
6. Human approval gate.
7. Build automation module.
8. Test and tune with SME feedback.
9. Promote to shadow mode and notify user.

## Components
- Frontend (`frontend/`): single-page operator UI for session simulation and workflow lifecycle.
- API (`backend/app/main.py`): workflow orchestration and state machine.
- Integrations (`backend/app/integrations/google_stack.py`): adapters for Gemini Live API, ADK, and Google Cloud services.

## Google Stack Mapping
- Gemini Live API: session-level multimodal observation.
- ADK: detector/spec-builder/module-builder agent orchestration.
- Cloud Run: deploy backend and UI.
- Firestore: persistent workflow state.
- Pub/Sub or Cloud Tasks: asynchronous build/test jobs.
- Workflows callbacks: human approval checkpoints.

## HITL Controls
- Gate 1: Spec approval before module build.
- Gate 2: Test/tuning signoff before promotion.
- Promotion starts as shadow mode.

## Metrics (for judging)
- Time to resolution reduction.
- Manual step reduction.
- Override rate during shadow mode.
- Test pass rate over module versions.
