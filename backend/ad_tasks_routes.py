"""
Meta Ads "ad tasks" — the My Tasks side of the Ads tab.

Assigning Content / Creative / Editing / Ad Setup on an ad (Projects > Meta
Ads > Ads) creates a normal project task tagged with the ad
(`ad_campaign_id`, `ad_set_id`, `ad_id`, `ad_field`). These endpoints power
the special view of such a task in the assignee's My Tasks, and the steps
are ordered:

  * Content   -> submits a content link, which completes the task.
  * Creative / Editing -> can't start until Content is done; then upload a
                creative (image) and/or give a link, which completes the task.
  * Ad Setup  -> can't start until Content + Creative (+ Editing for a Reel)
                are done; then marks the ad In Review or Published (Published
                completes the task).

A step counts as "done" when its deliverable exists on the ad — a link (or an
uploaded file) — however it got there, so a link typed in on the Ads tab
unlocks the next step the same as a submitted task does. Only the assignee
acts on a task, and the guards below also close the other ways a task can be
started or completed (timer, status change, send-for-approval).
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
import uuid

ad_tasks_router = APIRouter(prefix="/ad-tasks", tags=["ad-tasks"])

AD_FIELD_LABELS = {"content": "Content", "creative": "Creative", "editing": "Editing", "setup": "Ad Setup"}
FILE_FIELDS = ("creative", "editing")  # steps that can carry an uploaded file
MAX_FILE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = ("image/png", "image/jpeg", "image/gif", "image/webp")


class AdFilePayload(BaseModel):
    name: str
    content_type: str
    data_url: str


class AdSubmitPayload(BaseModel):
    link: Optional[str] = None
    file: Optional[AdFilePayload] = None
    action: Optional[str] = None  # Ad Setup only: "in_review" | "publish"


# ---------------------------------------------------------------- pure logic

def find_ad(project: Optional[dict], campaign_id: str, ad_set_id: str, ad_id: str) -> Tuple[Optional[dict], Optional[dict], Optional[dict]]:
    """(campaign, ad_set, ad) for the given ids, or (None, None, None)."""
    for c in (project or {}).get("campaigns") or []:
        if c.get("id") != campaign_id:
            continue
        for s in c.get("ad_sets") or []:
            if s.get("id") != ad_set_id:
                continue
            for a in s.get("ads") or []:
                if a.get("id") == ad_id:
                    return c, s, a
    return None, None, None


def deliverable_present(ad: dict, key: str) -> bool:
    """Has this step's deliverable been provided on the ad?"""
    if key == "content":
        return bool((ad.get("content_link") or "").strip())
    return bool((ad.get(f"{key}_link") or "").strip() or ad.get(f"{key}_file_id"))


def blockers_for(ad: dict, field: str) -> List[Dict[str, str]]:
    """The earlier steps still outstanding before `field` may start."""
    if field == "content":
        return []
    required = ["content"]
    if field == "setup":
        required.append("creative")
        if (ad.get("ad_type") or "static") == "reel":
            required.append("editing")
    return [{"key": k, "label": AD_FIELD_LABELS[k]} for k in required if not deliverable_present(ad, k)]


def blocked_message(blockers: List[Dict[str, str]]) -> str:
    names = " and ".join(b["label"] for b in blockers)
    return f"Waiting for {names} to be completed before this can start."


def parse_image(file: AdFilePayload) -> None:
    """Validate an uploaded creative: a real base64 image within the size cap."""
    ctype = (file.content_type or "").lower()
    if ctype not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only PNG, JPG, GIF or WebP images can be uploaded — share videos as a link.")
    prefix = f"data:{ctype};base64,"
    if not file.data_url.lower().startswith(prefix):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")
    b64 = file.data_url[len(prefix):]
    if len(b64) * 3 // 4 > MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large (max 5MB) — share it as a link instead.")


def build_ad_update(patch: Dict[str, Any], campaign_id: str, ad_set_id: str, ad_id: str, now_iso: str):
    """The (update doc, array_filters) that set `patch` on exactly one nested ad."""
    update = {"$set": {**{f"campaigns.$[c].ad_sets.$[s].ads.$[a].{k}": v for k, v in patch.items()}, "updated_at": now_iso}}
    filters = [{"c.id": campaign_id}, {"s.id": ad_set_id}, {"a.id": ad_id}]
    return update, filters


def close_timer(time_tracking: Optional[dict], now: datetime) -> dict:
    """Stop a running timer (as the normal Finish does) so completing a task
    by submitting doesn't leave a phantom running session behind."""
    tt = dict(time_tracking or {"total_seconds": 0, "status": "not_started", "sessions": []})
    tt.setdefault("sessions", [])
    tt.setdefault("total_seconds", 0)
    if tt.get("status") == "running" and tt["sessions"]:
        cur = tt["sessions"][-1]
        if cur.get("end") is None:
            start = datetime.fromisoformat(cur["start"].replace("Z", "+00:00"))
            secs = int((now - start).total_seconds())
            cur["end"] = now.isoformat()
            cur["duration_seconds"] = secs
            tt["total_seconds"] += secs
        tt["status"] = "finished"
        tt.pop("current_session_start", None)
    return tt


# ---------------------------------------------------------------- db helpers

async def _load(db, task_id: str):
    task = await db.our_tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not task.get("ad_field") or not task.get("ad_id"):
        raise HTTPException(status_code=400, detail="This task isn't linked to a Meta Ads ad")
    project = await db.projects.find_one(
        {"project_id": task.get("project_id")}, {"_id": 0, "name": 1, "campaigns": 1}
    )
    campaign, ad_set, ad = find_ad(project, task.get("ad_campaign_id"), task.get("ad_set_id"), task.get("ad_id"))
    return task, project, campaign, ad_set, ad


async def _file_meta(db, file_id: Optional[str]) -> Optional[dict]:
    if not file_id:
        return None
    doc = await db.ad_creative_files.find_one({"file_id": file_id}, {"_id": 0})
    if not doc:
        return None
    return {"file_id": doc["file_id"], "name": doc.get("filename"), "content_type": doc.get("content_type"), "data_url": doc.get("data_url")}


async def guard_ad_task(db, task: dict, kind: str) -> None:
    """Called from the shared task endpoints (timer, status change, send for
    approval). `kind` is "start" or "complete". Ad tasks can only be completed
    by submitting from their panel, and can only start once the earlier steps
    are done. A task whose ad has been removed is left alone so it can't get
    stuck."""
    field = task.get("ad_field")
    if not field:
        return
    project = await db.projects.find_one({"project_id": task.get("project_id")}, {"_id": 0, "campaigns": 1})
    _, _, ad = find_ad(project, task.get("ad_campaign_id"), task.get("ad_set_id"), task.get("ad_id"))
    if not ad:
        return
    if kind == "complete":
        raise HTTPException(
            status_code=400,
            detail="This task is completed by submitting it from the task panel (Meta Ads details), not from here.",
        )
    if kind == "start":
        blockers = blockers_for(ad, field)
        if blockers:
            raise HTTPException(status_code=400, detail=blocked_message(blockers))


async def annotate_ad_blocked(db, tasks: List[dict]) -> None:
    """Sets `ad_blocked_message` on open ad tasks that are still waiting on an
    earlier step, so My Tasks can disable their timer instead of letting the
    click fail. One batched project lookup for the whole list; tasks whose ad
    has been removed are left unflagged (same as the guard)."""
    open_ad_tasks = [t for t in tasks if t.get("ad_field") and t.get("status") != "completed"]
    if not open_ad_tasks:
        return
    project_ids = list({t["project_id"] for t in open_ad_tasks if t.get("project_id")})
    projects: Dict[str, dict] = {}
    async for p in db.projects.find({"project_id": {"$in": project_ids}}, {"_id": 0, "project_id": 1, "campaigns": 1}):
        projects[p["project_id"]] = p
    for t in open_ad_tasks:
        _, _, ad = find_ad(projects.get(t.get("project_id")), t.get("ad_campaign_id"), t.get("ad_set_id"), t.get("ad_id"))
        if not ad:
            continue
        blockers = blockers_for(ad, t["ad_field"])
        if blockers:
            t["ad_blocked_message"] = blocked_message(blockers)


# ----------------------------------------------------------------- endpoints

@ad_tasks_router.get("/tasks/{task_id}/context")
async def get_ad_task_context(task_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    task, project, campaign, ad_set, ad = await _load(db, task_id)
    if not ad:
        raise HTTPException(status_code=404, detail="This ad was removed from the Ads tab")
    field = task["ad_field"]
    blockers = blockers_for(ad, field)
    is_assignee = task.get("assigned_to") == user.user_id
    completed = task.get("status") == "completed"
    return {
        "field": field,
        "field_label": AD_FIELD_LABELS.get(field, field),
        "project_name": (project or {}).get("name"),
        "campaign_name": (campaign or {}).get("name"),
        "ad_set_name": (ad_set or {}).get("name"),
        "ad_name": ad.get("name"),
        "ad_type": ad.get("ad_type") or "static",
        "locations": (ad_set or {}).get("locations") or [],
        "content_link": ad.get("content_link") or "",
        "creative_link": ad.get("creative_link") or "",
        "creative_file": await _file_meta(db, ad.get("creative_file_id")),
        "editing_link": ad.get("editing_link") or "",
        "editing_file": await _file_meta(db, ad.get("editing_file_id")),
        "requires_editing": (ad.get("ad_type") or "static") == "reel",
        "setup_status": ad.get("setup_status") or "pending",
        "blockers": blockers,
        "blocked": bool(blockers),
        "blocked_message": blocked_message(blockers) if blockers else "",
        "is_assignee": is_assignee,
        "task_status": task.get("status"),
        "can_submit": is_assignee and not completed and not blockers,
    }


@ad_tasks_router.get("/files/{file_id}")
async def get_ad_creative_file(file_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    doc = await db.ad_creative_files.find_one({"file_id": file_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    return doc


@ad_tasks_router.post("/tasks/{task_id}/submit")
async def submit_ad_task(task_id: str, payload: AdSubmitPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    task, project, campaign, ad_set, ad = await _load(db, task_id)
    if not ad:
        raise HTTPException(status_code=404, detail="This ad was removed from the Ads tab")
    if task.get("assigned_to") != user.user_id:
        raise HTTPException(status_code=403, detail="Only the assignee can do this")
    if task.get("status") == "completed":
        raise HTTPException(status_code=400, detail="This task is already completed")

    field = task["ad_field"]
    blockers = blockers_for(ad, field)
    if blockers:
        raise HTTPException(status_code=400, detail=blocked_message(blockers))

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    patch: Dict[str, Any] = {}
    complete = True

    if field == "content":
        link = (payload.link or "").strip()
        if not link:
            raise HTTPException(status_code=400, detail="Content link is required to complete this task")
        patch["content_link"] = link

    elif field in FILE_FIELDS:
        link = (payload.link or "").strip()
        if not link and not payload.file:
            raise HTTPException(status_code=400, detail="Upload the creative or add its link to complete this task")
        if link:
            patch[f"{field}_link"] = link
        if payload.file:
            parse_image(payload.file)
            file_id = f"adf_{uuid.uuid4().hex[:12]}"
            await db.ad_creative_files.insert_one({
                "file_id": file_id,
                "project_id": task.get("project_id"),
                "campaign_id": task.get("ad_campaign_id"),
                "ad_set_id": task.get("ad_set_id"),
                "ad_id": task.get("ad_id"),
                "field": field,
                "filename": (payload.file.name or "creative")[:200],
                "content_type": payload.file.content_type.lower(),
                "data_url": payload.file.data_url,
                "uploaded_by": user.user_id,
                "uploaded_by_name": user.name,
                "uploaded_at": now_iso,
            })
            old_id = ad.get(f"{field}_file_id")
            if old_id:
                await db.ad_creative_files.delete_one({"file_id": old_id})
            patch[f"{field}_file_id"] = file_id
            patch[f"{field}_file_name"] = (payload.file.name or "creative")[:200]

    else:  # setup
        if payload.action not in ("in_review", "publish"):
            raise HTTPException(status_code=400, detail="Choose Mark In Review or Publish")
        if payload.action == "in_review":
            patch["setup_status"] = "in_review"
            complete = False
        else:
            patch["setup_status"] = "published"

    patch[f"{field}_task_status"] = "completed" if complete else "in_progress"
    patch[f"{field}_submitted_by_name"] = user.name
    patch[f"{field}_submitted_at"] = now_iso

    update, filters = build_ad_update(patch, task["ad_campaign_id"], task["ad_set_id"], task["ad_id"], now_iso)
    result = await db.projects.update_one({"project_id": task.get("project_id")}, update, array_filters=filters)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="This ad was removed from the Ads tab")

    task_set: Dict[str, Any] = {"updated_at": now_iso}
    if complete:
        task_set.update({
            "status": "completed",
            "reference_image": None,
            "time_tracking": close_timer(task.get("time_tracking"), now),
        })
    elif task.get("status") == "pending":
        task_set["status"] = "in_progress"
    await db.our_tasks.update_one({"task_id": task_id}, {"$set": task_set})
    return await db.our_tasks.find_one({"task_id": task_id}, {"_id": 0})
