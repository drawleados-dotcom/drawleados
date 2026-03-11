from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

documentation_router = APIRouter(prefix="/docs", tags=["documentation"])

# Database reference - will be set by init function
doc_db = None

def init_documentation_db(db):
    """Initialize the documentation module with the database instance"""
    global doc_db
    doc_db = db

# Department/Role mapping for documents
DEPARTMENTS = {
    'ceo': {'name': 'CEO', 'color': '#ef4444'},
    'bd': {'name': 'Business Development', 'color': '#3b82f6'},
    'operations': {'name': 'Operations', 'color': '#8b5cf6'},
    'website': {'name': 'Website Development', 'color': '#22c55e'},
    'seo': {'name': 'SEO', 'color': '#f59e0b'},
    'meta': {'name': 'Meta Ads', 'color': '#ec4899'},
}

# Map user roles to departments
ROLE_TO_DEPARTMENT = {
    'super_admin': 'ceo',
    'admin': 'operations',
    'business_development': 'bd',
    'bde': 'bd',
    'project_manager': 'operations',
    'seo': 'seo',
    'meta_ads': 'meta',
    'website_developer': 'website',
    'employee': 'operations',
}

# Pydantic models
class DocumentCreate(BaseModel):
    name: str
    link: str
    doc_type: str  # 'sheet' or 'doc'
    department: Optional[str] = None  # Will be auto-set based on user role
    description: Optional[str] = ''

class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    link: Optional[str] = None
    description: Optional[str] = None

# Helper to get user from request
async def get_current_user_from_request(request: Request):
    if doc_db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    session = await doc_db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await doc_db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

def get_user_department(user):
    """Get department based on user role"""
    role = user.get('role', 'employee')
    return ROLE_TO_DEPARTMENT.get(role, 'operations')

def can_view_all_departments(user):
    """Check if user can view all departments (admin/operations)"""
    role = user.get('role', 'employee')
    return role in ['super_admin', 'admin', 'project_manager']

# ============== DOCUMENTS ROUTES ==============

@documentation_router.get("/departments")
async def get_departments(request: Request):
    """Get all departments for admin view"""
    await get_current_user_from_request(request)
    return DEPARTMENTS

@documentation_router.get("/documents")
async def get_documents(
    request: Request,
    doc_type: Optional[str] = None,
    department: Optional[str] = None
):
    """Get documents filtered by user's access level"""
    user = await get_current_user_from_request(request)
    
    query = {"is_deleted": {"$ne": True}}
    
    # If user can view all departments, optionally filter by department param
    if can_view_all_departments(user):
        if department:
            query["department"] = department
    else:
        # Regular users only see their own department's documents
        user_dept = get_user_department(user)
        query["department"] = user_dept
    
    if doc_type:
        query["doc_type"] = doc_type
    
    documents = await doc_db.documentation.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return documents

@documentation_router.get("/documents/all")
async def get_all_documents_grouped(request: Request):
    """Get all documents grouped by department (admin only)"""
    user = await get_current_user_from_request(request)
    
    if not can_view_all_departments(user):
        raise HTTPException(status_code=403, detail="Not authorized to view all departments")
    
    query = {"is_deleted": {"$ne": True}}
    documents = await doc_db.documentation.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Group by department
    grouped = {}
    for dept_key in DEPARTMENTS.keys():
        grouped[dept_key] = {
            'sheets': [],
            'docs': []
        }
    
    for doc in documents:
        dept = doc.get('department', 'operations')
        if dept not in grouped:
            grouped[dept] = {'sheets': [], 'docs': []}
        
        if doc.get('doc_type') == 'sheet':
            grouped[dept]['sheets'].append(doc)
        else:
            grouped[dept]['docs'].append(doc)
    
    return grouped

@documentation_router.post("/documents")
async def create_document(doc_data: DocumentCreate, request: Request):
    """Create a new document entry"""
    user = await get_current_user_from_request(request)
    
    # Auto-assign department based on user role if not provided
    department = doc_data.department
    if not department:
        department = get_user_department(user)
    
    # Admins can create docs for any department, others only for their own
    if not can_view_all_departments(user):
        department = get_user_department(user)
    
    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    doc = {
        "doc_id": doc_id,
        "name": doc_data.name,
        "link": doc_data.link,
        "doc_type": doc_data.doc_type,
        "department": department,
        "description": doc_data.description,
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await doc_db.documentation.insert_one(doc)
    return await doc_db.documentation.find_one({"doc_id": doc_id}, {"_id": 0})

@documentation_router.put("/documents/{doc_id}")
async def update_document(doc_id: str, update_data: DocumentUpdate, request: Request):
    """Update a document"""
    await get_current_user_from_request(request)
    
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await doc_db.documentation.update_one(
        {"doc_id": doc_id},
        {"$set": update_dict}
    )
    
    return await doc_db.documentation.find_one({"doc_id": doc_id}, {"_id": 0})

@documentation_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, request: Request):
    """Soft delete a document"""
    await get_current_user_from_request(request)
    
    await doc_db.documentation.update_one(
        {"doc_id": doc_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Document deleted"}

@documentation_router.get("/stats")
async def get_doc_stats(request: Request):
    """Get document statistics based on user's access"""
    user = await get_current_user_from_request(request)
    
    query = {"is_deleted": {"$ne": True}}
    
    # If not admin, only count user's department
    if not can_view_all_departments(user):
        user_dept = get_user_department(user)
        query["department"] = user_dept
    
    sheets_count = await doc_db.documentation.count_documents({**query, "doc_type": "sheet"})
    docs_count = await doc_db.documentation.count_documents({**query, "doc_type": "doc"})
    
    return {
        "sheets": sheets_count,
        "docs": docs_count,
        "total": sheets_count + docs_count
    }

@documentation_router.get("/stats/by-department")
async def get_stats_by_department(request: Request):
    """Get document statistics by department (admin only)"""
    user = await get_current_user_from_request(request)
    
    if not can_view_all_departments(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stats = {}
    for dept_key in DEPARTMENTS.keys():
        query = {"is_deleted": {"$ne": True}, "department": dept_key}
        sheets_count = await doc_db.documentation.count_documents({**query, "doc_type": "sheet"})
        docs_count = await doc_db.documentation.count_documents({**query, "doc_type": "doc"})
        stats[dept_key] = {
            "sheets": sheets_count,
            "docs": docs_count,
            "total": sheets_count + docs_count
        }
    
    return stats

@documentation_router.get("/user-info")
async def get_user_info(request: Request):
    """Get current user's department and access level"""
    user = await get_current_user_from_request(request)
    
    return {
        "user_id": user.get("user_id"),
        "name": user.get("name"),
        "role": user.get("role"),
        "department": get_user_department(user),
        "can_view_all": can_view_all_departments(user)
    }
