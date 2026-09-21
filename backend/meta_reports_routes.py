"""
Meta Ads daily campaign reports.

A task tagged with the "Report" category on a Meta Ads project gets a
"Submit Report" action in the task list. The assignee picks one or more
campaigns (defined per-project on the Campaigns tab) and logs that day's
numbers (leads, cost per lead, spend, quality, conversions, remarks).
Submissions are stored here and surfaced on the project's Reports tab —
a per-date total summary with a collapsible campaign-wise breakdown.
"""
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta, timezone
import math
import re
import uuid

import meta_decision_engine as engine

meta_reports_router = APIRouter(prefix="/meta-reports", tags=["meta-reports"])


class MetaReportEntry(BaseModel):
    campaign_id: str
    campaign_name: str
    total_leads: Optional[float] = 0
    cost_per_lead: Optional[float] = 0
    total_spend: Optional[float] = 0
    quality: Optional[str] = None  # good | average | poor
    convert: Optional[float] = 0
    remarks: Optional[str] = ""


class MetaReportCreate(BaseModel):
    project_id: str
    task_id: Optional[str] = None
    date: str  # ISO date, YYYY-MM-DD
    entries: List[MetaReportEntry]


@meta_reports_router.post("")
async def submit_meta_report(payload: MetaReportCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)

    project = await db.projects.find_one({"project_id": payload.project_id}, {"_id": 0, "project_id": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not payload.entries:
        raise HTTPException(status_code=400, detail="At least one campaign entry is required")

    submitter = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "name": 1})

    doc = {
        "report_id": f"mrpt_{uuid.uuid4().hex[:10]}",
        "project_id": payload.project_id,
        "task_id": payload.task_id,
        "date": payload.date,
        "entries": [e.dict() for e in payload.entries],
        "submitted_by": user.user_id,
        "submitted_by_name": (submitter or {}).get("name") or "Unknown",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.meta_ads_reports.insert_one(dict(doc))
    return doc


@meta_reports_router.get("/project/{project_id}")
async def list_meta_reports(project_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    docs = await db.meta_ads_reports.find({"project_id": project_id}, {"_id": 0}).sort("date", -1).to_list(1000)
    return docs


# ------------------------------------------------------------ performance view
# One row per Meta Ads project for the Operations > Meta Ads > Performance
# View: structure counts (campaigns / ad sets / ads), spend + leads from the
# daily reports, and the ad-wallet (recharge log) figures.

ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _clean_date(value: Optional[str], label: str) -> Optional[str]:
    value = (value or "").strip()
    if not value:
        return None
    if not ISO_DATE.match(value):
        raise HTTPException(status_code=400, detail=f"{label} must be YYYY-MM-DD")
    try:
        date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{label} is not a valid date")
    return value


def _in_range(day: Optional[str], start: Optional[str], end: Optional[str]) -> bool:
    day = (day or "")[:10]
    if not day:
        return False
    if start and day < start:
        return False
    if end and day > end:
        return False
    return True


def _num(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


async def _visible_projects_query(user, db) -> dict:
    """Same visibility as the project list: admins / operation heads see every
    project, everyone else only the ones they belong to or created."""
    from projects_routes import _is_operation_head_or_admin
    if await _is_operation_head_or_admin(user, db):
        return {}
    return {"$or": [{"members": user.user_id}, {"created_by": user.user_id}]}


@meta_reports_router.get("/performance")
async def meta_performance(
    request: Request,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
):
    from server import get_current_user, db
    user = await get_current_user(request)
    start = _clean_date(from_date, "from")
    end = _clean_date(to_date, "to")
    if start and end and start > end:
        raise HTTPException(status_code=400, detail="from must not be after to")
    ranged = bool(start or end)

    query = {"departments": "meta", **(await _visible_projects_query(user, db))}
    projects = await db.projects.find(
        query,
        {"_id": 0, "project_id": 1, "name": 1, "status": 1, "client_name": 1, "campaigns": 1},
    ).to_list(500)
    ids = [p["project_id"] for p in projects if p.get("project_id")]

    spend_all, spend_in, leads_in = {}, {}, {}
    recharged_all, recharged_in = {}, {}
    if ids:
        reports = await db.meta_ads_reports.find(
            {"project_id": {"$in": ids}}, {"_id": 0, "project_id": 1, "date": 1, "entries": 1}
        ).to_list(50000)
        for r in reports:
            pid = r.get("project_id")
            inside = _in_range(r.get("date"), start, end) if ranged else True
            for e in r.get("entries") or []:
                spend = _num(e.get("total_spend"))
                spend_all[pid] = spend_all.get(pid, 0.0) + spend
                if inside:
                    spend_in[pid] = spend_in.get(pid, 0.0) + spend
                    leads_in[pid] = leads_in.get(pid, 0.0) + _num(e.get("total_leads"))
        recharges = await db.meta_ads_recharges.find(
            {"project_id": {"$in": ids}}, {"_id": 0, "project_id": 1, "date": 1, "amount": 1}
        ).to_list(50000)
        for c in recharges:
            pid = c.get("project_id")
            amount = _num(c.get("amount"))
            recharged_all[pid] = recharged_all.get(pid, 0.0) + amount
            if not ranged or _in_range(c.get("date"), start, end):
                recharged_in[pid] = recharged_in.get(pid, 0.0) + amount

    rows = []
    for p in projects:
        pid = p["project_id"]
        campaigns = p.get("campaigns") or []
        ad_sets = [a for c in campaigns for a in (c.get("ad_sets") or [])]
        ads = [ad for a in ad_sets for ad in (a.get("ads") or [])]
        # Ads only carry an added-on date from now on; with no date range every
        # ad counts, with one only the ads added inside it do.
        new_ads = len(ads) if not ranged else sum(1 for ad in ads if _in_range(ad.get("created_at"), start, end))
        rows.append({
            "project_id": pid,
            "name": p.get("name") or "",
            "status": p.get("status") or "active",
            "client_name": p.get("client_name") or "",
            "total_campaigns": len(campaigns),
            "total_ad_sets": len(ad_sets),
            "total_ads": len(ads),
            "active_ads": sum(1 for ad in ads if ad.get("setup_status") == "published"),
            "new_ads": new_ads,
            "total_spend": round(spend_in.get(pid, 0.0), 2),
            "total_leads": round(leads_in.get(pid, 0.0), 2),
            "recharged": round(recharged_in.get(pid, 0.0), 2),
            "wallet_balance": round(recharged_all.get(pid, 0.0) - spend_all.get(pid, 0.0), 2),
        })
    rows.sort(key=lambda r: (r["name"] or "").lower())
    return {"from": start, "to": end, "rows": rows}


# ------------------------------------------------------- per-project summary

IST = timezone(timedelta(hours=5, minutes=30))


def _current_budget(history, today: str) -> float:
    """Daily budget in effect today: the latest entry that has already started."""
    started = [e for e in (history or []) if (e.get("from_date") or "9999") <= today]
    if not started:
        return 0.0
    return _num(sorted(started, key=lambda e: e.get("from_date") or "")[-1].get("amount"))


def _previous_range(start: Optional[str], end: Optional[str]):
    """The equal-length window right before [start, end] (None when open-ended)."""
    if not (start and end):
        return None, None
    s, e = date.fromisoformat(start), date.fromisoformat(end)
    length = (e - s).days + 1
    prev_end = s - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length - 1)
    return prev_start.isoformat(), prev_end.isoformat()


def _cpl(spend: float, leads: float) -> Optional[float]:
    return round(spend / leads, 2) if leads > 0 else None


def _sum_reports(reports, start: Optional[str], end: Optional[str]):
    """Spend / leads / conversions, lead quality, per-campaign and per-day
    figures over the reports whose date falls inside [start, end]."""
    ranged = bool(start or end)
    total = {"spend": 0.0, "leads": 0.0, "convert": 0.0}
    quality = {"good": 0, "average": 0, "poor": 0}
    by_campaign, by_day = {}, {}
    for r in reports:
        day = (r.get("date") or "")[:10]
        if ranged and not _in_range(day, start, end):
            continue
        for e in r.get("entries") or []:
            spend, leads, convert = _num(e.get("total_spend")), _num(e.get("total_leads")), _num(e.get("convert"))
            total["spend"] += spend
            total["leads"] += leads
            total["convert"] += convert
            if e.get("quality") in quality:
                quality[e["quality"]] += 1
            key = e.get("campaign_id") or e.get("campaign_name") or ""
            c = by_campaign.setdefault(key, {"name": e.get("campaign_name") or "", "spend": 0.0, "leads": 0.0, "convert": 0.0})
            c["spend"] += spend
            c["leads"] += leads
            c["convert"] += convert
            d = by_day.setdefault(day, {"spend": 0.0, "leads": 0.0})
            d["spend"] += spend
            d["leads"] += leads
    return total, quality, by_campaign, by_day


@meta_reports_router.get("/performance/{project_id}")
async def meta_performance_detail(
    project_id: str,
    request: Request,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
):
    from server import get_current_user, db
    user = await get_current_user(request)
    start = _clean_date(from_date, "from")
    end = _clean_date(to_date, "to")
    if start and end and start > end:
        raise HTTPException(status_code=400, detail="from must not be after to")
    ranged = bool(start or end)

    project = await db.projects.find_one(
        {"project_id": project_id, "departments": "meta", **(await _visible_projects_query(user, db))},
        {"_id": 0, "project_id": 1, "name": 1, "status": 1, "client_name": 1, "campaigns": 1},
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    reports = await db.meta_ads_reports.find(
        {"project_id": project_id}, {"_id": 0, "date": 1, "entries": 1}
    ).to_list(20000)
    recharges = await db.meta_ads_recharges.find({"project_id": project_id}, {"_id": 0}).to_list(5000)

    total, quality, by_campaign, by_day = _sum_reports(reports, start, end)
    spend_all = sum(_num(e.get("total_spend")) for r in reports for e in (r.get("entries") or []))
    recharged_all = sum(_num(c.get("amount")) for c in recharges)
    period_recharges = sorted(
        [c for c in recharges if not ranged or _in_range(c.get("date"), start, end)],
        key=lambda c: (c.get("date") or "", c.get("created_at") or ""), reverse=True,
    )

    today = datetime.now(IST).date().isoformat()
    campaigns_out, seen = [], set()
    n_campaigns = n_ad_sets = n_ads = n_active = n_new = 0
    for c in project.get("campaigns") or []:
        seen.add(c.get("id"))
        ad_sets_out, c_ads, c_active, c_new = [], 0, 0, 0
        for a in c.get("ad_sets") or []:
            ads = a.get("ads") or []
            active = sum(1 for ad in ads if ad.get("setup_status") == "published")
            new = len(ads) if not ranged else sum(1 for ad in ads if _in_range(ad.get("created_at"), start, end))
            ad_sets_out.append({"id": a.get("id"), "name": a.get("name") or "", "ads": len(ads), "active_ads": active, "new_ads": new})
            c_ads += len(ads)
            c_active += active
            c_new += new
        m = by_campaign.get(c.get("id"), {"spend": 0.0, "leads": 0.0, "convert": 0.0})
        campaigns_out.append({
            "id": c.get("id"), "name": c.get("name") or "", "in_project": True,
            "daily_budget": _current_budget(c.get("budget_history"), today),
            "ad_sets": ad_sets_out, "ads": c_ads, "active_ads": c_active, "new_ads": c_new,
            "spend": round(m["spend"], 2), "leads": round(m["leads"], 2),
            "cpl": _cpl(m["spend"], m["leads"]), "conversions": round(m["convert"], 2),
        })
        n_campaigns += 1
        n_ad_sets += len(ad_sets_out)
        n_ads += c_ads
        n_active += c_active
        n_new += c_new
    # Reports can outlive a campaign that was later removed — keep their numbers visible.
    for key, m in by_campaign.items():
        if key in seen:
            continue
        campaigns_out.append({
            "id": key, "name": m["name"] or "Removed campaign", "in_project": False,
            "daily_budget": 0.0, "ad_sets": [], "ads": 0, "active_ads": 0, "new_ads": 0,
            "spend": round(m["spend"], 2), "leads": round(m["leads"], 2),
            "cpl": _cpl(m["spend"], m["leads"]), "conversions": round(m["convert"], 2),
        })

    # Trend: one point per day for windows up to ~2 months, else per month.
    by_day_granular = bool(start and end and (date.fromisoformat(end) - date.fromisoformat(start)).days <= 62)
    points = []
    if by_day_granular:
        d, last = date.fromisoformat(start), date.fromisoformat(end)
        while d <= last:
            v = by_day.get(d.isoformat(), {"spend": 0.0, "leads": 0.0})
            points.append({"key": d.isoformat(), "spend": round(v["spend"], 2), "leads": round(v["leads"], 2)})
            d += timedelta(days=1)
    else:
        months = {}
        for day, v in by_day.items():
            m = months.setdefault(day[:7], {"spend": 0.0, "leads": 0.0})
            m["spend"] += v["spend"]
            m["leads"] += v["leads"]
        points = [{"key": k, "spend": round(v["spend"], 2), "leads": round(v["leads"], 2)} for k, v in sorted(months.items())]

    prev_start, prev_end = _previous_range(start, end)
    previous = None
    if prev_start:
        p_total, _, _, _ = _sum_reports(reports, prev_start, prev_end)
        previous = {"spend": round(p_total["spend"], 2), "leads": round(p_total["leads"], 2), "cpl": _cpl(p_total["spend"], p_total["leads"])}

    campaigns_out.sort(key=lambda c: (-c["spend"], (c["name"] or "").lower()))
    return {
        "project": {
            "project_id": project["project_id"], "name": project.get("name") or "",
            "client_name": project.get("client_name") or "", "status": project.get("status") or "active",
        },
        "from": start, "to": end,
        "totals": {
            "campaigns": n_campaigns, "ad_sets": n_ad_sets, "ads": n_ads, "active_ads": n_active, "new_ads": n_new,
            "spend": round(total["spend"], 2), "leads": round(total["leads"], 2),
            "cpl": _cpl(total["spend"], total["leads"]), "conversions": round(total["convert"], 2),
            "recharged": round(sum(_num(c.get("amount")) for c in period_recharges), 2),
        },
        "previous": previous, "previous_range": {"from": prev_start, "to": prev_end} if prev_start else None,
        "wallet": {
            "recharged_all": round(recharged_all, 2), "spend_all": round(spend_all, 2),
            "balance": round(recharged_all - spend_all, 2),
        },
        "quality": quality,
        "campaigns": campaigns_out,
        "trend": {"granularity": "day" if by_day_granular else "month", "points": points},
        "recharges": [
            {k: c.get(k) for k in ("recharge_id", "date", "amount", "note", "created_by_name")} for c in period_recharges
        ],
    }


# ------------------------------------------------------------- recharge log

class RechargeCreate(BaseModel):
    project_id: str
    date: str  # ISO date, YYYY-MM-DD
    amount: float
    note: Optional[str] = ""


async def _require_project_access(user, db, project_id: str) -> dict:
    project = await db.projects.find_one(
        {"project_id": project_id, **(await _visible_projects_query(user, db))},
        {"_id": 0, "project_id": 1, "departments": 1},
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _require_recharge_editor(user, db):
    from projects_routes import _is_operation_head_or_admin
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can edit wallet recharges")


@meta_reports_router.get("/recharges/{project_id}")
async def list_recharges(project_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    await _require_project_access(user, db, project_id)
    docs = await db.meta_ads_recharges.find({"project_id": project_id}, {"_id": 0}).sort([("date", -1), ("created_at", -1)]).to_list(1000)
    return docs


@meta_reports_router.post("/recharges")
async def add_recharge(payload: RechargeCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    await _require_recharge_editor(user, db)
    project = await _require_project_access(user, db, payload.project_id)
    if "meta" not in (project.get("departments") or []):
        raise HTTPException(status_code=400, detail="Wallet recharges are only tracked for Meta Ads projects")
    date = _clean_date(payload.date, "date")
    if not date:
        raise HTTPException(status_code=400, detail="date is required")
    if not math.isfinite(payload.amount) or payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    doc = {
        "recharge_id": f"rch_{uuid.uuid4().hex[:10]}",
        "project_id": payload.project_id,
        "date": date,
        "amount": round(float(payload.amount), 2),
        "note": (payload.note or "").strip()[:200],
        "created_by": user.user_id,
        "created_by_name": getattr(user, "name", "") or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.meta_ads_recharges.insert_one(dict(doc))
    return doc


@meta_reports_router.delete("/recharges/{recharge_id}")
async def delete_recharge(recharge_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    await _require_recharge_editor(user, db)
    result = await db.meta_ads_recharges.delete_one({"recharge_id": recharge_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recharge not found")
    return {"ok": True}


# ------------------------------------------------------------ day-wise reports
# The Reports tab is a calendar of days. A day's report is ONE document per
# (project, date) with kind="daily": one entry per ad (leads + spend), saved
# ad set by ad set as the reporter types. Older reports (campaign-level entries
# from the original popup) keep working — they have no kind — and simply add to
# that day's totals. A day is "submitted" once every ad that existed on it has
# numbers; if a report task was assigned for the day, that task then completes.

DAILY = "daily"


class AdReportRow(BaseModel):
    ad_id: str
    leads: Optional[float] = None
    spend: Optional[float] = None
    # Optional inputs the Decisions tab needs (CTR, CPC, frequency, lead quality).
    reach: Optional[float] = None
    impressions: Optional[float] = None
    link_clicks: Optional[float] = None
    qualified_leads: Optional[float] = None
    appointments: Optional[float] = None


DECISION_INPUTS = ("reach", "impressions", "link_clicks", "qualified_leads", "appointments")


class DailySave(BaseModel):
    campaign_id: str
    ad_set_id: str
    rows: List[AdReportRow]


class DailyAssign(BaseModel):
    assigned_to: str
    due_date: Optional[str] = None  # defaults to the day after the report day


def _today_ist() -> str:
    return datetime.now(IST).date().isoformat()


def _next_day(day: str) -> str:
    return (date.fromisoformat(day) + timedelta(days=1)).isoformat()


def _entity_active_on(entity: dict, day: str) -> bool:
    """Active flag + Start/End Date gate, shared by Campaign, Ad Set and Ad."""
    if entity.get("active") is False:
        return False
    start = (entity.get("start_date") or "")[:10]
    if start and day < start:
        return False
    end = (entity.get("end_date") or "")[:10]
    if end and day > end:
        return False
    return True


def _due_reason(campaign: dict, ad_set: dict, ad: dict, day: str):
    """(is_due, reason_if_not) for one ad on one day — checked campaign, then
    ad set, then the ad itself, so the first blocker found is the one shown.
    An ad with no Start Date of its own falls back to when it was created
    (created_at) so ads that predate this feature keep behaving as they
    always have."""
    for label, entity in (("campaign", campaign), ("ad set", ad_set)):
        if entity.get("active") is False:
            return False, f"its {label} is paused"
        start = (entity.get("start_date") or "")[:10]
        if start and day < start:
            return False, f"its {label} starts {start}"
        end = (entity.get("end_date") or "")[:10]
        if end and day > end:
            return False, f"its {label} ended {end}"
    if ad.get("active") is False:
        return False, "it is paused"
    start = (ad.get("start_date") or ad.get("created_at") or "")[:10]
    if start and day < start:
        return False, f"it starts {start}"
    end = (ad.get("end_date") or "")[:10]
    if end and day > end:
        return False, f"it ended {end}"
    return True, None


def _ad_due_on(campaign: dict, ad_set: dict, ad: dict, day: str) -> bool:
    """An ad has to be reported on `day` unless it, its ad set, or its
    campaign is paused or outside its Start/End Date window."""
    return _due_reason(campaign, ad_set, ad, day)[0]


async def _load_meta_project(user, db, project_id: str) -> dict:
    project = await db.projects.find_one(
        {"project_id": project_id, "departments": "meta", **(await _visible_projects_query(user, db))},
        {"_id": 0, "project_id": 1, "name": 1, "status": 1, "campaigns": 1, "decision_settings": 1},
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _coverage(project: dict, entries: list, day: str) -> dict:
    reported = {e["ad_id"]: e for e in entries if e.get("ad_id")}
    campaigns, ads_total, ads_reported, camps_total, camps_done = [], 0, 0, 0, 0
    for c in project.get("campaigns") or []:
        c_total = c_rep = 0
        ad_sets = []
        for a in c.get("ad_sets") or []:
            ids = [ad["id"] for ad in (a.get("ads") or []) if ad.get("id") and _ad_due_on(c, a, ad, day)]
            rep = [i for i in ids if i in reported]
            if ids:
                ad_sets.append({"id": a.get("id"), "name": a.get("name") or "", "ads_total": len(ids),
                                "ads_reported": len(rep), "complete": len(rep) == len(ids)})
            c_total += len(ids)
            c_rep += len(rep)
        mine = [e for e in entries if e.get("campaign_id") == c.get("id")]
        if c_total:
            camps_total += 1
            camps_done += 1 if c_rep == c_total else 0
        campaigns.append({
            "id": c.get("id"), "name": c.get("name") or "", "ads_total": c_total, "ads_reported": c_rep,
            "complete": c_total > 0 and c_rep == c_total, "ad_sets": ad_sets,
            "leads": round(sum(_num(e.get("total_leads")) for e in mine), 2),
            "spend": round(sum(_num(e.get("total_spend")) for e in mine), 2),
        })
        ads_total += c_total
        ads_reported += c_rep
    return {
        "campaigns": campaigns, "campaigns_total": camps_total, "campaigns_complete": camps_done,
        "ads_total": ads_total, "ads_reported": ads_reported,
        "complete": camps_total > 0 and camps_done == camps_total,
    }


def _day_summary(project: dict, day: str, docs: list, task: Optional[dict]) -> dict:
    daily = next((d for d in docs if d.get("kind") == DAILY), None)
    legacy = [d for d in docs if d.get("kind") != DAILY]
    entries = (daily or {}).get("entries") or []
    all_entries = entries + [e for d in legacy for e in (d.get("entries") or [])]
    leads = sum(_num(e.get("total_leads")) for e in all_entries)
    spend = sum(_num(e.get("total_spend")) for e in all_entries)
    cov = _coverage(project, entries, day)
    if cov["complete"]:
        status = "submitted"
    elif entries:
        status = "partial"
    elif legacy:
        status = "legacy"
    elif daily and daily.get("assigned_to"):
        status = "assigned"
    else:
        status = "pending"
    assignment = None
    if daily and daily.get("assigned_to"):
        assignment = {
            "task_id": daily.get("task_id"), "assigned_to": daily.get("assigned_to"),
            "assigned_to_name": daily.get("assigned_to_name") or "", "due_date": daily.get("due_date"),
            "task_status": (task or {}).get("status") or ("completed" if daily.get("assign_status") == "completed" else "pending"),
        }
    return {
        "date": day, "status": status, "leads": round(leads, 2), "spend": round(spend, 2), "cpl": _cpl(spend, leads),
        "legacy": bool(legacy), "coverage": cov, "assignment": assignment,
    }


@meta_reports_router.get("/daily/{project_id}")
async def list_daily_reports(
    project_id: str,
    request: Request,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
):
    """Every day in the range that has a report or an assignment."""
    from server import get_current_user, db
    user = await get_current_user(request)
    project = await _load_meta_project(user, db, project_id)
    start = _clean_date(from_date, "from")
    end = _clean_date(to_date, "to")
    if start and end and start > end:
        raise HTTPException(status_code=400, detail="from must not be after to")
    docs = await db.meta_ads_reports.find({"project_id": project_id}, {"_id": 0}).to_list(20000)
    by_day: dict = {}
    for d in docs:
        day = (d.get("date") or "")[:10]
        if day and ((not start and not end) or _in_range(day, start, end)):
            by_day.setdefault(day, []).append(d)
    task_ids = [d.get("task_id") for ds in by_day.values() for d in ds if d.get("task_id")]
    tasks = {}
    if task_ids:
        async for t in db.our_tasks.find({"task_id": {"$in": task_ids}}, {"_id": 0, "task_id": 1, "status": 1}):
            tasks[t["task_id"]] = t
    days = []
    for day in sorted(by_day, reverse=True):
        daily = next((d for d in by_day[day] if d.get("kind") == DAILY), None)
        days.append(_day_summary(project, day, by_day[day], tasks.get((daily or {}).get("task_id"))))
    return {
        "days": days,
        "structure": {
            "campaigns": len(project.get("campaigns") or []),
            "ad_sets": sum(len(c.get("ad_sets") or []) for c in project.get("campaigns") or []),
            "ads": sum(len(a.get("ads") or []) for c in project.get("campaigns") or [] for a in c.get("ad_sets") or []),
        },
    }


async def _day_detail(db, project: dict, day: str) -> dict:
    docs = await db.meta_ads_reports.find({"project_id": project["project_id"], "date": day}, {"_id": 0}).to_list(200)
    daily = next((d for d in docs if d.get("kind") == DAILY), None)
    task = await db.our_tasks.find_one({"task_id": daily["task_id"]}, {"_id": 0, "status": 1}) if daily and daily.get("task_id") else None
    summary = _day_summary(project, day, docs, task)
    structure, excluded, all_ads_in_project = [], [], 0
    for c in project.get("campaigns") or []:
        ad_sets = []
        for a in c.get("ad_sets") or []:
            ads = []
            for ad in a.get("ads") or []:
                if not ad.get("id"):
                    continue
                all_ads_in_project += 1
                is_due, reason = _due_reason(c, a, ad, day)
                if is_due:
                    ads.append({"id": ad.get("id"), "name": ad.get("name") or "", "ad_type": ad.get("ad_type") or "static",
                                "creative_link": ad.get("creative_link") or "",
                                "creative_file_id": ad.get("creative_file_id"), "editing_file_id": ad.get("editing_file_id")})
                else:
                    excluded.append({"id": ad.get("id"), "name": ad.get("name") or "", "ad_set_name": a.get("name") or "",
                                      "campaign_name": c.get("name") or "", "reason": reason})
            ad_sets.append({"id": a.get("id"), "name": a.get("name") or "", "ads": ads})
        structure.append({"id": c.get("id"), "name": c.get("name") or "", "ad_sets": ad_sets})
    legacy_entries = [
        {**e, "submitted_by_name": d.get("submitted_by_name")}
        for d in docs if d.get("kind") != DAILY for e in (d.get("entries") or [])
    ]
    return {
        **summary,
        "project": {"project_id": project["project_id"], "name": project.get("name") or ""},
        "structure": structure,
        "entries": (daily or {}).get("entries") or [],
        "legacy_entries": legacy_entries,
        "all_ads_in_project": all_ads_in_project,
        "excluded": excluded,
    }


@meta_reports_router.get("/daily/{project_id}/{day}")
async def get_daily_report(project_id: str, day: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    project = await _load_meta_project(user, db, project_id)
    day = _clean_date(day, "date")
    if not day:
        raise HTTPException(status_code=400, detail="date is required")
    return await _day_detail(db, project, day)


async def _complete_assigned_task(db, doc: dict) -> None:
    """The day is fully reported: finish its assigned report task, if any."""
    task_id = doc.get("task_id")
    if not task_id:
        return
    task = await db.our_tasks.find_one({"task_id": task_id})
    if not task or task.get("status") == "completed":
        return
    from ad_tasks_routes import close_timer
    now = datetime.now(timezone.utc)
    await db.our_tasks.update_one({"task_id": task_id}, {"$set": {
        "status": "completed", "reference_image": None,
        "time_tracking": close_timer(task.get("time_tracking"), now), "updated_at": now.isoformat(),
    }})
    await db.meta_ads_reports.update_one({"report_id": doc["report_id"]}, {"$set": {"assign_status": "completed"}})


@meta_reports_router.put("/daily/{project_id}/{day}")
async def save_daily_report(project_id: str, day: str, payload: DailySave, request: Request):
    """Save one ad set's numbers for the day (replaces what was saved for that
    ad set). Blank rows are dropped, so clearing the fields un-reports the ad.
    Besides leads and spend, an ad can carry the optional inputs the Decisions
    tab uses; a blank one is left out, never stored as 0."""
    from server import get_current_user, db
    user = await get_current_user(request)
    project = await _load_meta_project(user, db, project_id)
    day = _clean_date(day, "date")
    if not day:
        raise HTTPException(status_code=400, detail="date is required")
    if day > _today_ist():
        raise HTTPException(status_code=400, detail="A report can't be filed for a future day")

    campaign = next((c for c in project.get("campaigns") or [] if c.get("id") == payload.campaign_id), None)
    ad_set = next((a for a in (campaign or {}).get("ad_sets") or [] if a.get("id") == payload.ad_set_id), None)
    if not ad_set:
        raise HTTPException(status_code=404, detail="Campaign or ad set not found")
    ads = {ad["id"]: ad for ad in (ad_set.get("ads") or []) if ad.get("id")}

    entries, seen = [], set()
    for row in payload.rows:
        if row.ad_id not in ads:
            raise HTTPException(status_code=400, detail="That ad isn't in this ad set")
        if row.ad_id in seen:
            raise HTTPException(status_code=400, detail="An ad was sent twice")
        seen.add(row.ad_id)
        extras = {k: getattr(row, k) for k in DECISION_INPUTS if getattr(row, k) is not None}
        if row.leads is None and row.spend is None and not extras:
            continue
        leads, spend = row.leads if row.leads is not None else 0.0, row.spend if row.spend is not None else 0.0
        if not (math.isfinite(leads) and math.isfinite(spend)) or leads < 0 or spend < 0:
            raise HTTPException(status_code=400, detail="Leads and spend must be numbers of 0 or more")
        if any(not math.isfinite(v) or v < 0 for v in extras.values()):
            raise HTTPException(status_code=400, detail="Reach, impressions, link clicks, qualified leads and appointments must be numbers of 0 or more")
        if "impressions" in extras and "link_clicks" in extras and extras["link_clicks"] > extras["impressions"]:
            raise HTTPException(status_code=400, detail="Link clicks can't be more than impressions")
        if "impressions" in extras and "reach" in extras and extras["reach"] > extras["impressions"]:
            raise HTTPException(status_code=400, detail="Reach can't be more than impressions")
        if "qualified_leads" in extras and extras["qualified_leads"] > leads:
            raise HTTPException(status_code=400, detail="Qualified leads can't be more than leads")
        entries.append({
            "campaign_id": campaign["id"], "campaign_name": campaign.get("name") or "",
            "ad_set_id": ad_set["id"], "ad_set_name": ad_set.get("name") or "",
            "ad_id": row.ad_id, "ad_name": ads[row.ad_id].get("name") or "",
            "total_leads": round(leads, 2), "total_spend": round(spend, 2),
            "cost_per_lead": _cpl(spend, leads) or 0,
            **{k: round(v, 2) for k, v in extras.items()},
        })

    now_iso = datetime.now(timezone.utc).isoformat()
    key = {"project_id": project_id, "date": day, "kind": DAILY}
    await db.meta_ads_reports.update_one(key, {"$setOnInsert": {
        "report_id": f"mrpt_{uuid.uuid4().hex[:10]}", "entries": [], "created_at": now_iso,
    }}, upsert=True)
    await db.meta_ads_reports.update_one(key, {"$pull": {"entries": {"ad_set_id": ad_set["id"]}}})
    update = {"$set": {"updated_at": now_iso, "submitted_by": user.user_id, "submitted_by_name": getattr(user, "name", "") or "",
                       "submitted_at": now_iso}}
    if entries:
        update["$push"] = {"entries": {"$each": entries}}
    await db.meta_ads_reports.update_one(key, update)

    detail = await _day_detail(db, project, day)
    if detail["coverage"]["complete"]:
        doc = await db.meta_ads_reports.find_one(key, {"_id": 0})
        await _complete_assigned_task(db, doc)
        detail = await _day_detail(db, project, day)
    return detail


@meta_reports_router.post("/daily/{project_id}/{day}/assign")
async def assign_daily_report(project_id: str, day: str, payload: DailyAssign, request: Request):
    """Hand the day's report to someone. Creates (or re-points) a My Tasks task
    due the day after the report day unless another deadline is given."""
    from server import get_current_user, db
    user = await get_current_user(request)
    from projects_routes import _is_operation_head_or_admin
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can assign reports")
    project = await _load_meta_project(user, db, project_id)
    day = _clean_date(day, "date")
    if not day:
        raise HTTPException(status_code=400, detail="date is required")
    due = _clean_date(payload.due_date, "due_date") or _next_day(day)
    assignee = await db.users.find_one({"user_id": payload.assigned_to}, {"_id": 0, "user_id": 1, "name": 1})
    if not assignee:
        raise HTTPException(status_code=400, detail="Choose who should file this report")

    now_iso = datetime.now(timezone.utc).isoformat()
    key = {"project_id": project_id, "date": day, "kind": DAILY}
    await db.meta_ads_reports.update_one(key, {"$setOnInsert": {
        "report_id": f"mrpt_{uuid.uuid4().hex[:10]}", "entries": [], "created_at": now_iso,
    }}, upsert=True)
    doc = await db.meta_ads_reports.find_one(key, {"_id": 0})
    task = await db.our_tasks.find_one({"task_id": doc["task_id"]}) if doc.get("task_id") else None
    if task and task.get("status") != "completed":
        await db.our_tasks.update_one({"task_id": task["task_id"]}, {"$set": {
            "assigned_to": assignee["user_id"], "due_date": due, "updated_at": now_iso,
        }})
        task_id = task["task_id"]
    else:
        task_id = f"ot_{uuid.uuid4().hex[:12]}"
        await db.our_tasks.insert_one({
            "task_id": task_id,
            "task_name": f"Meta Ads Report — {project.get('name') or ''} — {date.fromisoformat(day).strftime('%d %b %Y')}",
            "description": f"Report leads and spend for every ad for {date.fromisoformat(day).strftime('%d %b %Y')}.",
            "status": "pending", "priority": "medium", "type": "general", "tags": [],
            "assigned_to": assignee["user_id"], "created_by": user.user_id, "created_by_name": getattr(user, "name", "") or "",
            "due_date": due, "work_link": None, "department": "meta", "category": "Report",
            "project_id": project_id, "project_name": project.get("name"), "meta_report_date": day,
            "time_tracking": {"total_seconds": 0, "status": "not_started", "sessions": []},
            "created_at": now_iso, "updated_at": now_iso,
        })
    await db.meta_ads_reports.update_one(key, {"$set": {
        "task_id": task_id, "assigned_to": assignee["user_id"], "assigned_to_name": assignee.get("name") or "",
        "assigned_by": user.user_id, "assigned_by_name": getattr(user, "name", "") or "",
        "due_date": due, "assign_status": "assigned", "updated_at": now_iso,
    }})
    await db.projects.update_one({"project_id": project_id}, {"$addToSet": {"members": assignee["user_id"]}})
    return await _day_detail(db, project, day)


@meta_reports_router.delete("/daily/{project_id}/{day}/assign")
async def unassign_daily_report(project_id: str, day: str, request: Request):
    """Take the report back — only while its task hasn't been touched."""
    from server import get_current_user, db
    user = await get_current_user(request)
    from projects_routes import _is_operation_head_or_admin
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can assign reports")
    project = await _load_meta_project(user, db, project_id)
    day = _clean_date(day, "date")
    key = {"project_id": project_id, "date": day, "kind": DAILY}
    doc = await db.meta_ads_reports.find_one(key, {"_id": 0})
    if not doc or not doc.get("assigned_to"):
        raise HTTPException(status_code=404, detail="This day has no assignment")
    task = await db.our_tasks.find_one({"task_id": doc.get("task_id")}) if doc.get("task_id") else None
    if task and (task.get("status") != "pending" or (task.get("time_tracking") or {}).get("status") not in (None, "not_started")):
        raise HTTPException(status_code=400, detail="The assignee has already started this task")
    if task:
        await db.our_tasks.delete_one({"task_id": task["task_id"]})
    await db.meta_ads_reports.update_one(key, {"$unset": {
        "task_id": "", "assigned_to": "", "assigned_to_name": "", "assigned_by": "", "assigned_by_name": "",
        "due_date": "", "assign_status": "",
    }})
    return await _day_detail(db, project, day)


# ------------------------------------------------------------------ decisions
# KEEP / SCALE / WATCH / OPTIMIZE / KILL for every ad, worked out from the
# daily reports against the project's target CPL (rules: meta_decision_engine).

class DecisionSettings(BaseModel):
    target_cpl: float
    min_qualified_pct: Optional[float] = None
    window_days: Optional[int] = None


def _decision_settings(project: dict) -> dict:
    raw = project.get("decision_settings") or {}
    target = raw.get("target_cpl")
    return {
        "target_cpl": float(target) if target else None,
        "min_qualified_pct": float(raw.get("min_qualified_pct") if raw.get("min_qualified_pct") is not None else engine.DEFAULT_MIN_QUALIFIED_PCT),
        "window_days": raw.get("window_days") if raw.get("window_days") in engine.WINDOWS else engine.DEFAULT_WINDOW,
    }


@meta_reports_router.put("/decisions/{project_id}/settings")
async def save_decision_settings(project_id: str, payload: DecisionSettings, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    from projects_routes import _is_operation_head_or_admin
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can change the decision settings")
    await _load_meta_project(user, db, project_id)
    if not math.isfinite(payload.target_cpl) or payload.target_cpl <= 0:
        raise HTTPException(status_code=400, detail="Target CPL must be more than 0")
    pct = payload.min_qualified_pct
    if pct is not None and (not math.isfinite(pct) or pct < 0 or pct > 100):
        raise HTTPException(status_code=400, detail="Minimum qualified % must be between 0 and 100")
    if payload.window_days is not None and payload.window_days not in engine.WINDOWS:
        raise HTTPException(status_code=400, detail=f"Window must be one of {', '.join(map(str, engine.WINDOWS))} days")
    settings = {
        "target_cpl": round(payload.target_cpl, 2),
        "min_qualified_pct": round(pct if pct is not None else engine.DEFAULT_MIN_QUALIFIED_PCT, 2),
        "window_days": payload.window_days or engine.DEFAULT_WINDOW,
        "updated_by": user.user_id, "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.projects.update_one({"project_id": project_id}, {"$set": {"decision_settings": settings}})
    return _decision_settings({"decision_settings": settings})


@meta_reports_router.get("/decisions/{project_id}")
async def get_decisions(
    project_id: str,
    request: Request,
    day: Optional[str] = Query(None),
    window: Optional[int] = Query(None),
):
    """The day's calls for every ad, ad set and campaign of the project."""
    from server import get_current_user, db
    user = await get_current_user(request)
    from projects_routes import _is_operation_head_or_admin
    project = await _load_meta_project(user, db, project_id)
    today = _today_ist()
    day = _clean_date(day, "day") or today
    if day > today:
        raise HTTPException(status_code=400, detail="Decisions can't be made for a future day")
    settings = _decision_settings(project)
    n = window if window is not None else settings["window_days"]
    if n not in engine.WINDOWS:
        raise HTTPException(status_code=400, detail=f"window must be one of {', '.join(map(str, engine.WINDOWS))}")
    target = settings["target_cpl"]
    bounds = engine.window_bounds(day, n)

    docs = await db.meta_ads_reports.find({"project_id": project_id, "kind": DAILY}, {"_id": 0, "date": 1, "entries": 1}).to_list(20000)
    by_ad: dict = {}
    data_through = None
    for d in docs:
        d_day = (d.get("date") or "")[:10]
        if not d_day or d_day > day or not d.get("entries"):
            continue
        data_through = max(data_through or d_day, d_day)
        for e in d["entries"]:
            if e.get("ad_id"):
                by_ad.setdefault(e["ad_id"], []).append({**e, "date": d_day})

    def within(rows, start, end):
        return [r for r in rows if start <= r["date"] <= end]

    def group(rows):
        agg = engine.aggregate(rows)
        return {"metrics": agg, **(engine.judge_group(agg, target) if target else {"health": engine.NO_TARGET, "note": ""})}

    counts = {k: 0 for k in (engine.SCALE, engine.KEEP, engine.WATCH, engine.OPTIMIZE, engine.KILL, engine.NO_DATA, engine.INACTIVE)}
    counts["replace"] = 0
    actions, all_cur, campaigns = [], [], []
    for c in project.get("campaigns") or []:
        camp_cur, ad_sets = [], []
        for a in c.get("ad_sets") or []:
            set_cur, ads_out = [], []
            for ad in a.get("ads") or []:
                if not ad.get("id") or not _ad_due_on(c, a, ad, day):
                    continue
                rows = by_ad.get(ad["id"], [])
                cur = within(rows, bounds["cur_from"], bounds["cur_to"])
                prev = within(rows, bounds["prev_from"], bounds["prev_to"])
                spend_days = sorted(r["date"] for r in rows if _num(r.get("total_spend")) > 0)
                first_spend, last_spend = (spend_days[0], spend_days[-1]) if spend_days else (None, None)
                age = (date.fromisoformat(day) - date.fromisoformat(first_spend)).days if first_spend else None
                cur_agg = engine.aggregate(cur)
                stale = bool(last_spend and data_through and (date.fromisoformat(data_through) - date.fromisoformat(last_spend)).days >= engine.INACTIVE_AFTER_DAYS)
                if not target:
                    call = {"status": engine.NO_TARGET, "level": None, "reason": "Set a target CPL to get a call on this ad.", "action": "", "replace": False, "fatigue": False, "hints": []}
                elif stale:
                    call = {"status": engine.INACTIVE, "level": None, "replace": False, "fatigue": False, "hints": [],
                            "reason": f"No spend since {last_spend} while other reports keep coming in.", "action": "Already paused? Then nothing to decide."}
                elif not cur:
                    call = {"status": engine.NO_DATA, "level": None, "replace": False, "fatigue": False, "hints": [],
                            "reason": f"No report for this ad between {bounds['cur_from']} and {bounds['cur_to']}.", "action": "File the daily report for this ad."}
                else:
                    call = engine.decide(cur_agg, engine.aggregate(prev) if prev else None, target, settings["min_qualified_pct"], age)
                if call["status"] in counts:
                    counts[call["status"]] += 1
                counts["replace"] += 1 if call["replace"] else 0
                if call["status"] in (engine.KILL, engine.SCALE, engine.OPTIMIZE):
                    actions.append({
                        "ad_id": ad["id"], "ad_name": ad.get("name") or "", "campaign_name": c.get("name") or "",
                        "ad_set_name": a.get("name") or "", **{k: call[k] for k in ("status", "level", "reason", "action", "replace")},
                    })
                ads_out.append({
                    "id": ad["id"], "name": ad.get("name") or "", "ad_type": ad.get("ad_type") or "static",
                    "metrics": cur_agg, "day": engine.aggregate(within(rows, day, day)),
                    "first_spend": first_spend, "decision": call,
                })
                set_cur += cur
            if ads_out:
                ad_sets.append({
                    "id": a.get("id"), "name": a.get("name") or "", "ads": ads_out, **group(set_cur),
                    "replace_needed": sum(1 for x in ads_out if x["decision"]["replace"]),
                })
                camp_cur += set_cur
        if ad_sets:
            campaigns.append({"id": c.get("id"), "name": c.get("name") or "", "ad_sets": ad_sets, **group(camp_cur)})
            all_cur += camp_cur

    priority = {engine.KILL: 0, engine.SCALE: 1, engine.OPTIMIZE: 2}
    actions.sort(key=lambda x: priority[x["status"]])
    return {
        "project": {"project_id": project_id, "name": project.get("name") or ""},
        "day": day, "window_days": n, "window": {"from": bounds["cur_from"], "to": bounds["cur_to"]},
        "data_through": data_through, "day_reported": data_through == day,
        "settings": settings, "configured": bool(target), "thresholds": engine.thresholds(target) if target else None,
        "can_edit_settings": await _is_operation_head_or_admin(user, db),
        "totals": engine.aggregate(all_cur), "counts": counts, "actions": actions, "campaigns": campaigns,
    }
