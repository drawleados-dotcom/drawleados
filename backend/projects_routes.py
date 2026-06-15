"""
Projects routes — operational project management.

A "Project" is a container of tasks. When a task is added to a project, the
project name & id are stamped on the task so it auto-appears in the assigned
user's Operations > My Tasks list with a project badge.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid


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


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_id: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    members: Optional[List[str]] = None
    departments: Optional[List[str]] = None
    status: Optional[str] = None
    documents: Optional[List[dict]] = None
    payment_schedule: Optional[dict] = None
    project_expense: Optional[dict] = None


class ProjectTaskCreate(BaseModel):
    task_name: str
    description: Optional[str] = ""
    assigned_to: str  # user_id
    due_date: Optional[str] = None
    priority: Optional[str] = "medium"
    work_link: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None


async def _is_operation_head_or_admin(user, db) -> bool:
    """User can create/edit projects if they are super_admin, admin, or have
    designation == 'Operation Head'.
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
    desg = (user_doc.get("designation") or "").strip().lower()
    return desg == "operation head"


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
            }},
        ]
        async for row in db.our_tasks.aggregate(pipeline):
            counts_map[row["_id"]] = {"total": row.get("total", 0), "completed": row.get("completed", 0)}
    for p in projects:
        pid = p.get("project_id")
        c = counts_map.get(pid, {})
        p["task_count"] = c.get("total", 0)
        p["completed_task_count"] = c.get("completed", 0)
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


@projects_router.get("/{project_id}")
async def get_project(project_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = await db.our_tasks.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    project["tasks"] = tasks
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
async def delete_project(project_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if not await _is_operation_head_or_admin(user, db):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin / Operation Head can delete projects")
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
