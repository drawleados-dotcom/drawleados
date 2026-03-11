from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import httpx

leads_v2_router = APIRouter(prefix="/leads-v2")
db = None

def init_leads_v2_db(database):
    global db
    db = database

# ============== MODELS ==============

class StageReorderItem(BaseModel):
    stage_id: str
    order: int

class StageReorderRequest(BaseModel):
    stages: List[StageReorderItem]

class StageCreate(BaseModel):
    name: str
    color: str = '#71717a'
    order: int = 0

class StageUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None

class CustomFieldCreate(BaseModel):
    name: str
    field_type: str  # 'text', 'number', 'select', 'date', 'email', 'phone', 'url', 'textarea'
    options: List[str] = []  # For select type
    required: bool = False
    order: int = 0

class GoogleSheetConfig(BaseModel):
    sheet_id: str
    sheet_name: str = 'Sheet1'
    header_row: int = 1
    column_mapping: Dict[str, str] = {}  # {field_name: column_letter}
    auto_sync: bool = True
    sync_interval: int = 5  # minutes

class LeadCreate(BaseModel):
    name: str
    phone: str = ''
    email: str = ''
    stage_id: str = ''
    source: str = ''
    service: str = ''
    notes: str = ''
    custom_fields: Dict[str, Any] = {}

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    stage_id: Optional[str] = None
    source: Optional[str] = None
    service: Optional[str] = None
    notes: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None

# ============== AUTH HELPER ==============

async def get_current_user_from_request(request: Request) -> dict:
    session_token = None
    if "session_token" in request.cookies:
        session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return user_doc

# ============== STAGES ROUTES ==============

@leads_v2_router.get("/stages")
async def get_stages(request: Request):
    """Get all lead stages"""
    await get_current_user_from_request(request)
    stages = await db.lead_stages.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # Create default stages if none exist
    if not stages:
        default_stages = [
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "New Lead", "color": "#3b82f6", "order": 0},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Contacted", "color": "#8b5cf6", "order": 1},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Proposal", "color": "#f59e0b", "order": 2},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "RNR", "color": "#ef4444", "order": 3},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Follow-up", "color": "#10b981", "order": 4},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Converted", "color": "#22c55e", "order": 5},
        ]
        for stage in default_stages:
            stage["created_at"] = datetime.now(timezone.utc)
            stage["is_deleted"] = False
            await db.lead_stages.insert_one(stage)
        stages = default_stages
    
    return stages

@leads_v2_router.post("/stages")
async def create_stage(stage_data: StageCreate, request: Request):
    """Create a new stage"""
    user = await get_current_user_from_request(request)
    
    # Get next order
    max_order = await db.lead_stages.find_one(
        {"is_deleted": {"$ne": True}},
        sort=[("order", -1)]
    )
    next_order = (max_order.get("order", -1) + 1) if max_order else 0
    
    stage_id = f"stage_{uuid.uuid4().hex[:8]}"
    stage_doc = {
        "stage_id": stage_id,
        "name": stage_data.name,
        "color": stage_data.color,
        "order": stage_data.order if stage_data.order > 0 else next_order,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await db.lead_stages.insert_one(stage_doc)
    return await db.lead_stages.find_one({"stage_id": stage_id}, {"_id": 0})

# IMPORTANT: Static routes must come BEFORE dynamic routes with path parameters
@leads_v2_router.put("/stages/reorder")
async def reorder_stages(reorder_data: StageReorderRequest, request: Request):
    """Reorder stages"""
    import logging
    logging.info(f"Reorder stages called with: {reorder_data}")
    await get_current_user_from_request(request)
    
    for item in reorder_data.stages:
        logging.info(f"Updating stage {item.stage_id} to order {item.order}")
        result = await db.lead_stages.update_one(
            {"stage_id": item.stage_id},
            {"$set": {"order": item.order}}
        )
        logging.info(f"Update result: modified={result.modified_count}")
    
    return {"message": "Stages reordered"}

@leads_v2_router.put("/stages/{stage_id}")
async def update_stage(stage_id: str, update_data: StageUpdate, request: Request):
    """Update a stage"""
    await get_current_user_from_request(request)
    
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.lead_stages.update_one(
        {"stage_id": stage_id},
        {"$set": update_dict}
    )
    
    return await db.lead_stages.find_one({"stage_id": stage_id}, {"_id": 0})

@leads_v2_router.delete("/stages/{stage_id}")
async def delete_stage(stage_id: str, request: Request):
    """Delete a stage"""
    await get_current_user_from_request(request)
    
    # Check if any leads are using this stage
    lead_count = await db.leads_v2.count_documents({"stage_id": stage_id, "is_deleted": {"$ne": True}})
    if lead_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete stage with {lead_count} leads. Move leads first.")
    
    await db.lead_stages.update_one(
        {"stage_id": stage_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Stage deleted"}

# ============== CUSTOM FIELDS ROUTES ==============

@leads_v2_router.get("/custom-fields")
async def get_custom_fields(request: Request):
    """Get all custom fields"""
    await get_current_user_from_request(request)
    fields = await db.lead_custom_fields.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    return fields

@leads_v2_router.post("/custom-fields")
async def create_custom_field(field_data: CustomFieldCreate, request: Request):
    """Create a new custom field"""
    user = await get_current_user_from_request(request)
    
    max_order = await db.lead_custom_fields.find_one(
        {"is_deleted": {"$ne": True}},
        sort=[("order", -1)]
    )
    next_order = (max_order.get("order", -1) + 1) if max_order else 0
    
    field_id = f"field_{uuid.uuid4().hex[:8]}"
    field_doc = {
        "field_id": field_id,
        **field_data.model_dump(),
        "order": field_data.order if field_data.order > 0 else next_order,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await db.lead_custom_fields.insert_one(field_doc)
    return await db.lead_custom_fields.find_one({"field_id": field_id}, {"_id": 0})

@leads_v2_router.put("/custom-fields/{field_id}")
async def update_custom_field(field_id: str, update_data: Dict[str, Any], request: Request):
    """Update a custom field"""
    await get_current_user_from_request(request)
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.lead_custom_fields.update_one(
        {"field_id": field_id},
        {"$set": update_data}
    )
    
    return await db.lead_custom_fields.find_one({"field_id": field_id}, {"_id": 0})

@leads_v2_router.delete("/custom-fields/{field_id}")
async def delete_custom_field(field_id: str, request: Request):
    """Delete a custom field"""
    await get_current_user_from_request(request)
    
    await db.lead_custom_fields.update_one(
        {"field_id": field_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Custom field deleted"}

# ============== LEADS ROUTES ==============

@leads_v2_router.get("/leads")
async def get_leads(
    request: Request,
    stage_id: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all leads"""
    await get_current_user_from_request(request)
    
    query = {"is_deleted": {"$ne": True}}
    
    if stage_id:
        query["stage_id"] = stage_id
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    
    leads = await db.leads_v2.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    return leads

@leads_v2_router.post("/leads")
async def create_lead(lead_data: LeadCreate, request: Request):
    """Create a new lead"""
    user = await get_current_user_from_request(request)
    
    lead_id = f"lead_{uuid.uuid4().hex[:12]}"
    lead_doc = {
        "lead_id": lead_id,
        **lead_data.model_dump(),
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await db.leads_v2.insert_one(lead_doc)
    return await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})

@leads_v2_router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, update_data: Dict[str, Any], request: Request):
    """Update a lead"""
    await get_current_user_from_request(request)
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.leads_v2.update_one(
        {"lead_id": lead_id},
        {"$set": update_data}
    )
    
    return await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})

@leads_v2_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, request: Request):
    """Delete a lead"""
    await get_current_user_from_request(request)
    
    await db.leads_v2.update_one(
        {"lead_id": lead_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Lead deleted"}

@leads_v2_router.put("/leads/{lead_id}/stage")
async def update_lead_stage(lead_id: str, stage_data: Dict[str, str], request: Request):
    """Update lead stage (for drag-drop)"""
    await get_current_user_from_request(request)
    
    await db.leads_v2.update_one(
        {"lead_id": lead_id},
        {"$set": {"stage_id": stage_data["stage_id"], "updated_at": datetime.now(timezone.utc)}}
    )
    
    return await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})

# ============== GOOGLE SHEETS ROUTES ==============

@leads_v2_router.get("/google-sheets/config")
async def get_sheets_config(request: Request):
    """Get Google Sheets configuration"""
    await get_current_user_from_request(request)
    
    config = await db.leads_google_sheets_config.find_one(
        {"is_active": True},
        {"_id": 0}
    )
    
    return config or {}

@leads_v2_router.post("/google-sheets/config")
async def save_sheets_config(config_data: GoogleSheetConfig, request: Request):
    """Save Google Sheets configuration"""
    user = await get_current_user_from_request(request)
    
    # Deactivate existing config
    await db.leads_google_sheets_config.update_many(
        {},
        {"$set": {"is_active": False}}
    )
    
    config_id = f"config_{uuid.uuid4().hex[:8]}"
    config_doc = {
        "config_id": config_id,
        **config_data.model_dump(),
        "is_active": True,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "last_sync": None
    }
    
    await db.leads_google_sheets_config.insert_one(config_doc)
    return await db.leads_google_sheets_config.find_one({"config_id": config_id}, {"_id": 0})

@leads_v2_router.post("/google-sheets/sync")
async def sync_google_sheets(request: Request, background_tasks: BackgroundTasks):
    """Trigger manual sync from Google Sheets"""
    await get_current_user_from_request(request)
    
    config = await db.leads_google_sheets_config.find_one({"is_active": True})
    if not config:
        raise HTTPException(status_code=400, detail="No Google Sheets configuration found")
    
    # For now, return a message that sync would happen
    # In production, this would trigger actual Google Sheets API call
    return {
        "message": "Sync initiated",
        "sheet_id": config.get("sheet_id"),
        "note": "Google Sheets API integration requires OAuth setup. Connect your Google account to enable auto-sync."
    }

@leads_v2_router.delete("/google-sheets/config")
async def disconnect_sheets(request: Request):
    """Disconnect Google Sheets"""
    await get_current_user_from_request(request)
    
    await db.leads_google_sheets_config.update_many(
        {},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Google Sheets disconnected"}

# ============== STATS ROUTES ==============

@leads_v2_router.get("/stats")
async def get_lead_stats(request: Request):
    """Get lead statistics"""
    await get_current_user_from_request(request)
    
    stages = await db.lead_stages.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    total_leads = await db.leads_v2.count_documents({"is_deleted": {"$ne": True}})
    
    stats = {
        "total": total_leads,
        "by_stage": {}
    }
    
    for stage in stages:
        count = await db.leads_v2.count_documents({
            "stage_id": stage["stage_id"],
            "is_deleted": {"$ne": True}
        })
        stats["by_stage"][stage["stage_id"]] = {
            "name": stage["name"],
            "color": stage["color"],
            "count": count
        }
    
    return stats
