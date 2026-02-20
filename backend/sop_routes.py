"""
SOP Works Board - Service-based Project Management
Pre-built task templates and Kanban boards for Website, SEO, SEM, Meta Ads
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid

sop_router = APIRouter(prefix="/sop", tags=["SOP Works Board"])
db = None

def init_sop_db(database):
    global db
    db = database

# ============== SERVICE TEMPLATES ==============

SERVICE_TEMPLATES = {
    "website": {
        "name": "Website Development",
        "icon": "🌐",
        "color": "#6366f1",
        "stages": [
            {"id": "discovery", "name": "Discovery", "color": "#71717a", "order": 0},
            {"id": "design", "name": "Design", "color": "#8b5cf6", "order": 1},
            {"id": "development", "name": "Development", "color": "#3b82f6", "order": 2},
            {"id": "testing", "name": "Testing", "color": "#f59e0b", "order": 3},
            {"id": "launch", "name": "Launch", "color": "#10b981", "order": 4}
        ],
        "tasks": [
            # Discovery Phase
            {"title": "Client requirement gathering", "stage": "discovery", "priority": "high", "estimated_hours": 2},
            {"title": "Competitor analysis", "stage": "discovery", "priority": "medium", "estimated_hours": 3},
            {"title": "Sitemap creation", "stage": "discovery", "priority": "high", "estimated_hours": 2},
            {"title": "Content inventory", "stage": "discovery", "priority": "medium", "estimated_hours": 2},
            {"title": "Technology stack finalization", "stage": "discovery", "priority": "high", "estimated_hours": 1},
            # Design Phase
            {"title": "Wireframe creation", "stage": "design", "priority": "high", "estimated_hours": 8},
            {"title": "UI/UX design - Homepage", "stage": "design", "priority": "high", "estimated_hours": 6},
            {"title": "UI/UX design - Inner pages", "stage": "design", "priority": "high", "estimated_hours": 8},
            {"title": "Mobile responsive design", "stage": "design", "priority": "high", "estimated_hours": 4},
            {"title": "Design review & approval", "stage": "design", "priority": "high", "estimated_hours": 2},
            # Development Phase
            {"title": "Project setup & environment", "stage": "development", "priority": "high", "estimated_hours": 2},
            {"title": "Homepage development", "stage": "development", "priority": "high", "estimated_hours": 8},
            {"title": "Inner pages development", "stage": "development", "priority": "high", "estimated_hours": 16},
            {"title": "Contact form integration", "stage": "development", "priority": "medium", "estimated_hours": 3},
            {"title": "CMS integration", "stage": "development", "priority": "medium", "estimated_hours": 6},
            {"title": "Third-party integrations", "stage": "development", "priority": "medium", "estimated_hours": 4},
            # Testing Phase
            {"title": "Cross-browser testing", "stage": "testing", "priority": "high", "estimated_hours": 3},
            {"title": "Mobile responsiveness testing", "stage": "testing", "priority": "high", "estimated_hours": 2},
            {"title": "Performance optimization", "stage": "testing", "priority": "high", "estimated_hours": 4},
            {"title": "SEO basic setup", "stage": "testing", "priority": "medium", "estimated_hours": 2},
            {"title": "Security audit", "stage": "testing", "priority": "high", "estimated_hours": 2},
            {"title": "Client UAT", "stage": "testing", "priority": "high", "estimated_hours": 4},
            # Launch Phase
            {"title": "Domain & hosting setup", "stage": "launch", "priority": "high", "estimated_hours": 2},
            {"title": "SSL certificate installation", "stage": "launch", "priority": "high", "estimated_hours": 1},
            {"title": "Final deployment", "stage": "launch", "priority": "high", "estimated_hours": 2},
            {"title": "Analytics setup", "stage": "launch", "priority": "medium", "estimated_hours": 1},
            {"title": "Client handover & training", "stage": "launch", "priority": "high", "estimated_hours": 2}
        ]
    },
    "seo": {
        "name": "SEO",
        "icon": "🔍",
        "color": "#10b981",
        "stages": [
            {"id": "audit", "name": "Audit", "color": "#71717a", "order": 0},
            {"id": "keyword_research", "name": "Keyword Research", "color": "#8b5cf6", "order": 1},
            {"id": "on_page", "name": "On-Page SEO", "color": "#3b82f6", "order": 2},
            {"id": "off_page", "name": "Off-Page SEO", "color": "#f59e0b", "order": 3},
            {"id": "reporting", "name": "Reporting", "color": "#10b981", "order": 4}
        ],
        "tasks": [
            # Audit Phase
            {"title": "Technical SEO audit", "stage": "audit", "priority": "high", "estimated_hours": 4},
            {"title": "Competitor SEO analysis", "stage": "audit", "priority": "high", "estimated_hours": 3},
            {"title": "Current rankings check", "stage": "audit", "priority": "medium", "estimated_hours": 2},
            {"title": "Backlink profile analysis", "stage": "audit", "priority": "medium", "estimated_hours": 2},
            {"title": "Site speed analysis", "stage": "audit", "priority": "high", "estimated_hours": 1},
            {"title": "Mobile-friendliness check", "stage": "audit", "priority": "high", "estimated_hours": 1},
            # Keyword Research Phase
            {"title": "Primary keyword identification", "stage": "keyword_research", "priority": "high", "estimated_hours": 4},
            {"title": "Long-tail keyword research", "stage": "keyword_research", "priority": "medium", "estimated_hours": 3},
            {"title": "Competitor keyword analysis", "stage": "keyword_research", "priority": "medium", "estimated_hours": 2},
            {"title": "Keyword mapping to pages", "stage": "keyword_research", "priority": "high", "estimated_hours": 2},
            {"title": "Search intent analysis", "stage": "keyword_research", "priority": "medium", "estimated_hours": 2},
            # On-Page SEO Phase
            {"title": "Meta titles optimization", "stage": "on_page", "priority": "high", "estimated_hours": 3},
            {"title": "Meta descriptions optimization", "stage": "on_page", "priority": "high", "estimated_hours": 3},
            {"title": "Header tags (H1-H6) optimization", "stage": "on_page", "priority": "high", "estimated_hours": 2},
            {"title": "URL structure optimization", "stage": "on_page", "priority": "medium", "estimated_hours": 2},
            {"title": "Image alt tags optimization", "stage": "on_page", "priority": "medium", "estimated_hours": 2},
            {"title": "Internal linking strategy", "stage": "on_page", "priority": "high", "estimated_hours": 3},
            {"title": "Schema markup implementation", "stage": "on_page", "priority": "medium", "estimated_hours": 3},
            {"title": "Content optimization", "stage": "on_page", "priority": "high", "estimated_hours": 6},
            # Off-Page SEO Phase
            {"title": "Backlink strategy creation", "stage": "off_page", "priority": "high", "estimated_hours": 2},
            {"title": "Guest posting outreach", "stage": "off_page", "priority": "medium", "estimated_hours": 4},
            {"title": "Directory submissions", "stage": "off_page", "priority": "low", "estimated_hours": 3},
            {"title": "Social bookmarking", "stage": "off_page", "priority": "low", "estimated_hours": 2},
            {"title": "Local SEO citations", "stage": "off_page", "priority": "medium", "estimated_hours": 3},
            {"title": "Google Business Profile optimization", "stage": "off_page", "priority": "high", "estimated_hours": 2},
            # Reporting Phase
            {"title": "Monthly ranking report", "stage": "reporting", "priority": "high", "estimated_hours": 2},
            {"title": "Traffic analysis report", "stage": "reporting", "priority": "high", "estimated_hours": 2},
            {"title": "Backlink report", "stage": "reporting", "priority": "medium", "estimated_hours": 1},
            {"title": "Recommendations document", "stage": "reporting", "priority": "high", "estimated_hours": 2},
            {"title": "Client presentation", "stage": "reporting", "priority": "high", "estimated_hours": 2}
        ]
    },
    "sem": {
        "name": "SEM / Google Ads",
        "icon": "📊",
        "color": "#f59e0b",
        "stages": [
            {"id": "strategy", "name": "Strategy", "color": "#71717a", "order": 0},
            {"id": "campaign_setup", "name": "Campaign Setup", "color": "#8b5cf6", "order": 1},
            {"id": "optimization", "name": "Optimization", "color": "#3b82f6", "order": 2},
            {"id": "scaling", "name": "Scaling", "color": "#f59e0b", "order": 3},
            {"id": "reporting", "name": "Reporting", "color": "#10b981", "order": 4}
        ],
        "tasks": [
            # Strategy Phase
            {"title": "Business goals understanding", "stage": "strategy", "priority": "high", "estimated_hours": 2},
            {"title": "Target audience definition", "stage": "strategy", "priority": "high", "estimated_hours": 2},
            {"title": "Competitor ads analysis", "stage": "strategy", "priority": "medium", "estimated_hours": 3},
            {"title": "Budget planning", "stage": "strategy", "priority": "high", "estimated_hours": 1},
            {"title": "Campaign structure planning", "stage": "strategy", "priority": "high", "estimated_hours": 2},
            {"title": "Keyword research for ads", "stage": "strategy", "priority": "high", "estimated_hours": 4},
            # Campaign Setup Phase
            {"title": "Google Ads account setup", "stage": "campaign_setup", "priority": "high", "estimated_hours": 1},
            {"title": "Conversion tracking setup", "stage": "campaign_setup", "priority": "high", "estimated_hours": 2},
            {"title": "Campaign creation", "stage": "campaign_setup", "priority": "high", "estimated_hours": 3},
            {"title": "Ad groups setup", "stage": "campaign_setup", "priority": "high", "estimated_hours": 3},
            {"title": "Keyword addition & match types", "stage": "campaign_setup", "priority": "high", "estimated_hours": 2},
            {"title": "Negative keywords list", "stage": "campaign_setup", "priority": "medium", "estimated_hours": 2},
            {"title": "Ad copy writing", "stage": "campaign_setup", "priority": "high", "estimated_hours": 4},
            {"title": "Ad extensions setup", "stage": "campaign_setup", "priority": "medium", "estimated_hours": 2},
            {"title": "Landing page review", "stage": "campaign_setup", "priority": "high", "estimated_hours": 2},
            # Optimization Phase
            {"title": "Search terms review", "stage": "optimization", "priority": "high", "estimated_hours": 2},
            {"title": "Bid adjustments", "stage": "optimization", "priority": "high", "estimated_hours": 1},
            {"title": "Ad copy A/B testing", "stage": "optimization", "priority": "medium", "estimated_hours": 3},
            {"title": "Quality score improvement", "stage": "optimization", "priority": "high", "estimated_hours": 3},
            {"title": "Negative keywords update", "stage": "optimization", "priority": "medium", "estimated_hours": 1},
            {"title": "Audience targeting refinement", "stage": "optimization", "priority": "medium", "estimated_hours": 2},
            # Scaling Phase
            {"title": "Budget increase planning", "stage": "scaling", "priority": "medium", "estimated_hours": 1},
            {"title": "New keyword expansion", "stage": "scaling", "priority": "medium", "estimated_hours": 3},
            {"title": "Display campaign setup", "stage": "scaling", "priority": "low", "estimated_hours": 4},
            {"title": "Remarketing campaign setup", "stage": "scaling", "priority": "medium", "estimated_hours": 3},
            {"title": "YouTube ads exploration", "stage": "scaling", "priority": "low", "estimated_hours": 4},
            # Reporting Phase
            {"title": "Weekly performance report", "stage": "reporting", "priority": "high", "estimated_hours": 1},
            {"title": "Monthly detailed report", "stage": "reporting", "priority": "high", "estimated_hours": 3},
            {"title": "ROI analysis", "stage": "reporting", "priority": "high", "estimated_hours": 2},
            {"title": "Recommendations & next steps", "stage": "reporting", "priority": "high", "estimated_hours": 2},
            {"title": "Client review meeting", "stage": "reporting", "priority": "high", "estimated_hours": 1}
        ]
    },
    "meta_ads": {
        "name": "Meta Ads",
        "icon": "📱",
        "color": "#3b82f6",
        "stages": [
            {"id": "strategy", "name": "Strategy", "color": "#71717a", "order": 0},
            {"id": "creative", "name": "Creative", "color": "#ec4899", "order": 1},
            {"id": "campaign_setup", "name": "Campaign Setup", "color": "#8b5cf6", "order": 2},
            {"id": "optimization", "name": "Optimization", "color": "#f59e0b", "order": 3},
            {"id": "reporting", "name": "Reporting", "color": "#10b981", "order": 4}
        ],
        "tasks": [
            # Strategy Phase
            {"title": "Campaign objective definition", "stage": "strategy", "priority": "high", "estimated_hours": 1},
            {"title": "Target audience research", "stage": "strategy", "priority": "high", "estimated_hours": 3},
            {"title": "Custom audience planning", "stage": "strategy", "priority": "medium", "estimated_hours": 2},
            {"title": "Lookalike audience planning", "stage": "strategy", "priority": "medium", "estimated_hours": 1},
            {"title": "Budget & bid strategy", "stage": "strategy", "priority": "high", "estimated_hours": 1},
            {"title": "Competitor ads research", "stage": "strategy", "priority": "medium", "estimated_hours": 2},
            {"title": "Funnel strategy creation", "stage": "strategy", "priority": "high", "estimated_hours": 2},
            # Creative Phase
            {"title": "Ad concept brainstorming", "stage": "creative", "priority": "high", "estimated_hours": 2},
            {"title": "Image ad design", "stage": "creative", "priority": "high", "estimated_hours": 4},
            {"title": "Carousel ad design", "stage": "creative", "priority": "medium", "estimated_hours": 3},
            {"title": "Video ad creation", "stage": "creative", "priority": "medium", "estimated_hours": 6},
            {"title": "Reel/Story ad creation", "stage": "creative", "priority": "medium", "estimated_hours": 4},
            {"title": "Ad copy writing", "stage": "creative", "priority": "high", "estimated_hours": 3},
            {"title": "CTA selection", "stage": "creative", "priority": "high", "estimated_hours": 1},
            {"title": "Creative approval", "stage": "creative", "priority": "high", "estimated_hours": 1},
            # Campaign Setup Phase
            {"title": "Meta Business Manager setup", "stage": "campaign_setup", "priority": "high", "estimated_hours": 1},
            {"title": "Pixel installation & verification", "stage": "campaign_setup", "priority": "high", "estimated_hours": 2},
            {"title": "Custom conversions setup", "stage": "campaign_setup", "priority": "high", "estimated_hours": 2},
            {"title": "Campaign creation", "stage": "campaign_setup", "priority": "high", "estimated_hours": 2},
            {"title": "Ad set configuration", "stage": "campaign_setup", "priority": "high", "estimated_hours": 2},
            {"title": "Audience targeting setup", "stage": "campaign_setup", "priority": "high", "estimated_hours": 2},
            {"title": "Ad upload & review", "stage": "campaign_setup", "priority": "high", "estimated_hours": 2},
            {"title": "Campaign launch", "stage": "campaign_setup", "priority": "high", "estimated_hours": 1},
            # Optimization Phase
            {"title": "Performance monitoring", "stage": "optimization", "priority": "high", "estimated_hours": 2},
            {"title": "Audience performance analysis", "stage": "optimization", "priority": "high", "estimated_hours": 2},
            {"title": "Creative performance analysis", "stage": "optimization", "priority": "high", "estimated_hours": 2},
            {"title": "Budget reallocation", "stage": "optimization", "priority": "medium", "estimated_hours": 1},
            {"title": "A/B testing execution", "stage": "optimization", "priority": "medium", "estimated_hours": 3},
            {"title": "Winning ads scaling", "stage": "optimization", "priority": "high", "estimated_hours": 2},
            {"title": "Poor performers pause", "stage": "optimization", "priority": "high", "estimated_hours": 1},
            # Reporting Phase
            {"title": "Daily performance check", "stage": "reporting", "priority": "high", "estimated_hours": 0.5},
            {"title": "Weekly performance report", "stage": "reporting", "priority": "high", "estimated_hours": 2},
            {"title": "Monthly detailed report", "stage": "reporting", "priority": "high", "estimated_hours": 3},
            {"title": "ROAS analysis", "stage": "reporting", "priority": "high", "estimated_hours": 2},
            {"title": "Insights & recommendations", "stage": "reporting", "priority": "high", "estimated_hours": 2},
            {"title": "Client presentation", "stage": "reporting", "priority": "high", "estimated_hours": 1}
        ]
    }
}

# ============== MODELS ==============

class SOPProjectCreate(BaseModel):
    name: str
    service_type: str  # website, seo, sem, meta_ads
    client_id: Optional[str] = None  # Link to lead/client
    client_name: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    description: Optional[str] = ""
    auto_create_tasks: bool = True  # Auto-create tasks from template

class SOPTaskCreate(BaseModel):
    title: str
    stage: str
    priority: str = "medium"  # low, medium, high
    estimated_hours: float = 1
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = ""

class SOPTaskUpdate(BaseModel):
    title: Optional[str] = None
    stage: Optional[str] = None
    priority: Optional[str] = None
    estimated_hours: Optional[float] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None
    is_completed: Optional[bool] = None
    actual_hours: Optional[float] = None

class SOPProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # active, on_hold, completed

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

# ============== TEMPLATE ROUTES ==============

@sop_router.get("/templates")
async def get_service_templates():
    """Get all available service templates"""
    templates = []
    for key, template in SERVICE_TEMPLATES.items():
        templates.append({
            "service_type": key,
            "name": template["name"],
            "icon": template["icon"],
            "color": template["color"],
            "stages": template["stages"],
            "task_count": len(template["tasks"]),
            "total_hours": sum(t.get("estimated_hours", 0) for t in template["tasks"])
        })
    return templates

@sop_router.get("/templates/{service_type}")
async def get_service_template(service_type: str):
    """Get specific service template with all tasks"""
    if service_type not in SERVICE_TEMPLATES:
        raise HTTPException(status_code=404, detail="Service template not found")
    
    template = SERVICE_TEMPLATES[service_type]
    return {
        "service_type": service_type,
        **template
    }

# ============== PROJECT ROUTES ==============

@sop_router.post("/projects")
async def create_sop_project(request: Request, project_data: SOPProjectCreate):
    """Create a new SOP project with optional auto-generated tasks"""
    user = await get_current_user(request)
    
    if project_data.service_type not in SERVICE_TEMPLATES:
        raise HTTPException(status_code=400, detail="Invalid service type")
    
    template = SERVICE_TEMPLATES[project_data.service_type]
    
    project_id = f"sop_proj_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    project = {
        "project_id": project_id,
        "name": project_data.name,
        "service_type": project_data.service_type,
        "service_name": template["name"],
        "service_icon": template["icon"],
        "service_color": template["color"],
        "stages": template["stages"],
        "client_id": project_data.client_id,
        "client_name": project_data.client_name,
        "start_date": project_data.start_date or now.strftime("%Y-%m-%d"),
        "due_date": project_data.due_date,
        "description": project_data.description,
        "status": "active",
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.sop_projects.insert_one(project)
    
    # Auto-create tasks from template
    tasks_created = 0
    if project_data.auto_create_tasks:
        for task_template in template["tasks"]:
            task_id = f"sop_task_{uuid.uuid4().hex[:12]}"
            task = {
                "task_id": task_id,
                "project_id": project_id,
                "title": task_template["title"],
                "stage": task_template["stage"],
                "priority": task_template.get("priority", "medium"),
                "estimated_hours": task_template.get("estimated_hours", 1),
                "actual_hours": 0,
                "assigned_to": None,
                "due_date": None,
                "notes": "",
                "is_completed": False,
                "completed_at": None,
                "created_at": now,
                "updated_at": now
            }
            await db.sop_tasks.insert_one(task)
            tasks_created += 1
    
    # Remove _id before returning
    project.pop("_id", None)
    
    return {
        **project,
        "tasks_created": tasks_created
    }

@sop_router.get("/projects")
async def get_sop_projects(
    request: Request, 
    service_type: Optional[str] = None,
    status: Optional[str] = None,
    client_id: Optional[str] = None
):
    """Get all SOP projects with optional filters"""
    user = await get_current_user(request)
    
    query = {}
    if service_type:
        query["service_type"] = service_type
    if status:
        query["status"] = status
    if client_id:
        query["client_id"] = client_id
    
    projects = await db.sop_projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Add task stats for each project
    for project in projects:
        task_count = await db.sop_tasks.count_documents({"project_id": project["project_id"]})
        completed_count = await db.sop_tasks.count_documents({
            "project_id": project["project_id"],
            "is_completed": True
        })
        project["task_count"] = task_count
        project["completed_count"] = completed_count
        project["progress"] = round((completed_count / task_count * 100) if task_count > 0 else 0, 1)
    
    return projects

@sop_router.get("/projects/{project_id}")
async def get_sop_project(request: Request, project_id: str):
    """Get a specific SOP project with all tasks"""
    user = await get_current_user(request)
    
    project = await db.sop_projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all tasks for this project
    tasks = await db.sop_tasks.find(
        {"project_id": project_id}, 
        {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    
    # Group tasks by stage
    tasks_by_stage = {}
    for stage in project.get("stages", []):
        stage_id = stage["id"]
        tasks_by_stage[stage_id] = [t for t in tasks if t["stage"] == stage_id]
    
    # Calculate stats
    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t["is_completed"]])
    total_estimated_hours = sum(t.get("estimated_hours", 0) for t in tasks)
    total_actual_hours = sum(t.get("actual_hours", 0) for t in tasks)
    
    return {
        **project,
        "tasks": tasks,
        "tasks_by_stage": tasks_by_stage,
        "stats": {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "progress": round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1),
            "total_estimated_hours": total_estimated_hours,
            "total_actual_hours": total_actual_hours
        }
    }

@sop_router.put("/projects/{project_id}")
async def update_sop_project(request: Request, project_id: str, update_data: SOPProjectUpdate):
    """Update a SOP project"""
    user = await get_current_user(request)
    
    project = await db.sop_projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.sop_projects.update_one(
        {"project_id": project_id},
        {"$set": update_dict}
    )
    
    updated = await db.sop_projects.find_one({"project_id": project_id}, {"_id": 0})
    return updated

@sop_router.delete("/projects/{project_id}")
async def delete_sop_project(request: Request, project_id: str):
    """Delete a SOP project and all its tasks"""
    user = await get_current_user(request)
    
    project = await db.sop_projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete all tasks
    await db.sop_tasks.delete_many({"project_id": project_id})
    
    # Delete project
    await db.sop_projects.delete_one({"project_id": project_id})
    
    return {"message": "Project and all tasks deleted"}

# ============== TASK ROUTES ==============

@sop_router.post("/projects/{project_id}/tasks")
async def create_sop_task(request: Request, project_id: str, task_data: SOPTaskCreate):
    """Create a new task in a project"""
    user = await get_current_user(request)
    
    project = await db.sop_projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    task_id = f"sop_task_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    task = {
        "task_id": task_id,
        "project_id": project_id,
        "title": task_data.title,
        "stage": task_data.stage,
        "priority": task_data.priority,
        "estimated_hours": task_data.estimated_hours,
        "actual_hours": 0,
        "assigned_to": task_data.assigned_to,
        "due_date": task_data.due_date,
        "notes": task_data.notes,
        "is_completed": False,
        "completed_at": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.sop_tasks.insert_one(task)
    task.pop("_id", None)
    
    return task

@sop_router.put("/tasks/{task_id}")
async def update_sop_task(request: Request, task_id: str, update_data: SOPTaskUpdate):
    """Update a task"""
    user = await get_current_user(request)
    
    task = await db.sop_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    # If marking as completed, set completed_at
    if update_data.is_completed is True and not task.get("is_completed"):
        update_dict["completed_at"] = datetime.now(timezone.utc)
    elif update_data.is_completed is False:
        update_dict["completed_at"] = None
    
    await db.sop_tasks.update_one(
        {"task_id": task_id},
        {"$set": update_dict}
    )
    
    updated = await db.sop_tasks.find_one({"task_id": task_id}, {"_id": 0})
    return updated

@sop_router.delete("/tasks/{task_id}")
async def delete_sop_task(request: Request, task_id: str):
    """Delete a task"""
    user = await get_current_user(request)
    
    result = await db.sop_tasks.delete_one({"task_id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"message": "Task deleted"}

@sop_router.put("/tasks/{task_id}/move")
async def move_task_to_stage(request: Request, task_id: str, stage: str):
    """Move a task to a different stage"""
    user = await get_current_user(request)
    
    task = await db.sop_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.sop_tasks.update_one(
        {"task_id": task_id},
        {"$set": {"stage": stage, "updated_at": datetime.now(timezone.utc)}}
    )
    
    updated = await db.sop_tasks.find_one({"task_id": task_id}, {"_id": 0})
    return updated

# ============== DASHBOARD / STATS ==============

@sop_router.get("/dashboard")
async def get_sop_dashboard(request: Request):
    """Get SOP dashboard with overall stats"""
    user = await get_current_user(request)
    
    # Get project counts by service type
    service_stats = []
    for service_type, template in SERVICE_TEMPLATES.items():
        active_count = await db.sop_projects.count_documents({
            "service_type": service_type,
            "status": "active"
        })
        completed_count = await db.sop_projects.count_documents({
            "service_type": service_type,
            "status": "completed"
        })
        service_stats.append({
            "service_type": service_type,
            "name": template["name"],
            "icon": template["icon"],
            "color": template["color"],
            "active_projects": active_count,
            "completed_projects": completed_count
        })
    
    # Get overall task stats
    total_tasks = await db.sop_tasks.count_documents({})
    completed_tasks = await db.sop_tasks.count_documents({"is_completed": True})
    
    # Get active projects
    active_projects = await db.sop_projects.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("updated_at", -1).limit(5).to_list(5)
    
    # Add progress to each active project
    for project in active_projects:
        task_count = await db.sop_tasks.count_documents({"project_id": project["project_id"]})
        completed_count = await db.sop_tasks.count_documents({
            "project_id": project["project_id"],
            "is_completed": True
        })
        project["progress"] = round((completed_count / task_count * 100) if task_count > 0 else 0, 1)
    
    # Get overdue tasks (tasks with due_date < today and not completed)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Note: This is a simplified check - in production you'd want proper date comparison
    
    return {
        "service_stats": service_stats,
        "overall": {
            "total_projects": await db.sop_projects.count_documents({}),
            "active_projects": await db.sop_projects.count_documents({"status": "active"}),
            "completed_projects": await db.sop_projects.count_documents({"status": "completed"}),
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "task_completion_rate": round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1)
        },
        "recent_active_projects": active_projects
    }

# ============== CLIENT LINKING ==============

@sop_router.get("/clients")
async def get_available_clients(request: Request):
    """Get list of clients/leads that can be linked to projects"""
    user = await get_current_user(request)
    
    # Get leads that can be linked
    leads = await db.leads.find(
        {"is_deleted": False},
        {"_id": 0, "lead_id": 1, "name": 1, "business_name": 1, "status_id": 1}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    return leads
