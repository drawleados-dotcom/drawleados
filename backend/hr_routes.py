"""
HR Module Routes - Employee profiles, attendance, leave management, payroll, reviews
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Body
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import os
import asyncio
import logging

# Import notification service
from notification_service import (
    notify_leave_request, notify_leave_decision,
    notify_permission_request, notify_permission_decision,
    notify_attendance_approval_needed,
    notify_payslip_ready, notify_payslip_acknowledged, notify_payment_released,
    get_hr_admin_emails, get_finance_emails, get_user_email_by_id
)

# Email setup
try:
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY", "")
    SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@drawlead.com")
    EMAIL_ENABLED = bool(resend.api_key and resend.api_key != "re_your_api_key_here")
except ImportError:
    EMAIL_ENABLED = False
    SENDER_EMAIL = ""
    ADMIN_EMAIL = ""

logger = logging.getLogger(__name__)

hr_router = APIRouter(prefix="/hr", tags=["HR"])

# Database reference - will be set by init function
db = None

def init_hr_db(database):
    global db
    db = database

# ============== EMAIL HELPER ==============

async def send_email_notification(to_email: str, subject: str, html_content: str):
    """Send email notification asynchronously"""
    if not EMAIL_ENABLED:
        logger.info(f"Email disabled - would send to {to_email}: {subject}")
        return {"status": "mocked", "message": "Email service not configured"}
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}: {subject}")
        return {"status": "success", "email_id": result.get("id")}
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return {"status": "error", "message": str(e)}

# ============== MODELS ==============

class EmployeeProfile(BaseModel):
    user_id: str
    # Personal Info
    full_name: str
    email: str
    phone: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    date_of_birth: Optional[datetime] = None
    gender: str = ""
    blood_group: str = ""
    # Employment Info
    employee_id: str = ""
    designation: str = ""
    department: str = ""
    joining_date: Optional[datetime] = None
    employment_type: str = "full-time"  # full-time, part-time, contract
    reporting_manager: str = ""
    # Bank Details
    bank_name: str = ""
    account_number: str = ""
    ifsc_code: str = ""
    pan_number: str = ""
    # Emergency Contact
    emergency_contact_name: str = ""
    emergency_contact_phone: str = ""
    emergency_contact_relation: str = ""
    # Profile
    profile_picture: str = ""
    created_at: datetime
    updated_at: datetime

class EmployeeProfileUpdate(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

class AttendanceRecord(BaseModel):
    attendance_id: str
    user_id: str
    date: datetime
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    lunch_start: Optional[datetime] = None
    lunch_end: Optional[datetime] = None
    lunch_duration: float = 0.0  # in minutes
    sessions: list = []  # Multiple login/logout sessions [{clock_in, clock_out, hours}]
    work_location: str = "office"  # office, home
    total_hours: float = 0.0
    extra_hours: float = 0.0
    permission_hours: float = 0.0  # approved permission time
    status: str = "present"  # present, absent, half-day, on-leave
    approval_status: str = "auto"  # auto, pending_early_login, pending_early_logout, approved, rejected
    approval_notes: str = ""
    approved_by: Optional[str] = None
    notes: str = ""
    created_at: datetime

class ClockInRequest(BaseModel):
    work_location: str = "office"  # office, remote
    work_mode: Optional[str] = None  # Alternative field name for work_location
    login_time: Optional[str] = None  # HH:MM format - employee enters their time
    clock_in_time: Optional[str] = None  # Alternative field name
    time: Optional[str] = None  # Alternative field name for login_time
    outside_hours_reason: Optional[str] = None  # Reason if clocking in outside working hours

class ClockOutRequest(BaseModel):
    notes: Optional[str] = ""
    logout_time: Optional[str] = None  # HH:MM format
    time: Optional[str] = None  # Alternative field name for logout_time

class LunchStartRequest(BaseModel):
    lunch_start_time: Optional[str] = None  # HH:MM format
    time: Optional[str] = None  # Alternative field name for lunch_start_time

class LunchEndRequest(BaseModel):
    lunch_end_time: Optional[str] = None  # HH:MM format
    time: Optional[str] = None  # Alternative field name for lunch_end_time

class PermissionRequest(BaseModel):
    permission_id: str
    user_id: str
    user_name: str
    date: datetime
    hours_requested: float
    reason: str
    status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

class PermissionRequestCreate(BaseModel):
    date: datetime
    hours_requested: float
    reason: str

class HRSettings(BaseModel):
    settings_id: str
    standard_work_hours: float = 9.0
    standard_login_time: str = "09:00"  # HH:MM
    standard_logout_time: str = "18:00"  # HH:MM
    early_login_threshold_minutes: int = 60  # If login more than 60 mins early, needs approval
    grace_period_minutes: int = 15  # Grace period for late login
    default_lunch_duration: int = 60  # minutes
    overtime_rate_multiplier: float = 1.5
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None

class MonthlyCalendar(BaseModel):
    calendar_id: str
    month: int
    year: int
    holidays: List[Dict[str, Any]] = []  # [{date: "2026-01-26", name: "Republic Day"}]
    working_days: int = 0
    special_working_days: List[str] = []  # Saturdays that are working
    created_by: str
    created_at: datetime

class SalaryDetails(BaseModel):
    salary_id: str
    user_id: str
    basic_salary: float
    hra: float = 0.0
    conveyance: float = 0.0
    medical: float = 0.0
    special_allowance: float = 0.0
    pf_percentage: float = 12.0
    esi_percentage: float = 0.0
    professional_tax: float = 0.0
    effective_from: datetime
    created_by: str
    created_at: datetime

class PayslipCreate(BaseModel):
    user_id: str
    month: int
    year: int
    adjustments: Optional[Dict[str, float]] = None  # bonus, deductions, etc.

class PayslipApproval(BaseModel):
    payslip_id: str
    action: str  # approve, reject
    comments: Optional[str] = None

class LeaveRequest(BaseModel):
    leave_id: str
    user_id: str
    user_name: str
    leave_type: str  # casual, sick, earned, unpaid, wfh
    start_date: datetime
    end_date: datetime
    reason: str
    status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

class LeaveRequestCreate(BaseModel):
    leave_type: str
    start_date: datetime
    end_date: datetime
    reason: str

class LeaveBalance(BaseModel):
    user_id: str
    year: int
    casual_leave: int = 12
    sick_leave: int = 6
    earned_leave: int = 15
    unpaid_leave: int = 0
    casual_used: int = 0
    sick_used: int = 0
    earned_used: int = 0
    unpaid_used: int = 0

class Payslip(BaseModel):
    payslip_id: str
    user_id: str
    employee_name: str
    employee_id: str
    designation: str
    department: str
    joining_date: Optional[datetime] = None
    month: int
    year: int
    # Salary Components
    basic_salary: float
    hra: float = 0.0
    conveyance: float = 0.0
    medical: float = 0.0
    special_allowance: float = 0.0
    gross_salary: float
    # Deductions
    pf_deduction: float = 0.0
    esi_deduction: float = 0.0
    professional_tax: float = 0.0
    other_deductions: float = 0.0
    # Attendance Details
    total_working_days: int = 0
    days_present: int = 0
    days_absent: int = 0
    paid_leaves: int = 0
    extra_days: int = 0
    per_day_salary: float = 0.0
    # Net
    net_salary: float
    # Workflow
    status: str = "draft"  # draft, pending_super_admin, approved, acknowledged, pending_finance, payment_released
    created_by: str
    created_at: datetime
    super_admin_approved_by: Optional[str] = None
    super_admin_approved_at: Optional[datetime] = None
    employee_acknowledged_at: Optional[datetime] = None
    finance_released_by: Optional[str] = None
    finance_released_at: Optional[datetime] = None
    comments: str = ""

class PerformanceReview(BaseModel):
    review_id: str
    user_id: str
    reviewer_id: str
    reviewer_name: str
    quarter: str  # Q1, Q2, Q3, Q4
    year: int
    goals: List[Dict[str, Any]] = []
    achievements: str = ""
    areas_of_improvement: str = ""
    overall_rating: int = 0  # 1-5
    comments: str = ""
    employee_comments: str = ""
    status: str = "draft"  # draft, submitted, acknowledged
    created_at: datetime
    updated_at: datetime

# ============== AUTH HELPER ==============

async def get_current_user_hr(request: Request):
    """Get current user for HR routes"""
    from server import get_current_user
    return await get_current_user(request)

# ============== EMPLOYEE PROFILE ROUTES ==============

@hr_router.get("/profile")
async def get_my_profile(request: Request):
    """Get current employee's profile"""
    from server import get_current_user
    user = await get_current_user(request)
    
    profile = await db.employee_profiles.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    
    if not profile:
        # Create default profile from user data
        profile = {
            "user_id": user.user_id,
            "full_name": user.name,
            "email": user.email,
            "phone": "",
            "address": "",
            "city": "",
            "state": "",
            "pincode": "",
            "date_of_birth": None,
            "gender": "",
            "blood_group": "",
            "employee_id": f"EMP{user.user_id[-6:].upper()}",
            "designation": user.role.replace("_", " ").title(),
            "department": "",
            "joining_date": user.created_at if hasattr(user, 'created_at') else datetime.now(timezone.utc),
            "employment_type": "full-time",
            "reporting_manager": "",
            "bank_name": "",
            "account_number": "",
            "ifsc_code": "",
            "pan_number": "",
            "emergency_contact_name": "",
            "emergency_contact_phone": "",
            "emergency_contact_relation": "",
            "profile_picture": user.picture or "",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.employee_profiles.insert_one(profile)
        profile = await db.employee_profiles.find_one({"user_id": user.user_id}, {"_id": 0})
    
    return profile

@hr_router.put("/profile")
async def update_my_profile(update_data: EmployeeProfileUpdate, request: Request):
    """Update current employee's profile (limited fields)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.employee_profiles.update_one(
        {"user_id": user.user_id},
        {"$set": update_dict},
        upsert=True
    )
    
    return await db.employee_profiles.find_one({"user_id": user.user_id}, {"_id": 0})

@hr_router.get("/profile/{user_id}")
async def get_employee_profile(user_id: str, request: Request):
    """Get employee profile by ID (Admin only)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin", "project_manager"]:
        if current_user.user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    profile = await db.employee_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile

@hr_router.put("/profile/{user_id}/admin")
async def admin_update_profile(user_id: str, update_data: Dict[str, Any], request: Request):
    """Admin update employee profile (all fields)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.employee_profiles.update_one(
        {"user_id": user_id},
        {"$set": update_data},
        upsert=True
    )
    
    return await db.employee_profiles.find_one({"user_id": user_id}, {"_id": 0})

# ============== ATTENDANCE ROUTES ==============

async def get_hr_settings():
    """Get or create default HR settings"""
    settings = await db.hr_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "settings_id": f"hrs_{uuid.uuid4().hex[:8]}",
            "standard_work_hours": 9.0,
            "standard_login_time": "09:00",
            "standard_logout_time": "18:00",
            "early_login_threshold_minutes": 60,
            "grace_period_minutes": 15,
            "default_lunch_duration": 60,
            "overtime_rate_multiplier": 1.5,
            "updated_at": datetime.now(timezone.utc)
        }
        await db.hr_settings.insert_one(settings)
    return settings

def parse_time_string(time_str: str, base_date: datetime) -> datetime:
    """Parse time string and combine with date. Supports HH:MM, HH:MM AM/PM formats"""
    try:
        time_str = time_str.strip().upper()
        
        # Handle AM/PM format (e.g., "09:30 AM", "06:49 am")
        if 'AM' in time_str or 'PM' in time_str:
            # Remove AM/PM and parse
            is_pm = 'PM' in time_str
            time_str = time_str.replace('AM', '').replace('PM', '').strip()
            hours, minutes = map(int, time_str.split(':'))
            
            # Convert to 24-hour format
            if is_pm and hours != 12:
                hours += 12
            elif not is_pm and hours == 12:
                hours = 0
            
            return base_date.replace(hour=hours, minute=minutes, second=0, microsecond=0)
        else:
            # Standard HH:MM format
            hours, minutes = map(int, time_str.split(':'))
            return base_date.replace(hour=hours, minute=minutes, second=0, microsecond=0)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM or HH:MM AM/PM")

@hr_router.post("/attendance/clock-in")
async def clock_in(clock_data: ClockInRequest, request: Request):
    """Clock in for the day with time entry"""
    from server import get_current_user
    user = await get_current_user(request)
    
    settings = await get_hr_settings()
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Check if already clocked in today
    existing = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    })
    
    # Check if already clocked in (but not clocked out) - block duplicate clock-in
    if existing and existing.get("clock_in") and not existing.get("clock_out"):
        raise HTTPException(status_code=400, detail="Already clocked in. Please clock out first.")
    
    # Determine login time (support all field names)
    login_time_str = clock_data.login_time or clock_data.clock_in_time or clock_data.time
    if login_time_str:
        now = parse_time_string(login_time_str, today)
    else:
        now = datetime.now(timezone.utc)
    
    # Determine work location/mode (support both field names)
    work_mode = clock_data.work_mode or clock_data.work_location or "office"
    
    # Check if early login needs approval
    standard_login = parse_time_string(settings["standard_login_time"], today)
    early_threshold = timedelta(minutes=settings["early_login_threshold_minutes"])
    
    approval_status = "auto"
    if now < (standard_login - early_threshold):
        approval_status = "pending_early_login"
    
    if existing:
        # Multiple sessions support - previous session already saved in clock_out
        sessions = existing.get("sessions", [])
        
        # Update for new clock-in (new session)
        update_data = {
            "clock_in": now,
            "clock_out": None,
            "work_mode": work_mode,
            "work_location": work_mode,
            "approval_status": approval_status
        }
        if clock_data.outside_hours_reason:
            update_data["outside_hours_reason"] = clock_data.outside_hours_reason
            
        await db.attendance.update_one(
            {"attendance_id": existing["attendance_id"]},
            {"$set": update_data}
        )
        attendance_id = existing["attendance_id"]
    else:
        # First clock-in of the day
        attendance_id = f"att_{uuid.uuid4().hex[:12]}"
        attendance_doc = {
            "attendance_id": attendance_id,
            "user_id": user.user_id,
            "user_name": user.name,
            "date": today,
            "clock_in": now,
            "clock_out": None,
            "lunch_start": None,
            "lunch_end": None,
            "lunch_duration": 0.0,
            "sessions": [],
            "work_location": work_mode,
            "work_mode": work_mode,
            "total_hours": 0.0,
            "extra_hours": 0.0,
            "permission_hours": 0.0,
            "status": "present",
            "approval_status": approval_status,
            "approval_notes": "",
            "approved_by": None,
            "notes": "",
            "outside_hours_reason": clock_data.outside_hours_reason or None,
            "created_at": datetime.now(timezone.utc)
        }
        await db.attendance.insert_one(attendance_doc)
    
    # Send notification if early login needs approval
    if approval_status == "pending_early_login":
        hr_emails = await get_hr_admin_emails(db)
        asyncio.create_task(notify_attendance_approval_needed(
            employee_name=user.name,
            date=today.strftime("%Y-%m-%d"),
            approval_type="early_login",
            hr_admin_emails=hr_emails,
            attendance_id=attendance_id
        ))
    
    result = await db.attendance.find_one({"attendance_id": attendance_id}, {"_id": 0})
    result["needs_approval"] = approval_status != "auto"
    return result

@hr_router.post("/attendance/lunch-start")
@hr_router.post("/attendance/lunch-out")
async def lunch_start(lunch_data: LunchStartRequest, request: Request):
    """Record lunch start time"""
    from server import get_current_user
    user = await get_current_user(request)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    existing = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    })
    
    if not existing:
        raise HTTPException(status_code=400, detail="Please clock in first")
    
    if existing.get("lunch_start"):
        raise HTTPException(status_code=400, detail="Lunch already started")
    
    # Support both field names
    lunch_time_str = lunch_data.lunch_start_time or lunch_data.time
    if lunch_time_str:
        lunch_time = parse_time_string(lunch_time_str, today)
    else:
        lunch_time = datetime.now(timezone.utc)
    
    await db.attendance.update_one(
        {"attendance_id": existing["attendance_id"]},
        {"$set": {"lunch_start": lunch_time, "lunch_out": lunch_time}}
    )
    
    return await db.attendance.find_one({"attendance_id": existing["attendance_id"]}, {"_id": 0})

@hr_router.post("/attendance/lunch-end")
@hr_router.put("/attendance/lunch-in")
async def lunch_end(lunch_data: LunchEndRequest, request: Request):
    """Record lunch end time"""
    from server import get_current_user
    user = await get_current_user(request)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    existing = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    })
    
    if not existing:
        raise HTTPException(status_code=400, detail="Please clock in first")
    
    if not existing.get("lunch_start"):
        raise HTTPException(status_code=400, detail="Lunch not started yet")
    
    if existing.get("lunch_end"):
        raise HTTPException(status_code=400, detail="Lunch already ended")
    
    # Support both field names
    lunch_end_str = lunch_data.lunch_end_time or lunch_data.time
    if lunch_end_str:
        end_time = parse_time_string(lunch_end_str, today)
    else:
        end_time = datetime.now(timezone.utc)
    
    lunch_start = existing.get("lunch_start")
    if isinstance(lunch_start, str):
        lunch_start = datetime.fromisoformat(lunch_start.replace('Z', '+00:00'))
    if lunch_start.tzinfo is None:
        lunch_start = lunch_start.replace(tzinfo=timezone.utc)
    
    lunch_duration = (end_time - lunch_start).total_seconds() / 60  # minutes
    
    await db.attendance.update_one(
        {"attendance_id": existing["attendance_id"]},
        {"$set": {
            "lunch_end": end_time,
            "lunch_in": end_time,
            "lunch_duration": round(lunch_duration, 0)
        }}
    )
    
    return await db.attendance.find_one({"attendance_id": existing["attendance_id"]}, {"_id": 0})

@hr_router.post("/attendance/clock-out")
@hr_router.put("/attendance/clock-out")
async def clock_out(clock_data: ClockOutRequest, request: Request):
    """Clock out - supports multiple clock-out per day"""
    from server import get_current_user
    user = await get_current_user(request)
    
    settings = await get_hr_settings()
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    existing = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    })
    
    if not existing:
        raise HTTPException(status_code=400, detail="No clock-in record found for today")
    
    if not existing.get("clock_in"):
        raise HTTPException(status_code=400, detail="Please clock in first")
    
    if existing.get("clock_out"):
        raise HTTPException(status_code=400, detail="Already clocked out. Clock in again to start a new session.")
    
    # Determine logout time (support both field names)
    logout_time_str = clock_data.logout_time or clock_data.time
    if logout_time_str:
        now = parse_time_string(logout_time_str, today)
    else:
        now = datetime.now(timezone.utc)
    
    clock_in_time = existing.get("clock_in")
    if isinstance(clock_in_time, str):
        clock_in_time = datetime.fromisoformat(clock_in_time.replace('Z', '+00:00'))
    if clock_in_time.tzinfo is None:
        clock_in_time = clock_in_time.replace(tzinfo=timezone.utc)
    
    # Calculate this session's hours
    session_seconds = (now - clock_in_time).total_seconds()
    
    # Only subtract lunch from the FIRST session (when sessions array is empty)
    # Lunch is taken once per day, typically during the first session
    sessions = existing.get("sessions", [])
    if len(sessions) == 0:
        # First session - deduct lunch
        lunch_duration_seconds = existing.get("lunch_duration", 0) * 60
    else:
        # Subsequent sessions - lunch already deducted
        lunch_duration_seconds = 0
    
    permission_hours_seconds = existing.get("permission_hours", 0) * 3600
    
    session_work_seconds = session_seconds - lunch_duration_seconds - permission_hours_seconds
    session_hours = session_work_seconds / 3600
    
    # Calculate total hours including previous sessions
    previous_hours = sum(s.get("hours", 0) for s in sessions)
    total_hours = previous_hours + session_hours
    
    # Calculate extra hours (over standard 9 hours)
    standard_hours = settings["standard_work_hours"]
    extra_hours = max(0, total_hours - standard_hours)
    
    # Check if early logout needs approval
    standard_logout = parse_time_string(settings["standard_logout_time"], today)
    approval_status = existing.get("approval_status", "auto")
    
    # If clocking out early (before standard hours completed)
    if total_hours < standard_hours and approval_status == "auto":
        approval_status = "pending_early_logout"
    
    # Save this session
    current_session = {
        "clock_in": existing["clock_in"],
        "clock_out": now,
        "hours": round(session_hours, 2)
    }
    sessions.append(current_session)
    
    await db.attendance.update_one(
        {"attendance_id": existing["attendance_id"]},
        {"$set": {
            "clock_out": now,
            "sessions": sessions,
            "total_hours": round(total_hours, 2),
            "extra_hours": round(extra_hours, 2),
            "approval_status": approval_status,
            "notes": clock_data.notes or ""
        }}
    )
    
    # Send notification if early logout needs approval
    if approval_status == "pending_early_logout":
        hr_emails = await get_hr_admin_emails(db)
        asyncio.create_task(notify_attendance_approval_needed(
            employee_name=user.name,
            date=today.strftime("%Y-%m-%d"),
            approval_type="early_logout",
            hr_admin_emails=hr_emails,
            attendance_id=existing["attendance_id"]
        ))
    
    result = await db.attendance.find_one({"attendance_id": existing["attendance_id"]}, {"_id": 0})
    result["needs_approval"] = "pending" in approval_status
    return result

@hr_router.get("/attendance/today")
async def get_today_attendance(request: Request):
    """Get today's attendance status"""
    from server import get_current_user
    user = await get_current_user(request)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    settings = await get_hr_settings()
    
    attendance = await db.attendance.find_one({
        "user_id": user.user_id,
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    }, {"_id": 0})
    
    return {
        "attendance": attendance,
        "settings": {
            "standard_login_time": settings["standard_login_time"],
            "standard_logout_time": settings["standard_logout_time"],
            "standard_work_hours": settings["standard_work_hours"],
            "default_lunch_duration": settings["default_lunch_duration"]
        }
    }

@hr_router.get("/attendance/history")
async def get_attendance_history(
    request: Request,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get attendance history with full details"""
    from server import get_current_user
    user = await get_current_user(request)
    
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year
    
    start_date = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    if target_month == 12:
        end_date = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    records = await db.attendance.find({
        "user_id": user.user_id,
        "date": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).sort("date", -1).to_list(100)
    
    # Get calendar for the month
    calendar = await db.hr_calendar.find_one({
        "month": target_month,
        "year": target_year
    }, {"_id": 0})
    
    # Get leave records for the month
    leaves = await db.leave_requests.find({
        "user_id": user.user_id,
        "status": "approved",
        "start_date": {"$lte": end_date},
        "end_date": {"$gte": start_date}
    }, {"_id": 0}).to_list(50)
    
    # Get permissions for the month
    permissions = await db.permissions.find({
        "user_id": user.user_id,
        "status": "approved",
        "date": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(50)
    
    # Calculate summary
    total_working_days = calendar.get("working_days", 22) if calendar else 22
    holidays = calendar.get("holidays", []) if calendar else []
    
    # Get monthly leave allocation from calendar (admin-configurable)
    monthly_casual_allocation = calendar.get("monthly_casual_leave", 2) if calendar else 2
    monthly_sick_allocation = calendar.get("monthly_sick_leave", 2) if calendar else 2
    
    present_days = len([r for r in records if r.get("status") == "present" and r.get("approval_status") in ["auto", "approved"]])
    
    # Count leaves by type
    casual_used = len([l for l in leaves if l.get("leave_type") == "casual"])
    sick_used = len([l for l in leaves if l.get("leave_type") == "sick"])
    unpaid_used = len([l for l in leaves if l.get("leave_type") == "unpaid"])
    
    # Total Absent should ONLY count actual absences:
    # 1. Unpaid leaves (extra leaves beyond allocation)
    # 2. Days explicitly marked as "absent" in attendance records
    # NOT pending/future working days
    actual_absent_records = len([r for r in records if r.get("status") == "absent"])
    total_absent = actual_absent_records + unpaid_used
    
    total_hours = sum(r.get("total_hours", 0) for r in records)
    extra_hours = sum(r.get("extra_hours", 0) for r in records)
    
    # Get leave balance
    balance = await db.leave_balance.find_one({
        "user_id": user.user_id,
        "year": target_year
    }, {"_id": 0})
    
    return {
        "records": records,
        "leaves": leaves,
        "permissions": permissions,
        "calendar": {
            "holidays": holidays,
            "working_days": total_working_days,
            "monthly_casual_leave": monthly_casual_allocation,
            "monthly_sick_leave": monthly_sick_allocation
        },
        "summary": {
            "total_working_days": total_working_days,
            "present": present_days,
            "absent": total_absent,  # Only actual absences (unpaid/extra leaves, marked absent)
            "casual_leave": casual_used,
            "sick_leave": sick_used,
            "monthly_casual_allocation": monthly_casual_allocation,
            "monthly_sick_allocation": monthly_sick_allocation,
            "total_hours": round(total_hours, 2),
            "extra_hours": round(extra_hours, 2),
            "average_hours": round(total_hours / present_days, 2) if present_days > 0 else 0
        },
        "leave_balance": balance or {
            "casual_leave": 12,
            "sick_leave": 6,
            "casual_used": casual_used,
            "sick_used": sick_used
        }
    }

@hr_router.get("/attendance/report")
async def get_attendance_report(request: Request, user_id: Optional[str] = None):
    """Get comprehensive attendance report (Admin)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    target_user_id = user_id or current_user.user_id
    
    # Non-admins can only see their own report
    if current_user.role not in ["admin", "super_admin", "project_manager", "hr_manager"]:
        target_user_id = current_user.user_id
    
    # Get last 6 months of attendance
    now = datetime.now(timezone.utc)
    six_months_ago = now - timedelta(days=180)
    
    records = await db.attendance.find({
        "user_id": target_user_id,
        "date": {"$gte": six_months_ago}
    }, {"_id": 0}).sort("date", -1).to_list(500)
    
    # Calculate monthly summary
    monthly_summary = {}
    for record in records:
        date = record.get("date")
        if isinstance(date, str):
            date = datetime.fromisoformat(date.replace('Z', '+00:00'))
        month_key = f"{date.year}-{date.month:02d}"
        
        if month_key not in monthly_summary:
            monthly_summary[month_key] = {
                "days_present": 0,
                "total_hours": 0,
                "extra_hours": 0,
                "wfh_days": 0,
                "wfo_days": 0,
                "pending_approvals": 0
            }
        
        monthly_summary[month_key]["days_present"] += 1
        monthly_summary[month_key]["total_hours"] += record.get("total_hours", 0)
        monthly_summary[month_key]["extra_hours"] += record.get("extra_hours", 0)
        if record.get("work_location") == "home":
            monthly_summary[month_key]["wfh_days"] += 1
        else:
            monthly_summary[month_key]["wfo_days"] += 1
        if "pending" in record.get("approval_status", ""):
            monthly_summary[month_key]["pending_approvals"] += 1
    
    return {
        "records": records,
        "monthly_summary": monthly_summary
    }

# Get attendance detail for a specific date with tasks
@hr_router.get("/attendance/date-detail/{date}")
async def get_attendance_date_detail(date: str, request: Request, user_id: Optional[str] = None):
    """Get attendance details for a specific date including tasks completed"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    target_user_id = user_id or current_user.user_id
    
    # Non-admins can only see their own detail
    if current_user.role not in ["admin", "super_admin", "project_manager", "hr_manager"]:
        target_user_id = current_user.user_id
    
    try:
        # Parse date
        target_date = datetime.strptime(date, "%Y-%m-%d")
        next_date = target_date + timedelta(days=1)
        
        # Get attendance record for that date
        attendance = await db.attendance.find_one({
            "user_id": target_user_id,
            "date": {
                "$gte": target_date,
                "$lt": next_date
            }
        }, {"_id": 0})
        
        # Get tasks worked on that day (from time_tracking sessions)
        tasks = await db.bde_tasks.find({
            "$or": [
                {"created_by": target_user_id},
                {"assigned_to": target_user_id}
            ],
            "time_tracking.sessions": {
                "$elemMatch": {
                    "start": {"$gte": target_date.isoformat(), "$lt": next_date.isoformat()}
                }
            }
        }, {"_id": 0}).to_list(100)
        
        # Also get tasks that were updated/worked on that day
        tasks_updated = await db.bde_tasks.find({
            "$or": [
                {"created_by": target_user_id},
                {"assigned_to": target_user_id}
            ],
            "updated_at": {
                "$gte": target_date.isoformat(),
                "$lt": next_date.isoformat()
            }
        }, {"_id": 0}).to_list(100)
        
        # Merge and dedupe tasks
        task_ids = set()
        all_tasks = []
        for task in tasks + tasks_updated:
            if task["task_id"] not in task_ids:
                task_ids.add(task["task_id"])
                # Calculate time spent on this day
                day_seconds = 0
                if task.get("time_tracking", {}).get("sessions"):
                    for session in task["time_tracking"]["sessions"]:
                        session_start = session.get("start", "")
                        if session_start.startswith(date):
                            day_seconds += session.get("duration_seconds", 0)
                task["day_seconds"] = day_seconds
                task["day_time_formatted"] = f"{day_seconds // 3600}h {(day_seconds % 3600) // 60}m"
                all_tasks.append(task)
        
        # Get user info
        user_info = await db.users.find_one({"user_id": target_user_id}, {"_id": 0, "name": 1, "email": 1, "designation": 1})
        
        # Calculate work summary
        work_summary = {
            "total_work_hours": 0,
            "lunch_duration": 0,
            "extra_hours": 0
        }
        
        if attendance:
            work_summary["total_work_hours"] = attendance.get("total_hours", 0)
            work_summary["lunch_duration"] = attendance.get("lunch_duration", 0)
            work_summary["extra_hours"] = attendance.get("extra_hours", 0)
        
        return {
            "date": date,
            "user": user_info,
            "attendance": attendance,
            "tasks": all_tasks,
            "work_summary": work_summary
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get calendar attendance for a specific user (monthly view)
@hr_router.get("/attendance/calendar/{year}/{month}")
async def get_attendance_calendar(year: int, month: int, request: Request, user_id: Optional[str] = None):
    """Get attendance calendar view for a month"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    target_user_id = user_id or current_user.user_id
    
    # Non-admins can only see their own calendar
    if current_user.role not in ["admin", "super_admin", "project_manager", "hr_manager"]:
        target_user_id = current_user.user_id
    
    try:
        import calendar as cal
        
        # Get first and last day of month
        first_day = datetime(year, month, 1, tzinfo=timezone.utc)
        last_day_num = cal.monthrange(year, month)[1]
        last_day = datetime(year, month, last_day_num, 23, 59, 59, tzinfo=timezone.utc)
        
        # Get all attendance records for the month
        records = await db.attendance.find({
            "user_id": target_user_id,
            "date": {"$gte": first_day, "$lte": last_day}
        }, {"_id": 0}).to_list(31)
        
        # Create calendar data
        calendar_data = {}
        for record in records:
            date = record.get("date")
            if isinstance(date, datetime):
                date_str = date.strftime("%Y-%m-%d")
            else:
                date_str = str(date)[:10]
            
            calendar_data[date_str] = {
                "status": record.get("status", "unknown"),
                "clock_in": record.get("clock_in"),
                "clock_out": record.get("clock_out"),
                "total_hours": record.get("total_hours", 0),
                "work_mode": record.get("work_mode", "office"),
                "approval_status": record.get("approval_status", "auto")
            }
        
        # Get leave records for the month
        leaves = await db.leave_requests.find({
            "user_id": target_user_id,
            "status": "approved",
            "$or": [
                {"start_date": {"$gte": first_day.strftime("%Y-%m-%d"), "$lte": last_day.strftime("%Y-%m-%d")}},
                {"end_date": {"$gte": first_day.strftime("%Y-%m-%d"), "$lte": last_day.strftime("%Y-%m-%d")}}
            ]
        }, {"_id": 0}).to_list(50)
        
        # Get user info
        user_info = await db.users.find_one({"user_id": target_user_id}, {"_id": 0, "name": 1, "email": 1, "designation": 1})
        
        # Calculate summary
        total_present = len([r for r in records if r.get("status") == "present"])
        total_hours = sum(r.get("total_hours", 0) for r in records)
        
        return {
            "year": year,
            "month": month,
            "user": user_info,
            "calendar_data": calendar_data,
            "leaves": leaves,
            "summary": {
                "total_present": total_present,
                "total_hours": round(total_hours, 2),
                "avg_hours_per_day": round(total_hours / max(total_present, 1), 2)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============== PERMISSION REQUEST ROUTES ==============

@hr_router.post("/permission/request")
async def create_permission_request(perm_data: PermissionRequestCreate, request: Request):
    """Request permission (time off during work)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    permission_id = f"perm_{uuid.uuid4().hex[:12]}"
    
    perm_doc = {
        "permission_id": permission_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "date": perm_data.date,
        "hours_requested": perm_data.hours_requested,
        "reason": perm_data.reason,
        "status": "pending",
        "approved_by": None,
        "approved_at": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.permissions.insert_one(perm_doc)
    
    # Send notification to HR Admin
    hr_emails = await get_hr_admin_emails(db)
    perm_date = perm_data.date
    if isinstance(perm_date, datetime):
        perm_date = perm_date.strftime("%Y-%m-%d")
    asyncio.create_task(notify_permission_request(
        requester_name=user.name,
        date=str(perm_date),
        hours=perm_data.hours_requested,
        reason=perm_data.reason,
        hr_admin_emails=hr_emails,
        permission_id=permission_id
    ))
    
    return {"message": "Permission request submitted", "permission_id": permission_id}

@hr_router.get("/permission/requests")
async def get_permission_requests(request: Request, status: Optional[str] = None):
    """Get my permission requests"""
    from server import get_current_user
    user = await get_current_user(request)
    
    query = {"user_id": user.user_id}
    if status:
        query["status"] = status
    
    requests = await db.permissions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

# ============== HR ADMIN ROUTES ==============

@hr_router.get("/admin/attendance/pending-approvals")
async def get_pending_approvals(request: Request):
    """Get all pending attendance approvals (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get pending attendance approvals
    attendance_pending = await db.attendance.find({
        "approval_status": {"$in": ["pending_early_login", "pending_early_logout"]}
    }, {"_id": 0}).sort("date", -1).to_list(100)
    
    # Get pending permission requests
    permission_pending = await db.permissions.find({
        "status": "pending"
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Get pending leave requests
    leave_pending = await db.leave_requests.find({
        "status": "pending"
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {
        "attendance": attendance_pending,
        "permissions": permission_pending,
        "leaves": leave_pending
    }

@hr_router.post("/admin/attendance/approve/{attendance_id}")
async def approve_attendance(attendance_id: str, request: Request, action: str = "approve", notes: str = ""):
    """Approve or reject attendance (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    attendance = await db.attendance.find_one({"attendance_id": attendance_id})
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    await db.attendance.update_one(
        {"attendance_id": attendance_id},
        {"$set": {
            "approval_status": new_status,
            "approval_notes": notes,
            "approved_by": user.user_id
        }}
    )
    
    return {"message": f"Attendance {new_status}", "attendance_id": attendance_id}

@hr_router.post("/admin/permission/approve/{permission_id}")
async def approve_permission(permission_id: str, request: Request, action: str = "approve"):
    """Approve or reject permission request (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    permission = await db.permissions.find_one({"permission_id": permission_id})
    if not permission:
        raise HTTPException(status_code=404, detail="Permission request not found")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    await db.permissions.update_one(
        {"permission_id": permission_id},
        {"$set": {
            "status": new_status,
            "approved_by": user.user_id,
            "approved_at": datetime.now(timezone.utc)
        }}
    )
    
    # If approved, update the attendance record
    if new_status == "approved":
        perm_date = permission.get("date")
        if isinstance(perm_date, str):
            perm_date = datetime.fromisoformat(perm_date.replace('Z', '+00:00'))
        day_start = perm_date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        await db.attendance.update_one(
            {
                "user_id": permission.get("user_id"),
                "date": {"$gte": day_start, "$lt": day_end}
            },
            {"$inc": {"permission_hours": permission.get("hours_requested", 0)}}
        )
    
    # Notify employee about the decision
    employee_email = await get_user_email_by_id(db, permission.get("user_id"))
    if employee_email:
        perm_date = permission.get("date")
        if isinstance(perm_date, datetime):
            perm_date = perm_date.strftime("%Y-%m-%d")
        asyncio.create_task(notify_permission_decision(
            employee_email=employee_email,
            employee_name=permission.get("user_name", "Employee"),
            date=str(perm_date),
            hours=permission.get("hours_requested", 0),
            status=new_status,
            approved_by=user.name
        ))
    
    return {"message": f"Permission {new_status}", "permission_id": permission_id}

@hr_router.get("/admin/attendance/all")
async def get_all_attendance(
    request: Request,
    date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get all employees' attendance for a day or month (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc)
    
    if date:
        # Specific date
        try:
            target_date = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
        except:
            target_date = now
        start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
    else:
        # Month view
        target_month = month or now.month
        target_year = year or now.year
        start = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
        if target_month == 12:
            end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    records = await db.attendance.find({
        "date": {"$gte": start, "$lt": end}
    }, {"_id": 0}).sort("date", -1).to_list(1000)
    
    # Get all users for reference
    users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "department": 1}).to_list(500)
    user_map = {u["user_id"]: u for u in users}
    
    # Enrich records with user info
    for record in records:
        user_info = user_map.get(record.get("user_id"), {})
        record["employee_name"] = user_info.get("name", record.get("user_name", "Unknown"))
        record["department"] = user_info.get("department", "")
    
    return {
        "records": records,
        "total_employees": len(users),
        "present_today": len([r for r in records if r.get("status") == "present"]) if date else None
    }

# ============== HR SETTINGS ROUTES ==============

@hr_router.get("/admin/settings")
async def get_settings(request: Request):
    """Get HR settings"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return await get_hr_settings()

@hr_router.put("/admin/settings")
async def update_settings(request: Request, settings_data: dict):
    """Update HR settings"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    current = await get_hr_settings()
    
    allowed_fields = [
        "standard_work_hours", "standard_login_time", "standard_logout_time",
        "early_login_threshold_minutes", "grace_period_minutes",
        "default_lunch_duration", "overtime_rate_multiplier"
    ]
    
    update_data = {k: v for k, v in settings_data.items() if k in allowed_fields}
    update_data["updated_by"] = user.user_id
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.hr_settings.update_one(
        {"settings_id": current["settings_id"]},
        {"$set": update_data}
    )
    
    return await get_hr_settings()

@hr_router.get("/admin/work-settings")
async def get_work_settings(request: Request):
    """Get work settings for clock-in validation (accessible to all authenticated users)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    settings = await get_hr_settings()
    
    # Return only the fields needed for clock-in validation
    return {
        "standard_login_time": settings.get("standard_login_time", "09:00"),
        "standard_logout_time": settings.get("standard_logout_time", "18:00"),
        "grace_period_minutes": settings.get("grace_period_minutes", 15)
    }


# ============== MY PROFILE TAB CONFIG ==============
# Controls which tabs are visible on the /hr (My Profile) page for all employees.
# Stored as a single document in collection `my_profile_tab_config`.

DEFAULT_MY_PROFILE_TABS = {
    "attendance": True,
    "profile": True,
    "requests": True,
    "payroll": True,
    "reviews": True,
    "security": True,
}

@hr_router.get("/admin/my-profile-config")
async def get_my_profile_config(request: Request):
    """Get visibility config for My Profile tabs. Accessible to ALL authenticated users
    so the My Profile page itself can honour the config."""
    from server import get_current_user
    await get_current_user(request)
    doc = await db.my_profile_tab_config.find_one({"config_id": "default"}, {"_id": 0})
    if not doc:
        return {"config_id": "default", "tabs": DEFAULT_MY_PROFILE_TABS}
    # Merge with defaults so new tabs introduced later are visible by default
    merged = {**DEFAULT_MY_PROFILE_TABS, **(doc.get("tabs") or {})}
    return {"config_id": "default", "tabs": merged}

@hr_router.put("/admin/my-profile-config")
async def update_my_profile_config(request: Request, payload: dict):
    """Update visibility config for My Profile tabs. HR Admin / Super Admin only."""
    from server import get_current_user
    user = await get_current_user(request)
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    incoming = (payload or {}).get("tabs") or {}
    # Only persist known tab keys, coerce values to bool
    cleaned = {k: bool(v) for k, v in incoming.items() if k in DEFAULT_MY_PROFILE_TABS}
    # Backfill missing keys with defaults to keep doc complete
    for k, v in DEFAULT_MY_PROFILE_TABS.items():
        cleaned.setdefault(k, v)

    await db.my_profile_tab_config.update_one(
        {"config_id": "default"},
        {"$set": {
            "tabs": cleaned,
            "updated_by": user.user_id,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"config_id": "default", "tabs": cleaned}


# ============== CALENDAR ROUTES ==============

@hr_router.get("/admin/calendar/{year}/{month}")
async def get_calendar(year: int, month: int, request: Request):
    """Get monthly calendar with holidays"""
    from server import get_current_user
    user = await get_current_user(request)
    
    calendar = await db.hr_calendar.find_one({
        "month": month,
        "year": year
    }, {"_id": 0})
    
    if not calendar:
        # Create default calendar
        import calendar as cal
        _, days_in_month = cal.monthrange(year, month)
        
        # Count weekdays (Mon-Fri)
        working_days = 0
        for day in range(1, days_in_month + 1):
            weekday = cal.weekday(year, month, day)
            if weekday < 5:  # Mon-Fri
                working_days += 1
        
        calendar = {
            "calendar_id": f"cal_{year}_{month:02d}",
            "month": month,
            "year": year,
            "holidays": [],
            "working_days": working_days,
            "special_working_days": [],
            "monthly_casual_leave": 2,
            "monthly_sick_leave": 2,
            "created_by": user.user_id,
            "created_at": datetime.now(timezone.utc)
        }
        await db.hr_calendar.insert_one(calendar)
        # Re-fetch without _id
        calendar = await db.hr_calendar.find_one({
            "month": month,
            "year": year
        }, {"_id": 0})
    
    # Ensure defaults for existing calendars without leave allocation
    if "monthly_casual_leave" not in calendar:
        calendar["monthly_casual_leave"] = 2
    if "monthly_sick_leave" not in calendar:
        calendar["monthly_sick_leave"] = 2
    
    return calendar

@hr_router.put("/admin/calendar/{year}/{month}")
async def update_calendar(year: int, month: int, request: Request, calendar_data: dict):
    """Update monthly calendar (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    calendar = await db.hr_calendar.find_one({"month": month, "year": year})
    
    if calendar:
        await db.hr_calendar.update_one(
            {"month": month, "year": year},
            {"$set": {
                "holidays": calendar_data.get("holidays", []),
                "working_days": calendar_data.get("working_days", calendar.get("working_days", 22)),
                "special_working_days": calendar_data.get("special_working_days", []),
                "monthly_casual_leave": calendar_data.get("monthly_casual_leave", calendar.get("monthly_casual_leave", 2)),
                "monthly_sick_leave": calendar_data.get("monthly_sick_leave", calendar.get("monthly_sick_leave", 2))
            }}
        )
    else:
        await db.hr_calendar.insert_one({
            "calendar_id": f"cal_{year}_{month:02d}",
            "month": month,
            "year": year,
            "holidays": calendar_data.get("holidays", []),
            "working_days": calendar_data.get("working_days", 22),
            "special_working_days": calendar_data.get("special_working_days", []),
            "monthly_casual_leave": calendar_data.get("monthly_casual_leave", 2),
            "monthly_sick_leave": calendar_data.get("monthly_sick_leave", 2),
            "created_by": user.user_id,
            "created_at": datetime.now(timezone.utc)
        })
    
    return await db.hr_calendar.find_one({"month": month, "year": year}, {"_id": 0})

# ============== SALARY DETAILS ROUTES ==============

@hr_router.get("/admin/salary/{user_id}")
async def get_salary_details(user_id: str, request: Request):
    """Get employee salary details (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    salary = await db.salary_details.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    return salary or {"message": "No salary details found"}

@hr_router.post("/admin/salary/{user_id}")
async def set_salary_details(user_id: str, request: Request, salary_data: dict):
    """Set or update employee salary details (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.salary_details.find_one({"user_id": user_id})
    
    salary_doc = {
        "user_id": user_id,
        "basic_salary": salary_data.get("basic_salary", 0),
        "hra": salary_data.get("hra", 0),
        "conveyance": salary_data.get("conveyance", 0),
        "medical": salary_data.get("medical", 0),
        "special_allowance": salary_data.get("special_allowance", 0),
        "pf_percentage": salary_data.get("pf_percentage", 12.0),
        "esi_percentage": salary_data.get("esi_percentage", 0),
        "professional_tax": salary_data.get("professional_tax", 0),
        "effective_from": datetime.now(timezone.utc),
        "created_by": user.user_id,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if existing:
        await db.salary_details.update_one(
            {"user_id": user_id},
            {"$set": salary_doc}
        )
    else:
        salary_doc["salary_id"] = f"sal_{uuid.uuid4().hex[:12]}"
        salary_doc["created_at"] = datetime.now(timezone.utc)
        await db.salary_details.insert_one(salary_doc)
    
    return await db.salary_details.find_one({"user_id": user_id}, {"_id": 0})

# ============== PAYSLIP ROUTES ==============

@hr_router.post("/admin/payslip/generate")
async def generate_payslip(request: Request, payslip_data: dict):
    """Generate payslip for an employee (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user_id = payslip_data.get("user_id")
    month = payslip_data.get("month")
    year = payslip_data.get("year")
    
    # Check if payslip already exists
    existing = await db.payslips.find_one({
        "user_id": user_id,
        "month": month,
        "year": year
    })
    if existing:
        mode = existing.get("creation_mode", "generated")
        raise HTTPException(status_code=400, detail=f"Payslip already exists ({mode}) for this month")
    
    # Get employee details
    employee = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get profile for additional details
    profile = await db.employee_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Get salary details
    salary = await db.salary_details.find_one({"user_id": user_id}, {"_id": 0})
    if not salary:
        raise HTTPException(status_code=400, detail="Salary details not found for employee")
    
    # Get attendance for the month
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    attendance_records = await db.attendance.find({
        "user_id": user_id,
        "date": {"$gte": start_date, "$lt": end_date},
        "approval_status": {"$in": ["auto", "approved"]}
    }, {"_id": 0}).to_list(50)
    
    # Get calendar for working days
    calendar = await db.hr_calendar.find_one({
        "month": month,
        "year": year
    }, {"_id": 0})
    
    total_working_days = calendar.get("working_days", 22) if calendar else 22
    days_present = len(attendance_records)
    
    # Get approved leaves for the month
    leaves = await db.leave_requests.find({
        "user_id": user_id,
        "status": "approved",
        "start_date": {"$lte": end_date},
        "end_date": {"$gte": start_date}
    }, {"_id": 0}).to_list(20)
    
    paid_leaves = len([l for l in leaves if l.get("leave_type") in ["casual", "sick", "earned"]])
    days_absent = max(0, total_working_days - days_present - paid_leaves)
    
    # Calculate extra hours/days
    total_extra_hours = sum(r.get("extra_hours", 0) for r in attendance_records)
    extra_days = int(total_extra_hours / 9)  # 9 hours = 1 extra day
    
    # Calculate salary
    basic = salary.get("basic_salary", 0)
    hra = salary.get("hra", 0)
    conveyance = salary.get("conveyance", 0)
    medical = salary.get("medical", 0)
    special = salary.get("special_allowance", 0)
    
    gross = basic + hra + conveyance + medical + special
    per_day = gross / total_working_days if total_working_days > 0 else 0
    
    # Calculate deductions
    pf = (basic * salary.get("pf_percentage", 12) / 100)
    esi = (gross * salary.get("esi_percentage", 0) / 100)
    pt = salary.get("professional_tax", 0)
    
    # Apply adjustments
    adjustments = payslip_data.get("adjustments", {})
    bonus = adjustments.get("bonus", 0)
    other_deductions = adjustments.get("deductions", 0)
    
    # Calculate net based on attendance
    effective_days = days_present + paid_leaves + extra_days
    actual_gross = per_day * min(effective_days, total_working_days)
    total_deductions = pf + esi + pt + other_deductions
    net_salary = actual_gross + bonus - total_deductions
    
    # Create payslip
    payslip_id = f"pay_{uuid.uuid4().hex[:12]}"
    payslip_doc = {
        "payslip_id": payslip_id,
        "user_id": user_id,
        "employee_name": employee.get("name", ""),
        "employee_id": profile.get("employee_id", "") if profile else "",
        "designation": profile.get("designation", employee.get("role", "")) if profile else employee.get("role", ""),
        "department": profile.get("department", "") if profile else "",
        "joining_date": profile.get("joining_date") if profile else None,
        "month": month,
        "year": year,
        # Salary components
        "basic_salary": basic,
        "hra": hra,
        "conveyance": conveyance,
        "medical": medical,
        "special_allowance": special,
        "gross_salary": gross,
        # Deductions
        "pf_deduction": round(pf, 2),
        "esi_deduction": round(esi, 2),
        "professional_tax": pt,
        "other_deductions": other_deductions,
        "bonus": bonus,
        # Attendance
        "total_working_days": total_working_days,
        "days_present": days_present,
        "days_absent": days_absent,
        "paid_leaves": paid_leaves,
        "extra_days": extra_days,
        "per_day_salary": round(per_day, 2),
        # Net
        "net_salary": round(net_salary, 2),
        # Workflow
        "status": "draft",
        "creation_mode": "generated",
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc),
        "comments": payslip_data.get("comments", "")
    }
    
    await db.payslips.insert_one(payslip_doc)
    
    return await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})


# -----------------------------------------------------------------------------
# Manual payslip creation (HR types every field) — keeps the same Drawlead PDF
# -----------------------------------------------------------------------------
@hr_router.post("/admin/payslip/manual")
async def create_manual_payslip(request: Request, payload: dict):
    """Create a fully manual payslip — HR Admin enters every field."""
    from server import get_current_user
    user = await get_current_user(request)
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    user_id = payload.get("user_id")
    month = int(payload.get("month") or 0)
    year = int(payload.get("year") or 0)
    if not user_id or not month or not year:
        raise HTTPException(status_code=400, detail="user_id, month and year are required")
    # Reject duplicate month/year/employee combinations
    existing = await db.payslips.find_one({"user_id": user_id, "month": month, "year": year})
    if existing:
        mode = existing.get("creation_mode", "manual")
        raise HTTPException(status_code=400, detail=f"Payslip already exists ({mode}) for this month")
    employee = await db.users.find_one({"user_id": user_id}, {"_id": 0}) or {}
    profile = await db.employee_profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    payslip_id = f"pay_{uuid.uuid4().hex[:12]}"
    total_working_days = float(payload.get("total_working_days") or 0)
    days_absent = float(payload.get("days_absent") or 0)
    paid_leaves = float(payload.get("paid_leaves") or 0)
    extra_days = float(payload.get("extra_days") or 0)
    per_day = float(payload.get("per_day_salary") or 0)
    gross = float(payload.get("gross_salary") or (per_day * total_working_days))
    net_salary = float(payload.get("net_salary") or gross)
    doc = {
        "payslip_id": payslip_id,
        "user_id": user_id,
        "employee_name": payload.get("employee_name") or employee.get("name", ""),
        "employee_id": payload.get("employee_id") or profile.get("employee_id", ""),
        "designation": payload.get("designation") or profile.get("designation", ""),
        "department": payload.get("department") or profile.get("department", ""),
        "joining_date": payload.get("joining_date") or profile.get("joining_date"),
        "month": month,
        "year": year,
        # Salary
        "basic_salary": float(payload.get("basic_salary") or 0),
        "hra": float(payload.get("hra") or 0),
        "conveyance": float(payload.get("conveyance") or 0),
        "medical": float(payload.get("medical") or 0),
        "special_allowance": float(payload.get("special_allowance") or 0),
        "gross_salary": gross,
        # Deductions
        "pf_deduction": float(payload.get("pf_deduction") or 0),
        "esi_deduction": float(payload.get("esi_deduction") or 0),
        "professional_tax": float(payload.get("professional_tax") or 0),
        "other_deductions": float(payload.get("other_deductions") or 0),
        "bonus": float(payload.get("bonus") or 0),
        # Attendance
        "total_working_days": total_working_days,
        "days_present": float(payload.get("days_present") or (total_working_days - days_absent - paid_leaves)),
        "days_absent": days_absent,
        "paid_leaves": paid_leaves,
        "extra_days": extra_days,
        "per_day_salary": round(per_day, 2),
        # Net & metadata
        "net_salary": round(net_salary, 2),
        "salary_date": payload.get("salary_date"),
        "authorized_by": payload.get("authorized_by", "Vinoth Kumar Babu"),
        "authorized_title": payload.get("authorized_title", "CEO & FOUNDER"),
        "status": "draft",
        "creation_mode": "manual",
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc),
        "comments": payload.get("comments", ""),
    }
    await db.payslips.insert_one(doc)
    return await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})


@hr_router.get("/admin/payslip/exists/{user_id}/{year}/{month}")
async def payslip_exists(user_id: str, year: int, month: int, request: Request):
    """Check whether a payslip exists for {user, year, month} and return its mode."""
    from server import get_current_user
    await get_current_user(request)
    p = await db.payslips.find_one(
        {"user_id": user_id, "month": month, "year": year},
        {"_id": 0, "payslip_id": 1, "creation_mode": 1, "status": 1},
    )
    if not p:
        return {"exists": False, "mode": None}
    return {"exists": True, "mode": p.get("creation_mode", "generated"), "payslip_id": p.get("payslip_id"), "status": p.get("status")}


@hr_router.get("/admin/payslip/{payslip_id}/pdf")
async def download_payslip_pdf(payslip_id: str, request: Request):
    """Generate a Drawlead-styled PDF for a payslip."""
    from server import get_current_user
    from fastapi.responses import StreamingResponse
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas as pdf_canvas

    await get_current_user(request)
    p = await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Payslip not found")

    months = ["January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"]
    month_label = f"{months[(p.get('month') or 1) - 1]} {p.get('year') or ''}"

    buf = io.BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    W, H = A4
    GREEN = colors.HexColor("#10b981")
    DARK = colors.HexColor("#0f172a")
    GREY = colors.HexColor("#475569")
    LIGHT = colors.HexColor("#e2e8f0")

    # ---------------- Header ----------------
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(20 * mm, H - 22 * mm, "Drawlead")
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(20 * mm, H - 27 * mm, "Digital Transformation Company")
    c.setFillColor(GREY)
    c.setFont("Helvetica", 8)
    c.drawString(20 * mm, H - 33 * mm, "96, Canal Bank Rd, CIT Nagar West,")
    c.drawString(20 * mm, H - 37 * mm, "CIT Nagar, Chennai, Tamil Nadu 600035, India")

    # Center: month
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(W / 2, H - 25 * mm, month_label)

    # Right: Payslip + contact
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 22)
    c.drawRightString(W - 20 * mm, H - 22 * mm, "Payslip")
    c.setFillColor(GREY)
    c.setFont("Helvetica", 8)
    c.drawRightString(W - 20 * mm, H - 28 * mm, "vinoth@drawlead.com | 6383145061")

    # Divider
    c.setStrokeColor(LIGHT)
    c.setLineWidth(0.8)
    c.line(20 * mm, H - 42 * mm, W - 20 * mm, H - 42 * mm)

    # ---------------- Body — left employee block ----------------
    def kv_table(x, y, rows, label_w=42 * mm, val_w=48 * mm, row_h=8 * mm):
        c.setStrokeColor(LIGHT)
        c.setLineWidth(0.5)
        for i, (lbl, val) in enumerate(rows):
            yy = y - i * row_h
            c.rect(x, yy - row_h, label_w, row_h, stroke=1, fill=0)
            c.rect(x + label_w, yy - row_h, val_w, row_h, stroke=1, fill=0)
            c.setFillColor(GREY)
            c.setFont("Helvetica", 8.5)
            c.drawString(x + 2 * mm, yy - row_h + 2.8 * mm, str(lbl))
            c.setFillColor(DARK)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(x + label_w + 2 * mm, yy - row_h + 2.8 * mm, str(val))
        return y - len(rows) * row_h

    joining = p.get("joining_date") or ""
    if isinstance(joining, str) and len(joining) >= 10:
        try:
            d = datetime.fromisoformat(joining.replace("Z", "")).date()
            joining = d.strftime("%d %b %Y")
        except Exception:
            joining = joining[:10]
    elif joining:
        joining = str(joining)

    left_y = H - 50 * mm
    left_y_after = kv_table(20 * mm, left_y, [
        ("Employee Name", p.get("employee_name", "")),
        ("Joining Month/ Year", joining or "-"),
        ("Employee ID", p.get("employee_id", "")),
    ])

    # Right: Designation / Salary Date / Total Salary
    right_y_after = kv_table(W / 2 + 5 * mm, left_y, [
        ("Designation", p.get("designation", "")),
        ("Salary Date", p.get("salary_date") or ""),
        ("Total Salary", f"{int(p.get('gross_salary') or 0):,}"),
    ], label_w=35 * mm, val_w=45 * mm)

    # Monthly summary (left, below employee)
    monthly_y_start = left_y_after - 5 * mm
    monthly_rows = [
        ("Month", month_label),
        ("Total No.of Working Day", f"{int(p.get('total_working_days') or 0)}"),
        ("Absent", f"{int(p.get('days_absent') or 0)}"),
        ("Paid leave", f"{int(p.get('paid_leaves') or 0):02d}"),
        ("Total Net Working days", f"{int((p.get('total_working_days') or 0) - (p.get('days_absent') or 0))}"),
        ("Extra Days", f"{int(p.get('extra_days') or 0)}"),
    ]
    monthly_y_after = kv_table(20 * mm, monthly_y_start, monthly_rows)

    # Right: Days / Per day / Total table
    right_table_y = right_y_after - 5 * mm
    row_h = 8 * mm
    col_widths = [25 * mm, 20 * mm, 25 * mm, 25 * mm]
    rx = W / 2 + 5 * mm
    headers = ["", "Day", "Per day", "Total"]
    # header
    c.setFillColor(LIGHT)
    c.rect(rx, right_table_y - row_h, sum(col_widths), row_h, stroke=1, fill=1)
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 8.5)
    cx = rx
    for h, w in zip(headers, col_widths):
        c.drawString(cx + 2 * mm, right_table_y - row_h + 2.8 * mm, h)
        cx += w
    c.setStrokeColor(LIGHT)
    # rows
    per_day = p.get("per_day_salary") or (p.get("gross_salary", 0) / max(p.get("total_working_days") or 1, 1))
    rows_t = [
        ("Working Days", int(p.get("total_working_days") or 0), f"{per_day:,.2f}", f"{int(p.get('gross_salary') or 0):,}"),
        ("Extra", int(p.get("extra_days") or 0), 0, 0),
    ]
    for i, r in enumerate(rows_t):
        yy = right_table_y - (i + 2) * row_h
        cx = rx
        for w in col_widths:
            c.rect(cx, yy, w, row_h, stroke=1, fill=0)
            cx += w
        cx = rx
        for v, w in zip(r, col_widths):
            c.setFillColor(DARK)
            c.setFont("Helvetica", 9)
            c.drawString(cx + 2 * mm, yy + 2.8 * mm, str(v))
            cx += w

    # Total Net Pay box (right, prominent)
    tnp_y = right_table_y - (2 + 2) * row_h - 6 * mm
    c.setStrokeColor(LIGHT)
    c.setFillColor(colors.HexColor("#f0fdf4"))
    c.rect(rx, tnp_y - 18 * mm, sum(col_widths), 18 * mm, stroke=1, fill=1)
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(rx + 3 * mm, tnp_y - 6 * mm, "Total Net Pay:")
    c.setFillColor(colors.HexColor("#065f46"))
    c.setFont("Helvetica-Bold", 22)
    c.drawRightString(rx + sum(col_widths) - 3 * mm, tnp_y - 14 * mm, f"{int(p.get('net_salary') or 0):,}/-")

    # Authorized By
    auth_y = tnp_y - 30 * mm
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(rx, auth_y, "Authorized By")
    c.setFont("Helvetica", 10)
    c.drawString(rx, auth_y - 5 * mm, p.get("authorized_by") or "Vinoth Kumar Babu")
    c.setFillColor(GREY)
    c.setFont("Helvetica", 8)
    c.drawString(rx, auth_y - 9 * mm, p.get("authorized_title") or "CEO & FOUNDER")

    c.showPage()
    c.save()
    buf.seek(0)
    filename = f"payslip_{p.get('employee_name', 'employee').replace(' ', '_')}_{month_label.replace(' ', '_')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

@hr_router.get("/admin/payslips")
async def get_all_payslips(
    request: Request,
    month: Optional[int] = None,
    year: Optional[int] = None,
    status: Optional[str] = None
):
    """Get all payslips (HR Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    if status:
        query["status"] = status
    
    payslips = await db.payslips.find(query, {"_id": 0}).sort([("year", -1), ("month", -1)]).to_list(500)
    return payslips

@hr_router.put("/admin/payslip/{payslip_id}/submit")
async def submit_payslip_for_approval(payslip_id: str, request: Request):
    """Submit payslip for Super Admin approval"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    await db.payslips.update_one(
        {"payslip_id": payslip_id},
        {"$set": {
            "status": "pending_super_admin",
            "submitted_by": user.user_id,
            "submitted_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Payslip submitted for approval"}

@hr_router.put("/admin/payslip/{payslip_id}/approve")
async def approve_payslip(payslip_id: str, request: Request, action: str = "approve"):
    """Approve payslip (Super Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can approve payslips")
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    if action == "approve":
        await db.payslips.update_one(
            {"payslip_id": payslip_id},
            {"$set": {
                "status": "approved",
                "super_admin_approved_by": user.user_id,
                "super_admin_approved_at": datetime.now(timezone.utc)
            }}
        )
        return {"message": "Payslip approved"}
    else:
        await db.payslips.update_one(
            {"payslip_id": payslip_id},
            {"$set": {"status": "rejected"}}
        )
        return {"message": "Payslip rejected"}

@hr_router.delete("/admin/payslip/{payslip_id}")
async def delete_payslip(payslip_id: str, request: Request):
    """Delete a payslip (HR Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete payslips")
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    # Only allow deletion of draft, operations_review, or ceo_review status
    if payslip.get("status") in ["generated", "acknowledged", "pending_finance", "paid"]:
        raise HTTPException(status_code=400, detail="Cannot delete a finalized payslip")
    
    await db.payslips.delete_one({"payslip_id": payslip_id})
    return {"message": "Payslip deleted successfully"}

@hr_router.put("/admin/payslip/{payslip_id}/edit")
async def edit_payslip(payslip_id: str, request: Request, updates: dict):
    """Edit payslip details (HR Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit payslips")
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    # Only allow editing of draft, operations_review, or ceo_review status
    if payslip.get("status") in ["generated", "acknowledged", "pending_finance", "paid"]:
        raise HTTPException(status_code=400, detail="Cannot edit a finalized payslip")
    
    # Allowed fields to edit
    allowed_fields = ["hr_remarks", "comments", "adjustments"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = user.user_id
    
    await db.payslips.update_one(
        {"payslip_id": payslip_id},
        {"$set": update_data}
    )
    
    return await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})

@hr_router.post("/admin/payslip/{payslip_id}/regenerate")
async def regenerate_payslip(payslip_id: str, request: Request):
    """Regenerate payslip with latest attendance/salary data (HR Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized to regenerate payslips")
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    # Get fresh data
    employee_id = payslip.get("user_id")
    month = payslip.get("month")
    year = payslip.get("year")
    hr_remarks = payslip.get("hr_remarks", "")
    
    # Get latest salary record
    salary_record = await db.salary_history.find_one(
        {"user_id": employee_id},
        sort=[("effective_from", -1)]
    )
    base_salary = salary_record.get("amount", 0) if salary_record else 0
    
    # Get payroll settings
    settings = await db.payroll_settings.find_one({}) or {
        "pf_enabled": True,
        "pf_percentage": 12.0,
        "professional_tax_enabled": True,
        "professional_tax_amount": 200.0,
        "professional_tax_threshold": 15000.0,
        "standard_hours_per_day": 8.0
    }
    
    # Get company calendar for the month
    calendar = await db.company_calendars.find_one({"month": month, "year": year})
    total_working_days = calendar.get("working_days", 22) if calendar else 22
    holidays = len(calendar.get("holidays", [])) if calendar else 0
    
    # Get attendance records
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    attendance_records = await db.attendance.find({
        "user_id": employee_id,
        "date": {"$gte": start_date.isoformat()[:10], "$lt": end_date.isoformat()[:10]}
    }).to_list(31)
    
    days_present = len([r for r in attendance_records if r.get("status") in ["present", "wfh", "office"]])
    
    # Get approved leaves
    leaves = await db.leave_requests.find({
        "user_id": employee_id,
        "status": "approved",
        "$or": [
            {"start_date": {"$gte": start_date.isoformat()[:10], "$lt": end_date.isoformat()[:10]}},
            {"end_date": {"$gte": start_date.isoformat()[:10], "$lt": end_date.isoformat()[:10]}}
        ]
    }).to_list(10)
    
    casual_leaves = sum(1 for l in leaves if l.get("leave_type") == "casual")
    sick_leaves = sum(1 for l in leaves if l.get("leave_type") == "sick")
    
    # Calculate absent/LOP
    total_accounted = days_present + casual_leaves + sick_leaves + holidays
    absent_days = max(0, total_working_days - total_accounted)
    
    # Calculate hours
    standard_hours = settings.get("standard_hours_per_day", 8.0)
    expected_hours = days_present * standard_hours
    actual_hours = sum(r.get("total_hours", 0) for r in attendance_records)
    extra_hours = max(0, actual_hours - expected_hours)
    less_hours = max(0, expected_hours - actual_hours)
    
    # Salary calculations
    per_day_salary = base_salary / total_working_days if total_working_days > 0 else 0
    days_paid = days_present + casual_leaves + sick_leaves
    earned_salary = round(per_day_salary * days_paid, 2)
    
    # Deductions
    pf = round((base_salary * settings.get("pf_percentage", 12)) / 100, 2) if settings.get("pf_enabled") else 0
    professional_tax = settings.get("professional_tax_amount", 200) if settings.get("professional_tax_enabled") and base_salary > settings.get("professional_tax_threshold", 15000) else 0
    lop_deduction = round(per_day_salary * absent_days, 2)
    total_deductions = pf + professional_tax + lop_deduction
    net_salary = round(earned_salary - total_deductions, 2)
    
    # Update payslip with fresh calculations
    update_data = {
        "base_salary": base_salary,
        "attendance": {
            "total_working_days": total_working_days,
            "days_present": days_present,
            "casual_leaves": casual_leaves,
            "sick_leaves": sick_leaves,
            "absent_days": absent_days,
            "holidays": holidays,
            "extra_hours": extra_hours,
            "less_hours": less_hours
        },
        "calculation": {
            "per_day_salary": per_day_salary,
            "days_paid": days_paid,
            "earned_salary": earned_salary
        },
        "deductions": {
            "pf_enabled": settings.get("pf_enabled"),
            "pf_percentage": settings.get("pf_percentage"),
            "pf": pf,
            "professional_tax_enabled": settings.get("professional_tax_enabled"),
            "professional_tax": professional_tax,
            "lop_deduction": lop_deduction,
            "total_deductions": total_deductions
        },
        "net_salary": net_salary,
        "status": "draft",  # Reset to draft after regeneration
        "regenerated_at": datetime.now(timezone.utc),
        "regenerated_by": user.user_id,
        "operations_review": None,
        "ceo_review": None
    }
    
    await db.payslips.update_one(
        {"payslip_id": payslip_id},
        {"$set": update_data}
    )
    
    return await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})

@hr_router.put("/payslip/{payslip_id}/acknowledge")
async def acknowledge_payslip(payslip_id: str, request: Request):
    """Employee acknowledges payslip"""
    from server import get_current_user
    user = await get_current_user(request)
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id, "user_id": user.user_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    if payslip.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Payslip must be approved first")
    
    await db.payslips.update_one(
        {"payslip_id": payslip_id},
        {"$set": {
            "status": "acknowledged",
            "employee_acknowledged_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Payslip acknowledged"}

@hr_router.put("/admin/payslip/{payslip_id}/send-to-finance")
async def send_to_finance(payslip_id: str, request: Request):
    """Send acknowledged payslip to finance"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    if payslip.get("status") != "acknowledged":
        raise HTTPException(status_code=400, detail="Employee must acknowledge first")
    
    await db.payslips.update_one(
        {"payslip_id": payslip_id},
        {"$set": {
            "status": "pending_finance",
            "sent_to_finance_by": user.user_id,
            "sent_to_finance_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Payslip sent to finance"}

@hr_router.put("/finance/payslip/{payslip_id}/release")
async def release_payment(payslip_id: str, request: Request):
    """Finance releases payment"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payslip = await db.payslips.find_one({"payslip_id": payslip_id})
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    await db.payslips.update_one(
        {"payslip_id": payslip_id},
        {"$set": {
            "status": "payment_released",
            "finance_released_by": user.user_id,
            "finance_released_at": datetime.now(timezone.utc)
        }}
    )
    
    # Send email to employee
    employee = await db.users.find_one({"user_id": payslip.get("user_id")}, {"_id": 0})
    if employee:
        month_names = ["", "January", "February", "March", "April", "May", "June", 
                      "July", "August", "September", "October", "November", "December"]
        month_name = month_names[payslip.get("month", 1)]
        
        email_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Salary Credited - {month_name} {payslip.get('year')}</h2>
            <p>Dear {employee.get('name', 'Employee')},</p>
            <p>Your salary for {month_name} {payslip.get('year')} has been credited.</p>
            <p><strong>Net Amount:</strong> ₹{payslip.get('net_salary', 0):,.2f}</p>
            <p>Please login to Drawlead OS to view and download your payslip.</p>
            <br>
            <p>Best regards,<br>HR Team<br>Drawlead</p>
        </div>
        """
        
        await send_email_notification(
            employee.get("email", ""),
            f"Salary Credited - {month_name} {payslip.get('year')}",
            email_html
        )
    
    return {"message": "Payment released and employee notified"}

@hr_router.get("/payslips/my")
async def get_my_payslips(request: Request):
    """Get my payslips"""
    from server import get_current_user
    user = await get_current_user(request)
    
    payslips = await db.payslips.find(
        {"user_id": user.user_id, "status": {"$in": ["approved", "acknowledged", "pending_finance", "payment_released"]}},
        {"_id": 0}
    ).sort([("year", -1), ("month", -1)]).to_list(50)
    
    return payslips

@hr_router.get("/payslip/{payslip_id}")
async def get_payslip(payslip_id: str, request: Request):
    """Get single payslip"""
    from server import get_current_user
    user = await get_current_user(request)
    
    # HR Admin can see all, employees can see their own
    if user.role in ["admin", "super_admin", "hr_manager", "finance"]:
        payslip = await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})
    else:
        payslip = await db.payslips.find_one(
            {"payslip_id": payslip_id, "user_id": user.user_id},
            {"_id": 0}
        )
    
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    return payslip

# ============== LEAVE MANAGEMENT ROUTES ==============

@hr_router.post("/leave/request")
async def create_leave_request(leave_data: LeaveRequestCreate, request: Request):
    """Create a leave request"""
    from server import get_current_user
    user = await get_current_user(request)
    
    leave_id = f"leave_{uuid.uuid4().hex[:12]}"
    
    # Get user email
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "email": 1})
    user_email = user_doc.get("email", "") if user_doc else ""
    
    leave_doc = {
        "leave_id": leave_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "user_email": user_email,
        "leave_type": leave_data.leave_type,
        "start_date": leave_data.start_date,
        "end_date": leave_data.end_date,
        "reason": leave_data.reason,
        "status": "pending",
        "approved_by": None,
        "approved_at": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.leave_requests.insert_one(leave_doc)
    
    # Format dates
    start_str = leave_data.start_date.strftime("%d %b %Y") if hasattr(leave_data.start_date, 'strftime') else str(leave_data.start_date)[:10]
    end_str = leave_data.end_date.strftime("%d %b %Y") if hasattr(leave_data.end_date, 'strftime') else str(leave_data.end_date)[:10]
    
    # Send notification to HR Admins using the new notification service
    hr_emails = await get_hr_admin_emails(db)
    asyncio.create_task(notify_leave_request(
        requester_name=user.name,
        requester_email=user_email,
        leave_type=leave_data.leave_type,
        start_date=start_str,
        end_date=end_str,
        reason=leave_data.reason,
        hr_admin_emails=hr_emails,
        leave_id=leave_id
    ))
    
    return await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})

@hr_router.get("/leave/my-requests")
async def get_my_leave_requests(request: Request):
    """Get current user's leave requests"""
    from server import get_current_user
    user = await get_current_user(request)
    
    requests = await db.leave_requests.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return requests

@hr_router.get("/leave/pending")
async def get_pending_leave_requests(request: Request):
    """Get pending leave requests (Admin/Manager)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    requests = await db.leave_requests.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return requests

@hr_router.put("/leave/{leave_id}/approve")
async def approve_leave_request(leave_id: str, request: Request):
    """Approve a leave request"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    leave = await db.leave_requests.find_one({"leave_id": leave_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    await db.leave_requests.update_one(
        {"leave_id": leave_id},
        {"$set": {
            "status": "approved",
            "approved_by": user.user_id,
            "approved_by_name": user.name,
            "approved_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update leave balance
    start = leave["start_date"]
    end = leave["end_date"]
    if isinstance(start, str):
        start = datetime.fromisoformat(start.replace('Z', '+00:00'))
    if isinstance(end, str):
        end = datetime.fromisoformat(end.replace('Z', '+00:00'))
    days = (end - start).days + 1
    
    leave_type = leave["leave_type"]
    year = start.year
    
    await db.leave_balance.update_one(
        {"user_id": leave["user_id"], "year": year},
        {"$inc": {f"{leave_type}_used": days}},
        upsert=True
    )
    
    # Send approval notification to employee using new service
    start_str = start.strftime("%d %b %Y")
    end_str = end.strftime("%d %b %Y")
    employee_email = leave.get("user_email", "")
    
    if employee_email:
        asyncio.create_task(notify_leave_decision(
            employee_email=employee_email,
            employee_name=leave.get("user_name", "Employee"),
            leave_type=leave_type,
            start_date=start_str,
            end_date=end_str,
            status="approved",
            approved_by=user.name
        ))
    
    return await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})

@hr_router.put("/leave/{leave_id}/reject")
async def reject_leave_request(leave_id: str, request: Request, reason: str = ""):
    """Reject a leave request"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    leave = await db.leave_requests.find_one({"leave_id": leave_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    await db.leave_requests.update_one(
        {"leave_id": leave_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": reason,
            "approved_by": user.user_id,
            "approved_by_name": user.name,
            "approved_at": datetime.now(timezone.utc)
        }}
    )
    
    # Send rejection notification to employee
    start = leave["start_date"]
    end = leave["end_date"]
    if isinstance(start, str):
        start = datetime.fromisoformat(start.replace('Z', '+00:00'))
    if isinstance(end, str):
        end = datetime.fromisoformat(end.replace('Z', '+00:00'))
    
    start_str = start.strftime("%d %b %Y")
    end_str = end.strftime("%d %b %Y")
    leave_type = leave.get("leave_type", "leave")
    employee_email = leave.get("user_email", "")
    
    if employee_email:
        asyncio.create_task(notify_leave_decision(
            employee_email=employee_email,
            employee_name=leave.get("user_name", "Employee"),
            leave_type=leave_type,
            start_date=start_str,
            end_date=end_str,
            status="rejected",
            approved_by=user.name
        ))
    
    return await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})

# ============== ENHANCED LEAVE APPROVAL WORKFLOW ==============

@hr_router.get("/leave/{leave_id}/tasks")
async def get_tasks_for_leave_period(leave_id: str, request: Request):
    """Get tasks assigned to user during the leave period"""
    from server import get_current_user
    user = await get_current_user(request)
    
    # Only managers and admins can view this
    if user.role not in ["admin", "super_admin", "project_manager", "hr_manager", "operations_admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    leave = await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    # Parse dates
    start = leave.get("start_date")
    end = leave.get("end_date")
    if isinstance(start, str):
        start = datetime.fromisoformat(start.replace('Z', '+00:00'))
    if isinstance(end, str):
        end = datetime.fromisoformat(end.replace('Z', '+00:00'))
    
    start_str = start.strftime("%Y-%m-%d")
    end_str = end.strftime("%Y-%m-%d")
    
    # Get tasks assigned to this user during the leave period
    tasks = await db.bde_tasks.find({
        "assigned_to": leave.get("user_id"),
        "due_date": {"$gte": start_str, "$lte": end_str},
        "status": {"$ne": "completed"}
    }, {"_id": 0}).to_list(50)
    
    return {
        "leave_id": leave_id,
        "user_name": leave.get("user_name"),
        "leave_dates": {"start": start_str, "end": end_str},
        "tasks_count": len(tasks),
        "tasks": tasks
    }

@hr_router.post("/leave/{leave_id}/send-for-verification")
async def send_leave_for_verification(leave_id: str, request: Request):
    """HR sends leave request to Operations Admin for task verification"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    leave = await db.leave_requests.find_one({"leave_id": leave_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if leave.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Leave request is not pending")
    
    # Update status to pending_verification
    await db.leave_requests.update_one(
        {"leave_id": leave_id},
        {"$set": {
            "status": "pending_verification",
            "sent_for_verification_by": user.user_id,
            "sent_for_verification_at": datetime.now(timezone.utc)
        }}
    )
    
    return await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})

@hr_router.get("/leave/pending-verification")
async def get_pending_verification_leaves(request: Request):
    """Get leave requests pending verification (for Operations Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "operations_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    requests = await db.leave_requests.find(
        {"status": "pending_verification"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with task counts
    for req in requests:
        start = req.get("start_date")
        end = req.get("end_date")
        if isinstance(start, str):
            start = datetime.fromisoformat(start.replace('Z', '+00:00'))
        if isinstance(end, str):
            end = datetime.fromisoformat(end.replace('Z', '+00:00'))
        
        start_str = start.strftime("%Y-%m-%d")
        end_str = end.strftime("%Y-%m-%d")
        
        tasks_count = await db.bde_tasks.count_documents({
            "assigned_to": req.get("user_id"),
            "due_date": {"$gte": start_str, "$lte": end_str},
            "status": {"$ne": "completed"}
        })
        req["pending_tasks_count"] = tasks_count
    
    return requests

class TaskReassignment(BaseModel):
    task_id: str
    new_assignee_id: str
    remarks: Optional[str] = ""

class LeaveVerification(BaseModel):
    verified: bool
    task_reassignments: Optional[List[TaskReassignment]] = []
    verification_remarks: Optional[str] = ""

@hr_router.post("/leave/{leave_id}/verify")
async def verify_leave_tasks(leave_id: str, verification: LeaveVerification, request: Request):
    """Operations Admin verifies and optionally reassigns tasks"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "operations_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    leave = await db.leave_requests.find_one({"leave_id": leave_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if leave.get("status") != "pending_verification":
        raise HTTPException(status_code=400, detail="Leave is not pending verification")
    
    # Reassign tasks if needed
    reassignment_results = []
    for reassignment in verification.task_reassignments:
        # Get new assignee details
        new_assignee = await db.users.find_one(
            {"user_id": reassignment.new_assignee_id},
            {"_id": 0, "name": 1}
        )
        
        if new_assignee:
            await db.bde_tasks.update_one(
                {"task_id": reassignment.task_id},
                {"$set": {
                    "assigned_to": reassignment.new_assignee_id,
                    "assigned_to_name": new_assignee.get("name"),
                    "reassigned_by": user.user_id,
                    "reassigned_at": datetime.now(timezone.utc),
                    "reassignment_reason": f"Leave: {leave.get('user_name')} - {reassignment.remarks}"
                }}
            )
            reassignment_results.append({
                "task_id": reassignment.task_id,
                "new_assignee": new_assignee.get("name"),
                "status": "reassigned"
            })
    
    # Update leave status based on verification result
    new_status = "verified_pending_approval" if verification.verified else "verification_rejected"
    
    await db.leave_requests.update_one(
        {"leave_id": leave_id},
        {"$set": {
            "status": new_status,
            "verified_by": user.user_id,
            "verified_by_name": user.name,
            "verified_at": datetime.now(timezone.utc),
            "verification_remarks": verification.verification_remarks,
            "task_reassignments": [r.dict() for r in verification.task_reassignments] if verification.task_reassignments else []
        }}
    )
    
    return {
        "leave_id": leave_id,
        "status": new_status,
        "reassignments": reassignment_results,
        "message": "Leave verified and tasks reassigned" if verification.verified else "Leave verification rejected"
    }

@hr_router.put("/leave/{leave_id}/final-approve")
async def final_approve_leave(leave_id: str, request: Request, remarks: str = ""):
    """Final approval after verification (HR/Admin)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    leave = await db.leave_requests.find_one({"leave_id": leave_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    # Can approve from pending or verified_pending_approval status
    if leave.get("status") not in ["pending", "verified_pending_approval"]:
        raise HTTPException(status_code=400, detail="Leave cannot be approved in current state")
    
    await db.leave_requests.update_one(
        {"leave_id": leave_id},
        {"$set": {
            "status": "approved",
            "approved_by": user.user_id,
            "approved_by_name": user.name,
            "approved_at": datetime.now(timezone.utc),
            "approval_remarks": remarks
        }}
    )
    
    # Update leave balance (same logic as before)
    start = leave["start_date"]
    end = leave["end_date"]
    if isinstance(start, str):
        start = datetime.fromisoformat(start.replace('Z', '+00:00'))
    if isinstance(end, str):
        end = datetime.fromisoformat(end.replace('Z', '+00:00'))
    days = (end - start).days + 1
    
    leave_type = leave["leave_type"]
    year = start.year
    
    await db.leave_balance.update_one(
        {"user_id": leave["user_id"], "year": year},
        {"$inc": {f"{leave_type}_used": days}},
        upsert=True
    )
    
    # Send notification
    employee_email = leave.get("user_email", "")
    if employee_email:
        start_str = start.strftime("%d %b %Y")
        end_str = end.strftime("%d %b %Y")
        asyncio.create_task(notify_leave_decision(
            employee_email=employee_email,
            employee_name=leave.get("user_name", "Employee"),
            leave_type=leave_type,
            start_date=start_str,
            end_date=end_str,
            status="approved",
            approved_by=user.name
        ))
    
    return await db.leave_requests.find_one({"leave_id": leave_id}, {"_id": 0})

@hr_router.get("/leave/balance")
async def get_leave_balance(request: Request):
    """Get leave balance for current year"""
    from server import get_current_user
    user = await get_current_user(request)
    
    year = datetime.now(timezone.utc).year
    
    balance = await db.leave_balance.find_one(
        {"user_id": user.user_id, "year": year},
        {"_id": 0}
    )
    
    if not balance:
        # Create default balance
        balance = {
            "user_id": user.user_id,
            "year": year,
            "casual_leave": 12,
            "sick_leave": 6,
            "earned_leave": 15,
            "casual_used": 0,
            "sick_used": 0,
            "earned_used": 0
        }
        await db.leave_balance.insert_one(balance)
        balance = await db.leave_balance.find_one(
            {"user_id": user.user_id, "year": year},
            {"_id": 0}
        )
    
    return balance

@hr_router.get("/leave/monthly-balance")
async def get_monthly_leave_balance(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    """Get monthly leave balance (2 casual + 2 sick per month)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year
    
    # Get start and end of month
    start_of_month = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    if target_month == 12:
        end_of_month = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_of_month = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    # Count approved leaves taken this month
    leaves_this_month = await db.leave_requests.find({
        "user_id": user.user_id,
        "status": "approved",
        "$or": [
            {"start_date": {"$gte": start_of_month.isoformat(), "$lt": end_of_month.isoformat()}},
            {"end_date": {"$gte": start_of_month.isoformat(), "$lt": end_of_month.isoformat()}}
        ]
    }, {"_id": 0}).to_list(50)
    
    # Calculate days used per type
    casual_used = 0
    sick_used = 0
    
    for leave in leaves_this_month:
        leave_type = leave.get("leave_type", "")
        start = leave.get("start_date")
        end = leave.get("end_date")
        
        # Parse dates
        if isinstance(start, str):
            start = datetime.fromisoformat(start.replace('Z', '+00:00'))
        if isinstance(end, str):
            end = datetime.fromisoformat(end.replace('Z', '+00:00'))
        
        # Count days that fall within this month
        days = 0
        current = start
        while current <= end:
            if start_of_month <= current < end_of_month:
                days += 1
            current += timedelta(days=1)
        
        if leave_type == "casual":
            casual_used += days
        elif leave_type == "sick":
            sick_used += days
    
    # Monthly allocation: 2 casual + 2 sick
    monthly_casual = 2
    monthly_sick = 2
    
    return {
        "month": target_month,
        "year": target_year,
        "monthly_allocation": {
            "casual": monthly_casual,
            "sick": monthly_sick
        },
        "used": {
            "casual": casual_used,
            "sick": sick_used
        },
        "remaining": {
            "casual": max(0, monthly_casual - casual_used),
            "sick": max(0, monthly_sick - sick_used)
        },
        "leaves_this_month": leaves_this_month
    }

# ============== PAYROLL ROUTES ==============

@hr_router.get("/payslips")
async def get_my_payslips(request: Request):
    """Get all payslips for current user"""
    from server import get_current_user
    user = await get_current_user(request)
    
    payslips = await db.payslips.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort([("year", -1), ("month", -1)]).to_list(100)
    
    return payslips

@hr_router.get("/payslips/{year}/{month}")
async def get_payslip(year: int, month: int, request: Request):
    """Get specific payslip"""
    from server import get_current_user
    user = await get_current_user(request)
    
    payslip = await db.payslips.find_one({
        "user_id": user.user_id,
        "year": year,
        "month": month
    }, {"_id": 0})
    
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    return payslip

@hr_router.post("/payslips/generate")
async def generate_payslip(payslip_data: Dict[str, Any], request: Request):
    """Generate payslip (Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    payslip_id = f"pay_{uuid.uuid4().hex[:12]}"
    
    gross = payslip_data.get("basic_salary", 0) + payslip_data.get("hra", 0) + payslip_data.get("other_allowances", 0)
    deductions = payslip_data.get("pf_deduction", 0) + payslip_data.get("tax_deduction", 0) + payslip_data.get("other_deductions", 0)
    
    payslip_doc = {
        "payslip_id": payslip_id,
        "user_id": payslip_data["user_id"],
        "month": payslip_data["month"],
        "year": payslip_data["year"],
        "basic_salary": payslip_data.get("basic_salary", 0),
        "hra": payslip_data.get("hra", 0),
        "other_allowances": payslip_data.get("other_allowances", 0),
        "gross_salary": gross,
        "pf_deduction": payslip_data.get("pf_deduction", 0),
        "tax_deduction": payslip_data.get("tax_deduction", 0),
        "other_deductions": payslip_data.get("other_deductions", 0),
        "net_salary": gross - deductions,
        "payment_date": None,
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.payslips.insert_one(payslip_doc)
    return await db.payslips.find_one({"payslip_id": payslip_id}, {"_id": 0})

# ============== PERFORMANCE REVIEW ROUTES ==============

@hr_router.get("/reviews")
async def get_my_reviews(request: Request):
    """Get all performance reviews for current user"""
    from server import get_current_user
    user = await get_current_user(request)
    
    reviews = await db.performance_reviews.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort([("year", -1), ("quarter", -1)]).to_list(50)
    
    return reviews

@hr_router.get("/reviews/{review_id}")
async def get_review(review_id: str, request: Request):
    """Get specific review"""
    from server import get_current_user
    user = await get_current_user(request)
    
    review = await db.performance_reviews.find_one(
        {"review_id": review_id},
        {"_id": 0}
    )
    
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Check access
    if review["user_id"] != user.user_id and user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return review

@hr_router.post("/reviews")
async def create_review(review_data: Dict[str, Any], request: Request):
    """Create performance review (Admin/Manager only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    review_id = f"review_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    review_doc = {
        "review_id": review_id,
        "user_id": review_data["user_id"],
        "reviewer_id": user.user_id,
        "reviewer_name": user.name,
        "quarter": review_data["quarter"],
        "year": review_data["year"],
        "goals": review_data.get("goals", []),
        "achievements": review_data.get("achievements", ""),
        "areas_of_improvement": review_data.get("areas_of_improvement", ""),
        "overall_rating": review_data.get("overall_rating", 0),
        "comments": review_data.get("comments", ""),
        "employee_comments": "",
        "status": "draft",
        "created_at": now,
        "updated_at": now
    }
    
    await db.performance_reviews.insert_one(review_doc)
    return await db.performance_reviews.find_one({"review_id": review_id}, {"_id": 0})

@hr_router.put("/reviews/{review_id}/acknowledge")
async def acknowledge_review(review_id: str, comments: str, request: Request):
    """Employee acknowledges review"""
    from server import get_current_user
    user = await get_current_user(request)
    
    review = await db.performance_reviews.find_one({"review_id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.performance_reviews.update_one(
        {"review_id": review_id},
        {"$set": {
            "employee_comments": comments,
            "status": "acknowledged",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return await db.performance_reviews.find_one({"review_id": review_id}, {"_id": 0})

# ============== TEAM MANAGEMENT (Admin) ==============

@hr_router.get("/team/all-employees")
async def get_all_employees(request: Request):
    """Get all employees (Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    employees = await db.users.find(
        {"is_active": True},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    # Get profiles
    for emp in employees:
        profile = await db.employee_profiles.find_one(
            {"user_id": emp["user_id"]},
            {"_id": 0}
        )
        if profile:
            emp["profile"] = profile
    
    return employees

@hr_router.get("/team/attendance-overview")
async def get_team_attendance_overview(request: Request):
    """Get team attendance overview for today (Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get all active users
    users = await db.users.find({"is_active": True}, {"_id": 0, "user_id": 1, "name": 1}).to_list(500)
    
    # Get today's attendance
    attendance_records = await db.attendance.find({
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    }, {"_id": 0}).to_list(500)
    
    attendance_map = {a["user_id"]: a for a in attendance_records}
    
    overview = []
    for u in users:
        att = attendance_map.get(u["user_id"])
        overview.append({
            "user_id": u["user_id"],
            "name": u["name"],
            "status": att.get("status", "absent") if att else "absent",
            "clock_in": att.get("clock_in") if att else None,
            "clock_out": att.get("clock_out") if att else None,
            "work_location": att.get("work_location") if att else None
        })
    
    return overview


# ============== ADMIN HR ROUTES ==============

@hr_router.get("/admin/all-requests")
async def get_all_leave_requests(request: Request, status: Optional[str] = None):
    """Get all leave requests (Admin only)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.leave_requests.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return requests

@hr_router.get("/admin/employees")
async def get_all_employee_details(request: Request):
    """Get all employees with full details (Admin and HR Manager) - Optimized"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get all employees
    employees = await db.users.find(
        {},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    if not employees:
        return []
    
    # Get all user IDs
    user_ids = [emp["user_id"] for emp in employees]
    
    # Batch fetch all profiles
    profiles = await db.employee_profiles.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0}
    ).to_list(500)
    profiles_map = {p["user_id"]: p for p in profiles}
    
    # Batch fetch today's attendance for all users
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    attendances = await db.attendance.find({
        "user_id": {"$in": user_ids},
        "date": {"$gte": today, "$lt": today + timedelta(days=1)}
    }, {"_id": 0}).to_list(500)
    attendance_map = {a["user_id"]: a for a in attendances}
    
    # Batch count pending leaves using aggregation
    pending_leaves_cursor = db.leave_requests.aggregate([
        {"$match": {"user_id": {"$in": user_ids}, "status": "pending"}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}}
    ])
    pending_leaves_list = await pending_leaves_cursor.to_list(500)
    pending_leaves_map = {p["_id"]: p["count"] for p in pending_leaves_list}
    
    # Enrich employees with fetched data
    for emp in employees:
        emp["profile"] = profiles_map.get(emp["user_id"], {})
        emp["today_attendance"] = attendance_map.get(emp["user_id"])
        emp["pending_leaves"] = pending_leaves_map.get(emp["user_id"], 0)
    
    return employees

@hr_router.put("/admin/employee/{user_id}/profile")
async def admin_update_employee_profile(user_id: str, profile_data: Dict[str, Any], request: Request):
    """Admin update employee profile with all fields"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get user info
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if module_access needs to be updated (when designation changes)
    update_module_access = profile_data.pop("update_module_access", False)
    new_module_access = profile_data.pop("new_module_access", [])
    designation_id = profile_data.pop("designation_id", None)

    # Auto-sync module_access from the designation whenever designation_id is sent,
    # even if the caller didn't explicitly pass update_module_access. This ensures
    # users always reflect their designation's module list.
    if designation_id and not update_module_access:
        try:
            desig = await db.designations.find_one({"$or": [{"_id": designation_id}, {"designation_id": designation_id}, {"id": designation_id}]})
            if desig and isinstance(desig.get("module_access"), list):
                update_module_access = True
                new_module_access = desig["module_access"]
        except Exception:
            pass

    if update_module_access and new_module_access:
        # Update user's module_access based on new designation
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"module_access": new_module_access, "designation": profile_data.get("designation", "")}}
        )
        logging.info(f"Updated module_access for user {user_id} to {new_module_access}")
    
    # Update or create profile
    profile_data["user_id"] = user_id
    profile_data["updated_at"] = datetime.now(timezone.utc)
    
    # Set defaults from user if not in profile
    if "full_name" not in profile_data:
        profile_data["full_name"] = user.get("name", "")
    if "email" not in profile_data:
        profile_data["email"] = user.get("email", "")
    
    existing = await db.employee_profiles.find_one({"user_id": user_id})
    
    if existing:
        await db.employee_profiles.update_one(
            {"user_id": user_id},
            {"$set": profile_data}
        )
    else:
        profile_data["created_at"] = datetime.now(timezone.utc)
        await db.employee_profiles.insert_one(profile_data)
    
    return await db.employee_profiles.find_one({"user_id": user_id}, {"_id": 0})


@hr_router.delete("/admin/employee/{user_id}")
async def delete_employee(user_id: str, request: Request):
    """Delete an employee (Admin only) - Soft delete by setting status to inactive"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Prevent deleting yourself
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Check if user exists
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Prevent deleting super_admin
    if user.get("role") == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot delete super admin accounts")
    
    # Soft delete - mark as inactive
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "status": "inactive",
            "deleted_at": datetime.now(timezone.utc),
            "deleted_by": current_user.user_id
        }}
    )
    
    # Also update employee profile if exists
    await db.employee_profiles.update_one(
        {"user_id": user_id},
        {"$set": {"status": "inactive"}}
    )
    
    return {"message": "Employee deleted successfully", "user_id": user_id}


@hr_router.delete("/admin/employee/{user_id}/permanent")
async def permanently_delete_employee(user_id: str, request: Request):
    """Permanently delete an employee and all associated data (Super Admin only)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    # Prevent deleting yourself
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Check if user exists
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Delete from all collections
    await db.users.delete_one({"user_id": user_id})
    await db.employee_profiles.delete_one({"user_id": user_id})
    await db.attendance.delete_many({"user_id": user_id})
    await db.leave_requests.delete_many({"user_id": user_id})
    await db.leave_balances.delete_one({"user_id": user_id})
    await db.permissions.delete_many({"user_id": user_id})
    await db.wfh_requests.delete_many({"user_id": user_id})
    
    return {"message": "Employee permanently deleted", "user_id": user_id}


@hr_router.get("/admin/dashboard-stats")
async def get_hr_dashboard_stats(request: Request):
    """Get HR dashboard statistics (Admin and HR Manager)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "project_manager", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Total employees
    total_employees = await db.users.count_documents({"is_active": True})
    
    # Today's attendance
    present_today = await db.attendance.count_documents({
        "date": {"$gte": today, "$lt": today + timedelta(days=1)},
        "clock_in": {"$ne": None}
    })
    
    # WFH today
    wfh_today = await db.attendance.count_documents({
        "date": {"$gte": today, "$lt": today + timedelta(days=1)},
        "work_location": "home"
    })
    
    # Pending leave requests
    pending_leaves = await db.leave_requests.count_documents({"status": "pending"})
    
    return {
        "total_employees": total_employees,
        "present_today": present_today,
        "absent_today": total_employees - present_today,
        "wfh_today": wfh_today,
        "wfo_today": present_today - wfh_today,
        "pending_leaves": pending_leaves
    }

# ============== CREATE EMPLOYEE ==============

class CreateEmployeeRequest(BaseModel):
    # Basic Details
    full_name: str
    email: str
    phone: Optional[str] = ""
    date_of_birth: Optional[str] = None
    gender: Optional[str] = ""
    blood_group: Optional[str] = ""
    # Account Details
    bank_name: Optional[str] = ""
    account_number: Optional[str] = ""
    ifsc_code: Optional[str] = ""
    pan_number: Optional[str] = ""
    aadhar_number: Optional[str] = ""
    # Employment Details
    employee_id: Optional[str] = ""
    designation: Optional[str] = ""
    department: Optional[str] = ""
    employment_type: Optional[str] = "full-time"
    joining_date: Optional[str] = None
    reporting_manager: Optional[str] = ""
    work_location: Optional[str] = "office"
    work_mode: Optional[str] = "office"  # office, remote, hybrid
    # Documents
    resume_link: Optional[str] = ""
    id_proof_link: Optional[str] = ""
    address_proof_link: Optional[str] = ""
    education_docs_link: Optional[str] = ""
    offer_letter_link: Optional[str] = ""
    # Role & Access
    role: Optional[str] = "employee"
    module_access: Optional[List[str]] = []
    password: str
    # Emergency Contact
    emergency_contact_name: Optional[str] = ""
    emergency_contact_phone: Optional[str] = ""
    emergency_contact_relation: Optional[str] = ""
    # Address
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    pincode: Optional[str] = ""

@hr_router.post("/admin/create-employee")
async def create_employee(data: CreateEmployeeRequest, request: Request):
    """Create a new employee with full details (Admin only)"""
    from server import get_current_user, hash_password
    current_user = await get_current_user(request)
    
    if current_user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Admin/HR access required")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    emp_id = data.employee_id or f"EMP{user_id[-6:].upper()}"
    
    user_doc = {
        "user_id": user_id,
        "email": data.email,
        "name": data.full_name,
        "role": data.role,
        "password_hash": hash_password(data.password),
        "is_active": True,
        "designation": data.designation or "",
        "department": data.department or "",
        "module_access": data.module_access or [],
        "project_access": [],
        "can_create_projects": data.role in ["admin", "super_admin", "project_manager"],
        "can_delete_tasks": data.role in ["admin", "super_admin"],
        "can_manage_users": data.role in ["admin", "super_admin", "hr_manager"],
        "created_at": datetime.now(timezone.utc),
        "created_by": current_user.user_id
    }
    
    await db.users.insert_one(user_doc)
    
    # Create employee profile
    profile_doc = {
        "user_id": user_id,
        "employee_id": emp_id,
        "full_name": data.full_name,
        "email": data.email,
        "phone": data.phone,
        "date_of_birth": data.date_of_birth,
        "gender": data.gender,
        "blood_group": data.blood_group,
        # Employment
        "designation": data.designation,
        "department": data.department,
        "employment_type": data.employment_type,
        "joining_date": data.joining_date,
        "reporting_manager": data.reporting_manager,
        "work_location": data.work_location,
        "work_mode": data.work_mode or data.work_location,
        # Bank Details
        "bank_name": data.bank_name,
        "account_number": data.account_number,
        "ifsc_code": data.ifsc_code,
        "pan_number": data.pan_number,
        "aadhar_number": data.aadhar_number,
        # Documents
        "resume_link": data.resume_link,
        "id_proof_link": data.id_proof_link,
        "address_proof_link": data.address_proof_link,
        "education_docs_link": data.education_docs_link,
        "offer_letter_link": data.offer_letter_link,
        # Emergency Contact
        "emergency_contact_name": data.emergency_contact_name,
        "emergency_contact_phone": data.emergency_contact_phone,
        "emergency_contact_relation": data.emergency_contact_relation,
        # Address
        "address": data.address,
        "city": data.city,
        "state": data.state,
        "pincode": data.pincode,
        # Metadata
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user.user_id
    }
    
    await db.employee_profiles.insert_one(profile_doc)
    
    # Initialize leave balance for current year
    current_year = datetime.now().year
    leave_balance = {
        "user_id": user_id,
        "year": current_year,
        "casual_leave": 12,
        "sick_leave": 6,
        "earned_leave": 15,
        "unpaid_leave": 0,
        "casual_used": 0,
        "sick_used": 0,
        "earned_used": 0,
        "unpaid_used": 0
    }
    await db.leave_balances.insert_one(leave_balance)
    
    # Send welcome email with credentials
    email_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Welcome to Drawlead OS!</h2>
        <p>Hello {data.full_name},</p>
        <p>Your employee account has been created. Here are your login credentials:</p>
        <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> {data.email}</p>
            <p><strong>Password:</strong> {data.password}</p>
            <p><strong>Employee ID:</strong> {emp_id}</p>
            <p><strong>Role:</strong> {data.role.replace('_', ' ').title()}</p>
        </div>
        <p>Please login and change your password immediately.</p>
        <p style="color: #71717a; font-size: 12px;">- Drawlead OS HR Team</p>
    </div>
    """
    
    await send_email_notification(
        data.email,
        "Welcome to Drawlead OS - Your Login Credentials",
        email_html
    )
    
    return {
        "message": "Employee created successfully",
        "user_id": user_id,
        "employee_id": emp_id,
        "email": data.email,
        "credentials_sent": True
    }



# ============== PERMISSION REQUESTS ==============

class PermissionRequest(BaseModel):
    date: str
    hours: float = 1
    reason: str
    from_time: Optional[str] = None
    to_time: Optional[str] = None

@hr_router.post("/permissions/request")
async def create_permission_request(data: PermissionRequest, request: Request):
    """Create a permission request for late arrival, early leave, or breaks"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    permission_id = f"perm_{uuid.uuid4().hex[:12]}"
    
    permission = {
        "permission_id": permission_id,
        "user_id": current_user.user_id,
        "employee_name": current_user.name,
        "date": data.date,
        "hours": data.hours,
        "from_time": data.from_time,
        "to_time": data.to_time,
        "reason": data.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.permission_requests.insert_one(permission)
    
    # Notify HR admins
    await notify_permission_request(current_user.name, data.hours, data.reason)
    
    return {"message": "Permission request submitted", "permission_id": permission_id}

@hr_router.get("/permissions/my-requests")
async def get_my_permission_requests(request: Request):
    """Get all permission requests for the current user"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    requests = await db.permission_requests.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return requests

@hr_router.get("/permissions/pending")
async def get_pending_permission_requests(request: Request):
    """Get all pending permission requests (for HR admin)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    # Check if user is HR admin
    if current_user.role not in ['super_admin', 'admin', 'hr_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    requests = await db.permission_requests.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return requests

@hr_router.post("/permissions/{permission_id}/approve")
async def approve_permission_request(permission_id: str, request: Request):
    """Approve a permission request"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ['super_admin', 'admin', 'hr_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.permission_requests.update_one(
        {"permission_id": permission_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user.user_id,
            "approved_by_name": current_user.name,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Permission request not found")
    
    # Notify employee
    perm = await db.permission_requests.find_one({"permission_id": permission_id})
    if perm:
        await notify_permission_decision(perm.get("employee_name", "Employee"), "approved")
    
    return {"message": "Permission request approved"}

@hr_router.post("/permissions/{permission_id}/reject")
async def reject_permission_request(permission_id: str, request: Request):
    """Reject a permission request"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ['super_admin', 'admin', 'hr_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.permission_requests.update_one(
        {"permission_id": permission_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": current_user.user_id,
            "rejected_by_name": current_user.name,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Permission request not found")
    
    # Notify employee
    perm = await db.permission_requests.find_one({"permission_id": permission_id})
    if perm:
        await notify_permission_decision(perm.get("employee_name", "Employee"), "rejected")
    
    return {"message": "Permission request rejected"}


# ============ MOTIVATIONAL QUOTES MANAGEMENT ============

@hr_router.get("/admin/quotes")
async def get_quotes(request: Request):
    """Get all motivational quotes"""
    quotes = await db.motivational_quotes.find({}, {"_id": 0}).to_list(100)
    if not quotes:
        # Return default quotes if none exist
        default_quotes = [
            {"quote_id": f"quote_{i+1}", "text": q, "active": True}
            for i, q in enumerate([
                "Believe in yourself", "Never give up", "Dream big today",
                "Stay always positive", "Keep moving forward", "You are enough",
                "Chase your dreams", "Make it happen", "Be the change",
                "Start right now", "Embrace every challenge", "Rise and shine",
                "Create your future", "Trust the process", "Stay focused always",
                "Push your limits", "Shine bright today", "Own your journey",
                "Be unstoppable now", "Growth takes time", "Courage conquers fear",
                "Progress not perfection", "Inspire others daily", "Success awaits you",
                "Today matters most", "Live with purpose", "Action creates results",
                "Persistence beats resistance", "You got this", "Make today count",
                "Excellence every day"
            ])
        ]
        # Insert default quotes
        await db.motivational_quotes.insert_many(default_quotes)
        return default_quotes
    return quotes

@hr_router.post("/admin/quotes")
async def add_quote(request: Request, quote_data: dict):
    """Add a new motivational quote"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    quote_text = quote_data.get("text", "").strip()
    if not quote_text:
        raise HTTPException(status_code=400, detail="Quote text is required")
    
    quote_doc = {
        "quote_id": f"quote_{uuid.uuid4().hex[:8]}",
        "text": quote_text,
        "active": True,
        "created_at": datetime.now(timezone.utc),
        "created_by": user.user_id
    }
    
    await db.motivational_quotes.insert_one(quote_doc)
    return {**quote_doc, "_id": None}

@hr_router.put("/admin/quotes/{quote_id}")
async def update_quote(quote_id: str, request: Request, quote_data: dict):
    """Update a motivational quote"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_fields = {}
    if "text" in quote_data:
        update_fields["text"] = quote_data["text"]
    if "active" in quote_data:
        update_fields["active"] = quote_data["active"]
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_fields["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.motivational_quotes.update_one(
        {"quote_id": quote_id},
        {"$set": update_fields}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    return {"message": "Quote updated"}

@hr_router.delete("/admin/quotes/{quote_id}")
async def delete_quote(quote_id: str, request: Request):
    """Delete a motivational quote"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.motivational_quotes.delete_one({"quote_id": quote_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    return {"message": "Quote deleted"}




# ============== EMPLOYEE REVIEWS ==============

@hr_router.get("/employee-reviews/employees")
async def get_employees_for_review(request: Request):
    """Get list of all employees for review"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager", "operations_manager", "ceo"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employees = await db.users.find(
        {"is_active": {"$ne": False}},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "designation": 1, "department": 1, "profile_photo": 1}
    ).to_list(500)
    
    return employees


@hr_router.get("/employee-reviews/employee/{employee_id}/summary")
async def get_employee_review_summary(employee_id: str, review_type: str, period: str, request: Request):
    """Get employee summary for review - attendance, hours, delivery timeline"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager", "operations_manager", "ceo"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Parse period based on review_type
    # monthly: "2026-04", quarterly: "2026-Q1", yearly: "2026"
    year = int(period.split("-")[0])
    
    if review_type == "monthly":
        month = int(period.split("-")[1])
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
    elif review_type == "quarterly":
        quarter = period.split("-")[1]  # Q1, Q2, Q3, Q4
        quarter_num = int(quarter[1])
        start_month = (quarter_num - 1) * 3 + 1
        start_date = datetime(year, start_month, 1)
        end_month = start_month + 3
        if end_month > 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, end_month, 1)
    else:  # yearly
        start_date = datetime(year, 1, 1)
        end_date = datetime(year + 1, 1, 1)
    
    # Get attendance stats
    attendance_records = await db.attendance.find({
        "user_id": employee_id,
        "date": {"$gte": start_date.strftime("%Y-%m-%d"), "$lt": end_date.strftime("%Y-%m-%d")}
    }).to_list(400)
    
    present_days = len([a for a in attendance_records if a.get("status") == "present"])
    absent_days = len([a for a in attendance_records if a.get("status") == "absent"])
    leave_days = len([a for a in attendance_records if a.get("status") in ["casual_leave", "sick_leave", "earned_leave"]])
    
    # Calculate working hours
    total_hours = 0
    extra_hours = 0
    less_hours = 0
    standard_hours = 8.0
    
    for record in attendance_records:
        if record.get("check_in") and record.get("check_out"):
            try:
                check_in = datetime.fromisoformat(record["check_in"].replace("Z", "+00:00"))
                check_out = datetime.fromisoformat(record["check_out"].replace("Z", "+00:00"))
                hours_worked = (check_out - check_in).total_seconds() / 3600
                total_hours += hours_worked
                if hours_worked > standard_hours:
                    extra_hours += (hours_worked - standard_hours)
                elif hours_worked < standard_hours:
                    less_hours += (standard_hours - hours_worked)
            except:
                pass
    
    # Get tasks for delivery timeline
    tasks = await db.project_tasks.find({
        "assigned_to": employee_id,
        "created_at": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(500)
    
    # Also check website page tasks
    website_tasks = await db.website_page_tasks.find({
        "$or": [
            {"wireframe_assignee": employee_id},
            {"ui_assignee": employee_id},
            {"content_assignee": employee_id},
            {"dev_assignee": employee_id},
            {"assigned_to": employee_id}
        ],
        "created_at": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(500)
    
    # Calculate on-time vs overdue
    on_time_count = 0
    overdue_count = 0
    now = datetime.now(timezone.utc)
    
    for task in tasks:
        due_date = task.get("due_date")
        status = task.get("status", "pending")
        if due_date:
            try:
                due = datetime.fromisoformat(due_date.replace("Z", "+00:00")) if isinstance(due_date, str) else due_date
                if status == "completed":
                    completed_at = task.get("completed_at") or task.get("updated_at")
                    if completed_at:
                        completed = datetime.fromisoformat(str(completed_at).replace("Z", "+00:00")) if isinstance(completed_at, str) else completed_at
                        if completed <= due:
                            on_time_count += 1
                        else:
                            overdue_count += 1
                    else:
                        on_time_count += 1
                elif due < now:
                    overdue_count += 1
                else:
                    on_time_count += 1
            except:
                on_time_count += 1
        else:
            on_time_count += 1
    
    return {
        "employee_id": employee_id,
        "review_type": review_type,
        "period": period,
        "attendance": {
            "present_days": present_days,
            "absent_days": absent_days,
            "leave_days": leave_days,
            "total_records": len(attendance_records)
        },
        "working_hours": {
            "total_hours": round(total_hours, 2),
            "extra_hours": round(extra_hours, 2),
            "less_hours": round(less_hours, 2),
            "average_daily": round(total_hours / max(present_days, 1), 2)
        },
        "delivery_timeline": {
            "total_tasks": len(tasks) + len(website_tasks),
            "on_time": on_time_count,
            "overdue": overdue_count
        }
    }


@hr_router.get("/employee-reviews/employee/{employee_id}/tasks")
async def get_employee_tasks_for_review(employee_id: str, review_type: str, period: str, status_filter: str = "all", request: Request = None):
    """Get employee tasks with on-time/overdue status"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager", "operations_manager", "ceo"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Parse period
    year = int(period.split("-")[0])
    
    if review_type == "monthly":
        month = int(period.split("-")[1])
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
    elif review_type == "quarterly":
        quarter = period.split("-")[1]
        quarter_num = int(quarter[1])
        start_month = (quarter_num - 1) * 3 + 1
        start_date = datetime(year, start_month, 1)
        end_month = start_month + 3
        if end_month > 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, end_month, 1)
    else:
        start_date = datetime(year, 1, 1)
        end_date = datetime(year + 1, 1, 1)
    
    # Get tasks
    tasks = await db.project_tasks.find({
        "assigned_to": employee_id,
        "created_at": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(500)
    
    now = datetime.now(timezone.utc)
    result_tasks = []
    
    for task in tasks:
        due_date = task.get("due_date")
        task_status = task.get("status", "pending")
        delivery_status = "on_time"
        
        if due_date:
            try:
                due = datetime.fromisoformat(due_date.replace("Z", "+00:00")) if isinstance(due_date, str) else due_date
                if task_status == "completed":
                    completed_at = task.get("completed_at") or task.get("updated_at")
                    if completed_at:
                        completed = datetime.fromisoformat(str(completed_at).replace("Z", "+00:00")) if isinstance(completed_at, str) else completed_at
                        delivery_status = "on_time" if completed <= due else "overdue"
                elif due < now:
                    delivery_status = "overdue"
            except:
                pass
        
        task["delivery_status"] = delivery_status
        
        if status_filter == "all" or status_filter == delivery_status:
            result_tasks.append(task)
    
    return result_tasks


@hr_router.get("/performance-reviews")
async def get_performance_reviews(
    employee_id: Optional[str] = None,
    review_type: Optional[str] = None,
    period: Optional[str] = None,
    request: Request = None
):
    """Get reviews with filters"""
    from server import get_current_user
    user = await get_current_user(request)
    
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    if review_type:
        query["review_type"] = review_type
    if period:
        query["period"] = period
    
    reviews = await db.employee_reviews.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Apply visibility rules
    user_role = user.role
    filtered_reviews = []
    
    for review in reviews:
        reviewer_role = review.get("reviewer_role", "")
        
        # Employee can see all their reviews
        if review.get("employee_id") == user.user_id:
            filtered_reviews.append(review)
        # HR can see Operations and CEO reviews (not their own HR reviews)
        elif user_role in ["admin", "super_admin", "hr_manager"]:
            if reviewer_role in ["operations", "ceo"]:
                filtered_reviews.append(review)
            elif reviewer_role == "hr" and review.get("reviewer_id") == user.user_id:
                filtered_reviews.append(review)  # Can see own reviews
        # Operations can see HR and CEO reviews
        elif user_role == "operations_manager":
            if reviewer_role in ["hr", "ceo"]:
                filtered_reviews.append(review)
            elif reviewer_role == "operations" and review.get("reviewer_id") == user.user_id:
                filtered_reviews.append(review)
        # CEO can see HR and Operations reviews
        elif user_role == "ceo":
            if reviewer_role in ["hr", "operations"]:
                filtered_reviews.append(review)
            elif reviewer_role == "ceo" and review.get("reviewer_id") == user.user_id:
                filtered_reviews.append(review)
    
    return filtered_reviews


@hr_router.get("/performance-reviews/my-reviews")
async def get_my_performance_reviews(request: Request):
    """Get performance reviews for the current user (employee view)"""
    from server import get_current_user
    user = await get_current_user(request)
    
    # Get reviews from last month onwards
    last_month = datetime.now(timezone.utc) - timedelta(days=60)
    
    reviews = await db.employee_reviews.find({
        "employee_id": user.user_id,
        "created_at": {"$gte": last_month}
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return reviews


@hr_router.post("/performance-reviews")
async def create_performance_review(request: Request):
    """Create a new employee performance review"""
    from server import get_current_user
    user = await get_current_user(request)
    
    if user.role not in ["admin", "super_admin", "hr_manager", "operations_manager", "ceo"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    data = await request.json()
    
    # Determine reviewer role
    reviewer_role = "hr"
    if user.role in ["operations_manager"]:
        reviewer_role = "operations"
    elif user.role == "ceo":
        reviewer_role = "ceo"
    elif user.role in ["admin", "super_admin", "hr_manager"]:
        reviewer_role = data.get("reviewer_role", "hr")  # Allow specifying for admins
    
    review_id = f"rev_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    review = {
        "review_id": review_id,
        "employee_id": data.get("employee_id"),
        "reviewer_id": user.user_id,
        "reviewer_name": user.name,
        "reviewer_role": reviewer_role,
        "review_type": data.get("review_type"),  # monthly, quarterly, yearly
        "period": data.get("period"),  # 2026-04, 2026-Q1, 2026
        "rating": data.get("rating", 0),  # 1-5 stars
        "review_text": data.get("review_text", ""),
        "created_at": now,
        "updated_at": now
    }
    
    # Check if review already exists for this reviewer/employee/period
    existing = await db.employee_reviews.find_one({
        "employee_id": data.get("employee_id"),
        "reviewer_role": reviewer_role,
        "review_type": data.get("review_type"),
        "period": data.get("period")
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Review already exists for this period. Use edit instead.")
    
    await db.employee_reviews.insert_one(review)
    review.pop("_id", None)
    
    return review


@hr_router.put("/performance-reviews/{review_id}")
async def update_performance_review(review_id: str, request: Request):
    """Update an existing review"""
    from server import get_current_user
    user = await get_current_user(request)
    
    review = await db.employee_reviews.find_one({"review_id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Only the reviewer can edit their review
    if review.get("reviewer_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this review")
    
    data = await request.json()
    
    update_data = {
        "rating": data.get("rating", review.get("rating")),
        "review_text": data.get("review_text", review.get("review_text")),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.employee_reviews.update_one(
        {"review_id": review_id},
        {"$set": update_data}
    )
    
    updated = await db.employee_reviews.find_one({"review_id": review_id}, {"_id": 0})
    return updated


@hr_router.delete("/performance-reviews/{review_id}")
async def delete_performance_review(review_id: str, request: Request):
    """Delete a review"""
    from server import get_current_user
    user = await get_current_user(request)
    
    review = await db.employee_reviews.find_one({"review_id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Only admins or the reviewer can delete
    if review.get("reviewer_id") != user.user_id and user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.employee_reviews.delete_one({"review_id": review_id})
    
    return {"message": "Review deleted"}



# ============ WFH/Remote Work Request Routes ============

class WFHRequest(BaseModel):
    start_date: str
    end_date: str
    reason: str
    work_plan: Optional[str] = None
    contact_number: Optional[str] = None
    work_location: str = "home"  # home, other

class WFHRequestUpdate(BaseModel):
    status: str  # approved, rejected
    remarks: Optional[str] = None
    admin_notes: Optional[str] = None


@hr_router.post("/wfh/request")
async def create_wfh_request(data: WFHRequest, request: Request):
    """Create a Work From Home request"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    wfh_id = f"wfh_{uuid.uuid4().hex[:12]}"
    
    # Calculate number of days
    start = datetime.strptime(data.start_date, "%Y-%m-%d")
    end = datetime.strptime(data.end_date, "%Y-%m-%d")
    days = (end - start).days + 1
    
    wfh_request = {
        "wfh_id": wfh_id,
        "user_id": current_user.user_id,
        "employee_name": current_user.name,
        "employee_email": current_user.email,
        "department": getattr(current_user, 'department', None),
        "designation": getattr(current_user, 'designation', None),
        "start_date": data.start_date,
        "end_date": data.end_date,
        "days": days,
        "reason": data.reason,
        "work_plan": data.work_plan,
        "contact_number": data.contact_number,
        "work_location": data.work_location,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.wfh_requests.insert_one(wfh_request)
    
    return {"message": "WFH request submitted", "wfh_id": wfh_id}


@hr_router.get("/wfh/my-requests")
async def get_my_wfh_requests(request: Request):
    """Get all WFH requests for the current user"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    requests = await db.wfh_requests.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return requests


@hr_router.get("/wfh/pending")
async def get_pending_wfh_requests(request: Request):
    """Get all pending WFH requests (for HR admin)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ['super_admin', 'admin', 'hr_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    requests = await db.wfh_requests.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return requests


@hr_router.get("/wfh/all")
async def get_all_wfh_requests(
    request: Request,
    status: Optional[str] = None,
    employee: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get all WFH requests with filters (for HR admin)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ['super_admin', 'admin', 'hr_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    
    if status and status != 'all':
        query["status"] = status
    
    if employee and employee != 'all':
        query["user_id"] = employee
    
    if start_date:
        query["start_date"] = {"$gte": start_date}
    
    if end_date:
        if "start_date" in query:
            query["end_date"] = {"$lte": end_date}
        else:
            query["end_date"] = {"$lte": end_date}
    
    requests = await db.wfh_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    return requests


@hr_router.get("/wfh/{wfh_id}")
async def get_wfh_request(wfh_id: str, request: Request):
    """Get a single WFH request details"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    wfh = await db.wfh_requests.find_one({"wfh_id": wfh_id}, {"_id": 0})
    
    if not wfh:
        raise HTTPException(status_code=404, detail="WFH request not found")
    
    # Only the employee or admin can view
    if wfh["user_id"] != current_user.user_id and current_user.role not in ['super_admin', 'admin', 'hr_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return wfh


@hr_router.post("/wfh/{wfh_id}/approve")
async def approve_wfh_request(wfh_id: str, request: Request, data: dict = Body(default={})):
    """Approve a WFH request with remarks"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ['super_admin', 'admin', 'hr_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    wfh = await db.wfh_requests.find_one({"wfh_id": wfh_id})
    if not wfh:
        raise HTTPException(status_code=404, detail="WFH request not found")
    
    remarks = data.get("remarks", "")
    admin_notes = data.get("admin_notes", "")
    
    result = await db.wfh_requests.update_one(
        {"wfh_id": wfh_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user.user_id,
            "approved_by_name": current_user.name,
            "remarks": remarks,
            "admin_notes": admin_notes,
            "approved_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "WFH request approved"}


@hr_router.post("/wfh/{wfh_id}/reject")
async def reject_wfh_request(wfh_id: str, request: Request, data: dict = Body(default={})):
    """Reject a WFH request with reason"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    if current_user.role not in ['super_admin', 'admin', 'hr_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    wfh = await db.wfh_requests.find_one({"wfh_id": wfh_id})
    if not wfh:
        raise HTTPException(status_code=404, detail="WFH request not found")
    
    reason = data.get("reason", "")
    if not reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required")
    
    result = await db.wfh_requests.update_one(
        {"wfh_id": wfh_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": current_user.user_id,
            "rejected_by_name": current_user.name,
            "rejection_reason": reason,
            "rejected_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "WFH request rejected"}


@hr_router.delete("/wfh/{wfh_id}")
async def cancel_wfh_request(wfh_id: str, request: Request):
    """Cancel a WFH request (only pending requests can be cancelled by employee)"""
    from server import get_current_user
    current_user = await get_current_user(request)
    
    wfh = await db.wfh_requests.find_one({"wfh_id": wfh_id})
    if not wfh:
        raise HTTPException(status_code=404, detail="WFH request not found")
    
    # Only owner can cancel if pending, admins can cancel anytime
    if wfh["user_id"] != current_user.user_id:
        if current_user.role not in ['super_admin', 'admin', 'hr_admin']:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        if wfh["status"] != "pending":
            raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    
    await db.wfh_requests.delete_one({"wfh_id": wfh_id})
    
    return {"message": "WFH request cancelled"}
