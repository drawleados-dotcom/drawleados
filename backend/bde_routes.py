"""
BDE Tasks Routes - Task management for Business Development
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid

bde_router = APIRouter(prefix="/bde", tags=["BDE Tasks"])

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

# Dependency to get DB
async def get_db():
    from server import db
    return db

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

# Get tasks by date (for calendar day detail view)
@bde_router.get("/tasks/by-date/{date}")
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
            # For future dates, show tasks with due date on this date or assigned to user
            base_query = {
                "$or": [
                    {"due_date": date},
                    {"due_date": {"$gte": date}}
                ]
            }
        else:
            # For past/today, show tasks worked on this day or with time tracking sessions on this day
            base_query = {
                "$or": [
                    {"created_at": {"$gte": target_date.isoformat(), "$lt": next_date.isoformat()}},
                    {"updated_at": {"$gte": target_date.isoformat(), "$lt": next_date.isoformat()}},
                    {"time_tracking.sessions.start": {"$gte": target_date.isoformat(), "$lt": next_date.isoformat()}}
                ]
            }
        
        # Filter by user access — Calendar is ALWAYS personal (My Tasks)
        base_query = {
            "$and": [
                base_query,
                {"$or": [
                    {"created_by": user.user_id},
                    {"assigned_to": user.user_id}
                ]}
            ]
        }
        
        tasks = await db.bde_tasks.find(base_query, {"_id": 0}).sort("created_at", -1).to_list(100)
        
        # Add names and calculate day_seconds
        for task in tasks:
            # Add assigned_to name
            if task.get("assigned_to"):
                assigned_user = await db.users.find_one({"user_id": task["assigned_to"]}, {"name": 1, "_id": 0})
                task["assigned_to_name"] = assigned_user.get("name") if assigned_user else "Unknown"
            else:
                task["assigned_to_name"] = None
            
            # Add assigned_by name
            if task.get("assigned_by"):
                assigned_by_user = await db.users.find_one({"user_id": task["assigned_by"]}, {"name": 1, "_id": 0})
                task["assigned_by_name"] = assigned_by_user.get("name") if assigned_by_user else "Unknown"
            else:
                task["assigned_by_name"] = None
            
            # Add created_by name
            if task.get("created_by"):
                created_by_user = await db.users.find_one({"user_id": task["created_by"]}, {"name": 1, "_id": 0})
                task["created_by_name"] = created_by_user.get("name") if created_by_user else "Unknown"
            else:
                task["created_by_name"] = None
            
            # Calculate day_seconds (time spent on this specific date)
            day_seconds = 0
            if task.get("time_tracking", {}).get("sessions"):
                for session in task["time_tracking"]["sessions"]:
                    session_start = session.get("start", "")
                    if session_start.startswith(date):
                        day_seconds += session.get("duration_seconds", 0)
            task["day_seconds"] = day_seconds

        # ---------- ALSO PULL FROM additional_tasks ----------
        # Match by due_date == this date AND user is creator or assignee
        add_query = {
            "due_date": date,
            "$or": [
                {"assignee_id": user.user_id},
                {"created_by": user.user_id},
            ],
        }
        add_tasks = await db.additional_tasks.find(add_query, {"_id": 0}).to_list(100)
        for t in add_tasks:
            normalized = {
                "task_id": t.get("task_id"),
                "task_name": t.get("title") or "Untitled",
                "description": t.get("description", ""),
                "priority": t.get("priority", "medium"),
                "status": t.get("status", "pending"),
                "due_date": t.get("due_date"),
                "type": t.get("type", "general"),
                "assigned_to": t.get("assignee_id"),
                "assigned_to_name": t.get("assignee"),
                "created_by": t.get("created_by"),
                "created_by_name": t.get("created_by_name"),
                "day_seconds": 0,
                "source": "additional_tasks",
            }
            tasks.append(normalized)

        return {"date": date, "is_future": is_future, "tasks": tasks}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get all tasks for a month (for calendar view)
@bde_router.get("/tasks/month/{year}/{month}")
async def get_tasks_for_month(year: int, month: int, request: Request):
    """Get all tasks grouped by date for a specific month - includes recurring tasks"""
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        from calendar import monthrange
        last_day = monthrange(year, month)[1]
        start_date = f"{year}-{str(month).zfill(2)}-01"
        end_date = f"{year}-{str(month).zfill(2)}-{str(last_day).zfill(2)}"
        
        # Build base access filter — Calendar is ALWAYS personal (My Tasks),
        # so filter by current user regardless of role
        access_filter = {
            "$or": [
                {"created_by": user.user_id},
                {"assigned_to": user.user_id}
            ]
        }
        
        # Get non-recurring tasks with due_date in this month
        non_recurring_query = {
            "due_date": {"$gte": start_date, "$lte": end_date},
            "$or": [
                {"recurrence": {"$exists": False}},
                {"recurrence": "none"},
                {"recurrence": None}
            ]
        }
        if access_filter:
            non_recurring_query = {"$and": [non_recurring_query, access_filter]}
        
        non_recurring_tasks = await db.bde_tasks.find(non_recurring_query, {
            "_id": 0,
            "task_id": 1,
            "task_name": 1,
            "priority": 1,
            "status": 1,
            "due_date": 1,
            "due_time": 1,
            "type": 1,
            "recurrence": 1
        }).to_list(500)
        
        # Get all recurring tasks that could appear in this month
        recurring_query = {
            "recurrence": {"$nin": ["none", None]},
            "due_date": {"$lte": end_date}  # Started before or during this month
        }
        if access_filter:
            recurring_query = {"$and": [recurring_query, access_filter]}
        
        recurring_tasks = await db.bde_tasks.find(recurring_query, {
            "_id": 0,
            "task_id": 1,
            "task_name": 1,
            "priority": 1,
            "status": 1,
            "due_date": 1,
            "due_time": 1,
            "type": 1,
            "recurrence": 1,
            "custom_recurrence": 1
        }).to_list(500)
        
        # Group tasks by date
        tasks_by_date = {}
        
        # Add non-recurring tasks
        for task in non_recurring_tasks:
            date = task.get("due_date")
            if date:
                task["recurrence_label"] = "One-time"
                if date not in tasks_by_date:
                    tasks_by_date[date] = []
                tasks_by_date[date].append(task)
        
        # Check each day of the month for recurring tasks
        for day in range(1, last_day + 1):
            check_date = f"{year}-{str(month).zfill(2)}-{str(day).zfill(2)}"
            
            for task in recurring_tasks:
                if task_occurs_on_date(task, check_date):
                    # Create a copy with this specific date
                    task_instance = {
                        "task_id": task["task_id"],
                        "task_name": task["task_name"],
                        "priority": task.get("priority", "medium"),
                        "status": task.get("status", "pending"),
                        "due_date": check_date,
                        "due_time": task.get("due_time"),
                        "type": task.get("type", "general"),
                        "recurrence": task.get("recurrence"),
                        "recurrence_label": get_recurrence_label(task),
                        "is_recurring_instance": True,
                        "original_due_date": task.get("due_date")
                    }
                    
                    if check_date not in tasks_by_date:
                        tasks_by_date[check_date] = []
                    
                    # Avoid duplicates
                    existing_ids = [t["task_id"] for t in tasks_by_date[check_date]]
                    if task["task_id"] not in existing_ids:
                        tasks_by_date[check_date].append(task_instance)
        
        # Count total tasks
        total_tasks = sum(len(tasks) for tasks in tasks_by_date.values())

        # ---------- ALSO PULL FROM additional_tasks COLLECTION ----------
        # additional_tasks uses a different schema: title, assignee_id, due_date
        add_query = {
            "due_date": {"$gte": start_date, "$lte": end_date},
            "$or": [
                {"assignee_id": user.user_id},
                {"created_by": user.user_id},
            ],
        }
        add_tasks = await db.additional_tasks.find(add_query, {"_id": 0}).to_list(500)
        for t in add_tasks:
            date = t.get("due_date")
            if not date:
                continue
            # Normalize to the shape calendar expects
            normalized = {
                "task_id": t.get("task_id"),
                "task_name": t.get("title") or "Untitled",
                "priority": t.get("priority", "medium"),
                "status": t.get("status", "pending"),
                "due_date": date,
                "type": t.get("type", "general"),
                "recurrence": "none",
                "recurrence_label": "One-time",
                "source": "additional_tasks",
            }
            tasks_by_date.setdefault(date, [])
            existing_ids = [x.get("task_id") for x in tasks_by_date[date]]
            if normalized["task_id"] not in existing_ids:
                tasks_by_date[date].append(normalized)
                total_tasks += 1

        return {
            "year": year,
            "month": month,
            "tasks_by_date": tasks_by_date,
            "total_tasks": total_tasks
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Create task
@bde_router.post("/tasks")
async def create_task(data: TaskCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    
    try:
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        
        # If assigned_to is provided, set assigned_by to current user
        assigned_by = data.assigned_by or (user.user_id if data.assigned_to else None)
        
        # Prepare custom_recurrence dict if provided
        custom_rec = None
        if data.custom_recurrence:
            custom_rec = data.custom_recurrence.dict() if hasattr(data.custom_recurrence, 'dict') else data.custom_recurrence
        
        task = {
            "task_id": task_id,
            "task_name": data.task_name,
            "description": data.description or "",
            "priority": data.priority,
            "type": data.type,
            "assigned_to": data.assigned_to,
            "assigned_by": assigned_by,
            "due_date": data.due_date,
            "due_time": data.due_time,
            "all_day": data.all_day,
            "recurrence": data.recurrence,
            "custom_recurrence": custom_rec,
            "status": data.status,
            "work_link": data.work_link,
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
            # If assigning to someone, set assigned_by to current user
            if data.assigned_to and not existing.get("assigned_by"):
                update_data["assigned_by"] = user.user_id
        if data.assigned_by is not None:
            update_data["assigned_by"] = data.assigned_by
        if data.due_date is not None:
            update_data["due_date"] = data.due_date
        if data.status is not None:
            update_data["status"] = data.status
        if data.work_link is not None:
            update_data["work_link"] = data.work_link
        
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
