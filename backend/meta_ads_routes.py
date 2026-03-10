from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

meta_ads_router = APIRouter(prefix="/meta-ads")
db = None

def init_meta_ads_db(database):
    global db
    db = database

# ============== MODELS ==============

class CustomAttribute(BaseModel):
    attr_id: str
    name: str
    attr_type: str  # 'select', 'text', 'number', 'url'
    options: List[Dict[str, str]] = []  # For select type: [{id, name, color}]
    order: int = 0

class CustomAttributeCreate(BaseModel):
    name: str
    attr_type: str = 'select'
    options: List[Dict[str, str]] = []

# Client Model
class ClientCreate(BaseModel):
    name: str
    area: str = ''
    contact_person: str = ''
    email: str = ''
    phone: str = ''
    drive_url: str = ''
    notes: str = ''

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    area: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    drive_url: Optional[str] = None
    notes: Optional[str] = None

class CampaignCreate(BaseModel):
    client_id: str = ''  # Reference to client
    client_name: str = ''  # For backward compatibility
    area: str = ''
    mode: str = 'Online'
    month: str  # YYYY-MM format
    target_name: str
    service_angle: str = ''

class CampaignUpdate(BaseModel):
    client_name: Optional[str] = None
    area: Optional[str] = None
    mode: Optional[str] = None
    month: Optional[str] = None
    target_name: Optional[str] = None
    service_angle: Optional[str] = None

class AdCreate(BaseModel):
    ad_number: int = 1
    ad_title: str = ''
    ad_type: str = 'Static'
    content_doc_url: str = ''
    content_status: str = 'Not Started'
    creative_platform: str = ''
    creative_drive_url: str = ''
    creative_status: str = 'Yet to Start'
    ad_status: str = 'Draft'
    leads_count: int = 0
    spend: float = 0.0
    notes: str = ''
    custom_attributes: Dict[str, Any] = {}  # Store custom attribute values

class AdUpdate(BaseModel):
    ad_number: Optional[int] = None
    ad_title: Optional[str] = None
    ad_type: Optional[str] = None
    content_doc_url: Optional[str] = None
    content_status: Optional[str] = None
    creative_platform: Optional[str] = None
    creative_drive_url: Optional[str] = None
    creative_status: Optional[str] = None
    ad_status: Optional[str] = None
    leads_count: Optional[int] = None
    spend: Optional[float] = None
    notes: Optional[str] = None
    custom_attributes: Optional[Dict[str, Any]] = None

# ============== AUTH HELPER ==============

async def get_current_user_from_request(request: Request) -> dict:
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

# ============== CLIENT ROUTES ==============

@meta_ads_router.get("/clients")
async def get_clients(request: Request):
    """Get all clients"""
    await get_current_user_from_request(request)
    
    clients = await db.meta_ads_clients.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Get campaign count for each client
    for client in clients:
        campaign_count = await db.meta_ads_campaigns.count_documents({
            "client_id": client["client_id"],
            "is_deleted": {"$ne": True}
        })
        client["campaign_count"] = campaign_count
    
    return clients

@meta_ads_router.post("/clients")
async def create_client(client_data: ClientCreate, request: Request):
    """Create a new client"""
    user = await get_current_user_from_request(request)
    
    client_id = f"client_{uuid.uuid4().hex[:12]}"
    client_doc = {
        "client_id": client_id,
        **client_data.model_dump(),
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await db.meta_ads_clients.insert_one(client_doc)
    
    result = await db.meta_ads_clients.find_one({"client_id": client_id}, {"_id": 0})
    result["campaign_count"] = 0
    return result

@meta_ads_router.get("/clients/{client_id}")
async def get_client(client_id: str, request: Request):
    """Get a single client with its campaigns"""
    await get_current_user_from_request(request)
    
    client = await db.meta_ads_clients.find_one(
        {"client_id": client_id, "is_deleted": {"$ne": True}},
        {"_id": 0}
    )
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get all campaigns for this client
    campaigns = await db.meta_ads_campaigns.find(
        {"client_id": client_id, "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Attach ads to each campaign
    for campaign in campaigns:
        ads = await db.meta_ads.find(
            {"campaign_id": campaign["campaign_id"], "is_deleted": {"$ne": True}},
            {"_id": 0}
        ).sort("ad_number", 1).to_list(100)
        campaign["ads"] = ads
    
    client["campaigns"] = campaigns
    client["campaign_count"] = len(campaigns)
    return client

@meta_ads_router.put("/clients/{client_id}")
async def update_client(client_id: str, update_data: ClientUpdate, request: Request):
    """Update a client"""
    await get_current_user_from_request(request)
    
    client = await db.meta_ads_clients.find_one(
        {"client_id": client_id, "is_deleted": {"$ne": True}}
    )
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.meta_ads_clients.update_one(
        {"client_id": client_id},
        {"$set": update_dict}
    )
    
    result = await db.meta_ads_clients.find_one({"client_id": client_id}, {"_id": 0})
    return result

@meta_ads_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, request: Request):
    """Soft delete a client"""
    await get_current_user_from_request(request)
    
    await db.meta_ads_clients.update_one(
        {"client_id": client_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Client deleted"}

# ============== CAMPAIGN ROUTES ==============

@meta_ads_router.get("/campaigns")
async def get_campaigns(
    request: Request,
    month: Optional[str] = None,
    area: Optional[str] = None,
    mode: Optional[str] = None,
    client_id: Optional[str] = None
):
    """Get all campaigns with optional filters"""
    await get_current_user_from_request(request)
    
    query = {"is_deleted": {"$ne": True}}
    
    if month:
        query["month"] = month
    if area:
        query["area"] = area
    if mode:
        query["mode"] = mode
    if client_id:
        query["client_id"] = client_id
    
    campaigns = await db.meta_ads_campaigns.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Attach ads and client info to each campaign
    for campaign in campaigns:
        ads = await db.meta_ads.find(
            {"campaign_id": campaign["campaign_id"], "is_deleted": {"$ne": True}},
            {"_id": 0}
        ).sort("ad_number", 1).to_list(100)
        campaign["ads"] = ads
        
        # Get client info if client_id exists
        if campaign.get("client_id"):
            client = await db.meta_ads_clients.find_one(
                {"client_id": campaign["client_id"]},
                {"_id": 0, "client_id": 1, "name": 1, "area": 1}
            )
            campaign["client"] = client
    
    return campaigns

@meta_ads_router.post("/campaigns")
async def create_campaign(campaign_data: CampaignCreate, request: Request):
    """Create a new campaign"""
    user = await get_current_user_from_request(request)
    
    campaign_id = f"campaign_{uuid.uuid4().hex[:12]}"
    campaign_doc = {
        "campaign_id": campaign_id,
        **campaign_data.model_dump(),
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await db.meta_ads_campaigns.insert_one(campaign_doc)
    
    result = await db.meta_ads_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    result["ads"] = []
    return result

@meta_ads_router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, request: Request):
    """Get a single campaign with its ads"""
    await get_current_user_from_request(request)
    
    campaign = await db.meta_ads_campaigns.find_one(
        {"campaign_id": campaign_id, "is_deleted": {"$ne": True}},
        {"_id": 0}
    )
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    ads = await db.meta_ads.find(
        {"campaign_id": campaign_id, "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("ad_number", 1).to_list(100)
    
    campaign["ads"] = ads
    return campaign

@meta_ads_router.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, update_data: CampaignUpdate, request: Request):
    """Update a campaign"""
    await get_current_user_from_request(request)
    
    campaign = await db.meta_ads_campaigns.find_one(
        {"campaign_id": campaign_id, "is_deleted": {"$ne": True}}
    )
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.meta_ads_campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": update_dict}
    )
    
    result = await db.meta_ads_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    
    ads = await db.meta_ads.find(
        {"campaign_id": campaign_id, "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("ad_number", 1).to_list(100)
    
    result["ads"] = ads
    return result

@meta_ads_router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, request: Request):
    """Soft delete a campaign and all its ads"""
    await get_current_user_from_request(request)
    
    await db.meta_ads_campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    # Also soft delete all ads in this campaign
    await db.meta_ads.update_many(
        {"campaign_id": campaign_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Campaign deleted"}

# ============== AD ROUTES ==============

@meta_ads_router.post("/campaigns/{campaign_id}/ads")
async def create_ad(campaign_id: str, ad_data: AdCreate, request: Request):
    """Create a new ad in a campaign"""
    user = await get_current_user_from_request(request)
    
    # Verify campaign exists
    campaign = await db.meta_ads_campaigns.find_one(
        {"campaign_id": campaign_id, "is_deleted": {"$ne": True}}
    )
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get next ad number
    existing_ads = await db.meta_ads.count_documents({"campaign_id": campaign_id, "is_deleted": {"$ne": True}})
    
    ad_id = f"ad_{uuid.uuid4().hex[:12]}"
    ad_doc = {
        "ad_id": ad_id,
        "campaign_id": campaign_id,
        **ad_data.model_dump(),
        "ad_number": existing_ads + 1,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await db.meta_ads.insert_one(ad_doc)
    
    return await db.meta_ads.find_one({"ad_id": ad_id}, {"_id": 0})

@meta_ads_router.put("/campaigns/{campaign_id}/ads/{ad_id}")
async def update_ad(campaign_id: str, ad_id: str, update_data: Dict[str, Any], request: Request):
    """Update an ad"""
    await get_current_user_from_request(request)
    
    ad = await db.meta_ads.find_one(
        {"ad_id": ad_id, "campaign_id": campaign_id, "is_deleted": {"$ne": True}}
    )
    
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.meta_ads.update_one(
        {"ad_id": ad_id},
        {"$set": update_data}
    )
    
    return await db.meta_ads.find_one({"ad_id": ad_id}, {"_id": 0})

@meta_ads_router.delete("/campaigns/{campaign_id}/ads/{ad_id}")
async def delete_ad(campaign_id: str, ad_id: str, request: Request):
    """Soft delete an ad"""
    await get_current_user_from_request(request)
    
    await db.meta_ads.update_one(
        {"ad_id": ad_id, "campaign_id": campaign_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Ad deleted"}

# ============== CUSTOM ATTRIBUTES ROUTES ==============

@meta_ads_router.get("/custom-attributes")
async def get_custom_attributes(request: Request):
    """Get all custom attributes"""
    await get_current_user_from_request(request)
    
    attrs = await db.meta_ads_custom_attributes.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return attrs

@meta_ads_router.post("/custom-attributes")
async def create_custom_attribute(attr_data: CustomAttributeCreate, request: Request):
    """Create a new custom attribute"""
    user = await get_current_user_from_request(request)
    
    # Get next order number
    existing_count = await db.meta_ads_custom_attributes.count_documents({"is_deleted": {"$ne": True}})
    
    attr_id = f"attr_{uuid.uuid4().hex[:12]}"
    
    # Generate default options for select type
    options = attr_data.options
    if attr_data.attr_type == 'select' and not options:
        options = [
            {"id": f"opt_{uuid.uuid4().hex[:8]}", "name": "Not Started", "color": "#71717a"},
            {"id": f"opt_{uuid.uuid4().hex[:8]}", "name": "In Progress", "color": "#3b82f6"},
            {"id": f"opt_{uuid.uuid4().hex[:8]}", "name": "Completed", "color": "#22c55e"}
        ]
    
    attr_doc = {
        "attr_id": attr_id,
        "name": attr_data.name,
        "attr_type": attr_data.attr_type,
        "options": options,
        "order": existing_count,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "is_deleted": False
    }
    
    await db.meta_ads_custom_attributes.insert_one(attr_doc)
    
    return await db.meta_ads_custom_attributes.find_one({"attr_id": attr_id}, {"_id": 0})

@meta_ads_router.put("/custom-attributes/{attr_id}")
async def update_custom_attribute(attr_id: str, update_data: Dict[str, Any], request: Request):
    """Update a custom attribute"""
    await get_current_user_from_request(request)
    
    attr = await db.meta_ads_custom_attributes.find_one(
        {"attr_id": attr_id, "is_deleted": {"$ne": True}}
    )
    
    if not attr:
        raise HTTPException(status_code=404, detail="Custom attribute not found")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.meta_ads_custom_attributes.update_one(
        {"attr_id": attr_id},
        {"$set": update_data}
    )
    
    return await db.meta_ads_custom_attributes.find_one({"attr_id": attr_id}, {"_id": 0})

@meta_ads_router.post("/custom-attributes/{attr_id}/options")
async def add_attribute_option(attr_id: str, option_data: Dict[str, str], request: Request):
    """Add an option to a select-type custom attribute"""
    await get_current_user_from_request(request)
    
    attr = await db.meta_ads_custom_attributes.find_one(
        {"attr_id": attr_id, "is_deleted": {"$ne": True}}
    )
    
    if not attr:
        raise HTTPException(status_code=404, detail="Custom attribute not found")
    
    if attr["attr_type"] != "select":
        raise HTTPException(status_code=400, detail="Can only add options to select-type attributes")
    
    new_option = {
        "id": f"opt_{uuid.uuid4().hex[:8]}",
        "name": option_data.get("name", "New Option"),
        "color": option_data.get("color", "#71717a")
    }
    
    await db.meta_ads_custom_attributes.update_one(
        {"attr_id": attr_id},
        {"$push": {"options": new_option}}
    )
    
    return await db.meta_ads_custom_attributes.find_one({"attr_id": attr_id}, {"_id": 0})

@meta_ads_router.delete("/custom-attributes/{attr_id}")
async def delete_custom_attribute(attr_id: str, request: Request):
    """Soft delete a custom attribute"""
    await get_current_user_from_request(request)
    
    await db.meta_ads_custom_attributes.update_one(
        {"attr_id": attr_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Custom attribute deleted"}

# ============== STATS ROUTES ==============

@meta_ads_router.get("/stats")
async def get_meta_ads_stats(request: Request, month: Optional[str] = None):
    """Get overall stats for Meta Ads"""
    await get_current_user_from_request(request)
    
    campaign_query = {"is_deleted": {"$ne": True}}
    if month:
        campaign_query["month"] = month
    
    campaigns = await db.meta_ads_campaigns.find(campaign_query, {"_id": 0}).to_list(1000)
    campaign_ids = [c["campaign_id"] for c in campaigns]
    
    ads = await db.meta_ads.find(
        {"campaign_id": {"$in": campaign_ids}, "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).to_list(10000)
    
    total_leads = sum(ad.get("leads_count", 0) for ad in ads)
    total_spend = sum(ad.get("spend", 0) for ad in ads)
    total_ads = len(ads)
    
    # Group by status
    status_counts = {}
    for ad in ads:
        status = ad.get("ad_status", "Draft")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Group by creative status
    creative_status_counts = {}
    for ad in ads:
        status = ad.get("creative_status", "Yet to Start")
        creative_status_counts[status] = creative_status_counts.get(status, 0) + 1
    
    return {
        "total_campaigns": len(campaigns),
        "total_ads": total_ads,
        "total_leads": total_leads,
        "total_spend": total_spend,
        "cost_per_lead": round(total_spend / total_leads, 2) if total_leads > 0 else 0,
        "by_ad_status": status_counts,
        "by_creative_status": creative_status_counts
    }

@meta_ads_router.get("/stats/monthly")
async def get_monthly_stats(request: Request):
    """Get month-on-month stats"""
    await get_current_user_from_request(request)
    
    campaigns = await db.meta_ads_campaigns.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0}
    ).to_list(1000)
    
    # Group by month
    monthly_data = {}
    for campaign in campaigns:
        month = campaign.get("month", "Unknown")
        if month not in monthly_data:
            monthly_data[month] = {
                "month": month,
                "campaigns": 0,
                "ads": 0,
                "leads": 0,
                "spend": 0
            }
        monthly_data[month]["campaigns"] += 1
    
    # Get ads for each month
    for month in monthly_data:
        campaign_ids = [c["campaign_id"] for c in campaigns if c.get("month") == month]
        ads = await db.meta_ads.find(
            {"campaign_id": {"$in": campaign_ids}, "is_deleted": {"$ne": True}},
            {"_id": 0}
        ).to_list(10000)
        
        monthly_data[month]["ads"] = len(ads)
        monthly_data[month]["leads"] = sum(ad.get("leads_count", 0) for ad in ads)
        monthly_data[month]["spend"] = sum(ad.get("spend", 0) for ad in ads)
    
    # Sort by month descending
    sorted_months = sorted(monthly_data.values(), key=lambda x: x["month"], reverse=True)
    
    return sorted_months
