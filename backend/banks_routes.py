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
    amount: Optional[float] = None  # required when allocations is absent
    date: Optional[str] = None  # ISO date — defaults to today
    payment_mode: Optional[str] = None  # "cash" | "upi" | "bank" | "cheque" — required when allocations absent
    bank_id: Optional[str] = None  # required when payment_mode == "bank"
    notes: Optional[str] = ""
    # NEW: multi-source allocator — when present, overrides amount/payment_mode/bank_id.
    allocations: Optional[List[dict]] = None


@banks_router.post("/collect/{invoice_id}")
async def collect_invoice(invoice_id: str, payload: InvoiceCollectPayload, request: Request):
    """
    Record one or more payments against an invoice and create matching
    Cashbook credit entries. Supports two shapes:
    - Single source: amount + payment_mode (+ bank_id) — legacy.
    - Multi-source : allocations=[{source, bank_id?, amount}] — splits the
      collection across multiple cash / bank / cheque sources.
    """
    user = await _get_user(request)
    inv = await db.invoices.find_one({"invoice_id": invoice_id, "is_deleted": {"$ne": True}})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Build a normalized list of (source, bank_id, amount) tuples.
    items: List[dict] = []
    if payload.allocations:
        for a in payload.allocations:
            src = (a.get("source") or "").lower()
            amt = float(a.get("amount") or 0)
            if amt <= 0:
                raise HTTPException(status_code=400, detail="Each allocation amount must be > 0")
            if src not in ("cash", "cheque", "upi", "bank"):
                raise HTTPException(status_code=400, detail=f"Invalid source: {src}")
            if src == "bank" and not a.get("bank_id"):
                raise HTTPException(status_code=400, detail="bank_id required for bank source")
            items.append({"source": src, "bank_id": a.get("bank_id"), "amount": amt})
    else:
        if not payload.amount or payload.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be > 0")
        if not payload.payment_mode:
            raise HTTPException(status_code=400, detail="payment_mode is required")
        items.append({
            "source": payload.payment_mode,
            "bank_id": payload.bank_id,
            "amount": float(payload.amount),
        })

    total_collect = sum(i["amount"] for i in items)

    inv_gst = (inv.get("gst_type") or "gst").lower()
    bank_doc_cache: dict = {}
    for it in items:
        if it["source"] == "bank":
            doc = await db.finance_banks.find_one(
                {"bank_id": it["bank_id"], "is_deleted": {"$ne": True}}, {"_id": 0}
            )
            if not doc:
                raise HTTPException(status_code=400, detail="Selected bank not found")
            if (doc.get("gst_type") or "").lower() != inv_gst:
                raise HTTPException(status_code=400, detail=f"This is a {inv_gst.upper()} invoice — please pick a {inv_gst.upper()} bank account.")
            bank_doc_cache[it["bank_id"]] = doc

    paid_amount = float(inv.get("paid_amount", 0)) + total_collect
    total = float(inv.get("total_amount", 0))
    new_status = "paid" if paid_amount >= total - 0.01 else ("partial" if paid_amount > 0 else inv.get("status", "sent"))
    payment_date = payload.date or datetime.now(timezone.utc).date().isoformat()
    revenue_kind = "new" if float(inv.get("paid_amount", 0)) == 0 else "outstanding"

    await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {
            "paid_amount": paid_amount,
            "balance_due": max(0.0, total - paid_amount),
            "status": new_status,
            "paid_percent": round((paid_amount / total) * 100, 1) if total > 0 else 0,
            "payment_date": payment_date,
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    inserted: List[dict] = []
    income_group_id = f"inc_{uuid.uuid4().hex[:12]}" if len(items) > 1 else None
    for it in items:
        bank_label = (bank_doc_cache.get(it["bank_id"]) or {}).get("account_holder") if it["source"] == "bank" else None
        entry = {
            "entry_id": f"cb_{uuid.uuid4().hex[:12]}",
            "kind": "credit",
            "date": payment_date,
            "from": inv.get("client_name") or inv.get("display_name") or "Invoice payment",
            "category": "invoice",
            "category_label": "Invoice Collected",
            "amount": it["amount"],
            "invoice_id": invoice_id,
            "invoice_number": inv.get("invoice_number"),
            "gst_type": inv_gst,
            "payment_mode": it["source"],
            "bank_id": it["bank_id"] if it["source"] == "bank" else None,
            "bank_label": bank_label,
            "revenue_kind": revenue_kind,
            "income_group_id": income_group_id,
            "notes": (payload.notes or "").strip(),
            "created_by": user["user_id"],
            "created_at": datetime.now(timezone.utc),
        }
        await db.cashbook_entries.insert_one(entry)
        entry.pop("_id", None)
        if isinstance(entry.get("created_at"), datetime):
            entry["created_at"] = entry["created_at"].isoformat()
        inserted.append(entry)

    return {
        "message": "Payment collected",
        "invoice_id": invoice_id,
        "paid_amount": paid_amount,
        "balance_due": max(0.0, total - paid_amount),
        "paid_percent": round((paid_amount / total) * 100, 1) if total > 0 else 0,
        "status": new_status,
        "entries": inserted,
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

    # Aggregate cashbook entries — TWO groupings: by payment_mode, AND by bank_id.
    # IMPORTANT: balance = Σ credits − Σ debits, NOT just credits. Without this,
    # the dashboard kept showing positive balances even when debits had fully
    # offset the credits (the bug behind "Income/Expense = 0 but Cash in Total
    # Book = ₹41,300"). Pure-ledger entries (`payment_mode='ledger'`, used by
    # the AI Credits flow) never move money so they're excluded from balances.
    by_mode_pipeline = [
        {"$match": {"payment_mode": {"$ne": "ledger"}}},
        {"$group": {
            "_id": {"gst_type": {"$ifNull": ["$gst_type", "gst"]}, "mode": {"$ifNull": ["$payment_mode", "bank"]}},
            "amount": {"$sum": {"$cond": [{"$eq": ["$kind", "credit"]}, "$amount", {"$multiply": ["$amount", -1]}]}},
        }},
    ]
    mode_rows = await db.cashbook_entries.aggregate(by_mode_pipeline).to_list(100)

    by_bank_pipeline = [
        {"$match": {"payment_mode": "bank", "bank_id": {"$ne": None}}},
        {"$group": {
            "_id": "$bank_id",
            "amount": {"$sum": {"$cond": [{"$eq": ["$kind", "credit"]}, "$amount", {"$multiply": ["$amount", -1]}]}},
        }},
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


# ============== MULTI-SOURCE EXPENSE (allocated across cash / cheque / banks) ==============

class ExpenseAllocation(BaseModel):
    # `source` is "cash" | "cheque" | "upi" | "bank"
    source: str
    bank_id: Optional[str] = None  # required when source == "bank"
    amount: float


# ============== INVOICE REQUESTS (from Leads → Invoice Raise) ==============

class InvoiceRequestPayload(BaseModel):
    lead_id: Optional[str] = None
    gst_type: str  # "gst" | "non_gst"
    company_name: str
    lead_name: str = ""
    gst_number: str = ""
    billing_address: str = ""
    amount: float = 0
    payment_mode: str = ""  # "cash" | "upi" | "bank" | "cheque"
    notes: str = ""


@banks_router.get("/invoice-requests")
async def list_invoice_requests(request: Request, status: Optional[str] = None):
    await _get_user(request)
    q: dict = {"is_deleted": {"$ne": True}}
    if status:
        q["status"] = status
    rows = await db.invoice_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    for r in rows:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    return rows


@banks_router.post("/invoice-requests")
async def create_invoice_request(payload: InvoiceRequestPayload, request: Request):
    user = await _get_user(request)
    if payload.gst_type not in ("gst", "non_gst"):
        raise HTTPException(status_code=400, detail="gst_type must be 'gst' or 'non_gst'")
    if not (payload.company_name or "").strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    doc = {
        "request_id": f"invreq_{uuid.uuid4().hex[:12]}",
        "lead_id": payload.lead_id,
        "gst_type": payload.gst_type,
        "company_name": payload.company_name.strip(),
        "lead_name": (payload.lead_name or "").strip(),
        "gst_number": (payload.gst_number or "").strip().upper(),
        "billing_address": (payload.billing_address or "").strip(),
        "amount": float(payload.amount or 0),
        "payment_mode": (payload.payment_mode or "").lower(),
        "notes": (payload.notes or "").strip(),
        "status": "pending",  # pending | invoiced | rejected
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "is_deleted": False,
    }
    await db.invoice_requests.insert_one(doc)
    doc.pop("_id", None)
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


@banks_router.patch("/invoice-requests/{request_id}")
async def update_invoice_request(request_id: str, payload: dict, request: Request):
    await _get_user(request)
    update = {k: v for k, v in (payload or {}).items() if v is not None and k not in ("request_id", "created_at", "_id")}
    update["updated_at"] = datetime.now(timezone.utc)
    res = await db.invoice_requests.update_one({"request_id": request_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    doc = await db.invoice_requests.find_one({"request_id": request_id}, {"_id": 0})
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


@banks_router.post("/invoice-requests/{request_id}/mark-invoiced")
async def mark_request_invoiced(request_id: str, request: Request):
    user = await _get_user(request)
    res = await db.invoice_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "invoiced", "invoiced_at": datetime.now(timezone.utc), "invoiced_by": user["user_id"]}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"message": "Marked invoiced"}


@banks_router.delete("/invoice-requests/{request_id}")
async def delete_invoice_request(request_id: str, request: Request):
    await _get_user(request)
    res = await db.invoice_requests.update_one(
        {"request_id": request_id},
        {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"message": "Request removed"}


class GroupedExpensePayload(BaseModel):
    gst_type: str
    date: Optional[str] = None
    party: Optional[str] = ""
    category: Optional[str] = ""
    notes: Optional[str] = ""
    # Expense Split tagging — used to populate the budget's "Spent" column.
    split_category_id: Optional[str] = None       # sub-category if chosen, else top
    split_top_category_id: Optional[str] = None   # top category always (for rollup display)
    # When this expense pays a payroll payslip, the cashbook entry flips that
    # payslip's status to `paid` so the HR module stays in sync.
    payslip_id: Optional[str] = None
    allocations: List[ExpenseAllocation]


async def _balance_for(gst_type: str, source: str, bank_id: Optional[str] = None) -> float:
    """Compute the available running balance for one source (Σ credits − Σ debits).

    Entries with payment_mode='ledger' are excluded — they are pure ledger
    records (e.g. AI Credits recorded as expense) that don't move money.
    """
    base = {"gst_type": gst_type, "payment_mode": {"$ne": "ledger"}}
    if source == "bank":
        base["payment_mode"] = "bank"
        base["bank_id"] = bank_id
    else:
        base["payment_mode"] = source
    credits = 0.0
    debits = 0.0
    async for r in db.cashbook_entries.aggregate([
        {"$match": {**base, "kind": "credit"}},
        {"$group": {"_id": None, "amount": {"$sum": "$amount"}}},
    ]):
        credits = float(r.get("amount", 0))
    async for r in db.cashbook_entries.aggregate([
        {"$match": {**base, "kind": "debit"}},
        {"$group": {"_id": None, "amount": {"$sum": "$amount"}}},
    ]):
        debits = float(r.get("amount", 0))
    return credits - debits


@banks_router.get("/cashbook/balances")
async def cashbook_balances(request: Request, gst_type: str):
    """Return current running balance per source (cash, cheque, upi, each bank)."""
    await _get_user(request)
    if gst_type not in ("gst", "non_gst"):
        raise HTTPException(status_code=400, detail="gst_type must be 'gst' or 'non_gst'")
    banks = await db.finance_banks.find(
        {"gst_type": gst_type, "is_deleted": {"$ne": True}},
        {"_id": 0, "bank_id": 1, "account_holder": 1, "bank_name": 1},
    ).to_list(500)
    out = {
        "cash": {"source": "cash", "label": "Cash", "balance": await _balance_for(gst_type, "cash")},
        "cheque": {"source": "cheque", "label": "Cheque", "balance": await _balance_for(gst_type, "cheque")},
        "upi": {"source": "upi", "label": "UPI", "balance": await _balance_for(gst_type, "upi")},
        "banks": [],
    }
    for b in banks:
        out["banks"].append({
            "source": "bank",
            "bank_id": b["bank_id"],
            "label": b.get("account_holder") or b.get("bank_name") or "Bank",
            "balance": await _balance_for(gst_type, "bank", b["bank_id"]),
        })
    return out


@banks_router.post("/cashbook/expense")
async def add_grouped_expense(payload: GroupedExpensePayload, request: Request):
    """Record an expense split across N sources. Each allocation becomes one
    cashbook debit entry stamped with the same `expense_group_id`. Validates
    that every source has enough running balance to cover its share."""
    user = await _get_user(request)
    if payload.gst_type not in ("gst", "non_gst"):
        raise HTTPException(status_code=400, detail="gst_type must be 'gst' or 'non_gst'")
    if not payload.allocations:
        raise HTTPException(status_code=400, detail="At least one allocation is required")
    # Validate amounts
    total = 0.0
    for a in payload.allocations:
        if a.amount is None or a.amount <= 0:
            raise HTTPException(status_code=400, detail="Each allocation amount must be > 0")
        if a.source not in ("cash", "cheque", "upi", "bank"):
            raise HTTPException(status_code=400, detail=f"Invalid source: {a.source}")
        if a.source == "bank" and not a.bank_id:
            raise HTTPException(status_code=400, detail="bank_id required for bank source")
        total += float(a.amount)

    # Balance check per allocation
    bank_label_cache: dict = {}
    for a in payload.allocations:
        avail = await _balance_for(payload.gst_type, a.source, a.bank_id)
        if a.amount > avail + 0.0001:
            label = a.source
            if a.source == "bank":
                doc = await db.finance_banks.find_one({"bank_id": a.bank_id}, {"_id": 0, "account_holder": 1, "bank_name": 1, "gst_type": 1})
                if not doc or doc.get("gst_type") != payload.gst_type:
                    raise HTTPException(status_code=400, detail="Selected bank does not belong to this cashbook")
                label = doc.get("account_holder") or doc.get("bank_name") or "Bank"
                bank_label_cache[a.bank_id] = label
            raise HTTPException(
                status_code=400,
                detail=f"{label.capitalize()} balance is only ₹{avail:,.0f} — cannot release ₹{a.amount:,.0f}",
            )

    # Persist — one entry per allocation, all sharing the same group_id
    group_id = f"exp_{uuid.uuid4().hex[:12]}"
    date_str = payload.date or datetime.now(timezone.utc).date().isoformat()
    inserted = []
    for a in payload.allocations:
        bank_label = None
        if a.source == "bank":
            bank_label = bank_label_cache.get(a.bank_id)
            if not bank_label:
                doc = await db.finance_banks.find_one({"bank_id": a.bank_id}, {"_id": 0, "account_holder": 1, "bank_name": 1})
                bank_label = (doc or {}).get("account_holder") or (doc or {}).get("bank_name") or "Bank"
        entry = {
            "entry_id": f"cb_{uuid.uuid4().hex[:12]}",
            "kind": "debit",
            "gst_type": payload.gst_type,
            "amount": float(a.amount),
            "date": date_str,
            "payment_mode": a.source,
            "bank_id": a.bank_id if a.source == "bank" else None,
            "bank_label": bank_label,
            "to": (payload.party or "").strip(),
            "category": (payload.category or "").strip(),
            "category_label": (payload.category or "").strip(),
            "notes": (payload.notes or "").strip(),
            "split_category_id": payload.split_category_id,
            "split_top_category_id": payload.split_top_category_id,
            "expense_group_id": group_id,
            "expense_group_total": total,
            "payslip_id": payload.payslip_id,
            "created_by": user["user_id"],
            "created_at": datetime.now(timezone.utc),
        }
        await db.cashbook_entries.insert_one(entry)
        entry.pop("_id", None)
        if isinstance(entry.get("created_at"), datetime):
            entry["created_at"] = entry["created_at"].isoformat()
        inserted.append(entry)

    # If this expense was paying a generated payslip, flip it to paid.
    if payload.payslip_id:
        await db.payslips.update_one(
            {"payslip_id": payload.payslip_id, "status": "generated"},
            {"$set": {
                "status": "paid",
                "paid_by": user["user_id"],
                "paid_at": datetime.now(timezone.utc),
                "paid_via_expense_group_id": group_id,
                "updated_at": datetime.now(timezone.utc),
            }},
        )

    return {"expense_group_id": group_id, "total": total, "entries": inserted}


@banks_router.get("/cashbook/expense/{group_id}")
async def get_grouped_expense(group_id: str, request: Request):
    """Return all entries in an expense group (for the eye-button summary)."""
    await _get_user(request)
    rows = await db.cashbook_entries.find(
        {"expense_group_id": group_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(50)
    for r in rows:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    if not rows:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"group_id": group_id, "total": rows[0].get("expense_group_total"), "entries": rows}



# -----------------------------------------------------------------------------
# AI Credits ledger flow
# -----------------------------------------------------------------------------
# When the user picks the "AI Credits" sub-category in the Add Expense popup,
# they don't enter an amount/bank manually. Instead they pick a project, then
# select one or more of that project's Credits rows. Each selected row is
# recorded as a SEPARATE expense entry, each dated to its own credit date.
# This is a pure ledger record — no bank/cash balance is deducted because the
# AI credits have already been paid for outside the cashbook.
#
# A new cashbook entry payment_mode 'ledger' is introduced and explicitly
# excluded from the balance calculations above (see `_balance_for`).
# -----------------------------------------------------------------------------


@banks_router.get("/ai-credits/eligible-projects")
async def list_ai_credit_eligible_projects(request: Request):
    """Return all projects that still have credit rows with status='created'."""
    await _get_user(request)
    cursor = db.projects.find(
        {"project_expense.credits": {"$exists": True, "$ne": []}},
        {"_id": 0, "project_id": 1, "name": 1, "project_expense": 1},
    )
    out = []
    async for p in cursor:
        creds = ((p.get("project_expense") or {}).get("credits") or [])
        pending = [
            c for c in creds
            if (c.get("status") or "created") not in ("expense_record",)
        ]
        if not pending:
            continue
        out.append({
            "project_id": p["project_id"],
            "name": p.get("name") or "Untitled Project",
            "pending_count": len(pending),
            "pending_amount": float(sum(float(c.get("amount") or 0) for c in pending)),
        })
    out.sort(key=lambda x: x["name"].lower())
    return out


@banks_router.get("/ai-credits/eligible-credits/{project_id}")
async def list_ai_credit_eligible_credits(project_id: str, request: Request):
    """Return the credit rows for a project that haven't yet been recorded as expense."""
    await _get_user(request)
    proj = await db.projects.find_one(
        {"project_id": project_id},
        {"_id": 0, "project_id": 1, "name": 1, "project_expense": 1},
    )
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    creds = ((proj.get("project_expense") or {}).get("credits") or [])
    pending = [
        c for c in creds
        if (c.get("status") or "created") != "expense_record"
    ]
    return {
        "project_id": project_id,
        "project_name": proj.get("name") or "",
        "credits": pending,
    }


class AICreditsRecordPayload(BaseModel):
    project_id: str
    credit_ids: List[str]
    gst_type: str = "non_gst"  # Default to non-GST since these are usually internal expenses
    split_category_id: Optional[str] = None       # AI Credits sub-category id
    split_top_category_id: Optional[str] = None   # parent top category id
    notes: Optional[str] = ""


@banks_router.post("/ai-credits/record")
async def record_ai_credits_as_expense(payload: AICreditsRecordPayload, request: Request):
    """Mark selected project credit rows as company expense entries.

    For each selected credit row this creates ONE cashbook_entry with
    payment_mode='ledger' (no bank impact) dated to the credit's own date.
    Also flips that credit row's status to 'expense_record' inside the
    project document so the project UI shows it as already recorded.
    """
    user = await _get_user(request)
    if not payload.credit_ids:
        raise HTTPException(status_code=400, detail="Pick at least one credit row")
    proj = await db.projects.find_one(
        {"project_id": payload.project_id},
        {"_id": 0, "project_id": 1, "name": 1, "project_expense": 1},
    )
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    project_name = proj.get("name") or ""
    creds = ((proj.get("project_expense") or {}).get("credits") or [])
    by_id = {c.get("id"): c for c in creds if isinstance(c, dict)}

    # Pre-validate every requested credit exists and isn't already recorded.
    selected = []
    for cid in payload.credit_ids:
        c = by_id.get(cid)
        if not c:
            raise HTTPException(status_code=400, detail=f"Credit row {cid} not found")
        if (c.get("status") or "created") == "expense_record":
            raise HTTPException(status_code=400, detail=f"Credit row {cid} is already recorded")
        amt = float(c.get("amount") or 0)
        if amt <= 0:
            raise HTTPException(status_code=400, detail=f"Credit row {cid} has zero amount")
        selected.append(c)

    group_id = f"aic_{uuid.uuid4().hex[:12]}"
    total = float(sum(float(c.get("amount") or 0) for c in selected))
    inserted = []
    for c in selected:
        amt = float(c.get("amount") or 0)
        entry = {
            "entry_id": f"cb_{uuid.uuid4().hex[:12]}",
            "kind": "debit",
            "gst_type": payload.gst_type if payload.gst_type in ("gst", "non_gst") else "non_gst",
            "amount": amt,
            "date": c.get("date") or datetime.now(timezone.utc).date().isoformat(),
            "payment_mode": "ledger",  # excluded from bank balance computation
            "bank_id": None,
            "bank_label": None,
            "to": project_name,
            "category": f"AI Credits · {c.get('label') or 'Credit'}",
            "category_label": "AI Credits",
            "notes": (payload.notes or "").strip() or f"Project: {project_name} · Credit row {c.get('id')}",
            "split_category_id": payload.split_category_id,
            "split_top_category_id": payload.split_top_category_id,
            "expense_group_id": group_id,
            "expense_group_total": total,
            "expense_source": "ai_credits",
            "source_project_id": payload.project_id,
            "source_credit_id": c.get("id"),
            "created_by": user["user_id"],
            "created_at": datetime.now(timezone.utc),
        }
        await db.cashbook_entries.insert_one(entry)
        entry.pop("_id", None)
        if isinstance(entry.get("created_at"), datetime):
            entry["created_at"] = entry["created_at"].isoformat()
        inserted.append(entry)

    # Flip the credit row statuses on the project document.
    selected_ids = {c.get("id") for c in selected}
    new_creds = []
    for c in creds:
        if c.get("id") in selected_ids:
            new_creds.append({
                **c,
                "status": "expense_record",
                "recorded_expense_group_id": group_id,
                "recorded_at": datetime.now(timezone.utc).isoformat(),
                "recorded_by": user["user_id"],
            })
        else:
            new_creds.append(c)
    new_state = {**(proj.get("project_expense") or {}), "credits": new_creds}
    await db.projects.update_one(
        {"project_id": payload.project_id},
        {"$set": {"project_expense": new_state, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {
        "expense_group_id": group_id,
        "project_id": payload.project_id,
        "total": total,
        "rows_recorded": len(inserted),
        "entries": inserted,
    }
