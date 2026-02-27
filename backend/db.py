from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Generator

from dotenv import load_dotenv
from sqlmodel import Session, SQLModel, create_engine

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./r4mi.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # needed for SQLite
    echo=False,
)


def create_db_and_tables() -> None:
    """Create all SQLModel tables. Called on app startup."""
    SQLModel.metadata.create_all(engine)


@contextmanager
def get_db() -> Generator[Session, None, None]:
    """Context-manager session dependency for use in routers and services."""
    with Session(engine) as session:
        yield session
