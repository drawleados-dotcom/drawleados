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


def _group_by_parent(docs: list) -> dict:
    by_parent: dict = {}
    for d in docs:
        by_parent.setdefault(d.get("parent_id"), []).append(d)
    return by_parent


def _build_percent_tree(docs: list, spent_map: dict, income: float) -> list:
    """Recursive Top → Sub → Sub-sub (→ ...) tree. Each node's `allocated` is
    `percent`% of its PARENT's allocated amount (top's parent is total income),
    and `spent` rolls up as its own direct spend plus every descendant's."""
    by_parent = _group_by_parent(docs)

    def build(node: dict, parent_allocated: float) -> dict:
        allocated = round(parent_allocated * (float(node.get("percent", 0)) / 100.0), 2)
        children = [build(c, allocated) for c in by_parent.get(node["category_id"], [])]
        own_spent = round(spent_map.get(node["category_id"], 0.0), 2)
        total_spent = round(own_spent + sum(c["spent"] for c in children), 2)
        return {
            **node,
            "allocated": allocated,
            "spent": total_spent,
            "balance": round(allocated - total_spent, 2),
            "over_budget": total_spent > allocated and allocated > 0,
            "sub_categories": children,
        }

    return [build(t, income) for t in by_parent.get(None, [])]


# -------- routes --------
@expense_split_router.get("/categories")
async def list_split_categories(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    """Return all top categories with nested sub-categories (any depth) plus computed budget/spent for the period."""
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

    result = _build_percent_tree(docs, spent_map, income)

    return {
        "month": month,
        "year": year,
        "income": round(income, 2),
        "categories": result,
        "total_allocated_percent": round(sum(float(t.get("percent", 0)) for t in docs if not t.get("parent_id")), 2),
    }


@expense_split_router.post("/categories")
async def create_split_category(payload: SplitCategoryCreate, request: Request):
    await _get_user(request)

    # If parent_id passed, validate it exists. Any category (top or already
    # nested) can be a parent — nesting depth is unlimited, so "Marketing >
    # BNI > Visitor Fee" and deeper are both fine.
    if payload.parent_id:
        parent = await db.expense_split_categories.find_one(
            {"category_id": payload.parent_id, "is_deleted": {"$ne": True}}, {"_id": 0}
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

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

    # Cascade soft-delete to descendants at every depth (nesting is unlimited).
    all_docs = await db.expense_split_categories.find(
        {"is_deleted": {"$ne": True}}, {"_id": 0, "category_id": 1, "parent_id": 1},
    ).to_list(500)
    by_parent = _group_by_parent(all_docs)
    to_delete = [category_id]
    frontier = [category_id]
    while frontier:
        next_frontier = []
        for pid in frontier:
            for child in by_parent.get(pid, []):
                to_delete.append(child["category_id"])
                next_frontier.append(child["category_id"])
        frontier = next_frontier

    await db.expense_split_categories.update_many(
        {"category_id": {"$in": to_delete}},
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

    by_parent = _group_by_parent(docs)

    def build(node: dict) -> dict:
        children = [build(c) for c in by_parent.get(node["category_id"], [])]
        manual = budget_map.get(node["category_id"], 0.0)
        is_payroll = (node.get("name") or "").strip().lower() == "payroll"
        own_budget = manual if manual > 0 else (payroll_auto_total if is_payroll else 0.0)
        total_budget = round(own_budget + sum(c["budget"] for c in children), 2)
        own_spent = round(spent_map.get(node["category_id"], 0.0), 2)
        total_spent = round(own_spent + sum(c["spent"] for c in children), 2)
        return {
            **node,
            "budget": total_budget,
            "spent": total_spent,
            "balance": round(total_budget - total_spent, 2),
            "over_budget": total_spent > total_budget and total_budget > 0,
            "is_auto_budget": is_payroll and manual <= 0 and own_budget > 0,
            "sub_categories": children,
        }

    result = [build(t) for t in by_parent.get(None, [])]

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
