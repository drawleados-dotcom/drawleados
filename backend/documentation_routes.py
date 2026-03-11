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

# Pydantic models
class DocumentCreate(BaseModel):
    name: str
    link: str
    doc_type: str  # 'sheet' or 'doc'
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

# ============== DOCUMENTS ROUTES ==============

@documentation_router.get("/documents")
async def get_documents(
    request: Request,
    doc_type: Optional[str] = None
):
    """Get all documents, optionally filtered by type"""
    await get_current_user_from_request(request)
    
    query = {"is_deleted": {"$ne": True}}
    if doc_type:
        query["doc_type"] = doc_type
    
    documents = await doc_db.documentation.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return documents

@documentation_router.post("/documents")
async def create_document(doc_data: DocumentCreate, request: Request):
    """Create a new document entry"""
    user = await get_current_user_from_request(request)
    
    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    doc = {
        "doc_id": doc_id,
        "name": doc_data.name,
        "link": doc_data.link,
        "doc_type": doc_data.doc_type,
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
    """Get document statistics"""
    await get_current_user_from_request(request)
    
    sheets_count = await doc_db.documentation.count_documents({"doc_type": "sheet", "is_deleted": {"$ne": True}})
    docs_count = await doc_db.documentation.count_documents({"doc_type": "doc", "is_deleted": {"$ne": True}})
    
    return {
        "sheets": sheets_count,
        "docs": docs_count,
        "total": sheets_count + docs_count
    }
