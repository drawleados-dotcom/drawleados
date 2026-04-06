"""
Additional Tasks Routes - For general tasks not tied to specific project pages
"""
from fastapi import APIRouter, HTTPException, Request, Body
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

additional_tasks_router = APIRouter(prefix="/additional-tasks", tags=["Additional Tasks"])

# Database reference will be set from server.py
db = None

def init_additional_tasks_db(database):
    global db
    db = database

async def get_current_user(request: Request) -> dict:
    """Get current user from session token in request"""
    session_token = None
    
    if "session_token" in request.cookies:
        session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user_doc


class AdditionalTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: Optional[str] = None  # Optional link to project
    assignee: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "medium"  # low, medium, high, urgent
    status: str = "To-Do"  # To-Do, In Progress, Completed, Paused
    category: Optional[str] = None  # General, Meeting, Follow-up, etc.
    tags: Optional[List[str]] = []
    type: Optional[str] = "general"  # general, bug, feature, content, design
    work_link: Optional[str] = None  # Link to work/doc


class AdditionalTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[str] = None
    assignee: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    time_spent: Optional[int] = None  # in seconds
    type: Optional[str] = None  # general, bug, feature, content, design
    work_link: Optional[str] = None  # Link to work/doc


@additional_tasks_router.get("/")
async def get_all_additional_tasks(request: Request):
    """Get all additional tasks"""
    user = await get_current_user(request)
    
    tasks = await db.additional_tasks.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=500)
    
    return tasks


@additional_tasks_router.get("/my-tasks")
async def get_my_additional_tasks(request: Request):
    """Get tasks assigned to current user"""
    user = await get_current_user(request)
    
    tasks = await db.additional_tasks.find(
        {"$or": [
            {"assignee_id": user["user_id"]},
            {"created_by": user["user_id"]}
        ]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=500)
    
    return tasks


@additional_tasks_router.post("/")
async def create_additional_task(request: Request, task_data: AdditionalTaskCreate):
    """Create a new additional task"""
    user = await get_current_user(request)
    
    task_id = f"adtask_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    task = {
        "task_id": task_id,
        "title": task_data.title,
        "description": task_data.description,
        "project_id": task_data.project_id,
        "assignee": task_data.assignee,
        "assignee_id": task_data.assignee_id,
        "due_date": task_data.due_date,
        "priority": task_data.priority,
        "status": task_data.status,
        "category": task_data.category,
        "tags": task_data.tags or [],
        "type": task_data.type or "general",
        "work_link": task_data.work_link,
        "time_spent": 0,
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.additional_tasks.insert_one(task)
    
    # Return without _id
    task.pop("_id", None)
    return {"success": True, "task": task}


@additional_tasks_router.put("/{task_id}")
async def update_additional_task(request: Request, task_id: str, task_data: AdditionalTaskUpdate):
    """Update an additional task"""
    user = await get_current_user(request)
    
    task = await db.additional_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {k: v for k, v in task_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.additional_tasks.update_one(
        {"task_id": task_id},
        {"$set": update_data}
    )
    
    updated = await db.additional_tasks.find_one({"task_id": task_id}, {"_id": 0})
    return {"success": True, "task": updated}


@additional_tasks_router.put("/{task_id}/status")
async def update_task_status(request: Request, task_id: str, data: dict = Body(...)):
    """Quick update task status"""
    user = await get_current_user(request)
    
    status = data.get("status")
    if status not in ["To-Do", "In Progress", "Completed", "Paused"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.additional_tasks.update_one(
        {"task_id": task_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"success": True, "status": status}


@additional_tasks_router.put("/{task_id}/add-time")
async def add_time_to_task(request: Request, task_id: str, data: dict = Body(...)):
    """Add time spent to task"""
    user = await get_current_user(request)
    
    seconds = data.get("seconds", 0)
    
    task = await db.additional_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    current_time = task.get("time_spent", 0) or 0
    new_time = current_time + seconds
    
    await db.additional_tasks.update_one(
        {"task_id": task_id},
        {"$set": {"time_spent": new_time, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "total_time": new_time}


@additional_tasks_router.delete("/{task_id}")
async def delete_additional_task(request: Request, task_id: str):
    """Delete an additional task"""
    user = await get_current_user(request)
    
    result = await db.additional_tasks.delete_one({"task_id": task_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"success": True, "message": "Task deleted"}
