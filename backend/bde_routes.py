"""
BDE Tasks Routes - Task management for Business Development
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

bde_router = APIRouter(prefix="/bde", tags=["BDE Tasks"])

# Models
class TaskCreate(BaseModel):
    task_name: str
    description: Optional[str] = ""
    priority: str = "medium"  # high, medium, low
    type: str = "general"  # general, follow_up, meeting, proposal, call
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    status: str = "pending"  # pending, in_progress, completed, on_hold

class TaskUpdate(BaseModel):
    task_name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    type: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str

class TimeTrackingAction(BaseModel):
    action: str  # start, pause, resume, finish

# Dependency to get DB
async def get_db():
    from server import db
    return db

# Get all tasks (visible to user based on role)
@bde_router.get("/tasks")
async def get_tasks(request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        # Super admin and admins see all tasks
        if user.role in ["super_admin", "admin"]:
            tasks = await db.bde_tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
        else:
            # Others see tasks they created or are assigned to
            tasks = await db.bde_tasks.find({
                "$or": [
                    {"created_by": user.user_id},
                    {"assigned_to": user.user_id}
                ]
            }, {"_id": 0}).sort("created_at", -1).to_list(1000)
        
        # Add assigned user names
        for task in tasks:
            if task.get("assigned_to"):
                assigned_user = await db.users.find_one(
                    {"user_id": task["assigned_to"]}, 
                    {"name": 1, "_id": 0}
                )
                task["assigned_to_name"] = assigned_user.get("name") if assigned_user else "Unknown"
            else:
                task["assigned_to_name"] = None
                
            if task.get("created_by"):
                creator = await db.users.find_one(
                    {"user_id": task["created_by"]}, 
                    {"name": 1, "_id": 0}
                )
                task["created_by_name"] = creator.get("name") if creator else "Unknown"
        
        return tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Create task
@bde_router.post("/tasks")
async def create_task(data: TaskCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        
        task = {
            "task_id": task_id,
            "task_name": data.task_name,
            "description": data.description or "",
            "priority": data.priority,
            "type": data.type,
            "assigned_to": data.assigned_to,
            "due_date": data.due_date,
            "status": data.status,
            "created_by": user.user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            # Time tracking fields
            "time_tracking": {
                "status": "not_started",  # not_started, running, paused, finished
                "total_seconds": 0,
                "sessions": [],  # List of {start, end, duration_seconds}
                "current_session_start": None
            }
        }
        
        await db.bde_tasks.insert_one(task)
        del task["_id"]
        
        return {"message": "Task created successfully", "task": task}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Update task
@bde_router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        existing = await db.bde_tasks.find_one({"task_id": task_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Only creator, assigned user, or admin can update
        if existing["created_by"] != user.user_id and existing.get("assigned_to") != user.user_id and user.role not in ["super_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized to update this task")
        
        update_data = {}
        if data.task_name is not None:
            update_data["task_name"] = data.task_name
        if data.description is not None:
            update_data["description"] = data.description
        if data.priority is not None:
            update_data["priority"] = data.priority
        if data.type is not None:
            update_data["type"] = data.type
        if data.assigned_to is not None:
            update_data["assigned_to"] = data.assigned_to
        if data.due_date is not None:
            update_data["due_date"] = data.due_date
        if data.status is not None:
            update_data["status"] = data.status
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.bde_tasks.update_one(
            {"task_id": task_id},
            {"$set": update_data}
        )
        
        updated = await db.bde_tasks.find_one({"task_id": task_id}, {"_id": 0})
        return {"message": "Task updated successfully", "task": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Update task status only
@bde_router.patch("/tasks/{task_id}/status")
async def update_task_status(task_id: str, data: StatusUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)  # Verify authentication
    
    try:
        existing = await db.bde_tasks.find_one({"task_id": task_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Task not found")
        
        await db.bde_tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "status": data.status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Status updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Delete task
@bde_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        existing = await db.bde_tasks.find_one({"task_id": task_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Only creator or admin can delete
        if existing["created_by"] != user.user_id and user.role not in ["super_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized to delete this task")
        
        await db.bde_tasks.delete_one({"task_id": task_id})
        return {"message": "Task deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Time tracking actions (start, pause, resume, finish)
@bde_router.post("/tasks/{task_id}/time-tracking")
async def track_time(task_id: str, data: TimeTrackingAction, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        task = await db.bde_tasks.find_one({"task_id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Initialize time_tracking if not exists (for old tasks)
        if "time_tracking" not in task:
            task["time_tracking"] = {
                "status": "not_started",
                "total_seconds": 0,
                "sessions": [],
                "current_session_start": None
            }
        
        time_tracking = task["time_tracking"]
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        action = data.action.lower()
        
        if action == "start":
            if time_tracking["status"] == "running":
                raise HTTPException(status_code=400, detail="Task timer is already running")
            time_tracking["status"] = "running"
            time_tracking["current_session_start"] = now_iso
            
        elif action == "pause":
            if time_tracking["status"] != "running":
                raise HTTPException(status_code=400, detail="Task timer is not running")
            
            # Calculate session duration
            start_time = datetime.fromisoformat(time_tracking["current_session_start"].replace('Z', '+00:00'))
            duration_seconds = int((now - start_time).total_seconds())
            
            # Add session
            time_tracking["sessions"].append({
                "start": time_tracking["current_session_start"],
                "end": now_iso,
                "duration_seconds": duration_seconds,
                "user_id": user.user_id
            })
            
            time_tracking["total_seconds"] += duration_seconds
            time_tracking["status"] = "paused"
            time_tracking["current_session_start"] = None
            
        elif action == "resume":
            if time_tracking["status"] not in ["paused", "not_started"]:
                raise HTTPException(status_code=400, detail="Cannot resume - task is not paused")
            time_tracking["status"] = "running"
            time_tracking["current_session_start"] = now_iso
            
        elif action == "finish":
            # If running, close current session first
            if time_tracking["status"] == "running" and time_tracking["current_session_start"]:
                start_time = datetime.fromisoformat(time_tracking["current_session_start"].replace('Z', '+00:00'))
                duration_seconds = int((now - start_time).total_seconds())
                
                time_tracking["sessions"].append({
                    "start": time_tracking["current_session_start"],
                    "end": now_iso,
                    "duration_seconds": duration_seconds,
                    "user_id": user.user_id
                })
                time_tracking["total_seconds"] += duration_seconds
            
            time_tracking["status"] = "finished"
            time_tracking["current_session_start"] = None
            time_tracking["finished_at"] = now_iso
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Use: start, pause, resume, finish")
        
        # Update task
        await db.bde_tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "time_tracking": time_tracking,
                "updated_at": now_iso,
                "status": "completed" if action == "finish" else ("in_progress" if action in ["start", "resume"] else task.get("status", "pending"))
            }}
        )
        
        # Format response
        hours = time_tracking["total_seconds"] // 3600
        minutes = (time_tracking["total_seconds"] % 3600) // 60
        
        return {
            "message": f"Timer {action}d successfully",
            "time_tracking": time_tracking,
            "total_time_formatted": f"{hours}h {minutes}m"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get task time tracking details
@bde_router.get("/tasks/{task_id}/time-tracking")
async def get_time_tracking(task_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    
    try:
        task = await db.bde_tasks.find_one({"task_id": task_id}, {"_id": 0})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        time_tracking = task.get("time_tracking", {
            "status": "not_started",
            "total_seconds": 0,
            "sessions": [],
            "current_session_start": None
        })
        
        # Calculate current running time if active
        current_running_seconds = 0
        if time_tracking["status"] == "running" and time_tracking.get("current_session_start"):
            start_time = datetime.fromisoformat(time_tracking["current_session_start"].replace('Z', '+00:00'))
            current_running_seconds = int((datetime.now(timezone.utc) - start_time).total_seconds())
        
        total_with_current = time_tracking["total_seconds"] + current_running_seconds
        hours = total_with_current // 3600
        minutes = (total_with_current % 3600) // 60
        seconds = total_with_current % 60
        
        return {
            "task_id": task_id,
            "task_name": task.get("task_name"),
            "time_tracking": time_tracking,
            "current_running_seconds": current_running_seconds,
            "total_seconds": total_with_current,
            "total_time_formatted": f"{hours}h {minutes}m {seconds}s"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
