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
    monthly_amount: Optional[float] = 0  # recurring amount owed each month, if any — powers Fixed Expense > Vendors


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    monthly_amount: Optional[float] = None


class VendorPayPayload(BaseModel):
    amount_paid: Optional[float] = None


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
        "monthly_amount": float(payload.monthly_amount or 0),
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
    await db.finance_vendor_payments.delete_many({"vendor_id": vendor_id})
    return {"message": "Deleted"}


# -------- Monthly paid/unpaid tracking (Fixed Expense > Vendors) --------
# Mirrors finance_subscriptions_routes.py's payment-per-period pattern, but
# keyed by plain (vendor_id, month, year) instead of an anchored start_date +
# duration — a vendor's obligation is just "this calendar month or not".

async def _ensure_vendor_payment(vendor: dict, month: int, year: int) -> dict:
    existing = await db.finance_vendor_payments.find_one(
        {"vendor_id": vendor["vendor_id"], "month": month, "year": year}, {"_id": 0},
    )
    if existing:
        return existing
    doc = {
        "payment_id": f"vndpay_{uuid.uuid4().hex[:12]}",
        "vendor_id": vendor["vendor_id"],
        "month": month,
        "year": year,
        "amount": float(vendor.get("monthly_amount") or 0),
        "paid": False,
        "paid_amount": None,
        "paid_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.finance_vendor_payments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@vendors_router.get("/payments")
async def list_vendor_payments(request: Request, month: int, year: int):
    """Every vendor with a recurring monthly_amount set, plus its paid/unpaid
    status for the given month — powers Fixed Expense > Vendors."""
    await _get_user(request)
    vendors = await db.finance_vendors.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    out = []
    total = 0.0
    paid_total = 0.0
    for v in vendors:
        if not float(v.get("monthly_amount") or 0):
            continue
        pay = await _ensure_vendor_payment(v, month, year)
        total += pay["amount"]
        if pay["paid"]:
            paid_total += pay.get("paid_amount") if pay.get("paid_amount") is not None else pay["amount"]
        out.append({**v, "payment": pay})
    return {
        "month": month, "year": year, "vendors": out,
        "total": round(total, 2), "paid": round(paid_total, 2), "balance": round(total - paid_total, 2),
    }


@vendors_router.post("/{vendor_id}/payments/pay")
async def pay_vendor_month(vendor_id: str, month: int, year: int, payload: VendorPayPayload, request: Request):
    await _get_user(request)
    vendor = await db.finance_vendors.find_one({"vendor_id": vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    pay = await _ensure_vendor_payment(vendor, month, year)
    amount_paid = payload.amount_paid if payload.amount_paid is not None else pay["amount"]
    await db.finance_vendor_payments.update_one(
        {"payment_id": pay["payment_id"]},
        {"$set": {"paid": True, "paid_amount": float(amount_paid), "paid_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": "Marked paid"}


@vendors_router.post("/{vendor_id}/payments/unpay")
async def unpay_vendor_month(vendor_id: str, month: int, year: int, request: Request):
    await _get_user(request)
    res = await db.finance_vendor_payments.update_one(
        {"vendor_id": vendor_id, "month": month, "year": year},
        {"$set": {"paid": False, "paid_amount": None, "paid_at": None}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment period not found")
    return {"message": "Marked unpaid"}
