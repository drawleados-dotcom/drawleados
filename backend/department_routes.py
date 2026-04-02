"""
Department & Project Management Routes
- Departments (SEO, Meta, Social Media, Design, ERP)
- Projects under each department
- Tasks within projects (uses BDE-style task board)
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid

department_router = APIRouter(prefix="/departments", tags=["departments"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "drawlead_db")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


# Pydantic Models
class DepartmentCreate(BaseModel):
    name: str
    icon: str = "📁"
    color: str = "#6366f1"
    description: Optional[str] = ""

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ProjectCreate(BaseModel):
    name: str
    client_name: Optional[str] = ""
    description: Optional[str] = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str = "active"  # active, completed, on_hold
    team_members: List[str] = []

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    team_members: Optional[List[str]] = None

class ProjectDocumentCreate(BaseModel):
    name: str
    link: str
    doc_type: str = "sheet"  # sheet, doc, other

class ProjectTaskCreate(BaseModel):
    task_name: str
    description: Optional[str] = ""
    priority: str = "medium"  # high, medium, low
    type: str = "general"  # general, meeting, follow_up, review
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    status: str = "pending"  # pending, in_progress, completed, on_hold
    work_link: Optional[str] = ""

class ProjectTaskUpdate(BaseModel):
    task_name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    type: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    status: Optional[str] = None
    work_link: Optional[str] = None


# ========== DEPARTMENTS ==========

@department_router.get("")
async def get_departments(request: Request):
    """Get all active departments"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    departments = await db.departments.find({"is_active": True}).sort("order", 1).to_list(100)
    
    # If no departments exist, create default ones
    if not departments:
        default_depts = [
            {"name": "SEO", "icon": "🔍", "color": "#10b981", "order": 1},
            {"name": "Meta", "icon": "📊", "color": "#3b82f6", "order": 2},
            {"name": "Social Media", "icon": "📱", "color": "#ec4899", "order": 3},
            {"name": "Design", "icon": "🎨", "color": "#f59e0b", "order": 4},
            {"name": "ERP", "icon": "🏢", "color": "#8b5cf6", "order": 5},
        ]
        
        for dept in default_depts:
            dept_id = f"dept_{uuid.uuid4().hex[:12]}"
            await db.departments.insert_one({
                "department_id": dept_id,
                **dept,
                "description": "",
                "is_active": True,
                "created_by": current_user.user_id,
                "created_at": datetime.now(timezone.utc)
            })
        
        departments = await db.departments.find({"is_active": True}).sort("order", 1).to_list(100)
    
    # Get project count for each department
    for dept in departments:
        dept.pop("_id", None)
        project_count = await db.department_projects.count_documents({
            "department_id": dept["department_id"],
            "is_active": True
        })
        dept["project_count"] = project_count
    
    return departments


@department_router.post("")
async def create_department(data: DepartmentCreate, request: Request):
    """Create a new department (Admin only)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can create departments")
    
    # Get max order
    max_dept = await db.departments.find_one({}, sort=[("order", -1)])
    order = (max_dept.get("order", 0) + 1) if max_dept else 1
    
    dept_id = f"dept_{uuid.uuid4().hex[:12]}"
    dept_doc = {
        "department_id": dept_id,
        "name": data.name,
        "icon": data.icon,
        "color": data.color,
        "description": data.description,
        "order": order,
        "is_active": True,
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.departments.insert_one(dept_doc)
    dept_doc.pop("_id", None)
    dept_doc["project_count"] = 0
    
    return dept_doc


@department_router.put("/{department_id}")
async def update_department(department_id: str, data: DepartmentUpdate, request: Request):
    """Update a department (Admin only)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can update departments")
    
    update_dict = data.model_dump(exclude_unset=True)
    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc)
        await db.departments.update_one(
            {"department_id": department_id},
            {"$set": update_dict}
        )
    
    dept = await db.departments.find_one({"department_id": department_id})
    if dept:
        dept.pop("_id", None)
    return dept


@department_router.delete("/{department_id}")
async def delete_department(department_id: str, request: Request):
    """Soft delete a department (Admin only)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can delete departments")
    
    await db.departments.update_one(
        {"department_id": department_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Department deleted"}


# ========== PROJECTS ==========

@department_router.get("/{department_id}/projects")
async def get_department_projects(department_id: str, status: Optional[str] = None, request: Request = None):
    """Get all projects in a department"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    query = {"department_id": department_id, "is_active": True}
    if status:
        query["status"] = status
    
    projects = await db.department_projects.find(query).sort("created_at", -1).to_list(100)
    
    for p in projects:
        p.pop("_id", None)
        # Get task counts
        total_tasks = await db.project_tasks.count_documents({"project_id": p["project_id"]})
        completed_tasks = await db.project_tasks.count_documents({"project_id": p["project_id"], "status": "completed"})
        p["total_tasks"] = total_tasks
        p["completed_tasks"] = completed_tasks
        # Get document count
        doc_count = await db.project_documents.count_documents({"project_id": p["project_id"]})
        p["document_count"] = doc_count
    
    return projects


@department_router.post("/{department_id}/projects")
async def create_project(department_id: str, data: ProjectCreate, request: Request):
    """Create a new project in a department"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    # Verify department exists
    dept = await db.departments.find_one({"department_id": department_id, "is_active": True})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    project_id = f"proj_{uuid.uuid4().hex[:12]}"
    project_doc = {
        "project_id": project_id,
        "department_id": department_id,
        "name": data.name,
        "client_name": data.client_name,
        "description": data.description,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "status": data.status,
        "team_members": data.team_members,
        "is_active": True,
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.department_projects.insert_one(project_doc)
    project_doc.pop("_id", None)
    project_doc["total_tasks"] = 0
    project_doc["completed_tasks"] = 0
    project_doc["document_count"] = 0
    
    return project_doc


@department_router.get("/projects/{project_id}")
async def get_project(project_id: str, request: Request):
    """Get a single project with details"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    project = await db.department_projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.pop("_id", None)
    
    # Get department info
    dept = await db.departments.find_one({"department_id": project["department_id"]}, {"_id": 0, "name": 1, "icon": 1, "color": 1})
    project["department"] = dept
    
    # Get tasks
    tasks = await db.project_tasks.find({"project_id": project_id}).sort("created_at", -1).to_list(500)
    for t in tasks:
        t.pop("_id", None)
    project["tasks"] = tasks
    
    # Get documents
    documents = await db.project_documents.find({"project_id": project_id}).sort("created_at", -1).to_list(100)
    for d in documents:
        d.pop("_id", None)
    project["documents"] = documents
    
    # Get team member details
    if project.get("team_members"):
        members = await db.users.find(
            {"user_id": {"$in": project["team_members"]}},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1, "designation": 1}
        ).to_list(50)
        project["team_member_details"] = members
    
    return project


@department_router.put("/projects/{project_id}")
async def update_project(project_id: str, data: ProjectUpdate, request: Request):
    """Update a project"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    update_dict = data.model_dump(exclude_unset=True)
    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc)
        await db.department_projects.update_one(
            {"project_id": project_id},
            {"$set": update_dict}
        )
    
    project = await db.department_projects.find_one({"project_id": project_id})
    if project:
        project.pop("_id", None)
    return project


@department_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, request: Request):
    """Soft delete a project"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    await db.department_projects.update_one(
        {"project_id": project_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Project deleted"}


# ========== PROJECT DOCUMENTS ==========

@department_router.get("/projects/{project_id}/documents")
async def get_project_documents(project_id: str, request: Request):
    """Get all documents in a project"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    documents = await db.project_documents.find({"project_id": project_id}).sort("created_at", -1).to_list(100)
    for d in documents:
        d.pop("_id", None)
    
    return documents


@department_router.post("/projects/{project_id}/documents")
async def add_project_document(project_id: str, data: ProjectDocumentCreate, request: Request):
    """Add a document to a project"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    doc = {
        "doc_id": doc_id,
        "project_id": project_id,
        "name": data.name,
        "link": data.link,
        "doc_type": data.doc_type,
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.project_documents.insert_one(doc)
    doc.pop("_id", None)
    
    return doc


@department_router.delete("/projects/{project_id}/documents/{doc_id}")
async def remove_project_document(project_id: str, doc_id: str, request: Request):
    """Remove a document from a project"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    await db.project_documents.delete_one({"doc_id": doc_id, "project_id": project_id})
    
    return {"message": "Document removed"}


# ========== PROJECT TASKS ==========

@department_router.get("/projects/{project_id}/tasks")
async def get_project_tasks(project_id: str, status: Optional[str] = None, request: Request = None):
    """Get all tasks in a project"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    query = {"project_id": project_id}
    if status:
        query["status"] = status
    
    tasks = await db.project_tasks.find(query).sort("created_at", -1).to_list(500)
    
    # Get user details for assigned_to
    user_ids = list(set([t.get("assigned_to") for t in tasks if t.get("assigned_to")]))
    users_map = {}
    if user_ids:
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(100)
        users_map = {u["user_id"]: u["name"] for u in users}
    
    for t in tasks:
        t.pop("_id", None)
        if t.get("assigned_to") and t["assigned_to"] in users_map:
            t["assigned_to_name"] = users_map[t["assigned_to"]]
    
    return tasks


@department_router.post("/projects/{project_id}/tasks")
async def create_project_task(project_id: str, data: ProjectTaskCreate, request: Request):
    """Create a task in a project"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    # Verify project exists
    project = await db.department_projects.find_one({"project_id": project_id, "is_active": True})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    task_doc = {
        "task_id": task_id,
        "project_id": project_id,
        "department_id": project["department_id"],
        "task_name": data.task_name,
        "description": data.description,
        "priority": data.priority,
        "type": data.type,
        "assigned_to": data.assigned_to,
        "assigned_by": current_user.user_id,
        "due_date": data.due_date,
        "due_time": data.due_time,
        "status": data.status,
        "work_link": data.work_link,
        "time_spent": 0,
        "time_logs": [],
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.project_tasks.insert_one(task_doc)
    task_doc.pop("_id", None)
    
    # Get assigned user name
    if data.assigned_to:
        user = await db.users.find_one({"user_id": data.assigned_to}, {"_id": 0, "name": 1})
        if user:
            task_doc["assigned_to_name"] = user["name"]
    
    return task_doc


@department_router.put("/projects/{project_id}/tasks/{task_id}")
async def update_project_task(project_id: str, task_id: str, data: ProjectTaskUpdate, request: Request):
    """Update a task"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    update_dict = data.model_dump(exclude_unset=True)
    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc)
        await db.project_tasks.update_one(
            {"task_id": task_id, "project_id": project_id},
            {"$set": update_dict}
        )
    
    task = await db.project_tasks.find_one({"task_id": task_id})
    if task:
        task.pop("_id", None)
        # Get assigned user name
        if task.get("assigned_to"):
            user = await db.users.find_one({"user_id": task["assigned_to"]}, {"_id": 0, "name": 1})
            if user:
                task["assigned_to_name"] = user["name"]
    
    return task


@department_router.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_project_task(project_id: str, task_id: str, request: Request):
    """Delete a task"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    await db.project_tasks.delete_one({"task_id": task_id, "project_id": project_id})
    
    return {"message": "Task deleted"}


# ========== TASK TIME TRACKING ==========

@department_router.post("/tasks/{task_id}/timer/start")
async def start_task_timer(task_id: str, request: Request):
    """Start timer for a task"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    task = await db.project_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if there's already a running timer
    running = await db.task_timers.find_one({
        "task_id": task_id,
        "user_id": current_user.user_id,
        "end_time": None
    })
    
    if running:
        raise HTTPException(status_code=400, detail="Timer already running")
    
    timer_id = f"timer_{uuid.uuid4().hex[:12]}"
    timer_doc = {
        "timer_id": timer_id,
        "task_id": task_id,
        "user_id": current_user.user_id,
        "start_time": datetime.now(timezone.utc),
        "end_time": None
    }
    
    await db.task_timers.insert_one(timer_doc)
    
    # Update task status to in_progress if pending
    if task.get("status") == "pending":
        await db.project_tasks.update_one(
            {"task_id": task_id},
            {"$set": {"status": "in_progress"}}
        )
    
    return {"timer_id": timer_id, "start_time": timer_doc["start_time"]}


@department_router.post("/tasks/{task_id}/timer/stop")
async def stop_task_timer(task_id: str, request: Request):
    """Stop timer for a task"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    # Find running timer
    timer = await db.task_timers.find_one({
        "task_id": task_id,
        "user_id": current_user.user_id,
        "end_time": None
    })
    
    if not timer:
        raise HTTPException(status_code=400, detail="No running timer found")
    
    end_time = datetime.now(timezone.utc)
    # Handle timezone-aware vs naive datetime comparison
    start_time = timer["start_time"]
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    duration_seconds = (end_time - start_time).total_seconds()
    
    await db.task_timers.update_one(
        {"timer_id": timer["timer_id"]},
        {"$set": {"end_time": end_time, "duration": duration_seconds}}
    )
    
    # Update task total time
    await db.project_tasks.update_one(
        {"task_id": task_id},
        {
            "$inc": {"time_spent": duration_seconds},
            "$push": {"time_logs": {
                "timer_id": timer["timer_id"],
                "user_id": current_user.user_id,
                "start": timer["start_time"],
                "end": end_time,
                "duration": duration_seconds
            }}
        }
    )
    
    return {"duration": duration_seconds, "end_time": end_time}


@department_router.get("/tasks/{task_id}/timer")
async def get_task_timer_status(task_id: str, request: Request):
    """Get current timer status for a task"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    timer = await db.task_timers.find_one({
        "task_id": task_id,
        "user_id": current_user.user_id,
        "end_time": None
    })
    
    if timer:
        timer.pop("_id", None)
        return {"running": True, "timer": timer}
    
    return {"running": False, "timer": None}
