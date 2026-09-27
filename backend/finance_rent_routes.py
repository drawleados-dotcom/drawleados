"""
Finance -> Expense -> Fixed Expense -> Rent — the rental agreement details
(monthly rent, maintenance, advance/deposit, rent start date and whether rent
is paid in advance (prepaid) or at the end of each cycle (postpaid)).

One agreement document for the company, stored in `finance_rent_settings`.
"""
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

rent_router = APIRouter(prefix="/finance/rent", tags=["finance-rent"])
db = None

SETTINGS_ID = "default"


def init_rent_db(database):
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


class RentSettings(BaseModel):
    monthly_rent: Optional[float] = 0
    maintenance: Optional[float] = 0
    advance_amount: Optional[float] = 0
    advance_date: Optional[str] = ""  # YYYY-MM-DD
    start_date: Optional[str] = ""  # YYYY-MM-DD — rent cycle day comes from this
    billing_type: Literal["prepaid", "postpaid"] = "postpaid"


def _check_date(value: str, field: str) -> str:
    value = (value or "").strip()
    if value:
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail=f"{field} must be YYYY-MM-DD")
    return value


@rent_router.get("/settings")
async def get_rent_settings(request: Request):
    await _get_user(request)
    doc = await db.finance_rent_settings.find_one({"settings_id": SETTINGS_ID}, {"_id": 0})
    return doc or {
        "settings_id": SETTINGS_ID, "monthly_rent": 0, "maintenance": 0, "advance_amount": 0,
        "advance_date": "", "start_date": "", "billing_type": "postpaid",
    }


@rent_router.put("/settings")
async def save_rent_settings(payload: RentSettings, request: Request):
    user = await _get_user(request)
    for name in ("monthly_rent", "maintenance", "advance_amount"):
        if float(getattr(payload, name) or 0) < 0:
            raise HTTPException(status_code=400, detail=f"{name} cannot be negative")
    doc = {
        "settings_id": SETTINGS_ID,
        "monthly_rent": float(payload.monthly_rent or 0),
        "maintenance": float(payload.maintenance or 0),
        "advance_amount": float(payload.advance_amount or 0),
        "advance_date": _check_date(payload.advance_date, "advance_date"),
        "start_date": _check_date(payload.start_date, "start_date"),
        "billing_type": payload.billing_type,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user.get("user_id"),
    }
    await db.finance_rent_settings.update_one({"settings_id": SETTINGS_ID}, {"$set": doc}, upsert=True)
    return await db.finance_rent_settings.find_one({"settings_id": SETTINGS_ID}, {"_id": 0})
