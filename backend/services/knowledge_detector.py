"""Decide when an event represents a knowledge-consumption moment worth
sending to Vision.

Replaces the previous hardcoded `screen_name in (POLICY_REFERENCE,
CODE_ENFORCEMENT)` check in observer_agent. Site-agnostic: triggers Vision
on generic interaction signals — screen switches into content-heavy
regions, long hovers, text selections, and scroll stalls — rather than a
permit-specific allowlist of screen names.

Vision invocations are budgeted per-session to keep cost predictable on
verbose hosts.
"""
from __future__ import annotations
import os
from typing import Optional

from sqlmodel import Session

from models.event import UIEvent, KnowledgeSource
from models.session import SessionRecord
from services.vision_service import vision_service
from services.log_streamer import logger

VISION_PER_SESSION_BUDGET = int(os.getenv("VISION_PER_SESSION_BUDGET", "8"))

# Triggering event types — site-agnostic. capture.js fires these on rich
# interaction signals (see frontend/public/capture.js).
KNOWLEDGE_EVENT_TYPES = {"screen_switch", "dwell", "selection", "scroll"}


def _budget_remaining(session: SessionRecord) -> int:
    used = len(session.knowledge_sources or [])
    return max(0, VISION_PER_SESSION_BUDGET - used)


class KnowledgeDetector:
    async def process_event(
        self,
        event: UIEvent,
        session: SessionRecord,
        db: Session,
    ) -> Optional[list[KnowledgeSource]]:
        """If the event is a knowledge-consumption signal with a screenshot,
        invoke Vision and persist the extracted sources on the session.
        Returns the new sources (or None if no extraction happened).
        """
        if event.event_type not in KNOWLEDGE_EVENT_TYPES:
            return None
        if not event.screenshot_b64:
            return None
        if _budget_remaining(session) <= 0:
            logger.info(
                f"[KnowledgeDetector] Vision budget exhausted for session "
                f"{session.session_id} ({VISION_PER_SESSION_BUDGET})"
            )
            return None

        # Vision service caches per (session_id, screen_name) — repeated
        # signals on the same screen are cheap.
        sources = await vision_service.extract_knowledge_sources(
            screenshot_b64=event.screenshot_b64,
            screen_name=event.screen_name,
            session_id=event.session_id,
        )
        if not sources:
            return None

        existing = list(session.knowledge_sources or [])
        for s in sources:
            existing.append(s.model_dump())
        session.knowledge_sources = existing
        db.add(session)
        db.commit()
        return sources


knowledge_detector = KnowledgeDetector()
