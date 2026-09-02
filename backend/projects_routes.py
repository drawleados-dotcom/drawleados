"""
Projects routes — operational project management.

A "Project" is a container of tasks. When a task is added to a project, the
project name & id are stamped on the task so it auto-appears in the assigned
user's Operations > My Tasks list with a project badge.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import secrets
import string


projects_router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    client_id: str  # MANDATORY — points to finance_clients.client_id
    description: Optional[str] = ""
    start_date: Optional[str] = None  # ISO date string
    due_date: Optional[str] = None  # ISO date string
    members: Optional[List[str]] = []   # user_ids
    departments: Optional[List[str]] = []  # department keys: website, social_media, meta, seo, finance, hr, business_dev, erp
    status: Optional[str] = "active"     # active | completed | on_hold
    project_type: Optional[str] = None   # onetime | monthly


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_id: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    members: Optional[List[str]] = None
    departments: Optional[List[str]] = None
    status: Optional[str] = None
    project_type: Optional[str] = None   # onetime | monthly
    documents: Optional[List[dict]] = None
    payment_schedule: Optional[dict] = None
    project_expense: Optional[dict] = None
    content_calendar: Optional[List[dict]] = None
    pages: Optional[List[dict]] = None
    erp_users: Optional[List[dict]] = None
    erp_departments: Optional[List[dict]] = None
    erp_workflow: Optional[List[dict]] = None
    campaigns: Optional[List[dict]] = None
    backlinks: Optional[List[dict]] = None
    backlink_weekly_targets: Optional[List[dict]] = None
    website_link: Optional[str] = None
    proposal_link: Optional[str] = None
    delivery_date_history: Optional[List[dict]] = None


class DeleteProjectRequest(BaseModel):
    password: str


class ProjectReorderItem(BaseModel):
    project_id: str
    order: int


class ProjectReorderRequest(BaseModel):
    projects: List[ProjectReorderItem]


class RecordSplitAgainstInvoiceRequest(BaseModel):
    invoice_id: str


class DailyNoteCreate(BaseModel):
    note: str
    note_date: Optional[str] = None   # YYYY-MM-DD — defaults to today (IST)
    department: Optional[str] = None  # optional tag for multi-department projects


class DailyNoteUpdate(BaseModel):
    note: Optional[str] = None
    note_date: Optional[str] = None
    department: Optional[str] = None


class ProjectTaskCreate(BaseModel):
    task_name: str
    description: Optional[str] = ""
    assigned_to: str  # user_id
    due_date: Optional[str] = None
    priority: Optional[str] = "medium"
    work_link: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    # ERP-project tagging (only set when project has the `erp` department):
    # one of the project's erp_users, then one of that user's pages.
    erp_user_id: Optional[str] = None
    erp_user_name: Optional[str] = None
    erp_page_id: Optional[str] = None
    erp_page_name: Optional[str] = None
    erp_task_type: Optional[str] = None  # New Module, New Feature, Correction


async def _is_operation_head_or_admin(user, db) -> bool:
    """User can create/edit projects if they are super_admin, admin, or their
    designation has been granted 'edit' access to operations_projects.

    Previously this matched designation == 'Operation Head' by exact string,
    which silently locked out anyone whose actual designation title differed
    from that literal string (e.g. "Head of Operations") — even when their
    designation's operations_projects config was explicitly set to 'edit'.
    """
    role = (getattr(user, "role", "") or "").lower()
    if role in {"super_admin", "admin"}:
        return True
    user_doc = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0, "designation": 1}
    )
    if not user_doc:
        return False
    desg_title = (user_doc.get("designation") or "").strip()
    if not desg_title:
        return False
    import re as _re
    desg_doc = await db.designations.find_one(
        {"title": {"$regex": f"^\\s*{_re.escape(desg_title)}\\s*$", "$options": "i"}},
        {"_id": 0, "operations_projects": 1}
    )
    if not desg_doc:
        return False
    return (desg_doc.get("operations_projects") or "none") == "edit"


async def _filter_erp_visibility(project: dict, user, db) -> dict:
    """Departments/sub-departments can carry an `assigned_user_ids` team —
    real user_ids, picked from the project's own Team members (Projects >
    ERP > Departments > Assign Access Team). A non-admin viewer only sees
    erp_users whose own department — and sub-department, if any — either
    has no team configured (open by default) or includes the viewer's own
    user_id. Tasks tagged to a now-hidden erp_user are hidden with it.
    Admins/Operation Head always see everything, unfiltered."""
    if await _is_operation_head_or_admin(user, db):
        return project

    erp_departments = project.get("erp_departments") or []
    has_any_restriction = any(
        (d.get("assigned_user_ids") or []) or any((sd.get("assigned_user_ids") or []) for sd in (d.get("sub_departments") or []))
        for d in erp_departments
    )
    if not has_any_restriction:
        return project

    erp_users = project.get("erp_users") or []
    dept_by_id = {d.get("id"): d for d in erp_departments}

    def _accessible(team_ids):
        return not team_ids or user.user_id in team_ids

    def _visible(eu: dict) -> bool:
        dept = dept_by_id.get(eu.get("department_id"))
        if not dept:
            return True
        if not _accessible(dept.get("assigned_user_ids") or []):
            return False
        sub_id = eu.get("sub_department_id")
        if sub_id:
            sub = next((s for s in (dept.get("sub_departments") or []) if s.get("id") == sub_id), None)
            if sub and not _accessible(sub.get("assigned_user_ids") or []):
                return False
        return True

    visible_erp_users = [eu for eu in erp_users if _visible(eu)]
    visible_ids = {eu["id"] for eu in visible_erp_users}
    project = dict(project)
    project["erp_users"] = visible_erp_users
    if project.get("tasks"):
        project["tasks"] = [
            t for t in project["tasks"]
            if not t.get("erp_user_id") or t.get("erp_user_id") in visible_ids
        ]
    return project


async def _can_view_project(user, db, project: dict) -> bool:
    """Same visibility rule as the project list: admins/ops see every project,
    everyone else only the ones they're a member of (or created)."""
    if await _is_operation_head_or_admin(user, db):
        return True
    return user.user_id in (project.get("members") or []) or project.get("created_by") == user.user_id


# IST — the office timezone. "Today's update" must mean today in Chennai, not
# today in UTC, otherwise every note filed after 5:30 AM IST … 12:00 AM UTC
# would land on the wrong day.
IST = timezone(timedelta(hours=5, minutes=30))


def _today_ist() -> str:
    return datetime.now(IST).date().isoformat()


def _validate_note_date(value: str) -> str:
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date().isoformat()
    except Exception:
        raise HTTPException(status_code=400, detail="note_date must be in YYYY-MM-DD format")


@projects_router.get("")
async def list_projects(request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)

    is_admin_or_ops = await _is_operation_head_or_admin(user, db)

    # Super Admin / Admin / Operations → see ALL projects
    # Everyone else → only projects they're a member of or created
    query: dict = {} if is_admin_or_ops else {
        "$or": [
            {"members": user.user_id},
            {"created_by": user.user_id},
        ]
    }
    projects = await db.projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

    # Lazy-backfill `order` for legacy docs that predate manual reordering —
    # assigns it in the same created_at-desc sequence so the newest project
    # keeps the smallest number (stays on top) the first time it's read.
    missing_order = [p for p in projects if p.get("order") is None]
    if missing_order:
        top = await db.projects.find({"order": {"$ne": None}}).sort("order", 1).limit(1).to_list(1)
        # Assign a block of values strictly below the current minimum, so
        # backfilled legacy docs don't collide with or displace anything
        # already manually ordered. `missing_order` is still created_at-desc
        # (newest first) here, so counting up from the bottom of that block
        # gives the newest legacy project the smallest number, i.e. top.
        next_order = (top[0]["order"] - len(missing_order)) if top else 0
        for p in missing_order:
            p["order"] = next_order
            await db.projects.update_one({"project_id": p["project_id"]}, {"$set": {"order": next_order}})
            next_order += 1
    for p in projects:
        p.setdefault("is_pinned", False)

    # Batched task counts — single aggregation instead of 2*N count_documents.
    project_ids = [p.get("project_id") for p in projects if p.get("project_id")]
    counts_map: dict = {}
    if project_ids:
        pipeline = [
            {"$match": {"project_id": {"$in": project_ids}}},
            {"$group": {
                "_id": "$project_id",
                "total": {"$sum": 1},
                "completed": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
                "pending_approval": {"$sum": {"$cond": [{"$eq": ["$approval_request.status", "pending"]}, 1, 0]}},
                "approved": {"$sum": {"$cond": [{"$eq": ["$approval_request.status", "approved"]}, 1, 0]}},
            }},
        ]
        async for row in db.our_tasks.aggregate(pipeline):
            counts_map[row["_id"]] = row
    for p in projects:
        pid = p.get("project_id")
        c = counts_map.get(pid, {})
        p["task_count"] = c.get("total", 0)
        p["completed_task_count"] = c.get("completed", 0)
        p["pending_approval_task_count"] = c.get("pending_approval", 0)
        p["approved_task_count"] = c.get("approved", 0)

    # Pinned projects float to the top (by their own order rank), then
    # everything else follows in manual order — replaces the old
    # created_at-only ordering now that rows are user-orderable.
    projects.sort(key=lambda p: (0 if p.get("is_pinned") else 1, p.get("order", 0)))
    return projects


@projects_router.post("")
async def create_project(payload: ProjectCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)

    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can create projects")

    members = list(payload.members or [])
    # Ensure creator is always a member (so they can see their own project)
    if user.user_id not in members:
        members.append(user.user_id)

    # Validate client_id — mandatory & must exist in finance_clients
    if not (payload.client_id or "").strip():
        raise HTTPException(status_code=400, detail="Client is required")
    client_doc = await db.finance_clients.find_one(
        {"client_id": payload.client_id, "is_deleted": False},
        {"_id": 0, "client_id": 1, "display_name": 1}
    )
    if not client_doc:
        raise HTTPException(status_code=400, detail="Selected client does not exist")

    # New projects land at the top of the unpinned group by default (matches
    # the old "newest first" feel) — one below the current lowest order.
    lowest = await db.projects.find({"is_pinned": {"$ne": True}}, {"order": 1}).sort("order", 1).limit(1).to_list(1)
    next_order = (lowest[0].get("order", 0) - 1) if lowest else 0

    project = {
        "project_id": f"prj_{uuid.uuid4().hex[:12]}",
        "name": payload.name.strip(),
        "client_id": client_doc["client_id"],
        "client_name": client_doc.get("display_name", ""),
        "description": (payload.description or "").strip(),
        "start_date": payload.start_date,
        "due_date": payload.due_date,
        "members": members,
        "departments": payload.departments or [],
        "status": payload.status or "active",
        "project_type": payload.project_type,
        "is_pinned": False,
        "order": next_order,
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if not project["name"]:
        raise HTTPException(status_code=400, detail="Project name is required")
    await db.projects.insert_one(project)
    project.pop("_id", None)
    return project


@projects_router.put("/reorder")
async def reorder_projects(payload: ProjectReorderRequest, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can reorder projects")
    for item in payload.projects:
        await db.projects.update_one({"project_id": item.project_id}, {"$set": {"order": item.order}})
    return {"message": "Projects reordered"}


@projects_router.put("/{project_id}/pin")
async def toggle_pin_project(project_id: str, request: Request, department: str = None):
    from server import get_current_user, db
    user = await get_current_user(request)
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can pin projects")

    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.get("is_pinned", False):
        # Pinned from within a specific department's view (the frontend
        # passes ?department=<dept_key> whenever a department filter, not
        # "All", is active) — cap that department's own pins so one
        # department maxing out the pin pool can't block every other
        # department from pinning anything. The "All" view (no department
        # param) keeps the original global cap.
        if department:
            pinned_count = await db.projects.count_documents({"is_pinned": True, "departments": department})
            if pinned_count >= 4:
                raise HTTPException(status_code=400, detail="Maximum 4 projects can be pinned per department")
        else:
            pinned_count = await db.projects.count_documents({"is_pinned": True})
            if pinned_count >= 5:
                raise HTTPException(status_code=400, detail="Maximum 5 projects can be pinned")
        top = await db.projects.find({"is_pinned": True}, {"order": 1}).sort("order", -1).limit(1).to_list(1)
        new_order = (top[0].get("order", 0) + 1) if top else 0
        await db.projects.update_one({"project_id": project_id}, {"$set": {"is_pinned": True, "order": new_order}})
    else:
        bottom = await db.projects.find({"is_pinned": {"$ne": True}}, {"order": 1}).sort("order", -1).limit(1).to_list(1)
        new_order = (bottom[0].get("order", 0) + 1) if bottom else 0
        await db.projects.update_one({"project_id": project_id}, {"$set": {"is_pinned": False, "order": new_order}})

    return await db.projects.find_one({"project_id": project_id}, {"_id": 0})


@projects_router.get("/{project_id}")
async def get_project(project_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = await db.our_tasks.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    project["tasks"] = tasks
    project = await _filter_erp_visibility(project, user, db)
    return project


@projects_router.patch("/{project_id}")
async def update_project(project_id: str, payload: ProjectUpdate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can edit projects")
    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    # If client_id is being updated, validate and refresh client_name.
    if "client_id" in update_data:
        new_cid = (update_data["client_id"] or "").strip()
        if not new_cid:
            raise HTTPException(status_code=400, detail="Client is required")
        client_doc = await db.finance_clients.find_one(
            {"client_id": new_cid, "is_deleted": False},
            {"_id": 0, "client_id": 1, "display_name": 1}
        )
        if not client_doc:
            raise HTTPException(status_code=400, detail="Selected client does not exist")
        update_data["client_id"] = client_doc["client_id"]
        update_data["client_name"] = client_doc.get("display_name", "")
    # Payment schedule editing — relaxed: Operation Head can add/edit splits.
    # But the "collected" field on any split can ONLY be flipped by Super Admin / Admin / Finance role.
    if "payment_schedule" in update_data:
        role = (user.role or "").lower()
        privileged = role in ("super_admin", "admin", "finance")
        if not privileged:
            # Block any change to the `collected` flag (or invoice fields) on splits.
            existing_proj = await db.projects.find_one({"project_id": project_id}, {"payment_schedule": 1})
            existing_splits = ((existing_proj or {}).get("payment_schedule") or {}).get("splits") or []
            existing_by_id = {s.get("id"): s for s in existing_splits if isinstance(s, dict)}
            new_splits = ((update_data.get("payment_schedule") or {}).get("splits") or [])
            for ns in new_splits:
                if not isinstance(ns, dict):
                    continue
                prev = existing_by_id.get(ns.get("id")) or {}
                # Force non-privileged users to keep collected/invoice_* fields unchanged.
                if bool(ns.get("collected")) != bool(prev.get("collected", False)):
                    raise HTTPException(status_code=403, detail="Only Super Admin / Finance can mark a payment as collected")
                if ns.get("invoice_id") != prev.get("invoice_id") or ns.get("invoice_number") != prev.get("invoice_number"):
                    raise HTTPException(status_code=403, detail="Only Super Admin / Finance can attach an invoice")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.projects.update_one({"project_id": project_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return project


@projects_router.delete("/{project_id}")
async def delete_project(project_id: str, payload: DeleteProjectRequest, request: Request):
    from server import get_current_user, db, verify_password
    user = await get_current_user(request)
    if (user.role or "").lower() != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can delete projects")
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc or not verify_password(payload.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect password")
    # Soft-detach tasks from the deleted project rather than deleting them
    await db.our_tasks.update_many(
        {"project_id": project_id},
        {"$set": {"project_id": None, "project_name": None}}
    )
    result = await db.projects.delete_one({"project_id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted", "project_id": project_id}


@projects_router.post("/{project_id}/payment-schedule/{split_id}/collect")
async def collect_payment_split(project_id: str, split_id: str, request: Request):
    """Mark a payment split as collected AND create an invoice for it.
    Only Super Admin / Admin / Finance role can call this."""
    from server import get_current_user, db
    user = await get_current_user(request)
    role = (user.role or "").lower()
    if role not in ("super_admin", "admin", "finance"):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Finance can collect a payment")

    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    sched = project.get("payment_schedule") or {}
    splits = list(sched.get("splits") or [])
    idx = next((i for i, s in enumerate(splits) if (s or {}).get("id") == split_id), -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail="Split not found")
    sp = splits[idx]
    if sp.get("collected"):
        raise HTTPException(status_code=400, detail="This split is already collected")

    amount = float(sp.get("amount") or 0)
    today_iso = datetime.now(timezone.utc).date().isoformat()

    # Generate an invoice number via the finance helper (reuses the same numbering scheme).
    invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
    try:
        from finance_routes import generate_invoice_number
        invoice_number = await generate_invoice_number(datetime.now(timezone.utc).year)
    except Exception:
        invoice_number = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"

    invoice_doc = {
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "client_name": project.get("name") or "Client",
        "client_address": "",
        "client_gstin": "",
        "invoice_date": today_iso,
        "due_date": sp.get("expected_date") or today_iso,
        "items": [{
            "description": sp.get("label") or "Payment",
            "quantity": 1,
            "rate": amount,
            "amount": amount,
            "gst_rate": 0.0,
            "gst_amount": 0.0,
            "discount_percent": 0.0,
            "discount_amount": 0.0,
            "amount_before_tax": amount,
        }],
        "subtotal": amount,
        "discount_amount": 0.0,
        "gst_rate": 0.0,
        "gst_amount": 0.0,
        "cgst_amount": 0.0,
        "sgst_amount": 0.0,
        "igst_amount": 0.0,
        "total": amount,
        "gst_type": "no_gst",
        "notes": f"Auto-generated from project payment schedule ({sp.get('label')})",
        "payment_terms": sp.get("mode") or "",
        "status": "paid",
        "project_id": project_id,
        "split_id": split_id,
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invoices.insert_one(invoice_doc)

    # Also post into income / cashbook for visibility in the Income/Cashbook tab.
    try:
        await db.income.insert_one({
            "income_id": f"inc_{uuid.uuid4().hex[:12]}",
            "amount": amount,
            "source": project.get("name") or "Project",
            "category": "Project Payment",
            "date": today_iso,
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "project_id": project_id,
            "notes": f"Collected via Payment Schedule ({sp.get('label')})",
            "created_by": user.user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

    # Mark the split collected with invoice reference.
    splits[idx] = {
        **sp,
        "collected": True,
        "collected_date": today_iso,
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "collected_by": user.user_id,
    }
    sched["splits"] = splits
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"payment_schedule": sched, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {
        "ok": True,
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "split_id": split_id,
        "amount": amount,
    }


@projects_router.post("/{project_id}/payment-schedule/{split_id}/invoice-req")
async def request_invoice_for_split(project_id: str, split_id: str, request: Request):
    """Raise an Invoice Request for a payment split (replaces the old "Collect" flow).

    Creates an invoice in `pending` status (no income posted yet) tagged with
    `source='payment_schedule'`. The split row is marked `invoice_raised=True`
    so the UI can show a badge instead of the action button. Income is posted
    later via Cashbook → Add Income → pick this invoice.
    """
    from server import get_current_user, db
    user = await get_current_user(request)
    role = (user.role or "").lower()
    if role not in ("super_admin", "admin", "finance"):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Finance can raise an invoice request")

    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    sched = project.get("payment_schedule") or {}
    splits = list(sched.get("splits") or [])
    idx = next((i for i, s in enumerate(splits) if (s or {}).get("id") == split_id), -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail="Split not found")
    sp = splits[idx]
    if sp.get("invoice_raised") or sp.get("collected"):
        raise HTTPException(status_code=400, detail="Invoice already raised for this split")

    amount = float(sp.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Split has zero amount")
    today_iso = datetime.now(timezone.utc).date().isoformat()

    invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
    try:
        from finance_routes import generate_invoice_number
        invoice_number = await generate_invoice_number(datetime.now(timezone.utc).year)
    except Exception:
        invoice_number = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"

    invoice_doc = {
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "client_name": project.get("name") or "Client",
        "client_address": "",
        "client_gstin": "",
        "invoice_date": today_iso,
        "due_date": sp.get("expected_date") or today_iso,
        "subtotal": amount,
        "discount_amount": 0.0,
        "gst_rate": 0.0,
        "gst_amount": 0.0,
        "cgst_amount": 0.0,
        "sgst_amount": 0.0,
        "igst_amount": 0.0,
        "total_amount": amount,
        "paid_amount": 0.0,
        "gst_type": "no_gst",
        "notes": f"Auto-raised from payment schedule ({sp.get('label')})",
        "payment_terms": sp.get("mode") or "",
        "status": "pending",
        "source": "payment_schedule",
        "project_id": project_id,
        "split_id": split_id,
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "is_deleted": False,
    }
    await db.invoices.insert_one(invoice_doc)
    # Also seed an invoice_items row so the invoice list / PDF works correctly.
    await db.invoice_items.insert_one({
        "item_id": f"item_{uuid.uuid4().hex[:12]}",
        "invoice_id": invoice_id,
        "service_name": sp.get("label") or "Payment",
        "description": f"Project: {project.get('name')}",
        "quantity": 1,
        "rate": amount,
        "discount_percent": 0.0,
        "discount_amount": 0.0,
        "amount_before_tax": amount,
        "gst_rate": 0.0,
        "gst_amount": 0.0,
        "amount": amount,
    })

    # Flag the split as having a pending invoice.
    splits[idx] = {
        **sp,
        "invoice_raised": True,
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "invoice_requested_at": today_iso,
        "invoice_requested_by": user.user_id,
    }
    sched["splits"] = splits
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"payment_schedule": sched, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {
        "ok": True,
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "split_id": split_id,
        "amount": amount,
        "status": "pending",
    }


@projects_router.post("/{project_id}/payment-schedule/{split_id}/record-against-invoice")
async def record_split_against_invoice(project_id: str, split_id: str, payload: RecordSplitAgainstInvoiceRequest, request: Request):
    """"Select Invoice" flow — instead of raising a brand-new invoice for this
    split, apply the split's requested amount as a payment against an
    already-existing invoice for the same project (e.g. one recurring invoice
    covering several monthly payment-schedule rows). Voids this split's own
    pending placeholder invoice (if any) since it's now fulfilled via the
    selected invoice instead."""
    from server import get_current_user, db
    user = await get_current_user(request)
    role = (user.role or "").lower()
    if role not in ("super_admin", "admin", "finance"):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Finance can record a payment")

    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    sched = project.get("payment_schedule") or {}
    splits = list(sched.get("splits") or [])
    idx = next((i for i, s in enumerate(splits) if (s or {}).get("id") == split_id), -1)
    if idx < 0:
        raise HTTPException(status_code=404, detail="Split not found")
    sp = splits[idx]
    if sp.get("collected"):
        raise HTTPException(status_code=400, detail="This split is already collected")

    request_amount = float(sp.get("amount") or 0)
    if request_amount <= 0:
        raise HTTPException(status_code=400, detail="Split has zero amount")

    invoice = await db.invoices.find_one({"invoice_id": payload.invoice_id, "is_deleted": False})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    total_amount = float(invoice.get("total_amount") or 0)
    paid_amount = float(invoice.get("paid_amount") or 0)
    balance = total_amount - paid_amount
    if request_amount > balance:
        raise HTTPException(status_code=400, detail=f"Payment request amount (₹{request_amount:,.2f}) exceeds the invoice balance (₹{balance:,.2f})")

    today_iso = datetime.now(timezone.utc).date().isoformat()
    new_paid = paid_amount + request_amount
    new_status = "paid" if new_paid >= total_amount else "partially_paid"
    await db.invoices.update_one(
        {"invoice_id": payload.invoice_id},
        {"$set": {"paid_amount": new_paid, "status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    # Void this split's own pending placeholder invoice (from a prior "Raise
    # Invoice Request"), if any — it's now fulfilled via the selected invoice.
    old_invoice_id = sp.get("invoice_id")
    if old_invoice_id and old_invoice_id != payload.invoice_id:
        await db.invoices.update_one(
            {"invoice_id": old_invoice_id, "status": "pending"},
            {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )

    splits[idx] = {
        **sp,
        "collected": True,
        "collected_date": today_iso,
        "collected_by": user.user_id,
        "invoice_id": payload.invoice_id,
        "invoice_number": invoice.get("invoice_number"),
    }
    sched["splits"] = splits
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"payment_schedule": sched, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {
        "ok": True,
        "split_id": split_id,
        "invoice_id": payload.invoice_id,
        "invoice_number": invoice.get("invoice_number"),
        "amount": request_amount,
        "invoice_new_paid_amount": new_paid,
        "invoice_new_status": new_status,
    }


@projects_router.post("/{project_id}/tasks")
async def add_task_to_project(project_id: str, payload: ProjectTaskCreate, request: Request):
    """Create a task and link it to a project. Task auto-appears in
    assignee's Operations > My Tasks list with the project name badge."""
    from server import get_current_user, db
    user = await get_current_user(request)

    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not payload.task_name.strip():
        raise HTTPException(status_code=400, detail="Task name is required")
    if not payload.assigned_to:
        raise HTTPException(status_code=400, detail="assigned_to is required")

    now = datetime.now(timezone.utc).isoformat()
    task = {
        "task_id": f"ot_{uuid.uuid4().hex[:12]}",
        "task_name": payload.task_name.strip(),
        "description": (payload.description or "").strip(),
        "status": "pending",
        "priority": payload.priority or "medium",
        "type": "general",
        "tags": [],
        "assigned_to": payload.assigned_to,
        "created_by": user.user_id,
        "created_by_name": user.name,
        "due_date": payload.due_date,
        "work_link": payload.work_link,
        "department": payload.department,
        "category": payload.category,
        "project_id": project_id,
        "project_name": project.get("name"),
        # ERP tagging passthrough (None for non-ERP projects)
        "erp_user_id": payload.erp_user_id,
        "erp_user_name": payload.erp_user_name,
        "erp_page_id": payload.erp_page_id,
        "erp_page_name": payload.erp_page_name,
        "erp_task_type": payload.erp_task_type,
        "time_tracking": {"total_seconds": 0, "status": "not_started", "sessions": []},
        "created_at": now,
        "updated_at": now,
    }
    await db.our_tasks.insert_one(task)
    task.pop("_id", None)

    # Also add the assignee to the project members if not already
    if payload.assigned_to and payload.assigned_to not in (project.get("members") or []):
        await db.projects.update_one(
            {"project_id": project_id},
            {"$addToSet": {"members": payload.assigned_to}, "$set": {"updated_at": now}}
        )

    return task


# ============== DAILY NOTES ==============
# One short "what happened on this project today" entry per person per day,
# available on EVERY project regardless of department (Website / Social Media /
# Meta Ads / SEO / ERP). Kept in its own collection rather than an array on the
# project doc: this log grows by a row per member per working day forever, and
# the project doc is fetched whole on every list call.
#
# Deliberately NOT exposed through the generic PATCH /projects/{id} either —
# concurrent whole-array writes from two people filing their update at the same
# time would silently drop one of them. Every write below is a single-document
# operation on one note.


@projects_router.get("/daily-notes/history")
async def daily_notes_history(
    request: Request,
    department: Optional[str] = None,
    project_id: Optional[str] = None,
    created_by: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    """Every project's daily notes in one date-wise feed — what the "Notes
    History" button next to the department tabs opens.

    Scoped to one `department` (erp, website, seo, …) so the feed matches the
    department tab the user is standing on. Same visibility rule as the project
    list: admins/ops see every project, everyone else only theirs.

    NOTE: declared ahead of `/{project_id}/daily-notes` on purpose — routes are
    matched in declaration order, and a literal path must never sit behind a
    parameterised one that could swallow it.
    """
    from server import get_current_user, db
    user = await get_current_user(request)

    project_query: dict = {} if await _is_operation_head_or_admin(user, db) else {
        "$or": [
            {"members": user.user_id},
            {"created_by": user.user_id},
        ]
    }
    if department:
        project_query["departments"] = department
    if project_id:
        project_query["project_id"] = project_id

    projects = await db.projects.find(project_query, {"_id": 0, "project_id": 1, "name": 1}).to_list(500)
    if not projects:
        return {"notes": [], "projects": []}
    name_by_id = {p["project_id"]: p.get("name") for p in projects}

    note_query: dict = {"project_id": {"$in": list(name_by_id.keys())}}
    date_range: dict = {}
    if from_date:
        date_range["$gte"] = _validate_note_date(from_date)
    if to_date:
        date_range["$lte"] = _validate_note_date(to_date)
    if date_range:
        note_query["note_date"] = date_range
    if created_by:
        note_query["created_by"] = created_by

    notes = await db.project_daily_notes.find(note_query, {"_id": 0}).sort(
        [("note_date", -1), ("created_at", -1)]
    ).to_list(5000)
    # Re-resolve the project name rather than trusting the copy stamped on the
    # note at write time — projects get renamed.
    for n in notes:
        n["project_name"] = name_by_id.get(n.get("project_id")) or n.get("project_name")

    return {
        "notes": notes,
        "projects": sorted(
            [{"project_id": pid, "name": name} for pid, name in name_by_id.items()],
            key=lambda p: (p["name"] or "").lower(),
        ),
    }


@projects_router.get("/{project_id}/daily-notes")
async def list_daily_notes(
    project_id: str,
    request: Request,
    note_date: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    created_by: Optional[str] = None,
):
    """All days' notes for a project, newest day first. Optional filters:
    a single `note_date`, a `from_date`/`to_date` range, or one author."""
    from server import get_current_user, db
    user = await get_current_user(request)

    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0, "members": 1, "created_by": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not await _can_view_project(user, db, project):
        raise HTTPException(status_code=403, detail="You don't have access to this project")

    query: dict = {"project_id": project_id}
    if note_date:
        query["note_date"] = _validate_note_date(note_date)
    else:
        date_range: dict = {}
        if from_date:
            date_range["$gte"] = _validate_note_date(from_date)
        if to_date:
            date_range["$lte"] = _validate_note_date(to_date)
        if date_range:
            query["note_date"] = date_range
    if created_by:
        query["created_by"] = created_by

    return await db.project_daily_notes.find(query, {"_id": 0}).sort(
        [("note_date", -1), ("created_at", -1)]
    ).to_list(2000)


@projects_router.post("/{project_id}/daily-notes")
async def add_daily_note(project_id: str, payload: DailyNoteCreate, request: Request):
    """File a daily update. Any member of the project can log their own —
    that's the point of the tab; it isn't an admin-only edit."""
    from server import get_current_user, db
    user = await get_current_user(request)

    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0, "name": 1, "members": 1, "created_by": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not await _can_view_project(user, db, project):
        raise HTTPException(status_code=403, detail="You don't have access to this project")

    text = (payload.note or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Note is required")

    now = datetime.now(timezone.utc).isoformat()
    note = {
        "note_id": f"dn_{uuid.uuid4().hex[:12]}",
        "project_id": project_id,
        "project_name": project.get("name"),
        "note_date": _validate_note_date(payload.note_date) if payload.note_date else _today_ist(),
        "note": text,
        "department": (payload.department or "").strip() or None,
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_at": now,
        "updated_at": now,
    }
    await db.project_daily_notes.insert_one(note)
    note.pop("_id", None)
    return note


@projects_router.patch("/{project_id}/daily-notes/{note_id}")
async def update_daily_note(project_id: str, note_id: str, payload: DailyNoteUpdate, request: Request):
    """Edit a note. Authors can correct their own; admins/ops can fix anyone's."""
    from server import get_current_user, db
    user = await get_current_user(request)

    note = await db.project_daily_notes.find_one({"note_id": note_id, "project_id": project_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Daily note not found")
    if note.get("created_by") != user.user_id and not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="You can only edit your own daily note")

    update_data: dict = {}
    if payload.note is not None:
        text = payload.note.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Note cannot be empty")
        update_data["note"] = text
    if payload.note_date is not None:
        update_data["note_date"] = _validate_note_date(payload.note_date)
    if payload.department is not None:
        update_data["department"] = payload.department.strip() or None
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.project_daily_notes.update_one({"note_id": note_id}, {"$set": update_data})
    return await db.project_daily_notes.find_one({"note_id": note_id}, {"_id": 0})


@projects_router.delete("/{project_id}/daily-notes/{note_id}")
async def delete_daily_note(project_id: str, note_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)

    note = await db.project_daily_notes.find_one({"note_id": note_id, "project_id": project_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Daily note not found")
    if note.get("created_by") != user.user_id and not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="You can only delete your own daily note")

    await db.project_daily_notes.delete_one({"note_id": note_id})
    return {"message": "Daily note deleted", "note_id": note_id}


@projects_router.post("/{project_id}/content-calendar/{entry_id}/publish-linkedin")
async def publish_content_calendar_entry_to_linkedin(project_id: str, entry_id: str, request: Request):
    """Manual "Publish Now" for a Content Calendar row — first slice of the
    LinkedIn auto-scheduling plan (no background scheduler yet). Posts as
    the CURRENT user's own connected LinkedIn account; the entry's
    post_title + description become the post text, content_link (if any)
    becomes the shared link."""
    from server import get_current_user
    from linkedin_routes import publish_linkedin_post

    user = await get_current_user(request)

    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0, "content_calendar": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    entry = next((e for e in (project.get("content_calendar") or []) if e.get("id") == entry_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Content Calendar entry not found")
    if entry.get("platform") != "linkedin":
        raise HTTPException(status_code=400, detail="Only LinkedIn posts can be published this way")

    text = "\n\n".join(filter(None, [entry.get("post_title"), entry.get("description")]))
    if not text.strip():
        raise HTTPException(status_code=400, detail="Post has no title or description to publish")

    try:
        post_urn = await publish_linkedin_post(user.user_id, text, entry.get("content_link") or None)
        await db.projects.update_one(
            {"project_id": project_id},
            {"$set": {
                "content_calendar.$[elem].publish_status": "published",
                "content_calendar.$[elem].linkedin_post_urn": post_urn,
                "content_calendar.$[elem].publish_error": None,
            }},
            array_filters=[{"elem.id": entry_id}],
        )
    except HTTPException as e:
        await db.projects.update_one(
            {"project_id": project_id},
            {"$set": {
                "content_calendar.$[elem].publish_status": "failed",
                "content_calendar.$[elem].publish_error": e.detail,
            }},
            array_filters=[{"elem.id": entry_id}],
        )
        raise

    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return updated


# ============== CLIENT PORTAL (ERP / Website) ==============
# Lets a staff member create a client-facing username/password for a
# specific project, then share a login link. The client logs in through a
# completely separate, unauthenticated flow (see client_portal_routes.py)
# to a strictly read-only view of that one project — no staff session
# involved on either side.

class ClientPortalSetRequest(BaseModel):
    username: str
    password: Optional[str] = None  # manual override; auto-generated if omitted


class ClientPortalPasswordRequest(BaseModel):
    password: Optional[str] = None  # manual override; auto-generated if omitted


def _generate_client_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _resolve_client_password(manual: Optional[str]) -> str:
    manual = (manual or "").strip()
    if manual:
        if len(manual) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        return manual
    return _generate_client_password()


@projects_router.get("/{project_id}/client-portal")
async def get_client_portal(project_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can manage the client portal")
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0, "client_portal": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    portal = project.get("client_portal") or {}
    return {
        "enabled": bool(portal.get("username")),
        "username": portal.get("username"),
        "created_at": portal.get("created_at"),
        "updated_at": portal.get("updated_at"),
    }


@projects_router.post("/{project_id}/client-portal")
async def create_or_update_client_portal(project_id: str, payload: ClientPortalSetRequest, request: Request):
    """Create the client login (or rename the username). Password is either
    typed manually (payload.password) or auto-generated — either way it's
    returned ONCE in this response, since only a hash is ever stored."""
    from server import get_current_user, hash_password, db
    user = await get_current_user(request)
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can manage the client portal")
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0, "name": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    password = _resolve_client_password(payload.password)
    now = datetime.now(timezone.utc).isoformat()
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "client_portal": {
                "username": username,
                "password_hash": hash_password(password),
                "enabled": True,
                "created_at": now,
                "updated_at": now,
            },
        }},
    )
    return {"username": username, "password": password}


@projects_router.post("/{project_id}/client-portal/reset-password")
async def reset_client_portal_password(project_id: str, payload: ClientPortalPasswordRequest, request: Request):
    from server import get_current_user, hash_password, db
    user = await get_current_user(request)
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can manage the client portal")
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0, "client_portal": 1})
    if not project or not (project.get("client_portal") or {}).get("username"):
        raise HTTPException(status_code=400, detail="Client portal is not set up for this project yet")

    password = _resolve_client_password(payload.password)
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "client_portal.password_hash": hash_password(password),
            "client_portal.updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"username": project["client_portal"]["username"], "password": password}


# ============== PROJECT HANDOVER (OTP-gated) ==============
# Head of Operations picks a handover date, which emails a one-time OTP to
# every Super Admin — not a hardcoded address, whoever actually holds that
# role today. Only entering that OTP back in the app (a second, separate
# step) flips the project to the "Hand Over" status. The OTP is hashed and
# time-limited server-side, so this can't be short-circuited by calling the
# generic project-update endpoint instead.

class HandoverRequestOtp(BaseModel):
    handover_date: str


class HandoverVerifyOtp(BaseModel):
    otp: str
    remarks: Optional[str] = ""


def _fmt_handover_date(value) -> str:
    if not value:
        return "—"
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime("%d %b %Y")
    except Exception:
        return str(value)[:10]


# The canonical Super Admin mailbox — always notified regardless of what the
# `role` field on any given user doc says, since a handover approval email
# silently missing this inbox (e.g. a second "super_admin"-role account, or a
# role typo) is exactly the failure this feature exists to prevent.
CANONICAL_SUPER_ADMIN_EMAIL = "vinoth@drawlead.com"


@projects_router.post("/{project_id}/handover/request-otp")
async def request_handover_otp(project_id: str, payload: HandoverRequestOtp, request: Request):
    from server import get_current_user, hash_password, db
    from hr_routes import send_email_notification
    user = await get_current_user(request)
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can request a handover")
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not payload.handover_date:
        raise HTTPException(status_code=400, detail="Handover date is required")

    otp = f"{secrets.randbelow(1000000):06d}"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=15)

    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "handover": {
                "status": "otp_requested",
                "requested_date": payload.handover_date,
                "otp_hash": hash_password(otp),
                "otp_expires_at": expires_at.isoformat(),
                "requested_by": user.user_id,
                "requested_by_name": user.name,
                "requested_at": now.isoformat(),
            },
        }},
    )

    tasks = await db.our_tasks.find({"project_id": project_id}, {"_id": 0, "time_tracking": 1}).to_list(2000)
    total_seconds = sum(int((t.get("time_tracking") or {}).get("total_seconds") or 0) for t in tasks)
    hours_label = f"{total_seconds // 3600}h {(total_seconds % 3600) // 60}m"
    departments_label = ", ".join(project.get("departments") or []) or "—"

    email_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Project Handover Approval Needed</h2>
        <p><b>{user.name}</b> is requesting to hand over the project below on <b>{payload.handover_date}</b>.</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding:6px 0; color:#71717a;">Project Name</td><td style="padding:6px 0;"><b>{project.get('name', '—')}</b></td></tr>
            <tr><td style="padding:6px 0; color:#71717a;">Client Name</td><td style="padding:6px 0;">{project.get('client_name') or '—'}</td></tr>
            <tr><td style="padding:6px 0; color:#71717a;">Departments</td><td style="padding:6px 0;">{departments_label}</td></tr>
            <tr><td style="padding:6px 0; color:#71717a;">Status</td><td style="padding:6px 0;">{project.get('status') or 'active'}</td></tr>
            <tr><td style="padding:6px 0; color:#71717a;">Start Date</td><td style="padding:6px 0;">{_fmt_handover_date(project.get('start_date'))}</td></tr>
            <tr><td style="padding:6px 0; color:#71717a;">Due / Deadline</td><td style="padding:6px 0;">{_fmt_handover_date(project.get('due_date'))}</td></tr>
            <tr><td style="padding:6px 0; color:#71717a;">Hours Spent</td><td style="padding:6px 0;">{hours_label}</td></tr>
            <tr><td style="padding:6px 0; color:#71717a;">Requested By</td><td style="padding:6px 0;">{user.name}</td></tr>
        </table>
        <p style="margin: 20px 0;">Share this OTP with the requesting operator to approve the handover:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #6366f1;">{otp}</p>
        <p style="color:#71717a; font-size: 12px;">This OTP expires in 15 minutes. If you did not expect this request, do not share it.</p>
    </div>
    """

    super_admins = await db.users.find({"role": "super_admin"}, {"_id": 0, "email": 1}).to_list(50)
    recipient_emails = {(a.get("email") or "").strip() for a in super_admins if a.get("email")}
    recipient_emails.add(CANONICAL_SUPER_ADMIN_EMAIL)

    notify_results = []
    for email in recipient_emails:
        result = await send_email_notification(
            email,
            f"Project Handover Email: {project.get('name')}",
            email_html,
        )
        notify_results.append({
            "email": email,
            "status": (result or {}).get("status"),
            "message": (result or {}).get("message"),
        })
        if (result or {}).get("status") != "success":
            import logging
            logging.getLogger(__name__).warning(f"[handover] OTP email to {email} did not confirm success: {result}")

    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    updated["handover_notify_results"] = notify_results
    return updated


@projects_router.post("/{project_id}/handover/verify-otp")
async def verify_handover_otp(project_id: str, payload: HandoverVerifyOtp, request: Request):
    from server import get_current_user, verify_password, db
    user = await get_current_user(request)
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can confirm a handover")
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0, "handover": 1})
    handover = (project or {}).get("handover") or {}
    if handover.get("status") != "otp_requested":
        raise HTTPException(status_code=400, detail="No pending handover OTP request")
    expires_at = handover.get("otp_expires_at")
    if not expires_at or datetime.now(timezone.utc) > datetime.fromisoformat(expires_at):
        raise HTTPException(status_code=400, detail="OTP has expired — request a new one")
    if not verify_password(payload.otp.strip(), handover.get("otp_hash") or ""):
        raise HTTPException(status_code=401, detail="Incorrect OTP")

    now = datetime.now(timezone.utc).isoformat()
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "status": "Hand Over",
            "handover": {
                "status": "completed",
                "handover_date": handover.get("requested_date"),
                "remarks": (payload.remarks or "").strip(),
                "requested_by": handover.get("requested_by"),
                "requested_by_name": handover.get("requested_by_name"),
                "completed_by": user.user_id,
                "completed_by_name": user.name,
                "completed_at": now,
            },
        }},
    )
    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return updated
