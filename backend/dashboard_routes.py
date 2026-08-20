"""
Dashboard weekly summary — aggregates Finance (Cashbook), Sales (Leads),
and Marketing (Content Calendar) into a single week-at-a-time view for
the Super Admin / Admin landing page ("24 Weeks Challenge" tracker).

Week window is computed on the fly from a reference date + a
configurable week-start-day (Python weekday(): Monday=0 ... Sunday=6),
defaulting to Tuesday (1) — no fixed anchor date, unlike the Cashbook's
own Week Wise numbering.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timedelta, date, timezone

dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])

PLATFORMS = ["instagram", "facebook", "x", "linkedin", "youtube"]

DEFAULT_TARGETS = {
    "income": 0, "expense": 0,
    "inbound_lead": 0, "outbound_prospect": 0, "one_to_one": 0, "appointment": 0, "sales": 0,
    "marketing_vinoth": {p: 0 for p in PLATFORMS},
    "marketing_drawlead": {p: 0 for p in PLATFORMS},
}


class TargetsUpdate(BaseModel):
    income: Optional[float] = None
    expense: Optional[float] = None
    inbound_lead: Optional[float] = None
    outbound_prospect: Optional[float] = None
    one_to_one: Optional[float] = None
    appointment: Optional[float] = None
    sales: Optional[float] = None
    marketing_vinoth: Optional[Dict[str, float]] = None
    marketing_drawlead: Optional[Dict[str, float]] = None


def _week_bounds(ref: date, week_start_day: int):
    offset = (ref.weekday() - week_start_day) % 7
    start = ref - timedelta(days=offset)
    end = start + timedelta(days=6)
    return start, end


def _day_key(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value[:10] if len(value) >= 10 else value
    try:
        return value.date().isoformat() if hasattr(value, "date") else str(value)[:10]
    except Exception:
        return None


@dashboard_router.get("/weekly")
async def get_weekly_dashboard(request: Request, date_str: Optional[str] = None, week_start_day: int = 1):
    from server import get_current_user, db
    await get_current_user(request)

    try:
        ref_date = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else datetime.now(timezone.utc).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="date_str must be YYYY-MM-DD")
    week_start_day = max(0, min(6, week_start_day))

    start, end = _week_bounds(ref_date, week_start_day)
    start_iso, end_iso = start.isoformat(), end.isoformat()
    today_iso = datetime.now(timezone.utc).date().isoformat()

    day_start_dt = datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc)
    day_end_dt = datetime.combine(end + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc)
    day_start_iso, day_end_iso = day_start_dt.isoformat(), day_end_dt.isoformat()

    # ---- Finance: cashbook_entries (kind=credit/debit) grouped by date.
    # Credit entries linked to an invoice (`invoice_id`) are grouped by that
    # invoice's `invoice_date` instead of the entry's own payment date;
    # unlinked credits (e.g. manual Cash In) and all debits use their own
    # `date` as before. ----
    income_by_day, expense_by_day = {}, {}

    window_invoices = await db.invoices.find(
        {"invoice_date": {"$gte": day_start_dt, "$lt": day_end_dt}},
        {"_id": 0, "invoice_id": 1, "invoice_date": 1},
    ).to_list(20000)
    invoice_date_by_id = {i["invoice_id"]: _day_key(i.get("invoice_date")) for i in window_invoices}
    if invoice_date_by_id:
        async for e in db.cashbook_entries.find(
            {"kind": "credit", "invoice_id": {"$in": list(invoice_date_by_id)}},
            {"_id": 0, "amount": 1, "invoice_id": 1},
        ):
            d = invoice_date_by_id.get(e.get("invoice_id"))
            if d:
                income_by_day[d] = income_by_day.get(d, 0) + float(e.get("amount", 0) or 0)

    cashbook_entries = await db.cashbook_entries.find(
        {"date": {"$gte": start_iso, "$lte": end_iso}},
        {"_id": 0, "date": 1, "kind": 1, "amount": 1, "invoice_id": 1},
    ).to_list(20000)
    for e in cashbook_entries:
        d = _day_key(e.get("date"))
        if not d:
            continue
        amt = float(e.get("amount", 0) or 0)
        if e.get("kind") == "credit":
            if not e.get("invoice_id"):
                income_by_day[d] = income_by_day.get(d, 0) + amt
        elif e.get("kind") == "debit":
            expense_by_day[d] = expense_by_day.get(d, 0) + amt

    # Cash in Bank — opening balance (sum of bank account initial balances)
    # plus cumulative net cashflow from all history up to each day.
    accounts = await db.bank_accounts.find({}, {"_id": 0, "initial_balance": 1}).to_list(100)
    running_balance = sum(float(a.get("initial_balance", 0) or 0) for a in accounts)
    async for e in db.cashbook_entries.find(
        {"date": {"$lt": start_iso}}, {"_id": 0, "kind": 1, "amount": 1}
    ):
        amt = float(e.get("amount", 0) or 0)
        running_balance += amt if e.get("kind") == "credit" else -amt

    # ---- Sales ----
    # Inbound Lead: every leads_v2 record created that day (added by any user
    # via Add New Lead, or auto-created from BNI) plus every BNI One-to-One
    # created that day.
    inbound_by_day = {}
    async for l in db.leads_v2.find(
        {"created_at": {"$gte": day_start_dt, "$lt": day_end_dt}},
        {"_id": 0, "created_at": 1},
    ):
        d = _day_key(l.get("created_at"))
        if d:
            inbound_by_day[d] = inbound_by_day.get(d, 0) + 1

    # One to One: BNI One-to-Ones completed on their scheduled meeting date.
    # (One-to-Ones created that day are folded into Inbound Lead above —
    # both read off the same `bni_one_to_ones` collection via different
    # date fields, so a single query covers both.)
    one_to_one_by_day = {}
    async for o in db.bni_one_to_ones.find(
        {"$or": [
            {"created_at": {"$gte": day_start_iso, "$lt": day_end_iso}},
            {"meeting_date": {"$gte": start_iso, "$lte": end_iso}},
        ]},
        {"_id": 0, "created_at": 1, "meeting_date": 1, "meeting_status": 1},
    ):
        created_d = _day_key(o.get("created_at"))
        if created_d and start_iso <= created_d <= end_iso:
            inbound_by_day[created_d] = inbound_by_day.get(created_d, 0) + 1
        meeting_d = _day_key(o.get("meeting_date"))
        if meeting_d and start_iso <= meeting_d <= end_iso and o.get("meeting_status") == "Completed":
            one_to_one_by_day[meeting_d] = one_to_one_by_day.get(meeting_d, 0) + 1

    # Outbound Prospect: BNI Outreach records no longer sitting on "New Lead"
    # (i.e. moved out of it to any other stage), keyed by the day they were
    # last updated — there's no stage-change history, so `updated_at` is the
    # best available proxy for "moved that day".
    outbound_by_day = {}
    async for o in db.bni_outreach.find(
        {"status": {"$ne": "New Lead"}, "updated_at": {"$gte": day_start_iso, "$lt": day_end_iso}},
        {"_id": 0, "updated_at": 1},
    ):
        d = _day_key(o.get("updated_at"))
        if d:
            outbound_by_day[d] = outbound_by_day.get(d, 0) + 1

    stages = await db.lead_stages.find({}, {"_id": 0, "stage_id": 1, "name": 1}).to_list(500)
    stage_name = {s["stage_id"]: (s.get("name") or "").strip().lower() for s in stages}

    appointment_by_day, sales_by_day = {}, {}
    async for l in db.leads_v2.find(
        {"updated_at": {"$gte": day_start_dt, "$lt": day_end_dt}},
        {"_id": 0, "updated_at": 1, "stage_id": 1},
    ):
        d = _day_key(l.get("updated_at"))
        if not d:
            continue
        name = stage_name.get(l.get("stage_id"), "")
        if "appoin" in name:
            appointment_by_day[d] = appointment_by_day.get(d, 0) + 1
        if name in ("deal closed", "won", "closed won"):
            sales_by_day[d] = sales_by_day.get(d, 0) + 1

    # ---- Marketing: content_calendar on the named Social Media projects ----
    # Two figures per project: `counts` (every entry for that day, any
    # status — unchanged, existing per-platform columns) and `posted_totals`
    # (entries with status == "posted" that day, summed across platforms —
    # so a post published to 2 platforms the same day counts as 2).
    async def _platform_counts_for(name_pattern):
        proj = await db.projects.find_one(
            {"departments": "social_media", "name": {"$regex": name_pattern, "$options": "i"}},
            {"_id": 0, "content_calendar": 1},
        )
        counts = {}
        posted_totals = {}
        for post in (proj or {}).get("content_calendar", []) or []:
            d = _day_key(post.get("post_date"))
            if d and start_iso <= d <= end_iso:
                counts.setdefault(d, {})
                platform = post.get("platform")
                counts[d][platform] = counts[d].get(platform, 0) + 1
                if (post.get("status") or "").lower() == "posted":
                    posted_totals[d] = posted_totals.get(d, 0) + 1
        return counts, posted_totals

    vinoth_counts, vinoth_posted_totals = await _platform_counts_for("vinoth")
    drawlead_counts, drawlead_posted_totals = await _platform_counts_for("drawlead")

    days = []
    cursor_balance = running_balance
    for i in range(7):
        d = start + timedelta(days=i)
        d_iso = d.isoformat()
        inc = income_by_day.get(d_iso, 0)
        exp = expense_by_day.get(d_iso, 0)
        cursor_balance += inc - exp
        days.append({
            "date": d_iso,
            "day_name": d.strftime("%A"),
            "is_today": d_iso == today_iso,
            "finance": {
                "income": round(inc, 2),
                "expense": round(exp, 2),
                "cash_in_bank": round(cursor_balance, 2),
            },
            "sales": {
                "inbound_lead": inbound_by_day.get(d_iso, 0),
                "outbound_prospect": outbound_by_day.get(d_iso, 0),
                "one_to_one": one_to_one_by_day.get(d_iso, 0),
                "appointment": appointment_by_day.get(d_iso, 0),
                "sales": sales_by_day.get(d_iso, 0),
            },
            "marketing_vinoth": {p: vinoth_counts.get(d_iso, {}).get(p, 0) for p in PLATFORMS},
            "marketing_vinoth_posted_total": vinoth_posted_totals.get(d_iso, 0),
            "marketing_drawlead": {p: drawlead_counts.get(d_iso, {}).get(p, 0) for p in PLATFORMS},
            "marketing_drawlead_posted_total": drawlead_posted_totals.get(d_iso, 0),
        })

    def _sum(section, key):
        return sum(day[section][key] for day in days)

    week_summary = {
        "finance": {"income": _sum("finance", "income"), "expense": _sum("finance", "expense")},
        "sales": {k: _sum("sales", k) for k in ["inbound_lead", "outbound_prospect", "one_to_one", "appointment", "sales"]},
        "marketing_vinoth": {p: _sum("marketing_vinoth", p) for p in PLATFORMS},
        "marketing_vinoth_posted_total": sum(day["marketing_vinoth_posted_total"] for day in days),
        "marketing_drawlead": {p: _sum("marketing_drawlead", p) for p in PLATFORMS},
        "marketing_drawlead_posted_total": sum(day["marketing_drawlead_posted_total"] for day in days),
    }

    return {
        "week_start_day": week_start_day,
        "start_date": start_iso,
        "end_date": end_iso,
        "days": days,
        "week_summary": week_summary,
    }


@dashboard_router.get("/targets")
async def get_dashboard_targets(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    doc = await db.dashboard_targets.find_one({"config_id": "default"}, {"_id": 0})
    if not doc:
        return DEFAULT_TARGETS
    merged = {**DEFAULT_TARGETS, **{k: v for k, v in doc.items() if k != "config_id"}}
    return merged


@dashboard_router.put("/targets")
async def set_dashboard_targets(payload: TargetsUpdate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    role = (getattr(user, "role", "") or "").lower()
    if role not in {"super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="Admin only")

    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    await db.dashboard_targets.update_one(
        {"config_id": "default"},
        {"$set": {**update_data, "config_id": "default", "updated_by": user.user_id,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    doc = await db.dashboard_targets.find_one({"config_id": "default"}, {"_id": 0})
    return {**DEFAULT_TARGETS, **{k: v for k, v in doc.items() if k != "config_id"}}
