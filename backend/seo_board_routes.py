from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

seo_board_router = APIRouter(prefix="/seo-board", tags=["seo-board"])

# Database reference
seo_db = None

def init_seo_board_db(db):
    """Initialize the SEO board module with database"""
    global seo_db
    seo_db = db

# ============== PREDEFINED TASK TEMPLATES ==============
TASK_TEMPLATES = {
    "onpage": [
        {"name": "Keyword Research & Analysis", "description": "Research and identify target keywords for the client"},
        {"name": "Title Tag Optimization", "description": "Optimize title tags for all key pages"},
        {"name": "Meta Description Optimization", "description": "Write compelling meta descriptions"},
        {"name": "Header Tags (H1-H6) Optimization", "description": "Structure content with proper header hierarchy"},
        {"name": "Content Optimization", "description": "Optimize existing content for target keywords"},
        {"name": "Internal Linking", "description": "Improve internal link structure"},
        {"name": "Image Alt Text Optimization", "description": "Add/optimize alt text for all images"},
        {"name": "URL Structure Optimization", "description": "Clean up and optimize URL slugs"},
        {"name": "Schema Markup Implementation", "description": "Add structured data markup"},
        {"name": "Page Speed Optimization", "description": "Improve Core Web Vitals scores"},
        {"name": "Mobile Responsiveness Check", "description": "Ensure mobile-friendly design"},
        {"name": "Content Gap Analysis", "description": "Identify missing content opportunities"},
    ],
    "offpage": [
        {"name": "Competitor Backlink Analysis", "description": "Analyze competitor backlink profiles"},
        {"name": "Guest Post Outreach", "description": "Reach out for guest posting opportunities"},
        {"name": "Directory Submissions", "description": "Submit to relevant business directories"},
        {"name": "Social Bookmarking", "description": "Submit to social bookmarking sites"},
        {"name": "Forum Participation", "description": "Engage in relevant industry forums"},
        {"name": "Press Release Distribution", "description": "Distribute press releases"},
        {"name": "Influencer Outreach", "description": "Connect with industry influencers"},
        {"name": "Brand Mention Monitoring", "description": "Track and convert brand mentions to links"},
        {"name": "Broken Link Building", "description": "Find and replace broken links"},
        {"name": "Resource Page Link Building", "description": "Get listed on resource pages"},
    ],
    "backlinks": [
        {"name": "Backlink Audit", "description": "Audit existing backlink profile"},
        {"name": "Toxic Link Identification", "description": "Identify and disavow toxic links"},
        {"name": "Link Reclamation", "description": "Reclaim lost or broken backlinks"},
        {"name": "Competitor Link Analysis", "description": "Analyze top competitor backlinks"},
        {"name": "High DA Link Acquisition", "description": "Acquire links from high authority sites"},
        {"name": "Niche Edit Outreach", "description": "Outreach for niche edit placements"},
        {"name": "HARO Response", "description": "Respond to HARO queries for links"},
        {"name": "Skyscraper Content Creation", "description": "Create linkable skyscraper content"},
        {"name": "Infographic Outreach", "description": "Create and promote infographics"},
        {"name": "Monthly Backlink Report", "description": "Prepare monthly backlink report"},
    ],
    "gmb": [
        {"name": "GMB Profile Setup/Claim", "description": "Set up or claim Google My Business profile"},
        {"name": "NAP Consistency Check", "description": "Verify Name, Address, Phone consistency"},
        {"name": "GMB Category Optimization", "description": "Select optimal business categories"},
        {"name": "GMB Description Optimization", "description": "Write keyword-rich business description"},
        {"name": "Photo Upload & Optimization", "description": "Upload and optimize business photos"},
        {"name": "GMB Posts Creation", "description": "Create regular GMB posts"},
        {"name": "Review Management", "description": "Respond to customer reviews"},
        {"name": "Q&A Management", "description": "Monitor and answer GMB questions"},
        {"name": "Service/Product Listing", "description": "Add services and products to GMB"},
        {"name": "Citation Building", "description": "Build consistent local citations"},
        {"name": "Local Schema Implementation", "description": "Add LocalBusiness schema markup"},
        {"name": "GMB Insights Analysis", "description": "Analyze GMB performance metrics"},
    ],
    "other": [
        {"name": "Monthly SEO Report", "description": "Prepare comprehensive monthly report"},
        {"name": "Competitor Analysis", "description": "Detailed competitor SEO analysis"},
        {"name": "SEO Audit", "description": "Complete technical SEO audit"},
        {"name": "Content Calendar Creation", "description": "Plan content publishing schedule"},
        {"name": "Keyword Ranking Tracking", "description": "Track keyword ranking progress"},
        {"name": "Analytics Setup/Review", "description": "Set up or review Google Analytics"},
        {"name": "Search Console Setup/Review", "description": "Set up or review Search Console"},
        {"name": "Sitemap Submission", "description": "Create and submit XML sitemap"},
        {"name": "Robots.txt Optimization", "description": "Optimize robots.txt file"},
        {"name": "Client Meeting/Call", "description": "Weekly/monthly client meeting"},
    ]
}

# Task status options
TASK_STATUSES = ["todo", "in_progress", "review", "done"]

# Priority options
PRIORITIES = ["low", "medium", "high", "urgent"]

# ============== PYDANTIC MODELS ==============

class SEOClientCreate(BaseModel):
    name: str
    website: str
    contact_email: Optional[str] = ""
    contact_phone: Optional[str] = ""
    notes: Optional[str] = ""
    assigned_members: Optional[List[str]] = []

class SEOClientUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    assigned_members: Optional[List[str]] = None
    is_active: Optional[bool] = None

class SEOTaskCreate(BaseModel):
    client_id: str
    category: str  # onpage, offpage, backlinks, gmb, other
    name: str
    description: Optional[str] = ""
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = "medium"
    status: Optional[str] = "todo"

class SEOTaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None

# ============== HELPER FUNCTIONS ==============

async def get_current_user_from_request(request: Request):
    if seo_db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    session = await seo_db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await seo_db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

def check_operations_access(user):
    """Check if user has operations access"""
    role = user.get('role', 'employee')
    module_access = user.get('module_access', [])
    
    if role in ['super_admin', 'admin', 'project_manager']:
        return True
    if 'operations' in module_access:
        return True
    return False

# ============== CLIENT ROUTES ==============

@seo_board_router.get("/clients")
async def get_seo_clients(request: Request):
    """Get all SEO clients"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    clients = await seo_db.seo_clients.find(
        {"is_deleted": {"$ne": True}}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add task counts for each client
    for client in clients:
        task_counts = {}
        for status in TASK_STATUSES:
            count = await seo_db.seo_tasks.count_documents({
                "client_id": client["client_id"],
                "status": status,
                "is_deleted": {"$ne": True}
            })
            task_counts[status] = count
        client["task_counts"] = task_counts
        client["total_tasks"] = sum(task_counts.values())
    
    return clients

@seo_board_router.get("/clients/{client_id}")
async def get_seo_client(client_id: str, request: Request):
    """Get a single SEO client"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    client = await seo_db.seo_clients.find_one(
        {"client_id": client_id, "is_deleted": {"$ne": True}},
        {"_id": 0}
    )
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return client

@seo_board_router.post("/clients")
async def create_seo_client(client_data: SEOClientCreate, request: Request):
    """Create a new SEO client"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    client_id = f"seo_client_{uuid.uuid4().hex[:12]}"
    client = {
        "client_id": client_id,
        "name": client_data.name,
        "website": client_data.website,
        "contact_email": client_data.contact_email,
        "contact_phone": client_data.contact_phone,
        "notes": client_data.notes,
        "assigned_members": client_data.assigned_members,
        "is_active": True,
        "is_deleted": False,
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await seo_db.seo_clients.insert_one(client)
    return await seo_db.seo_clients.find_one({"client_id": client_id}, {"_id": 0})

@seo_board_router.put("/clients/{client_id}")
async def update_seo_client(client_id: str, update_data: SEOClientUpdate, request: Request):
    """Update an SEO client"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await seo_db.seo_clients.update_one(
        {"client_id": client_id},
        {"$set": update_dict}
    )
    
    return await seo_db.seo_clients.find_one({"client_id": client_id}, {"_id": 0})

@seo_board_router.delete("/clients/{client_id}")
async def delete_seo_client(client_id: str, request: Request):
    """Soft delete an SEO client"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    await seo_db.seo_clients.update_one(
        {"client_id": client_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Client deleted"}

# ============== TASK ROUTES ==============

@seo_board_router.get("/tasks/{client_id}")
async def get_client_tasks(client_id: str, request: Request, category: Optional[str] = None):
    """Get all tasks for a client"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    query = {"client_id": client_id, "is_deleted": {"$ne": True}}
    if category:
        query["category"] = category
    
    tasks = await seo_db.seo_tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return tasks

@seo_board_router.get("/tasks/{client_id}/grouped")
async def get_client_tasks_grouped(client_id: str, request: Request):
    """Get all tasks for a client grouped by status"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    tasks = await seo_db.seo_tasks.find(
        {"client_id": client_id, "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    # Group by status
    grouped = {status: [] for status in TASK_STATUSES}
    for task in tasks:
        status = task.get("status", "todo")
        if status in grouped:
            grouped[status].append(task)
    
    return grouped

@seo_board_router.post("/tasks")
async def create_seo_task(task_data: SEOTaskCreate, request: Request):
    """Create a new SEO task"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    task_id = f"seo_task_{uuid.uuid4().hex[:12]}"
    task = {
        "task_id": task_id,
        "client_id": task_data.client_id,
        "category": task_data.category,
        "name": task_data.name,
        "description": task_data.description,
        "assigned_to": task_data.assigned_to,
        "due_date": task_data.due_date,
        "priority": task_data.priority,
        "status": task_data.status,
        "is_deleted": False,
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await seo_db.seo_tasks.insert_one(task)
    return await seo_db.seo_tasks.find_one({"task_id": task_id}, {"_id": 0})

@seo_board_router.post("/tasks/bulk")
async def create_bulk_tasks(request: Request):
    """Create multiple tasks from templates"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    body = await request.json()
    client_id = body.get("client_id")
    category = body.get("category")
    template_names = body.get("templates", [])
    
    if not client_id or not category:
        raise HTTPException(status_code=400, detail="client_id and category required")
    
    templates = TASK_TEMPLATES.get(category, [])
    created_tasks = []
    
    for template in templates:
        if not template_names or template["name"] in template_names:
            task_id = f"seo_task_{uuid.uuid4().hex[:12]}"
            task = {
                "task_id": task_id,
                "client_id": client_id,
                "category": category,
                "name": template["name"],
                "description": template["description"],
                "assigned_to": None,
                "due_date": None,
                "priority": "medium",
                "status": "todo",
                "is_deleted": False,
                "created_by": user["user_id"],
                "created_by_name": user.get("name", "Unknown"),
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            await seo_db.seo_tasks.insert_one(task)
            created_tasks.append(task_id)
    
    return {"message": f"Created {len(created_tasks)} tasks", "task_ids": created_tasks}

@seo_board_router.put("/tasks/{task_id}")
async def update_seo_task(task_id: str, update_data: SEOTaskUpdate, request: Request):
    """Update an SEO task"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await seo_db.seo_tasks.update_one(
        {"task_id": task_id},
        {"$set": update_dict}
    )
    
    return await seo_db.seo_tasks.find_one({"task_id": task_id}, {"_id": 0})

@seo_board_router.put("/tasks/{task_id}/status")
async def update_task_status(task_id: str, request: Request):
    """Update task status (for drag & drop)"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    body = await request.json()
    new_status = body.get("status")
    
    if new_status not in TASK_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    await seo_db.seo_tasks.update_one(
        {"task_id": task_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Status updated", "status": new_status}

@seo_board_router.delete("/tasks/{task_id}")
async def delete_seo_task(task_id: str, request: Request):
    """Soft delete an SEO task"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    await seo_db.seo_tasks.update_one(
        {"task_id": task_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Task deleted"}

# ============== TEMPLATE & CONFIG ROUTES ==============

@seo_board_router.get("/templates")
async def get_task_templates(request: Request):
    """Get all predefined task templates"""
    await get_current_user_from_request(request)
    return TASK_TEMPLATES

@seo_board_router.get("/templates/{category}")
async def get_category_templates(category: str, request: Request):
    """Get task templates for a specific category"""
    await get_current_user_from_request(request)
    
    if category not in TASK_TEMPLATES:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return TASK_TEMPLATES[category]

@seo_board_router.get("/config")
async def get_seo_config(request: Request):
    """Get SEO board configuration"""
    await get_current_user_from_request(request)
    
    return {
        "categories": {
            "onpage": {"name": "On-Page SEO", "color": "#22c55e", "icon": "FileText"},
            "offpage": {"name": "Off-Page SEO", "color": "#3b82f6", "icon": "ExternalLink"},
            "backlinks": {"name": "Backlinks", "color": "#8b5cf6", "icon": "Link"},
            "gmb": {"name": "GMB", "color": "#f59e0b", "icon": "MapPin"},
            "other": {"name": "Other Work", "color": "#6366f1", "icon": "MoreHorizontal"}
        },
        "statuses": TASK_STATUSES,
        "priorities": PRIORITIES,
        "status_colors": {
            "todo": "#71717a",
            "in_progress": "#3b82f6",
            "review": "#f59e0b",
            "done": "#22c55e"
        }
    }

# ============== STATS ROUTES ==============

@seo_board_router.get("/stats")
async def get_seo_stats(request: Request):
    """Get overall SEO board statistics"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    total_clients = await seo_db.seo_clients.count_documents({"is_deleted": {"$ne": True}})
    active_clients = await seo_db.seo_clients.count_documents({"is_deleted": {"$ne": True}, "is_active": True})
    
    total_tasks = await seo_db.seo_tasks.count_documents({"is_deleted": {"$ne": True}})
    
    tasks_by_status = {}
    for status in TASK_STATUSES:
        count = await seo_db.seo_tasks.count_documents({"status": status, "is_deleted": {"$ne": True}})
        tasks_by_status[status] = count
    
    tasks_by_category = {}
    for category in TASK_TEMPLATES.keys():
        count = await seo_db.seo_tasks.count_documents({"category": category, "is_deleted": {"$ne": True}})
        tasks_by_category[category] = count
    
    return {
        "total_clients": total_clients,
        "active_clients": active_clients,
        "total_tasks": total_tasks,
        "tasks_by_status": tasks_by_status,
        "tasks_by_category": tasks_by_category
    }

@seo_board_router.get("/team-members")
async def get_team_members(request: Request):
    """Get team members with operations access for assignment"""
    user = await get_current_user_from_request(request)
    
    if not check_operations_access(user):
        raise HTTPException(status_code=403, detail="Operations access required")
    
    # Get users with operations access
    users = await seo_db.users.find(
        {
            "$or": [
                {"role": {"$in": ["super_admin", "admin", "project_manager"]}},
                {"module_access": "operations"}
            ]
        },
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1}
    ).to_list(100)
    
    return users
