"""
Per-department menu ordering — Admin chooses a department in Settings → Menu
and reorders the visible top-nav / sidebar items. The chosen order is stored
in `menu_order_configs` collection and applied for users in that department.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone

menu_order_router = APIRouter(prefix="/menu-order")
db = None


def init_menu_order_db(database):
    global db
    db = database


class MenuOrderUpdate(BaseModel):
    department_id: str
    order: List[str]  # ordered list of module keys, e.g. ["operations","leads","hr"]


async def _get_user(request: Request) -> dict:
    """Lightweight auth — same pattern used by other routes."""
    session_token = request.cookies.get("session_token") or (
        (request.headers.get("Authorization") or "").replace("Bearer ", "").strip() or None
    )
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@menu_order_router.get("")
async def get_menu_order(request: Request, department_id: str = ""):
    """
    Returns the saved menu order for a department.
    If department_id is empty, returns the order for the CURRENT user's department.
    """
    user = await _get_user(request)
    dept = department_id or user.get("department_id") or ""
    if not dept:
        return {"department_id": "", "order": []}
    doc = await db.menu_order_configs.find_one({"department_id": dept}, {"_id": 0})
    return {"department_id": dept, "order": (doc or {}).get("order", [])}


@menu_order_router.put("")
async def set_menu_order(payload: MenuOrderUpdate, request: Request):
    """Save the menu order for a department. Admin/Super-admin only."""
    user = await _get_user(request)
    role = (user.get("role") or "").lower()
    if role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    if not payload.department_id:
        raise HTTPException(status_code=400, detail="department_id required")

    await db.menu_order_configs.update_one(
        {"department_id": payload.department_id},
        {"$set": {
            "department_id": payload.department_id,
            "order": payload.order,
            "updated_by": user["user_id"],
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"message": "Saved", "department_id": payload.department_id, "order": payload.order}
