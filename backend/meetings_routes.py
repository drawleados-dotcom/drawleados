"""
Meetings Routes - For scheduling and managing meetings
"""
from fastapi import APIRouter, HTTPException, Request, Body
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

meetings_router = APIRouter(prefix="/meetings", tags=["Meetings"])

# Database reference will be set from server.py
db = None

def init_meetings_db(database):
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


class MeetingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: str  # YYYY-MM-DD
    start_time: Optional[str] = None  # HH:MM (optional when all_day)
    end_time: Optional[str] = None  # HH:MM
    all_day: Optional[bool] = False
    recurrence: Optional[str] = "none"  # none | daily | weekly | monthly | yearly | weekdays | custom
    custom_recurrence: Optional[dict] = None  # {repeat_every, repeat_unit, repeat_on_days, ends, end_date, occurrences}
    meeting_type: str = "video"  # video, audio, in-person
    category: Optional[str] = "team"  # 'client' | 'team' (for filtering)
    meeting_link: Optional[str] = None  # Google Meet, Zoom, etc.
    location: Optional[str] = None  # For in-person meetings
    attendees: Optional[List[dict]] = []  # [{name, email, user_id}]
    project_id: Optional[str] = None  # Link to project
    client_name: Optional[str] = None  # for client meetings
    agenda: Optional[str] = None
    notes: Optional[str] = None
    reminder: Optional[int] = 15  # minutes before


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    meeting_type: Optional[str] = None
    meeting_link: Optional[str] = None
    location: Optional[str] = None
    attendees: Optional[List[dict]] = None
    project_id: Optional[str] = None
    agenda: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None  # scheduled, ongoing, completed, cancelled
    reminder: Optional[int] = None


@meetings_router.get("/")
async def get_all_meetings(request: Request):
    """Get all meetings"""
    user = await get_current_user(request)
    
    meetings = await db.meetings.find(
        {},
        {"_id": 0}
    ).sort([("date", -1), ("start_time", -1)]).to_list(length=500)
    
    return meetings


@meetings_router.get("/upcoming")
async def get_upcoming_meetings(request: Request):
    """Get upcoming meetings"""
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    meetings = await db.meetings.find(
        {
            "date": {"$gte": today},
            "status": {"$ne": "cancelled"}
        },
        {"_id": 0}
    ).sort([("date", 1), ("start_time", 1)]).to_list(length=100)
    
    return meetings


@meetings_router.get("/my-meetings")
async def get_my_meetings(request: Request):
    """Get meetings where user is organizer or attendee"""
    user = await get_current_user(request)
    
    meetings = await db.meetings.find(
        {"$or": [
            {"created_by": user["user_id"]},
            {"attendees.user_id": user["user_id"]}
        ]},
        {"_id": 0}
    ).sort([("date", -1), ("start_time", -1)]).to_list(length=200)
    
    return meetings


@meetings_router.post("/")
async def create_meeting(request: Request, meeting_data: MeetingCreate):
    """Create a new meeting"""
    user = await get_current_user(request)
    
    meeting_id = f"meet_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    meeting = {
        "meeting_id": meeting_id,
        "title": meeting_data.title,
        "description": meeting_data.description,
        "date": meeting_data.date,
        "start_time": meeting_data.start_time,
        "end_time": meeting_data.end_time,
        "all_day": bool(meeting_data.all_day),
        "recurrence": meeting_data.recurrence or "none",
        "custom_recurrence": meeting_data.custom_recurrence,
        "meeting_type": meeting_data.meeting_type,
        "category": meeting_data.category or "team",
        "meeting_link": meeting_data.meeting_link,
        "location": meeting_data.location,
        "attendees": meeting_data.attendees or [],
        "project_id": meeting_data.project_id,
        "client_name": meeting_data.client_name,
        "agenda": meeting_data.agenda,
        "notes": meeting_data.notes,
        "reminder": meeting_data.reminder,
        "status": "scheduled",
        "google_event_id": None,  # For future Google Calendar sync
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.meetings.insert_one(meeting)
    
    # Auto-create a "Meeting" task for each attendee with a user_id
    project_name = None
    if meeting_data.project_id:
        proj = await db.projects.find_one({"project_id": meeting_data.project_id}, {"_id": 0, "name": 1})
        project_name = proj.get("name") if proj else None
    task_ids = []
    for att in (meeting_data.attendees or []):
        uid = att.get("user_id") if isinstance(att, dict) else None
        if not uid:
            continue
        task = {
            "task_id": f"tsk_{uuid.uuid4().hex[:12]}",
            "task_name": meeting_data.title,
            "description": meeting_data.agenda or meeting_data.description or "",
            "priority": "medium",
            "type": "meeting",
            "category": "Meeting",
            "department": None,
            "project_id": meeting_data.project_id,
            "project_name": project_name,
            "assigned_to": uid,
            "assigned_by": user["user_id"],
            "created_by": user["user_id"],
            "due_date": meeting_data.date,
            "due_time": meeting_data.start_time,
            "all_day": False,
            "status": "pending",
            "work_link": meeting_data.meeting_link,
            "meeting_id": meeting_id,
            "meeting_category": meeting_data.category or "team",
            "created_at": now,
            "updated_at": now,
            "time_tracking": {"sessions": [], "total_seconds": 0},
        }
        await db.our_tasks.insert_one(task)
        task_ids.append(task["task_id"])
    if task_ids:
        await db.meetings.update_one({"meeting_id": meeting_id}, {"$set": {"task_ids": task_ids}})
        meeting["task_ids"] = task_ids
    
    # Return without _id
    meeting.pop("_id", None)
    return {"success": True, "meeting": meeting}


@meetings_router.put("/{meeting_id}")
async def update_meeting(request: Request, meeting_id: str, meeting_data: MeetingUpdate):
    """Update a meeting"""
    user = await get_current_user(request)
    
    meeting = await db.meetings.find_one({"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    update_data = {k: v for k, v in meeting_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": update_data}
    )
    
    updated = await db.meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    return {"success": True, "meeting": updated}


@meetings_router.put("/{meeting_id}/status")
async def update_meeting_status(request: Request, meeting_id: str, data: dict = Body(...)):
    """Quick update meeting status"""
    user = await get_current_user(request)
    
    status = data.get("status")
    if status not in ["scheduled", "ongoing", "completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    return {"success": True, "status": status}


@meetings_router.delete("/{meeting_id}")
async def delete_meeting(request: Request, meeting_id: str):
    """Delete a meeting"""
    user = await get_current_user(request)
    
    result = await db.meetings.delete_one({"meeting_id": meeting_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    return {"success": True, "message": "Meeting deleted"}


# Google Calendar Integration Placeholder
@meetings_router.get("/calendar/status")
async def get_calendar_status(request: Request):
    """Check if Google Calendar is connected"""
    user = await get_current_user(request)
    
    # Check if user has google_tokens
    user_data = await db.users.find_one({"user_id": user["user_id"]})
    is_connected = user_data.get("google_calendar_connected", False) if user_data else False
    
    return {
        "connected": is_connected,
        "message": "Google Calendar integration available" if is_connected else "Connect Google Calendar to sync meetings"
    }
