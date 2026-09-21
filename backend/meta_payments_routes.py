"""
Meta Ads "Payment History" — the per-project payment log behind the Payment
History tab (Projects > Meta Ads > Payment History).

A payment is money put into the project's ad wallet, so payments are stored in
the SAME collection as the Performance View's wallet recharges
(`meta_ads_recharges`): a payment added here raises "Amount Recharged" and the
wallet balance there, and every recharge logged there shows up here (without
the extra fields). Each payment also records where it came from — paid
directly by the client, or by the agency — who paid, and a reference number.

Balance follows the Performance View's definition: everything paid in, minus
everything spent according to the daily Meta reports. Removing a payment uses
the existing DELETE /meta-reports/recharges/{recharge_id}.
"""
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import math
import uuid

from meta_reports_routes import (
    _clean_date, _in_range, _num, _sum_reports,
    _require_project_access, _require_recharge_editor,
)

meta_payments_router = APIRouter(prefix="/meta-payments", tags=["meta-payments"])

PAYMENT_SOURCES = {"client": "Direct Payment from Client", "agency": "Agency"}


class PaymentCreate(BaseModel):
    project_id: str
    date: str  # date of payment, YYYY-MM-DD
    amount: float
    payment_source: str  # "client" | "agency"
    paid_by: Optional[str] = ""
    reference_number: Optional[str] = ""


def build_payment_doc(payload: PaymentCreate, user_id: str, user_name: str, now_iso: str) -> dict:
    """Validate a payment and turn it into the stored recharge document."""
    date = _clean_date(payload.date, "date")
    if not date:
        raise HTTPException(status_code=400, detail="Date of payment is required")
    if not math.isfinite(payload.amount) or payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    if payload.payment_source not in PAYMENT_SOURCES:
        raise HTTPException(status_code=400, detail="Choose Direct Payment from Client or Agency")
    return {
        "recharge_id": f"rch_{uuid.uuid4().hex[:10]}",
        "project_id": payload.project_id,
        "date": date,
        "amount": round(float(payload.amount), 2),
        "note": "",
        "payment_source": payload.payment_source,
        "paid_by": (payload.paid_by or "").strip()[:120],
        "reference_number": (payload.reference_number or "").strip()[:120],
        "created_by": user_id,
        "created_by_name": user_name or "",
        "created_at": now_iso,
    }


def summarize(payments: list, recharges_all: list, reports: list, start: Optional[str], end: Optional[str]) -> dict:
    """Period totals for `payments` plus the all-time wallet position."""
    by_source = {"client": 0.0, "agency": 0.0, "other": 0.0}
    for p in payments:
        src = p.get("payment_source")
        by_source[src if src in PAYMENT_SOURCES else "other"] += _num(p.get("amount"))
    period_spend = _sum_reports(reports, start, end)[0]["spend"]
    paid_all = sum(_num(c.get("amount")) for c in recharges_all)
    spend_all = _sum_reports(reports, None, None)[0]["spend"]
    return {
        "totals": {
            "paid": round(sum(by_source.values()), 2),
            "client": round(by_source["client"], 2),
            "agency": round(by_source["agency"], 2),
            "other": round(by_source["other"], 2),
            "spent": round(period_spend, 2),
            "count": len(payments),
        },
        "wallet": {
            "paid_all": round(paid_all, 2),
            "spend_all": round(spend_all, 2),
            "balance": round(paid_all - spend_all, 2),
        },
    }


@meta_payments_router.get("/{project_id}")
async def list_payments(
    project_id: str,
    request: Request,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
):
    from server import get_current_user, db
    user = await get_current_user(request)
    await _require_project_access(user, db, project_id)
    start = _clean_date(from_date, "from")
    end = _clean_date(to_date, "to")
    if start and end and start > end:
        raise HTTPException(status_code=400, detail="from must not be after to")
    ranged = bool(start or end)

    recharges = await db.meta_ads_recharges.find({"project_id": project_id}, {"_id": 0}).to_list(5000)
    reports = await db.meta_ads_reports.find({"project_id": project_id}, {"_id": 0, "date": 1, "entries": 1}).to_list(20000)
    payments = sorted(
        [c for c in recharges if not ranged or _in_range(c.get("date"), start, end)],
        key=lambda c: (c.get("date") or "", c.get("created_at") or ""), reverse=True,
    )
    return {
        "from": start, "to": end,
        "payments": [
            {k: c.get(k) for k in ("recharge_id", "date", "amount", "payment_source", "paid_by", "reference_number", "note", "created_by_name")}
            for c in payments
        ],
        **summarize(payments, recharges, reports, start, end),
    }


@meta_payments_router.post("")
async def add_payment(payload: PaymentCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    await _require_recharge_editor(user, db)
    project = await _require_project_access(user, db, payload.project_id)
    if "meta" not in (project.get("departments") or []):
        raise HTTPException(status_code=400, detail="Payments are only tracked for Meta Ads projects")
    doc = build_payment_doc(payload, user.user_id, getattr(user, "name", "") or "", datetime.now(timezone.utc).isoformat())
    await db.meta_ads_recharges.insert_one(dict(doc))
    return doc
