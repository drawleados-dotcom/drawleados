from fastapi import APIRouter, HTTPException, Request
from operations_models import *
from datetime import datetime, timezone, timedelta
import uuid
from typing import List, Optional

operations_router = APIRouter(prefix="/operations")
db = None

def init_operations_db(database):
    global db
    db = database

async def get_current_user_from_request(request: Request) -> dict:
    """Get current user from session token in request"""
    session_token = None
    
    # Check cookie first
    if "session_token" in request.cookies:
        session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user_doc

# ============== HELPER FUNCTIONS ==============

async def enrich_project(project_doc: Dict) -> Dict:
    """Enrich project with related data"""
    # Get client details
    if project_doc.get("client_id"):
        client = await db.leads.find_one({"lead_id": project_doc["client_id"]}, {"_id": 0})
        if client:
            project_doc["client_name"] = client.get("name", "Unknown Client")
    
    # Get service details
    if project_doc.get("service_id"):
        service = await db.services.find_one({"service_id": project_doc["service_id"]}, {"_id": 0})
        if service:
            project_doc["service_name"] = service.get("name", "Unknown Service")
    
    # Get PM details
    if project_doc.get("assigned_pm"):
        pm = await db.users.find_one({"user_id": project_doc["assigned_pm"]}, {"_id": 0})
        if pm:
            project_doc["assigned_pm_name"] = pm.get("name", "Unknown PM")
    
    # Calculate progress
    tasks = await db.tasks.find({"project_id": project_doc["project_id"], "is_deleted": False}, {"_id": 0}).to_list(1000)
    if tasks:
        total_tasks = len(tasks)
        completed_tasks = len([t for t in tasks if t.get("status") == "completed"])
        project_doc["progress_percent"] = int((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0
        project_doc["actual_hours"] = sum(t.get("actual_time", 0) for t in tasks)
    
    return project_doc

async def enrich_task(task_doc: Dict) -> Dict:
    """Enrich task with related data"""
    # Get project details
    if task_doc.get("project_id"):
        project = await db.projects.find_one({"project_id": task_doc["project_id"]}, {"_id": 0})
        if project:
            task_doc["project_name"] = project.get("project_name", "Unknown Project")
            task_doc["client_id"] = project.get("client_id", "")
            task_doc["client_name"] = project.get("client_name", "Unknown Client")
            task_doc["service_type"] = project.get("service_type", "")
    
    # Get assigned user details
    if task_doc.get("assigned_to"):
        user = await db.users.find_one({"user_id": task_doc["assigned_to"]}, {"_id": 0})
        if user:
            task_doc["assigned_to_name"] = user.get("name", "Unknown User")
    
    # Get assigned by details
    if task_doc.get("assigned_by"):
        user = await db.users.find_one({"user_id": task_doc["assigned_by"]}, {"_id": 0})
        if user:
            task_doc["assigned_by_name"] = user.get("name", "Unknown User")
    
    # Calculate delay
    if task_doc.get("due_date") and task_doc.get("status") != "completed":
        due_date = task_doc["due_date"]
        if isinstance(due_date, str):
            due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        if now > due_date:
            delay = (now - due_date).total_seconds() / 3600
            task_doc["delay_hours"] = round(delay, 2)
    
    # Calculate actual time from time entries
    time_entries = await db.time_entries.find({"task_id": task_doc["task_id"]}, {"_id": 0}).to_list(1000)
    total_time = sum(entry.get("duration_hours", 0) for entry in time_entries)
    task_doc["actual_time"] = round(total_time, 2)
    
    return task_doc

# ============== PROJECT ROUTES ==============

@operations_router.post("/projects")
async def create_project(project_data: ProjectCreate, request: Request):
    """Create a new project"""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user["user_id"]
        
        # Get client details
        client = await db.leads.find_one({"lead_id": project_data.client_id}, {"_id": 0})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Get service details
        service = await db.services.find_one({"service_id": project_data.service_id}, {"_id": 0})
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Get PM details
        pm = await db.users.find_one({"user_id": project_data.assigned_pm}, {"_id": 0})
        if not pm:
            raise HTTPException(status_code=404, detail="Project Manager not found")
        
        # Determine service type
        service_type_map = {
            "Website Development": "website",
            "Shopify Stores": "shopify",
            "SEO Services": "performance_marketing",
            "Social Media Marketing": "social_media",
            "WhatsApp Marketing": "whatsapp"
        }
        service_type = service_type_map.get(service["name"], "other")
        
        project_id = f"proj_{uuid.uuid4().hex[:12]}"
        project_doc = {
            "project_id": project_id,
            **project_data.model_dump(),
            "client_name": client["name"],
            "service_name": service["name"],
            "service_type": service_type,
            "assigned_pm_name": pm["name"],
            "progress_percent": 0,
            "actual_hours": 0.0,
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_deleted": False
        }
        
        await db.projects.insert_one(project_doc)
        
        result = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
        return await enrich_project(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@operations_router.get("/projects")
async def get_projects(
    service_type: Optional[str] = None,
    status: Optional[str] = None,
    assigned_pm: Optional[str] = None,
    client_id: Optional[str] = None
):
    """Get all projects with filters"""
    query = {"is_deleted": False}
    
    if service_type:
        query["service_type"] = service_type
    if status:
        query["status"] = status
    if assigned_pm:
        query["assigned_pm"] = assigned_pm
    if client_id:
        query["client_id"] = client_id
    
    projects = await db.projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    enriched = []
    for project in projects:
        enriched.append(await enrich_project(project))
    
    return enriched

@operations_router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Get single project"""
    project = await db.projects.find_one({"project_id": project_id, "is_deleted": False}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return await enrich_project(project)

@operations_router.put("/projects/{project_id}")
async def update_project(project_id: str, update_data: Dict[str, Any]):
    """Update project"""
    project = await db.projects.find_one({"project_id": project_id, "is_deleted": False})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    # If status changed to completed, set completion date
    if update_data.get("status") == "completed" and project.get("status") != "completed":
        update_data["completion_date"] = datetime.now(timezone.utc)
    
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": update_data}
    )
    
    result = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return await enrich_project(result)

@operations_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Soft delete project"""
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"is_deleted": True}}
    )
    return {"message": "Project deleted"}

# ============== TASK ROUTES ==============

@operations_router.post("/tasks")
async def create_task(task_data: TaskCreate, request: Request):
    """Create a new task"""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user["user_id"]
        
        # Get project details
        project = await db.projects.find_one({"project_id": task_data.project_id}, {"_id": 0})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get assigned user
        assigned_user = await db.users.find_one({"user_id": task_data.assigned_to}, {"_id": 0})
        if not assigned_user:
            raise HTTPException(status_code=404, detail="Assigned user not found")
        
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        task_doc = {
            "task_id": task_id,
            **task_data.model_dump(),
            "project_name": project["project_name"],
            "client_id": project["client_id"],
            "client_name": project.get("client_name", "Unknown"),
            "service_type": project.get("service_type", "other"),
            "assigned_to_name": assigned_user["name"],
            "assigned_by": user_id,
            "assigned_by_name": current_user.get("name", "Unknown"),
            "actual_time": 0.0,
            "delay_hours": 0.0,
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_deleted": False
        }
        
        await db.tasks.insert_one(task_doc)
        
        # Create history entry
        history_doc = {
            "history_id": f"hist_{uuid.uuid4().hex[:12]}",
            "task_id": task_id,
            "user_id": user_id,
            "user_name": current_user.get("name", "Unknown"),
            "action": "created",
            "timestamp": datetime.now(timezone.utc)
        }
        await db.task_history.insert_one(history_doc)
        
        result = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
        return await enrich_task(result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@operations_router.get("/tasks")
async def get_tasks(
    project_id: Optional[str] = None,
    service_type: Optional[str] = None,
    assigned_to: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    overdue: Optional[bool] = None
):
    """Get all tasks with filters"""
    query = {"is_deleted": False}
    
    if project_id:
        query["project_id"] = project_id
    if service_type:
        query["service_type"] = service_type
    if assigned_to:
        query["assigned_to"] = assigned_to
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(1000)
    
    # Filter overdue if requested
    if overdue:
        now = datetime.now(timezone.utc)
        tasks = [t for t in tasks if t.get("due_date") and datetime.fromisoformat(str(t["due_date"]).replace('Z', '+00:00')) < now and t.get("status") != "completed"]
    
    enriched = []
    for task in tasks:
        enriched.append(await enrich_task(task))
    
    return enriched

@operations_router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """Get single task with all details"""
    task = await db.tasks.find_one({"task_id": task_id, "is_deleted": False}, {"_id": 0})
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = await enrich_task(task)
    
    # Get subtasks
    subtasks = await db.subtasks.find({"task_id": task_id}, {"_id": 0}).to_list(100)
    task["subtasks"] = subtasks
    
    # Get comments
    comments = await db.task_comments.find({"task_id": task_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    task["comments"] = comments
    
    # Get time entries
    time_entries = await db.time_entries.find({"task_id": task_id}, {"_id": 0}).sort("start_time", -1).to_list(100)
    task["time_entries"] = time_entries
    
    # Get history
    history = await db.task_history.find({"task_id": task_id}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    task["history"] = history
    
    return task

@operations_router.put("/tasks/{task_id}")
async def update_task(task_id: str, update_data: TaskUpdate, request: Request):
    """Update task"""
    current_user = await get_current_user_from_request(request)
    user_id = current_user["user_id"]
    
    task = await db.tasks.find_one({"task_id": task_id, "is_deleted": False})
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    # Track status change
    if "status" in update_dict and update_dict["status"] != task.get("status"):
        # If completed, set completion date
        if update_dict["status"] == "completed":
            update_dict["completion_date"] = datetime.now(timezone.utc)
        
        # Create history entry
        history_doc = {
            "history_id": f"hist_{uuid.uuid4().hex[:12]}",
            "task_id": task_id,
            "user_id": user_id,
            "user_name": current_user.get("name", "Unknown"),
            "action": "status_changed",
            "old_value": task.get("status"),
            "new_value": update_dict["status"],
            "timestamp": datetime.now(timezone.utc)
        }
        await db.task_history.insert_one(history_doc)
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": update_dict}
    )
    
    result = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    return await enrich_task(result)

@operations_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    """Soft delete task"""
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {"is_deleted": True}}
    )
    return {"message": "Task deleted"}

# ============== SUBTASK ROUTES ==============

@operations_router.post("/subtasks")
async def create_subtask(subtask_data: SubtaskCreate):
    """Create subtask"""
    subtask_id = f"subtask_{uuid.uuid4().hex[:12]}"
    subtask_doc = {
        "subtask_id": subtask_id,
        **subtask_data.model_dump(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "completed_at": None
    }
    
    await db.subtasks.insert_one(subtask_doc)
    
    return await db.subtasks.find_one({"subtask_id": subtask_id}, {"_id": 0})

@operations_router.put("/subtasks/{subtask_id}")
async def update_subtask(subtask_id: str, status: str):
    """Update subtask status"""
    update_data = {"status": status}
    if status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc)
    
    await db.subtasks.update_one(
        {"subtask_id": subtask_id},
        {"$set": update_data}
    )
    
    return await db.subtasks.find_one({"subtask_id": subtask_id}, {"_id": 0})

# ============== COMMENT ROUTES ==============

@operations_router.post("/comments")
async def create_comment(comment_data: TaskCommentCreate):
    """Add comment to task"""
    user_id = "admin"  # TODO: Get from auth
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    comment_id = f"comment_{uuid.uuid4().hex[:12]}"
    comment_doc = {
        "comment_id": comment_id,
        **comment_data.model_dump(),
        "user_id": user_id,
        "user_name": user.get("name", "Unknown") if user else "Unknown",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.task_comments.insert_one(comment_doc)
    
    # Create history entry
    history_doc = {
        "history_id": f"hist_{uuid.uuid4().hex[:12]}",
        "task_id": comment_data.task_id,
        "user_id": user_id,
        "user_name": user.get("name", "Unknown") if user else "Unknown",
        "action": "commented",
        "timestamp": datetime.now(timezone.utc)
    }
    await db.task_history.insert_one(history_doc)
    
    return await db.task_comments.find_one({"comment_id": comment_id}, {"_id": 0})

# ============== TIME TRACKING ROUTES ==============

@operations_router.post("/time/start")
async def start_timer(time_data: TimeEntryStart):
    """Start time tracking for a task"""
    user_id = "admin"  # TODO: Get from auth
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    # Check if there's already a running timer for this user
    running = await db.time_entries.find_one({"user_id": user_id, "is_running": True}, {"_id": 0})
    if running:
        raise HTTPException(status_code=400, detail="You already have a running timer. Stop it first.")
    
    entry_id = f"time_{uuid.uuid4().hex[:12]}"
    entry_doc = {
        "entry_id": entry_id,
        **time_data.model_dump(),
        "user_id": user_id,
        "user_name": user.get("name", "Unknown") if user else "Unknown",
        "start_time": datetime.now(timezone.utc),
        "end_time": None,
        "duration_hours": 0.0,
        "is_running": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.time_entries.insert_one(entry_doc)
    
    return await db.time_entries.find_one({"entry_id": entry_id}, {"_id": 0})

@operations_router.post("/time/stop")
async def stop_timer(time_data: TimeEntryStop):
    """Stop time tracking"""
    entry = await db.time_entries.find_one({"entry_id": time_data.entry_id}, {"_id": 0})
    
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    if not entry.get("is_running"):
        raise HTTPException(status_code=400, detail="Timer is not running")
    
    end_time = datetime.now(timezone.utc)
    start_time = entry["start_time"]
    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    
    duration = (end_time - start_time).total_seconds() / 3600
    
    await db.time_entries.update_one(
        {"entry_id": time_data.entry_id},
        {"$set": {
            "end_time": end_time,
            "duration_hours": round(duration, 2),
            "is_running": False
        }}
    )
    
    return await db.time_entries.find_one({"entry_id": time_data.entry_id}, {"_id": 0})

@operations_router.get("/time/running")
async def get_running_timer():
    """Get current running timer for user"""
    user_id = "admin"  # TODO: Get from auth
    
    running = await db.time_entries.find_one({"user_id": user_id, "is_running": True}, {"_id": 0})
    
    if not running:
        return None
    
    return running

# ============== PRODUCTIVITY ROUTES ==============

@operations_router.get("/productivity/stats")
async def get_productivity_stats(user_id: Optional[str] = None, from_date: Optional[str] = None):
    """Get productivity statistics"""
    query = {"is_deleted": False}
    
    if user_id:
        query["assigned_to"] = user_id
    
    if from_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(from_date)}
    
    tasks = await db.tasks.find(query, {"_id": 0}).to_list(10000)
    
    # Group by user
    user_stats = {}
    for task in tasks:
        uid = task.get("assigned_to")
        if uid not in user_stats:
            user_stats[uid] = {
                "user_id": uid,
                "user_name": task.get("assigned_to_name", "Unknown"),
                "total_tasks": 0,
                "completed_tasks": 0,
                "in_progress_tasks": 0,
                "overdue_tasks": 0,
                "on_time_completed": 0,
                "delayed_completed": 0,
                "total_hours_logged": 0.0
            }
        
        stats = user_stats[uid]
        stats["total_tasks"] += 1
        
        if task.get("status") == "completed":
            stats["completed_tasks"] += 1
            # Check if completed on time
            if task.get("completion_date") and task.get("due_date"):
                comp_date = task["completion_date"]
                due_date = task["due_date"]
                if isinstance(comp_date, str):
                    comp_date = datetime.fromisoformat(comp_date.replace('Z', '+00:00'))
                if isinstance(due_date, str):
                    due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
                if comp_date <= due_date:
                    stats["on_time_completed"] += 1
                else:
                    stats["delayed_completed"] += 1
        elif task.get("status") == "in_progress":
            stats["in_progress_tasks"] += 1
        
        # Check if overdue
        if task.get("due_date") and task.get("status") != "completed":
            due_date = task["due_date"]
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > due_date:
                stats["overdue_tasks"] += 1
        
        stats["total_hours_logged"] += task.get("actual_time", 0.0)
    
    # Calculate rates
    for stats in user_stats.values():
        if stats["completed_tasks"] > 0:
            stats["on_time_completion_rate"] = round((stats["on_time_completed"] / stats["completed_tasks"]) * 100, 2)
        else:
            stats["on_time_completion_rate"] = 0.0
        
        if stats["completed_tasks"] > 0:
            stats["avg_completion_time"] = round(stats["total_hours_logged"] / stats["completed_tasks"], 2)
        else:
            stats["avg_completion_time"] = 0.0
    
    return list(user_stats.values())

@operations_router.get("/productivity/overview")
async def get_productivity_overview():
    """Get overall productivity metrics"""
    total_projects = await db.projects.count_documents({"is_deleted": False})
    active_projects = await db.projects.count_documents({"is_deleted": False, "status": {"$in": ["in_progress", "waiting_client", "review"]}})
    completed_projects = await db.projects.count_documents({"is_deleted": False, "status": "completed"})
    
    total_tasks = await db.tasks.count_documents({"is_deleted": False})
    completed_tasks = await db.tasks.count_documents({"is_deleted": False, "status": "completed"})
    in_progress_tasks = await db.tasks.count_documents({"is_deleted": False, "status": "in_progress"})
    
    # Overdue tasks
    now = datetime.now(timezone.utc)
    all_tasks = await db.tasks.find({"is_deleted": False, "status": {"$ne": "completed"}}, {"_id": 0, "due_date": 1}).to_list(10000)
    overdue_count = 0
    for task in all_tasks:
        if task.get("due_date"):
            due_date = task["due_date"]
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            if now > due_date:
                overdue_count += 1
    
    return {
        "total_projects": total_projects,
        "active_projects": active_projects,
        "completed_projects": completed_projects,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "in_progress_tasks": in_progress_tasks,
        "overdue_tasks": overdue_count,
        "completion_rate": round((completed_tasks / total_tasks * 100), 2) if total_tasks > 0 else 0.0
    }
