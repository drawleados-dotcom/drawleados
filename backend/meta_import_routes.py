"""
Meta Ads CSV import — Projects > Meta Ads > Campaigns / Ads > "Import CSV".

Meta Ads Manager's own exports, one file per level (Campaign / Ad Set / Ad).
None of the three files carries its parent's name (the Ad Set export has no
Campaign name column; the Ad export has neither), so the caller picks the
parent(s) once per import instead of guessing from the file. The CSV is
parsed in the browser (column names vary by level and by whatever the user
renamed a column to); this router only sees the already normalized rows,
grouped into one or more reporting days.

Each row still has to be a genuine single day (Meta's "Reporting starts" ==
"Reporting ends") — that's what makes a row's numbers meaningful rather than
a month aggregated into one line. A file can carry many such days at once
(Meta's own "breakdown by day" export produces exactly this: one row per
entity per day, spanning however wide a range was picked), and every day in
it is imported in the same request.

Only the Ad-level import writes performance numbers (leads / spend / ...) —
that's the only level with an ad_id, which the day-report model
(meta_reports_routes.DAILY) is keyed on. It does so by building a normal
DailySave per day and handing it to save_daily_report, so each imported day
behaves exactly like one typed in by hand (same coverage/task-completion
rules). Campaign and Ad Set imports only bulk-create/update structure (name +
a daily budget, when a given day's row states one) — there is nowhere to
attach their own spend/leads figures to in that data model.

A name in the file that doesn't already exist under the chosen parent is
created (once, the first time it's seen across every day in the file); one
that matches (case-insensitive, trimmed) is reused and, on each day the file
states a daily budget for it, has that day's budget applied.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from meta_reports_routes import _load_meta_project, _clean_date, _today_ist, DailySave, AdReportRow, save_daily_report

meta_import_router = APIRouter(prefix="/meta-import", tags=["meta-import"])

MAX_DAYS_PER_IMPORT = 366


class ImportRow(BaseModel):
    name: str
    spend: Optional[float] = None
    leads: Optional[float] = None
    impressions: Optional[float] = None
    reach: Optional[float] = None
    budget_amount: Optional[float] = None
    budget_is_daily: Optional[bool] = None  # True = a real daily budget to apply; None/False = leave budget alone
    date_created: Optional[str] = None  # ads only — Meta's own "Date created" for the ad


class ImportDay(BaseModel):
    date: str
    rows: List[ImportRow]


class CampaignImportPayload(BaseModel):
    days: List[ImportDay]


class AdSetImportPayload(BaseModel):
    campaign_id: str
    days: List[ImportDay]


class AdImportPayload(BaseModel):
    campaign_id: str
    ad_set_id: str
    days: List[ImportDay]


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
            raise HTTPException(status_code=400, detail=f'"{name}" appears twice for the same day in the file')
        seen.add(key)
        for field in ("spend", "leads", "impressions", "reach", "budget_amount"):
            v = getattr(r, field)
            if v is not None and (v < 0 or not isinstance(v, (int, float))):
                raise HTTPException(status_code=400, detail=f"{field} must be 0 or more")


def _validate_days(days: List[ImportDay]) -> List[str]:
    """Cleans each day's date and checks the whole batch. Returns the clean
    dates in the same order as `days`."""
    if not days:
        raise HTTPException(status_code=400, detail="No reporting days to import")
    if len(days) > MAX_DAYS_PER_IMPORT:
        raise HTTPException(status_code=400, detail=f"That's {len(days)} reporting days in one file — the most this can import at once is {MAX_DAYS_PER_IMPORT}")
    today = _today_ist()
    cleaned, seen = [], set()
    for d in days:
        day = _clean_date(d.date, "date")
        if not day:
            raise HTTPException(status_code=400, detail="Every reporting day needs a date")
        if day > today:
            raise HTTPException(status_code=400, detail=f"Can't import a report for {day} — that's a future day")
        if day in seen:
            raise HTTPException(status_code=400, detail=f"{day} appears more than once in this file")
        seen.add(day)
        _validate_rows(d.rows)
        cleaned.append(day)
    return cleaned


def _apply_structure_rows(entities: list, by_name: dict, make_new, days: List[ImportDay], dates: List[str], on_budget_applied=None):
    """Shared create/match/budget loop for Campaign- and Ad-Set-level imports.
    `entities` is the list the new/matched dict gets appended to (mutated in
    place); `by_name` maps a normalized name to its dict (also mutated).
    `on_budget_applied(entity)`, if given, runs whenever a day's budget was
    actually applied to that entity (campaigns also flip to CBO; ad sets have
    no such flag). Returns (created_names, matched_names, budgets_set)."""
    already_had = set(by_name.keys())
    created, matched, reported_matched, budgets_set = [], [], set(), 0
    for day, day_date in zip(days, dates):
        for r in day.rows:
            name = " ".join(r.name.split())
            key = _norm(name)
            entity = by_name.get(key)
            if not entity:
                entity = make_new(name)
                entities.append(entity)
                by_name[key] = entity
                created.append(name)
            elif key in already_had and key not in reported_matched:
                matched.append(name)
                reported_matched.add(key)
            if r.budget_is_daily and r.budget_amount:
                entity["budget_history"] = _upsert_budget(entity.get("budget_history"), r.budget_amount, r.date_created or day_date)
                budgets_set += 1
                if on_budget_applied:
                    on_budget_applied(entity)
    return created, matched, budgets_set


@meta_import_router.post("/{project_id}/campaigns")
async def import_campaigns(project_id: str, payload: CampaignImportPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    await _require_importer(user, db)
    project = await _load_meta_project(user, db, project_id)
    dates = _validate_days(payload.days)

    campaigns = project.get("campaigns") or []
    by_name = {_norm(c.get("name")): c for c in campaigns}
    created, matched, budgets_set = _apply_structure_rows(
        campaigns, by_name,
        lambda name: {"id": _new_id("camp"), "name": name, "budget_history": [], "ad_sets": []},
        payload.days, dates,
        on_budget_applied=lambda c: c.__setitem__("budget_type", "cbo"),
    )

    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"campaigns": campaigns, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"dates": dates, "created": created, "matched": matched, "budgets_set": budgets_set}


@meta_import_router.post("/{project_id}/ad-sets")
async def import_ad_sets(project_id: str, payload: AdSetImportPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    await _require_importer(user, db)
    project = await _load_meta_project(user, db, project_id)
    dates = _validate_days(payload.days)

    campaigns = project.get("campaigns") or []
    campaign = next((c for c in campaigns if c.get("id") == payload.campaign_id), None)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found — pick the campaign this file's ad sets belong to")

    ad_sets = campaign.setdefault("ad_sets", [])
    by_name = {_norm(a.get("name")): a for a in ad_sets}
    created, matched, budgets_set = _apply_structure_rows(
        ad_sets, by_name,
        lambda name: {"id": _new_id("adset"), "name": name, "locations": [], "budget_history": [], "ads": []},
        payload.days, dates,
    )

    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"campaigns": campaigns, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"dates": dates, "created": created, "matched": matched, "budgets_set": budgets_set}


@meta_import_router.post("/{project_id}/ads")
async def import_ads(project_id: str, payload: AdImportPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    await _require_importer(user, db)
    project = await _load_meta_project(user, db, project_id)
    dates = _validate_days(payload.days)

    campaigns = project.get("campaigns") or []
    campaign = next((c for c in campaigns if c.get("id") == payload.campaign_id), None)
    ad_set = next((a for a in (campaign or {}).get("ad_sets") or [] if a.get("id") == payload.ad_set_id), None)
    if not ad_set:
        raise HTTPException(status_code=404, detail="Campaign or ad set not found — pick the ad set this file's ads belong to")

    ads = ad_set.setdefault("ads", [])
    by_name = {_norm(ad.get("name")): ad for ad in ads}
    already_had = set(by_name.keys())
    created, matched, reported_matched = [], [], set()

    # Pass 1 — create/match every ad name across every day (union), so an ad
    # that first appears mid-month is still there when its day is reported.
    for day, day_date in zip(payload.days, dates):
        for r in day.rows:
            name = " ".join(r.name.split())
            key = _norm(name)
            ad = by_name.get(key)
            if not ad:
                ad = {"id": _new_id("ad"), "name": name, "created_at": _clean_date(r.date_created, "date_created") or day_date, "ad_type": "static"}
                ads.append(ad)
                by_name[key] = ad
                created.append(name)
            elif key in already_had and key not in reported_matched:
                matched.append(name)
                reported_matched.add(key)

    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"campaigns": campaigns, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    # Pass 2 — one save_daily_report call per day, exactly like a manual entry.
    reported, days_summary = 0, []
    for day, day_date in zip(payload.days, dates):
        rows_for_save: List[AdReportRow] = []
        for r in day.rows:
            if r.leads is None and r.spend is None and r.impressions is None and r.reach is None:
                continue  # a row can exist just to create the ad, with nothing to report that day
            ad = by_name[_norm(" ".join(r.name.split()))]
            rows_for_save.append(AdReportRow(ad_id=ad["id"], leads=r.leads, spend=r.spend, impressions=r.impressions, reach=r.reach))
        if not rows_for_save:
            continue
        report = await save_daily_report(
            project_id, day_date,
            DailySave(campaign_id=payload.campaign_id, ad_set_id=payload.ad_set_id, rows=rows_for_save),
            request,
        )
        reported += len(rows_for_save)
        days_summary.append({"date": day_date, "leads": report.get("leads"), "spend": report.get("spend"), "status": report.get("status")})

    return {"dates": dates, "created": created, "matched": matched, "reported": reported, "days": days_summary}
