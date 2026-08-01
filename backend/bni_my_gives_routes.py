"""
BNI My Gives — Drawlead OS

A "give" is a business opportunity (a person/company) the chapter admin has
sourced, independent of any one member at first. It can be:
  - assigned to a weekly meeting, to be announced as that week's "Give of
    the Week" during Weekly Presentation, and
  - distributed to one or more BNI members (a give can go to many members),
    each tracked with a reason, date, how it was shared, and a status.

Storage: collections `bni_my_gives`, `bni_give_recipients`.
"""
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

bni_my_gives_router = APIRouter(prefix="/bni/my-gives", tags=["bni"])
bni_give_recipients_router = APIRouter(prefix="/bni/give-recipients", tags=["bni"])

SHARED_VIA_OPTIONS = ["Contact Shared", "Meeting Arranged"]
RECIPIENT_STATUSES = ["Shared", "Contacted", "Not Converted", "Not Contacted"]


class MyGiveCreate(BaseModel):
    business_person_name: str
    company_name: str = ""
    industry: str = ""


class MyGiveUpdate(BaseModel):
    business_person_name: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None


class AssignWeek(BaseModel):
    meeting_id: str


class GiveRecipientCreate(BaseModel):
    give_id: str
    member_id: str
    reason: str = ""
    give_date: str = ""
    shared_via: str = ""


class GiveRecipientUpdate(BaseModel):
    reason: Optional[str] = None
    give_date: Optional[str] = None
    shared_via: Optional[str] = None
    status: Optional[str] = None


async def _with_recipient_counts(db, gives):
    if not gives:
        return gives
    give_ids = [g["give_id"] for g in gives]
    counts = {}
    async for r in db.bni_give_recipients.find({"give_id": {"$in": give_ids}}, {"_id": 0, "give_id": 1}):
        counts[r["give_id"]] = counts.get(r["give_id"], 0) + 1
    for g in gives:
        g["recipient_count"] = counts.get(g["give_id"], 0)
    return gives


# ---------- My Gives ----------

@bni_my_gives_router.get("")
async def list_my_gives(request: Request, meeting_id: str = ""):
    from server import get_current_user, db
    await get_current_user(request)
    query = {"assigned_meeting_id": meeting_id} if meeting_id else {}
    gives = await db.bni_my_gives.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return await _with_recipient_counts(db, gives)


@bni_my_gives_router.get("/{give_id}")
async def get_my_give(give_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    give = await db.bni_my_gives.find_one({"give_id": give_id}, {"_id": 0})
    if not give:
        raise HTTPException(status_code=404, detail="Give not found")
    return give


@bni_my_gives_router.post("")
async def create_my_give(payload: MyGiveCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if not payload.business_person_name.strip():
        raise HTTPException(status_code=400, detail="Business Person Name is required")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "give_id": f"bnimg_{uuid.uuid4().hex[:10]}",
        "business_person_name": payload.business_person_name.strip(),
        "company_name": payload.company_name.strip(),
        "industry": payload.industry.strip(),
        "assigned_week_number": None,
        "assigned_meeting_id": "",
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.bni_my_gives.insert_one(doc)
    doc.pop("_id", None)
    return doc


@bni_my_gives_router.put("/{give_id}")
async def update_my_give(give_id: str, payload: MyGiveUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    give = await db.bni_my_gives.find_one({"give_id": give_id}, {"_id": 0})
    if not give:
        raise HTTPException(status_code=404, detail="Give not found")

    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.bni_my_gives.update_one({"give_id": give_id}, {"$set": update_data})
    return await db.bni_my_gives.find_one({"give_id": give_id}, {"_id": 0})


@bni_my_gives_router.put("/{give_id}/assign-week")
async def assign_my_give_week(give_id: str, payload: AssignWeek, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    give = await db.bni_my_gives.find_one({"give_id": give_id}, {"_id": 0})
    if not give:
        raise HTTPException(status_code=404, detail="Give not found")
    meeting = await db.bni_weekly_meetings.find_one({"meeting_id": payload.meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Weekly meeting not found")

    update_data = {
        "assigned_meeting_id": payload.meeting_id,
        "assigned_week_number": meeting["week_number"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bni_my_gives.update_one({"give_id": give_id}, {"$set": update_data})
    return await db.bni_my_gives.find_one({"give_id": give_id}, {"_id": 0})


@bni_my_gives_router.delete("/{give_id}")
async def delete_my_give(give_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    result = await db.bni_my_gives.delete_one({"give_id": give_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Give not found")
    await db.bni_give_recipients.delete_many({"give_id": give_id})
    return {"message": "Give deleted"}


# ---------- Give Recipients (one give -> many members) ----------

@bni_give_recipients_router.get("")
async def list_give_recipients(request: Request, give_id: str = ""):
    from server import get_current_user, db
    await get_current_user(request)
    query = {"give_id": give_id} if give_id else {}
    return await db.bni_give_recipients.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)


@bni_give_recipients_router.post("")
async def create_give_recipient(payload: GiveRecipientCreate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)

    give = await db.bni_my_gives.find_one({"give_id": payload.give_id}, {"_id": 0})
    if not give:
        raise HTTPException(status_code=404, detail="Give not found")
    member = await db.bni_members.find_one({"member_id": payload.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if payload.shared_via and payload.shared_via not in SHARED_VIA_OPTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid shared_via: {payload.shared_via}")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "recipient_id": f"bnigr_{uuid.uuid4().hex[:10]}",
        "give_id": payload.give_id,
        "member_id": payload.member_id,
        "member_name": member.get("name", ""),
        "reason": payload.reason.strip(),
        "give_date": payload.give_date,
        "shared_via": payload.shared_via,
        "status": "Shared",
        "created_at": now,
        "updated_at": now,
    }
    await db.bni_give_recipients.insert_one(doc)
    doc.pop("_id", None)
    return doc


@bni_give_recipients_router.put("/{recipient_id}")
async def update_give_recipient(recipient_id: str, payload: GiveRecipientUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    entry = await db.bni_give_recipients.find_one({"recipient_id": recipient_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Recipient not found")

    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if update_data.get("status") and update_data["status"] not in RECIPIENT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {update_data['status']}")
    if update_data.get("shared_via") and update_data["shared_via"] not in SHARED_VIA_OPTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid shared_via: {update_data['shared_via']}")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.bni_give_recipients.update_one({"recipient_id": recipient_id}, {"$set": update_data})
    return await db.bni_give_recipients.find_one({"recipient_id": recipient_id}, {"_id": 0})


@bni_give_recipients_router.delete("/{recipient_id}")
async def delete_give_recipient(recipient_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    result = await db.bni_give_recipients.delete_one({"recipient_id": recipient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipient not found")
    return {"message": "Recipient deleted"}
