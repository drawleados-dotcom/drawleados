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
    description: Optional[str] = ""
    due_date: Optional[str] = None  # ISO date string
    members: Optional[List[str]] = []   # user_ids
    departments: Optional[List[str]] = []  # department keys: website, social_media, meta, seo, finance, hr, business_dev, erp
    status: Optional[str] = "active"     # active | completed | on_hold


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    members: Optional[List[str]] = None
    departments: Optional[List[str]] = None
    status: Optional[str] = None


class ProjectTaskCreate(BaseModel):
    task_name: str
    description: Optional[str] = ""
    assigned_to: str  # user_id
    due_date: Optional[str] = None
    priority: Optional[str] = "medium"
    work_link: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None


@projects_router.get("")
async def list_projects(request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)

    role = (user.role or "").lower()
    is_privileged = role in {"super_admin", "admin"}

    # Non-privileged users only see projects they are a member of or created
    query: dict = {} if is_privileged else {
        "$or": [
            {"members": user.user_id},
            {"created_by": user.user_id},
        ]
    }
    projects = await db.projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Attach task counts for each project
    for p in projects:
        pid = p.get("project_id")
        if not pid:
            continue
        total = await db.our_tasks.count_documents({"project_id": pid})
        completed = await db.our_tasks.count_documents({"project_id": pid, "status": "completed"})
        p["task_count"] = total
        p["completed_task_count"] = completed
    return projects


@projects_router.post("")
async def create_project(payload: ProjectCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)

    members = list(payload.members or [])
    # Ensure creator is always a member (so they can see their own project)
    if user.user_id not in members:
        members.append(user.user_id)

    project = {
        "project_id": f"prj_{uuid.uuid4().hex[:12]}",
        "name": payload.name.strip(),
        "description": (payload.description or "").strip(),
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
    await get_current_user(request)
    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.projects.update_one({"project_id": project_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return project


@projects_router.delete("/{project_id}")
async def delete_project(project_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    # Soft-detach tasks from the deleted project rather than deleting them
    await db.our_tasks.update_many(
        {"project_id": project_id},
        {"$set": {"project_id": None, "project_name": None}}
    )
    result = await db.projects.delete_one({"project_id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted", "project_id": project_id}


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
