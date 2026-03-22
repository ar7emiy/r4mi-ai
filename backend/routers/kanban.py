from __future__ import annotations
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/kanban", tags=["kanban"])

KANBAN_FILE = Path(__file__).parent.parent / "seed" / "kanban.json"


@router.get("")
def get_kanban():
    if not KANBAN_FILE.exists():
        raise HTTPException(status_code=404, detail="kanban.json not found")
    return json.loads(KANBAN_FILE.read_text(encoding="utf-8"))
