"""
Debts — recurring or one-time financial obligations tracked separately from
day-to-day Expense entries (e.g. loan EMIs, subscriptions, vendor dues).

Each Debt is just a definition (name, type, cycle, anchor due date, amount).
Occurrences for the "Due" tab aren't pre-generated rows — they're computed
on read from the debt's cycle for whichever month is being viewed. Only
occurrences actually marked collected get a persisted debt_payments row, so
the ledger only grows with real activity instead of a year of empty rows.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, date
import calendar
import uuid

debts_router = APIRouter(prefix="/finance/debts", tags=["Debts"])
db = None


def init_debts_db(database):
    global db
    db = database


async def get_current_user(request: Request):
    session_token = None
    if "session_token" in request.cookies:
        session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def can_manage_finance(user):
    """Only Finance and CEO can manage debts — same rule as Expense."""
    return user.get("role") in ["super_admin", "admin", "finance"]


CYCLES = {"one_time", "monthly", "yearly"}


# ============== MODELS ==============

class DebtCreate(BaseModel):
    debt_name: str
    debt_type: str = ""
    cycle: str = "one_time"  # one_time | monthly | yearly
    due_date: str            # YYYY-MM-DD — the due date (one_time) or anchor date (monthly/yearly)
    amount: float = 0.0
    notes: str = ""


class DebtUpdate(BaseModel):
    debt_name: Optional[str] = None
    debt_type: Optional[str] = None
    cycle: Optional[str] = None
    due_date: Optional[str] = None
    amount: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None  # active | closed


class DebtCollect(BaseModel):
    period_key: str            # "2026-09" (monthly) | "2026" (yearly) | the due date (one_time)
    due_date: str               # the computed due date for this period, YYYY-MM-DD
    amount: Optional[float] = None  # defaults to the debt's amount if not given


# ============== HELPERS ==============

def _parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def _occurrence_for_month(debt: dict, year: int, month: int):
    """Return the due date this debt falls on in year/month, or None if it doesn't occur that month."""
    cycle = debt.get("cycle")
    anchor = _parse_date(debt["due_date"])
    if cycle == "one_time":
        return anchor if (anchor.year == year and anchor.month == month) else None
    last_day = calendar.monthrange(year, month)[1]
    if cycle == "monthly":
        return date(year, month, min(anchor.day, last_day))
    if cycle == "yearly":
        return date(year, month, min(anchor.day, last_day)) if anchor.month == month else None
    return None


def _period_key(debt: dict, occurrence: date) -> str:
    cycle = debt.get("cycle")
    if cycle == "monthly":
        return f"{occurrence.year:04d}-{occurrence.month:02d}"
    if cycle == "yearly":
        return f"{occurrence.year:04d}"
    return occurrence.isoformat()  # one_time


def _validate_cycle_and_date(cycle: Optional[str], due_date: Optional[str]):
    if cycle is not None and cycle not in CYCLES:
        raise HTTPException(status_code=400, detail="cycle must be one_time, monthly, or yearly")
    if due_date is not None:
        try:
            _parse_date(due_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="due_date must be YYYY-MM-DD")


# ============== DEBTS REGISTRY ("Collected" tab) ==============

@debts_router.get("")
async def list_debts(request: Request):
    await get_current_user(request)
    return await db.debts.find({"is_deleted": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@debts_router.post("")
async def create_debt(data: DebtCreate, request: Request):
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Finance access required")
    _validate_cycle_and_date(data.cycle, data.due_date)

    now = datetime.now(timezone.utc)
    doc = {
        "debt_id": f"debt_{uuid.uuid4().hex[:12]}",
        "debt_name": data.debt_name,
        "debt_type": data.debt_type,
        "cycle": data.cycle,
        "due_date": data.due_date,
        "amount": data.amount,
        "notes": data.notes,
        "status": "active",
        "created_by": user["user_id"],
        "created_by_name": user.get("name"),
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    await db.debts.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@debts_router.put("/{debt_id}")
async def update_debt(debt_id: str, data: DebtUpdate, request: Request):
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Finance access required")
    existing = await db.debts.find_one({"debt_id": debt_id, "is_deleted": {"$ne": True}})
    if not existing:
        raise HTTPException(status_code=404, detail="Debt not found")

    update = data.model_dump(exclude_unset=True)
    _validate_cycle_and_date(update.get("cycle"), update.get("due_date"))
    if "status" in update and update["status"] not in ("active", "closed"):
        raise HTTPException(status_code=400, detail="status must be active or closed")
    update["updated_at"] = datetime.now(timezone.utc)

    await db.debts.update_one({"debt_id": debt_id}, {"$set": update})
    return await db.debts.find_one({"debt_id": debt_id}, {"_id": 0})


@debts_router.delete("/{debt_id}")
async def delete_debt(debt_id: str, request: Request):
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Finance access required")
    result = await db.debts.update_one(
        {"debt_id": debt_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Debt not found")
    return {"message": "Debt deleted"}


# ============== DUE TAB (month-filtered occurrences + status) ==============

@debts_router.get("/due")
async def get_due_debts(request: Request, month: int, year: int):
    await get_current_user(request)
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="month must be 1-12")

    debts = await db.debts.find(
        {"is_deleted": {"$ne": True}, "status": "active"}, {"_id": 0}
    ).to_list(1000)

    debt_ids = [d["debt_id"] for d in debts]
    payments = (
        await db.debt_payments.find({"debt_id": {"$in": debt_ids}}, {"_id": 0}).to_list(5000)
        if debt_ids else []
    )
    payment_map = {(p["debt_id"], p["period_key"]): p for p in payments}

    today = datetime.now(timezone.utc).date()
    rows = []
    for d in debts:
        occurrence = _occurrence_for_month(d, year, month)
        if not occurrence:
            continue
        period_key = _period_key(d, occurrence)
        payment = payment_map.get((d["debt_id"], period_key))
        if payment:
            status = "collected"
        elif occurrence < today:
            status = "overdue"
        else:
            status = "due"
        rows.append({
            "debt_id": d["debt_id"],
            "debt_name": d["debt_name"],
            "debt_type": d.get("debt_type", ""),
            "cycle": d["cycle"],
            "amount": d.get("amount", 0),
            "period_key": period_key,
            "due_date": occurrence.isoformat(),
            "status": status,
            "collected_at": payment.get("collected_at") if payment else None,
            "collected_by_name": payment.get("collected_by_name") if payment else None,
        })

    rows.sort(key=lambda r: r["due_date"])
    return rows


@debts_router.post("/{debt_id}/collect")
async def collect_debt(debt_id: str, data: DebtCollect, request: Request):
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Finance access required")
    debt = await db.debts.find_one({"debt_id": debt_id, "is_deleted": {"$ne": True}})
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")

    existing = await db.debt_payments.find_one({"debt_id": debt_id, "period_key": data.period_key})
    payment_doc = {
        "debt_id": debt_id,
        "period_key": data.period_key,
        "due_date": data.due_date,
        "amount": data.amount if data.amount is not None else debt.get("amount", 0),
        "collected_at": datetime.now(timezone.utc),
        "collected_by": user["user_id"],
        "collected_by_name": user.get("name"),
    }
    if existing:
        payment_id = existing["payment_id"]
        await db.debt_payments.update_one({"payment_id": payment_id}, {"$set": payment_doc})
    else:
        payment_id = f"pay_{uuid.uuid4().hex[:12]}"
        payment_doc["payment_id"] = payment_id
        await db.debt_payments.insert_one(dict(payment_doc))

    return await db.debt_payments.find_one({"payment_id": payment_id}, {"_id": 0})


@debts_router.delete("/{debt_id}/collect/{period_key}")
async def uncollect_debt(debt_id: str, period_key: str, request: Request):
    """Undo a 'mark collected' action (e.g. it was marked by mistake)."""
    user = await get_current_user(request)
    if not can_manage_finance(user):
        raise HTTPException(status_code=403, detail="Finance access required")
    result = await db.debt_payments.delete_one({"debt_id": debt_id, "period_key": period_key})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment record not found")
    return {"message": "Marked as not collected"}
