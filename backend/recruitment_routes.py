"""
Recruitment (Hiring Pipeline) — HR Admin

A CRM-style candidate tracker: custom, drag-and-drop stages (mirrors the
Sales Department's Leads pipeline) plus a detailed candidate record (basic
details, address, salary package, resume, notes).
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid

recruitment_router = APIRouter(prefix="/recruitment", tags=["Recruitment"])
db = None

def init_recruitment_db(database):
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
    color: str = '#6366f1'
    order: int = 0

class StageUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None

class OpeningCreate(BaseModel):
    title: str
    department: str = ''
    status: str = 'Open'  # Open, On Hold, Closed
    openings_count: int = 1
    description: str = ''

class OpeningUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    openings_count: Optional[int] = None
    description: Optional[str] = None

class CandidateCreate(BaseModel):
    name: str
    email: str = ''
    phone: str = ''
    address: str = ''
    position_applied: str = ''
    experience_years: str = ''
    source: str = ''
    salary_expected: float = 0
    salary_offered: float = 0
    resume_link: str = ''
    notes: str = ''
    assigned_to: str = ''  # recruiter/interviewer user_id
    stage_id: str = ''

class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    position_applied: Optional[str] = None
    experience_years: Optional[str] = None
    source: Optional[str] = None
    salary_expected: Optional[float] = None
    salary_offered: Optional[float] = None
    resume_link: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    stage_id: Optional[str] = None

# ============== AUTH HELPER (mirrors leads_v2_routes.py's local pattern) ==============

async def get_current_user_from_request(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
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

DEFAULT_STAGES = [
    {"name": "New Candidate", "color": "#6366f1"},
    {"name": "Screening", "color": "#3b82f6"},
    {"name": "Interview", "color": "#f59e0b"},
    {"name": "Offer", "color": "#8b5cf6"},
    {"name": "Hired", "color": "#22c55e"},
    {"name": "Rejected", "color": "#ef4444"},
]

@recruitment_router.get("/stages")
async def get_stages(request: Request):
    """Get all recruitment pipeline stages. Auto-seeds sensible defaults on
    first call — all freely renamable/reorderable/deletable via the Stages
    manager, same as the Sales Department's Leads pipeline."""
    await get_current_user_from_request(request)
    stages = await db.recruitment_stages.find(
        {"is_deleted": {"$ne": True}}, {"_id": 0}
    ).sort("order", 1).to_list(100)

    if not stages:
        stages = []
        for i, s in enumerate(DEFAULT_STAGES):
            stage = {
                "stage_id": f"rstage_{uuid.uuid4().hex[:8]}",
                "name": s["name"],
                "color": s["color"],
                "order": i,
                "created_at": datetime.now(timezone.utc),
                "is_deleted": False,
            }
            await db.recruitment_stages.insert_one(stage)
            stages.append(stage)

    return stages

@recruitment_router.post("/stages")
async def create_stage(stage_data: StageCreate, request: Request):
    user = await get_current_user_from_request(request)
    max_order = await db.recruitment_stages.find_one(
        {"is_deleted": {"$ne": True}}, sort=[("order", -1)]
    )
    next_order = (max_order.get("order", -1) + 1) if max_order else 0

    stage_id = f"rstage_{uuid.uuid4().hex[:8]}"
    stage_doc = {
        "stage_id": stage_id,
        "name": stage_data.name,
        "color": stage_data.color,
        "order": stage_data.order if stage_data.order > 0 else next_order,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "is_deleted": False,
    }
    await db.recruitment_stages.insert_one(stage_doc)
    return await db.recruitment_stages.find_one({"stage_id": stage_id}, {"_id": 0})

# Static routes before dynamic {stage_id} routes.
@recruitment_router.put("/stages/reorder")
async def reorder_stages(reorder_data: StageReorderRequest, request: Request):
    await get_current_user_from_request(request)
    for item in reorder_data.stages:
        await db.recruitment_stages.update_one(
            {"stage_id": item.stage_id}, {"$set": {"order": item.order}}
        )
    return {"message": "Stages reordered"}

@recruitment_router.put("/stages/{stage_id}")
async def update_stage(stage_id: str, update_data: StageUpdate, request: Request):
    await get_current_user_from_request(request)
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.now(timezone.utc)
    await db.recruitment_stages.update_one({"stage_id": stage_id}, {"$set": update_dict})
    return await db.recruitment_stages.find_one({"stage_id": stage_id}, {"_id": 0})

@recruitment_router.delete("/stages/{stage_id}")
async def delete_stage(stage_id: str, request: Request):
    await get_current_user_from_request(request)
    candidate_count = await db.recruitment_candidates.count_documents(
        {"stage_id": stage_id, "is_deleted": {"$ne": True}}
    )
    if candidate_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete stage with {candidate_count} candidates. Move them first.")
    await db.recruitment_stages.update_one(
        {"stage_id": stage_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Stage deleted"}

# ============== OPENING POSITIONS ROUTES ==============
# A managed list of job postings — feeds the "Position Applied" dropdown on
# the candidate form (mirrors the Sales Department's Lead Source manager).

OPENING_STATUSES = ["Open", "On Hold", "Closed"]

@recruitment_router.get("/openings")
async def get_openings(request: Request):
    await get_current_user_from_request(request)
    return await db.recruitment_openings.find(
        {"is_deleted": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

@recruitment_router.post("/openings")
async def create_opening(payload: OpeningCreate, request: Request):
    user = await get_current_user_from_request(request)
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Position title is required")
    if payload.status not in OPENING_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(OPENING_STATUSES)}")

    opening_id = f"open_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    doc = {
        "opening_id": opening_id,
        "title": payload.title.strip(),
        "department": payload.department.strip(),
        "status": payload.status,
        "openings_count": payload.openings_count,
        "description": payload.description,
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    await db.recruitment_openings.insert_one(doc)
    return await db.recruitment_openings.find_one({"opening_id": opening_id}, {"_id": 0})

@recruitment_router.put("/openings/{opening_id}")
async def update_opening(opening_id: str, payload: OpeningUpdate, request: Request):
    await get_current_user_from_request(request)
    update_dict = {k: v for k, v in payload.dict().items() if v is not None}
    if "status" in update_dict and update_dict["status"] not in OPENING_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(OPENING_STATUSES)}")
    update_dict["updated_at"] = datetime.now(timezone.utc)
    await db.recruitment_openings.update_one({"opening_id": opening_id}, {"$set": update_dict})
    return await db.recruitment_openings.find_one({"opening_id": opening_id}, {"_id": 0})

@recruitment_router.delete("/openings/{opening_id}")
async def delete_opening(opening_id: str, request: Request):
    await get_current_user_from_request(request)
    await db.recruitment_openings.update_one(
        {"opening_id": opening_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Opening deleted"}

# ============== CANDIDATES ROUTES ==============

@recruitment_router.get("/candidates")
async def get_candidates(request: Request):
    await get_current_user_from_request(request)
    candidates = await db.recruitment_candidates.find(
        {"is_deleted": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", -1).to_list(5000)

    user_ids = list(set(c.get("assigned_to") for c in candidates if c.get("assigned_to")))
    users_map = {}
    if user_ids:
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(200)
        users_map = {u["user_id"]: u["name"] for u in users}
    for c in candidates:
        c["assigned_to_name"] = users_map.get(c.get("assigned_to"), "")

    return candidates

@recruitment_router.post("/candidates")
async def create_candidate(payload: CandidateCreate, request: Request):
    user = await get_current_user_from_request(request)
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Candidate name is required")

    stage_id = payload.stage_id
    if not stage_id:
        first_stage = await db.recruitment_stages.find_one(
            {"is_deleted": {"$ne": True}}, {"_id": 0}, sort=[("order", 1)]
        )
        stage_id = first_stage["stage_id"] if first_stage else ""

    candidate_id = f"cand_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    doc = {
        "candidate_id": candidate_id,
        **payload.dict(exclude={"stage_id"}),
        "stage_id": stage_id,
        "activity_log": [{"action": "Candidate added", "at": now.isoformat(), "by": user.get("name", "")}],
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    await db.recruitment_candidates.insert_one(doc)
    doc.pop("_id", None)
    return doc

@recruitment_router.put("/candidates/{candidate_id}")
async def update_candidate(candidate_id: str, payload: CandidateUpdate, request: Request):
    user = await get_current_user_from_request(request)
    candidate = await db.recruitment_candidates.find_one({"candidate_id": candidate_id}, {"_id": 0})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    update_dict = {k: v for k, v in payload.dict().items() if v is not None}
    now = datetime.now(timezone.utc)
    update_dict["updated_at"] = now

    push_ops = {}
    if update_dict.get("stage_id") and update_dict["stage_id"] != candidate.get("stage_id"):
        stage = await db.recruitment_stages.find_one({"stage_id": update_dict["stage_id"]}, {"_id": 0})
        push_ops["activity_log"] = {
            "action": f"Moved to {stage.get('name') if stage else update_dict['stage_id']}",
            "at": now.isoformat(),
            "by": user.get("name", ""),
        }

    mongo_update = {"$set": update_dict}
    if push_ops:
        mongo_update["$push"] = push_ops
    await db.recruitment_candidates.update_one({"candidate_id": candidate_id}, mongo_update)
    return await db.recruitment_candidates.find_one({"candidate_id": candidate_id}, {"_id": 0})

@recruitment_router.delete("/candidates/{candidate_id}")
async def delete_candidate(candidate_id: str, request: Request):
    await get_current_user_from_request(request)
    await db.recruitment_candidates.update_one(
        {"candidate_id": candidate_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Candidate deleted"}

@recruitment_router.get("/team-members")
async def get_team_members(request: Request):
    """Recruiter/assignee dropdown — any active user."""
    await get_current_user_from_request(request)
    users = await db.users.find(
        {"is_active": {"$ne": False}, "status": {"$ne": "inactive"}}, {"_id": 0, "user_id": 1, "name": 1}
    ).sort("name", 1).to_list(500)
    return users
