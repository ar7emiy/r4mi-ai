from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel, JSON, Column


class PatternState(str, Enum):
    IDLE        = "IDLE"
    COLLECTING  = "COLLECTING"
    FINGERPRINTING = "FINGERPRINTING"
    COMPARING   = "COMPARING"
    CANDIDATE   = "CANDIDATE"
    CONFIRMING  = "CONFIRMING"
    READY       = "READY"
    REPLAYING   = "REPLAYING"
    BUILDING    = "BUILDING"
    PUBLISHED   = "PUBLISHED"


class SessionRecord(SQLModel, table=True):
    __tablename__ = "sessions"

    session_id: str = Field(primary_key=True)
    user_id: str
    permit_type: str
    state: PatternState = PatternState.COLLECTING
    events: list = Field(default_factory=list, sa_column=Column(JSON))
    embedding: Optional[list] = Field(default=None, sa_column=Column(JSON))
    knowledge_sources: list = Field(default_factory=list, sa_column=Column(JSON))
    confirmed_sequence: Optional[list] = Field(default=None, sa_column=Column(JSON))
    confirmed_sources: Optional[list] = Field(default=None, sa_column=Column(JSON))
    generated_spec_id: Optional[str] = None
    matched_spec_id: Optional[str] = None  # set when AGENT_MATCH_FOUND fires
    candidate_spec_draft: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    is_seeded: bool = False
