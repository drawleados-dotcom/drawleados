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
from datetime import datetime, timezone
import math
import re
import uuid

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

