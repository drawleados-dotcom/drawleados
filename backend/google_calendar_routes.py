"""
Google Calendar Integration Routes
- OAuth flow for connecting user's Google Calendar
- Fetch calendar events for specific dates
"""
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import requests
import logging

# Google OAuth libraries
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

calendar_router = APIRouter(prefix="/oauth/calendar", tags=["Google Calendar"])

# Database reference
db = None

def init_calendar_db(database):
    global db
    db = database

# Environment variables
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CALENDAR_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CALENDAR_CLIENT_SECRET", "")
FRONTEND_URL = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")[0]

# Build redirect URI from environment
def get_redirect_uri():
    backend_url = os.environ.get("CORS_ORIGINS", "").split(",")[-1]  # Use the preview URL
    if "preview.emergentagent.com" in backend_url:
        return f"{backend_url}/api/oauth/calendar/callback"
    return "http://localhost:8001/api/oauth/calendar/callback"

SCOPES = [
    # calendar.events grants read/write on events (superset of calendar.readonly)
    # so lead appointments can be pushed to the user's calendar, not just listed.
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid"
]

# ============== MODELS ==============

class CalendarConnection(BaseModel):
    user_id: str
    google_email: str
    access_token: str
    refresh_token: Optional[str] = None
    token_expiry: Optional[datetime] = None
    connected_at: datetime
    is_active: bool = True

# ============== HELPER FUNCTIONS ==============

async def get_user_calendar_tokens(user_id: str):
    """Get stored Google Calendar tokens for a user"""
    connection = await db.calendar_connections.find_one(
        {"user_id": user_id, "is_active": True},
        {"_id": 0}
    )
    return connection

async def refresh_access_token(user_id: str, connection: dict) -> str:
    """Refresh expired access token"""
    if not connection.get("refresh_token"):
        return None
    
    try:
        response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": connection["refresh_token"],
                "grant_type": "refresh_token"
            }
        )
        
        if response.status_code == 200:
            token_data = response.json()
            new_access_token = token_data.get("access_token")
            
            # Update stored token
            await db.calendar_connections.update_one(
                {"user_id": user_id},
                {"$set": {
                    "access_token": new_access_token,
                    "token_expiry": datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 3600))
                }}
            )
            
            return new_access_token
    except Exception as e:
        logger.error(f"Failed to refresh token: {e}")
    
    return None

async def get_valid_credentials(user_id: str):
    """Get valid credentials, refreshing if necessary"""
    connection = await get_user_calendar_tokens(user_id)
    if not connection:
        return None
    
    # Check if token is expired
    token_expiry = connection.get("token_expiry")
    if token_expiry:
        if isinstance(token_expiry, str):
            token_expiry = datetime.fromisoformat(token_expiry.replace('Z', '+00:00'))
        if token_expiry.tzinfo is None:
            token_expiry = token_expiry.replace(tzinfo=timezone.utc)
        
        if datetime.now(timezone.utc) >= token_expiry:
            # Token expired, try to refresh
            new_token = await refresh_access_token(user_id, connection)
            if new_token:
                connection["access_token"] = new_token
            else:
                return None
    
    return connection

async def upsert_appointment_event(
    user_id: str,
    summary: str,
    start_iso: str,
    description: str = "",
    existing_event_id: Optional[str] = None,
    duration_minutes: int = 30,
) -> Optional[str]:
    """Create (or update) a Google Calendar event for a lead appointment.

    Best-effort: returns None (instead of raising) when the user hasn't
    connected Google Calendar, or the sync otherwise fails — calendar sync
    is a bonus on top of the appointment, not a requirement for saving it.
    """
    connection = await get_valid_credentials(user_id)
    if not connection:
        return None

    try:
        start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    except ValueError:
        logger.error(f"Invalid appointment datetime for calendar sync: {start_iso}")
        return None
    end_dt = start_dt + timedelta(minutes=duration_minutes)

    creds = Credentials(
        token=connection["access_token"],
        refresh_token=connection.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET
    )
    service = build("calendar", "v3", credentials=creds)
    event_body = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_dt.isoformat()},
        "end": {"dateTime": end_dt.isoformat()},
    }

    try:
        if existing_event_id:
            try:
                event = service.events().update(
                    calendarId="primary", eventId=existing_event_id, body=event_body
                ).execute()
            except Exception:
                # Event may have been deleted on the Google side — recreate it.
                event = service.events().insert(calendarId="primary", body=event_body).execute()
        else:
            event = service.events().insert(calendarId="primary", body=event_body).execute()
        return event.get("id")
    except Exception as e:
        logger.error(f"Failed to sync appointment to Google Calendar for user {user_id}: {e}")
        return None

# ============== OAUTH ROUTES ==============

@calendar_router.get("/connect")
async def start_oauth(request: Request):
    """Start Google OAuth flow for Calendar"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google Calendar not configured")
    
    redirect_uri = get_redirect_uri()
    
    # Build authorization URL
    auth_url = (
        "https://accounts.google.com/o/oauth2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={' '.join(SCOPES)}"
        f"&access_type=offline"
        f"&prompt=consent"
        f"&state={user.user_id}"  # Pass user_id in state
    )
    
    return {"authorization_url": auth_url}

@calendar_router.get("/callback")
async def oauth_callback(code: str, state: str = None, error: str = None):
    """Handle OAuth callback from Google"""
    if error:
        logger.error(f"OAuth error: {error}")
        return RedirectResponse(f"{FRONTEND_URL}/calendar?error={error}")
    
    if not code:
        return RedirectResponse(f"{FRONTEND_URL}/calendar?error=no_code")
    
    user_id = state  # User ID passed in state parameter
    if not user_id:
        return RedirectResponse(f"{FRONTEND_URL}/calendar?error=invalid_state")
    
    redirect_uri = get_redirect_uri()
    
    try:
        # Exchange code for tokens
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code"
            }
        )
        
        if token_response.status_code != 200:
            logger.error(f"Token exchange failed: {token_response.text}")
            return RedirectResponse(f"{FRONTEND_URL}/calendar?error=token_exchange_failed")
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3600)
        
        # Get user's Google email
        user_info_response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        google_email = "unknown"
        if user_info_response.status_code == 200:
            google_email = user_info_response.json().get("email", "unknown")
        
        # Store connection in database
        connection_doc = {
            "user_id": user_id,
            "google_email": google_email,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_expiry": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
            "connected_at": datetime.now(timezone.utc),
            "is_active": True
        }
        
        # Upsert the connection
        await db.calendar_connections.update_one(
            {"user_id": user_id},
            {"$set": connection_doc},
            upsert=True
        )
        
        logger.info(f"Google Calendar connected for user {user_id} ({google_email})")
        
        return RedirectResponse(f"{FRONTEND_URL}/calendar?connected=true")
        
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/calendar?error=callback_failed")

@calendar_router.get("/status")
async def get_connection_status(request: Request):
    """Check if user has connected Google Calendar"""
    from server import get_current_user
    user = await get_current_user(request)
    
    connection = await db.calendar_connections.find_one(
        {"user_id": user.user_id, "is_active": True},
        {"_id": 0, "access_token": 0, "refresh_token": 0}
    )
    
    if connection:
        return {
            "connected": True,
            "google_email": connection.get("google_email"),
            "connected_at": connection.get("connected_at")
        }
    
    return {"connected": False}

@calendar_router.post("/disconnect")
async def disconnect_calendar(request: Request):
    """Disconnect Google Calendar"""
    from server import get_current_user
    user = await get_current_user(request)
    
    await db.calendar_connections.update_one(
        {"user_id": user.user_id},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Google Calendar disconnected"}

# ============== CALENDAR EVENTS ROUTES ==============

@calendar_router.get("/events")
async def get_calendar_events(
    request: Request,
    date: Optional[str] = None,  # YYYY-MM-DD format
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get calendar events for a specific date or date range"""
    from server import get_current_user
    user = await get_current_user(request)
    
    connection = await get_valid_credentials(user.user_id)
    if not connection:
        return {"events": [], "connected": False, "message": "Google Calendar not connected"}
    
    try:
        # Build the service
        creds = Credentials(
            token=connection["access_token"],
            refresh_token=connection.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET
        )
        
        service = build("calendar", "v3", credentials=creds)
        
        # Determine time range
        if date:
            # Single date
            target_date = datetime.strptime(date, "%Y-%m-%d")
            time_min = target_date.replace(hour=0, minute=0, second=0).isoformat() + "Z"
            time_max = (target_date + timedelta(days=1)).replace(hour=0, minute=0, second=0).isoformat() + "Z"
        elif start_date and end_date:
            # Date range
            time_min = datetime.strptime(start_date, "%Y-%m-%d").replace(hour=0, minute=0, second=0).isoformat() + "Z"
            time_max = (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)).replace(hour=0, minute=0, second=0).isoformat() + "Z"
        else:
            # Default: current month
            now = datetime.now(timezone.utc)
            time_min = now.replace(day=1, hour=0, minute=0, second=0).isoformat()
            if now.month == 12:
                time_max = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0).isoformat()
            else:
                time_max = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0).isoformat()
        
        # Fetch events
        events_result = service.events().list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            maxResults=100,
            singleEvents=True,
            orderBy="startTime"
        ).execute()
        
        events = events_result.get("items", [])
        
        # Format events
        formatted_events = []
        for event in events:
            start = event.get("start", {})
            end = event.get("end", {})
            
            formatted_events.append({
                "event_id": event.get("id"),
                "title": event.get("summary", "No Title"),
                "description": event.get("description", ""),
                "start": start.get("dateTime") or start.get("date"),
                "end": end.get("dateTime") or end.get("date"),
                "is_all_day": "date" in start,
                "location": event.get("location", ""),
                "attendees": [a.get("email") for a in event.get("attendees", [])],
                "status": event.get("status"),
                "html_link": event.get("htmlLink")
            })
        
        return {
            "events": formatted_events,
            "connected": True,
            "google_email": connection.get("google_email")
        }
        
    except Exception as e:
        logger.error(f"Failed to fetch calendar events: {e}")
        return {
            "events": [],
            "connected": True,
            "error": str(e),
            "message": "Failed to fetch events. You may need to reconnect."
        }

@calendar_router.get("/events/date/{date}")
async def get_events_for_date(date: str, request: Request):
    """Get calendar events for a specific date"""
    from server import get_current_user
    user = await get_current_user(request)
    
    connection = await get_valid_credentials(user.user_id)
    if not connection:
        return {"events": [], "connected": False}
    
    try:
        creds = Credentials(
            token=connection["access_token"],
            refresh_token=connection.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET
        )
        
        service = build("calendar", "v3", credentials=creds)
        
        target_date = datetime.strptime(date, "%Y-%m-%d")
        time_min = target_date.replace(hour=0, minute=0, second=0).isoformat() + "Z"
        time_max = (target_date + timedelta(days=1)).replace(hour=0, minute=0, second=0).isoformat() + "Z"
        
        events_result = service.events().list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            maxResults=50,
            singleEvents=True,
            orderBy="startTime"
        ).execute()
        
        events = events_result.get("items", [])
        
        formatted_events = []
        for event in events:
            start = event.get("start", {})
            end = event.get("end", {})
            
            # Parse time for display
            start_time = start.get("dateTime") or start.get("date")
            end_time = end.get("dateTime") or end.get("date")
            
            formatted_events.append({
                "event_id": event.get("id"),
                "title": event.get("summary", "No Title"),
                "description": event.get("description", ""),
                "start": start_time,
                "end": end_time,
                "is_all_day": "date" in start,
                "location": event.get("location", ""),
                "html_link": event.get("htmlLink")
            })
        
        return {
            "date": date,
            "events": formatted_events,
            "connected": True,
            "count": len(formatted_events)
        }
        
    except Exception as e:
        logger.error(f"Failed to fetch events for date {date}: {e}")
        return {"events": [], "connected": True, "error": str(e)}
