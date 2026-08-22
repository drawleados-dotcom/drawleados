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

Departments themselves: the original 8 (Website, Social Media, Meta Ads,
SEO, Finance, HR, Business Dev, ERP) are "built-in" — their dept_key is
relied on throughout the rest of the app (task tagging, department-specific
project tabs, etc.), so they can be renamed but never deleted. Admins can
also add further custom departments (e.g. "Management"), which can be both
renamed and deleted since nothing elsewhere hardcodes their key.

Storage: collection `department_categories`, one document per dept_key —
categories, statuses, and (for renames/custom departments) label are all
fields on the same document.
"""
import re
import uuid
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
BUILTIN_KEYS = {d["key"] for d in DEFAULT_DEPARTMENTS}


def _slugify(label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
    return slug or f"dept_{uuid.uuid4().hex[:8]}"


async def _custom_dept_docs(db):
    """Non-built-in, non-deleted department_categories docs."""
    docs = await db.department_categories.find(
        {"dept_key": {"$nin": list(BUILTIN_KEYS)}, "is_deleted": {"$ne": True}}, {"_id": 0}
    ).to_list(200)
    return docs


async def _dept_key_exists(db, dept_key: str) -> bool:
    if dept_key in BUILTIN_KEYS:
        return True
    doc = await db.department_categories.find_one({"dept_key": dept_key, "is_deleted": {"$ne": True}})
    return doc is not None


class CategoriesPayload(BaseModel):
    categories: List[str] = []


@dept_categories_router.get("")
async def list_department_categories(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    docs = await db.department_categories.find({}, {"_id": 0}).to_list(200)
    by_key = {d["dept_key"]: d for d in docs}
    result = []
    for d in DEFAULT_DEPARTMENTS:
        doc = by_key.get(d["key"])
        result.append({
            "dept_key": d["key"],
            "label": (doc.get("label") if doc else None) or d["label"],
            "categories": (doc.get("categories") if doc else []) or [],
            "sub_departments": (doc.get("sub_departments") if doc else []) or [],
            "group": (doc.get("group") if doc else "") or "",
            "assigned_user_ids": (doc.get("assigned_user_ids") if doc else []) or [],
            "is_builtin": True,
        })
    for doc in await _custom_dept_docs(db):
        result.append({
            "dept_key": doc["dept_key"],
            "label": doc.get("label") or doc["dept_key"],
            "categories": doc.get("categories") or [],
            "sub_departments": doc.get("sub_departments") or [],
            "group": doc.get("group") or "",
            "assigned_user_ids": doc.get("assigned_user_ids") or [],
            "is_builtin": False,
        })
    return result


@dept_categories_router.put("/{dept_key}")
async def update_department_categories(dept_key: str, payload: CategoriesPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if not await _dept_key_exists(db, dept_key):
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
    docs = await db.department_categories.find({}, {"_id": 0}).to_list(200)
    by_key = {d["dept_key"]: d for d in docs}
    result = []
    for d in DEFAULT_DEPARTMENTS:
        doc = by_key.get(d["key"])
        result.append({
            "dept_key": d["key"],
            "label": (doc.get("label") if doc else None) or d["label"],
            "statuses": (doc.get("statuses") if doc else []) or [],
            "is_builtin": True,
        })
    for doc in await _custom_dept_docs(db):
        result.append({
            "dept_key": doc["dept_key"],
            "label": doc.get("label") or doc["dept_key"],
            "statuses": doc.get("statuses") or [],
            "is_builtin": False,
        })
    return result


@dept_statuses_router.put("/{dept_key}")
async def update_department_statuses(dept_key: str, payload: StatusesPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if not await _dept_key_exists(db, dept_key):
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


# ---------- Departments themselves: add / rename / delete ----------

class DepartmentCreate(BaseModel):
    label: str


@dept_categories_router.post("")
async def create_department(payload: DepartmentCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    label = (payload.label or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Department name is required")

    dept_key = _slugify(label)
    if await _dept_key_exists(db, dept_key):
        raise HTTPException(status_code=400, detail="A department with this name already exists")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "dept_key": dept_key,
        "label": label,
        "categories": [],
        "statuses": [],
        "is_deleted": False,
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.department_categories.update_one({"dept_key": dept_key}, {"$set": doc}, upsert=True)
    return {"dept_key": dept_key, "label": label, "categories": [], "statuses": [], "is_builtin": False}


class DepartmentRename(BaseModel):
    label: str


@dept_categories_router.put("/{dept_key}/label")
async def rename_department(dept_key: str, payload: DepartmentRename, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    label = (payload.label or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Department name is required")
    if not await _dept_key_exists(db, dept_key):
        raise HTTPException(status_code=404, detail="Department not found")

    await db.department_categories.update_one(
        {"dept_key": dept_key},
        {"$set": {
            "dept_key": dept_key,
            "label": label,
            "updated_by": user.user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"dept_key": dept_key, "label": label}


class DepartmentGroupPayload(BaseModel):
    group: str = ""  # '' | 'technology' | 'marketing'


@dept_categories_router.put("/{dept_key}/group")
async def set_department_group(dept_key: str, payload: DepartmentGroupPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    group = (payload.group or "").strip().lower()
    if group not in ("", "technology", "marketing"):
        raise HTTPException(status_code=400, detail="Group must be 'technology', 'marketing', or empty")
    if not await _dept_key_exists(db, dept_key):
        raise HTTPException(status_code=404, detail="Department not found")

    await db.department_categories.update_one(
        {"dept_key": dept_key},
        {"$set": {
            "dept_key": dept_key,
            "group": group,
            "updated_by": user.user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"dept_key": dept_key, "group": group}


class DepartmentTeamPayload(BaseModel):
    user_ids: List[str] = []


@dept_categories_router.put("/{dept_key}/team")
async def set_department_team(dept_key: str, payload: DepartmentTeamPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if not await _dept_key_exists(db, dept_key):
        raise HTTPException(status_code=404, detail="Department not found")
    user_ids = list(dict.fromkeys(payload.user_ids or []))  # dedupe, preserve order

    await db.department_categories.update_one(
        {"dept_key": dept_key},
        {"$set": {
            "dept_key": dept_key,
            "assigned_user_ids": user_ids,
            "updated_by": user.user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"dept_key": dept_key, "assigned_user_ids": user_ids}


@dept_categories_router.delete("/{dept_key}")
async def delete_department(dept_key: str, request: Request):
    """Soft-delete a custom department. Built-in departments (the original
    8) can never be deleted — their key is relied on throughout the rest of
    the app (task tagging, department-specific project tabs, etc.)."""
    from server import get_current_user, db
    user = await get_current_user(request)
    if dept_key in BUILTIN_KEYS:
        raise HTTPException(status_code=400, detail="Built-in departments can't be deleted")
    doc = await db.department_categories.find_one({"dept_key": dept_key, "is_deleted": {"$ne": True}})
    if not doc:
        raise HTTPException(status_code=404, detail="Department not found")

    await db.department_categories.update_one(
        {"dept_key": dept_key},
        {"$set": {
            "is_deleted": True,
            "deleted_by": user.user_id,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"message": "Department removed"}


# ---------- Sub departments (nested under a department) ----------
# Simple named entries with their own Add/Rename/Delete, distinct from
# categories/statuses (which are plain string lists) — each has a stable
# `id` so it can be individually renamed/removed regardless of label
# collisions. Available generically here; the frontend currently only
# surfaces this for the "Management" department.

class SubDepartmentCreate(BaseModel):
    label: str


class SubDepartmentRename(BaseModel):
    label: str


@dept_categories_router.post("/{dept_key}/sub-departments")
async def add_sub_department(dept_key: str, payload: SubDepartmentCreate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    if not await _dept_key_exists(db, dept_key):
        raise HTTPException(status_code=404, detail="Department not found")
    label = (payload.label or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Sub department name is required")

    sub_id = f"subdept_{uuid.uuid4().hex[:10]}"
    await db.department_categories.update_one(
        {"dept_key": dept_key},
        {"$push": {"sub_departments": {"id": sub_id, "label": label}}},
        upsert=True,
    )
    return {"id": sub_id, "label": label}


@dept_categories_router.put("/{dept_key}/sub-departments/{sub_id}")
async def rename_sub_department(dept_key: str, sub_id: str, payload: SubDepartmentRename, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    label = (payload.label or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Sub department name is required")

    res = await db.department_categories.update_one(
        {"dept_key": dept_key, "sub_departments.id": sub_id},
        {"$set": {"sub_departments.$.label": label}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sub department not found")
    return {"id": sub_id, "label": label}


@dept_categories_router.delete("/{dept_key}/sub-departments/{sub_id}")
async def delete_sub_department(dept_key: str, sub_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    await db.department_categories.update_one(
        {"dept_key": dept_key},
        {"$pull": {"sub_departments": {"id": sub_id}}},
    )
    return {"message": "Sub department removed"}
