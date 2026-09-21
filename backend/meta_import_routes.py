"""
Meta Ads CSV import — Projects > Meta Ads > Campaigns / Ads > "Import CSV".

Meta Ads Manager's own exports, one file per level (Campaign / Ad Set / Ad),
for a single reporting day. None of the three files carries its parent's name
(the Ad Set export has no Campaign name column; the Ad export has neither), so
the caller picks the parent(s) once per import instead of guessing from the
file. The CSV is parsed in the browser (column names vary by level and by
whatever the user renamed a column to); this router only sees the already
normalized rows.

Only the Ad-level import writes performance numbers (leads / spend / ...) —
that's the only level with an ad_id, which the day-report model
(meta_reports_routes.DAILY) is keyed on. It does so by building a normal
DailySave and handing it to save_daily_report, so an imported day behaves
exactly like one typed in by hand (same coverage/task-completion rules).
Campaign and Ad Set imports only bulk-create/update structure (name + a daily
budget, when the file states one) — there is nowhere to attach their own
spend/leads figures to in that data model.

A name in the file that doesn't already exist under the chosen parent is
created; one that matches (case-insensitive, trimmed) is reused and, if the
file states a daily budget, has it updated.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from meta_reports_routes import _load_meta_project, _clean_date, _today_ist, DailySave, AdReportRow, save_daily_report

meta_import_router = APIRouter(prefix="/meta-import", tags=["meta-import"])


class ImportRow(BaseModel):
    name: str
    spend: Optional[float] = None
    leads: Optional[float] = None
    impressions: Optional[float] = None
    reach: Optional[float] = None
    budget_amount: Optional[float] = None
    budget_is_daily: Optional[bool] = None  # True = a real daily budget to apply; None/False = leave budget alone
    date_created: Optional[str] = None  # ads only — Meta's own "Date created" for the ad


class CampaignImportPayload(BaseModel):
    date: str
    rows: List[ImportRow]


class AdSetImportPayload(BaseModel):
    date: str
    campaign_id: str
    rows: List[ImportRow]


class AdImportPayload(BaseModel):
    date: str
    campaign_id: str
    ad_set_id: str
    rows: List[ImportRow]


def _norm(name: str) -> str:
    return " ".join((name or "").split()).lower()


async def _require_importer(user, db) -> None:
    from projects_routes import _is_operation_head_or_admin
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can import Meta Ads data")


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _upsert_budget(history: Optional[list], amount: float, from_date: str) -> list:
    """Mirrors the frontend's upsertBudget: one entry per start date."""
    kept = [e for e in (history or []) if e.get("from_date") != from_date]
    kept.append({"id": _new_id("bud"), "amount": amount, "from_date": from_date})
    return sorted(kept, key=lambda e: e.get("from_date") or "")


def _validate_rows(rows: List[ImportRow]) -> None:
    if not rows:
        raise HTTPException(status_code=400, detail="The file has no rows to import")
    seen = set()
    for r in rows:
        name = " ".join((r.name or "").split())
        if not name:
            raise HTTPException(status_code=400, detail="Every row needs a name")
        key = _norm(name)
        if key in seen:
            raise HTTPException(status_code=400, detail=f'"{name}" appears twice in the file')
        seen.add(key)
        for field in ("spend", "leads", "impressions", "reach", "budget_amount"):
            v = getattr(r, field)
            if v is not None and (v < 0 or not isinstance(v, (int, float))):
                raise HTTPException(status_code=400, detail=f"{field} must be 0 or more")


@meta_import_router.post("/{project_id}/campaigns")
async def import_campaigns(project_id: str, payload: CampaignImportPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    await _require_importer(user, db)
    project = await _load_meta_project(user, db, project_id)
    day = _clean_date(payload.date, "date")
    if not day:
        raise HTTPException(status_code=400, detail="date is required")
    if day > _today_ist():
        raise HTTPException(status_code=400, detail="Can't import a report for a future day")
    _validate_rows(payload.rows)

    campaigns = project.get("campaigns") or []
    by_name = {_norm(c.get("name")): c for c in campaigns}
    created, matched, budgets_set = [], [], 0
    for r in payload.rows:
        name = " ".join(r.name.split())
        c = by_name.get(_norm(name))
        if not c:
            c = {"id": _new_id("camp"), "name": name, "budget_history": [], "ad_sets": []}
            campaigns.append(c)
            by_name[_norm(name)] = c
            created.append(name)
        else:
            matched.append(name)
        if r.budget_is_daily and r.budget_amount:
            c["budget_history"] = _upsert_budget(c.get("budget_history"), r.budget_amount, r.date_created or day)
            c["budget_type"] = "cbo"
            budgets_set += 1

    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"campaigns": campaigns, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"date": day, "created": created, "matched": matched, "budgets_set": budgets_set}


@meta_import_router.post("/{project_id}/ad-sets")
async def import_ad_sets(project_id: str, payload: AdSetImportPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    await _require_importer(user, db)
    project = await _load_meta_project(user, db, project_id)
    day = _clean_date(payload.date, "date")
    if not day:
        raise HTTPException(status_code=400, detail="date is required")
    if day > _today_ist():
        raise HTTPException(status_code=400, detail="Can't import a report for a future day")
    _validate_rows(payload.rows)

    campaigns = project.get("campaigns") or []
    campaign = next((c for c in campaigns if c.get("id") == payload.campaign_id), None)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found — pick the campaign this file's ad sets belong to")

    ad_sets = campaign.setdefault("ad_sets", [])
    by_name = {_norm(a.get("name")): a for a in ad_sets}
    created, matched, budgets_set = [], [], 0
    for r in payload.rows:
        name = " ".join(r.name.split())
        a = by_name.get(_norm(name))
        if not a:
            a = {"id": _new_id("adset"), "name": name, "locations": [], "budget_history": [], "ads": []}
            ad_sets.append(a)
            by_name[_norm(name)] = a
            created.append(name)
        else:
            matched.append(name)
        if r.budget_is_daily and r.budget_amount:
            a["budget_history"] = _upsert_budget(a.get("budget_history"), r.budget_amount, r.date_created or day)
            budgets_set += 1

    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"campaigns": campaigns, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"date": day, "created": created, "matched": matched, "budgets_set": budgets_set}


@meta_import_router.post("/{project_id}/ads")
async def import_ads(project_id: str, payload: AdImportPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    await _require_importer(user, db)
    project = await _load_meta_project(user, db, project_id)
    day = _clean_date(payload.date, "date")
    if not day:
        raise HTTPException(status_code=400, detail="date is required")
    if day > _today_ist():
        raise HTTPException(status_code=400, detail="Can't import a report for a future day")
    _validate_rows(payload.rows)

    campaigns = project.get("campaigns") or []
    campaign = next((c for c in campaigns if c.get("id") == payload.campaign_id), None)
    ad_set = next((a for a in (campaign or {}).get("ad_sets") or [] if a.get("id") == payload.ad_set_id), None)
    if not ad_set:
        raise HTTPException(status_code=404, detail="Campaign or ad set not found — pick the ad set this file's ads belong to")

    ads = ad_set.setdefault("ads", [])
    by_name = {_norm(ad.get("name")): ad for ad in ads}
    created, matched = [], []
    rows_for_save: List[AdReportRow] = []
    for r in payload.rows:
        name = " ".join(r.name.split())
        ad = by_name.get(_norm(name))
        if not ad:
            ad = {"id": _new_id("ad"), "name": name, "created_at": _clean_date(r.date_created, "date_created") or day, "ad_type": "static"}
            ads.append(ad)
            by_name[_norm(name)] = ad
            created.append(name)
        else:
            matched.append(name)
        if r.leads is None and r.spend is None and r.impressions is None and r.reach is None:
            continue  # a row can exist just to create the ad, with nothing to report yet
        rows_for_save.append(AdReportRow(ad_id=ad["id"], leads=r.leads, spend=r.spend, impressions=r.impressions, reach=r.reach))

    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"campaigns": campaigns, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    report = None
    if rows_for_save:
        report = await save_daily_report(
            project_id, day,
            DailySave(campaign_id=payload.campaign_id, ad_set_id=payload.ad_set_id, rows=rows_for_save),
            request,
        )
    return {"date": day, "created": created, "matched": matched, "reported": len(rows_for_save), "report": report}
