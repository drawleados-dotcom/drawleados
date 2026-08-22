"""
Our Tasks Routes - Team-wide task management for all users
Similar to BDE Tasks but accessible to all team members
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid

from access import has_hr_access, has_operations_access

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
    department: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    category: Optional[str] = None
    website_page_id: Optional[str] = None    # Website dept only: one of the project's Pages, or "others"
    website_page_name: Optional[str] = None
    erp_user_id: Optional[str] = None        # ERP dept only: one of the project's erp_users
    erp_user_name: Optional[str] = None
    erp_page_id: Optional[str] = None        # one of that user's pages
    erp_page_name: Optional[str] = None
    erp_sub_tab_id: Optional[str] = None     # one of that page's sub tabs
    erp_sub_tab_name: Optional[str] = None
    erp_ultra_sub_tab_id: Optional[str] = None  # one of that sub tab's ultra sub tabs
    erp_ultra_sub_tab_name: Optional[str] = None
    erp_ultra_tab_id: Optional[str] = None   # one of that ultra sub tab's ultra tabs
    erp_ultra_tab_name: Optional[str] = None
    erp_task_type: Optional[str] = None      # ERP dept only: New Module, New Feature, Correction
    sub_department_id: Optional[str] = None  # one of the selected department's sub_departments (e.g. Management)
    sub_department_name: Optional[str] = None
    workflow_id: Optional[str] = None        # one of the project's erp_workflow rows
    workflow_name: Optional[str] = None

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
    department: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    category: Optional[str] = None
    website_page_id: Optional[str] = None
    website_page_name: Optional[str] = None
    erp_user_id: Optional[str] = None
    erp_user_name: Optional[str] = None
    erp_page_id: Optional[str] = None
    erp_page_name: Optional[str] = None
    erp_sub_tab_id: Optional[str] = None
    erp_sub_tab_name: Optional[str] = None
    erp_ultra_sub_tab_id: Optional[str] = None
    erp_ultra_sub_tab_name: Optional[str] = None
    erp_ultra_tab_id: Optional[str] = None
    erp_ultra_tab_name: Optional[str] = None
    erp_task_type: Optional[str] = None
    sub_department_id: Optional[str] = None
    sub_department_name: Optional[str] = None
    workflow_id: Optional[str] = None
    workflow_name: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str

class TimeTrackingAction(BaseModel):
    action: str  # start, pause, resume, finish

class TimeEditPayload(BaseModel):
    start_time: Optional[str] = None  # "HH:MM" or full ISO
    end_time: Optional[str] = None    # "HH:MM" or full ISO
    date: Optional[str] = None        # "YYYY-MM-DD" — defaults to today

class ApprovalRequestPayload(BaseModel):
    approver_role: str  # 'operations' | 'pm' | 'ceo' | 'marketing_head' | 'hr'
    approver_user_id: Optional[str] = None
    department: Optional[str] = None
    note: Optional[str] = None
    work_link: Optional[str] = None


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
        tasks = await db.our_tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
        
        # Collect unique user_ids referenced by any task and batch-fetch their names
        # ONCE instead of N+1 queries (this was the major slowness).
        uid_set = set()
        for t in tasks:
            for k in ("assigned_to", "assigned_by", "created_by"):
                if t.get(k):
                    uid_set.add(t[k])
        users_map = {}
        if uid_set:
            users_cursor = db.users.find(
                {"user_id": {"$in": list(uid_set)}},
                {"_id": 0, "user_id": 1, "name": 1}
            )
            async for u in users_cursor:
                users_map[u["user_id"]] = u.get("name") or "Unknown"

        for task in tasks:
            task["assigned_to_name"] = users_map.get(task.get("assigned_to")) if task.get("assigned_to") else None
            task["assigned_by_name"] = users_map.get(task.get("assigned_by")) if task.get("assigned_by") else None
            task["created_by_name"] = users_map.get(task.get("created_by")) if task.get("created_by") else None

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
            "department": task_data.department,
            "project_id": task_data.project_id,
            "project_name": task_data.project_name,
            "category": task_data.category,
            "website_page_id": task_data.website_page_id,
            "website_page_name": task_data.website_page_name,
            "erp_user_id": task_data.erp_user_id,
            "erp_user_name": task_data.erp_user_name,
            "erp_page_id": task_data.erp_page_id,
            "erp_page_name": task_data.erp_page_name,
            "erp_sub_tab_id": task_data.erp_sub_tab_id,
            "erp_sub_tab_name": task_data.erp_sub_tab_name,
            "erp_ultra_sub_tab_id": task_data.erp_ultra_sub_tab_id,
            "erp_ultra_sub_tab_name": task_data.erp_ultra_sub_tab_name,
            "erp_ultra_tab_id": task_data.erp_ultra_tab_id,
            "erp_ultra_tab_name": task_data.erp_ultra_tab_name,
            "erp_task_type": task_data.erp_task_type,
            "sub_department_id": task_data.sub_department_id,
            "sub_department_name": task_data.sub_department_name,
            "workflow_id": task_data.workflow_id,
            "workflow_name": task_data.workflow_name,
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

        # Bridge: if this task is a Meeting tied to a Project, also create a corresponding
        # entry in the meetings collection so it shows up in the project's Meeting tab.
        if (task_data.type or "").lower() == "meeting" and task_data.project_id:
            try:
                meeting_id = f"meet_{uuid.uuid4().hex[:12]}"
                meeting_doc = {
                    "meeting_id": meeting_id,
                    "title": task_data.task_name,
                    "description": task_data.description or "",
                    "agenda": task_data.description or "",
                    "date": task_data.due_date or "",
                    "start_time": task_data.due_time or "",
                    "end_time": "",
                    "all_day": bool(task_data.all_day),
                    "meeting_type": "video",
                    "category": "team",
                    "meeting_link": task_data.work_link or "",
                    "location": "",
                    "attendees": [],
                    "project_id": task_data.project_id,
                    "client_name": "",
                    "notes": "",
                    "reminder": 15,
                    "status": "scheduled",
                    "task_ids": [task_id],
                    "linked_task_id": task_id,
                    "created_by": user.user_id,
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                }
                await db.meetings.insert_one(meeting_doc)
                # Store reverse link so deletion/status sync can find the meeting later.
                await db.our_tasks.update_one(
                    {"task_id": task_id},
                    {"$set": {"linked_meeting_id": meeting_id}},
                )
                task["linked_meeting_id"] = meeting_id
            except Exception:
                # Don't fail task creation if the meeting bridge errors.
                pass

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


@our_tasks_router.get("/work-hours/{date}")
async def get_work_hours_for_date(date: str, request: Request, user_id: Optional[str] = None):
    """Sum total time-tracked seconds across all of a user's tasks for the given date.
    Date format: YYYY-MM-DD. Returns: {seconds, hours, formatted}."""
    from server import get_current_user, db
    requester = await get_current_user(request)
    # Default to requester; HR-privileged users can query any user's hours
    target = user_id or requester.user_id
    if target != requester.user_id and not has_hr_access(requester):
        raise HTTPException(status_code=403, detail="Cannot view other users' hours")

    try:
        day_start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    day_end = day_start + timedelta(days=1)

    total_seconds = 0
    # Meeting-type tasks are scheduled events — even if no timer was started,
    # credit the scheduled duration (start_time → end_time) on this date.
    MEETING_TYPES = {"meeting", "team_meeting", "client_meeting"}

    cursor = db.our_tasks.find(
        {"$or": [{"assigned_to": target}, {"created_by": target}]},
        {"_id": 0, "time_tracking": 1, "type": 1, "start_time": 1, "end_time": 1}
    )
    async for t in cursor:
        task_tracked_seconds = 0
        for s in (t.get("time_tracking", {}).get("sessions") or []):
            if s.get("user_id") and s.get("user_id") != target:
                continue
            st = s.get("start")
            en = s.get("end")
            if not st:
                continue
            try:
                st_dt = datetime.fromisoformat(st.replace("Z", "+00:00"))
                en_dt = datetime.fromisoformat(en.replace("Z", "+00:00")) if en else datetime.now(timezone.utc)
            except Exception:
                continue
            overlap_start = max(st_dt, day_start)
            overlap_end = min(en_dt, day_end)
            if overlap_end > overlap_start:
                task_tracked_seconds += int((overlap_end - overlap_start).total_seconds())

        # For meeting-type tasks, fall back to scheduled duration if not actively tracked.
        if (t.get("type") or "").lower() in MEETING_TYPES:
            try:
                m_start = t.get("start_time")
                m_end = t.get("end_time")
                if m_start and m_end:
                    m_st = datetime.fromisoformat(str(m_start).replace("Z", "+00:00"))
                    m_en = datetime.fromisoformat(str(m_end).replace("Z", "+00:00"))
                    overlap_start = max(m_st, day_start)
                    overlap_end = min(m_en, day_end)
                    if overlap_end > overlap_start:
                        scheduled_seconds = int((overlap_end - overlap_start).total_seconds())
                        # Use whichever is larger (avoids double-counting if both tracked & scheduled)
                        task_tracked_seconds = max(task_tracked_seconds, scheduled_seconds)
            except Exception:
                pass

        total_seconds += task_tracked_seconds

    hours = total_seconds / 3600.0
    h = int(hours)
    m = int((hours - h) * 60)
    return {"date": date, "user_id": target, "seconds": total_seconds, "hours": round(hours, 2), "formatted": f"{h}h {m}m"}


@our_tasks_router.get("/summary/{date}")
async def get_operations_summary(date: str, request: Request):
    """Returns 5 summary metrics for the Operations page on a given date:
      - worked_hours: total tracked hours (incl. meetings scheduled this day)
      - total_to_do: total open tasks assigned to me (pending + in_progress)
      - pending: tasks in 'pending' status
      - awaiting_ops: tasks awaiting Operations approval (approval_request.approver_role in {operations, pm, marketing_head})
      - awaiting_ceo: tasks awaiting CEO approval (approval_request.approver_role == 'ceo')
    """
    from server import get_current_user, db
    user = await get_current_user(request)
    uid = user.user_id

    # 1) Reuse work_hours computation
    try:
        day_start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    day_end = day_start + timedelta(days=1)
    MEETING_TYPES = {"meeting", "team_meeting", "client_meeting"}

    total_seconds = 0
    cursor = db.our_tasks.find(
        {"$or": [{"assigned_to": uid}, {"created_by": uid}]},
        {"_id": 0, "time_tracking": 1, "type": 1, "start_time": 1, "end_time": 1}
    )
    async for t in cursor:
        ts = 0
        for s in (t.get("time_tracking", {}).get("sessions") or []):
            if s.get("user_id") and s.get("user_id") != uid:
                continue
            st = s.get("start"); en = s.get("end")
            if not st:
                continue
            try:
                st_dt = datetime.fromisoformat(st.replace("Z", "+00:00"))
                en_dt = datetime.fromisoformat(en.replace("Z", "+00:00")) if en else datetime.now(timezone.utc)
            except Exception:
                continue
            os_, oe_ = max(st_dt, day_start), min(en_dt, day_end)
            if oe_ > os_:
                ts += int((oe_ - os_).total_seconds())
        if (t.get("type") or "").lower() in MEETING_TYPES:
            try:
                if t.get("start_time") and t.get("end_time"):
                    mst = datetime.fromisoformat(str(t["start_time"]).replace("Z", "+00:00"))
                    men = datetime.fromisoformat(str(t["end_time"]).replace("Z", "+00:00"))
                    os_, oe_ = max(mst, day_start), min(men, day_end)
                    if oe_ > os_:
                        ts = max(ts, int((oe_ - os_).total_seconds()))
            except Exception:
                pass
        total_seconds += ts
    hours = total_seconds / 3600.0
    h = int(hours); mm = int((hours - h) * 60)

    # 2-5) Counts on tasks assigned to me
    base_q = {"assigned_to": uid}

    total_to_do = await db.our_tasks.count_documents({**base_q, "status": {"$in": ["pending", "in_progress"]}})
    pending = await db.our_tasks.count_documents({**base_q, "status": "pending"})

    # Approval queue routing (matches ApprovalsPage buckets)
    awaiting_ops = await db.our_tasks.count_documents({
        **base_q,
        "approval_request.status": "pending",
        "approval_request.approver_role": {"$in": ["operations", "pm", "marketing_head"]},
    })
    awaiting_ceo = await db.our_tasks.count_documents({
        **base_q,
        "approval_request.status": "pending",
        "approval_request.approver_role": "ceo",
    })

    return {
        "date": date,
        "worked_hours": {"seconds": total_seconds, "hours": round(hours, 2), "formatted": f"{h}h {mm}m"},
        "total_to_do": total_to_do,
        "pending": pending,
        "awaiting_ops": awaiting_ops,
        "awaiting_ceo": awaiting_ceo,
    }



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

        # Authorization: creator, assignee, or super_admin/admin can do a full update.
        is_admin = user.role in ["super_admin", "admin"]
        is_creator = task.get("created_by") == user.user_id
        is_assignee = task.get("assigned_to") == user.user_id
        if not (is_admin or is_creator or is_assignee):
            raise HTTPException(status_code=403, detail="Only the creator, the assignee, or an admin can edit this task.")
        
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
        
        # Only the assignee or super_admin/admin can delete.
        is_admin = user.role in ["super_admin", "admin"]
        is_assignee = task.get("assigned_to") == user.user_id
        if not (is_admin or is_assignee):
            raise HTTPException(status_code=403, detail="Only the assignee or an admin can delete this task")
        
        await db.our_tasks.delete_one({"task_id": task_id})
        # Bridge: also delete the linked meeting (best-effort).
        linked_meeting_id = task.get("linked_meeting_id")
        if linked_meeting_id:
            try:
                await db.meetings.delete_one({"meeting_id": linked_meeting_id})
            except Exception:
                pass
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

        # Bridge: mirror status to the linked meeting (completed↔completed, else scheduled).
        linked_meeting_id = task.get("linked_meeting_id")
        if linked_meeting_id:
            try:
                meeting_status = "completed" if status_data.status == "completed" else "scheduled"
                await db.meetings.update_one(
                    {"meeting_id": linked_meeting_id},
                    {"$set": {"status": meeting_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
                )
            except Exception:
                pass
        
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

        # Batch-load all referenced users in a single query, then enrich.
        if tasks:
            uid_set = set()
            for t in tasks:
                for k in ("assigned_to", "assigned_by", "created_by"):
                    if t.get(k):
                        uid_set.add(t[k])
            user_rows = await db.users.find(
                {"user_id": {"$in": list(uid_set)}}, {"_id": 0, "user_id": 1, "name": 1},
            ).to_list(500) if uid_set else []
            name_by_uid = {u["user_id"]: u.get("name", "Unknown") for u in user_rows}

            for task in tasks:
                task["assigned_to_name"] = name_by_uid.get(task.get("assigned_to")) if task.get("assigned_to") else None
                task["assigned_by_name"] = name_by_uid.get(task.get("assigned_by")) if task.get("assigned_by") else None
                task["created_by_name"] = name_by_uid.get(task.get("created_by")) if task.get("created_by") else None

                # Compute day_seconds from sessions
                day_seconds = 0
                sessions = task.get("time_tracking", {}).get("sessions") or []
                for session in sessions:
                    if (session.get("start") or "").startswith(date):
                        day_seconds += session.get("duration_seconds", 0)
                task["day_seconds"] = day_seconds

        return {"date": date, "is_future": is_future, "tasks": tasks}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Inline-edit start/end time of a task's timer
@our_tasks_router.patch("/tasks/{task_id}/time-edit")
async def edit_time_tracking(task_id: str, payload: TimeEditPayload, request: Request):
    """
    Edit the Start Time and/or End Time of a task's timer.
    Behaviour:
      - If task has no sessions: create one session with the given start/end.
      - If sessions exist: update the FIRST session's start and the LAST session's end.
      - Recalculates total_seconds based on all sessions.
      - Time values may be "HH:MM" (combined with `date` or today's date) or full ISO timestamps.
    """
    from server import get_current_user, db
    user = await get_current_user(request)

    task = await db.our_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Locked once started-and-stopped (timer finished) or once Operations has approved —
    # mirrors the frontend's edit-button visibility rules.
    existing_status = (task.get("time_tracking") or {}).get("status")
    if existing_status == "finished":
        raise HTTPException(status_code=400, detail="Task time is locked once started and stopped")
    if task.get("approval_request", {}).get("status") == "approved":
        raise HTTPException(status_code=400, detail="Task time is locked — already approved by Operations")

    # Determine base date — explicit, else first existing session date, else today
    base_date = payload.date
    if not base_date:
        existing_sessions = task.get("time_tracking", {}).get("sessions", [])
        if existing_sessions and existing_sessions[0].get("start"):
            base_date = existing_sessions[0]["start"][:10]
        else:
            base_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def to_iso(value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        # If already looks like ISO (has 'T'), return as-is
        if "T" in value:
            return value
        # Otherwise treat as HH:MM and combine with base_date in UTC
        try:
            hh, mm = value.split(":")[:2]
            dt = datetime.strptime(f"{base_date} {int(hh):02d}:{int(mm):02d}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid time format: {value}. Use HH:MM")

    new_start_iso = to_iso(payload.start_time)
    new_end_iso = to_iso(payload.end_time)

    time_tracking = task.get("time_tracking") or {"total_seconds": 0, "status": "not_started", "sessions": []}
    sessions = time_tracking.get("sessions", [])

    if not sessions:
        # Create a new session from start to end (both required for fresh edit)
        if not new_start_iso and not new_end_iso:
            raise HTTPException(status_code=400, detail="Provide at least start_time or end_time")
        if not new_start_iso:
            raise HTTPException(status_code=400, detail="start_time required when no existing sessions")
        sessions = [{
            "start": new_start_iso,
            "end": new_end_iso,
            "duration_seconds": 0,
            "user_id": user.user_id,
        }]
    else:
        if new_start_iso:
            sessions[0]["start"] = new_start_iso
        if new_end_iso:
            sessions[-1]["end"] = new_end_iso

    # Validate that end > start for each session that has both
    for s in sessions:
        if s.get("start") and s.get("end"):
            try:
                st = datetime.fromisoformat(s["start"].replace("Z", "+00:00"))
                en = datetime.fromisoformat(s["end"].replace("Z", "+00:00"))
                if en <= st:
                    raise HTTPException(status_code=400, detail="End time must be after start time")
                s["duration_seconds"] = int((en - st).total_seconds())
            except HTTPException:
                raise
            except Exception:
                pass

    # Recalculate total_seconds across all sessions
    total = sum(int(s.get("duration_seconds") or 0) for s in sessions)
    time_tracking["sessions"] = sessions
    time_tracking["total_seconds"] = total

    # If finished (last session has end), keep/refresh status; running stays running
    last = sessions[-1]
    if last.get("end") and time_tracking.get("status") != "running":
        time_tracking["status"] = time_tracking.get("status") or "paused"

    await db.our_tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "time_tracking": time_tracking,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    updated = await db.our_tasks.find_one({"task_id": task_id}, {"_id": 0})
    return updated

# ============== TASK APPROVAL REQUESTS ==============
# Allows a task assignee to request approval from a specific role
# (operations / pm / ceo / marketing_head / hr). Stored on the task itself
# and surfaced in the Approvals page.

VALID_APPROVER_ROLES = {"operations", "pm", "ceo", "marketing_head", "hr"}

@our_tasks_router.post("/tasks/{task_id}/request-approval")
async def request_task_approval(task_id: str, payload: ApprovalRequestPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)

    if payload.approver_role not in VALID_APPROVER_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid approver_role. Allowed: {sorted(VALID_APPROVER_ROLES)}")

    work_link = (payload.work_link or "").strip()
    if not work_link:
        raise HTTPException(status_code=400, detail="Work link is required to send for approval")

    task = await db.our_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    approval_request = {
        "approver_role": payload.approver_role,
        "approver_user_id": payload.approver_user_id,
        "department": payload.department,
        "note": payload.note,
        "work_link": work_link,
        "status": "pending",  # pending | approved | rejected
        "requested_by": user.user_id,
        "requested_by_name": user.name,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "decided_by": None,
        "decided_at": None,
        "decision_remarks": None,
    }

    await db.our_tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "approval_request": approval_request,
            "work_link": work_link,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"message": "Approval requested", "approval_request": approval_request}


@our_tasks_router.get("/approvals/pending")
async def list_pending_task_approvals(request: Request, approver_role: Optional[str] = None, department: Optional[str] = None):
    """Return tasks with pending approval_request, optionally filtered by approver_role and department.
    The Approvals page calls this to show pending task approval requests."""
    from server import get_current_user, db
    await get_current_user(request)

    query: dict = {"approval_request.status": "pending"}
    if approver_role:
        query["approval_request.approver_role"] = approver_role
    if department:
        query["approval_request.department"] = department

    tasks = await db.our_tasks.find(query, {"_id": 0}).sort("approval_request.requested_at", -1).to_list(200)
    return tasks


@our_tasks_router.post("/tasks/{task_id}/approval-decision")
async def decide_task_approval(task_id: str, payload: dict, request: Request):
    """Decide on a task approval request.
    payload:
      { decision: 'approve' | 'reject' | 'forward_ceo',
        approved_by: 'operations' | 'client' (required for approve),
        remarks: str (required for reject) }

    Behaviour:
      - approve         → mark approved, store who approved (operations/client)
      - forward_ceo     → keep status=pending, switch approver_role to 'ceo' (re-route)
      - reject          → mark rejected AND create a new task in our_tasks for the original assignee
                          with title "[Rejected by <role>] <original task>" and remarks in description
    """
    from server import get_current_user, db
    user = await get_current_user(request)

    decision = (payload or {}).get("decision")
    if decision not in {"approve", "reject", "forward_ceo", "forward_operations"}:
        raise HTTPException(status_code=400, detail="decision must be 'approve', 'reject', 'forward_ceo', or 'forward_operations'")

    task = await db.our_tasks.find_one({"task_id": task_id})
    if not task or not task.get("approval_request"):
        raise HTTPException(status_code=404, detail="Task or pending approval not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    req = task.get("approval_request") or {}

    if decision == "approve":
        approved_by = (payload or {}).get("approved_by")
        if approved_by not in {"operations", "client"}:
            raise HTTPException(status_code=400, detail="approved_by must be 'operations' or 'client'")
        await db.our_tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "approval_request.status": "approved",
                "approval_request.decided_by": user.user_id,
                "approval_request.decided_at": now_iso,
                "approval_request.approved_by_role": approved_by,
                "updated_at": now_iso,
            }}
        )

    elif decision == "forward_ceo":
        # Re-route the same pending request to CEO queue
        await db.our_tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "approval_request.approver_role": "ceo",
                "approval_request.forwarded_by": user.user_id,
                "approval_request.forwarded_from": req.get("approver_role"),
                "approval_request.forwarded_at": now_iso,
                "updated_at": now_iso,
            }}
        )

    elif decision == "forward_operations":
        # PM / Marketing Head approves at their level and forwards to Operations for final approval
        await db.our_tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "approval_request.approver_role": "operations",
                "approval_request.forwarded_by": user.user_id,
                "approval_request.forwarded_from": req.get("approver_role"),
                "approval_request.forwarded_at": now_iso,
                "approval_request.intermediate_approved_by_role": req.get("approver_role"),
                "approval_request.intermediate_approved_at": now_iso,
                "updated_at": now_iso,
            }}
        )

    else:  # reject
        remarks = ((payload or {}).get("remarks") or "").strip()
        if not remarks:
            raise HTTPException(status_code=400, detail="Remarks are required when rejecting")

        # Capture the rejecting role label (PM / Operations / CEO / Marketing Head / HR / Client)
        rejected_by_role = (payload or {}).get("rejected_by_role") or req.get("approver_role") or "operations"
        role_label_map = {
            "operations": "Operations",
            "pm": "PM",
            "ceo": "CEO",
            "marketing_head": "Marketing Head",
            "hr": "HR",
            "client": "Client",
        }
        rejected_label = role_label_map.get(rejected_by_role, rejected_by_role.title())

        # Mark original task's approval as rejected
        await db.our_tasks.update_one(
            {"task_id": task_id},
            {"$set": {
                "approval_request.status": "rejected",
                "approval_request.decided_by": user.user_id,
                "approval_request.decided_at": now_iso,
                "approval_request.decision_remarks": remarks,
                "approval_request.rejected_by_role": rejected_by_role,
                "updated_at": now_iso,
            }}
        )

        # Create a NEW task assigned back to the original assignee/requester
        original_assignee = task.get("assigned_to") or req.get("requested_by")
        new_task = {
            "task_id": f"ot_{uuid.uuid4().hex[:12]}",
            "task_name": f"[Rejected by {rejected_label}] {task.get('task_name', 'Task')}",
            "description": f"Rejection remarks: {remarks}\n\nOriginal task: {task.get('task_name')}\nOriginal task_id: {task_id}",
            "status": "pending",
            "priority": task.get("priority") or "high",
            "type": task.get("type") or "general",
            "tags": list({*(task.get("tags") or []), f"rejected_by_{rejected_by_role}", "rework"}),
            "assigned_to": original_assignee,
            "created_by": user.user_id,
            "created_by_name": user.name,
            "due_date": None,
            "work_link": task.get("work_link"),
            "department": req.get("department") or task.get("department"),
            "parent_task_id": task_id,
            "rejection_metadata": {
                "rejected_by_role": rejected_by_role,
                "rejected_by_user_id": user.user_id,
                "rejected_by_name": user.name,
                "remarks": remarks,
                "rejected_at": now_iso,
            },
            "time_tracking": {"total_seconds": 0, "status": "not_started", "sessions": []},
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        await db.our_tasks.insert_one(new_task)

    updated = await db.our_tasks.find_one({"task_id": task_id}, {"_id": 0})
    return updated



# -----------------------------------------------------------------------------
# Meeting group helpers — collapse duplicate Meeting/Team-Meeting/Client-Meeting
# tasks that were created one-per-assignee. Two siblings belong to the same
# meeting group when ANY of these is true:
#   1. They share a non-empty `meeting_group_id`.
#   2. type ∈ {meeting, team_meeting, client_meeting} AND task_name AND
#      due_date AND created_by all match (legacy heuristic).
# -----------------------------------------------------------------------------
MEETING_FAMILY = {"meeting", "team_meeting", "client_meeting"}


async def _meeting_siblings_query(task: dict) -> Optional[dict]:
    t = (task.get("type") or "").lower()
    if t not in MEETING_FAMILY:
        return None
    gid = task.get("meeting_group_id")
    if gid:
        return {"meeting_group_id": gid}
    # Heuristic fallback for legacy duplicates that share creator + name + date.
    name = task.get("task_name")
    creator = task.get("created_by")
    due_date = task.get("due_date")
    if not (name and creator):
        return None
    return {
        "type": {"$in": list(MEETING_FAMILY)},
        "task_name": name,
        "created_by": creator,
        "due_date": due_date or None,
    }


@our_tasks_router.get("/tasks/{task_id}/meeting-group")
async def get_meeting_group(task_id: str, request: Request):
    """Return all sibling meeting tasks (one row per assignee), each with name + status."""
    from server import get_current_user, db
    await get_current_user(request)
    task = await db.our_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    query = await _meeting_siblings_query(task)
    if not query:
        # Not a meeting — return itself as a group of 1.
        return {
            "is_meeting_group": False,
            "meeting_group_id": None,
            "members": [{
                "task_id": task["task_id"],
                "assigned_to": task.get("assigned_to"),
                "assigned_to_name": task.get("assigned_to_name") or "—",
                "status": task.get("status") or "pending",
            }],
        }
    siblings = []
    async for sib in db.our_tasks.find(query, {"_id": 0}):
        siblings.append(sib)
    # Lazy backfill: if heuristic matched ≥2 siblings without a stored group_id,
    # write one shared id back so future cascades are O(1) lookups.
    if siblings and not task.get("meeting_group_id"):
        gid = f"mtg_{uuid.uuid4().hex[:12]}"
        sibling_ids = [s["task_id"] for s in siblings]
        await db.our_tasks.update_many(
            {"task_id": {"$in": sibling_ids}},
            {"$set": {"meeting_group_id": gid}},
        )
        for s in siblings:
            s["meeting_group_id"] = gid
    # Resolve assignee names for any sibling missing them.
    user_ids = list({s.get("assigned_to") for s in siblings if s.get("assigned_to")})
    name_map = {}
    if user_ids:
        async for u in db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1}):
            name_map[u["user_id"]] = u.get("name") or "—"
    members = [
        {
            "task_id": s["task_id"],
            "assigned_to": s.get("assigned_to"),
            "assigned_to_name": s.get("assigned_to_name") or name_map.get(s.get("assigned_to"), "—"),
            "status": s.get("status") or "pending",
            "approval_request": s.get("approval_request"),
        }
        for s in siblings
    ]
    members.sort(key=lambda m: (m["assigned_to_name"] or "").lower())
    return {
        "is_meeting_group": len(members) > 1,
        "meeting_group_id": siblings[0].get("meeting_group_id") if siblings else None,
        "members": members,
    }


class GroupStatusPayload(BaseModel):
    status: str  # e.g. 'completed', 'approved' (mapped to operations approval)


@our_tasks_router.post("/tasks/{task_id}/group-status")
async def cascade_group_status(task_id: str, payload: GroupStatusPayload, request: Request):
    """Cascade a status change to every sibling task in the same meeting group.

    Used by "Approve All" / "Mark all complete" inside the Assign-to-Team
    meeting-group popup. Returns the count of tasks updated.
    """
    from server import get_current_user, db
    await get_current_user(request)
    task = await db.our_tasks.find_one({"task_id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    query = await _meeting_siblings_query(task)
    if not query:
        # Not a meeting — fall back to single-task update.
        await db.our_tasks.update_one(
            {"task_id": task_id},
            {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"updated": 1}
    res = await db.our_tasks.update_many(
        query,
        {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    # Also auto-stamp a group_id if missing so future calls hit the O(1) path.
    if not task.get("meeting_group_id"):
        gid = f"mtg_{uuid.uuid4().hex[:12]}"
        await db.our_tasks.update_many(query, {"$set": {"meeting_group_id": gid}})
    return {"updated": res.modified_count}


@our_tasks_router.get("/tasks/{task_id}/timeline")
async def get_task_timeline(task_id: str, request: Request):
    """Return a chronological audit timeline for one task.

    Only Super Admin / Admin can view this — the frontend also gates the
    eye-on-clock icon to super_admin. Events are synthesised from existing
    task fields (created_at, updated_at, approval_request) plus the dedicated
    `task_events` collection which the write paths append to.
    """
    from server import get_current_user, db
    user = await get_current_user(request)
    role = (user.role or "").lower()
    if role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Timeline is visible to Super Admin only")

    task = await db.our_tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    events = []

    # 1) Synthesised events from the task document itself.
    if task.get("created_at"):
        events.append({
            "kind": "created",
            "at": task["created_at"],
            "by": task.get("created_by_name") or task.get("created_by") or "—",
            "summary": f"Task created — \"{task.get('task_name','')}\"",
            "details": {
                "assigned_to": task.get("assigned_to_name"),
                "due_date": task.get("due_date"),
                "due_time": task.get("due_time"),
                "type": task.get("type"),
            },
        })
    ar = task.get("approval_request") or {}
    if ar.get("requested_at"):
        events.append({
            "kind": "approval_requested",
            "at": ar["requested_at"],
            "by": ar.get("requested_by_name") or ar.get("requested_by") or "—",
            "summary": f"Approval requested → {ar.get('approver_role') or 'operations'}",
            "details": {"note": ar.get("note"), "status": ar.get("status")},
        })
    if ar.get("decided_at"):
        events.append({
            "kind": "approval_decided",
            "at": ar["decided_at"],
            "by": ar.get("decided_by_name") or ar.get("decided_by") or "—",
            "summary": f"Approval {ar.get('status') or 'decided'} by {ar.get('approver_role') or 'operations'}",
            "details": {"comment": ar.get("decision_comment"), "status": ar.get("status")},
        })
    if task.get("updated_at") and task["updated_at"] != task.get("created_at"):
        events.append({
            "kind": "updated",
            "at": task["updated_at"],
            "by": "—",
            "summary": "Task updated",
            "details": {},
        })

    # Dedicated event log entries.
    async for ev in db.task_events.find({"task_id": task_id}, {"_id": 0}).sort("at", 1):
        # Normalise the timestamp to ISO string so the merge sort below
        # doesn't blow up comparing str vs datetime.
        v = ev.get("at")
        if hasattr(v, "isoformat"):
            ev["at"] = v.isoformat()
        events.append(ev)

    # Sort ascending and return.
    events.sort(key=lambda e: str(e.get("at") or ""))
    return {"task_id": task_id, "events": events}


async def _log_task_event(task_id: str, kind: str, user, summary: str, details: Optional[dict] = None):
    """Append one row to the `task_events` audit log. Best-effort, never raises."""
    try:
        from server import db
        await db.task_events.insert_one({
            "task_id": task_id,
            "kind": kind,
            "at": datetime.now(timezone.utc).isoformat(),
            "by": getattr(user, "user_id", None) or "—",
            "by_name": getattr(user, "name", None) or "—",
            "summary": summary,
            "details": details or {},
        })
    except Exception:
        pass
