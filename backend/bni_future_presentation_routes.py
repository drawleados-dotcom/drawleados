"""
BNI Future Presentations — Drawlead OS

Logged from a weekly meeting's "Future Presentation" tab: a member
announces they'll give a fuller presentation later, with a Drive link once
ready, a summary, and running lists of asks / clients they want raised.
Multiple presentations can be logged per week.

Storage: collection `bni_future_presentations`.
"""
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

bni_future_presentation_router = APIRouter(prefix="/bni/future-presentations", tags=["bni"])


class FuturePresentationSave(BaseModel):
    meeting_id: str
    member_id: str
    presentation_link: str = ""
    summary: str = ""
    asks: List[str] = []
    clients: List[str] = []


@bni_future_presentation_router.get("")
async def list_future_presentations(request: Request, meeting_id: str = ""):
    from server import get_current_user, db
    await get_current_user(request)
    query = {"meeting_id": meeting_id} if meeting_id else {}
    return await db.bni_future_presentations.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)


@bni_future_presentation_router.get("/{presentation_id}")
async def get_future_presentation(presentation_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    entry = await db.bni_future_presentations.find_one({"presentation_id": presentation_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Future Presentation not found")
    return entry


@bni_future_presentation_router.post("")
async def create_future_presentation(payload: FuturePresentationSave, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)

    meeting = await db.bni_weekly_meetings.find_one({"meeting_id": payload.meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Weekly meeting not found")
    member = await db.bni_members.find_one({"member_id": payload.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "presentation_id": f"bnifp_{uuid.uuid4().hex[:10]}",
        "meeting_id": payload.meeting_id,
        "week_number": meeting["week_number"],
        "meeting_date": meeting["meeting_date"],
        "member_id": payload.member_id,
        "member_name": member.get("name", ""),
        "category_name": member.get("category_name", ""),
        "business_name": member.get("business_name", ""),
        "presentation_link": payload.presentation_link.strip(),
        "summary": payload.summary.strip(),
        "asks": [a.strip() for a in payload.asks if a.strip()],
        "clients": [c.strip() for c in payload.clients if c.strip()],
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.bni_future_presentations.insert_one(doc)
    doc.pop("_id", None)
    return doc


@bni_future_presentation_router.put("/{presentation_id}")
async def update_future_presentation(presentation_id: str, payload: FuturePresentationSave, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    entry = await db.bni_future_presentations.find_one({"presentation_id": presentation_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Future Presentation not found")

    member = await db.bni_members.find_one({"member_id": payload.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    update_data = {
        "member_id": payload.member_id,
        "member_name": member.get("name", ""),
        "category_name": member.get("category_name", ""),
        "business_name": member.get("business_name", ""),
        "presentation_link": payload.presentation_link.strip(),
        "summary": payload.summary.strip(),
        "asks": [a.strip() for a in payload.asks if a.strip()],
        "clients": [c.strip() for c in payload.clients if c.strip()],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bni_future_presentations.update_one({"presentation_id": presentation_id}, {"$set": update_data})
    return await db.bni_future_presentations.find_one({"presentation_id": presentation_id}, {"_id": 0})


@bni_future_presentation_router.delete("/{presentation_id}")
async def delete_future_presentation(presentation_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    result = await db.bni_future_presentations.delete_one({"presentation_id": presentation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Future Presentation not found")
    return {"message": "Future Presentation deleted"}
