"""
Finance -> Expense -> Forecasting.

A day-by-day planner for upcoming (or past) day-to-day expenses — separate
from the live Cashbook/Master Expense, which tracks money that's actually
moved. Each calendar date holds a list of planned expense line items
(name, amount, remarks). "Add Expense" always appends a fresh batch of
rows to whichever date is picked, creating that date's card if one doesn't
exist yet, so repeat entries for the same day land on the same card
instead of spawning duplicates.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

expense_forecast_router = APIRouter(prefix="/finance/expense-forecast", tags=["finance-expense-forecast"])
db = None


def init_expense_forecast_db(database):
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


class ForecastItemIn(BaseModel):
    name: str
    amount: float = Field(ge=0)
    remarks: Optional[str] = ""


class AddForecastPayload(BaseModel):
    date: str  # YYYY-MM-DD
    items: List[ForecastItemIn]


class UpdateForecastItemPayload(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0)
    remarks: Optional[str] = None


@expense_forecast_router.get("")
async def list_forecast_days(request: Request):
    await _get_user(request)
    return await db.finance_expense_forecast.find({}, {"_id": 0}).sort("date", 1).to_list(2000)


@expense_forecast_router.post("")
async def add_forecast_expense(payload: AddForecastPayload, request: Request):
    await _get_user(request)
    new_items = [
        {
            "item_id": f"fci_{uuid.uuid4().hex[:12]}",
            "name": i.name.strip(),
            "amount": i.amount,
            "remarks": (i.remarks or "").strip(),
        }
        for i in payload.items
        if i.name.strip()
    ]
    if not new_items:
        raise HTTPException(status_code=400, detail="Add at least one expense row")

    now = datetime.now(timezone.utc).isoformat()
    existing = await db.finance_expense_forecast.find_one({"date": payload.date})
    if existing:
        await db.finance_expense_forecast.update_one(
            {"date": payload.date},
            {"$push": {"items": {"$each": new_items}}, "$set": {"updated_at": now}},
        )
    else:
        await db.finance_expense_forecast.insert_one({
            "forecast_id": f"fcd_{uuid.uuid4().hex[:12]}",
            "date": payload.date,
            "items": new_items,
            "created_at": now,
            "updated_at": now,
        })
    doc = await db.finance_expense_forecast.find_one({"date": payload.date}, {"_id": 0})
    return doc


@expense_forecast_router.delete("/{forecast_id}")
async def delete_forecast_day(forecast_id: str, request: Request):
    await _get_user(request)
    res = await db.finance_expense_forecast.delete_one({"forecast_id": forecast_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Deleted"}


@expense_forecast_router.put("/{forecast_id}/items/{item_id}")
async def update_forecast_item(forecast_id: str, item_id: str, payload: UpdateForecastItemPayload, request: Request):
    await _get_user(request)
    day = await db.finance_expense_forecast.find_one({"forecast_id": forecast_id})
    if not day:
        raise HTTPException(status_code=404, detail="Not found")
    items = day.get("items", [])
    target = next((i for i in items if i["item_id"] == item_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Item not found")
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name is required")
        target["name"] = name
    if payload.amount is not None:
        target["amount"] = payload.amount
    if payload.remarks is not None:
        target["remarks"] = payload.remarks.strip()
    await db.finance_expense_forecast.update_one(
        {"forecast_id": forecast_id},
        {"$set": {"items": items, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    doc = await db.finance_expense_forecast.find_one({"forecast_id": forecast_id}, {"_id": 0})
    return doc


@expense_forecast_router.delete("/{forecast_id}/items/{item_id}")
async def delete_forecast_item(forecast_id: str, item_id: str, request: Request):
    await _get_user(request)
    day = await db.finance_expense_forecast.find_one({"forecast_id": forecast_id})
    if not day:
        raise HTTPException(status_code=404, detail="Not found")
    remaining = [i for i in day.get("items", []) if i["item_id"] != item_id]
    if not remaining:
        # Removing the last row leaves nothing to show — drop the day card too.
        await db.finance_expense_forecast.delete_one({"forecast_id": forecast_id})
        return {"message": "Deleted", "day_removed": True}
    await db.finance_expense_forecast.update_one(
        {"forecast_id": forecast_id},
        {"$set": {"items": remaining, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    doc = await db.finance_expense_forecast.find_one({"forecast_id": forecast_id}, {"_id": 0})
    return doc
