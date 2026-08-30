"""
Finance -> Expense -> Tools & Subscription.

Tracks recurring tool/software subscriptions (monthly or yearly) with an
auto-generated payment schedule anchored to each subscription's start date.
There's no cron job — every read lazily "catches up" any periods due
between the start date and today (via _ensure_payments), so the current
month's row is always present without a background worker.

`GET /summary` powers Master Expense's Overhead "Tools & Subscription"
pinned row (see MasterExpenseView.js) — Grand/Paid/Balance for the selected
month, plus the list of subscriptions with an unpaid period due that month,
for the pay picker.
"""
import calendar
import uuid
from datetime import datetime, timezone, date
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

subscriptions_router = APIRouter(prefix="/finance/subscriptions", tags=["finance-subscriptions"])
db = None


def init_subscriptions_db(database):
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


class SubscriptionCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    amount: float = Field(ge=0)
    duration: str = "monthly"  # "monthly" | "yearly"
    start_date: str  # YYYY-MM-DD


class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0)
    duration: Optional[str] = None
    start_date: Optional[str] = None


class PayPeriodPayload(BaseModel):
    amount_paid: float = Field(ge=0)


def _add_period(d: date, duration: str, n: int) -> date:
    """n-th billing date after `d` (n=0 -> d itself), monthly or yearly,
    clamped to the last day of the target month when the anchor day doesn't
    exist there (e.g. day 31 anchored, landing on February)."""
    if duration == "yearly":
        year = d.year + n
        month = d.month
    else:
        total = (d.year * 12 + (d.month - 1)) + n
        year = total // 12
        month = total % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    day = min(d.day, last_day)
    return date(year, month, day)


def _periods_up_to(start_date: str, duration: str, upto: date) -> List[date]:
    d0 = date.fromisoformat(start_date)
    if d0 > upto:
        return []
    periods = []
    n = 0
    while True:
        p = _add_period(d0, duration, n)
        if p > upto:
            break
        periods.append(p)
        n += 1
        if n > 2000:  # safety valve against a bad start_date
            break
    return periods


async def _ensure_payments(sub: dict, upto: date) -> List[dict]:
    """Lazily create any missing payment docs for periods due between the
    subscription's start date and `upto`, then return the full sorted
    payment history."""
    periods = _periods_up_to(sub["start_date"], sub.get("duration", "monthly"), upto)
    existing = await db.finance_subscription_payments.find(
        {"subscription_id": sub["subscription_id"]}, {"_id": 0}
    ).to_list(2000)
    existing_dates = {p["period_date"] for p in existing}
    to_create = [p for p in periods if p.isoformat() not in existing_dates]
    if to_create:
        now = datetime.now(timezone.utc).isoformat()
        docs = [
            {
                "payment_id": f"subpay_{uuid.uuid4().hex[:12]}",
                "subscription_id": sub["subscription_id"],
                "period_date": p.isoformat(),
                "amount": sub["amount"],
                "paid": False,
                "paid_amount": None,
                "paid_at": None,
                "created_at": now,
            }
            for p in to_create
        ]
        await db.finance_subscription_payments.insert_many(docs)
        existing.extend(docs)
    existing.sort(key=lambda p: p["period_date"])
    return existing


@subscriptions_router.get("")
async def list_subscriptions(request: Request):
    await _get_user(request)
    subs = await db.finance_subscriptions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    today = datetime.now(timezone.utc).date()
    out = []
    for s in subs:
        history = await _ensure_payments(s, today)
        unpaid = [p for p in history if not p["paid"]]
        out.append({
            **s,
            "payment_history": history,
            "unpaid_count": len(unpaid),
            "current_unpaid_amount": sum(p["amount"] for p in unpaid),
        })
    return out


@subscriptions_router.post("")
async def create_subscription(payload: SubscriptionCreate, request: Request):
    await _get_user(request)
    if payload.duration not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="duration must be monthly or yearly")
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    try:
        date.fromisoformat(payload.start_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="start_date must be YYYY-MM-DD")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
        "name": payload.name.strip(),
        "description": (payload.description or "").strip(),
        "amount": payload.amount,
        "duration": payload.duration,
        "start_date": payload.start_date,
        "created_at": now,
        "updated_at": now,
    }
    await db.finance_subscriptions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@subscriptions_router.put("/{subscription_id}")
async def update_subscription(subscription_id: str, payload: SubscriptionUpdate, request: Request):
    await _get_user(request)
    sub = await db.finance_subscriptions.find_one({"subscription_id": subscription_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    updates = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if "duration" in updates and updates["duration"] not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="duration must be monthly or yearly")
    if "start_date" in updates:
        try:
            date.fromisoformat(updates["start_date"])
        except ValueError:
            raise HTTPException(status_code=400, detail="start_date must be YYYY-MM-DD")
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.finance_subscriptions.update_one({"subscription_id": subscription_id}, {"$set": updates})
    doc = await db.finance_subscriptions.find_one({"subscription_id": subscription_id}, {"_id": 0})
    return doc


@subscriptions_router.delete("/{subscription_id}")
async def delete_subscription(subscription_id: str, request: Request):
    await _get_user(request)
    res = await db.finance_subscriptions.delete_one({"subscription_id": subscription_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    await db.finance_subscription_payments.delete_many({"subscription_id": subscription_id})
    return {"message": "Deleted"}


@subscriptions_router.post("/{subscription_id}/payments/{period_date}/pay")
async def pay_period(subscription_id: str, period_date: str, payload: PayPeriodPayload, request: Request):
    await _get_user(request)
    sub = await db.finance_subscriptions.find_one({"subscription_id": subscription_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.finance_subscription_payments.find_one(
        {"subscription_id": subscription_id, "period_date": period_date}
    )
    if existing:
        await db.finance_subscription_payments.update_one(
            {"subscription_id": subscription_id, "period_date": period_date},
            {"$set": {"paid": True, "paid_amount": payload.amount_paid, "paid_at": now}},
        )
    else:
        await db.finance_subscription_payments.insert_one({
            "payment_id": f"subpay_{uuid.uuid4().hex[:12]}",
            "subscription_id": subscription_id,
            "period_date": period_date,
            "amount": sub["amount"],
            "paid": True,
            "paid_amount": payload.amount_paid,
            "paid_at": now,
            "created_at": now,
        })
    return {"message": "Payment recorded"}


@subscriptions_router.post("/{subscription_id}/payments/{period_date}/unpay")
async def unpay_period(subscription_id: str, period_date: str, request: Request):
    await _get_user(request)
    res = await db.finance_subscription_payments.update_one(
        {"subscription_id": subscription_id, "period_date": period_date},
        {"$set": {"paid": False, "paid_amount": None, "paid_at": None}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment period not found")
    return {"message": "Marked unpaid"}


@subscriptions_router.get("/summary")
async def subscriptions_summary(request: Request, month: int, year: int):
    await _get_user(request)
    subs = await db.finance_subscriptions.find({}, {"_id": 0}).to_list(500)
    today = datetime.now(timezone.utc).date()
    month_start = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    month_end = date(year, month, last_day)
    bound = min(month_end, today)

    grand = 0.0
    paid = 0.0
    payable = []
    for s in subs:
        if bound < month_start:
            continue  # this month hasn't arrived yet — nothing due
        history = await _ensure_payments(s, bound)
        row = next(
            (p for p in history if month_start.isoformat() <= p["period_date"] <= month_end.isoformat()),
            None,
        )
        if not row:
            continue
        grand += row["amount"]
        if row["paid"]:
            paid += row.get("paid_amount") if row.get("paid_amount") is not None else row["amount"]
        else:
            payable.append({
                "subscription_id": s["subscription_id"],
                "name": s["name"],
                "period_date": row["period_date"],
                "amount": row["amount"],
            })
    return {"grand": grand, "paid": paid, "balance": grand - paid, "payable": payable}
