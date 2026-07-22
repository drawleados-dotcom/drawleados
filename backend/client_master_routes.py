"""
Client Master routes — a standalone onboarding/CRM registry (deliberately
separate from finance_clients, which backs invoicing and Project creation).
Tracks how a client was sourced, which catalog service/package they signed
up for, and delivery status, for the Super Admin "Clients Master View".
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

client_master_router = APIRouter(prefix="/client-master", tags=["client-master"])

STATUS_VALUES = {"active", "delivered", "dropped", "not_satisfied", "unfinished"}


class ClientMasterCreate(BaseModel):
    name: str
    source: Optional[str] = None
    onboarding_date: Optional[str] = None  # ISO date; defaults to today
    onboarding_month: Optional[int] = None  # 1-12; defaults from onboarding_date
    onboarding_year: Optional[int] = None  # defaults from onboarding_date
    service_type: str  # "one-time" | "recurring"
    service_id: Optional[str] = None
    service_name: Optional[str] = None
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    package_amount: Optional[float] = 0
    case_study: Optional[str] = None
    recurring_months: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None  # blank/omitted = ongoing ("till now")
    is_ongoing: Optional[bool] = False
    remarks: Optional[str] = None
    status: Optional[str] = "active"


class ClientMasterUpdate(BaseModel):
    name: Optional[str] = None
    source: Optional[str] = None
    onboarding_date: Optional[str] = None
    onboarding_month: Optional[int] = None
    onboarding_year: Optional[int] = None
    service_type: Optional[str] = None
    service_id: Optional[str] = None
    service_name: Optional[str] = None
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    package_amount: Optional[float] = None
    case_study: Optional[str] = None
    recurring_months: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_ongoing: Optional[bool] = None
    remarks: Optional[str] = None
    status: Optional[str] = None


async def _require_super_admin(request: Request):
    from server import get_current_user
    user = await get_current_user(request)
    if (user.role or "") != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can manage Client Master")
    return user


@client_master_router.post("")
async def create_client_master(payload: ClientMasterCreate, request: Request):
    from server import db
    user = await _require_super_admin(request)

    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Client name is required")
    if payload.status and payload.status not in STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid status")

    now = datetime.now(timezone.utc).isoformat()
    onboarding_date = payload.onboarding_date or now[:10]
    doc = {
        **payload.model_dump(),
        "client_id": f"cm_{uuid.uuid4().hex[:12]}",
        "name": name,
        "onboarding_date": onboarding_date,
        "onboarding_month": payload.onboarding_month or int(onboarding_date[5:7]),
        "onboarding_year": payload.onboarding_year or int(onboarding_date[0:4]),
        "total_amount": float(payload.package_amount or 0),
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    await db.client_master.insert_one(doc)
    doc.pop("_id", None)
    return doc


@client_master_router.get("")
async def list_client_master(request: Request):
    from server import db
    await _require_super_admin(request)
    items = await db.client_master.find(
        {"is_deleted": False}, {"_id": 0}
    ).sort("onboarding_date", -1).to_list(2000)
    return items


@client_master_router.put("/{client_id}")
async def update_client_master(client_id: str, payload: ClientMasterUpdate, request: Request):
    from server import db
    await _require_super_admin(request)

    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "name" in update_data and not update_data["name"].strip():
        raise HTTPException(status_code=400, detail="Client name cannot be empty")
    if "status" in update_data and update_data["status"] not in STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if "package_amount" in update_data:
        update_data["total_amount"] = float(update_data["package_amount"] or 0)

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.client_master.update_one({"client_id": client_id}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")

    result = await db.client_master.find_one({"client_id": client_id}, {"_id": 0})
    return result


@client_master_router.delete("/{client_id}")
async def delete_client_master(client_id: str, request: Request):
    from server import db
    await _require_super_admin(request)
    res = await db.client_master.update_one(
        {"client_id": client_id},
        {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client removed"}
