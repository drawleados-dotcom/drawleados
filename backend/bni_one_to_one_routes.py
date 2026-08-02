"""
BNI One-to-One — Drawlead OS

Tracks scheduled one-to-one meetings with chapter members: schedule first
(member, date, time, location, invited by), then log the outcome afterwards
via Reschedule / Remarks actions on the row (remark, gives, referrals, status).
Setting the status to "Lead" auto-creates a lead in the main Leads pipeline
(source "BNI") so it reaches the sales team — once per entry.

Storage: collection `bni_one_to_ones`.
"""
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

bni_one_to_one_router = APIRouter(prefix="/bni/one-to-ones", tags=["bni"])

ONE_TO_ONE_STATUSES = ["Lead", "One to One", "Relationship"]


class OneToOneCreate(BaseModel):
    entry_type: str = "chapter"  # chapter | cross_chapter
    member_id: str
    meeting_date: str
    meeting_time: str = ""
    location: str = ""
    invited_by: str = "me"  # me | member


class OneToOneEdit(BaseModel):
    member_id: Optional[str] = None
    meeting_date: Optional[str] = None
    meeting_time: Optional[str] = None
    location: Optional[str] = None
    invited_by: Optional[str] = None


class OneToOneReschedule(BaseModel):
    meeting_date: Optional[str] = None
    meeting_time: Optional[str] = None
    location: Optional[str] = None


class OneToOneRemarksUpdate(BaseModel):
    remark: Optional[str] = None
    gives: Optional[List[str]] = None
    referrals: Optional[List[str]] = None
    status: Optional[str] = None


@bni_one_to_one_router.get("")
async def list_one_to_ones(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    return await db.bni_one_to_ones.find({}, {"_id": 0}).sort("meeting_date", -1).to_list(5000)


@bni_one_to_one_router.post("")
async def create_one_to_one(payload: OneToOneCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)

    member = await db.bni_members.find_one({"member_id": payload.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "entry_id": f"bniotoo_{uuid.uuid4().hex[:10]}",
        "entry_type": payload.entry_type,
        "member_id": payload.member_id,
        "member_name": member.get("name", ""),
        "member_phone": member.get("phone", ""),
        "member_email": member.get("email", ""),
        "member_company": member.get("business_name", ""),
        "meeting_date": payload.meeting_date,
        "meeting_time": payload.meeting_time,
        "location": (payload.location or "").strip(),
        "invited_by": payload.invited_by,
        "remark": "",
        "gives": [],
        "referrals": [],
        "status": "",
        "lead_created": False,
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.bni_one_to_ones.insert_one(doc)
    doc.pop("_id", None)
    return doc


@bni_one_to_one_router.put("/{entry_id}")
async def edit_one_to_one(entry_id: str, payload: OneToOneEdit, request: Request):
    """Full edit of the scheduling fields (member, date, time, location,
    invited by) — distinct from Reschedule (date/time/location only) and
    Remarks (outcome fields)."""
    from server import get_current_user, db
    await get_current_user(request)
    entry = await db.bni_one_to_ones.find_one({"entry_id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="One-to-One not found")

    update_data = {k: v for k, v in payload.dict().items() if v is not None and k != "member_id"}
    if payload.member_id and payload.member_id != entry.get("member_id"):
        member = await db.bni_members.find_one({"member_id": payload.member_id}, {"_id": 0})
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        update_data.update({
            "member_id": payload.member_id,
            "member_name": member.get("name", ""),
            "member_phone": member.get("phone", ""),
            "member_email": member.get("email", ""),
            "member_company": member.get("business_name", ""),
        })
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.bni_one_to_ones.update_one({"entry_id": entry_id}, {"$set": update_data})
    return await db.bni_one_to_ones.find_one({"entry_id": entry_id}, {"_id": 0})


@bni_one_to_one_router.put("/{entry_id}/reschedule")
async def reschedule_one_to_one(entry_id: str, payload: OneToOneReschedule, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    entry = await db.bni_one_to_ones.find_one({"entry_id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="One-to-One not found")

    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.bni_one_to_ones.update_one({"entry_id": entry_id}, {"$set": update_data})
    return await db.bni_one_to_ones.find_one({"entry_id": entry_id}, {"_id": 0})


@bni_one_to_one_router.put("/{entry_id}/remarks")
async def update_remarks(entry_id: str, payload: OneToOneRemarksUpdate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    entry = await db.bni_one_to_ones.find_one({"entry_id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="One-to-One not found")

    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if "gives" in update_data:
        update_data["gives"] = [g.strip() for g in update_data["gives"] if g.strip()]
    if "referrals" in update_data:
        update_data["referrals"] = [r.strip() for r in update_data["referrals"] if r.strip()]
    if update_data.get("status") and update_data["status"] not in ONE_TO_ONE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {update_data['status']}")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.bni_one_to_ones.update_one({"entry_id": entry_id}, {"$set": update_data})

    # Status → "Lead": auto-create a lead in the main pipeline (source "BNI"),
    # once per entry — lead_created guards against duplicates on repeat saves.
    if update_data.get("status") == "Lead" and not entry.get("lead_created"):
        stage = await db.lead_stages.find_one(
            {"name": {"$regex": "^lead$", "$options": "i"}, "is_deleted": {"$ne": True}},
            {"_id": 0, "stage_id": 1},
        )
        stage_id = stage.get("stage_id") if stage else ""
        now = datetime.now(timezone.utc)
        await db.leads_v2.insert_one({
            "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
            "name": entry.get("member_name", ""),
            "phone": entry.get("member_phone", ""),
            "email": entry.get("member_email", ""),
            "company_name": entry.get("member_company", ""),
            "location": "",
            "website": "",
            "social_media": "",
            "what_do_you_do": "",
            "source": "BNI",
            "lead_owner": user.user_id,
            "lead_type": "",
            "priority": "Medium",
            "date_of_lead": now.date().isoformat(),
            "industry": "",
            "estimation": 0,
            "quotation_link": "",
            "proposal_link": "",
            "notes": f"Auto-created from BNI One-to-One on {entry.get('meeting_date', '')}",
            "stage_id": stage_id,
            "custom_fields": {},
            "pipeline": "pre_sales",
            "created_by": user.user_id,
            "created_at": now,
            "updated_at": now,
            "is_deleted": False,
        })
        await db.bni_one_to_ones.update_one({"entry_id": entry_id}, {"$set": {"lead_created": True}})

    return await db.bni_one_to_ones.find_one({"entry_id": entry_id}, {"_id": 0})
