"""
Finance -> Expense -> Vendors — a simple vendor directory (name, contact,
phone, email, address, notes) for tracking who overhead/tools spend goes to.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

vendors_router = APIRouter(prefix="/finance/vendors", tags=["finance-vendors"])
db = None


def init_vendors_db(database):
    global db
    db = database


async def _get_user(request: Request) -> dict:
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


class VendorCreate(BaseModel):
    name: str
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


@vendors_router.get("")
async def list_vendors(request: Request):
    await _get_user(request)
    return await db.finance_vendors.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@vendors_router.post("")
async def create_vendor(payload: VendorCreate, request: Request):
    await _get_user(request)
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "vendor_id": f"vnd_{uuid.uuid4().hex[:12]}",
        "name": payload.name.strip(),
        "contact_person": (payload.contact_person or "").strip(),
        "phone": (payload.phone or "").strip(),
        "email": (payload.email or "").strip(),
        "address": (payload.address or "").strip(),
        "notes": (payload.notes or "").strip(),
        "created_at": now,
        "updated_at": now,
    }
    await db.finance_vendors.insert_one(doc)
    doc.pop("_id", None)
    return doc


@vendors_router.put("/{vendor_id}")
async def update_vendor(vendor_id: str, payload: VendorUpdate, request: Request):
    await _get_user(request)
    vendor = await db.finance_vendors.find_one({"vendor_id": vendor_id})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    updates = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.finance_vendors.update_one({"vendor_id": vendor_id}, {"$set": updates})
    doc = await db.finance_vendors.find_one({"vendor_id": vendor_id}, {"_id": 0})
    return doc


@vendors_router.delete("/{vendor_id}")
async def delete_vendor(vendor_id: str, request: Request):
    await _get_user(request)
    res = await db.finance_vendors.delete_one({"vendor_id": vendor_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Deleted"}
