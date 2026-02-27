from __future__ import annotations

import json
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel
from sqlmodel import Column, Field, SQLModel

try:
    from sqlalchemy import JSON as SA_JSON
except ImportError:
    from sqlmodel import JSON as SA_JSON


class TrustLevel(str, Enum):
    SUPERVISED = "supervised"
    AUTONOMOUS = "autonomous"
    STALE = "stale"


class Contribution(BaseModel):
    user_id: str
    score: float  # 0.0–1.0, proportional to code delta


class NarrowAgentSpec(SQLModel, table=True):
    __tablename__ = "narrowagentspec"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str
    description: str
    # JSON columns: stored as TEXT in SQLite
    trigger_pattern: Optional[str] = Field(default="{}", description="JSON string")
    action_sequence: Optional[str] = Field(default="[]", description="JSON string")
    knowledge_sources: Optional[str] = Field(default="[]", description="JSON string")
    contributions: Optional[str] = Field(default="[]", description="JSON string")
    embedding: Optional[str] = Field(default="[]", description="JSON string — float array for cosine sim")
    trust_level: TrustLevel = TrustLevel.SUPERVISED
    successful_runs: int = 0
    failed_runs: int = 0
    parent_id: Optional[str] = None  # set when this spec is a fork of another
    permit_type: Optional[str] = None  # e.g. "fence_variance_r2"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # --- helpers to work with JSON fields as Python objects ---

    def get_trigger_pattern(self) -> dict:
        return json.loads(self.trigger_pattern or "{}")

    def set_trigger_pattern(self, value: dict) -> None:
        self.trigger_pattern = json.dumps(value)

    def get_action_sequence(self) -> list:
        return json.loads(self.action_sequence or "[]")

    def set_action_sequence(self, value: list) -> None:
        self.action_sequence = json.dumps(value)

    def get_knowledge_sources(self) -> list:
        return json.loads(self.knowledge_sources or "[]")

    def set_knowledge_sources(self, value: list) -> None:
        self.knowledge_sources = json.dumps(value)

    def get_contributions(self) -> list[dict]:
        return json.loads(self.contributions or "[]")

    def set_contributions(self, value: list) -> None:
        self.contributions = json.dumps(value)

    def get_embedding(self) -> list[float]:
        return json.loads(self.embedding or "[]")

    def set_embedding(self, value: list[float]) -> None:
        self.embedding = json.dumps(value)

    @property
    def total_runs(self) -> int:
        return self.successful_runs + self.failed_runs

    @property
    def failure_rate(self) -> float:
        return self.failed_runs / self.total_runs if self.total_runs > 0 else 0.0

    def to_dict(self) -> dict:
        """Return a dict with JSON fields already parsed (for API responses)."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "trigger_pattern": self.get_trigger_pattern(),
            "action_sequence": self.get_action_sequence(),
            "knowledge_sources": self.get_knowledge_sources(),
            "contributions": self.get_contributions(),
            "trust_level": self.trust_level,
            "successful_runs": self.successful_runs,
            "failed_runs": self.failed_runs,
            "parent_id": self.parent_id,
            "permit_type": self.permit_type,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
