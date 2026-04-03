"""
Our Tasks Routes - Team-wide task management for all users
Similar to BDE Tasks but accessible to all team members
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid

our_tasks_router = APIRouter(prefix="/our-tasks", tags=["Our Tasks"])

# Models
class CustomRecurrence(BaseModel):
    repeat_every: int = 1
    repeat_unit: str = "week"  # day, week, month, year
    repeat_on_days: List[int] = []  # 0-6 for Sun-Sat
    ends: str = "never"  # never, on_date, after_occurrences
    end_date: Optional[str] = None
    occurrences: int = 13

class TaskCreate(BaseModel):
    task_name: str
    description: Optional[str] = ""
    priority: str = "medium"  # high, medium, low
    type: str = "general"  # general, follow_up, meeting, proposal, call
    assigned_to: Optional[str] = None
    assigned_by: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    all_day: bool = False
    recurrence: str = "none"  # none, daily, weekly, monthly, yearly, weekdays, custom
    custom_recurrence: Optional[CustomRecurrence] = None
    status: str = "pending"  # pending, in_progress, completed, on_hold
    work_link: Optional[str] = None  # Link to work file/project

class TaskUpdate(BaseModel):
    task_name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    type: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_by: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    all_day: Optional[bool] = None
    recurrence: Optional[str] = None
    custom_recurrence: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    work_link: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str

class TimeTrackingAction(BaseModel):
    action: str  # start, pause, resume, finish


# Helper function to check if a task should appear on a specific date based on recurrence
def task_occurs_on_date(task: dict, check_date: str) -> bool:
    """Check if a recurring task occurs on the given date"""
    recurrence = task.get("recurrence", "none")
    if recurrence == "none":
        return task.get("due_date") == check_date
    
    start_date_str = task.get("due_date")
    if not start_date_str:
        return False
    
    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        target_date = datetime.strptime(check_date, "%Y-%m-%d")
        
        # Task hasn't started yet
        if target_date < start_date:
            return False
        
        # Check end conditions
        custom_rec = task.get("custom_recurrence", {})
        ends = custom_rec.get("ends", "never") if recurrence == "custom" else "never"
        
        if ends == "on_date":
            end_date_str = custom_rec.get("end_date")
            if end_date_str:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
                if target_date > end_date:
                    return False
        
        day_of_week = target_date.weekday()  # 0=Monday, 6=Sunday
        # Convert to Sunday=0 format
        day_of_week_sun = (day_of_week + 1) % 7
        
        if recurrence == "daily":
            return True
        
        elif recurrence == "weekly":
            # Same day of week as start date
            return start_date.weekday() == target_date.weekday()
        
        elif recurrence == "monthly":
            # Same day of month
            return start_date.day == target_date.day
        
        elif recurrence == "yearly":
            # Same month and day
            return start_date.month == target_date.month and start_date.day == target_date.day
        
        elif recurrence == "weekdays":
            # Monday to Friday (weekday 0-4)
            return target_date.weekday() < 5
        
        elif recurrence == "custom":
            repeat_unit = custom_rec.get("repeat_unit", "week")
            repeat_every = custom_rec.get("repeat_every", 1)
            repeat_on_days = custom_rec.get("repeat_on_days", [])
            
            if repeat_unit == "day":
                days_diff = (target_date - start_date).days
                return days_diff >= 0 and days_diff % repeat_every == 0
            
            elif repeat_unit == "week":
                # Check if day of week matches
                if repeat_on_days:
                    if day_of_week_sun not in repeat_on_days:
                        return False
                
                # Check week interval
                weeks_diff = (target_date - start_date).days // 7
                if repeat_every > 1:
                    # Find start of week for both dates
                    start_week = start_date - timedelta(days=start_date.weekday())
                    target_week = target_date - timedelta(days=target_date.weekday())
                    weeks_diff = (target_week - start_week).days // 7
                    return weeks_diff % repeat_every == 0
                return True
            
            elif repeat_unit == "month":
                months_diff = (target_date.year - start_date.year) * 12 + (target_date.month - start_date.month)
                return months_diff >= 0 and months_diff % repeat_every == 0 and start_date.day == target_date.day
            
            elif repeat_unit == "year":
                years_diff = target_date.year - start_date.year
                return years_diff >= 0 and years_diff % repeat_every == 0 and start_date.month == target_date.month and start_date.day == target_date.day
        
        return False
    except Exception:
        return False

def get_recurrence_label(task: dict) -> str:
    """Get a human-readable label for the recurrence pattern"""
    recurrence = task.get("recurrence", "none")
    if recurrence == "none":
        return "One-time"
    elif recurrence == "daily":
        return "Daily"
    elif recurrence == "weekly":
        return "Weekly"
    elif recurrence == "monthly":
        return "Monthly"
    elif recurrence == "yearly":
        return "Yearly"
    elif recurrence == "weekdays":
        return "Weekdays (Mon-Fri)"
    elif recurrence == "custom":
        custom_rec = task.get("custom_recurrence", {})
        repeat_every = custom_rec.get("repeat_every", 1)
        repeat_unit = custom_rec.get("repeat_unit", "week")
        repeat_on_days = custom_rec.get("repeat_on_days", [])
        
        day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        
        if repeat_on_days:
            days_str = ", ".join([day_names[d] for d in sorted(repeat_on_days)])
            if repeat_every == 1:
                return f"Every {days_str}"
            else:
                return f"Every {repeat_every} {repeat_unit}s on {days_str}"
        else:
            if repeat_every == 1:
                return f"Every {repeat_unit}"
            else:
                return f"Every {repeat_every} {repeat_unit}s"
    return "Unknown"


# Get all tasks (All users can see all tasks in this module)
@our_tasks_router.get("/tasks")
async def get_tasks(request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        # All authenticated users can see all team tasks
        tasks = await db.our_tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
        
        # Add assigned user names and assigned_by names
        for task in tasks:
            if task.get("assigned_to"):
                assigned_user = await db.users.find_one(
                    {"user_id": task["assigned_to"]}, 
                    {"name": 1, "_id": 0}
                )
                task["assigned_to_name"] = assigned_user.get("name") if assigned_user else "Unknown"
            else:
                task["assigned_to_name"] = None
            
            # Add assigned_by name
            if task.get("assigned_by"):
                assigned_by_user = await db.users.find_one(
                    {"user_id": task["assigned_by"]}, 
                    {"name": 1, "_id": 0}
                )
                task["assigned_by_name"] = assigned_by_user.get("name") if assigned_by_user else "Unknown"
            else:
                task["assigned_by_name"] = None
                
            if task.get("created_by"):
                creator = await db.users.find_one(
                    {"user_id": task["created_by"]}, 
                    {"name": 1, "_id": 0}
                )
                task["created_by_name"] = creator.get("name") if creator else "Unknown"
        
        return tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Create a task
@our_tasks_router.post("/tasks")
async def create_task(task_data: TaskCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        task_id = f"ot_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        
        task = {
            "task_id": task_id,
            "task_name": task_data.task_name,
            "description": task_data.description or "",
            "priority": task_data.priority,
            "type": task_data.type,
            "assigned_to": task_data.assigned_to or user.user_id,
            "assigned_by": user.user_id,
            "due_date": task_data.due_date,
            "due_time": task_data.due_time,
            "all_day": task_data.all_day,
            "recurrence": task_data.recurrence,
            "custom_recurrence": task_data.custom_recurrence.dict() if task_data.custom_recurrence else None,
            "status": task_data.status,
            "work_link": task_data.work_link,
            "created_by": user.user_id,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "time_tracking": {
                "total_seconds": 0,
                "status": "not_started",
                "sessions": []
            }
        }
        
        await db.our_tasks.insert_one(task)
        task.pop("_id", None)
        
        # Add user names before returning
        if task.get("assigned_to"):
            assigned_user = await db.users.find_one({"user_id": task["assigned_to"]}, {"name": 1, "_id": 0})
            task["assigned_to_name"] = assigned_user.get("name") if assigned_user else "Unknown"
        if task.get("assigned_by"):
            assigned_by_user = await db.users.find_one({"user_id": task["assigned_by"]}, {"name": 1, "_id": 0})
            task["assigned_by_name"] = assigned_by_user.get("name") if assigned_by_user else "Unknown"
        if task.get("created_by"):
            creator = await db.users.find_one({"user_id": task["created_by"]}, {"name": 1, "_id": 0})
            task["created_by_name"] = creator.get("name") if creator else "Unknown"
        
        return task
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Get a single task
@our_tasks_router.get("/tasks/{task_id}")
async def get_task(task_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        task = await db.our_tasks.find_one({"task_id": task_id}, {"_id": 0})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Add user names
        if task.get("assigned_to"):
            assigned_user = await db.users.find_one({"user_id": task["assigned_to"]}, {"name": 1, "_id": 0})
            task["assigned_to_name"] = assigned_user.get("name") if assigned_user else "Unknown"
        if task.get("assigned_by"):
            assigned_by_user = await db.users.find_one({"user_id": task["assigned_by"]}, {"name": 1, "_id": 0})
            task["assigned_by_name"] = assigned_by_user.get("name") if assigned_by_user else "Unknown"
        if task.get("created_by"):
            creator = await db.users.find_one({"user_id": task["created_by"]}, {"name": 1, "_id": 0})
            task["created_by_name"] = creator.get("name") if creator else "Unknown"
        
        return task
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Update a task
@our_tasks_router.put("/tasks/{task_id}")
async def update_task(task_id: str, task_data: TaskUpdate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        task = await db.our_tasks.find_one({"task_id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        update_dict = {k: v for k, v in task_data.dict().items() if v is not None}
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.our_tasks.update_one(
            {"task_id": task_id},
            {"$set": update_dict}
        )
        
        updated = await db.our_tasks.find_one({"task_id": task_id}, {"_id": 0})
        
        # Add user names
        if updated.get("assigned_to"):
            assigned_user = await db.users.find_one({"user_id": updated["assigned_to"]}, {"name": 1, "_id": 0})
            updated["assigned_to_name"] = assigned_user.get("name") if assigned_user else "Unknown"
        if updated.get("assigned_by"):
            assigned_by_user = await db.users.find_one({"user_id": updated["assigned_by"]}, {"name": 1, "_id": 0})
            updated["assigned_by_name"] = assigned_by_user.get("name") if assigned_by_user else "Unknown"
        if updated.get("created_by"):
            creator = await db.users.find_one({"user_id": updated["created_by"]}, {"name": 1, "_id": 0})
            updated["created_by_name"] = creator.get("name") if creator else "Unknown"
        
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Delete a task
@our_tasks_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        task = await db.our_tasks.find_one({"task_id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Only creator or admin can delete
        if task["created_by"] != user.user_id and user.role not in ["super_admin", "admin"]:
            raise HTTPException(status_code=403, detail="Not authorized to delete this task")
        
        await db.our_tasks.delete_one({"task_id": task_id})
        return {"message": "Task deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Update task status
@our_tasks_router.patch("/tasks/{task_id}/status")
async def update_task_status(task_id: str, status_data: StatusUpdate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        task = await db.our_tasks.find_one({"task_id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        await db.our_tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "status": status_data.status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        updated = await db.our_tasks.find_one({"task_id": task_id}, {"_id": 0})
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Time tracking actions
@our_tasks_router.post("/tasks/{task_id}/time")
async def time_tracking_action(task_id: str, action_data: TimeTrackingAction, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        task = await db.our_tasks.find_one({"task_id": task_id})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        now = datetime.now(timezone.utc)
        time_tracking = task.get("time_tracking", {"total_seconds": 0, "status": "not_started", "sessions": []})
        action = action_data.action
        
        if action == "start":
            if time_tracking.get("status") == "running":
                raise HTTPException(status_code=400, detail="Timer already running")
            
            # Start a new session
            time_tracking["status"] = "running"
            time_tracking["current_session_start"] = now.isoformat()
            time_tracking["sessions"].append({
                "start": now.isoformat(),
                "end": None,
                "duration_seconds": 0,
                "user_id": user.user_id
            })
            
            # Update task status to in_progress if pending
            task_status = task.get("status", "pending")
            if task_status == "pending":
                await db.our_tasks.update_one(
                    {"task_id": task_id},
                    {"$set": {"status": "in_progress"}}
                )
        
        elif action == "pause":
            if time_tracking.get("status") != "running":
                raise HTTPException(status_code=400, detail="Timer not running")
            
            # End current session
            if time_tracking["sessions"]:
                current_session = time_tracking["sessions"][-1]
                if current_session["end"] is None:
                    start_time = datetime.fromisoformat(current_session["start"].replace('Z', '+00:00'))
                    duration = (now - start_time).total_seconds()
                    current_session["end"] = now.isoformat()
                    current_session["duration_seconds"] = int(duration)
                    time_tracking["total_seconds"] += int(duration)
            
            time_tracking["status"] = "paused"
            time_tracking.pop("current_session_start", None)
        
        elif action == "resume":
            if time_tracking.get("status") == "running":
                raise HTTPException(status_code=400, detail="Timer already running")
            
            # Start a new session
            time_tracking["status"] = "running"
            time_tracking["current_session_start"] = now.isoformat()
            time_tracking["sessions"].append({
                "start": now.isoformat(),
                "end": None,
                "duration_seconds": 0,
                "user_id": user.user_id
            })
        
        elif action == "finish":
            # End current session if running
            if time_tracking.get("status") == "running" and time_tracking["sessions"]:
                current_session = time_tracking["sessions"][-1]
                if current_session["end"] is None:
                    start_time = datetime.fromisoformat(current_session["start"].replace('Z', '+00:00'))
                    duration = (now - start_time).total_seconds()
                    current_session["end"] = now.isoformat()
                    current_session["duration_seconds"] = int(duration)
                    time_tracking["total_seconds"] += int(duration)
            
            time_tracking["status"] = "finished"
            time_tracking.pop("current_session_start", None)
            
            # Mark task as completed
            await db.our_tasks.update_one(
                {"task_id": task_id},
                {"$set": {"status": "completed"}}
            )
        
        await db.our_tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "time_tracking": time_tracking,
                "updated_at": now.isoformat()
            }}
        )
        
        updated = await db.our_tasks.find_one({"task_id": task_id}, {"_id": 0})
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Get tasks by date (for calendar day detail view)
@our_tasks_router.get("/tasks/by-date/{date}")
async def get_tasks_by_date(date: str, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        # Parse date
        target_date = datetime.strptime(date, "%Y-%m-%d")
        next_date = target_date + timedelta(days=1)
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        is_future = target_date.date() > today.date()
        
        # Build query for tasks
        if is_future:
            base_query = {"due_date": date}
        else:
            base_query = {
                "$or": [
                    {"due_date": date},
                    {"created_at": {"$gte": target_date.isoformat(), "$lt": next_date.isoformat()}},
                    {"updated_at": {"$gte": target_date.isoformat(), "$lt": next_date.isoformat()}}
                ]
            }
        
        tasks = await db.our_tasks.find(base_query, {"_id": 0}).sort("created_at", -1).to_list(100)
        
        # Add names and calculate day_seconds
        for task in tasks:
            if task.get("assigned_to"):
                assigned_user = await db.users.find_one({"user_id": task["assigned_to"]}, {"name": 1, "_id": 0})
                task["assigned_to_name"] = assigned_user.get("name") if assigned_user else "Unknown"
            else:
                task["assigned_to_name"] = None
            
            if task.get("assigned_by"):
                assigned_by_user = await db.users.find_one({"user_id": task["assigned_by"]}, {"name": 1, "_id": 0})
                task["assigned_by_name"] = assigned_by_user.get("name") if assigned_by_user else "Unknown"
            else:
                task["assigned_by_name"] = None
            
            if task.get("created_by"):
                created_by_user = await db.users.find_one({"user_id": task["created_by"]}, {"name": 1, "_id": 0})
                task["created_by_name"] = created_by_user.get("name") if created_by_user else "Unknown"
            else:
                task["created_by_name"] = None
            
            # Calculate day_seconds
            day_seconds = 0
            if task.get("time_tracking", {}).get("sessions"):
                for session in task["time_tracking"]["sessions"]:
                    session_start = session.get("start", "")
                    if session_start.startswith(date):
                        day_seconds += session.get("duration_seconds", 0)
            task["day_seconds"] = day_seconds
        
        return {"date": date, "is_future": is_future, "tasks": tasks}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
