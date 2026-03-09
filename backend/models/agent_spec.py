from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, SQLModel, JSON, Column
import sqlalchemy as sa


class TrustLevel(str, Enum):
    SUPERVISED = "supervised"
    AUTONOMOUS = "autonomous"
    STALE      = "stale"


class NarrowAgentSpec(SQLModel, table=True):
    __tablename__ = "narrow_agent_specs"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str
    description: str
    permit_type: str
    trigger_pattern: dict = Field(default_factory=dict, sa_column=Column(JSON))
    action_sequence: list = Field(default_factory=list, sa_column=Column(JSON))
    knowledge_sources: list = Field(default_factory=list, sa_column=Column(JSON))
    embedding: list = Field(default_factory=list, sa_column=Column(JSON))
    trust_level: TrustLevel = TrustLevel.SUPERVISED
    successful_runs: int = 0
    failed_runs: int = 0
    contributions: list = Field(default_factory=list, sa_column=Column(JSON))
    parent_spec_id: Optional[str] = None
    source_session_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
