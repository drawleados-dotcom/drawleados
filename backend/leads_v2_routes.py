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
    # Basic Details
    name: str
    email: str = ''
    phone: str = ''
    location: str = ''
    website: str = ''
    social_media: str = ''
    # Lead Details
    source: str = ''
    lead_owner: str = ''  # user_id of team member
    service: str = ''
    priority: str = 'Medium'  # High, Medium, Low
    lead_type: str = ''  # Inbound, Outbound
    date_of_lead: str = ''  # Auto but editable
    industry: str = ''
    estimation: float = 0  # Amount
    quotation_link: str = ''  # URL
    proposal_link: str = ''  # URL
    notes: str = ''
    stage_id: str = ''
    custom_fields: Dict[str, Any] = {}

class LeadUpdate(BaseModel):
    # Basic Details
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    social_media: Optional[str] = None
    # Lead Details
    source: Optional[str] = None
    lead_owner: Optional[str] = None
    service: Optional[str] = None
    priority: Optional[str] = None
    lead_type: Optional[str] = None
    date_of_lead: Optional[str] = None
    industry: Optional[str] = None
    estimation: Optional[float] = None
    quotation_link: Optional[str] = None
    proposal_link: Optional[str] = None
    notes: Optional[str] = None
    stage_id: Optional[str] = None
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
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Prospect", "color": "#6366f1", "order": 0},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Lead", "color": "#3b82f6", "order": 1},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Qualified", "color": "#8b5cf6", "order": 2},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Proposal", "color": "#f59e0b", "order": 3},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Negotiation", "color": "#ec4899", "order": 4},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Followup", "color": "#14b8a6", "order": 5},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Payment Stage", "color": "#f97316", "order": 6},
            {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Deal Closed", "color": "#22c55e", "order": 7},
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
    search: Optional[str] = None,
    lead_owner: Optional[str] = None
):
    """Get all leads with optional filters"""
    await get_current_user_from_request(request)
    
    query = {"is_deleted": {"$ne": True}}
    
    if stage_id:
        query["stage_id"] = stage_id
    
    if lead_owner:
        query["lead_owner"] = lead_owner
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    
    leads = await db.leads_v2.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    # Enrich leads with lead_owner_name
    user_ids = list(set([lead.get("lead_owner") for lead in leads if lead.get("lead_owner")]))
    users_map = {}
    if user_ids:
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(100)
        users_map = {u["user_id"]: u["name"] for u in users}
    
    for lead in leads:
        lead["lead_owner_name"] = users_map.get(lead.get("lead_owner"), "")
    
    return leads

@leads_v2_router.post("/leads")
async def create_lead(lead_data: LeadCreate, request: Request):
    """Create a new lead - auto-assigns current user as lead_owner if not specified"""
    user = await get_current_user_from_request(request)
    
    lead_id = f"lead_{uuid.uuid4().hex[:12]}"
    lead_dict = lead_data.model_dump()
    
    # Auto-assign lead_owner to current user if not specified
    if not lead_dict.get("lead_owner"):
        lead_dict["lead_owner"] = user["user_id"]
    
    lead_doc = {
        "lead_id": lead_id,
        **lead_dict,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await db.leads_v2.insert_one(lead_doc)
    
    # Return lead with lead_owner_name
    lead = await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})
    if lead.get("lead_owner"):
        owner = await db.users.find_one({"user_id": lead["lead_owner"]}, {"_id": 0, "name": 1})
        lead["lead_owner_name"] = owner.get("name", "") if owner else ""
    
    return lead

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


# ============== SERVICES ROUTES ==============

@leads_v2_router.get("/services")
async def get_services(request: Request):
    """Get all services for dropdown"""
    await get_current_user_from_request(request)
    services = await db.lead_services.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("name", 1).to_list(100)
    
    # Create default services if none exist
    if not services:
        default_services = [
            {"service_id": f"svc_{uuid.uuid4().hex[:8]}", "name": "Website Development"},
            {"service_id": f"svc_{uuid.uuid4().hex[:8]}", "name": "SEO"},
            {"service_id": f"svc_{uuid.uuid4().hex[:8]}", "name": "Social Media Marketing"},
            {"service_id": f"svc_{uuid.uuid4().hex[:8]}", "name": "Meta Ads"},
            {"service_id": f"svc_{uuid.uuid4().hex[:8]}", "name": "Google Ads"},
            {"service_id": f"svc_{uuid.uuid4().hex[:8]}", "name": "Content Marketing"},
            {"service_id": f"svc_{uuid.uuid4().hex[:8]}", "name": "Branding"},
        ]
        for svc in default_services:
            svc["created_at"] = datetime.now(timezone.utc)
            svc["is_deleted"] = False
            await db.lead_services.insert_one(svc)
        services = default_services
    
    return services

@leads_v2_router.post("/services")
async def create_service(request: Request):
    """Create a new service"""
    user = await get_current_user_from_request(request)
    body = await request.json()
    name = body.get("name", "").strip()
    
    if not name:
        raise HTTPException(status_code=400, detail="Service name is required")
    
    # Check if service already exists
    existing = await db.lead_services.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}, "is_deleted": {"$ne": True}})
    if existing:
        raise HTTPException(status_code=400, detail="Service already exists")
    
    service_id = f"svc_{uuid.uuid4().hex[:8]}"
    service_doc = {
        "service_id": service_id,
        "name": name,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await db.lead_services.insert_one(service_doc)
    return await db.lead_services.find_one({"service_id": service_id}, {"_id": 0})

# ============== INDUSTRIES ROUTES ==============

@leads_v2_router.get("/industries")
async def get_industries(request: Request):
    """Get all industries for dropdown"""
    await get_current_user_from_request(request)
    industries = await db.lead_industries.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("name", 1).to_list(100)
    
    # Create default industries if none exist
    if not industries:
        default_industries = [
            {"industry_id": f"ind_{uuid.uuid4().hex[:8]}", "name": "Healthcare"},
            {"industry_id": f"ind_{uuid.uuid4().hex[:8]}", "name": "Construction"},
            {"industry_id": f"ind_{uuid.uuid4().hex[:8]}", "name": "Real Estate"},
            {"industry_id": f"ind_{uuid.uuid4().hex[:8]}", "name": "Education"},
            {"industry_id": f"ind_{uuid.uuid4().hex[:8]}", "name": "E-commerce"},
            {"industry_id": f"ind_{uuid.uuid4().hex[:8]}", "name": "Finance"},
            {"industry_id": f"ind_{uuid.uuid4().hex[:8]}", "name": "Technology"},
            {"industry_id": f"ind_{uuid.uuid4().hex[:8]}", "name": "Manufacturing"},
            {"industry_id": f"ind_{uuid.uuid4().hex[:8]}", "name": "Hospitality"},
            {"industry_id": f"ind_{uuid.uuid4().hex[:8]}", "name": "Retail"},
        ]
        for ind in default_industries:
            ind["created_at"] = datetime.now(timezone.utc)
            ind["is_deleted"] = False
            await db.lead_industries.insert_one(ind)
        industries = default_industries
    
    return industries

@leads_v2_router.post("/industries")
async def create_industry(request: Request):
    """Create a new industry"""
    user = await get_current_user_from_request(request)
    body = await request.json()
    name = body.get("name", "").strip()
    
    if not name:
        raise HTTPException(status_code=400, detail="Industry name is required")
    
    # Check if industry already exists
    existing = await db.lead_industries.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}, "is_deleted": {"$ne": True}})
    if existing:
        raise HTTPException(status_code=400, detail="Industry already exists")
    
    industry_id = f"ind_{uuid.uuid4().hex[:8]}"
    industry_doc = {
        "industry_id": industry_id,
        "name": name,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await db.lead_industries.insert_one(industry_doc)
    return await db.lead_industries.find_one({"industry_id": industry_id}, {"_id": 0})

# ============== TEAM MEMBERS ROUTES ==============

@leads_v2_router.get("/team-members")
async def get_team_members(request: Request):
    """Get all team members for Lead Owner dropdown"""
    await get_current_user_from_request(request)
    
    members = await db.users.find(
        {"is_active": True},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1}
    ).to_list(100)
    
    return members

# ============== FOLLOW-UP ROUTES ==============

@leads_v2_router.post("/leads/{lead_id}/followups")
async def add_followup(lead_id: str, request: Request):
    """Add a follow-up to a lead"""
    user = await get_current_user_from_request(request)
    body = await request.json()
    
    remarks = body.get("remarks", "").strip()
    if not remarks:
        raise HTTPException(status_code=400, detail="Remarks are required")
    
    followup = {
        "followup_id": f"fu_{uuid.uuid4().hex[:8]}",
        "remarks": remarks,
        "date": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown")
    }
    
    await db.leads_v2.update_one(
        {"lead_id": lead_id},
        {
            "$push": {"followups": followup},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})

@leads_v2_router.get("/leads/{lead_id}/followups")
async def get_followups(lead_id: str, request: Request):
    """Get all follow-ups for a lead"""
    await get_current_user_from_request(request)
    
    lead = await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0, "followups": 1})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return lead.get("followups", [])


# ============== IMPORT/EXPORT ROUTES ==============

@leads_v2_router.get("/export")
async def export_leads(request: Request):
    """Export all leads as CSV data"""
    await get_current_user_from_request(request)
    
    leads = await db.leads_v2.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0}
    ).to_list(10000)
    
    # Get stages for mapping
    stages = await db.lead_stages.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0}
    ).to_list(100)
    stage_map = {s["stage_id"]: s["name"] for s in stages}
    
    # Get users for lead_owner mapping
    user_ids = list(set([lead.get("lead_owner") for lead in leads if lead.get("lead_owner")]))
    users_map = {}
    if user_ids:
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(100)
        users_map = {u["user_id"]: u["name"] for u in users}
    
    # Format leads for export
    export_data = []
    for lead in leads:
        export_data.append({
            "name": lead.get("name", ""),
            "email": lead.get("email", ""),
            "phone": lead.get("phone", ""),
            "location": lead.get("location", ""),
            "website": lead.get("website", ""),
            "social_media": lead.get("social_media", ""),
            "source": lead.get("source", ""),
            "lead_owner": users_map.get(lead.get("lead_owner"), ""),
            "service": lead.get("service", ""),
            "priority": lead.get("priority", "Medium"),
            "lead_type": lead.get("lead_type", ""),
            "date_of_lead": lead.get("date_of_lead", ""),
            "industry": lead.get("industry", ""),
            "estimation": lead.get("estimation", ""),
            "quotation_link": lead.get("quotation_link", ""),
            "proposal_link": lead.get("proposal_link", ""),
            "notes": lead.get("notes", ""),
            "stage": stage_map.get(lead.get("stage_id"), ""),
            "created_at": lead.get("created_at", "").isoformat() if lead.get("created_at") else "",
        })
    
    return export_data

@leads_v2_router.get("/template")
async def get_import_template(request: Request):
    """Get CSV template fields for import"""
    await get_current_user_from_request(request)
    
    # Get stages for dropdown options
    stages = await db.lead_stages.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0, "name": 1}
    ).sort("order", 1).to_list(100)
    stage_names = [s["name"] for s in stages]
    
    # Get services
    services = await db.lead_services.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0, "name": 1}
    ).to_list(100)
    service_names = [s["name"] for s in services]
    
    # Get industries
    industries = await db.lead_industries.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0, "name": 1}
    ).to_list(100)
    industry_names = [i["name"] for i in industries]
    
    # Get team members
    users = await db.users.find(
        {"is_active": True},
        {"_id": 0, "name": 1}
    ).to_list(100)
    user_names = [u["name"] for u in users]
    
    template = {
        "columns": [
            {"field": "name", "label": "Name", "required": True, "type": "text"},
            {"field": "email", "label": "Email", "required": False, "type": "email"},
            {"field": "phone", "label": "Phone", "required": False, "type": "text"},
            {"field": "location", "label": "Location", "required": False, "type": "text"},
            {"field": "website", "label": "Website", "required": False, "type": "url"},
            {"field": "social_media", "label": "Social Media", "required": False, "type": "text"},
            {"field": "source", "label": "Source", "required": False, "type": "text"},
            {"field": "lead_owner", "label": "Lead Owner", "required": False, "type": "dropdown", "options": user_names},
            {"field": "service", "label": "Service", "required": False, "type": "dropdown", "options": service_names},
            {"field": "priority", "label": "Priority", "required": False, "type": "dropdown", "options": ["High", "Medium", "Low"]},
            {"field": "lead_type", "label": "Lead Type", "required": False, "type": "dropdown", "options": ["Inbound", "Outbound"]},
            {"field": "date_of_lead", "label": "Date of Lead", "required": False, "type": "date"},
            {"field": "industry", "label": "Industry", "required": False, "type": "dropdown", "options": industry_names},
            {"field": "estimation", "label": "Estimation (Amount)", "required": False, "type": "number"},
            {"field": "quotation_link", "label": "Quotation Link", "required": False, "type": "url"},
            {"field": "proposal_link", "label": "Proposal Link", "required": False, "type": "url"},
            {"field": "notes", "label": "Notes", "required": False, "type": "textarea"},
            {"field": "stage", "label": "Stage", "required": False, "type": "dropdown", "options": stage_names},
        ],
        "sample_row": {
            "name": "John Doe",
            "email": "john@example.com",
            "phone": "+91 98765 43210",
            "location": "Mumbai",
            "website": "https://example.com",
            "social_media": "@johndoe",
            "source": "Website",
            "lead_owner": user_names[0] if user_names else "",
            "service": service_names[0] if service_names else "",
            "priority": "Medium",
            "lead_type": "Inbound",
            "date_of_lead": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "industry": industry_names[0] if industry_names else "",
            "estimation": "50000",
            "quotation_link": "",
            "proposal_link": "",
            "notes": "Sample lead",
            "stage": stage_names[0] if stage_names else "",
        }
    }
    
    return template

@leads_v2_router.post("/import")
async def import_leads(request: Request):
    """Import leads from CSV data"""
    user = await get_current_user_from_request(request)
    body = await request.json()
    
    leads_data = body.get("leads", [])
    if not leads_data:
        raise HTTPException(status_code=400, detail="No leads data provided")
    
    # Get stages for mapping
    stages = await db.lead_stages.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0}
    ).to_list(100)
    stage_map = {s["name"].lower(): s["stage_id"] for s in stages}
    default_stage = stages[0]["stage_id"] if stages else None
    
    # Get users for lead_owner mapping
    users = await db.users.find(
        {"is_active": True},
        {"_id": 0, "user_id": 1, "name": 1}
    ).to_list(100)
    users_map = {u["name"].lower(): u["user_id"] for u in users}
    
    imported_count = 0
    errors = []
    
    for idx, lead_data in enumerate(leads_data):
        try:
            # Skip empty rows
            if not lead_data.get("name"):
                continue
            
            # Map stage name to stage_id
            stage_name = lead_data.get("stage", "").lower().strip()
            stage_id = stage_map.get(stage_name, default_stage)
            
            # Map lead_owner name to user_id
            owner_name = lead_data.get("lead_owner", "").lower().strip()
            lead_owner = users_map.get(owner_name, user["user_id"])
            
            lead_id = f"lead_{uuid.uuid4().hex[:12]}"
            lead_doc = {
                "lead_id": lead_id,
                "name": lead_data.get("name", ""),
                "email": lead_data.get("email", ""),
                "phone": lead_data.get("phone", ""),
                "location": lead_data.get("location", ""),
                "website": lead_data.get("website", ""),
                "social_media": lead_data.get("social_media", ""),
                "source": lead_data.get("source", ""),
                "lead_owner": lead_owner,
                "service": lead_data.get("service", ""),
                "priority": lead_data.get("priority", "Medium"),
                "lead_type": lead_data.get("lead_type", ""),
                "date_of_lead": lead_data.get("date_of_lead", ""),
                "industry": lead_data.get("industry", ""),
                "estimation": float(lead_data.get("estimation", 0)) if lead_data.get("estimation") else 0,
                "quotation_link": lead_data.get("quotation_link", ""),
                "proposal_link": lead_data.get("proposal_link", ""),
                "notes": lead_data.get("notes", ""),
                "stage_id": stage_id,
                "custom_fields": {},
                "followups": [],
                "created_by": user["user_id"],
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "is_deleted": False,
            }
            
            await db.leads_v2.insert_one(lead_doc)
            imported_count += 1
            
        except Exception as e:
            errors.append(f"Row {idx + 1}: {str(e)}")
    
    return {
        "imported": imported_count,
        "total": len(leads_data),
        "errors": errors
    }
