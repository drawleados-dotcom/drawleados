"""
Enhanced Website Projects - Spreadsheet-like project management
Supports page-based tasks with multiple phases (Wireframe, UI, Content, Dev)
"""
from fastapi import APIRouter, HTTPException, Request, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

website_projects_router = APIRouter(prefix="/website-projects", tags=["Website Projects"])
db = None

def init_website_projects_db(database):
    global db
    db = database

# ============== MODELS ==============

class ProjectCreate(BaseModel):
    name: str  # Client/Project name
    # Basic Details
    onboarding_date: Optional[str] = None
    deadline: Optional[str] = None
    status: str = "active"  # active, completed, on-hold, cancelled
    # Client Information
    client_name: Optional[str] = None
    client_location: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    # Domain & Hosting
    domain_url: Optional[str] = None
    domain_username: Optional[str] = None
    domain_password: Optional[str] = None
    domain_2fa: Optional[str] = None
    domain_email_dns: Optional[str] = None
    # WordPress Credentials
    wp_username: Optional[str] = None
    wp_password: Optional[str] = None
    wp_backup: Optional[str] = None
    # Email Credentials
    email_address: Optional[str] = None
    email_password: Optional[str] = None
    email_2fa: Optional[str] = None
    # Server Details
    server_details: Optional[str] = None
    server_username: Optional[str] = None
    server_password: Optional[str] = None
    server_2fa: Optional[str] = None
    # Platform & Type
    platform: str = "Website"  # Website, Shopify, WordPress, Wix, Custom, etc.
    website_type: str = "Business Website"  # Business, E-commerce, Portfolio, Landing Page, Blog, etc.
    # Workflow Stage
    workflow_stage: str = "creation"  # creation, discovery, content, wireframe, ui, development, testing, delivered
    # Team
    developer: Optional[str] = None
    designer: Optional[str] = None
    content_writer: Optional[str] = None
    project_manager: Optional[str] = None
    # Product Details
    product_details: Optional[str] = None
    onboarding_form: Optional[str] = None
    # Links
    client_drive_url: Optional[str] = None
    documents_url: Optional[str] = None
    communication_url: Optional[str] = None
    # Lead Link
    client_id: Optional[str] = None  # Link to lead

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    # Basic Details
    onboarding_date: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None
    # Client Information
    client_name: Optional[str] = None
    client_location: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    # Domain & Hosting
    domain_url: Optional[str] = None
    domain_username: Optional[str] = None
    domain_password: Optional[str] = None
    domain_2fa: Optional[str] = None
    domain_email_dns: Optional[str] = None
    # WordPress Credentials
    wp_username: Optional[str] = None
    wp_password: Optional[str] = None
    wp_backup: Optional[str] = None
    # Email Credentials
    email_address: Optional[str] = None
    email_password: Optional[str] = None
    email_2fa: Optional[str] = None
    # Server Details
    server_details: Optional[str] = None
    server_username: Optional[str] = None
    server_password: Optional[str] = None
    server_2fa: Optional[str] = None
    # Platform & Type
    platform: Optional[str] = None
    website_type: Optional[str] = None
    # Workflow Stage
    workflow_stage: Optional[str] = None  # creation, discovery, content, wireframe, ui, development, testing, delivered
    # Team
    developer: Optional[str] = None
    designer: Optional[str] = None
    content_writer: Optional[str] = None
    project_manager: Optional[str] = None
    # Product Details
    product_details: Optional[str] = None
    onboarding_form: Optional[str] = None
    # Links
    client_drive_url: Optional[str] = None
    documents_url: Optional[str] = None
    communication_url: Optional[str] = None

class PageTaskCreate(BaseModel):
    page_name: str  # Home Page, About Us, etc.
    sno: Optional[int] = None
    # Wireframe phase
    wireframe_url: Optional[str] = None
    wireframe_due: Optional[str] = None
    wireframe_status: str = "To-Do"
    # UI phase
    ui_url: Optional[str] = None
    ui_due: Optional[str] = None
    ui_status: str = "To-Do"
    # Content phase
    content_url: Optional[str] = None
    content_due: Optional[str] = None
    content_status: str = "To-Do"
    # Dev phase
    dev_url: Optional[str] = None
    dev_due: Optional[str] = None
    dev_status: str = "To-Do"
    # Overall
    overall_status: str = "To-Do"
    assigned_to: Optional[str] = None
    notes: Optional[str] = None

class PageTaskUpdate(BaseModel):
    page_name: Optional[str] = None
    sno: Optional[int] = None
    # Wireframe phase
    wireframe_url: Optional[str] = None
    wireframe_due: Optional[str] = None
    wireframe_status: Optional[str] = None
    wireframe_assignee: Optional[str] = None
    # UI phase
    ui_url: Optional[str] = None
    ui_due: Optional[str] = None
    ui_status: Optional[str] = None
    ui_assignee: Optional[str] = None
    # Content phase
    content_url: Optional[str] = None
    content_due: Optional[str] = None
    content_status: Optional[str] = None
    content_assignee: Optional[str] = None
    # Dev phase
    dev_url: Optional[str] = None
    dev_due: Optional[str] = None
    dev_status: Optional[str] = None
    dev_assignee: Optional[str] = None
    # Overall
    overall_status: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    # Page content (Google Docs-like)
    page_content: Optional[str] = None  # JSON content for the page

# ============== NEW: SECTION MODELS ==============

class SectionCreate(BaseModel):
    name: str  # Hero Section, About Section, etc.
    description: Optional[str] = None
    screenshot_url: Optional[str] = None  # Paste screenshot URL

class SectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    screenshot_url: Optional[str] = None
    # Wireframe phase
    wireframe_status: Optional[str] = None
    wireframe_url: Optional[str] = None
    wireframe_due: Optional[str] = None
    wireframe_assignee: Optional[str] = None
    # UI phase
    ui_status: Optional[str] = None
    ui_url: Optional[str] = None
    ui_due: Optional[str] = None
    ui_assignee: Optional[str] = None
    # Dev phase
    dev_status: Optional[str] = None
    dev_url: Optional[str] = None
    dev_due: Optional[str] = None
    dev_assignee: Optional[str] = None
    # Content phase
    content_status: Optional[str] = None
    content_url: Optional[str] = None
    content_due: Optional[str] = None
    content_assignee: Optional[str] = None

class FeedbackCreate(BaseModel):
    content: str
    feedback_type: str = "comment"  # comment, revision, approval

class ProjectTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "medium"  # low, medium, high

class ProjectTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

# ============== DEFAULT PAGES BY TYPE ==============

# Default pages based on website type
DEFAULT_PAGES_BY_TYPE = {
    # Landing Page - Single page only
    "Landing Page": ["Landing Page"],
    
    # Business Website - Standard multi-page
    "Business Website": ["Home", "About Us", "Services", "Portfolio", "Team", "Blog", "Contact", "Privacy Policy"],
    
    # Shopify Store / E-commerce - Full store pages
    "Shopify Store": ["Home", "About Us", "Shop Page", "Collections Page", "Single Product Page", "Terms and Conditions", "Privacy Policy", "Shipping", "Refund Policy"],
    "E-commerce": ["Home", "About Us", "Shop Page", "Collections Page", "Single Product Page", "Terms and Conditions", "Privacy Policy", "Shipping", "Refund Policy"],
    
    # Web App - Application pages
    "Web App": ["Dashboard", "Login", "Register", "Profile", "Settings"],
    
    # Portfolio - Showcase pages
    "Portfolio": ["Home", "About", "Projects", "Contact"],
    
    # Blog - Content pages
    "Blog": ["Home", "Blog", "About", "Contact"],
    
    # SaaS - Product pages
    "SaaS": ["Home", "Features", "Pricing", "About", "Contact", "Login", "Dashboard"],
    
    # Corporate - Enterprise pages
    "Corporate": ["Home", "About Us", "Services", "Team", "Careers", "News", "Contact"]
}

# Fallback default pages (for any unspecified type)
DEFAULT_PAGES = ["Home", "About Us", "Services", "Contact", "Privacy Policy"]

STATUS_OPTIONS = ["To-Do", "In Progress", "Client Review", "Client Approved", "Completed", "On Hold"]

# ============== AUTH HELPER ==============

async def get_current_user(request: Request):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

# ============== PROJECT ROUTES ==============

@website_projects_router.post("/projects")
async def create_project(request: Request, project_data: ProjectCreate):
    """Create a new website project with default pages"""
    user = await get_current_user(request)
    
    project_id = f"wp_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    project = {
        "project_id": project_id,
        "name": project_data.name,
        "onboarding_date": project_data.onboarding_date or now.strftime("%Y-%m-%d"),
        "deadline": project_data.deadline,
        "domain_url": project_data.domain_url,
        "platform": project_data.platform,
        "website_type": project_data.website_type,
        "workflow_stage": project_data.workflow_stage,
        "developer": project_data.developer,
        "designer": project_data.designer,
        "content_writer": project_data.content_writer,
        "project_manager": project_data.project_manager,
        "server_details": project_data.server_details,
        "client_drive_url": project_data.client_drive_url,
        "documents_url": project_data.documents_url,
        "communication_url": project_data.communication_url,
        "client_id": project_data.client_id,
        # Client Information
        "client_name": project_data.client_name,
        "client_location": project_data.client_location,
        "client_email": project_data.client_email,
        "client_phone": project_data.client_phone,
        # Domain & Hosting
        "domain_username": project_data.domain_username,
        "domain_password": project_data.domain_password,
        "domain_2fa": project_data.domain_2fa,
        "domain_email_dns": project_data.domain_email_dns,
        # WordPress
        "wp_username": project_data.wp_username,
        "wp_password": project_data.wp_password,
        "wp_backup": project_data.wp_backup,
        # Email
        "email_address": project_data.email_address,
        "email_password": project_data.email_password,
        "email_2fa": project_data.email_2fa,
        # Server
        "server_username": project_data.server_username,
        "server_password": project_data.server_password,
        "server_2fa": project_data.server_2fa,
        # Product
        "product_details": project_data.product_details,
        "onboarding_form": project_data.onboarding_form,
        "status": "active",
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.website_projects.insert_one(project)
    
    # Get default pages based on website type
    website_type = project_data.website_type or "Business Website"
    pages_to_create = DEFAULT_PAGES_BY_TYPE.get(website_type, DEFAULT_PAGES)
    
    # Create default page tasks
    for idx, page_name in enumerate(pages_to_create, 1):
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
    return {**project, "pages_created": len(pages_to_create)}

@website_projects_router.get("/projects")
async def get_projects(
    request: Request,
    status: Optional[str] = None,
    developer: Optional[str] = None,
    platform: Optional[str] = None
):
    """Get all website projects with filters"""
    user = await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    if developer:
        query["developer"] = developer
    if platform:
        query["platform"] = platform
    
    projects = await db.website_projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Add progress stats for each project
    for project in projects:
        tasks = await db.website_page_tasks.find(
            {"project_id": project["project_id"]},
            {"_id": 0, "overall_status": 1}
        ).to_list(100)
        
        total = len(tasks)
        completed = len([t for t in tasks if t.get("overall_status") == "Completed"])
        project["total_pages"] = total
        project["completed_pages"] = completed
        project["progress"] = round((completed / total * 100) if total > 0 else 0, 1)
    
    return projects

@website_projects_router.get("/projects/{project_id}")
async def get_project(request: Request, project_id: str):
    """Get a single project with all page tasks"""
    user = await get_current_user(request)
    
    project = await db.website_projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all page tasks
    tasks = await db.website_page_tasks.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("sno", 1).to_list(100)
    
    # Calculate stats
    total = len(tasks)
    stats = {
        "total_pages": total,
        "wireframe": {
            "completed": len([t for t in tasks if t.get("wireframe_status") == "Completed"]),
            "in_progress": len([t for t in tasks if t.get("wireframe_status") == "In Progress"])
        },
        "ui": {
            "completed": len([t for t in tasks if t.get("ui_status") == "Completed"]),
            "in_progress": len([t for t in tasks if t.get("ui_status") == "In Progress"])
        },
        "content": {
            "completed": len([t for t in tasks if t.get("content_status") == "Completed"]),
            "in_progress": len([t for t in tasks if t.get("content_status") == "In Progress"])
        },
        "dev": {
            "completed": len([t for t in tasks if t.get("dev_status") == "Completed"]),
            "in_progress": len([t for t in tasks if t.get("dev_status") == "In Progress"])
        },
        "overall_completed": len([t for t in tasks if t.get("overall_status") == "Completed"])
    }
    
    return {
        **project,
        "tasks": tasks,
        "stats": stats
    }

@website_projects_router.put("/projects/{project_id}")
async def update_project(request: Request, project_id: str, update_data: ProjectUpdate):
    """Update project metadata"""
    user = await get_current_user(request)
    
    project = await db.website_projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.website_projects.update_one(
        {"project_id": project_id},
        {"$set": update_dict}
    )
    
    updated = await db.website_projects.find_one({"project_id": project_id}, {"_id": 0})
    return updated

# Workflow stage transition endpoint
@website_projects_router.put("/projects/{project_id}/transition")
async def transition_project_stage(request: Request, project_id: str, data: dict = Body(...)):
    """Move project to next workflow stage"""
    user = await get_current_user(request)
    
    project = await db.website_projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    new_stage = data.get("stage")
    notes = data.get("notes", "")
    
    # Define valid stage transitions
    STAGE_ORDER = ["creation", "discovery", "content", "wireframe", "ui", "development", "testing", "delivered"]
    
    if new_stage not in STAGE_ORDER:
        raise HTTPException(status_code=400, detail=f"Invalid stage: {new_stage}")
    
    current_stage = project.get("workflow_stage", "creation")
    
    # Validation: Cannot move from "creation" to "discovery" unless mandatory fields are filled
    if current_stage == "creation" and new_stage == "discovery":
        missing_fields = []
        
        # Define mandatory fields for moving out of Project Creation
        mandatory_fields = {
            "name": "Project Name",
            "client_name": "Client Name",
            "website_type": "Website Type",
            "platform": "Platform"
        }
        
        for field, label in mandatory_fields.items():
            value = project.get(field)
            if not value or (isinstance(value, str) and not value.strip()):
                missing_fields.append(label)
        
        if missing_fields:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot move to Discovery Call. Missing mandatory fields: {', '.join(missing_fields)}"
            )
    
    # Log the transition
    transition_log = {
        "from_stage": current_stage,
        "to_stage": new_stage,
        "transitioned_by": user.get("user_id"),
        "transitioned_by_name": user.get("name"),
        "notes": notes,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Update the project
    await db.website_projects.update_one(
        {"project_id": project_id},
        {
            "$set": {
                "workflow_stage": new_stage,
                "updated_at": datetime.now(timezone.utc)
            },
            "$push": {
                "stage_transitions": transition_log
            }
        }
    )
    
    updated = await db.website_projects.find_one({"project_id": project_id}, {"_id": 0})
    return {"message": f"Project moved to {new_stage}", "project": updated}

@website_projects_router.delete("/projects/{project_id}")
async def delete_project(request: Request, project_id: str):
    """Delete a project and all its tasks"""
    user = await get_current_user(request)
    
    # Delete all tasks
    await db.website_page_tasks.delete_many({"project_id": project_id})
    
    # Delete project
    result = await db.website_projects.delete_one({"project_id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project deleted"}

# ============== PAGE TASK ROUTES ==============

@website_projects_router.post("/projects/{project_id}/pages")
async def add_page_task(request: Request, project_id: str, task_data: PageTaskCreate):
    """Add a new page task to project"""
    user = await get_current_user(request)
    
    project = await db.website_projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get next sno
    last_task = await db.website_page_tasks.find_one(
        {"project_id": project_id},
        sort=[("sno", -1)]
    )
    next_sno = (last_task.get("sno", 0) + 1) if last_task else 1
    
    task_id = f"wpt_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    task = {
        "task_id": task_id,
        "project_id": project_id,
        "sno": task_data.sno or next_sno,
        "page_name": task_data.page_name,
        "wireframe_url": task_data.wireframe_url,
        "wireframe_due": task_data.wireframe_due,
        "wireframe_status": task_data.wireframe_status,
        "ui_url": task_data.ui_url,
        "ui_due": task_data.ui_due,
        "ui_status": task_data.ui_status,
        "content_url": task_data.content_url,
        "content_due": task_data.content_due,
        "content_status": task_data.content_status,
        "dev_url": task_data.dev_url,
        "dev_due": task_data.dev_due,
        "dev_status": task_data.dev_status,
        "overall_status": task_data.overall_status,
        "assigned_to": task_data.assigned_to,
        "notes": task_data.notes,
        "created_at": now,
        "updated_at": now
    }
    
    await db.website_page_tasks.insert_one(task)
    task.pop("_id", None)
    return task

@website_projects_router.put("/pages/{task_id}")
async def update_page_task(request: Request, task_id: str, update_data: PageTaskUpdate):
    """Update a page task"""
    user = await get_current_user(request)
    
    task = await db.website_page_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    # Auto-calculate overall status based on phases
    if any(k.endswith("_status") and k != "overall_status" for k in update_dict):
        # Get current task data merged with updates
        current = {**task, **update_dict}
        statuses = [
            current.get("wireframe_status", "To-Do"),
            current.get("ui_status", "To-Do"),
            current.get("content_status", "To-Do"),
            current.get("dev_status", "To-Do")
        ]
        
        if all(s == "Completed" for s in statuses):
            update_dict["overall_status"] = "Completed"
        elif any(s == "In Progress" for s in statuses):
            update_dict["overall_status"] = "In Progress"
        elif any(s == "Client Review" for s in statuses):
            update_dict["overall_status"] = "Client Review"
    
    await db.website_page_tasks.update_one(
        {"task_id": task_id},
        {"$set": update_dict}
    )
    
    updated = await db.website_page_tasks.find_one({"task_id": task_id}, {"_id": 0})
    return updated

@website_projects_router.delete("/pages/{task_id}")
async def delete_page_task(request: Request, task_id: str):
    """Delete a page task"""
    user = await get_current_user(request)
    
    result = await db.website_page_tasks.delete_one({"task_id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"message": "Task deleted"}

# ============== BULK UPDATE ==============

@website_projects_router.put("/projects/{project_id}/bulk-update")
async def bulk_update_tasks(request: Request, project_id: str, updates: List[Dict[str, Any]]):
    """Bulk update multiple page tasks"""
    user = await get_current_user(request)
    
    updated_count = 0
    for update in updates:
        task_id = update.pop("task_id", None)
        if task_id and update:
            update["updated_at"] = datetime.now(timezone.utc)
            result = await db.website_page_tasks.update_one(
                {"task_id": task_id, "project_id": project_id},
                {"$set": update}
            )
            if result.modified_count > 0:
                updated_count += 1
    
    return {"updated": updated_count}

# ============== FILTERS & OPTIONS ==============

@website_projects_router.get("/options")
async def get_options(request: Request):
    """Get available options for dropdowns"""
    user = await get_current_user(request)
    
    # Get unique developers
    developers = await db.website_projects.distinct("developer")
    developers = [d for d in developers if d]
    
    # Get unique platforms
    platforms = await db.website_projects.distinct("platform")
    platforms = [p for p in platforms if p]
    
    # Get team members for assignment
    team = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "role": 1}).to_list(50)
    
    return {
        "statuses": STATUS_OPTIONS,
        "developers": developers,
        "platforms": platforms or ["Website", "Shopify", "WordPress", "Custom"],
        "website_types": ["Business Website", "E-commerce", "Portfolio", "Landing Page", "Blog", "Web App"],
        "team_members": team,
        "default_pages": DEFAULT_PAGES
    }

# ============== DASHBOARD ==============

@website_projects_router.get("/dashboard")
async def get_dashboard(request: Request):
    """Get dashboard stats for website projects"""
    user = await get_current_user(request)
    
    total_projects = await db.website_projects.count_documents({})
    active_projects = await db.website_projects.count_documents({"status": "active"})
    
    # Get projects by developer
    pipeline = [
        {"$match": {"developer": {"$ne": None}}},
        {"$group": {"_id": "$developer", "count": {"$sum": 1}}}
    ]
    by_developer = await db.website_projects.aggregate(pipeline).to_list(20)
    
    # Get projects by platform
    pipeline = [
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}}
    ]
    by_platform = await db.website_projects.aggregate(pipeline).to_list(20)
    
    # Get recent projects
    recent = await db.website_projects.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("updated_at", -1).limit(5).to_list(5)
    
    for project in recent:
        tasks = await db.website_page_tasks.find(
            {"project_id": project["project_id"]},
            {"_id": 0, "overall_status": 1}
        ).to_list(100)
        total = len(tasks)
        completed = len([t for t in tasks if t.get("overall_status") == "Completed"])
        project["progress"] = round((completed / total * 100) if total > 0 else 0, 1)
    
    return {
        "total_projects": total_projects,
        "active_projects": active_projects,
        "by_developer": [{"developer": d["_id"], "count": d["count"]} for d in by_developer],
        "by_platform": [{"platform": p["_id"], "count": p["count"]} for p in by_platform],
        "recent_projects": recent
    }

# ============== ROLE CHECK HELPER ==============

def can_edit_project(user):
    """Check if user can edit project details (Operations/CEO only)"""
    return user.get("role") in ["super_admin", "admin", "project_manager"]

# ============== PROJECT TASKS (Separate from Page Tasks) ==============

@website_projects_router.get("/projects/{project_id}/tasks")
async def get_project_tasks(request: Request, project_id: str):
    """Get all tasks for a project"""
    user = await get_current_user(request)
    
    tasks = await db.website_project_tasks.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return tasks

@website_projects_router.post("/projects/{project_id}/tasks")
async def create_project_task(request: Request, project_id: str, task_data: ProjectTaskCreate):
    """Create a new task for the project"""
    user = await get_current_user(request)
    
    task_id = f"wptask_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    task = {
        "task_id": task_id,
        "project_id": project_id,
        "title": task_data.title,
        "description": task_data.description,
        "assigned_to": task_data.assigned_to,
        "due_date": task_data.due_date,
        "priority": task_data.priority,
        "status": "To-Do",
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.website_project_tasks.insert_one(task)
    task.pop("_id", None)
    return task

@website_projects_router.put("/tasks/{task_id}")
async def update_project_task(request: Request, task_id: str, update_data: ProjectTaskUpdate):
    """Update a project task"""
    user = await get_current_user(request)
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.website_project_tasks.update_one(
        {"task_id": task_id},
        {"$set": update_dict}
    )
    
    updated = await db.website_project_tasks.find_one({"task_id": task_id}, {"_id": 0})
    return updated

@website_projects_router.delete("/tasks/{task_id}")
async def delete_project_task(request: Request, task_id: str):
    """Delete a project task"""
    user = await get_current_user(request)
    
    result = await db.website_project_tasks.delete_one({"task_id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"message": "Task deleted"}

# ============== PAGE SECTIONS ==============

@website_projects_router.get("/pages/{page_id}/sections")
async def get_page_sections(request: Request, page_id: str):
    """Get all sections for a page"""
    user = await get_current_user(request)
    
    sections = await db.website_page_sections.find(
        {"page_id": page_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return sections

@website_projects_router.post("/pages/{page_id}/sections")
async def create_page_section(request: Request, page_id: str, section_data: SectionCreate):
    """Create a new section for a page"""
    user = await get_current_user(request)
    
    # Get next order
    last_section = await db.website_page_sections.find_one(
        {"page_id": page_id},
        sort=[("order", -1)]
    )
    next_order = (last_section.get("order", 0) + 1) if last_section else 1
    
    section_id = f"wpsec_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    section = {
        "section_id": section_id,
        "page_id": page_id,
        "order": next_order,
        "name": section_data.name,
        "description": section_data.description,
        "screenshot_url": section_data.screenshot_url,
        "wireframe_status": "To-Do",
        "wireframe_url": None,
        "ui_status": "To-Do",
        "ui_url": None,
        "dev_status": "To-Do",
        "dev_url": None,
        "content_status": "To-Do",
        "content_url": None,
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.website_page_sections.insert_one(section)
    section.pop("_id", None)
    return section

@website_projects_router.put("/sections/{section_id}")
async def update_page_section(request: Request, section_id: str, update_data: SectionUpdate):
    """Update a page section"""
    user = await get_current_user(request)
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.website_page_sections.update_one(
        {"section_id": section_id},
        {"$set": update_dict}
    )
    
    updated = await db.website_page_sections.find_one({"section_id": section_id}, {"_id": 0})
    return updated

@website_projects_router.delete("/sections/{section_id}")
async def delete_page_section(request: Request, section_id: str):
    """Delete a page section"""
    user = await get_current_user(request)
    
    # Also delete feedback for this section
    await db.website_section_feedback.delete_many({"section_id": section_id})
    
    result = await db.website_page_sections.delete_one({"section_id": section_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    
    return {"message": "Section deleted"}

# ============== SECTION FEEDBACK (Google Docs Style) ==============

@website_projects_router.get("/sections/{section_id}/feedback")
async def get_section_feedback(request: Request, section_id: str):
    """Get all feedback for a section"""
    user = await get_current_user(request)
    
    feedback = await db.website_section_feedback.find(
        {"section_id": section_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return feedback

@website_projects_router.post("/sections/{section_id}/feedback")
async def create_section_feedback(request: Request, section_id: str, feedback_data: FeedbackCreate):
    """Create feedback for a section (like Google Docs comments)"""
    user = await get_current_user(request)
    
    feedback_id = f"wpfb_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    feedback = {
        "feedback_id": feedback_id,
        "section_id": section_id,
        "content": feedback_data.content,
        "feedback_type": feedback_data.feedback_type,
        "status": "open",  # open, resolved
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.website_section_feedback.insert_one(feedback)
    feedback.pop("_id", None)
    return feedback

@website_projects_router.put("/feedback/{feedback_id}")
async def update_feedback(request: Request, feedback_id: str, status: str):
    """Update feedback status (resolve/reopen)"""
    user = await get_current_user(request)
    
    await db.website_section_feedback.update_one(
        {"feedback_id": feedback_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    updated = await db.website_section_feedback.find_one({"feedback_id": feedback_id}, {"_id": 0})
    return updated

@website_projects_router.delete("/feedback/{feedback_id}")
async def delete_feedback(request: Request, feedback_id: str):
    """Delete feedback"""
    user = await get_current_user(request)
    
    result = await db.website_section_feedback.delete_one({"feedback_id": feedback_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    return {"message": "Feedback deleted"}

# ============== CHECK EDIT PERMISSION ==============

@website_projects_router.get("/check-permission")
async def check_edit_permission(request: Request):
    """Check if current user can edit project details"""
    user = await get_current_user(request)
    return {"can_edit": can_edit_project(user), "role": user.get("role")}

# ============== PAGE SUB-TASKS (Notion-like) ==============

class PageSubTaskCreate(BaseModel):
    title: str
    completed: bool = False

class PageSubTaskUpdate(BaseModel):
    title: Optional[str] = None
    completed: Optional[bool] = None

@website_projects_router.get("/pages/{page_id}/subtasks")
async def get_page_subtasks(request: Request, page_id: str):
    """Get all sub-tasks for a page"""
    user = await get_current_user(request)
    
    subtasks = await db.website_page_subtasks.find(
        {"page_id": page_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return subtasks

@website_projects_router.post("/pages/{page_id}/subtasks")
async def create_page_subtask(request: Request, page_id: str, subtask_data: PageSubTaskCreate):
    """Create a sub-task for a page (auto-generates date)"""
    user = await get_current_user(request)
    
    subtask_id = f"wpst_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    subtask = {
        "subtask_id": subtask_id,
        "page_id": page_id,
        "title": subtask_data.title,
        "completed": subtask_data.completed,
        "created_at": now,
        "updated_at": now,
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown")
    }
    
    await db.website_page_subtasks.insert_one(subtask)
    subtask.pop("_id", None)
    return subtask

@website_projects_router.put("/subtasks/{subtask_id}")
async def update_page_subtask(request: Request, subtask_id: str, update_data: PageSubTaskUpdate):
    """Update a page sub-task"""
    user = await get_current_user(request)
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.website_page_subtasks.update_one(
        {"subtask_id": subtask_id},
        {"$set": update_dict}
    )
    
    updated = await db.website_page_subtasks.find_one({"subtask_id": subtask_id}, {"_id": 0})
    return updated

@website_projects_router.delete("/subtasks/{subtask_id}")
async def delete_page_subtask(request: Request, subtask_id: str):
    """Delete a page sub-task"""
    user = await get_current_user(request)
    
    result = await db.website_page_subtasks.delete_one({"subtask_id": subtask_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sub-task not found")
    
    return {"message": "Sub-task deleted"}

# ============== PAGE SCREENSHOTS ==============

class ScreenshotCreate(BaseModel):
    url: str
    caption: Optional[str] = None

@website_projects_router.get("/pages/{page_id}/screenshots")
async def get_page_screenshots(request: Request, page_id: str):
    """Get all screenshots for a page"""
    user = await get_current_user(request)
    
    screenshots = await db.website_page_screenshots.find(
        {"page_id": page_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(50)
    
    return screenshots

@website_projects_router.post("/pages/{page_id}/screenshots")
async def add_page_screenshot(request: Request, page_id: str, screenshot_data: ScreenshotCreate):
    """Add a screenshot to a page"""
    user = await get_current_user(request)
    
    screenshot_id = f"wpss_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    screenshot = {
        "screenshot_id": screenshot_id,
        "page_id": page_id,
        "url": screenshot_data.url,
        "caption": screenshot_data.caption,
        "created_at": now,
        "created_by": user["user_id"]
    }
    
    await db.website_page_screenshots.insert_one(screenshot)
    screenshot.pop("_id", None)
    return screenshot

@website_projects_router.delete("/screenshots/{screenshot_id}")
async def delete_page_screenshot(request: Request, screenshot_id: str):
    """Delete a screenshot"""
    user = await get_current_user(request)
    
    result = await db.website_page_screenshots.delete_one({"screenshot_id": screenshot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Screenshot not found")
    
    return {"message": "Screenshot deleted"}

# ============== CROSS-PROJECT TASKS VIEW ==============

@website_projects_router.get("/all-tasks")
async def get_all_tasks_across_projects(
    request: Request, 
    due_date: Optional[str] = None,
    developer: Optional[str] = None
):
    """Get all tasks across all projects with filters for Operations Head view"""
    user = await get_current_user(request)
    
    all_tasks = []
    
    # Get all projects
    projects = await db.website_projects.find({}, {"_id": 0}).to_list(100)
    project_map = {p["project_id"]: p for p in projects}
    
    # 1. Get page-level tasks (with phase due dates)
    page_tasks = await db.website_page_tasks.find({}, {"_id": 0}).to_list(500)
    
    for pt in page_tasks:
        project = project_map.get(pt.get("project_id"), {})
        base_info = {
            "project_id": pt.get("project_id"),
            "project_name": project.get("name", "Unknown"),
            "page_name": pt.get("page_name"),
            "task_id": pt.get("task_id"),
            "task_type": "page_phase"
        }
        
        # Check each phase
        for phase in ["wireframe", "ui", "content", "dev"]:
            phase_due = pt.get(f"{phase}_due")
            phase_status = pt.get(f"{phase}_status", "To-Do")
            phase_assignee = pt.get(f"{phase}_assignee")
            
            if phase_status == "Completed":
                continue
                
            # Apply filters
            if due_date and phase_due != due_date:
                continue
            if developer and phase_assignee != developer:
                continue
            
            if phase_due or (not due_date and not developer):
                all_tasks.append({
                    **base_info,
                    "phase": phase,
                    "title": f"{pt.get('page_name')} - {phase.title()}",
                    "due_date": phase_due,
                    "status": phase_status,
                    "assignee": phase_assignee,
                    "url": pt.get(f"{phase}_url")
                })
    
    # 2. Get project-level tasks
    project_tasks = await db.website_project_tasks.find({}, {"_id": 0}).to_list(500)
    
    for task in project_tasks:
        if task.get("status") == "Completed":
            continue
            
        project = project_map.get(task.get("project_id"), {})
        
        # Apply filters
        if due_date and task.get("due_date") != due_date:
            continue
        if developer and task.get("assigned_to") != developer:
            continue
        
        if task.get("due_date") or (not due_date and not developer):
            all_tasks.append({
                "project_id": task.get("project_id"),
                "project_name": project.get("name", "Unknown"),
                "task_id": task.get("task_id"),
                "task_type": "project_task",
                "title": task.get("title"),
                "description": task.get("description"),
                "due_date": task.get("due_date"),
                "status": task.get("status"),
                "assignee": task.get("assigned_to"),
                "priority": task.get("priority")
            })
    
    # 3. Get section-level tasks (with phase due dates)
    sections = await db.website_page_sections.find({}, {"_id": 0}).to_list(500)
    
    # Get page info for sections
    page_map = {pt["task_id"]: pt for pt in page_tasks}
    
    for sec in sections:
        page = page_map.get(sec.get("page_id"), {})
        project = project_map.get(page.get("project_id"), {})
        
        for phase in ["wireframe", "ui", "content", "dev"]:
            phase_due = sec.get(f"{phase}_due")
            phase_status = sec.get(f"{phase}_status", "To-Do")
            phase_assignee = sec.get(f"{phase}_assignee")
            
            if phase_status == "Completed":
                continue
                
            # Apply filters
            if due_date and phase_due != due_date:
                continue
            if developer and phase_assignee != developer:
                continue
            
            if phase_due or (not due_date and not developer):
                all_tasks.append({
                    "project_id": page.get("project_id"),
                    "project_name": project.get("name", "Unknown"),
                    "page_name": page.get("page_name"),
                    "section_name": sec.get("name"),
                    "section_id": sec.get("section_id"),
                    "task_type": "section_phase",
                    "phase": phase,
                    "title": f"{page.get('page_name')} > {sec.get('name')} - {phase.title()}",
                    "due_date": phase_due,
                    "status": phase_status,
                    "assignee": phase_assignee,
                    "url": sec.get(f"{phase}_url")
                })
    
    # Sort by due date
    all_tasks.sort(key=lambda x: x.get("due_date") or "9999-99-99")
    
    return all_tasks

@website_projects_router.get("/all-projects-summary")
async def get_all_projects_summary(request: Request):
    """Get summary of all projects for Operations Head view"""
    user = await get_current_user(request)
    
    projects = await db.website_projects.find({}, {"_id": 0}).to_list(100)
    
    summaries = []
    for project in projects:
        project_id = project["project_id"]
        
        # Get page tasks for this project
        page_tasks = await db.website_page_tasks.find(
            {"project_id": project_id},
            {"_id": 0}
        ).to_list(100)
        
        total_pages = len(page_tasks)
        
        # Calculate phase completion percentages
        phases = {"wireframe": 0, "ui": 0, "content": 0, "dev": 0}
        for pt in page_tasks:
            for phase in phases:
                if pt.get(f"{phase}_status") == "Completed":
                    phases[phase] += 1
        
        # Calculate overall dev percentage
        dev_percent = round((phases["dev"] / total_pages * 100) if total_pages > 0 else 0, 1)
        overall_percent = round(
            sum(phases.values()) / (total_pages * 4) * 100 if total_pages > 0 else 0, 1
        )
        
        # Build pages data for Content stage filtering
        pages_data = []
        for pt in page_tasks:
            pages_data.append({
                "page_id": pt.get("task_id"),
                "page_name": pt.get("page_name"),
                "content_status": pt.get("content_status", "To-Do"),
                "content_due": pt.get("content_due"),
                "content_assignee": pt.get("content_assignee"),
                "wireframe": {
                    "status": pt.get("wireframe_status", "To-Do"),
                    "url": pt.get("wireframe_url"),
                    "due_date": pt.get("wireframe_due"),
                    "assignee": pt.get("wireframe_assignee")
                },
                "ui": {
                    "status": pt.get("ui_status", "To-Do"),
                    "url": pt.get("ui_url"),
                    "due_date": pt.get("ui_due"),
                    "assignee": pt.get("ui_assignee")
                },
                "content": {
                    "status": pt.get("content_status", "To-Do"),
                    "url": pt.get("content_url"),
                    "due_date": pt.get("content_due"),
                    "assignee": pt.get("content_assignee")
                },
                "dev": {
                    "status": pt.get("dev_status", "To-Do"),
                    "url": pt.get("dev_url"),
                    "due_date": pt.get("dev_due"),
                    "assignee": pt.get("dev_assignee")
                }
            })
        
        summaries.append({
            "project_id": project_id,
            "name": project.get("name"),
            "domain_url": project.get("domain_url"),
            "platform": project.get("platform"),
            "website_type": project.get("website_type"),
            "developer": project.get("developer"),
            "content_writer": project.get("content_writer"),
            "designer": project.get("designer"),
            "client_name": project.get("client_name"),
            "onboarding_date": project.get("onboarding_date"),
            "deadline": project.get("deadline"),
            "status": project.get("status", "active"),
            "workflow_stage": project.get("workflow_stage", "creation"),
            "total_pages": total_pages,
            "dev_percent": dev_percent,
            "overall_percent": overall_percent,
            "phase_stats": {
                "wireframe": round(phases["wireframe"] / total_pages * 100 if total_pages > 0 else 0, 1),
                "ui": round(phases["ui"] / total_pages * 100 if total_pages > 0 else 0, 1),
                "content": round(phases["content"] / total_pages * 100 if total_pages > 0 else 0, 1),
                "dev": dev_percent
            },
            "pages": pages_data
        })
    
    # Sort by deadline
    summaries.sort(key=lambda x: x.get("deadline") or "9999-99-99")
    
    return summaries

@website_projects_router.get("/team-members")
async def get_team_members(request: Request):
    """Get list of team members for assignee dropdowns"""
    user = await get_current_user(request)
    
    # Get users who can work on projects
    users = await db.users.find(
        {"role": {"$in": ["admin", "super_admin", "project_manager", "employee"]}},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "department": 1, "designation": 1}
    ).to_list(50)
    
    return users

# ============== STAGE TASKS & APPROVAL WORKFLOW ==============

@website_projects_router.get("/projects/{project_id}/stage-tasks")
async def get_stage_tasks(project_id: str, request: Request):
    """Get all tasks organized by stage for the tracker board"""
    user = await get_current_user(request)
    
    # Get stage tasks from dedicated collection
    stage_tasks = await db.website_stage_tasks.find(
        {"project_id": project_id},
        {"_id": 0}
    ).to_list(500)
    
    # Organize by stage
    tasks_by_stage = {
        "content": [],
        "wireframe": [],
        "ui": [],
        "dev": [],
        "test": [],
        "delivery": [],
        "approval": []
    }
    
    for task in stage_tasks:
        stage = task.get("current_stage", "content")
        if stage in tasks_by_stage:
            tasks_by_stage[stage].append(task)
    
    return tasks_by_stage

@website_projects_router.post("/projects/{project_id}/convert-pages-to-tasks")
async def convert_pages_to_tasks(project_id: str, request: Request):
    """Convert all pages to stage tasks for tracking"""
    user = await get_current_user(request)
    
    # Check if project exists
    project = await db.website_projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all pages for this project (from website_page_tasks collection)
    pages = await db.website_page_tasks.find({"project_id": project_id}).to_list(100)
    
    tasks_created = 0
    stages = ["content", "wireframe", "ui", "dev", "test"]
    now = datetime.now(timezone.utc)
    
    for page in pages:
        for stage in stages:
            task_id = f"st_{uuid.uuid4().hex[:12]}"
            
            # Check if task already exists for this page+stage
            existing = await db.website_stage_tasks.find_one({
                "page_id": page["task_id"],
                "stage": stage
            })
            
            if not existing:
                task = {
                    "task_id": task_id,
                    "project_id": project_id,
                    "page_id": page["task_id"],
                    "page_name": page.get("page_name"),
                    "stage": stage,
                    "current_stage": stage,
                    "assignee": page.get(f"{stage}_assignee"),
                    "due_date": page.get(f"{stage}_due"),
                    "status": "pending",
                    "url": page.get(f"{stage}_url"),
                    "created_at": now.isoformat(),
                    "created_by": user["user_id"],
                    "comments": [],
                    "history": []
                }
                await db.website_stage_tasks.insert_one(task)
                tasks_created += 1
    
    return {"tasks_created": tasks_created}

@website_projects_router.put("/stage-tasks/{task_id}/submit")
async def submit_task_for_approval(task_id: str, request: Request, data: dict = Body(...)):
    """Submit a task for approval - goes to PM first, then Operations"""
    user = await get_current_user(request)
    stage = data.get("stage")
    link = data.get("link", "")
    now = datetime.now(timezone.utc)
    
    task = await db.website_stage_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Calculate time spent if timer was running
    time_spent = task.get("time_spent", 0)
    timer_started_at = task.get("timer_started_at")
    if timer_started_at:
        started = datetime.fromisoformat(timer_started_at.replace("Z", "+00:00"))
        elapsed_minutes = int((now - started).total_seconds() / 60)
        time_spent += elapsed_minutes
    
    # Get project info
    project = await db.website_projects.find_one({"project_id": task.get("project_id")})
    project_name = project.get("name") if project else "Unknown Project"
    
    # Update task - submitted, waiting for PM approval first
    update_data = {
        "status": "waiting_pm",  # First goes to PM
        "submitted_at": now.isoformat(),
        "submitted_by": user["user_id"],
        "submitted_by_name": user["name"],
        "time_spent": time_spent,
        "timer_started_at": None,
        "pm_approved": False,
        "ops_approved": False
    }
    
    if link:
        update_data["link"] = link
    
    await db.website_stage_tasks.update_one(
        {"task_id": task_id},
        {
            "$set": update_data,
            "$push": {
                "history": {
                    "action": "submitted",
                    "stage": stage,
                    "link": link,
                    "time_spent": time_spent,
                    "by": user["name"],
                    "at": now.isoformat()
                }
            }
        }
    )
    
    # Also update the page task with the link
    page_id = task.get("page_id")
    if page_id and link:
        await db.website_page_tasks.update_one(
            {"task_id": page_id},
            {"$set": {f"{stage}_link": link, f"{stage}_status": "waiting_pm"}}
        )
    
    return {"success": True, "message": "Submitted for PM approval"}

@website_projects_router.put("/stage-tasks/{task_id}/approve")
async def approve_task(task_id: str, request: Request, data: dict = Body(...)):
    """Approve a task"""
    user = await get_current_user(request)
    stage = data.get("stage")
    now = datetime.now(timezone.utc)
    
    # Check if user can approve
    if user["role"] not in ["super_admin", "admin", "project_manager"]:
        if not any(term in (user.get("designation") or "").lower() for term in ["operation", "manager"]):
            raise HTTPException(status_code=403, detail="Not authorized to approve")
    
    task = await db.website_stage_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update task status to approved
    await db.website_stage_tasks.update_one(
        {"task_id": task_id},
        {
            "$set": {
                "status": "approved",
                "approved_at": now.isoformat(),
                "approved_by": user["user_id"]
            },
            "$push": {
                "history": {
                    "action": "approved",
                    "stage": stage,
                    "by": user["name"],
                    "at": now.isoformat()
                }
            }
        }
    )
    
    # Update the page status
    page_id = task.get("page_id")
    if page_id:
        await db.website_page_tasks.update_one(
            {"task_id": page_id},
            {"$set": {f"{stage}_status": "approved"}}
        )
    
    return {"success": True, "message": f"{stage.title()} approved!"}

@website_projects_router.put("/stage-tasks/{task_id}/corrections")
async def request_corrections(task_id: str, request: Request, data: dict = Body(...)):
    """Request corrections on a task"""
    user = await get_current_user(request)
    stage = data.get("stage")
    remarks = data.get("remarks", "")
    now = datetime.now(timezone.utc)
    
    task = await db.website_stage_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update task status - reset approval flags, add correction remarks
    await db.website_stage_tasks.update_one(
        {"task_id": task_id},
        {
            "$set": {
                "status": "corrections",
                "corrections_requested_at": now.isoformat(),
                "correction_remarks": remarks,
                "pm_approved": False,
                "ops_approved": False
            },
            "$push": {
                "comments": {
                    "comment_id": f"cmt_{uuid.uuid4().hex[:8]}",
                    "content": remarks,
                    "type": "correction",
                    "author": user["name"],
                    "author_id": user["user_id"],
                    "created_at": now.isoformat()
                },
                "history": {
                    "action": "corrections_requested",
                    "stage": stage,
                    "remarks": remarks,
                    "by": user["name"],
                    "at": now.isoformat()
                }
            }
        }
    )
    
    return {"success": True, "message": "Corrections requested"}

@website_projects_router.get("/tasks/{task_id}/comments")
async def get_task_comments(task_id: str, request: Request):
    """Get comments for a task"""
    user = await get_current_user(request)
    
    task = await db.website_stage_tasks.find_one({"task_id": task_id})
    if not task:
        return []
    
    return task.get("comments", [])

@website_projects_router.post("/tasks/{task_id}/comments")
async def add_task_comment(task_id: str, request: Request, data: dict = Body(...)):
    """Add a comment to a task"""
    user = await get_current_user(request)
    content = data.get("content", "")
    comment_type = data.get("type", "comment")
    now = datetime.now(timezone.utc)
    
    if not content.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    
    comment = {
        "comment_id": f"cmt_{uuid.uuid4().hex[:8]}",
        "content": content,
        "type": comment_type,
        "author": user["name"],
        "author_id": user["user_id"],
        "created_at": now.isoformat()
    }
    
    await db.website_stage_tasks.update_one(
        {"task_id": task_id},
        {"$push": {"comments": comment}}
    )
    
    return comment

# ==================== TIMER ENDPOINTS ====================

@website_projects_router.post("/stage-tasks/{task_id}/timer")
async def timer_action(task_id: str, request: Request, data: dict = Body(...)):
    """Start, pause, or resume task timer"""
    user = await get_current_user(request)
    action = data.get("action")  # start, pause
    now = datetime.now(timezone.utc)
    
    task = await db.website_stage_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    current_status = task.get("status", "pending")
    time_spent = task.get("time_spent", 0)  # Total minutes spent
    timer_started_at = task.get("timer_started_at")
    
    update_data = {}
    
    if action == "start":
        # Starting or resuming the timer
        update_data = {
            "status": "in_progress",
            "timer_started_at": now.isoformat(),
            "started_by": user["user_id"]
        }
    elif action == "pause":
        # Pausing the timer - calculate time spent
        if timer_started_at:
            started = datetime.fromisoformat(timer_started_at.replace("Z", "+00:00"))
            elapsed_minutes = int((now - started).total_seconds() / 60)
            time_spent += elapsed_minutes
        
        update_data = {
            "status": "paused",
            "timer_started_at": None,
            "time_spent": time_spent
        }
    
    if update_data:
        await db.website_stage_tasks.update_one(
            {"task_id": task_id},
            {
                "$set": update_data,
                "$push": {
                    "history": {
                        "action": action,
                        "by": user["name"],
                        "at": now.isoformat()
                    }
                }
            }
        )
    
    return {"success": True, "status": update_data.get("status", current_status)}

# ==================== 2-LEVEL APPROVAL SYSTEM ====================

@website_projects_router.put("/stage-tasks/{task_id}/pm-approve")
async def pm_approve_task(task_id: str, request: Request, data: dict = Body(...)):
    """Project Manager approves a task - first level"""
    user = await get_current_user(request)
    stage = data.get("stage")
    now = datetime.now(timezone.utc)
    
    # Check if user is PM or admin
    if user["role"] not in ["super_admin", "admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Only Project Managers can approve at this level")
    
    task = await db.website_stage_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update task - PM approved, now needs Ops approval
    await db.website_stage_tasks.update_one(
        {"task_id": task_id},
        {
            "$set": {
                "pm_approved": True,
                "pm_approved_at": now.isoformat(),
                "pm_approved_by": user["user_id"],
                "status": "waiting_ops"  # Now waiting for operations
            },
            "$push": {
                "history": {
                    "action": "pm_approved",
                    "stage": stage,
                    "by": user["name"],
                    "at": now.isoformat()
                }
            }
        }
    )
    
    return {"success": True, "message": "PM approved! Waiting for Operations approval."}

@website_projects_router.put("/stage-tasks/{task_id}/ops-approve")
async def ops_approve_task(task_id: str, request: Request, data: dict = Body(...)):
    """Operations approves a task - second level (final)"""
    user = await get_current_user(request)
    stage = data.get("stage")
    now = datetime.now(timezone.utc)
    
    # Check if user has operations role
    is_ops = (
        user["role"] in ["super_admin", "admin"] or
        "operation" in (user.get("designation") or "").lower() or
        user.get("department") == "operations"
    )
    
    if not is_ops:
        raise HTTPException(status_code=403, detail="Only Operations can approve at this level")
    
    task = await db.website_stage_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check PM approval first
    if not task.get("pm_approved"):
        raise HTTPException(status_code=400, detail="Task must be approved by PM first")
    
    # Update task - fully approved
    await db.website_stage_tasks.update_one(
        {"task_id": task_id},
        {
            "$set": {
                "ops_approved": True,
                "ops_approved_at": now.isoformat(),
                "ops_approved_by": user["user_id"],
                "status": "approved"
            },
            "$push": {
                "history": {
                    "action": "ops_approved",
                    "stage": stage,
                    "by": user["name"],
                    "at": now.isoformat()
                }
            }
        }
    )
    
    # Update page task status
    page_id = task.get("page_id")
    if page_id:
        await db.website_page_tasks.update_one(
            {"task_id": page_id},
            {"$set": {f"{stage}_status": "approved"}}
        )
    
    return {"success": True, "message": "Operations approved! Task fully approved."}

@website_projects_router.post("/stage-tasks/{task_id}/move-next")
async def move_to_next_stage(task_id: str, request: Request, data: dict = Body(...)):
    """Move task to next stage after full approval"""
    user = await get_current_user(request)
    current_stage = data.get("current_stage")
    now = datetime.now(timezone.utc)
    
    # Check if user is PM or admin
    if user["role"] not in ["super_admin", "admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Only Project Managers can move tasks")
    
    task = await db.website_stage_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Verify task is fully approved
    if not (task.get("pm_approved") and task.get("ops_approved")):
        raise HTTPException(status_code=400, detail="Task must be fully approved before moving")
    
    # Define stage order (must match frontend WORKFLOW_STAGES)
    stage_order = ["content", "wireframe", "ui", "responsive", "dev", "test", "delivery"]
    
    try:
        current_idx = stage_order.index(current_stage)
        if current_idx >= len(stage_order) - 1:
            raise HTTPException(status_code=400, detail="Already at final stage")
        
        next_stage = stage_order[current_idx + 1]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid stage")
    
    # Create new task for next stage
    new_task_id = f"st_{uuid.uuid4().hex[:12]}"
    new_task = {
        "task_id": new_task_id,
        "project_id": task.get("project_id"),
        "page_id": task.get("page_id"),
        "page_name": task.get("page_name"),
        "stage": next_stage,
        "current_stage": next_stage,  # Required for get_stage_tasks to organize correctly
        "status": "pending",
        "assignee": None,  # Will be assigned
        "created_at": now.isoformat(),
        "created_by": user["user_id"],
        "moved_from": task_id,
        "history": [{
            "action": "created",
            "moved_from_stage": current_stage,
            "by": user["name"],
            "at": now.isoformat()
        }]
    }
    
    await db.website_stage_tasks.insert_one(new_task)
    
    # Mark current task as moved
    await db.website_stage_tasks.update_one(
        {"task_id": task_id},
        {
            "$set": {"moved_to_next": True, "moved_to_task": new_task_id},
            "$push": {
                "history": {
                    "action": "moved_to_next",
                    "next_stage": next_stage,
                    "by": user["name"],
                    "at": now.isoformat()
                }
            }
        }
    )
    
    return {"success": True, "message": f"Moved to {next_stage.title()}!", "new_task_id": new_task_id}
