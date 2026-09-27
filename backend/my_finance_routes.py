"""
My Finance — an employee's own personal finance tracker: income, expenses,
and debt/EMI/chit management. Strictly personal: every record is scoped to
the logged-in user's own user_id, and nobody else (not even Super Admin) can
read or write another employee's My Finance data through this router. This
is deliberately separate from Finance & Billing (company money, debts_routes.py)
— "My Finance" is what an employee owes and earns personally.

Storage: collections `my_finance_incomes`, `my_finance_expenses`, `my_finance_debts`.

A debt's monthly schedule (one row per due month, with running paid/pending/
overdue status) is never pre-generated or persisted — it's computed on every
read from the debt's start/end date and due day, the same "computed, not
stored" approach finance/debts_routes.py uses for its own due occurrences.
Only actual payments are persisted, as entries in the debt's own `payments`
list, so the schedule only grows with what really happened.
"""
import calendar
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timezone

my_finance_router = APIRouter(prefix="/my-finance", tags=["my-finance"])

# "loan" — interest-only: the monthly amount is pure interest, the principal
#   itself is settled separately (or never, if it's rolled over) — this is
#   the ₹2L-at-₹6k/month kind of arrangement. Interest rate is computed.
# "emi" — a fixed-tenure installment: the monthly amount already blends
#   principal + interest and fully closes the debt by end_date (which is
#   required for this type). No rate is computed — the amount itself is
#   what's owed each month, same as a bank EMI statement already shows.
# "chit" — a periodic contribution, no interest concept at all.
DEBT_TYPES = {"loan", "emi", "chit"}
INCOME_SOURCES = {"salary", "debt", "other"}


def _parse_date(s: str, label: str) -> date:
    try:
        return date.fromisoformat(s)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail=f"{label} must be YYYY-MM-DD")


def _month_start(d: date) -> date:
    return date(d.year, d.month, 1)


def _add_months(d: date, n: int) -> date:
    total = d.month - 1 + n
    year = d.year + total // 12
    month = total % 12 + 1
    return date(year, month, 1)


def _due_date_in(year: int, month: int, due_day: int) -> date:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(due_day, last_day))


# ------------------------------------------------------------------ Income

class IncomeCreate(BaseModel):
    source_type: str = "salary"  # salary | debt | other
    amount: float
    date: str
    debt_id: Optional[str] = None  # when source_type == "debt": which debt this money came from
    notes: Optional[str] = ""


class IncomeUpdate(BaseModel):
    source_type: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    notes: Optional[str] = None


def _validate_income(source_type: Optional[str], amount: Optional[float]):
    if source_type is not None and source_type not in INCOME_SOURCES:
        raise HTTPException(status_code=400, detail=f"source_type must be one of {sorted(INCOME_SOURCES)}")
    if amount is not None and amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be more than 0")


@my_finance_router.get("/incomes")
async def list_incomes(request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    return await db.my_finance_incomes.find({"user_id": user.user_id}, {"_id": 0}).sort("date", -1).to_list(5000)


@my_finance_router.post("/incomes")
async def create_income(payload: IncomeCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    _validate_income(payload.source_type, payload.amount)
    _parse_date(payload.date, "date")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "income_id": f"myinc_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "source_type": payload.source_type,
        "amount": round(payload.amount, 2),
        "date": payload.date,
        "debt_id": payload.debt_id,
        "notes": (payload.notes or "").strip(),
        "created_at": now, "updated_at": now,
    }
    await db.my_finance_incomes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@my_finance_router.put("/incomes/{income_id}")
async def update_income(income_id: str, payload: IncomeUpdate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    existing = await db.my_finance_incomes.find_one({"income_id": income_id, "user_id": user.user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Income entry not found")
    _validate_income(payload.source_type, payload.amount)
    if payload.date is not None:
        _parse_date(payload.date, "date")
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if "amount" in update_data:
        update_data["amount"] = round(update_data["amount"], 2)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.my_finance_incomes.update_one({"income_id": income_id}, {"$set": update_data})
    return await db.my_finance_incomes.find_one({"income_id": income_id}, {"_id": 0})


@my_finance_router.delete("/incomes/{income_id}")
async def delete_income(income_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    result = await db.my_finance_incomes.delete_one({"income_id": income_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Income entry not found")
    return {"message": "Income entry deleted"}


# ----------------------------------------------------------------- Expense

class ExpenseCreate(BaseModel):
    category: Optional[str] = "General"
    amount: float
    date: str
    notes: Optional[str] = ""


class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    notes: Optional[str] = None


@my_finance_router.get("/expenses")
async def list_expenses(request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    return await db.my_finance_expenses.find({"user_id": user.user_id}, {"_id": 0}).sort("date", -1).to_list(5000)


@my_finance_router.post("/expenses")
async def create_expense(payload: ExpenseCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be more than 0")
    _parse_date(payload.date, "date")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "expense_id": f"myexp_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "category": (payload.category or "General").strip(),
        "amount": round(payload.amount, 2),
        "date": payload.date,
        "notes": (payload.notes or "").strip(),
        "created_at": now, "updated_at": now,
    }
    await db.my_finance_expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@my_finance_router.put("/expenses/{expense_id}")
async def update_expense(expense_id: str, payload: ExpenseUpdate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    existing = await db.my_finance_expenses.find_one({"expense_id": expense_id, "user_id": user.user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Expense entry not found")
    if payload.amount is not None and payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be more than 0")
    if payload.date is not None:
        _parse_date(payload.date, "date")
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if "amount" in update_data:
        update_data["amount"] = round(update_data["amount"], 2)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.my_finance_expenses.update_one({"expense_id": expense_id}, {"$set": update_data})
    return await db.my_finance_expenses.find_one({"expense_id": expense_id}, {"_id": 0})


@my_finance_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    result = await db.my_finance_expenses.delete_one({"expense_id": expense_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense entry not found")
    return {"message": "Expense entry deleted"}


# -------------------------------------------------------------------- Debt
# A "loan" carries a monthly interest amount against a principal — the rate
# is worked out automatically, both against the stated principal (nominal —
# what the lender quotes) and against what was actually handed over if that's
# less (effective — the real cost of the money you got). A "chit" has a
# monthly contribution instead of interest, so no rate is computed for it.

class DebtCreate(BaseModel):
    name: str
    debt_type: str = "loan"
    lender_name: Optional[str] = ""
    principal_amount: float
    disbursed_amount: Optional[float] = None  # defaults to principal_amount if not given
    monthly_amount: float  # monthly interest (loan) or contribution (chit)
    start_date: str
    end_date: Optional[str] = None
    due_day: Optional[int] = None  # 1-31; defaults to start_date's day
    notes: Optional[str] = ""
    log_as_income: bool = True  # also record the disbursed amount as an Income entry
    log_payments_as_expense: bool = True  # also record each future payment as an Expense entry


class DebtUpdate(BaseModel):
    name: Optional[str] = None
    lender_name: Optional[str] = None
    principal_amount: Optional[float] = None
    disbursed_amount: Optional[float] = None
    monthly_amount: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    due_day: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = None  # active | closed
    log_payments_as_expense: Optional[bool] = None


class DebtPayment(BaseModel):
    period: Optional[str] = None  # "YYYY-MM"; defaults to the current calendar month
    amount: float
    date: Optional[str] = None    # YYYY-MM-DD; defaults to today
    note: Optional[str] = ""


def _validate_debt_fields(debt_type, principal, disbursed, monthly, due_day):
    if debt_type is not None and debt_type not in DEBT_TYPES:
        raise HTTPException(status_code=400, detail=f"debt_type must be one of {sorted(DEBT_TYPES)}")
    if principal is not None and principal <= 0:
        raise HTTPException(status_code=400, detail="Principal amount must be more than 0")
    if disbursed is not None and disbursed <= 0:
        raise HTTPException(status_code=400, detail="Disbursed amount must be more than 0")
    if monthly is not None and monthly <= 0:
        raise HTTPException(status_code=400, detail="Monthly amount must be more than 0")
    if due_day is not None and not (1 <= due_day <= 31):
        raise HTTPException(status_code=400, detail="due_day must be between 1 and 31")


def _rates(debt_type: str, principal: float, disbursed: float, monthly_amount: float) -> dict:
    if debt_type != "loan" or not principal:
        return {"nominal_monthly_rate_pct": None, "nominal_annual_rate_pct": None,
                "effective_monthly_rate_pct": None, "effective_annual_rate_pct": None}
    nominal = round(monthly_amount / principal * 100, 2)
    effective = round(monthly_amount / disbursed * 100, 2) if disbursed else nominal
    return {
        "nominal_monthly_rate_pct": nominal, "nominal_annual_rate_pct": round(nominal * 12, 2),
        "effective_monthly_rate_pct": effective, "effective_annual_rate_pct": round(effective * 12, 2),
    }


def _schedule(debt: dict, today: date) -> dict:
    """The full month-by-month due schedule from start_date through end_date
    (or through the current month, if the debt is open-ended)."""
    start = _parse_date(debt["start_date"], "start_date")
    due_day = debt.get("due_day") or start.day
    end = _parse_date(debt["end_date"], "end_date") if debt.get("end_date") else None
    stop_month = _month_start(end) if end else _month_start(max(start, today))

    by_period: dict = {}
    for p in debt.get("payments") or []:
        by_period.setdefault(p["period"], []).append(p)

    rows, cursor, guard = [], _month_start(start), 0
    while cursor <= stop_month and guard < 1200:  # 100-year hard cap
        period = f"{cursor.year:04d}-{cursor.month:02d}"
        due_date = _due_date_in(cursor.year, cursor.month, due_day)
        pays = by_period.get(period, [])
        paid = round(sum(p["amount"] for p in pays), 2)
        due = debt["monthly_amount"]
        if paid <= 0:
            status = "overdue" if due_date < today else "pending"
        elif paid + 0.01 < due:
            status = "partial"
        else:
            status = "paid"
        rows.append({
            "period": period, "due_date": due_date.isoformat(), "amount_due": due,
            "amount_paid": paid, "balance": round(due - paid, 2), "status": status, "payments": pays,
        })
        cursor = _add_months(cursor, 1)
        guard += 1

    total_due = round(sum(r["amount_due"] for r in rows), 2)
    total_paid = round(sum(r["amount_paid"] for r in rows), 2)
    next_due = next((r for r in rows if r["status"] in ("pending", "partial", "overdue")), None)
    overdue_count = sum(1 for r in rows if r["status"] == "overdue")
    return {
        "schedule": rows,
        "summary": {
            "months_elapsed": len(rows), "months_total": (len(rows) if end else None),
            "total_due": total_due, "total_paid": total_paid, "outstanding": round(total_due - total_paid, 2),
            "next_due": next_due, "overdue_count": overdue_count,
            "fully_settled": bool(end) and overdue_count == 0 and all(r["status"] == "paid" for r in rows) and cursor > _month_start(end),
        },
    }


def _serialize_debt(debt: dict, today: date) -> dict:
    debt = {**debt, **_rates(debt.get("debt_type", "loan"), debt.get("principal_amount", 0),
                              debt.get("disbursed_amount") or debt.get("principal_amount", 0), debt.get("monthly_amount", 0))}
    debt.update(_schedule(debt, today))
    return debt


@my_finance_router.get("/debts")
async def list_debts(request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    today = date.today()
    rows = await db.my_finance_debts.find({"user_id": user.user_id}, {"_id": 0}).sort("start_date", -1).to_list(1000)
    return [_serialize_debt(d, today) for d in rows]


@my_finance_router.post("/debts")
async def create_debt(payload: DebtCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    _validate_debt_fields(payload.debt_type, payload.principal_amount, payload.disbursed_amount, payload.monthly_amount, payload.due_day)
    start = _parse_date(payload.start_date, "start_date")
    if payload.debt_type == "emi" and not payload.end_date:
        raise HTTPException(status_code=400, detail="An EMI needs an end date — it's a fixed-tenure installment, not an open-ended one")
    if payload.end_date:
        end = _parse_date(payload.end_date, "end_date")
        if end < start:
            raise HTTPException(status_code=400, detail="end_date can't be before start_date")

    disbursed = payload.disbursed_amount if payload.disbursed_amount is not None else payload.principal_amount
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "debt_id": f"mydebt_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "name": name,
        "debt_type": payload.debt_type if payload.debt_type in DEBT_TYPES else "loan",
        "lender_name": (payload.lender_name or "").strip(),
        "principal_amount": round(payload.principal_amount, 2),
        "disbursed_amount": round(disbursed, 2),
        "monthly_amount": round(payload.monthly_amount, 2),
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "due_day": payload.due_day or start.day,
        "notes": (payload.notes or "").strip(),
        "status": "active",
        "log_payments_as_expense": payload.log_payments_as_expense,
        "payments": [],
        "created_by": user.user_id, "created_at": now, "updated_at": now,
    }
    await db.my_finance_debts.insert_one(doc)

    if payload.log_as_income and disbursed > 0:
        await db.my_finance_incomes.insert_one({
            "income_id": f"myinc_{uuid.uuid4().hex[:10]}",
            "user_id": user.user_id, "source_type": "debt", "amount": round(disbursed, 2),
            "date": payload.start_date, "debt_id": doc["debt_id"],
            "notes": f'Received from "{name}"', "created_at": now, "updated_at": now,
        })

    doc.pop("_id", None)
    return _serialize_debt(doc, date.today())


@my_finance_router.put("/debts/{debt_id}")
async def update_debt(debt_id: str, payload: DebtUpdate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    existing = await db.my_finance_debts.find_one({"debt_id": debt_id, "user_id": user.user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Debt not found")
    _validate_debt_fields(None, payload.principal_amount, payload.disbursed_amount, payload.monthly_amount, payload.due_day)
    if payload.status is not None and payload.status not in ("active", "closed"):
        raise HTTPException(status_code=400, detail="status must be active or closed")
    if payload.start_date is not None:
        _parse_date(payload.start_date, "start_date")
    if payload.end_date is not None:
        _parse_date(payload.end_date, "end_date")

    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    for money_field in ("principal_amount", "disbursed_amount", "monthly_amount"):
        if money_field in update_data:
            update_data[money_field] = round(update_data[money_field], 2)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.my_finance_debts.update_one({"debt_id": debt_id}, {"$set": update_data})
    updated = await db.my_finance_debts.find_one({"debt_id": debt_id}, {"_id": 0})
    return _serialize_debt(updated, date.today())


@my_finance_router.delete("/debts/{debt_id}")
async def delete_debt(debt_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    result = await db.my_finance_debts.delete_one({"debt_id": debt_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Debt not found")
    return {"message": "Debt deleted"}


@my_finance_router.post("/debts/{debt_id}/payments")
async def add_debt_payment(debt_id: str, payload: DebtPayment, request: Request):
    """Record a payment against one month's due — partial or full, doesn't
    matter, just the amount actually paid. Multiple payments in the same
    period add up (e.g. two partial payments settling one month)."""
    from server import get_current_user, db
    user = await get_current_user(request)
    debt = await db.my_finance_debts.find_one({"debt_id": debt_id, "user_id": user.user_id}, {"_id": 0})
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be more than 0")
    pay_date = payload.date or date.today().isoformat()
    pay_date_obj = _parse_date(pay_date, "date")
    period = payload.period or f"{pay_date_obj.year:04d}-{pay_date_obj.month:02d}"
    try:
        datetime.strptime(period, "%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="period must be YYYY-MM")

    now = datetime.now(timezone.utc).isoformat()
    payment = {
        "payment_id": f"mypay_{uuid.uuid4().hex[:10]}",
        "period": period, "amount": round(payload.amount, 2), "date": pay_date,
        "note": (payload.note or "").strip(), "created_at": now, "expense_id": None,
    }

    # Mirrors log_as_income on creation: a payment going out is an Expense,
    # unless this debt was set up to skip that. Linked by expense_id so
    # undoing the payment below also removes the matching expense.
    if debt.get("log_payments_as_expense", True):
        expense_id = f"myexp_{uuid.uuid4().hex[:10]}"
        await db.my_finance_expenses.insert_one({
            "expense_id": expense_id, "user_id": user.user_id,
            "category": debt.get("name") or "Debt Payment",
            "amount": round(payload.amount, 2), "date": pay_date,
            "notes": f'Payment for {period}' + (f' — {payload.note.strip()}' if payload.note else ''),
            "debt_id": debt_id, "debt_payment_id": payment["payment_id"],
            "created_at": now, "updated_at": now,
        })
        payment["expense_id"] = expense_id

    await db.my_finance_debts.update_one(
        {"debt_id": debt_id},
        {"$push": {"payments": payment}, "$set": {"updated_at": now}},
    )
    updated = await db.my_finance_debts.find_one({"debt_id": debt_id}, {"_id": 0})
    return _serialize_debt(updated, date.today())


@my_finance_router.delete("/debts/{debt_id}/payments/{payment_id}")
async def delete_debt_payment(debt_id: str, payment_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    debt = await db.my_finance_debts.find_one({"debt_id": debt_id, "user_id": user.user_id}, {"_id": 0})
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    payment = next((p for p in debt.get("payments") or [] if p.get("payment_id") == payment_id), None)
    result = await db.my_finance_debts.update_one(
        {"debt_id": debt_id, "user_id": user.user_id},
        {"$pull": {"payments": {"payment_id": payment_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Debt not found")
    # Undo the auto-logged Expense too, if this payment had one.
    if payment and payment.get("expense_id"):
        await db.my_finance_expenses.delete_one({"expense_id": payment["expense_id"], "user_id": user.user_id})
    updated = await db.my_finance_debts.find_one({"debt_id": debt_id}, {"_id": 0})
    return _serialize_debt(updated, date.today())


# ------------------------------------------------------------ Transactions
# One combined, chronological ledger: every Income entry, every Expense entry
# (which already includes auto-logged debt payments — see add_debt_payment),
# plus any debt payment that predates or opted out of that auto-logging, so
# nothing paid or earned is ever missing from the one place that shows it all.

@my_finance_router.get("/transactions")
async def list_transactions(request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)

    incomes = await db.my_finance_incomes.find({"user_id": user.user_id}, {"_id": 0}).to_list(20000)
    expenses = await db.my_finance_expenses.find({"user_id": user.user_id}, {"_id": 0}).to_list(20000)
    debts = await db.my_finance_debts.find({"user_id": user.user_id}, {"_id": 0}).to_list(1000)

    rows = []
    for i in incomes:
        rows.append({
            "type": "income", "date": i["date"], "amount": i["amount"],
            "label": f"Income — {i.get('source_type', 'salary').title()}", "notes": i.get("notes") or "",
            "ref_id": i["income_id"],
        })
    for e in expenses:
        rows.append({
            "type": "expense", "date": e["date"], "amount": -e["amount"],
            "label": f"Expense — {e.get('category', 'General')}", "notes": e.get("notes") or "",
            "ref_id": e["expense_id"],
        })
    for d in debts:
        for p in d.get("payments") or []:
            if p.get("expense_id"):
                continue  # already represented above as its linked Expense row
            rows.append({
                "type": "debt_payment", "date": p["date"], "amount": -p["amount"],
                "label": f'Debt payment — "{d.get("name", "")}" ({p["period"]})', "notes": p.get("note") or "",
                "ref_id": p["payment_id"],
            })

    rows.sort(key=lambda r: r["date"], reverse=True)
    return rows


# ----------------------------------------------------------------- Summary

@my_finance_router.get("/summary")
async def get_summary(request: Request):
    """Dashboard totals: all-time income/expense, and today's outstanding
    debt position across every active debt."""
    from server import get_current_user, db
    user = await get_current_user(request)
    today = date.today()

    incomes = await db.my_finance_incomes.find({"user_id": user.user_id}, {"_id": 0, "amount": 1}).to_list(20000)
    expenses = await db.my_finance_expenses.find({"user_id": user.user_id}, {"_id": 0, "amount": 1}).to_list(20000)
    debts = await db.my_finance_debts.find({"user_id": user.user_id}, {"_id": 0}).to_list(1000)
    serialized = [_serialize_debt(d, today) for d in debts]

    total_income = round(sum(i.get("amount", 0) for i in incomes), 2)
    total_expense = round(sum(e.get("amount", 0) for e in expenses), 2)
    active = [d for d in serialized if d.get("status", "active") == "active"]
    due_this_month = [
        d for d in active
        if any(r["period"] == f"{today.year:04d}-{today.month:02d}" for r in d["schedule"])
    ]
    return {
        "total_income": total_income, "total_expense": total_expense, "net": round(total_income - total_expense, 2),
        "active_debts": len(active),
        "total_outstanding": round(sum(d["summary"]["outstanding"] for d in active), 2),
        "overdue_debts": sum(1 for d in active if d["summary"]["overdue_count"] > 0),
        "due_this_month": [
            {
                "debt_id": d["debt_id"], "name": d["name"],
                **next(r for r in d["schedule"] if r["period"] == f"{today.year:04d}-{today.month:02d}"),
            }
            for d in due_this_month
        ],
    }
