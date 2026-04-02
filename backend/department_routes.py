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

class CustomRecurrence(BaseModel):
    repeat_every: int = 1
    repeat_unit: str = "week"  # day, week, month, year
    repeat_on_days: List[int] = []  # 0-6 for Sun-Sat
    ends: str = "never"  # never, on_date, after_occurrences
    end_date: Optional[str] = None
    occurrences: int = 13

class ProjectTaskCreate(BaseModel):
    task_name: str
    description: Optional[str] = ""
    priority: str = "medium"  # high, medium, low
    type: str = "general"  # general, meeting, follow_up, proposal, call
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    all_day: bool = False
    recurrence: str = "none"  # none, daily, weekly, monthly, yearly, weekdays, custom
    custom_recurrence: Optional[Dict[str, Any]] = None
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
    all_day: Optional[bool] = None
    recurrence: Optional[str] = None
    custom_recurrence: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    work_link: Optional[str] = None

class TimeTrackingAction(BaseModel):
    action: str  # start, pause, resume, finish


# ========== DEPARTMENTS ==========

@department_router.get("")
async def get_departments(request: Request):
    """Get all active departments"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    departments = await db.departments.find({"is_active": True}).sort("order", 1).to_list(100)
    
    # If no departments exist, create default ones INCLUDING Website
    if not departments:
        default_depts = [
            {"name": "Website", "icon": "🌐", "color": "#22c55e", "order": 0, "dept_type": "website"},
            {"name": "SEO", "icon": "🔍", "color": "#10b981", "order": 1, "dept_type": "standard"},
            {"name": "Meta", "icon": "📊", "color": "#3b82f6", "order": 2, "dept_type": "standard"},
            {"name": "Social Media", "icon": "📱", "color": "#ec4899", "order": 3, "dept_type": "standard"},
            {"name": "Design", "icon": "🎨", "color": "#f59e0b", "order": 4, "dept_type": "standard"},
            {"name": "ERP", "icon": "🏢", "color": "#8b5cf6", "order": 5, "dept_type": "standard"},
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


# ========== WEBSITE PROJECTS (Special Department) ==========

DEFAULT_WEBSITE_PAGES = [
    "Home Page",
    "About Us",
    "Services",
    "Projects/Portfolio",
    "Contact Us",
    "Blog",
    "Privacy Policy",
    "Terms & Conditions"
]

WEBSITE_STATUS_OPTIONS = ["To-Do", "In Progress", "Client Review", "Client Approved", "Completed", "On Hold"]


@department_router.get("/website/projects")
async def get_website_projects(
    request: Request,
    status: Optional[str] = None,
    developer: Optional[str] = None
):
    """Get all website projects with progress stats"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    query = {}
    if status and status != 'all':
        query["status"] = status
    if developer and developer != 'all':
        query["developer"] = developer
    
    projects = await db.website_projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Calculate progress for each project
    for project in projects:
        tasks = await db.website_page_tasks.find(
            {"project_id": project["project_id"]},
            {"_id": 0, "dev_status": 1, "overall_status": 1}
        ).to_list(100)
        
        total = len(tasks)
        # DEV % - count tasks with dev_status == "Completed"
        dev_completed = len([t for t in tasks if t.get("dev_status") == "Completed"])
        # OVERALL % - count tasks with overall_status == "Completed"
        overall_completed = len([t for t in tasks if t.get("overall_status") == "Completed"])
        
        project["total_pages"] = total
        project["dev_percent"] = round((dev_completed / total * 100) if total > 0 else 0)
        project["overall_percent"] = round((overall_completed / total * 100) if total > 0 else 0)
        
        # Get developer name
        if project.get("developer"):
            dev_user = await db.users.find_one({"user_id": project["developer"]}, {"_id": 0, "name": 1})
            project["developer_name"] = dev_user.get("name") if dev_user else None
    
    return projects


@department_router.post("/website/projects")
async def create_website_project(request: Request):
    """Create a new website project with default pages"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    data = await request.json()
    project_id = f"wp_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    project = {
        "project_id": project_id,
        "name": data.get("name", "New Website Project"),
        "onboarding_date": data.get("onboarding_date") or now.strftime("%Y-%m-%d"),
        "deadline": data.get("deadline"),
        "status": data.get("status", "active"),
        "platform": data.get("platform", "Website"),
        "website_type": data.get("website_type", "Business Website"),
        "developer": data.get("developer"),
        "designer": data.get("designer"),
        "content_writer": data.get("content_writer"),
        "project_manager": data.get("project_manager"),
        "domain_url": data.get("domain_url"),
        "client_drive_url": data.get("client_drive_url"),
        "documents_url": data.get("documents_url"),
        "created_by": current_user.user_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.website_projects.insert_one(project)
    
    # Create default page tasks
    for idx, page_name in enumerate(DEFAULT_WEBSITE_PAGES, 1):
        task_id = f"wpt_{uuid.uuid4().hex[:12]}"
        task = {
            "task_id": task_id,
            "project_id": project_id,
            "sno": idx,
            "page_name": page_name,
            "wireframe_url": None,
            "wireframe_due": None,
            "wireframe_status": "To-Do",
            "ui_url": None,
            "ui_due": None,
            "ui_status": "To-Do",
            "content_url": None,
            "content_due": None,
            "content_status": "To-Do",
            "dev_url": None,
            "dev_due": None,
            "dev_status": "To-Do",
            "overall_status": "To-Do",
            "assigned_to": None,
            "notes": None,
            "created_at": now,
            "updated_at": now
        }
        await db.website_page_tasks.insert_one(task)
    
    project.pop("_id", None)
    project["total_pages"] = len(DEFAULT_WEBSITE_PAGES)
    project["dev_percent"] = 0
    project["overall_percent"] = 0
    
    return project


@department_router.get("/website/projects/{project_id}")
async def get_website_project_detail(project_id: str, request: Request):
    """Get website project with all pages"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    project = await db.website_projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all pages
    pages = await db.website_page_tasks.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("sno", 1).to_list(100)
    
    project["pages"] = pages
    
    # Calculate progress
    total = len(pages)
    dev_completed = len([p for p in pages if p.get("dev_status") == "Completed"])
    overall_completed = len([p for p in pages if p.get("overall_status") == "Completed"])
    
    project["total_pages"] = total
    project["dev_percent"] = round((dev_completed / total * 100) if total > 0 else 0)
    project["overall_percent"] = round((overall_completed / total * 100) if total > 0 else 0)
    
    # Get developer name
    if project.get("developer"):
        dev_user = await db.users.find_one({"user_id": project["developer"]}, {"_id": 0, "name": 1})
        project["developer_name"] = dev_user.get("name") if dev_user else None
    
    return project


@department_router.put("/website/projects/{project_id}")
async def update_website_project(project_id: str, request: Request):
    """Update website project"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    data = await request.json()
    data["updated_at"] = datetime.now(timezone.utc)
    
    await db.website_projects.update_one(
        {"project_id": project_id},
        {"$set": data}
    )
    
    project = await db.website_projects.find_one({"project_id": project_id}, {"_id": 0})
    return project


@department_router.delete("/website/projects/{project_id}")
async def delete_website_project(project_id: str, request: Request):
    """Delete website project and all its pages"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    await db.website_projects.delete_one({"project_id": project_id})
    await db.website_page_tasks.delete_many({"project_id": project_id})
    
    return {"message": "Project deleted"}


# ========== WEBSITE PAGES ==========

@department_router.post("/website/projects/{project_id}/pages")
async def add_website_page(project_id: str, request: Request):
    """Add a new page to website project"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    data = await request.json()
    
    # Get max sno
    max_page = await db.website_page_tasks.find_one(
        {"project_id": project_id},
        sort=[("sno", -1)]
    )
    next_sno = (max_page.get("sno", 0) + 1) if max_page else 1
    
    task_id = f"wpt_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    task = {
        "task_id": task_id,
        "project_id": project_id,
        "sno": next_sno,
        "page_name": data.get("page_name", "New Page"),
        "wireframe_url": None,
        "wireframe_due": None,
        "wireframe_status": "To-Do",
        "ui_url": None,
        "ui_due": None,
        "ui_status": "To-Do",
        "content_url": None,
        "content_due": None,
        "content_status": "To-Do",
        "dev_url": None,
        "dev_due": None,
        "dev_status": "To-Do",
        "overall_status": "To-Do",
        "assigned_to": data.get("assigned_to"),
        "notes": data.get("notes"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.website_page_tasks.insert_one(task)
    task.pop("_id", None)
    
    return task


@department_router.put("/website/pages/{task_id}")
async def update_website_page(task_id: str, request: Request):
    """Update a website page/task"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    data = await request.json()
    data["updated_at"] = datetime.now(timezone.utc)
    
    await db.website_page_tasks.update_one(
        {"task_id": task_id},
        {"$set": data}
    )
    
    task = await db.website_page_tasks.find_one({"task_id": task_id}, {"_id": 0})
    return task


@department_router.delete("/website/pages/{task_id}")
async def delete_website_page(task_id: str, request: Request):
    """Delete a website page"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    await db.website_page_tasks.delete_one({"task_id": task_id})
    
    return {"message": "Page deleted"}


@department_router.get("/website/developers")
async def get_website_developers(request: Request):
    """Get all users who can be assigned as developers"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    # Get users with developer-related roles or all users
    users = await db.users.find(
        {"is_active": {"$ne": False}},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "designation": 1, "role": 1}
    ).to_list(100)
    
    return users


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
    
    # Get all user IDs (assigned_to, assigned_by, created_by)
    user_ids = set()
    for t in tasks:
        if t.get("assigned_to"):
            user_ids.add(t["assigned_to"])
        if t.get("assigned_by"):
            user_ids.add(t["assigned_by"])
        if t.get("created_by"):
            user_ids.add(t["created_by"])
    
    users_map = {}
    if user_ids:
        users = await db.users.find({"user_id": {"$in": list(user_ids)}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(100)
        users_map = {u["user_id"]: u["name"] for u in users}
    
    for t in tasks:
        t.pop("_id", None)
        if t.get("assigned_to") and t["assigned_to"] in users_map:
            t["assigned_to_name"] = users_map[t["assigned_to"]]
        if t.get("assigned_by") and t["assigned_by"] in users_map:
            t["assigned_by_name"] = users_map[t["assigned_by"]]
        if t.get("created_by") and t["created_by"] in users_map:
            t["created_by_name"] = users_map[t["created_by"]]
    
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
    
    # Get creator name
    creator = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "name": 1})
    creator_name = creator.get("name", "Unknown") if creator else "Unknown"
    
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
        "all_day": data.all_day,
        "recurrence": data.recurrence,
        "custom_recurrence": data.custom_recurrence,
        "status": data.status,
        "work_link": data.work_link,
        "time_tracking": {
            "status": "not_started",
            "total_seconds": 0,
            "sessions": []
        },
        "created_by": current_user.user_id,
        "created_by_name": creator_name,
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


# ========== TASK TIME TRACKING (BDE-style) ==========

@department_router.post("/projects/{project_id}/tasks/{task_id}/time-tracking")
async def task_time_tracking(project_id: str, task_id: str, data: TimeTrackingAction, request: Request):
    """Handle time tracking actions: start, pause, resume, finish"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    task = await db.project_tasks.find_one({"task_id": task_id, "project_id": project_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    action = data.action
    time_tracking = task.get("time_tracking", {"status": "not_started", "total_seconds": 0, "sessions": []})
    current_status = time_tracking.get("status", "not_started")
    now = datetime.now(timezone.utc)
    
    if action == "start":
        if current_status != "not_started":
            raise HTTPException(status_code=400, detail="Timer already started. Use resume to continue.")
        
        time_tracking["status"] = "running"
        time_tracking["current_session_start"] = now
        time_tracking["sessions"] = time_tracking.get("sessions", [])
        
        # Update task status to in_progress if pending
        update_data = {"time_tracking": time_tracking}
        if task.get("status") == "pending":
            update_data["status"] = "in_progress"
        
        await db.project_tasks.update_one(
            {"task_id": task_id},
            {"$set": update_data}
        )
        return {"message": "Timer started", "time_tracking": time_tracking}
    
    elif action == "pause":
        if current_status != "running":
            raise HTTPException(status_code=400, detail="Timer is not running")
        
        # Calculate duration of this session
        session_start = time_tracking.get("current_session_start")
        if session_start:
            if isinstance(session_start, str):
                session_start = datetime.fromisoformat(session_start.replace('Z', '+00:00'))
            if session_start.tzinfo is None:
                session_start = session_start.replace(tzinfo=timezone.utc)
            session_duration = int((now - session_start).total_seconds())
            
            time_tracking["sessions"].append({
                "start": session_start,
                "end": now,
                "duration": session_duration,
                "user_id": current_user.user_id
            })
            time_tracking["total_seconds"] = time_tracking.get("total_seconds", 0) + session_duration
        
        time_tracking["status"] = "paused"
        time_tracking["current_session_start"] = None
        
        await db.project_tasks.update_one(
            {"task_id": task_id},
            {"$set": {"time_tracking": time_tracking}}
        )
        return {"message": "Timer paused", "time_tracking": time_tracking}
    
    elif action == "resume":
        if current_status not in ["paused", "not_started"]:
            raise HTTPException(status_code=400, detail="Timer cannot be resumed from current state")
        
        time_tracking["status"] = "running"
        time_tracking["current_session_start"] = now
        
        # Update task status to in_progress if not already
        update_data = {"time_tracking": time_tracking}
        if task.get("status") in ["pending", "on_hold"]:
            update_data["status"] = "in_progress"
        
        await db.project_tasks.update_one(
            {"task_id": task_id},
            {"$set": update_data}
        )
        return {"message": "Timer resumed", "time_tracking": time_tracking}
    
    elif action == "finish":
        # If running, close the current session first
        if current_status == "running":
            session_start = time_tracking.get("current_session_start")
            if session_start:
                if isinstance(session_start, str):
                    session_start = datetime.fromisoformat(session_start.replace('Z', '+00:00'))
                if session_start.tzinfo is None:
                    session_start = session_start.replace(tzinfo=timezone.utc)
                session_duration = int((now - session_start).total_seconds())
                
                time_tracking["sessions"].append({
                    "start": session_start,
                    "end": now,
                    "duration": session_duration,
                    "user_id": current_user.user_id
                })
                time_tracking["total_seconds"] = time_tracking.get("total_seconds", 0) + session_duration
        
        time_tracking["status"] = "finished"
        time_tracking["current_session_start"] = None
        time_tracking["finished_at"] = now
        
        await db.project_tasks.update_one(
            {"task_id": task_id},
            {"$set": {"time_tracking": time_tracking}}
        )
        return {"message": "Timer finished", "time_tracking": time_tracking}
    
    else:
        raise HTTPException(status_code=400, detail=f"Invalid action: {action}")


@department_router.get("/tasks/{task_id}/timer")
async def get_task_timer_status(task_id: str, request: Request):
    """Get current timer status for a task"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    task = await db.project_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    time_tracking = task.get("time_tracking", {"status": "not_started", "total_seconds": 0, "sessions": []})
    return {"time_tracking": time_tracking}



