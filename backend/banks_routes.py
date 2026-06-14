"""
Finance Bank Accounts — GST vs Non-GST.

Used by:
- Settings → (no UI; admin-managed via Finance → Banks tab)
- Invoice Collect modal — Bank dropdown filtered by the invoice's `gst_type`.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

banks_router = APIRouter(prefix="/finance/banks")
db = None


def init_banks_db(database):
    global db
    db = database


class BankCreate(BaseModel):
    gst_type: str  # "gst" | "non_gst"
    account_holder: str  # e.g. "Drawlead Pvt Ltd" (GST) or "Latha Babu" (Non-GST)
    bank_name: str = ""
    ifsc_code: str = ""
    account_number: str = ""
    branch: str = ""
    upi: str = ""
    account_type: str = "savings"  # savings | current
    is_active: bool = True


class BankUpdate(BaseModel):
    gst_type: Optional[str] = None
    account_holder: Optional[str] = None
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_number: Optional[str] = None
    branch: Optional[str] = None
    upi: Optional[str] = None
    account_type: Optional[str] = None
    is_active: Optional[bool] = None


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


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    for k in ("created_at", "updated_at"):
        if isinstance(doc.get(k), datetime):
            doc[k] = doc[k].isoformat()
    return doc


@banks_router.get("")
async def list_banks(request: Request, gst_type: Optional[str] = None):
    await _get_user(request)
    query: dict = {"is_deleted": {"$ne": True}}
    if gst_type in ("gst", "non_gst"):
        query["gst_type"] = gst_type
    rows = await db.finance_banks.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [_serialize(r) for r in rows]


@banks_router.post("")
async def create_bank(payload: BankCreate, request: Request):
    user = await _get_user(request)
    if payload.gst_type not in ("gst", "non_gst"):
        raise HTTPException(status_code=400, detail="gst_type must be 'gst' or 'non_gst'")
    if not (payload.account_holder or "").strip():
        raise HTTPException(status_code=400, detail="Account holder name is required")
    doc = {
        "bank_id": f"bank_{uuid.uuid4().hex[:12]}",
        "gst_type": payload.gst_type,
        "account_holder": payload.account_holder.strip(),
        "bank_name": (payload.bank_name or "").strip(),
        "ifsc_code": (payload.ifsc_code or "").strip().upper(),
        "account_number": (payload.account_number or "").strip(),
        "branch": (payload.branch or "").strip(),
        "upi": (payload.upi or "").strip(),
        "account_type": payload.account_type or "savings",
        "is_active": True if payload.is_active is None else bool(payload.is_active),
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_deleted": False,
    }
    await db.finance_banks.insert_one(doc)
    return _serialize(doc)


@banks_router.put("/{bank_id}")
async def update_bank(bank_id: str, payload: BankUpdate, request: Request):
    await _get_user(request)
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "ifsc_code" in update:
        update["ifsc_code"] = str(update["ifsc_code"]).strip().upper()
    if "account_holder" in update:
        v = (update["account_holder"] or "").strip()
        if not v:
            raise HTTPException(status_code=400, detail="Account holder name cannot be empty")
        update["account_holder"] = v
    update["updated_at"] = datetime.now(timezone.utc)
    res = await db.finance_banks.update_one({"bank_id": bank_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bank not found")
    doc = await db.finance_banks.find_one({"bank_id": bank_id}, {"_id": 0})
    return _serialize(doc)


@banks_router.delete("/{bank_id}")
async def delete_bank(bank_id: str, request: Request):
    await _get_user(request)
    res = await db.finance_banks.update_one(
        {"bank_id": bank_id},
        {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bank not found")
    return {"message": "Bank removed"}


# ============== INVOICE COLLECT ==============

class InvoiceCollectPayload(BaseModel):
    amount: float
    date: Optional[str] = None  # ISO date — defaults to today
    payment_mode: str  # "cash" | "upi" | "bank" | "cheque"
    bank_id: Optional[str] = None  # required when payment_mode == "bank"
    notes: Optional[str] = ""


@banks_router.post("/collect/{invoice_id}")
async def collect_invoice(invoice_id: str, payload: InvoiceCollectPayload, request: Request):
    """
    Record a payment against an invoice and create a Cashbook credit entry.
    The bank_id (when payment_mode == 'bank') is validated to match the invoice's gst_type.
    """
    user = await _get_user(request)
    inv = await db.invoices.find_one({"invoice_id": invoice_id, "is_deleted": {"$ne": True}})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if payload.amount is None or payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    bank_doc = None
    if payload.payment_mode == "bank":
        if not payload.bank_id:
            raise HTTPException(status_code=400, detail="Bank account is required for bank payments")
        bank_doc = await db.finance_banks.find_one(
            {"bank_id": payload.bank_id, "is_deleted": {"$ne": True}}, {"_id": 0}
        )
        if not bank_doc:
            raise HTTPException(status_code=400, detail="Selected bank not found")
        # Validate gst_type matches the invoice
        inv_gst = (inv.get("gst_type") or "gst").lower()
        if (bank_doc.get("gst_type") or "").lower() != inv_gst:
            raise HTTPException(
                status_code=400,
                detail=f"This is a {inv_gst.upper()} invoice — please pick a {inv_gst.upper()} bank account.",
            )

    paid_amount = float(inv.get("paid_amount", 0)) + float(payload.amount)
    total = float(inv.get("total_amount", 0))
    new_status = "paid" if paid_amount >= total - 0.01 else ("partial" if paid_amount > 0 else inv.get("status", "sent"))
    payment_date = payload.date or datetime.now(timezone.utc).date().isoformat()
    # The FIRST collection on an invoice is "new revenue"; every subsequent
    # collection (i.e. payment-schedule follow-ups) is "outstanding".
    revenue_kind = "new" if float(inv.get("paid_amount", 0)) == 0 else "outstanding"

    await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {
            "paid_amount": paid_amount,
            "balance_due": max(0.0, total - paid_amount),
            "status": new_status,
            "payment_date": payment_date,
            "payment_mode": payload.payment_mode,
            "payment_bank_id": payload.bank_id,
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    # Record the cash-in entry so it shows up in the Cashbook.
    entry = {
        "entry_id": f"cb_{uuid.uuid4().hex[:12]}",
        "kind": "credit",
        "date": payment_date,
        "from": inv.get("client_name") or inv.get("display_name") or "Invoice payment",
        "category": "invoice",
        "category_label": "Invoice Collected",
        "amount": float(payload.amount),
        "invoice_id": invoice_id,
        "invoice_number": inv.get("invoice_number"),
        "gst_type": inv.get("gst_type") or "gst",
        "payment_mode": payload.payment_mode,
        "bank_id": payload.bank_id,
        "bank_label": (bank_doc or {}).get("account_holder") if bank_doc else None,
        "revenue_kind": revenue_kind,
        "notes": (payload.notes or "").strip(),
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.cashbook_entries.insert_one(entry)
    entry.pop("_id", None)
    if isinstance(entry.get("created_at"), datetime):
        entry["created_at"] = entry["created_at"].isoformat()

    return {
        "message": "Payment collected",
        "invoice_id": invoice_id,
        "paid_amount": paid_amount,
        "balance_due": max(0.0, total - paid_amount),
        "status": new_status,
        "cashbook_entry": entry,
    }


# ============== DASHBOARD AGGREGATIONS ==============

@banks_router.get("/dashboard/bank-breakdown")
async def bank_breakdown(request: Request):
    """
    Returns Cash / Cheque / Bank / Total split by gst_type for the Finance Dashboard.
    `non_gst` is omitted when no Non-GST bank accounts exist (so the UI can render 1 column).
    """
    await _get_user(request)
    has_non_gst_banks = await db.finance_banks.count_documents(
        {"gst_type": "non_gst", "is_deleted": {"$ne": True}}
    ) > 0

    # Load all bank accounts (we'll attach running totals per bank below)
    banks = await db.finance_banks.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0, "bank_id": 1, "account_holder": 1, "bank_name": 1, "gst_type": 1},
    ).sort("created_at", 1).to_list(500)

    # Aggregate cashbook credits — TWO groupings: by payment_mode, AND by bank_id.
    by_mode_pipeline = [
        {"$match": {"kind": "credit"}},
        {"$group": {
            "_id": {"gst_type": {"$ifNull": ["$gst_type", "gst"]}, "mode": {"$ifNull": ["$payment_mode", "bank"]}},
            "amount": {"$sum": "$amount"},
        }},
    ]
    mode_rows = await db.cashbook_entries.aggregate(by_mode_pipeline).to_list(100)

    by_bank_pipeline = [
        {"$match": {"kind": "credit", "payment_mode": "bank", "bank_id": {"$ne": None}}},
        {"$group": {"_id": "$bank_id", "amount": {"$sum": "$amount"}}},
    ]
    bank_totals: dict = {}
    async for row in db.cashbook_entries.aggregate(by_bank_pipeline):
        bank_totals[row["_id"]] = float(row.get("amount", 0))

    def empty():
        return {
            "banks": [],   # [{bank_id, label, amount}]
            "cash": 0.0,
            "cheque": 0.0,
            "upi": 0.0,
            "bank_total": 0.0,  # sum of every bank row
            "total": 0.0,       # cash + cheque + upi + bank_total
        }

    out = {"gst": empty(), "non_gst": empty() if has_non_gst_banks else None}

    # Attach per-bank balances under the right gst bucket
    for b in banks:
        gt = (b.get("gst_type") or "gst").lower()
        if gt not in out or out[gt] is None:
            continue
        label = b.get("account_holder") or b.get("bank_name") or "Bank"
        amt = float(bank_totals.get(b["bank_id"], 0.0))
        out[gt]["banks"].append({"bank_id": b["bank_id"], "label": label, "amount": amt})
        out[gt]["bank_total"] += amt

    # Fold non-bank payment modes (cash / cheque / upi) into their gst bucket
    for row in mode_rows:
        gt = (row["_id"].get("gst_type") or "gst").lower()
        if gt not in out or out[gt] is None:
            continue
        mode = (row["_id"].get("mode") or "bank").lower()
        amount = float(row.get("amount", 0))
        if mode in ("cash", "cheque", "upi"):
            out[gt][mode] += amount

    # Final totals
    for gt in ("gst", "non_gst"):
        if out.get(gt) is None:
            continue
        out[gt]["total"] = out[gt]["bank_total"] + out[gt]["cash"] + out[gt]["cheque"] + out[gt]["upi"]

    # Payment schedule total (sum of uncollected splits across all projects)
    proj_pipeline = [
        {"$match": {"payment_schedule.splits": {"$exists": True}}},
        {"$project": {"_id": 0, "splits": "$payment_schedule.splits"}},
        {"$unwind": "$splits"},
        {"$match": {"$or": [{"splits.collected": False}, {"splits.collected": {"$exists": False}}]}},
        {"$group": {"_id": None, "amount": {"$sum": {"$ifNull": ["$splits.amount", 0]}}}},
    ]
    ps_amount = 0.0
    async for row in db.projects.aggregate(proj_pipeline):
        ps_amount = float(row.get("amount", 0))

    # Revenue split — new (first collection per invoice) vs outstanding (subsequent collections)
    rev_pipeline = [
        {"$match": {"kind": "credit"}},
        {"$group": {"_id": {"$ifNull": ["$revenue_kind", "new"]}, "amount": {"$sum": "$amount"}}},
    ]
    new_revenue = 0.0
    outstanding_collected = 0.0
    async for row in db.cashbook_entries.aggregate(rev_pipeline):
        if row["_id"] == "outstanding":
            outstanding_collected = float(row.get("amount", 0))
        else:
            new_revenue = float(row.get("amount", 0))

    # Total expense — sum across cashbook debits
    total_expense = 0.0
    async for row in db.cashbook_entries.aggregate([
        {"$match": {"kind": "debit"}},
        {"$group": {"_id": None, "amount": {"$sum": "$amount"}}},
    ]):
        total_expense = float(row.get("amount", 0))

    return {
        "has_non_gst_banks": has_non_gst_banks,
        "bank_breakdown": out,
        "payment_schedule_total": ps_amount,
        "new_revenue": new_revenue,
        "outstanding_collected": outstanding_collected,
        "total_revenue": new_revenue + outstanding_collected,
        "total_expense": total_expense,
    }


# ============== CASHBOOK V2 — gst_type-aware, per-bank breakdown ==============

class CashbookEntryPayload(BaseModel):
    kind: str  # "credit" | "debit"
    gst_type: str  # "gst" | "non_gst"
    amount: float
    date: Optional[str] = None  # ISO date — defaults to today
    payment_mode: str = "bank"   # "cash" | "cheque" | "bank" | "upi"
    bank_id: Optional[str] = None
    party: Optional[str] = ""    # "from" for credit, "to" for debit
    category: Optional[str] = ""
    notes: Optional[str] = ""


@banks_router.get("/cashbook/entries")
async def list_cashbook_entries(request: Request, gst_type: str):
    """List all entries for one cashbook (GST or Non-GST) plus per-bank summary."""
    await _get_user(request)
    if gst_type not in ("gst", "non_gst"):
        raise HTTPException(status_code=400, detail="gst_type must be 'gst' or 'non_gst'")

    entries = await db.cashbook_entries.find(
        {"gst_type": gst_type}, {"_id": 0}
    ).sort("date", -1).to_list(5000)
    for e in entries:
        if isinstance(e.get("created_at"), datetime):
            e["created_at"] = e["created_at"].isoformat()

    # Bank lookup so we can label rows + fill missing bank labels
    banks = await db.finance_banks.find(
        {"gst_type": gst_type, "is_deleted": {"$ne": True}},
        {"_id": 0, "bank_id": 1, "account_holder": 1, "bank_name": 1},
    ).to_list(500)
    bank_by_id = {b["bank_id"]: b.get("account_holder") or b.get("bank_name") or "Bank" for b in banks}

    # Per-bank credit / debit roll-ups
    def per_bank_for(kind: str) -> list:
        rollup: dict = {}
        cash_total = 0.0
        cheque_total = 0.0
        upi_total = 0.0
        for e in entries:
            if e.get("kind") != kind:
                continue
            amt = float(e.get("amount", 0))
            mode = (e.get("payment_mode") or "bank").lower()
            if mode == "cash":
                cash_total += amt
            elif mode == "cheque":
                cheque_total += amt
            elif mode == "upi":
                upi_total += amt
            else:  # bank
                bid = e.get("bank_id")
                if bid:
                    rollup[bid] = rollup.get(bid, 0.0) + amt
        rows = []
        for b in banks:
            if b["bank_id"] in rollup:
                rows.append({"bank_id": b["bank_id"], "label": bank_by_id[b["bank_id"]], "amount": rollup[b["bank_id"]]})
        if cash_total > 0:
            rows.append({"bank_id": "__cash__", "label": "Cash", "amount": cash_total})
        if cheque_total > 0:
            rows.append({"bank_id": "__cheque__", "label": "Cheque", "amount": cheque_total})
        if upi_total > 0:
            rows.append({"bank_id": "__upi__", "label": "UPI", "amount": upi_total})
        return rows

    income_rows = per_bank_for("credit")
    expense_rows = per_bank_for("debit")
    income_total = sum(r["amount"] for r in income_rows)
    expense_total = sum(r["amount"] for r in expense_rows)

    return {
        "summary": {
            "income": {"total": income_total, "rows": income_rows},
            "expense": {"total": expense_total, "rows": expense_rows},
            "balance": income_total - expense_total,
        },
        "entries": entries,
        "banks": [{"bank_id": b["bank_id"], "label": bank_by_id[b["bank_id"]]} for b in banks],
    }


@banks_router.post("/cashbook/entries")
async def add_cashbook_entry(payload: CashbookEntryPayload, request: Request):
    user = await _get_user(request)
    if payload.kind not in ("credit", "debit"):
        raise HTTPException(status_code=400, detail="kind must be 'credit' or 'debit'")
    if payload.gst_type not in ("gst", "non_gst"):
        raise HTTPException(status_code=400, detail="gst_type must be 'gst' or 'non_gst'")
    if not payload.amount or payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be > 0")

    bank_label = None
    if payload.payment_mode == "bank":
        if not payload.bank_id:
            raise HTTPException(status_code=400, detail="bank_id required when payment_mode='bank'")
        bank_doc = await db.finance_banks.find_one(
            {"bank_id": payload.bank_id, "is_deleted": {"$ne": True}}, {"_id": 0}
        )
        if not bank_doc:
            raise HTTPException(status_code=400, detail="Bank not found")
        if (bank_doc.get("gst_type") or "").lower() != payload.gst_type:
            raise HTTPException(status_code=400, detail=f"Selected bank is not a {payload.gst_type.upper()} bank")
        bank_label = bank_doc.get("account_holder") or bank_doc.get("bank_name")

    entry = {
        "entry_id": f"cb_{uuid.uuid4().hex[:12]}",
        "kind": payload.kind,
        "gst_type": payload.gst_type,
        "amount": float(payload.amount),
        "date": payload.date or datetime.now(timezone.utc).date().isoformat(),
        "payment_mode": payload.payment_mode,
        "bank_id": payload.bank_id,
        "bank_label": bank_label,
        "from" if payload.kind == "credit" else "to": (payload.party or "").strip(),
        "category": (payload.category or "").strip(),
        "category_label": (payload.category or "").strip(),
        "notes": (payload.notes or "").strip(),
        "revenue_kind": "new" if payload.kind == "credit" else None,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.cashbook_entries.insert_one(entry)
    entry.pop("_id", None)
    if isinstance(entry.get("created_at"), datetime):
        entry["created_at"] = entry["created_at"].isoformat()
    return entry


@banks_router.delete("/cashbook/entries/{entry_id}")
async def delete_cashbook_entry(entry_id: str, request: Request):
    await _get_user(request)
    res = await db.cashbook_entries.delete_one({"entry_id": entry_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry removed"}

