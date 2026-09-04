from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import httpx
import asyncio

from access import is_admin

# Import notification service
from notification_service import (
    notify_lead_assigned, notify_lead_closed, notify_lead_remark,
    get_user_email_by_id
)

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
    pipeline: str = 'pre_sales'  # 'pre_sales' or 'sales'

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
    company_name: str = ''
    what_do_you_do: str = ''
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
    pipeline: str = 'pre_sales'  # 'pre_sales' or 'sales'

    # The Basic Details tab can be submitted before Lead Details is ever
    # touched, leaving the Estimation input at its default empty string —
    # coerce that (and None) to 0 instead of failing validation.
    @field_validator('estimation', mode='before')
    @classmethod
    def _coerce_estimation(cls, v):
        if v is None or v == '':
            return 0
        return v

class LeadUpdate(BaseModel):
    # Basic Details
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    social_media: Optional[str] = None
    company_name: Optional[str] = None
    what_do_you_do: Optional[str] = None
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

def _pipeline_match(pipeline: str) -> Dict[str, Any]:
    """Mongo filter matching documents in `pipeline`. Docs created before this
    field existed have no `pipeline` key at all — they're treated as
    'pre_sales' since that was the only pipeline before the Sales split.
    'all' matches every lead regardless of pipeline (used by the Overview
    tab, which spans both)."""
    if pipeline == "all":
        return {}
    if pipeline == "pre_sales":
        return {"$or": [{"pipeline": "pre_sales"}, {"pipeline": {"$exists": False}}]}
    return {"pipeline": pipeline}

# Invoice Raise now lives exclusively in the Sales pipeline — a Pre-sales
# lead books/manages its appointment, then Sales owns everything from
# Appointment through Quotation (a lead here auto-opens the quotation PDF
# flow, LeadQuotationModal — trigger is name-based, any stage matching
# /quot/i) to the only two outcomes: Lost or Invoice Raise. Quotation isn't
# fixed/protected like the terminal two — it's just seeded by default.
PIPELINE_STAGE_BACKFILL = {
    "pre_sales": [],
    "sales": [
        {"name": "Quotation", "color": "#f59e0b", "is_fixed": False},
        {"name": "Lost", "color": "#ef4444", "is_fixed": True},
        {"name": "Invoice Raise", "color": "#a855f7", "is_fixed": True},
    ],
}

async def _migrate_legacy_presales_invoice_raise():
    """One-time self-healing migration: Invoice Raise used to be seeded into
    Pre-sales too. Any stage doc named "Invoice Raise" with no `pipeline` tag
    (i.e. resolved as pre_sales) is folded into the Sales pipeline, and any
    lead still sitting on it is moved to "Deal Closed" in Pre-sales so it
    isn't left pointing at a stage that no longer appears there."""
    legacy = await db.lead_stages.find_one({
        "name": {"$regex": "^invoice raise$", "$options": "i"},
        "pipeline": {"$exists": False},
        "is_deleted": {"$ne": True},
    }, {"_id": 0})
    if not legacy:
        return

    # Move any leads sitting on the legacy stage to Deal Closed so Pre-sales
    # never shows a lead pointing at a stage no longer in its stage list.
    deal_closed = await db.lead_stages.find_one({
        "name": {"$regex": "^deal closed$", "$options": "i"},
        "$and": [_pipeline_match("pre_sales")],
        "is_deleted": {"$ne": True},
    }, {"_id": 0})
    if deal_closed:
        await db.leads_v2.update_many(
            {"stage_id": legacy["stage_id"], "is_deleted": {"$ne": True}},
            {"$set": {"stage_id": deal_closed["stage_id"], "updated_at": datetime.now(timezone.utc)}},
        )

    # If Sales already seeded its own "Invoice Raise" (e.g. someone opened the
    # Sales tab before this migration ran), reuse that one and retire the
    # legacy doc instead of creating a duplicate stage.
    existing_sales_invoice_raise = await db.lead_stages.find_one({
        "name": {"$regex": "^invoice raise$", "$options": "i"},
        "pipeline": "sales",
        "is_deleted": {"$ne": True},
        "stage_id": {"$ne": legacy["stage_id"]},
    }, {"_id": 0})
    if existing_sales_invoice_raise:
        await db.lead_stages.update_one(
            {"stage_id": legacy["stage_id"]},
            {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
        )
    else:
        await db.lead_stages.update_one(
            {"stage_id": legacy["stage_id"]},
            {"$set": {"pipeline": "sales"}},
        )

@leads_v2_router.get("/stages")
async def get_stages(request: Request, pipeline: str = "pre_sales"):
    """Get all lead stages for a pipeline ('pre_sales' or 'sales'). Auto-seeds
    defaults on first call per-pipeline and idempotently backfills each
    pipeline's default stages (see PIPELINE_STAGE_BACKFILL) if missing."""
    await get_current_user_from_request(request)
    await _migrate_legacy_presales_invoice_raise()
    base_query = {"is_deleted": {"$ne": True}, "$and": [_pipeline_match(pipeline)]}
    stages = await db.lead_stages.find(
        base_query,
        {"_id": 0}
    ).sort("order", 1).to_list(100)

    # Create default stages if none exist
    if not stages:
        if pipeline == "sales":
            default_stages = [
                {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Appointment", "color": "#3b82f6", "order": 0},
                {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Quotation", "color": "#f59e0b", "order": 1},
                {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Lost", "color": "#ef4444", "order": 2, "is_fixed": True},
                {"stage_id": f"stage_{uuid.uuid4().hex[:8]}", "name": "Invoice Raise", "color": "#a855f7", "order": 3, "is_fixed": True},
            ]
        else:
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
            stage["pipeline"] = pipeline
            stage["created_at"] = datetime.now(timezone.utc)
            stage["is_deleted"] = False
            await db.lead_stages.insert_one(stage)
        stages = default_stages

    # Idempotent backfill: ensure this pipeline's default stages exist (e.g.
    # Sales must always have Quotation and end in Lost / Invoice Raise). Each
    # missing one is inserted right before whichever OTHER backfill-list
    # stage already exists with the lowest order (so Quotation lands ahead
    # of Lost/Invoice Raise even on an already-seeded Sales pipeline),
    # otherwise appended at the end, in PIPELINE_STAGE_BACKFILL order.
    backfill_list = PIPELINE_STAGE_BACKFILL.get(pipeline, [])
    backfill_names_lower = {b["name"].lower() for b in backfill_list}
    for entry in backfill_list:
        has_it = any((s.get("name") or "").strip().lower() == entry["name"].lower() for s in stages)
        if has_it:
            continue
        other_orders = [s.get("order", 0) for s in stages
                        if (s.get("name") or "").strip().lower() in backfill_names_lower
                        and (s.get("name") or "").strip().lower() != entry["name"].lower()]
        insert_order = (min(other_orders) if other_orders else (max((s.get("order", 0) for s in stages), default=-1) + 1))
        if other_orders:
            await db.lead_stages.update_many(
                {**base_query, "order": {"$gte": insert_order}},
                {"$inc": {"order": 1}},
            )
        new_stage = {
            "stage_id": f"stage_{uuid.uuid4().hex[:8]}",
            "name": entry["name"],
            "color": entry["color"],
            "order": insert_order,
            "is_fixed": entry["is_fixed"],
            "pipeline": pipeline,
            "created_at": datetime.now(timezone.utc),
            "is_deleted": False,
        }
        await db.lead_stages.insert_one(new_stage)
        stages = await db.lead_stages.find(
            base_query,
            {"_id": 0}
        ).sort("order", 1).to_list(100)

    return stages

@leads_v2_router.post("/stages")
async def create_stage(stage_data: StageCreate, request: Request):
    """Create a new stage"""
    user = await get_current_user_from_request(request)

    # Get next order (scoped to this stage's pipeline)
    max_order = await db.lead_stages.find_one(
        {"is_deleted": {"$ne": True}, "$and": [_pipeline_match(stage_data.pipeline)]},
        sort=[("order", -1)]
    )
    next_order = (max_order.get("order", -1) + 1) if max_order else 0

    stage_id = f"stage_{uuid.uuid4().hex[:8]}"
    stage_doc = {
        "stage_id": stage_id,
        "name": stage_data.name,
        "color": stage_data.color,
        "order": stage_data.order if stage_data.order > 0 else next_order,
        "pipeline": stage_data.pipeline,
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

    # Fixed stages (e.g. "Invoice Raise") cannot be deleted — they back built-in flows.
    existing = await db.lead_stages.find_one({"stage_id": stage_id}, {"_id": 0})
    if existing and existing.get("is_fixed"):
        raise HTTPException(status_code=400, detail=f"'{existing.get('name')}' is a fixed stage and cannot be deleted.")

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

def _search_clause(search: Optional[str]) -> List[Dict[str, Any]]:
    if not search:
        return []
    return [{"$or": [
        {"name": {"$regex": search, "$options": "i"}},
        {"email": {"$regex": search, "$options": "i"}},
        {"phone": {"$regex": search, "$options": "i"}},
    ]}]


def _leads_sort_key(lead: Dict[str, Any]):
    created_at = lead.get("created_at")
    created_key = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at or "")
    return (created_key, lead.get("sheet_row_index") or 0)


@leads_v2_router.get("/leads")
async def get_leads(
    request: Request,
    stage_id: Optional[str] = None,
    search: Optional[str] = None,
    lead_owner: Optional[str] = None,
    pipeline: str = "pre_sales",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """Get all leads with optional filters. `date_from`/`date_to` (ISO,
    filtering on created_at) back the Overview tab's lead-rows table —
    combine with pipeline=all to see leads from either pipeline."""
    await get_current_user_from_request(request)

    query = {"is_deleted": {"$ne": True}}
    and_clauses = [_pipeline_match(pipeline)] + _search_clause(search)

    if stage_id:
        query["stage_id"] = stage_id

    if lead_owner:
        query["lead_owner"] = lead_owner

    if date_from or date_to:
        created_filter = {}
        if date_from:
            created_filter["$gte"] = _parse_iso(date_from)
        if date_to:
            created_filter["$lte"] = _parse_iso(date_to)
        query["created_at"] = created_filter

    query["$and"] = and_clauses

    # Newest first. Secondary key handles sheet-sync batches that share one
    # `created_at` (every row synced in the same run) — falls back to the
    # sheet's own row order (bottom of sheet = added more recently) instead
    # of an undefined tie order.
    leads = await db.leads_v2.find(query, {"_id": 0}).sort(
        [("created_at", -1), ("sheet_row_index", -1)]
    ).to_list(10000)

    # Pre-sales keeps visibility on a lead even after booking its appointment
    # auto-promotes it into the Sales pipeline (see update_lead_stage) — as
    # long as Sales hasn't moved it past that first Appointment step yet, it's
    # merged back into the Pre-sales list here (read-only: its stage_id is
    # remapped to Pre-sales' own Appointment stage so it slots into that
    # bucket/card count instead of vanishing from Pre-sales entirely).
    if pipeline == "pre_sales":
        pre_sales_appt_stage, sales_appt_stage = await _pre_sales_promoted_appointment_stages(request)
        if pre_sales_appt_stage and sales_appt_stage and (not stage_id or stage_id == pre_sales_appt_stage["stage_id"]):
            promo_query = {"is_deleted": {"$ne": True}, "stage_id": sales_appt_stage["stage_id"]}
            if lead_owner:
                promo_query["lead_owner"] = lead_owner
            promo_query["$and"] = [{"pipeline": "sales"}] + _search_clause(search)
            promoted = await db.leads_v2.find(promo_query, {"_id": 0}).to_list(10000)
            if promoted:
                for p in promoted:
                    p["stage_id"] = pre_sales_appt_stage["stage_id"]
                    p["promoted_to_sales"] = True
                leads = sorted(leads + promoted, key=_leads_sort_key, reverse=True)

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
    current_user = await get_current_user_from_request(request)
    
    # Get current lead data for comparison
    old_lead = await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})

    # Only the lead's creator (or an admin) may reassign the Lead Owner —
    # everyone else can still edit every other field on the lead.
    if (
        old_lead
        and "lead_owner" in update_data
        and update_data["lead_owner"] != old_lead.get("lead_owner")
    ):
        role = (current_user.get("role") or "").lower()
        if current_user.get("user_id") != old_lead.get("created_by") and role not in ("super_admin", "admin"):
            raise HTTPException(status_code=403, detail="Only the lead's creator can change the Lead Owner")

    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.leads_v2.update_one(
        {"lead_id": lead_id},
        {"$set": update_data}
    )
    
    updated_lead = await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})
    
    # Check if lead owner changed
    if old_lead and update_data.get("lead_owner_id") and update_data.get("lead_owner_id") != old_lead.get("lead_owner_id"):
        new_owner_email = await get_user_email_by_id(db, update_data["lead_owner_id"])
        new_owner = await db.users.find_one({"user_id": update_data["lead_owner_id"]}, {"_id": 0})
        if new_owner_email:
            asyncio.create_task(notify_lead_assigned(
                assignee_email=new_owner_email,
                assignee_name=new_owner.get("name", "Owner"),
                lead_name=updated_lead.get("name", "Unknown"),
                company=updated_lead.get("location", ""),
                assigned_by=current_user.name,
                lead_id=lead_id
            ))
    
    return updated_lead

@leads_v2_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, request: Request):
    """Soft-delete a lead"""
    await get_current_user_from_request(request)
    
    await db.leads_v2.update_one(
        {"lead_id": lead_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Lead deleted"}


@leads_v2_router.post("/leads/cleanup-dummy-sheet-leads")
async def cleanup_dummy_sheet_leads(request: Request):
    """One-off cleanup for blank-row leads created by the sheet-sync bug
    (fixed in sheets_routes.py): every row Google Sheets reported as blank
    was previously inserted as a real lead with name defaulted to "—" and
    empty phone/email. Soft-deletes only leads that came from a sheet sync
    AND have no name/phone/email at all — never touches a lead with any
    real data in it."""
    user = await get_current_user_from_request(request)
    role = (user.get("role") if isinstance(user, dict) else getattr(user, "role", "")) or ""
    if role.lower() not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin can run this cleanup")

    query = {
        "is_deleted": {"$ne": True},
        "imported_from_sheet": {"$in": ["lead", "prospect"]},
        "$or": [{"name": "—"}, {"name": ""}, {"name": {"$exists": False}}],
        "$and": [
            {"$or": [{"phone": ""}, {"phone": {"$exists": False}}]},
            {"$or": [{"email": ""}, {"email": {"$exists": False}}]},
        ],
    }
    result = await db.leads_v2.update_many(
        query,
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc), "deleted_reason": "dummy_sheet_row_cleanup"}},
    )
    return {"removed": result.modified_count}


@leads_v2_router.delete("/leads/{lead_id}/permanent")
async def permanent_delete_lead(lead_id: str, request: Request):
    """Permanently remove a lead from the database (irreversible)."""
    user = await get_current_user_from_request(request)
    role = (user.get("role") if isinstance(user, dict) else getattr(user, "role", "")) or ""
    if role.lower() not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Only Super Admin / Admin can permanently delete")
    result = await db.leads_v2.delete_one({"lead_id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    # Also remove any sheet-row link
    await db.leads_sheet_rows.delete_many({"row_id": lead_id})
    return {"message": "Lead permanently deleted", "lead_id": lead_id}

def _lead_pipeline(lead: Dict[str, Any]) -> str:
    return lead.get("pipeline") or "pre_sales"

async def _get_sales_appointment_stage(request: Request) -> Optional[Dict[str, Any]]:
    """Return the Sales pipeline's Appointment-named stage, seeding Sales
    pipeline defaults first if it doesn't exist yet."""
    stage = await db.lead_stages.find_one(
        {"is_deleted": {"$ne": True}, "pipeline": "sales", "name": {"$regex": "appoin", "$options": "i"}},
        {"_id": 0},
        sort=[("order", 1)],
    )
    if stage:
        return stage
    await get_stages(request, pipeline="sales")
    return await db.lead_stages.find_one(
        {"is_deleted": {"$ne": True}, "pipeline": "sales", "name": {"$regex": "appoin", "$options": "i"}},
        {"_id": 0},
        sort=[("order", 1)],
    )

async def _pre_sales_promoted_appointment_stages(request: Request):
    """The two ends of the Pre-sales -> Sales appointment-booking promotion:
    (pre_sales_appointment_stage, sales_appointment_stage). Either can be
    None if that pipeline's stages haven't been seeded yet."""
    pre_sales_appt_stage = await db.lead_stages.find_one(
        {"is_deleted": {"$ne": True}, "$and": [_pipeline_match("pre_sales")], "name": {"$regex": "appoin", "$options": "i"}},
        {"_id": 0},
    )
    sales_appt_stage = await _get_sales_appointment_stage(request)
    return pre_sales_appt_stage, sales_appt_stage

async def _sync_calendar_and_log_appointment(
    lead: Dict[str, Any], appointment_at: str, reason: str, current_user: Dict[str, Any], update_doc: Dict[str, Any]
) -> Dict[str, Any]:
    """Push the appointment to Google Calendar (best-effort) and build the
    appointment_history entry to $push alongside `update_doc`'s $set."""
    from google_calendar_routes import upsert_appointment_event
    calendar_event_id = await upsert_appointment_event(
        user_id=current_user["user_id"],
        summary=f"New Lead Appointment - {lead.get('name', 'Lead')}" if lead else "New Lead Appointment",
        start_iso=appointment_at,
        description=(
            f"Lead: {lead.get('name', '')}\nPhone: {lead.get('phone', '')}\nEmail: {lead.get('email', '')}\nReason: {reason}"
            if lead else f"Reason: {reason}"
        ),
        existing_event_id=lead.get("google_calendar_event_id") if lead else None,
    )
    if calendar_event_id:
        update_doc["google_calendar_event_id"] = calendar_event_id
    return {
        "appointment_at": appointment_at,
        "reason": reason,
        "changed_at": datetime.now(timezone.utc),
        "changed_by": current_user["user_id"],
        "changed_by_name": current_user.get("name", ""),
    }

@leads_v2_router.put("/leads/{lead_id}/stage")
async def update_lead_stage(lead_id: str, stage_data: Dict[str, Any], request: Request):
    """Update lead stage (for drag-drop). Optional `appointment_at` (ISO) is
    stored when moving into an Appointment / Appointment Reschedule stage and
    `followup_at` for Followup / Prospect Followup stages — both drive the new
    columns in the leads table and the date filter.

    Booking an appointment from Pre-sales auto-promotes the lead into the
    Sales pipeline's own Appointment stage — Sales owns everything from
    there through to the only two outcomes: Lost or Invoice Raise."""
    current_user = await get_current_user_from_request(request)

    lead = await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})

    update_doc = {
        "stage_id": stage_data["stage_id"],
        "updated_at": datetime.now(timezone.utc),
    }
    if stage_data.get("followup_at"):
        update_doc["followup_at"] = stage_data["followup_at"]

    new_stage = await db.lead_stages.find_one({"stage_id": stage_data["stage_id"]}, {"_id": 0})
    new_stage_name = (new_stage.get("name") or "").strip().lower() if new_stage else ""
    is_appointment_stage = "appoin" in new_stage_name

    # Once a lead is actually promoted into Sales, it's shown back in
    # Pre-sales read-only (see get_leads) — block any attempt to move it into
    # a stage from the other pipeline instead of silently corrupting it with
    # a stage_id that belongs to a pipeline it's no longer in. The one
    # legitimate cross-pipeline move is the promotion itself, handled below.
    lead_pipeline = _lead_pipeline(lead) if lead else None
    new_stage_pipeline = new_stage.get("pipeline") if new_stage else None
    is_promotion_transition = is_appointment_stage and lead_pipeline == "pre_sales" and bool(stage_data.get("appointment_at"))
    if new_stage_pipeline and lead_pipeline and new_stage_pipeline != lead_pipeline and not is_promotion_transition:
        raise HTTPException(
            status_code=400,
            detail="This lead now belongs to the Sales pipeline — change its stage from the Sales tab.",
        )

    history_entry = None
    if stage_data.get("appointment_at"):
        appointment_at = stage_data["appointment_at"]
        update_doc["appointment_at"] = appointment_at

        # Booking an appointment from Pre-sales auto-promotes into Sales.
        if is_appointment_stage and lead and _lead_pipeline(lead) == "pre_sales":
            sales_stage = await _get_sales_appointment_stage(request)
            if sales_stage:
                update_doc["pipeline"] = "sales"
                update_doc["stage_id"] = sales_stage["stage_id"]

        if is_appointment_stage:
            reason = stage_data.get("reason") or ("Rescheduled" if lead and lead.get("appointment_at") else "Initial appointment booked")
            history_entry = await _sync_calendar_and_log_appointment(lead, appointment_at, reason, current_user, update_doc)

    mongo_update = {"$set": update_doc}
    if history_entry:
        mongo_update["$push"] = {"appointment_history": history_entry}

    await db.leads_v2.update_one(
        {"lead_id": lead_id},
        mongo_update,
    )

    # Check if moved to "Deal Closed" or "Won" stage
    if new_stage and new_stage.get("name", "").lower() in ["deal closed", "won", "closed won"]:
        # Get lead owner and admin emails
        recipient_emails = []
        if lead.get("lead_owner_id"):
            owner_email = await get_user_email_by_id(db, lead["lead_owner_id"])
            if owner_email:
                recipient_emails.append(owner_email)
        
        # Add admins
        admins = await db.users.find(
            {"role": {"$in": ["super_admin", "admin"]}},
            {"_id": 0, "email": 1}
        ).to_list(10)
        recipient_emails.extend([a["email"] for a in admins if a.get("email")])
        
        if recipient_emails:
            asyncio.create_task(notify_lead_closed(
                recipient_emails=list(set(recipient_emails)),
                lead_name=lead.get("name", "Unknown"),
                company=lead.get("location", ""),
                closed_by=current_user.name,
                deal_value=f"₹{lead.get('estimation_amount', 0):,}" if lead.get('estimation_amount') else "Not specified",
                lead_id=lead_id
            ))
    
    return await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})

@leads_v2_router.post("/leads/{lead_id}/appointments/reschedule")
async def reschedule_appointment(lead_id: str, payload: Dict[str, Any], request: Request):
    """Reschedule a lead's appointment with a reason. Logs to
    appointment_history and updates (or creates) the Google Calendar event.
    Works regardless of which pipeline (Pre-sales or Sales) currently holds
    the lead — the Appointments tab in the lead popup calls this directly."""
    current_user = await get_current_user_from_request(request)
    lead = await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    appointment_at = payload.get("appointment_at")
    if not appointment_at:
        raise HTTPException(status_code=400, detail="appointment_at is required")
    reason = (payload.get("reason") or "").strip() or "Rescheduled"

    update_doc = {"updated_at": datetime.now(timezone.utc)}
    history_entry = await _sync_calendar_and_log_appointment(lead, appointment_at, reason, current_user, update_doc)
    update_doc["appointment_at"] = appointment_at

    await db.leads_v2.update_one(
        {"lead_id": lead_id},
        {"$set": update_doc, "$push": {"appointment_history": history_entry}},
    )
    return await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})

# ============== LEAD REMARKS/NOTES ==============

@leads_v2_router.post("/leads/{lead_id}/remarks")
async def add_lead_remark(lead_id: str, remark_data: Dict[str, str], request: Request):
    """Add a remark/note to a lead"""
    current_user = await get_current_user_from_request(request)
    
    lead = await db.leads_v2.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    remark = {
        "remark_id": f"rem_{uuid.uuid4().hex[:12]}",
        "lead_id": lead_id,
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "content": remark_data.get("content", ""),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.lead_remarks.insert_one(remark)
    
    # Notify lead owner
    if lead.get("lead_owner_id") and lead.get("lead_owner_id") != current_user.user_id:
        owner_email = await get_user_email_by_id(db, lead["lead_owner_id"])
        if owner_email:
            asyncio.create_task(notify_lead_remark(
                recipient_emails=[owner_email],
                lead_name=lead.get("name", "Unknown"),
                remark_by=current_user.name,
                remark=remark_data.get("content", "")[:200],  # Truncate for email
                lead_id=lead_id
            ))
    
    return {"message": "Remark added", "remark_id": remark["remark_id"]}

@leads_v2_router.get("/leads/{lead_id}/remarks")
async def get_lead_remarks(lead_id: str, request: Request):
    """Get all remarks for a lead"""
    await get_current_user_from_request(request)
    
    remarks = await db.lead_remarks.find(
        {"lead_id": lead_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return remarks

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
async def get_lead_stats(request: Request, pipeline: str = "pre_sales"):
    """Get lead statistics for a pipeline"""
    await get_current_user_from_request(request)

    stages = await db.lead_stages.find(
        {"is_deleted": {"$ne": True}, "$and": [_pipeline_match(pipeline)]},
        {"_id": 0}
    ).sort("order", 1).to_list(100)

    total_leads = await db.leads_v2.count_documents(
        {"is_deleted": {"$ne": True}, "$and": [_pipeline_match(pipeline)]}
    )

    # Keep this in sync with the promoted-lead merge in get_leads() so the
    # header total matches the number of rows Pre-sales actually sees.
    if pipeline == "pre_sales":
        pre_sales_appt_stage, sales_appt_stage = await _pre_sales_promoted_appointment_stages(request)
        if pre_sales_appt_stage and sales_appt_stage:
            total_leads += await db.leads_v2.count_documents(
                {"is_deleted": {"$ne": True}, "pipeline": "sales", "stage_id": sales_appt_stage["stage_id"]}
            )

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


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


@leads_v2_router.get("/overview")
async def get_overview(request: Request, date_from: Optional[str] = None, date_to: Optional[str] = None):
    """LAPS funnel snapshot for the Overview tab: of the leads created in the
    given window (across both pipelines), how many went on to book an
    Appointment, get a Proposal (Quotation) shared, and close as a Sale
    (Invoice Raise) — using each lead's current state rather than a stage-
    change log, so a lead is counted the moment it has an appointment_at /
    quotation_id / is sitting at Invoice Raise, regardless of which pipeline
    it lives in now. Each step's percentage is of the step before it."""
    await get_current_user_from_request(request)

    query = {"is_deleted": {"$ne": True}}
    created_filter = {}
    if date_from:
        created_filter["$gte"] = _parse_iso(date_from)
    if date_to:
        created_filter["$lte"] = _parse_iso(date_to)
    if created_filter:
        query["created_at"] = created_filter

    leads = await db.leads_v2.find(
        query, {"_id": 0, "appointment_at": 1, "quotation_id": 1, "stage_id": 1, "estimation": 1}
    ).to_list(200000)

    invoice_stage = await db.lead_stages.find_one(
        {"is_deleted": {"$ne": True}, "pipeline": "sales", "name": {"$regex": "invoice.?rais", "$options": "i"}},
        {"_id": 0},
    )
    invoice_stage_id = invoice_stage["stage_id"] if invoice_stage else None

    total = len(leads)
    appointment_leads = [l for l in leads if l.get("appointment_at")]
    proposal_leads = [l for l in leads if l.get("quotation_id")]
    sales_leads = [l for l in leads if invoice_stage_id and l.get("stage_id") == invoice_stage_id]

    def pct(part: int, whole: int) -> float:
        return round((part / whole) * 100, 2) if whole else 0

    return {
        "leads": total,
        "appointment": {"count": len(appointment_leads), "pct": pct(len(appointment_leads), total)},
        "proposal_shared": {"count": len(proposal_leads), "pct": pct(len(proposal_leads), len(appointment_leads))},
        "sales": {
            "count": len(sales_leads),
            "value": sum(float(l.get("estimation") or 0) for l in sales_leads),
            "pct": pct(len(sales_leads), len(proposal_leads)),
        },
    }


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
    """Get team members for Lead Owner dropdown.
    Only returns users who actually have access to the Leads module:
      - super_admin / admin role  → always included
      - any user whose module_access contains 'leads'
    """
    await get_current_user_from_request(request)

    cursor = db.users.find(
        {
            "is_active": True,
            "$or": [
                {"role": {"$in": ["super_admin", "admin"]}},
                {"module_access": "leads"},
            ],
        },
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1}
    )
    members = await cursor.to_list(200)
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



# ============== ONE-TIME BACKFILL — promote custom_fields → first-class fields ==============
# Safe to re-run; only updates fields that are still empty so manual edits are never overwritten.

@leads_v2_router.post("/leads/backfill-from-custom-fields")
async def backfill_from_custom_fields(request: Request):
    """
    Promote sheet-imported custom_fields (company_name, what_do_you_want_to_do?, phone_number,
    city, website, ...) into the corresponding first-class fields on each lead. Idempotent:
    only fills fields that are still empty, so manual edits made in the UI are preserved.
    """
    from server import get_current_user
    user = await get_current_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin only")

    cursor = db.leads_v2.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0, "lead_id": 1, "custom_fields": 1, "company_name": 1,
         "what_do_you_do": 1, "phone": 1, "location": 1, "website": 1, "email": 1, "name": 1},
    )
    updated = 0
    total = 0

    def _pick(cf: dict, *keys: str) -> str:
        for k in keys:
            v = cf.get(k)
            if v:
                return str(v).strip()
        return ""

    async for ld in cursor:
        total += 1
        cf = ld.get("custom_fields") or {}
        # Normalize cf keys lower-case once for matching
        cf_lower = {str(k).lower(): v for k, v in cf.items()}
        updates: dict = {}
        if not ld.get("company_name"):
            v = _pick(cf_lower, "company_name", "company name", "company", "organization", "business_name")
            if v:
                updates["company_name"] = v
        if not ld.get("what_do_you_do"):
            v = _pick(cf_lower, "what_do_you_want_to_do?", "what_do_you_want_to_do", "what do you do", "what_do_you_do")
            if v:
                updates["what_do_you_do"] = v
        if not ld.get("phone"):
            v = _pick(cf_lower, "phone_number", "phone number", "mobile", "contact")
            if v:
                updates["phone"] = v
        if not ld.get("location"):
            v = _pick(cf_lower, "city", "location", "city/town")
            if v:
                updates["location"] = v
        if not ld.get("website"):
            v = _pick(cf_lower, "website", "site", "url")
            if v:
                updates["website"] = v
        if updates:
            await db.leads_v2.update_one({"lead_id": ld["lead_id"]}, {"$set": updates})
            updated += 1
    return {"scanned": total, "updated": updated, "message": f"Backfill complete — {updated}/{total} leads updated."}
