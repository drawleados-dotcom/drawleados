"""
Meta Ads daily campaign reports.

A task tagged with the "Report" category on a Meta Ads project gets a
"Submit Report" action in the task list. The assignee picks one or more
campaigns (defined per-project on the Campaigns tab) and logs that day's
numbers (leads, cost per lead, spend, quality, conversions, remarks).
Submissions are stored here and surfaced on the project's Reports tab —
a per-date total summary with a collapsible campaign-wise breakdown.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
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
