from __future__ import annotations
import json
import pathlib
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

SEED = pathlib.Path(__file__).parent.parent / "seed"


SUBMITTED_APP_IDS = set()

# Runtime user-created applications (in-memory, not persisted across restarts)
USER_CREATED_APPS: list[dict] = []
_user_app_counter = 0


def _load(filename: str) -> dict | list:
    data = json.loads((SEED / filename).read_text())
    if filename == "applications.json" and isinstance(data, list):
        merged = list(data) + USER_CREATED_APPS
        for app in merged:
            if app["application_id"] in SUBMITTED_APP_IDS:
                app["status"] = "Submitted"
        return merged
    return data


@router.get("/api/stubs/applications")
def get_applications():
    return _load("applications.json")


@router.get("/api/stubs/applications/{application_id}")
def get_application(application_id: str):
    apps = _load("applications.json")
    app = next((a for a in apps if a["application_id"] == application_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


class NewApplicationRequest(BaseModel):
    applicant: str
    address: str
    permit_type: str
    request: str
    parcel_id: Optional[str] = None


@router.post("/api/stubs/applications")
def create_application(body: NewApplicationRequest):
    global _user_app_counter
    _user_app_counter += 1
    today = date.today().strftime("%Y-%m-%d")
    year = date.today().year
    app_number = 1000 + _user_app_counter
    app_id = f"PRM-{year}-{app_number:04d}"

    # Generate a parcel ID if not provided
    parcel_id = body.parcel_id or f"USR-{app_number}-XX"

    new_app = {
        "application_id": app_id,
        "applicant": body.applicant,
        "address": body.address,
        "parcel_id": parcel_id,
        "permit_type": body.permit_type,
        "request": body.request,
        "submitted": today,
        "status": "Pending Review",
    }
    USER_CREATED_APPS.append(new_app)
    return new_app


@router.post("/api/stubs/applications/{application_id}/submit")
def submit_application(application_id: str):
    SUBMITTED_APP_IDS.add(application_id)
    return {"status": "ok", "application_id": application_id}


@router.get("/api/stubs/gis/{parcel_id}")
def get_gis(parcel_id: str):
    data = _load("gis_results.json")
    result = data.get(parcel_id)
    if not result:
        # Return a generic response for user-created applications with unknown parcels
        return {
            "parcel_id": parcel_id,
            "zone_classification": "R-2",
            "zone_description": "Single Family Residential",
            "lot_size_sqft": None,
            "setback_rear_ft": 5,
            "year_built": None,
            "stories": None,
            "last_updated": date.today().strftime("%Y-%m-%d"),
            "_note": "Default zone — parcel not found in GIS registry",
        }
    return result


@router.get("/api/stubs/code-enforcement/{parcel_id}")
def get_code_enforcement(parcel_id: str):
    data = _load("code_enforcement.json")
    result = data.get(parcel_id)
    if not result:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return result


@router.get("/api/stubs/owner-registry/{parcel_id}")
def get_owner_registry(parcel_id: str):
    data = _load("owner_registry.json")
    result = data.get(parcel_id)
    if not result:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return result


@router.get("/api/stubs/hazmat/{parcel_id}")
def get_hazmat(parcel_id: str):
    data = _load("hazmat_registry.json")
    result = data.get(parcel_id)
    if not result:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return result


@router.get("/api/stubs/sewer/{block}")
def get_sewer(block: str):
    data = _load("sewer_capacity.json")
    result = data.get(block)
    if not result:
        raise HTTPException(status_code=404, detail="Block not found")
    return result


@router.get("/api/stubs/water/{block}")
def get_water(block: str):
    data = _load("water_capacity.json")
    result = data.get(block)
    if not result:
        raise HTTPException(status_code=404, detail="Block not found")
    return result


@router.get("/api/stubs/fee-schedules")
def get_fee_schedules():
    return _load("fee_schedules.json")


@router.get("/api/stubs/fee-schedules/{permit_type}")
def get_fee_schedule(permit_type: str):
    data = _load("fee_schedules.json")
    result = data.get(permit_type)
    if not result:
        raise HTTPException(status_code=404, detail="Fee schedule not found")
    return result


@router.get("/api/stubs/policy")
def get_policy():
    text = (SEED / "policy_sections.txt").read_text()
    sections = {}
    current_key = None
    current_lines = []
    for line in text.splitlines():
        if line.startswith("==== ") and line.endswith(" ===="):
            if current_key:
                sections[current_key] = "\n".join(current_lines).strip()
            current_key = line.strip("= ").replace(" — ", "_").lower().replace(" ", "_")
            current_lines = []
        else:
            current_lines.append(line)
    if current_key:
        sections[current_key] = "\n".join(current_lines).strip()
    return sections


@router.get("/api/stubs/policy/{section}")
def get_policy_section(section: str):
    policy = get_policy()
    # Try exact match then partial
    if section in policy:
        return {"section": section, "text": policy[section]}
    for key, text in policy.items():
        if section.lower() in key.lower():
            return {"section": key, "text": text}
    raise HTTPException(status_code=404, detail="Policy section not found")
