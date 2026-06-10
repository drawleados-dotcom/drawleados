"""
Org Tree routes — stores and updates the company hierarchy tree.
Single document collection: org_tree → { _id: 'org_tree', nodes: [...] }
where nodes is a FLAT list of: { id, name, color, icon, parent_id, sort }.
"""
from fastapi import APIRouter, Request, HTTPException, Body
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone

org_tree_router = APIRouter(prefix="/org-tree", tags=["Org Tree"])

_db = None

def init_org_tree_db(db):
    global _db
    _db = db


async def _get_current_user(request: Request):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await _db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await _db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


class OrgNode(BaseModel):
    id: str
    name: str
    color: str = "#6366f1"
    icon: Optional[str] = None
    parent_id: Optional[str] = None
    sort: int = 0


DEFAULT_NODES = [
    {"id": "ceo", "name": "CEO", "color": "#f59e0b", "icon": "crown", "parent_id": None, "sort": 0},
    {"id": "finance", "name": "Finance", "color": "#10b981", "icon": "building", "parent_id": "ceo", "sort": 0},
    {"id": "sales", "name": "Sales", "color": "#3b82f6", "icon": "brief", "parent_id": "ceo", "sort": 1},
    {"id": "hr", "name": "HR", "color": "#ec4899", "icon": "building", "parent_id": "ceo", "sort": 2},
    {"id": "operations", "name": "Operations", "color": "#6366f1", "icon": "brief", "parent_id": "ceo", "sort": 3},
    {"id": "ops_marketing", "name": "Marketing", "color": "#ec4899", "icon": "mega", "parent_id": "operations", "sort": 0},
    {"id": "seo", "name": "SEO", "color": "#8b5cf6", "parent_id": "ops_marketing", "sort": 0},
    {"id": "social_media", "name": "Social Media", "color": "#06b6d4", "parent_id": "ops_marketing", "sort": 1},
    {"id": "meta_ads", "name": "Meta Ads", "color": "#3b82f6", "parent_id": "ops_marketing", "sort": 2},
    {"id": "google_ads", "name": "Google Ads", "color": "#ef4444", "parent_id": "ops_marketing", "sort": 3},
    {"id": "technology", "name": "Technology", "color": "#10b981", "icon": "wrench", "parent_id": "operations", "sort": 1},
    {"id": "website", "name": "Website", "color": "#6366f1", "parent_id": "technology", "sort": 0},
    {"id": "ecommerce", "name": "Ecommerce", "color": "#f59e0b", "parent_id": "technology", "sort": 1},
    {"id": "erp", "name": "ERP", "color": "#8b5cf6", "parent_id": "technology", "sort": 2},
]


@org_tree_router.get("")
async def get_org_tree(request: Request):
    await _get_current_user(request)
    doc = await _db.org_tree.find_one({"_id": "org_tree"})
    if not doc:
        await _db.org_tree.update_one(
            {"_id": "org_tree"},
            {"$set": {"nodes": DEFAULT_NODES, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        return {"nodes": DEFAULT_NODES}
    return {"nodes": doc.get("nodes", DEFAULT_NODES)}


@org_tree_router.put("")
async def save_org_tree(request: Request, payload: dict = Body(...)):
    user = await _get_current_user(request)
    if user.get("role") not in {"super_admin", "admin", "hr_manager"}:
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / HR Manager can edit the org tree")
    nodes = payload.get("nodes") or []
    if not isinstance(nodes, list):
        raise HTTPException(status_code=400, detail="nodes must be a list")
    # Sanity: at least one root
    if not any((n.get("parent_id") is None) for n in nodes):
        raise HTTPException(status_code=400, detail="At least one root node (without parent) is required")
    # Drop unknown keys
    clean = []
    for n in nodes:
        clean.append({
            "id": n.get("id"),
            "name": n.get("name"),
            "color": n.get("color", "#6366f1"),
            "icon": n.get("icon"),
            "parent_id": n.get("parent_id"),
            "sort": int(n.get("sort", 0)),
        })
    await _db.org_tree.update_one(
        {"_id": "org_tree"},
        {"$set": {
            "nodes": clean,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user.get("user_id"),
        }},
        upsert=True,
    )
    return {"ok": True, "count": len(clean)}
