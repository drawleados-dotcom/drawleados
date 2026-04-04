from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import bcrypt
import csv
import io
import pyotp
import qrcode
import base64
import asyncio
import resend
from io import BytesIO

# Import finance and operations routes
import sys
sys.path.append(str(Path(__file__).parent))
from finance_routes import finance_router, init_finance_db
from operations_routes import operations_router, init_operations_db
from hr_routes import hr_router, init_hr_db
from notion_routes import notion_router, init_notion_db
from chat_routes import chat_router, init_chat_db
from marketing_routes import marketing_router, init_marketing_db
from ai_routes import ai_router, init_ai_db
from sop_routes import sop_router, init_sop_db
from website_projects_routes import website_projects_router, init_website_projects_db
from expense_routes import expense_router, set_expense_db
from social_creative_routes import social_media_router, creative_router, init_social_creative_db
from meta_ads_routes import meta_ads_router, init_meta_ads_db
from leads_v2_routes import leads_v2_router, init_leads_v2_db
from documentation_routes import documentation_router, init_documentation_db
from seo_board_routes import seo_board_router, init_seo_board_db
from designation_routes import designation_router
from bde_routes import bde_router
from our_tasks_routes import our_tasks_router
from google_calendar_routes import calendar_router, init_calendar_db
from payroll_routes import payroll_router
from department_routes import department_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize finance and operations modules with database
init_finance_db(db)
init_operations_db(db)
init_hr_db(db)
init_notion_db(db)
init_chat_db(db)
init_marketing_db(db)
init_ai_db(db)
init_sop_db(db)
init_website_projects_db(db)
set_expense_db(db)
init_social_creative_db(db)
init_meta_ads_db(db)
init_leads_v2_db(db)
init_documentation_db(db)
init_seo_board_db(db)
init_calendar_db(db)

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============== STARTUP EVENT - ENSURE ADMIN EXISTS ==============
@app.on_event("startup")
async def startup_tasks():
    """Startup tasks - DB indexes etc."""
    # No automatic admin creation - users will create accounts via /admin signup page
    logging.info("Server started - Admin signup available at /admin with code DRAWLEAD2025")

# Health check endpoint for Kubernetes (root level)
@app.get("/health")
async def health_check():
    """Health check endpoint for deployment readiness"""
    return {"status": "healthy", "service": "drawlead-os"}

# Health check endpoint under /api for external access
@api_router.get("/health")
async def api_health_check():
    """Health check endpoint for deployment readiness (API route)"""
    return {"status": "healthy", "service": "drawlead-os"}

EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# ============== MODELS ==============

class User(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    role: str  # super_admin, admin, project_manager, bde, employee
    picture: Optional[str] = None
    password_hash: Optional[str] = None
    google_id: Optional[str] = None
    is_active: bool = True
    
    # Permissions
    module_access: List[str] = []  # ['leads', 'operations', 'finance', 'reports', 'settings']
    project_access: List[str] = []  # List of project_ids user can access
    can_create_projects: bool = False
    can_delete_tasks: bool = False
    can_manage_users: bool = False
    
    created_at: datetime

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = "bde"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Service(BaseModel):
    service_id: str
    name: str
    category: str
    billing_type: str  # one-time, recurring
    amount: float
    is_active: bool = True
    created_at: datetime
    created_by: str

class ServiceCreate(BaseModel):
    name: str
    category: str
    billing_type: str
    amount: float

class LeadSource(BaseModel):
    source_id: str
    name: str
    is_active: bool = True
    created_at: datetime
    created_by: str

class LeadSourceCreate(BaseModel):
    name: str

class Status(BaseModel):
    status_id: str
    name: str
    color: str
    order: int
    is_active: bool = True
    created_at: datetime
    created_by: str

class StatusCreate(BaseModel):
    name: str
    color: str
    order: Optional[int] = None

class Lead(BaseModel):
    lead_id: str
    name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    business_name: Optional[str] = None
    website: Optional[str] = None
    service_id: Optional[str] = None
    service_name: Optional[str] = None
    source_id: Optional[str] = None
    source_name: Optional[str] = None
    status_id: str
    status_name: str
    status_color: str
    discussion_notes: Optional[str] = None
    proposal_url: Optional[str] = None
    service_cost: Optional[float] = None
    expected_closing_date: Optional[datetime] = None
    date_of_lead: datetime
    assigned_to: str
    assigned_to_name: str
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

class LeadCreate(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    business_name: Optional[str] = None
    website: Optional[str] = None
    service_id: Optional[str] = None
    source_id: Optional[str] = None
    status_id: str
    discussion_notes: Optional[str] = None
    proposal_url: Optional[str] = None
    service_cost: Optional[float] = None
    expected_closing_date: Optional[datetime] = None
    date_of_lead: Optional[datetime] = None

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    business_name: Optional[str] = None
    website: Optional[str] = None
    service_id: Optional[str] = None
    source_id: Optional[str] = None
    status_id: Optional[str] = None
    discussion_notes: Optional[str] = None
    proposal_url: Optional[str] = None
    service_cost: Optional[float] = None
    expected_closing_date: Optional[datetime] = None
    date_of_lead: Optional[datetime] = None

class FinanceSale(BaseModel):
    sale_id: str
    lead_id: str
    client_name: str
    service_id: str
    service_name: str
    amount: float
    deal_date: datetime
    has_gst: bool = False
    invoice_status: str = "pending"  # pending, paid, overdue
    created_at: datetime

# ============== COMPANY PROFILE MODELS ==============

class BankDetails(BaseModel):
    account_name: str = ""
    account_number: str = ""
    ifsc_code: str = ""
    bank_name: str = ""
    branch: str = ""

class CompanyProfile(BaseModel):
    company_name: str
    logo_url: Optional[str] = None
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    gst_number: str = ""
    pan_number: str = ""
    invoice_prefix: str = "INV"
    terms_conditions: str = ""
    bank_details: BankDetails = BankDetails()
    upi_ids: List[str] = []
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

class CompanyProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    invoice_prefix: Optional[str] = None
    terms_conditions: Optional[str] = None
    bank_details: Optional[BankDetails] = None
    upi_ids: Optional[List[str]] = None

# ============== WORKSPACE MODELS ==============

class Workspace(BaseModel):
    workspace_id: str
    name: str  # Sales, Operations, Finance, Marketing, HR
    description: str = ""
    icon: str = ""
    color: str = "#6366f1"
    is_active: bool = True
    members: List[str] = []  # List of user_ids
    created_at: datetime
    created_by: str

class WorkspaceCreate(BaseModel):
    name: str
    description: str = ""
    icon: str = ""
    color: str = "#6366f1"

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    members: Optional[List[str]] = None

# ============== STATUS UPDATE MODEL ==============

class StatusUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

async def get_current_user(request: Request) -> User:
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
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
    
    # Convert datetime strings to datetime objects if present
    if user_doc.get('created_at'):
        if isinstance(user_doc['created_at'], str):
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    else:
        user_doc['created_at'] = datetime.now(timezone.utc)
    
    return User(**user_doc)

# ============== AUTH ROUTES ==============

# Admin signup secret code - change this to your own secret
ADMIN_SIGNUP_CODE = "DRAWLEAD2025"

class AdminSignup(BaseModel):
    name: str
    email: str
    password: str
    admin_code: str

@api_router.post("/auth/admin-signup")
async def admin_signup(data: AdminSignup):
    """Create a new admin/super_admin account with secret code"""
    
    # Verify admin code
    if data.admin_code != ADMIN_SIGNUP_CODE:
        raise HTTPException(status_code=403, detail="Invalid admin access code")
    
    # Check if user exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create admin user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "role": "super_admin",
        "password_hash": hash_password(data.password),
        "is_active": True,
        "module_access": ["leads", "operations", "finance", "reports", "settings", "hr"],
        "project_access": [],
        "can_create_projects": True,
        "can_delete_tasks": True,
        "can_manage_users": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    user_response = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    
    return {"user": user_response, "session_token": session_token, "message": "Admin account created successfully"}

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "password_hash": hash_password(user_data.password),
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    user_response = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    
    return {"user": user_response, "session_token": session_token}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    # Find user
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    logging.info(f"Login attempt for: {credentials.email}")
    logging.info(f"User found: {user_doc is not None}")
    
    if not user_doc:
        logging.info("User not found in database")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user_doc.get("password_hash"):
        logging.info("User has no password_hash")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    password_valid = verify_password(credentials.password, user_doc["password_hash"])
    logging.info(f"Password valid: {password_valid}")
    
    if not password_valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if 2FA is enabled
    if user_doc.get("two_factor_enabled"):
        return {
            "requires_2fa": True,
            "email": credentials.email,
            "message": "Please enter your 2FA code"
        }
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    del user_doc["password_hash"]
    
    # Remove 2FA secrets from response
    user_doc.pop("two_factor_secret", None)
    user_doc.pop("two_factor_secret_pending", None)
    
    # Add designation and department from employee_profiles if not set
    if not user_doc.get("designation") or not user_doc.get("department"):
        profile = await db.employee_profiles.find_one({"user_id": user_doc["user_id"]}, {"_id": 0})
        if profile:
            user_doc["designation"] = profile.get("designation", "")
            user_doc["department"] = profile.get("department", "")
    
    return {"user": user_doc, "session_token": session_token}

# ============== TWO-FACTOR AUTHENTICATION (2FA) ==============

class Enable2FARequest(BaseModel):
    password: str

class Verify2FARequest(BaseModel):
    code: str

class Disable2FARequest(BaseModel):
    password: str
    code: str

@api_router.post("/auth/2fa/setup")
async def setup_2fa(request: Request, data: Enable2FARequest):
    """Generate 2FA secret and QR code for user"""
    user = await get_current_user(request)
    
    # Verify password
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not verify_password(data.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Check if 2FA is already enabled
    if user_doc.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    
    # Generate secret
    secret = pyotp.random_base32()
    
    # Generate TOTP URI for QR code
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user_doc.get("email"),
        issuer_name="Drawlead OS"
    )
    
    # Generate QR code as base64 image
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Store secret temporarily (will be confirmed when user verifies)
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"two_factor_secret_pending": secret}}
    )
    
    return {
        "secret": secret,
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "manual_entry_key": secret
    }

@api_router.post("/auth/2fa/verify-setup")
async def verify_2fa_setup(request: Request, data: Verify2FARequest):
    """Verify 2FA code and enable 2FA for user"""
    user = await get_current_user(request)
    
    user_doc = await db.users.find_one({"user_id": user.user_id})
    pending_secret = user_doc.get("two_factor_secret_pending")
    
    if not pending_secret:
        raise HTTPException(status_code=400, detail="No 2FA setup in progress")
    
    # Verify the code
    totp = pyotp.TOTP(pending_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid verification code")
    
    # Enable 2FA
    await db.users.update_one(
        {"user_id": user.user_id},
        {
            "$set": {
                "two_factor_enabled": True,
                "two_factor_secret": pending_secret
            },
            "$unset": {"two_factor_secret_pending": ""}
        }
    )
    
    return {"success": True, "message": "Two-factor authentication enabled successfully"}

@api_router.post("/auth/2fa/disable")
async def disable_2fa(request: Request, data: Disable2FARequest):
    """Disable 2FA for user"""
    user = await get_current_user(request)
    
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    if not user_doc.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    
    # Verify password
    if not verify_password(data.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Verify 2FA code
    totp = pyotp.TOTP(user_doc.get("two_factor_secret"))
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    # Disable 2FA
    await db.users.update_one(
        {"user_id": user.user_id},
        {
            "$set": {"two_factor_enabled": False},
            "$unset": {"two_factor_secret": "", "two_factor_secret_pending": ""}
        }
    )
    
    return {"success": True, "message": "Two-factor authentication disabled"}

@api_router.get("/auth/2fa/status")
async def get_2fa_status(request: Request):
    """Get 2FA status for current user"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user.user_id})
    
    return {
        "enabled": user_doc.get("two_factor_enabled", False)
    }

@api_router.post("/auth/2fa/verify")
async def verify_2fa_login(email: str, code: str):
    """Verify 2FA code during login"""
    user_doc = await db.users.find_one({"email": email})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user_doc.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled for this user")
    
    # Verify code
    totp = pyotp.TOTP(user_doc.get("two_factor_secret"))
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    # Create session (same as login)
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Return user data without password
    user_response = {k: v for k, v in user_doc.items() if k not in ["password_hash", "two_factor_secret", "two_factor_secret_pending", "_id"]}
    
    return {"user": user_response, "session_token": session_token}

@api_router.post("/auth/google-session")
async def google_session(session_id: str, response: Response):
    # Exchange session_id for user data
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                EMERGENT_AUTH_URL,
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to verify session: {str(e)}")
    
    # Check if user exists
    user_doc = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    
    if user_doc:
        user_id = user_doc["user_id"]
        # Update user data
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": data["name"],
                "picture": data.get("picture"),
                "google_id": data["id"]
            }}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": data["email"],
            "name": data["name"],
            "role": "employee",  # Default role for Google OAuth users
            "picture": data.get("picture"),
            "google_id": data["id"],
            "is_active": True,
            "module_access": ["operations", "hr"],  # Default module access
            "project_access": [],
            "can_create_projects": False,
            "can_delete_tasks": False,
            "can_manage_users": False,
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user_doc)
    
    # Create session
    session_token = data["session_token"]
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Set httpOnly cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user_response = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    
    return {"user": user_response, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return user.model_dump(exclude={"password_hash"})

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ============== USER ROUTES ==============

@api_router.get("/users")
async def get_users(user: User = Depends(get_current_user)):
    if user.role != "admin" and user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({"is_active": True}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.get("/users/basic")
async def get_users_basic(user: User = Depends(get_current_user)):
    """Get basic user info for task assignment - available to all authenticated users"""
    users = await db.users.find(
        {"is_active": True}, 
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1}
    ).to_list(1000)
    return users


@api_router.post("/users")
async def create_user(user_data: Dict[str, Any], current_user: User = Depends(get_current_user)):
    """Create new user with permissions"""
    if not current_user.can_manage_users:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if email exists
    existing = await db.users.find_one({"email": user_data["email"]})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    # Set default permissions based on role
    role = user_data.get("role", "employee")
    module_access = []
    
    if role == "super_admin":
        module_access = ["leads", "operations", "finance", "reports", "settings"]
        user_data["can_create_projects"] = True
        user_data["can_delete_tasks"] = True
        user_data["can_manage_users"] = True
    elif role == "admin":
        module_access = ["leads", "operations", "finance", "reports", "settings"]
        user_data["can_create_projects"] = True
        user_data["can_delete_tasks"] = True
        user_data["can_manage_users"] = True
    elif role == "project_manager":
        module_access = ["operations", "reports"]
        user_data["can_create_projects"] = True
    elif role == "bde":
        module_access = ["leads"]
    elif role == "employee":
        module_access = ["operations"]
    
    user_doc = {
        "user_id": user_id,
        "email": user_data["email"],
        "name": user_data["name"],
        "role": role,
        "password_hash": hash_password(user_data["password"]) if "password" in user_data else None,
        "is_active": True,
        "module_access": user_data.get("module_access", module_access),
        "project_access": user_data.get("project_access", []),
        "can_create_projects": user_data.get("can_create_projects", False),
        "can_delete_tasks": user_data.get("can_delete_tasks", False),
        "can_manage_users": user_data.get("can_manage_users", False),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user_doc)
    
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, update_data: Dict[str, Any], current_user: User = Depends(get_current_user)):
    """Update user permissions"""
    if not current_user.can_manage_users:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow changing super_admin role
    if user.get("role") == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot modify super admin")
    
    # Update password if provided
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )
    
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

@api_router.delete("/users/{user_id}")
async def deactivate_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Deactivate user"""
    if not current_user.can_manage_users:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "User deactivated"}

@api_router.get("/users/{user_id}/permissions")
async def get_user_permissions(user_id: str, current_user: User = Depends(get_current_user)):
    """Get user permissions"""
    if current_user.user_id != user_id and not current_user.can_manage_users:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "module_access": user.get("module_access", []),
        "project_access": user.get("project_access", []),
        "can_create_projects": user.get("can_create_projects", False),
        "can_delete_tasks": user.get("can_delete_tasks", False),
        "can_manage_users": user.get("can_manage_users", False)
    }

# ============== PASSWORD CHANGE WITH OTP ==============

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str
    confirm_password: str

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Request OTP for password reset - PUBLIC endpoint (no auth required)"""
    import random
    
    # Check if email exists
    user = await db.users.find_one({"email": data.email})
    if not user:
        # Don't reveal if email exists or not for security
        return {"message": "If this email is registered, you will receive an OTP"}
    
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store OTP in database
    await db.password_otps.delete_many({"email": data.email})  # Clear old OTPs
    await db.password_otps.insert_one({
        "user_id": user["user_id"],
        "email": data.email,
        "otp": otp,
        "expires_at": expires_at,
        "type": "forgot_password",
        "created_at": datetime.now(timezone.utc)
    })
    
    # Send OTP via email
    resend_api_key = os.environ.get("RESEND_API_KEY", "")
    sender_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #09090b; color: #fafafa;">
        <div style="max-width: 500px; margin: 0 auto; background: #18181b; padding: 30px; border-radius: 12px; border: 1px solid #27272a;">
            <h2 style="color: #6366f1; margin-bottom: 20px;">Password Reset Request</h2>
            <p style="color: #a1a1aa;">Hi {user.get('name', 'there')},</p>
            <p style="color: #a1a1aa;">You requested to reset your password. Use the OTP below:</p>
            <div style="background: #27272a; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="font-size: 36px; color: #6366f1; letter-spacing: 8px; margin: 0; font-family: monospace;">{otp}</h1>
            </div>
            <p style="color: #71717a; font-size: 14px;">This OTP is valid for 10 minutes.</p>
            <p style="color: #71717a; font-size: 14px;">If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #27272a; margin: 20px 0;">
            <p style="color: #52525b; font-size: 12px; text-align: center;">Drawlead OS - Internal Operating System</p>
        </div>
    </div>
    """
    
    if resend_api_key and resend_api_key != "re_your_api_key_here":
        try:
            resend.api_key = resend_api_key
            params = {
                "from": sender_email,
                "to": [data.email],
                "subject": "Password Reset OTP - Drawlead OS",
                "html": html_content
            }
            email_response = await asyncio.to_thread(resend.Emails.send, params)
            logging.info(f"Password reset OTP sent to {data.email}, email_id: {email_response.get('id')}")
        except Exception as e:
            logging.error(f"Failed to send reset OTP email: {e}")
            logging.info(f"[TEST] Password reset OTP for {data.email}: {otp}")
    else:
        # No API key - log OTP for testing
        logging.warning(f"RESEND_API_KEY not configured. OTP for {data.email}: {otp}")
        logging.info(f"[TEST MODE] Password reset OTP for {data.email}: {otp}")
    
    return {"message": "If this email is registered, you will receive an OTP", "email_hint": data.email[:3] + "***" + data.email[data.email.index("@"):]}

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Verify OTP and reset password - PUBLIC endpoint (no auth required)"""
    
    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    # Password strength validation
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not any(c.isupper() for c in data.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not any(c.islower() for c in data.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in data.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if not any(c in "!@#$%^&*(),.?\":{}|<>" for c in data.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")
    
    # Find and validate OTP
    otp_record = await db.password_otps.find_one({
        "email": data.email,
        "otp": data.otp,
        "type": "forgot_password"
    })
    
    if not otp_record:
        raise HTTPException(status_code=401, detail="Invalid OTP")
    
    if otp_record["expires_at"] < datetime.now(timezone.utc):
        await db.password_otps.delete_one({"_id": otp_record["_id"]})
        raise HTTPException(status_code=401, detail="OTP has expired. Please request a new one")
    
    # Update password
    new_hash = bcrypt.hashpw(data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.users.update_one(
        {"email": data.email},
        {"$set": {"password_hash": new_hash}}
    )
    
    # Delete used OTP
    await db.password_otps.delete_many({"email": data.email})
    
    # Invalidate all existing sessions for this user
    user = await db.users.find_one({"email": data.email})
    if user:
        await db.user_sessions.delete_many({"user_id": user["user_id"]})
    
    return {"message": "Password reset successfully. Please login with your new password."}

@api_router.post("/auth/request-otp")
async def request_password_otp(request: Request, current_user: User = Depends(get_current_user)):
    """Request OTP to change password - sends to registered email"""
    import random
    
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store OTP in database
    await db.password_otps.delete_many({"user_id": current_user.user_id})  # Clear old OTPs
    await db.password_otps.insert_one({
        "user_id": current_user.user_id,
        "email": current_user.email,
        "otp": otp,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Send OTP via email (using Resend if configured)
    try:
        from emergentintegrations.llm.resend import send_email
        await send_email(
            to_email=current_user.email,
            subject="Password Change OTP - Drawlead OS",
            html_content=f"""
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Password Change Request</h2>
                <p>Hi {current_user.name},</p>
                <p>Your OTP for password change is:</p>
                <h1 style="font-size: 32px; color: #6366f1; letter-spacing: 5px;">{otp}</h1>
                <p>This OTP is valid for 10 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
                <br>
                <p>- Drawlead OS Team</p>
            </div>
            """
        )
    except Exception as e:
        logging.error(f"Failed to send OTP email: {e}")
        # Still return success - OTP is stored and can be checked in logs for testing
        logging.info(f"OTP for {current_user.email}: {otp}")
    
    return {"message": "OTP sent to your registered email", "email": current_user.email[:3] + "***" + current_user.email[current_user.email.index("@"):]}

@api_router.post("/auth/verify-otp-change-password")
async def verify_otp_and_change_password(request: Request, current_user: User = Depends(get_current_user)):
    """Verify OTP and change password"""
    body = await request.json()
    otp = body.get("otp")
    new_password = body.get("new_password")
    confirm_password = body.get("confirm_password")
    
    if not otp or not new_password or not confirm_password:
        raise HTTPException(status_code=400, detail="OTP, new password and confirm password are required")
    
    if new_password != confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Verify OTP
    otp_doc = await db.password_otps.find_one({
        "user_id": current_user.user_id,
        "otp": otp
    })
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Handle timezone-aware comparison
    expires_at = otp_doc["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        await db.password_otps.delete_one({"_id": otp_doc["_id"]})
        raise HTTPException(status_code=400, detail="OTP has expired")
    
    # Update password
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    # Delete used OTP
    await db.password_otps.delete_one({"_id": otp_doc["_id"]})
    
    return {"message": "Password changed successfully"}

# ============== SEED DEMO USERS ==============

@api_router.post("/auth/seed-demo-users")
async def seed_demo_users():
    """Seed demo users for testing - creates users if they don't exist"""
    demo_users = [
        {
            "email": "pm@drawlead.com",
            "name": "Project Manager",
            "password": "pm123",
            "role": "project_manager",
            "designation": "Project Manager",
            "department": "Website",
            "module_access": ["website_projects", "tasks", "operations"]
        },
        {
            "email": "hr@drawlead.com",
            "name": "HR Manager",
            "password": "hr123456",
            "role": "hr_manager",
            "designation": "HR Manager",
            "department": "HR",
            "module_access": ["hr", "hr_admin", "operations"]
        },
        {
            "email": "bde@drawlead.com", 
            "name": "Business Dev",
            "password": "bde123456",
            "role": "business_development",
            "designation": "Business Development Executive",
            "department": "Sales",
            "module_access": ["leads", "hr", "operations"]
        },
        {
            "email": "dev@drawlead.com",
            "name": "Web Developer",
            "password": "dev123456",
            "role": "website_developer",
            "designation": "Website Developer",
            "department": "Website",
            "module_access": ["operations", "hr"]
        },
        {
            "email": "seo@drawlead.com",
            "name": "SEO Specialist",
            "password": "seo123456",
            "role": "seo_specialist",
            "designation": "SEO Specialist",
            "department": "SEO",
            "module_access": ["operations", "hr"]
        }
    ]
    
    created = []
    skipped = []
    
    for user_data in demo_users:
        existing = await db.users.find_one({"email": user_data["email"]})
        if existing:
            skipped.append(user_data["email"])
            continue
        
        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "password_hash": hash_password(user_data["password"]),
            "role": user_data["role"],
            "designation": user_data.get("designation", ""),
            "department": user_data.get("department", ""),
            "module_access": user_data.get("module_access", []),
            "can_manage_users": False,
            "picture": "",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.users.insert_one(user_doc)
        
        # Initialize leave balance
        year = datetime.now().year
        await db.leave_balance.update_one(
            {"user_id": user_id, "year": year},
            {"$setOnInsert": {
                "casual_leave": 12,
                "sick_leave": 6,
                "earned_leave": 15,
                "casual_used": 0,
                "sick_used": 0,
                "earned_used": 0
            }},
            upsert=True
        )
        
        created.append(user_data["email"])
    
    return {"message": "Demo users seeded", "created": created, "skipped": skipped}

# ============== ADMIN CREATE USER WITH EMAIL ==============

@api_router.post("/admin/create-user")
async def admin_create_user_with_email(request: Request, current_user: User = Depends(get_current_user)):
    """Admin creates user and sends credentials via email"""
    if current_user.role not in ["super_admin", "admin"] or not current_user.can_manage_users:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    body = await request.json()
    email = body.get("email")
    name = body.get("name")
    password = body.get("password")
    role = body.get("role", "business_development")
    module_access = body.get("module_access", [])
    
    if not email or not name or not password:
        raise HTTPException(status_code=400, detail="Email, name and password are required")
    
    # Check if email exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Set default permissions based on role
    if role == "super_admin":
        module_access = ["leads", "hr", "operations", "finance", "reports", "settings"]
        can_manage_users = True
    elif role == "admin":
        module_access = ["leads", "hr", "operations", "finance", "reports", "settings"]
        can_manage_users = True
    elif role == "business_development":
        module_access = ["leads", "hr", "operations", "settings"]
        can_manage_users = False
    elif role == "project_manager":
        module_access = ["operations", "reports", "hr"]
        can_manage_users = False
    elif role == "employee":
        module_access = ["operations", "hr"]
        can_manage_users = False
    else:
        can_manage_users = False
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "role": role,
        "password_hash": hash_password(password),
        "is_active": True,
        "module_access": module_access,
        "project_access": [],
        "can_create_projects": role in ["super_admin", "admin", "project_manager"],
        "can_delete_tasks": role in ["super_admin", "admin"],
        "can_manage_users": can_manage_users,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user_doc)
    
    # Send credentials via email
    try:
        from emergentintegrations.llm.resend import send_email
        await send_email(
            to_email=email,
            subject="Welcome to Drawlead OS - Your Login Credentials",
            html_content=f"""
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                <h2 style="color: #6366f1;">Welcome to Drawlead OS!</h2>
                <p>Hi {name},</p>
                <p>Your account has been created. Here are your login credentials:</p>
                <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Email:</strong> {email}</p>
                    <p><strong>Password:</strong> {password}</p>
                    <p><strong>Role:</strong> {role.replace('_', ' ').title()}</p>
                </div>
                <p>Please login and change your password for security.</p>
                <a href="https://drawlead-docs.preview.emergentagent.com/login" 
                   style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; margin-top: 10px;">
                    Login Now
                </a>
                <br><br>
                <p style="color: #71717a; font-size: 14px;">- Drawlead OS Team</p>
            </div>
            """
        )
        email_sent = True
    except Exception as e:
        logging.error(f"Failed to send credentials email: {e}")
        email_sent = False
    
    user_response = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {
        "user": user_response,
        "email_sent": email_sent,
        "message": "User created successfully" + (" and credentials sent via email" if email_sent else " (email not sent)")
    }

@api_router.post("/admin/reset-user-password/{user_id}")
async def admin_reset_user_password(user_id: str, request: Request, current_user: User = Depends(get_current_user)):
    """Admin manually resets user password"""
    if current_user.role not in ["super_admin", "admin"] or not current_user.can_manage_users:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    body = await request.json()
    new_password = body.get("new_password")
    send_email_flag = body.get("send_email", True)
    
    if not new_password:
        raise HTTPException(status_code=400, detail="New password is required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Get user
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow resetting super_admin password unless you're super_admin
    if user.get("role") == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot reset super admin password")
    
    # Update password
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    # Send email notification if requested
    email_sent = False
    if send_email_flag:
        try:
            from emergentintegrations.llm.resend import send_email
            await send_email(
                to_email=user["email"],
                subject="Password Reset - Drawlead OS",
                html_content=f"""
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Password Reset</h2>
                    <p>Hi {user['name']},</p>
                    <p>Your password has been reset by an administrator.</p>
                    <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>New Password:</strong> {new_password}</p>
                    </div>
                    <p>Please login and change your password for security.</p>
                    <br>
                    <p>- Drawlead OS Team</p>
                </div>
                """
            )
            email_sent = True
        except Exception as e:
            logging.error(f"Failed to send password reset email: {e}")
    
    return {
        "message": "Password reset successfully",
        "email_sent": email_sent
    }

@api_router.get("/admin/roles")
async def get_available_roles(current_user: User = Depends(get_current_user)):
    """Get available roles for user creation"""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    roles = [
        {
            "value": "super_admin",
            "label": "Super Admin",
            "description": "Full access to all modules",
            "default_access": ["leads", "hr", "operations", "finance", "reports", "settings"]
        },
        {
            "value": "admin",
            "label": "Admin",
            "description": "Full access to all modules",
            "default_access": ["leads", "hr", "operations", "finance", "reports", "settings"]
        },
        {
            "value": "business_development",
            "label": "Business Development",
            "description": "Access to Leads, HR and Settings",
            "default_access": ["leads", "hr", "settings"]
        },
        {
            "value": "project_manager",
            "label": "Project Manager",
            "description": "Access to Operations and Reports",
            "default_access": ["operations", "reports", "hr"]
        },
        {
            "value": "employee",
            "label": "Employee",
            "description": "Limited access to assigned tasks",
            "default_access": ["operations", "hr"]
        }
    ]
    
    # Super admin can create other super admins, admin cannot
    if current_user.role != "super_admin":
        roles = [r for r in roles if r["value"] != "super_admin"]
    
    return roles

# ============== SERVICE ROUTES ==============

@api_router.post("/services")
async def create_service(service_data: ServiceCreate, user: User = Depends(get_current_user)):
    service_id = f"service_{uuid.uuid4().hex[:12]}"
    service_doc = {
        "service_id": service_id,
        "name": service_data.name,
        "category": service_data.category,
        "billing_type": service_data.billing_type,
        "amount": service_data.amount,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "created_by": user.user_id
    }
    
    await db.services.insert_one(service_doc)
    result = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    return result

@api_router.get("/services")
async def get_services(user: User = Depends(get_current_user)):
    services = await db.services.find({"is_active": True}, {"_id": 0}).sort("name", 1).to_list(1000)
    return services

@api_router.put("/services/{service_id}")
async def update_service(service_id: str, service_data: ServiceCreate, user: User = Depends(get_current_user)):
    await db.services.update_one(
        {"service_id": service_id},
        {"$set": service_data.model_dump()}
    )
    result = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    return result

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, user: User = Depends(get_current_user)):
    await db.services.update_one(
        {"service_id": service_id},
        {"$set": {"is_active": False}}
    )
    return {"message": "Service deleted"}

# ============== SOURCE ROUTES ==============

@api_router.post("/sources")
async def create_source(source_data: LeadSourceCreate, user: User = Depends(get_current_user)):
    source_id = f"source_{uuid.uuid4().hex[:12]}"
    source_doc = {
        "source_id": source_id,
        "name": source_data.name,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "created_by": user.user_id
    }
    
    await db.lead_sources.insert_one(source_doc)
    result = await db.lead_sources.find_one({"source_id": source_id}, {"_id": 0})
    return result

@api_router.get("/sources")
async def get_sources(user: User = Depends(get_current_user)):
    sources = await db.lead_sources.find({"is_active": True}, {"_id": 0}).sort("name", 1).to_list(1000)
    return sources

# ============== STATUS ROUTES ==============

@api_router.post("/statuses")
async def create_status(status_data: StatusCreate, user: User = Depends(get_current_user)):
    # Get max order
    if status_data.order is None:
        max_status = await db.statuses.find_one({}, {"_id": 0, "order": 1}, sort=[("order", -1)])
        order = (max_status["order"] + 1) if max_status else 0
    else:
        order = status_data.order
    
    status_id = f"status_{uuid.uuid4().hex[:12]}"
    status_doc = {
        "status_id": status_id,
        "name": status_data.name,
        "color": status_data.color,
        "order": order,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "created_by": user.user_id
    }
    
    await db.statuses.insert_one(status_doc)
    result = await db.statuses.find_one({"status_id": status_id}, {"_id": 0})
    return result

@api_router.get("/statuses")
async def get_statuses(user: User = Depends(get_current_user)):
    statuses = await db.statuses.find({"is_active": True}, {"_id": 0}).sort("order", 1).to_list(1000)
    return statuses

@api_router.put("/statuses/{status_id}")
async def update_status(status_id: str, status_data: StatusUpdate, user: User = Depends(get_current_user)):
    """Update a status"""
    status = await db.statuses.find_one({"status_id": status_id})
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")
    
    update_dict = status_data.model_dump(exclude_unset=True)
    if update_dict:
        await db.statuses.update_one(
            {"status_id": status_id},
            {"$set": update_dict}
        )
    
    return await db.statuses.find_one({"status_id": status_id}, {"_id": 0})

@api_router.delete("/statuses/{status_id}")
async def delete_status(status_id: str, user: User = Depends(get_current_user)):
    """Soft delete a status"""
    await db.statuses.update_one(
        {"status_id": status_id},
        {"$set": {"is_active": False}}
    )
    return {"message": "Status deleted"}

@api_router.put("/statuses/reorder")
async def reorder_statuses(status_orders: List[Dict[str, Any]], user: User = Depends(get_current_user)):
    """Reorder statuses - expects list of {status_id, order}"""
    for item in status_orders:
        await db.statuses.update_one(
            {"status_id": item["status_id"]},
            {"$set": {"order": item["order"]}}
        )
    return {"message": "Statuses reordered"}

# ============== COMPANY PROFILE ROUTES ==============

@api_router.get("/company-profile")
async def get_company_profile(user: User = Depends(get_current_user)):
    """Get company profile"""
    profile = await db.company_profile.find_one({}, {"_id": 0})
    if not profile:
        # Return default profile
        return {
            "company_name": "Drawlead",
            "logo_url": None,
            "address": "",
            "city": "",
            "state": "",
            "pincode": "",
            "phone": "",
            "email": "",
            "website": "",
            "gst_number": "",
            "pan_number": "",
            "invoice_prefix": "INV",
            "terms_conditions": "",
            "bank_details": {
                "account_name": "",
                "account_number": "",
                "ifsc_code": "",
                "bank_name": "",
                "branch": ""
            },
            "upi_ids": []
        }
    return profile

@api_router.put("/company-profile")
async def update_company_profile(profile_data: CompanyProfileUpdate, user: User = Depends(get_current_user)):
    """Update company profile"""
    update_dict = profile_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    update_dict["updated_by"] = user.user_id
    
    # Convert bank_details to dict if present
    if "bank_details" in update_dict and update_dict["bank_details"]:
        update_dict["bank_details"] = update_dict["bank_details"].model_dump() if hasattr(update_dict["bank_details"], "model_dump") else update_dict["bank_details"]
    
    existing = await db.company_profile.find_one({})
    if existing:
        await db.company_profile.update_one({}, {"$set": update_dict})
    else:
        await db.company_profile.insert_one(update_dict)
    
    return await db.company_profile.find_one({}, {"_id": 0})

# ============== WORKSPACE ROUTES ==============

@api_router.get("/workspaces")
async def get_workspaces(user: User = Depends(get_current_user)):
    """Get all workspaces"""
    workspaces = await db.workspaces.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    # If no workspaces exist, create default ones
    if not workspaces:
        default_workspaces = [
            {"name": "Sales", "description": "Sales and lead management", "icon": "TrendingUp", "color": "#3b82f6"},
            {"name": "Operations", "description": "Project and task management", "icon": "Settings", "color": "#10b981"},
            {"name": "Finance", "description": "Invoicing and payments", "icon": "DollarSign", "color": "#f59e0b"},
            {"name": "Marketing", "description": "Marketing campaigns", "icon": "Megaphone", "color": "#8b5cf6"},
            {"name": "HR", "description": "Human resources", "icon": "Users", "color": "#ef4444"},
        ]
        
        for ws in default_workspaces:
            workspace_id = f"ws_{uuid.uuid4().hex[:12]}"
            workspace_doc = {
                "workspace_id": workspace_id,
                **ws,
                "is_active": True,
                "members": [],
                "created_at": datetime.now(timezone.utc),
                "created_by": user.user_id
            }
            await db.workspaces.insert_one(workspace_doc)
        
        workspaces = await db.workspaces.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    return workspaces

@api_router.post("/workspaces")
async def create_workspace(workspace_data: WorkspaceCreate, user: User = Depends(get_current_user)):
    """Create a new workspace"""
    workspace_id = f"ws_{uuid.uuid4().hex[:12]}"
    workspace_doc = {
        "workspace_id": workspace_id,
        **workspace_data.model_dump(),
        "is_active": True,
        "members": [],
        "created_at": datetime.now(timezone.utc),
        "created_by": user.user_id
    }
    await db.workspaces.insert_one(workspace_doc)
    return await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})

@api_router.put("/workspaces/{workspace_id}")
async def update_workspace(workspace_id: str, workspace_data: WorkspaceUpdate, user: User = Depends(get_current_user)):
    """Update workspace"""
    workspace = await db.workspaces.find_one({"workspace_id": workspace_id})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    update_dict = workspace_data.model_dump(exclude_unset=True)
    if update_dict:
        await db.workspaces.update_one(
            {"workspace_id": workspace_id},
            {"$set": update_dict}
        )
    
    return await db.workspaces.find_one({"workspace_id": workspace_id}, {"_id": 0})

@api_router.delete("/workspaces/{workspace_id}")
async def delete_workspace(workspace_id: str, user: User = Depends(get_current_user)):
    """Soft delete workspace"""
    await db.workspaces.update_one(
        {"workspace_id": workspace_id},
        {"$set": {"is_active": False}}
    )
    return {"message": "Workspace deleted"}

@api_router.post("/workspaces/{workspace_id}/members")
async def add_workspace_member(workspace_id: str, user_id: str, user: User = Depends(get_current_user)):
    """Add member to workspace"""
    await db.workspaces.update_one(
        {"workspace_id": workspace_id},
        {"$addToSet": {"members": user_id}}
    )
    return {"message": "Member added"}

@api_router.delete("/workspaces/{workspace_id}/members/{member_id}")
async def remove_workspace_member(workspace_id: str, member_id: str, user: User = Depends(get_current_user)):
    """Remove member from workspace"""
    await db.workspaces.update_one(
        {"workspace_id": workspace_id},
        {"$pull": {"members": member_id}}
    )
    return {"message": "Member removed"}

# ============== LEAD ROUTES ==============

def enrich_lead_fast(lead_doc: Dict[str, Any], services_map: Dict, sources_map: Dict, statuses_map: Dict, users_map: Dict) -> Dict[str, Any]:
    # Get service details from in-memory map
    if lead_doc.get("service_id") and lead_doc["service_id"] in services_map:
        lead_doc["service_name"] = services_map[lead_doc["service_id"]]["name"]
    
    # Get source details from in-memory map
    if lead_doc.get("source_id") and lead_doc["source_id"] in sources_map:
        lead_doc["source_name"] = sources_map[lead_doc["source_id"]]["name"]
    
    # Get status details from in-memory map
    if lead_doc.get("status_id") and lead_doc["status_id"] in statuses_map:
        lead_doc["status_name"] = statuses_map[lead_doc["status_id"]]["name"]
        lead_doc["status_color"] = statuses_map[lead_doc["status_id"]]["color"]
    
    # Get assigned user details from in-memory map
    if lead_doc.get("assigned_to") and lead_doc["assigned_to"] in users_map:
        lead_doc["assigned_to_name"] = users_map[lead_doc["assigned_to"]]["name"]
    
    return lead_doc

async def get_reference_data_maps():
    # Batch fetch all reference data once
    services = await db.services.find({"is_active": True}, {"_id": 0}).to_list(1000)
    sources = await db.lead_sources.find({"is_active": True}, {"_id": 0}).to_list(1000)
    statuses = await db.statuses.find({"is_active": True}, {"_id": 0}).to_list(1000)
    users = await db.users.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    # Create lookup maps
    services_map = {s["service_id"]: s for s in services}
    sources_map = {s["source_id"]: s for s in sources}
    statuses_map = {s["status_id"]: s for s in statuses}
    users_map = {u["user_id"]: u for u in users}
    
    return services_map, sources_map, statuses_map, users_map

@api_router.post("/leads")
async def create_lead(lead_data: LeadCreate, user: User = Depends(get_current_user)):
    lead_id = f"lead_{uuid.uuid4().hex[:12]}"
    
    lead_doc = {
        "lead_id": lead_id,
        **lead_data.model_dump(exclude_unset=True),
        "date_of_lead": lead_data.date_of_lead or datetime.now(timezone.utc),
        "assigned_to": user.user_id,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.leads.insert_one(lead_doc)
    result = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    # Get reference data maps for enrichment
    services_map, sources_map, statuses_map, users_map = await get_reference_data_maps()
    result = enrich_lead_fast(result, services_map, sources_map, statuses_map, users_map)
    
    return result

@api_router.get("/leads")
async def get_leads(
    user: User = Depends(get_current_user),
    status_id: Optional[str] = None,
    service_id: Optional[str] = None,
    source_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None
):
    query = {"is_deleted": False}
    
    # BDE can only see their own leads
    if user.role == "bde":
        query["assigned_to"] = user.user_id
    elif assigned_to:
        query["assigned_to"] = assigned_to
    
    if status_id:
        query["status_id"] = status_id
    if service_id:
        query["service_id"] = service_id
    if source_id:
        query["source_id"] = source_id
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"business_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get reference data maps once for all leads
    services_map, sources_map, statuses_map, users_map = await get_reference_data_maps()
    
    # Enrich each lead using fast method
    enriched_leads = []
    for lead in leads:
        enriched_lead = enrich_lead_fast(lead, services_map, sources_map, statuses_map, users_map)
        enriched_leads.append(enriched_lead)
    
    return enriched_leads

@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user: User = Depends(get_current_user)):
    lead = await db.leads.find_one({"lead_id": lead_id, "is_deleted": False}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # BDE can only see their own leads
    if user.role == "bde" and lead["assigned_to"] != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get reference data maps for enrichment
    services_map, sources_map, statuses_map, users_map = await get_reference_data_maps()
    lead = enrich_lead_fast(lead, services_map, sources_map, statuses_map, users_map)
    return lead

@api_router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, lead_data: LeadUpdate, user: User = Depends(get_current_user)):
    lead = await db.leads.find_one({"lead_id": lead_id, "is_deleted": False}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # BDE can only update their own leads
    if user.role == "bde" and lead["assigned_to"] != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if status changed to Closed Won
    old_status = lead.get("status_id")
    new_status = lead_data.status_id
    
    update_data = lead_data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.leads.update_one(
        {"lead_id": lead_id},
        {"$set": update_data}
    )
    
    # AUTOMATION: Create Finance Sale if status changed to Closed Won
    if new_status and new_status != old_status:
        new_status_doc = await db.statuses.find_one({"status_id": new_status}, {"_id": 0})
        if new_status_doc and new_status_doc["name"].lower() == "closed won":
            # Create finance sale
            enriched_lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
            
            # Get reference data maps for enrichment
            services_map, sources_map, statuses_map, users_map = await get_reference_data_maps()
            enriched_lead = enrich_lead_fast(enriched_lead, services_map, sources_map, statuses_map, users_map)
            
            sale_id = f"sale_{uuid.uuid4().hex[:12]}"
            sale_doc = {
                "sale_id": sale_id,
                "lead_id": lead_id,
                "client_name": enriched_lead["name"],
                "service_id": enriched_lead.get("service_id", ""),
                "service_name": enriched_lead.get("service_name", "N/A"),
                "amount": enriched_lead.get("service_cost", 0.0),
                "deal_date": datetime.now(timezone.utc),
                "has_gst": False,
                "invoice_status": "pending",
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.finance_sales.insert_one(sale_doc)
    
    result = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    
    # Get reference data maps for enrichment
    services_map, sources_map, statuses_map, users_map = await get_reference_data_maps()
    result = enrich_lead_fast(result, services_map, sources_map, statuses_map, users_map)
    
    return result

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user: User = Depends(get_current_user)):
    lead = await db.leads.find_one({"lead_id": lead_id, "is_deleted": False}, {"_id": 0})
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # BDE cannot delete leads
    if user.role == "bde":
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.leads.update_one(
        {"lead_id": lead_id},
        {"$set": {"is_deleted": True}}
    )
    
    return {"message": "Lead deleted"}

@api_router.get("/leads/kanban/view")
async def get_kanban_view(user: User = Depends(get_current_user)):
    # Get all statuses
    statuses = await db.statuses.find({"is_active": True}, {"_id": 0}).sort("order", 1).to_list(1000)
    
    # Get leads grouped by status
    query = {"is_deleted": False}
    if user.role == "bde":
        query["assigned_to"] = user.user_id
    
    leads = await db.leads.find(query, {"_id": 0}).to_list(1000)
    
    # Get reference data maps once for all leads
    services_map, sources_map, statuses_map, users_map = await get_reference_data_maps()
    
    # Enrich and group by status
    kanban_data = {}
    for status in statuses:
        kanban_data[status["status_id"]] = {
            "status": status,
            "leads": []
        }
    
    for lead in leads:
        enriched_lead = enrich_lead_fast(lead, services_map, sources_map, statuses_map, users_map)
        if enriched_lead["status_id"] in kanban_data:
            kanban_data[enriched_lead["status_id"]]["leads"].append(enriched_lead)
    
    return list(kanban_data.values())

# ============== IMPORT/EXPORT ROUTES ==============

@api_router.post("/leads/import")
async def import_leads(file_data: Dict[str, Any], user: User = Depends(get_current_user)):
    # file_data should contain: {"csv_data": "...", "mapping": {...}}
    csv_content = file_data.get("csv_data", "")
    field_mapping = file_data.get("mapping", {})
    
    # Parse CSV
    csv_file = io.StringIO(csv_content)
    reader = csv.DictReader(csv_file)
    
    imported_count = 0
    errors = []
    
    for row in reader:
        try:
            lead_data = {}
            for our_field, csv_field in field_mapping.items():
                if csv_field in row:
                    lead_data[our_field] = row[csv_field]
            
            # Create lead
            lead_create = LeadCreate(**lead_data)
            await create_lead(lead_create, user)
            imported_count += 1
        except Exception as e:
            errors.append(f"Row {imported_count + len(errors) + 1}: {str(e)}")
    
    return {
        "imported": imported_count,
        "errors": errors
    }

@api_router.get("/leads/export")
async def export_leads(user: User = Depends(get_current_user)):
    query = {"is_deleted": False}
    if user.role == "bde":
        query["assigned_to"] = user.user_id
    
    leads = await db.leads.find(query, {"_id": 0}).to_list(1000)
    
    # Get reference data maps once for all leads
    services_map, sources_map, statuses_map, users_map = await get_reference_data_maps()
    
    # Enrich leads using fast method
    enriched_leads = []
    for lead in leads:
        enriched_lead = enrich_lead_fast(lead, services_map, sources_map, statuses_map, users_map)
        enriched_leads.append(enriched_lead)
    
    return enriched_leads

# ============== FINANCE ROUTES ==============

@api_router.get("/finance/sales")
async def get_finance_sales(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    sales = await db.finance_sales.find({}, {"_id": 0}).sort("deal_date", -1).to_list(1000)
    return sales

@api_router.put("/finance/sales/{sale_id}")
async def update_finance_sale(sale_id: str, update_data: Dict[str, Any], user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.finance_sales.update_one(
        {"sale_id": sale_id},
        {"$set": update_data}
    )
    
    result = await db.finance_sales.find_one({"sale_id": sale_id}, {"_id": 0})
    return result

# ============== REPORTS ==============

@api_router.get("/reports/stats")
async def get_stats(user: User = Depends(get_current_user)):
    query = {"is_deleted": False}
    if user.role == "bde":
        query["assigned_to"] = user.user_id
    
    # Total leads
    total_leads = await db.leads.count_documents(query)
    
    # Use aggregation pipeline for efficient counting
    # Leads by status
    status_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$status_id", "count": {"$sum": 1}}}
    ]
    status_counts = {doc["_id"]: doc["count"] for doc in await db.leads.aggregate(status_pipeline).to_list(1000)}
    
    statuses = await db.statuses.find({"is_active": True}, {"_id": 0}).to_list(1000)
    status_stats = [{
        "status_id": status["status_id"],
        "status_name": status["name"],
        "count": status_counts.get(status["status_id"], 0)
    } for status in statuses]
    
    # Leads by service
    service_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$service_id", "count": {"$sum": 1}}}
    ]
    service_counts = {doc["_id"]: doc["count"] for doc in await db.leads.aggregate(service_pipeline).to_list(1000)}
    
    services = await db.services.find({"is_active": True}, {"_id": 0}).to_list(1000)
    service_stats = [{
        "service_id": service["service_id"],
        "service_name": service["name"],
        "count": service_counts.get(service["service_id"], 0)
    } for service in services]
    
    # Leads by source
    source_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$source_id", "count": {"$sum": 1}}}
    ]
    source_counts = {doc["_id"]: doc["count"] for doc in await db.leads.aggregate(source_pipeline).to_list(1000)}
    
    sources = await db.lead_sources.find({"is_active": True}, {"_id": 0}).to_list(1000)
    source_stats = [{
        "source_id": source["source_id"],
        "source_name": source["name"],
        "count": source_counts.get(source["source_id"], 0)
    } for source in sources]
    
    return {
        "total_leads": total_leads,
        "by_status": status_stats,
        "by_service": service_stats,
        "by_source": source_stats
    }

# ============== SEED DATA ==============

@api_router.post("/seed-data")
async def seed_data():
    # Check if already seeded
    existing_user = await db.users.find_one({})
    if existing_user:
        return {"message": "Data already seeded"}
    
    # Create super admin user
    super_admin_id = f"user_{uuid.uuid4().hex[:12]}"
    super_admin_doc = {
        "user_id": super_admin_id,
        "email": "superadmin@drawlead.com",
        "name": "Super Admin",
        "role": "super_admin",
        "password_hash": hash_password("super123"),
        "is_active": True,
        "module_access": ["leads", "operations", "finance", "reports", "settings"],
        "project_access": [],
        "can_create_projects": True,
        "can_delete_tasks": True,
        "can_manage_users": True,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(super_admin_doc)
    
    # Create admin user
    admin_id = f"user_{uuid.uuid4().hex[:12]}"
    admin_doc = {
        "user_id": admin_id,
        "email": "admin@drawlead.com",
        "name": "Admin User",
        "role": "admin",
        "password_hash": hash_password("admin123"),
        "is_active": True,
        "module_access": ["leads", "operations", "finance", "reports", "settings"],
        "project_access": [],
        "can_create_projects": True,
        "can_delete_tasks": True,
        "can_manage_users": True,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(admin_doc)
    
    # Create BDE user
    bde_id = f"user_{uuid.uuid4().hex[:12]}"
    bde_doc = {
        "user_id": bde_id,
        "email": "bde@drawlead.com",
        "name": "Sales Executive",
        "role": "bde",
        "password_hash": hash_password("bde123"),
        "is_active": True,
        "module_access": ["leads"],
        "project_access": [],
        "can_create_projects": False,
        "can_delete_tasks": False,
        "can_manage_users": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(bde_doc)
    
    # Create Project Manager user
    pm_id = f"user_{uuid.uuid4().hex[:12]}"
    pm_doc = {
        "user_id": pm_id,
        "email": "pm@drawlead.com",
        "name": "Project Manager",
        "role": "project_manager",
        "password_hash": hash_password("pm123"),
        "is_active": True,
        "module_access": ["operations", "reports"],
        "project_access": [],
        "can_create_projects": True,
        "can_delete_tasks": False,
        "can_manage_users": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(pm_doc)
    
    # Create Employee user
    emp_id = f"user_{uuid.uuid4().hex[:12]}"
    emp_doc = {
        "user_id": emp_id,
        "email": "employee@drawlead.com",
        "name": "Team Member",
        "role": "employee",
        "password_hash": hash_password("emp123"),
        "is_active": True,
        "module_access": ["operations"],
        "project_access": [],
        "can_create_projects": False,
        "can_delete_tasks": False,
        "can_manage_users": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(emp_doc)
    
    # Create services
    services_data = [
        {"name": "Website Development", "category": "Development", "billing_type": "one-time", "amount": 50000},
        {"name": "SEO Services", "category": "Marketing", "billing_type": "recurring", "amount": 15000},
        {"name": "Social Media Marketing", "category": "Marketing", "billing_type": "recurring", "amount": 20000},
        {"name": "Mobile App Development", "category": "Development", "billing_type": "one-time", "amount": 75000},
        {"name": "Brand Strategy", "category": "Consulting", "billing_type": "one-time", "amount": 30000}
    ]
    
    service_ids = []
    for service in services_data:
        service_id = f"service_{uuid.uuid4().hex[:12]}"
        service_doc = {
            "service_id": service_id,
            **service,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "created_by": admin_id
        }
        await db.services.insert_one(service_doc)
        service_ids.append(service_id)
    
    # Create sources
    sources_data = [
        "Meta Ads",
        "Google Ads",
        "Referral",
        "WhatsApp",
        "Cold Call",
        "LinkedIn",
        "Website"
    ]
    
    source_ids = []
    for source_name in sources_data:
        source_id = f"source_{uuid.uuid4().hex[:12]}"
        source_doc = {
            "source_id": source_id,
            "name": source_name,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "created_by": admin_id
        }
        await db.lead_sources.insert_one(source_doc)
        source_ids.append(source_id)
    
    # Create statuses
    statuses_data = [
        {"name": "New Lead", "color": "#3b82f6", "order": 0},
        {"name": "Contacted", "color": "#8b5cf6", "order": 1},
        {"name": "Qualified", "color": "#f59e0b", "order": 2},
        {"name": "Proposal Sent", "color": "#10b981", "order": 3},
        {"name": "Negotiation", "color": "#f97316", "order": 4},
        {"name": "Closed Won", "color": "#22c55e", "order": 5},
        {"name": "Closed Lost", "color": "#ef4444", "order": 6}
    ]
    
    status_ids = []
    for status_data in statuses_data:
        status_id = f"status_{uuid.uuid4().hex[:12]}"
        status_doc = {
            "status_id": status_id,
            **status_data,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "created_by": admin_id
        }
        await db.statuses.insert_one(status_doc)
        status_ids.append(status_id)
    
    # Create sample leads
    sample_leads = [
        {
            "name": "Tech Innovations Ltd",
            "phone": "+91-9876543210",
            "email": "info@techinnovations.com",
            "business_name": "Tech Innovations Ltd",
            "website": "www.techinnovations.com",
            "service_id": service_ids[0],
            "source_id": source_ids[0],
            "status_id": status_ids[0],
            "service_cost": 50000
        },
        {
            "name": "Green Earth Org",
            "phone": "+91-9876543211",
            "email": "contact@greenearth.org",
            "business_name": "Green Earth Org",
            "website": "www.greenearth.org",
            "service_id": service_ids[1],
            "source_id": source_ids[2],
            "status_id": status_ids[1],
            "service_cost": 15000
        },
        {
            "name": "Fashion Hub",
            "phone": "+91-9876543212",
            "email": "hello@fashionhub.com",
            "business_name": "Fashion Hub",
            "website": "www.fashionhub.com",
            "service_id": service_ids[2],
            "source_id": source_ids[1],
            "status_id": status_ids[3],
            "service_cost": 20000
        },
        {
            "name": "Startup Connect",
            "phone": "+91-9876543213",
            "email": "team@startupconnect.io",
            "business_name": "Startup Connect",
            "service_id": service_ids[3],
            "source_id": source_ids[4],
            "status_id": status_ids[2],
            "service_cost": 75000
        }
    ]
    
    for lead_data in sample_leads:
        lead_id = f"lead_{uuid.uuid4().hex[:12]}"
        lead_doc = {
            "lead_id": lead_id,
            **lead_data,
            "date_of_lead": datetime.now(timezone.utc),
            "assigned_to": bde_id,
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.leads.insert_one(lead_doc)
    
    return {
        "message": "Sample data seeded successfully",
        "users": {
            "super_admin": {"email": "superadmin@drawlead.com", "password": "super123"},
            "admin": {"email": "admin@drawlead.com", "password": "admin123"},
            "bde": {"email": "bde@drawlead.com", "password": "bde123"},
            "project_manager": {"email": "pm@drawlead.com", "password": "pm123"},
            "employee": {"email": "employee@drawlead.com", "password": "emp123"}
        }
    }

# Include finance and operations routers in api_router BEFORE including api_router in app
api_router.include_router(finance_router)
api_router.include_router(operations_router)
api_router.include_router(hr_router)
api_router.include_router(notion_router)
api_router.include_router(chat_router)
api_router.include_router(marketing_router)
api_router.include_router(ai_router)
api_router.include_router(sop_router)
api_router.include_router(website_projects_router)
api_router.include_router(expense_router)
api_router.include_router(social_media_router)
api_router.include_router(creative_router)
api_router.include_router(meta_ads_router)
api_router.include_router(leads_v2_router)
api_router.include_router(documentation_router)
api_router.include_router(seo_board_router)
api_router.include_router(designation_router)
api_router.include_router(bde_router)
api_router.include_router(our_tasks_router)
api_router.include_router(calendar_router)
api_router.include_router(payroll_router)
api_router.include_router(department_router)

# Include router in main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
