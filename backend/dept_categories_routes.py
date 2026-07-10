"""
Department Categories & Statuses routes.

Allows admins to define a list of categories per department (e.g. Website →
Wireframe, UI, Content, Development, Testing). These categories are then used
when creating tasks within a project so each task is tagged to a specific
department & category.

Also allows admins to define a list of custom project-status values per
department (e.g. Website → Project Onboarded, Developing, Paused, Delivered,
Refunded). These feed the Status dropdown on projects linked to that
department (see projects_routes.py).

Storage: collection `department_categories`, one document per dept_key —
categories and statuses are separate fields on the same document.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone

dept_categories_router = APIRouter(prefix="/department-categories", tags=["department-categories"])
dept_statuses_router = APIRouter(prefix="/department-statuses", tags=["department-statuses"])

DEFAULT_DEPARTMENTS = [
    {"key": "website",      "label": "Website"},
    {"key": "social_media", "label": "Social Media"},
    {"key": "meta",         "label": "Meta Ads"},
    {"key": "seo",          "label": "SEO"},
    {"key": "finance",      "label": "Finance"},
    {"key": "hr",           "label": "HR"},
    {"key": "business_dev", "label": "Business Dev"},
    {"key": "erp",          "label": "ERP"},
]


class CategoriesPayload(BaseModel):
    categories: List[str] = []


@dept_categories_router.get("")
async def list_department_categories(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    docs = await db.department_categories.find({}, {"_id": 0}).to_list(50)
    by_key = {d["dept_key"]: d for d in docs}
    result = []
    for d in DEFAULT_DEPARTMENTS:
        doc = by_key.get(d["key"])
        result.append({
            "dept_key": d["key"],
            "label": d["label"],
            "categories": (doc.get("categories") if doc else []) or [],
        })
    return result


@dept_categories_router.put("/{dept_key}")
async def update_department_categories(dept_key: str, payload: CategoriesPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if dept_key not in {d["key"] for d in DEFAULT_DEPARTMENTS}:
        raise HTTPException(status_code=400, detail=f"Unknown department: {dept_key}")
    # Normalise — dedupe, strip, drop empties
    seen = []
    for c in (payload.categories or []):
        c = (c or "").strip()
        if c and c not in seen:
            seen.append(c)

    await db.department_categories.update_one(
        {"dept_key": dept_key},
        {"$set": {
            "dept_key": dept_key,
            "categories": seen,
            "updated_by": user.user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"dept_key": dept_key, "categories": seen}


class StatusesPayload(BaseModel):
    statuses: List[str] = []


@dept_statuses_router.get("")
async def list_department_statuses(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    docs = await db.department_categories.find({}, {"_id": 0}).to_list(50)
    by_key = {d["dept_key"]: d for d in docs}
    result = []
    for d in DEFAULT_DEPARTMENTS:
        doc = by_key.get(d["key"])
        result.append({
            "dept_key": d["key"],
            "label": d["label"],
            "statuses": (doc.get("statuses") if doc else []) or [],
        })
    return result


@dept_statuses_router.put("/{dept_key}")
async def update_department_statuses(dept_key: str, payload: StatusesPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if dept_key not in {d["key"] for d in DEFAULT_DEPARTMENTS}:
        raise HTTPException(status_code=400, detail=f"Unknown department: {dept_key}")
    # Normalise — dedupe, strip, drop empties
    seen = []
    for s in (payload.statuses or []):
        s = (s or "").strip()
        if s and s not in seen:
            seen.append(s)

    await db.department_categories.update_one(
        {"dept_key": dept_key},
        {"$set": {
            "dept_key": dept_key,
            "statuses": seen,
            "updated_by": user.user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"dept_key": dept_key, "statuses": seen}
