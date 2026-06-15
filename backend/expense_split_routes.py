"""
Expense Split — budget allocation by % of monthly income.

Hierarchy:
  TOP category   → percent_of_income (e.g. Overhead = 30% of monthly income)
  SUB category   → percent_of_parent (e.g. Rent = 50% of Overhead bucket)

The % cap is informational (soft cap). Users may overspend; we just flag it
visually on the frontend. Spend tracking is done by matching cashbook_entries
that were tagged with `split_category_id` (optional field on cashbook docs).
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

expense_split_router = APIRouter(prefix="/finance/expense-split", tags=["finance-expense-split"])


# -------- auth (matches banks_routes pattern) --------
async def _get_user(request: Request):
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


# -------- models --------
class SplitCategoryCreate(BaseModel):
    name: str
    percent: float = Field(ge=0)
    parent_id: Optional[str] = None  # null = top category
    color: Optional[str] = "#6366f1"


class SplitCategoryUpdate(BaseModel):
    name: Optional[str] = None
    percent: Optional[float] = Field(default=None, ge=0)
    color: Optional[str] = None
    order: Optional[int] = None


class BudgetSetPayload(BaseModel):
    amount: float = Field(ge=0)
    month: int
    year: int


# -------- helpers --------
async def _calc_income_for_period(month: int, year: int) -> float:
    """Total Income (credit) from cashbook_entries for the given month/year, GST + Non-GST."""
    # `date` is stored as ISO string YYYY-MM-DD. Use a regex / range match.
    start = f"{year:04d}-{month:02d}-01"
    # next month boundary
    if month == 12:
        end = f"{year + 1:04d}-01-01"
    else:
        end = f"{year:04d}-{month + 1:02d}-01"
    pipeline = [
        {"$match": {"kind": "credit", "date": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    rows = await db.cashbook_entries.aggregate(pipeline).to_list(1)
    return float(rows[0]["total"]) if rows else 0.0


async def _calc_spent_per_category(month: int, year: int) -> dict:
    """Map of split_category_id -> total spent (debit) for the period."""
    start = f"{year:04d}-{month:02d}-01"
    end = f"{year + 1:04d}-01-01" if month == 12 else f"{year:04d}-{month + 1:02d}-01"
    pipeline = [
        {"$match": {
            "kind": "debit",
            "date": {"$gte": start, "$lt": end},
            "split_category_id": {"$ne": None},
        }},
        {"$group": {"_id": "$split_category_id", "total": {"$sum": "$amount"}}},
    ]
    rows = await db.cashbook_entries.aggregate(pipeline).to_list(1000)
    return {r["_id"]: float(r["total"]) for r in rows if r.get("_id")}


# -------- routes --------
@expense_split_router.get("/categories")
async def list_split_categories(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    """Return all top categories with nested sub-categories plus computed budget/spent for the period."""
    await _get_user(request)

    today = datetime.now(timezone.utc)
    month = month or today.month
    year = year or today.year

    docs = await db.expense_split_categories.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0},
    ).sort("order", 1).to_list(500)

    income = await _calc_income_for_period(month, year)
    spent_map = await _calc_spent_per_category(month, year)

    tops = [d for d in docs if not d.get("parent_id")]
    subs_by_parent = {}
    for d in docs:
        if d.get("parent_id"):
            subs_by_parent.setdefault(d["parent_id"], []).append(d)

    result = []
    for t in tops:
        allocated = round(income * (float(t.get("percent", 0)) / 100.0), 2)
        sub_list = []
        for s in subs_by_parent.get(t["category_id"], []):
            sub_alloc = round(allocated * (float(s.get("percent", 0)) / 100.0), 2)
            sub_spent = round(spent_map.get(s["category_id"], 0.0), 2)
            sub_list.append({
                **s,
                "allocated": sub_alloc,
                "spent": sub_spent,
                "balance": round(sub_alloc - sub_spent, 2),
                "over_budget": sub_spent > sub_alloc and sub_alloc > 0,
            })
        top_spent = round(spent_map.get(t["category_id"], 0.0)
                          + sum(s["spent"] for s in sub_list), 2)
        result.append({
            **t,
            "allocated": allocated,
            "spent": top_spent,
            "balance": round(allocated - top_spent, 2),
            "over_budget": top_spent > allocated and allocated > 0,
            "sub_categories": sub_list,
        })

    return {
        "month": month,
        "year": year,
        "income": round(income, 2),
        "categories": result,
        "total_allocated_percent": round(sum(float(t.get("percent", 0)) for t in tops), 2),
    }


@expense_split_router.post("/categories")
async def create_split_category(payload: SplitCategoryCreate, request: Request):
    await _get_user(request)

    # If parent_id passed, validate it exists and is itself a top category.
    if payload.parent_id:
        parent = await db.expense_split_categories.find_one(
            {"category_id": payload.parent_id, "is_deleted": {"$ne": True}}, {"_id": 0}
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
        if parent.get("parent_id"):
            raise HTTPException(status_code=400, detail="Only one level of nesting is supported")

    # Compute order = max existing within same level + 1
    level_filter = {"parent_id": payload.parent_id} if payload.parent_id else {"parent_id": None}
    siblings = await db.expense_split_categories.find(
        {**level_filter, "is_deleted": {"$ne": True}},
    ).sort("order", -1).to_list(1)
    next_order = (siblings[0].get("order", -1) + 1) if siblings else 0

    doc = {
        "category_id": f"esc_{uuid.uuid4().hex[:10]}",
        "name": payload.name.strip(),
        "percent": float(payload.percent),
        "parent_id": payload.parent_id,
        "color": payload.color or "#6366f1",
        "order": next_order,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.expense_split_categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@expense_split_router.put("/categories/{category_id}")
async def update_split_category(category_id: str, payload: SplitCategoryUpdate, request: Request):
    await _get_user(request)
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["updated_at"] = datetime.now(timezone.utc)
    res = await db.expense_split_categories.update_one(
        {"category_id": category_id, "is_deleted": {"$ne": True}},
        {"$set": update},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    doc = await db.expense_split_categories.find_one({"category_id": category_id}, {"_id": 0})
    return doc


@expense_split_router.delete("/categories/{category_id}")
async def delete_split_category(category_id: str, request: Request):
    await _get_user(request)
    cat = await db.expense_split_categories.find_one({"category_id": category_id}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    # Cascade soft-delete to sub-categories
    await db.expense_split_categories.update_many(
        {"$or": [{"category_id": category_id}, {"parent_id": category_id}]},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Category deleted"}


# -------- BUDGET ROUTES --------
# Per-(sub_category, month, year) fixed budget amounts. Independent from the
# %-of-income allocation — used by Expense → Budget sub-tab.

@expense_split_router.get("/budgets")
async def list_budgets(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    """Return all top + sub categories with the fixed Budget amount set for
    the period plus the actual `spent` so the UI can render Allocated / Spent /
    Balance per sub-category."""
    await _get_user(request)
    today = datetime.now(timezone.utc)
    month = month or today.month
    year = year or today.year

    docs = await db.expense_split_categories.find(
        {"is_deleted": {"$ne": True}}, {"_id": 0},
    ).sort("order", 1).to_list(500)

    # Fetch all budget amounts set for this period
    budgets = await db.expense_sub_budgets.find(
        {"month": month, "year": year}, {"_id": 0},
    ).to_list(500)
    budget_map = {b["category_id"]: float(b.get("amount") or 0.0) for b in budgets}

    spent_map = await _calc_spent_per_category(month, year)

    # Auto-budget for any sub-category literally named "Payroll" — sum gross
    # (falling back to net when gross is missing) across every payslip for the
    # period. Manually-set budgets always take precedence over this.
    payroll_auto_total = 0.0
    payslips = await db.payslips.find(
        {"month": month, "year": year},
        {"_id": 0, "base_salary": 1, "net_salary": 1},
    ).to_list(500)
    for p in payslips:
        gross = float(p.get("base_salary") or 0)
        net = float(p.get("net_salary") or 0)
        payroll_auto_total += gross if gross > 0 else net

    tops = [d for d in docs if not d.get("parent_id")]
    subs_by_parent = {}
    for d in docs:
        if d.get("parent_id"):
            subs_by_parent.setdefault(d["parent_id"], []).append(d)

    result = []
    for t in tops:
        sub_list = []
        for s in subs_by_parent.get(t["category_id"], []):
            manual = budget_map.get(s["category_id"], 0.0)
            is_payroll = (s.get("name") or "").strip().lower() == "payroll"
            budget = manual if manual > 0 else (payroll_auto_total if is_payroll else 0.0)
            spent = round(spent_map.get(s["category_id"], 0.0), 2)
            sub_list.append({
                **s,
                "budget": round(budget, 2),
                "spent": spent,
                "balance": round(budget - spent, 2),
                "over_budget": spent > budget and budget > 0,
                "is_auto_budget": is_payroll and manual <= 0 and budget > 0,
            })
        top_budget = round(sum(s["budget"] for s in sub_list) + budget_map.get(t["category_id"], 0.0), 2)
        top_spent = round(spent_map.get(t["category_id"], 0.0)
                          + sum(s["spent"] for s in sub_list), 2)
        result.append({
            **t,
            "budget": top_budget,
            "spent": top_spent,
            "balance": round(top_budget - top_spent, 2),
            "over_budget": top_spent > top_budget and top_budget > 0,
            "sub_categories": sub_list,
        })

    return {"month": month, "year": year, "categories": result}


@expense_split_router.put("/budgets/{category_id}")
async def set_budget(category_id: str, payload: BudgetSetPayload, request: Request):
    """Upsert the Budget amount for one (sub) category for a given month/year."""
    user = await _get_user(request)
    cat = await db.expense_split_categories.find_one(
        {"category_id": category_id, "is_deleted": {"$ne": True}}, {"_id": 0},
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.expense_sub_budgets.update_one(
        {"category_id": category_id, "month": payload.month, "year": payload.year},
        {"$set": {
            "category_id": category_id,
            "month": int(payload.month),
            "year": int(payload.year),
            "amount": float(payload.amount),
            "updated_at": datetime.now(timezone.utc),
            "updated_by": user["user_id"],
        }},
        upsert=True,
    )
    return {"message": "Budget updated", "amount": float(payload.amount)}
