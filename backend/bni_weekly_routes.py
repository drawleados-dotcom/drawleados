"""
BNI Weekly Meetings — Drawlead OS

Tracks the chapter's weekly meetings (every Friday, starting Week 1 on
31 Jul 2026) and, per meeting, each member's Give & Ask exchange. Weeks are
never added manually — every list fetch auto-creates any week up through
the current/next upcoming Friday, so the list always stays current on its
own as time passes.

Storage: collections `bni_weekly_meetings`, `bni_give_asks`.
"""
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, date, timedelta

bni_weekly_router = APIRouter(prefix="/bni/weekly-meetings", tags=["bni"])
bni_give_ask_router = APIRouter(prefix="/bni/give-ask", tags=["bni"])

# Week 1 anchor date — every subsequent week is +7 days from this Friday.
BASE_WEEK_DATE = date(2026, 7, 31)

GIVE_ASK_STATUSES = ["Contacted", "Not Related", "Asked the give"]
ATTENDED_BY_OPTIONS = ["vinoth", "substitute"]


def _target_week_number(today: date) -> int:
    """The current/next-upcoming week number — the smallest week whose
    Friday hasn't passed yet (today included)."""
    diff_days = (today - BASE_WEEK_DATE).days
    if diff_days <= 0:
        return 1
    return ((diff_days + 6) // 7) + 1


async def _ensure_weeks_up_to(db, target_week: int, user_id: str):
    existing = await db.bni_weekly_meetings.find({}, {"_id": 0, "week_number": 1}).to_list(2000)
    existing_numbers = {e["week_number"] for e in existing}
    missing = [n for n in range(1, target_week + 1) if n not in existing_numbers]
    if not missing:
        return
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for n in missing:
        meeting_date = BASE_WEEK_DATE + timedelta(weeks=n - 1)
        docs.append({
            "meeting_id": f"bniwk_{uuid.uuid4().hex[:10]}",
            "week_number": n,
            "meeting_date": meeting_date.isoformat(),
            "location": "",
            "attendance": {"time": "", "attended_by": "", "substitute_name": ""},
            "created_by": user_id,
            "created_at": now,
            "updated_at": now,
        })
    await db.bni_weekly_meetings.insert_many(docs)


class WeeklyMeetingUpdate(BaseModel):
    location: Optional[str] = None


class AttendanceUpdate(BaseModel):
    time: str = ""
    attended_by: str = ""  # vinoth | substitute
    substitute_name: str = ""


class GiveAskUpsert(BaseModel):
    meeting_id: str
    member_id: str
    give: str = ""
    ask: str = ""


class GiveAskUpdate(BaseModel):
    give: Optional[str] = None
    ask: Optional[str] = None
    give_status: Optional[str] = None
    ask_status: Optional[str] = None


# ---------- Weekly Meetings ----------

@bni_weekly_router.get("")
async def list_weekly_meetings(request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    target_week = _target_week_number(datetime.now(timezone.utc).date())
    await _ensure_weeks_up_to(db, target_week, user.user_id)
    return await db.bni_weekly_meetings.find({}, {"_id": 0}).sort("week_number", -1).to_list(500)


@bni_weekly_router.get("/{meeting_id}")
async def get_weekly_meeting(meeting_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    meeting = await db.bni_weekly_meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Weekly meeting not found")
    return meeting


@bni_weekly_router.put("/{meeting_id}")
async def update_weekly_meeting(meeting_id: str, payload: WeeklyMeetingUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    meeting = await db.bni_weekly_meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Weekly meeting not found")

    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.bni_weekly_meetings.update_one({"meeting_id": meeting_id}, {"$set": update_data})
    return await db.bni_weekly_meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})


@bni_weekly_router.put("/{meeting_id}/attendance")
async def update_attendance(meeting_id: str, payload: AttendanceUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    meeting = await db.bni_weekly_meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Weekly meeting not found")
    if payload.attended_by and payload.attended_by not in ATTENDED_BY_OPTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid attended_by: {payload.attended_by}")

    attendance = {
        "time": payload.time.strip(),
        "attended_by": payload.attended_by,
        "substitute_name": payload.substitute_name.strip() if payload.attended_by == "substitute" else "",
    }
    await db.bni_weekly_meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {"attendance": attendance, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return await db.bni_weekly_meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})


# ---------- Give & Ask ----------

@bni_give_ask_router.get("")
async def list_give_asks(request: Request, meeting_id: str = ""):
    from server import get_current_user, db
    await get_current_user(request)
    query = {"meeting_id": meeting_id} if meeting_id else {}
    return await db.bni_give_asks.find(query, {"_id": 0}).sort("created_at", -1).to_list(20000)


@bni_give_ask_router.post("")
async def upsert_give_ask(payload: GiveAskUpsert, request: Request):
    """One entry per (meeting, member) — re-adding for the same member in
    the same week updates the existing entry instead of duplicating it."""
    from server import get_current_user, db
    await get_current_user(request)

    meeting = await db.bni_weekly_meetings.find_one({"meeting_id": payload.meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Weekly meeting not found")
    member = await db.bni_members.find_one({"member_id": payload.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    existing = await db.bni_give_asks.find_one(
        {"meeting_id": payload.meeting_id, "member_id": payload.member_id}, {"_id": 0}
    )
    now = datetime.now(timezone.utc).isoformat()

    if existing:
        update_data = {
            "give": (payload.give or "").strip(),
            "ask": (payload.ask or "").strip(),
            "updated_at": now,
        }
        await db.bni_give_asks.update_one({"entry_id": existing["entry_id"]}, {"$set": update_data})
        return await db.bni_give_asks.find_one({"entry_id": existing["entry_id"]}, {"_id": 0})

    doc = {
        "entry_id": f"bniga_{uuid.uuid4().hex[:10]}",
        "meeting_id": payload.meeting_id,
        "week_number": meeting["week_number"],
        "meeting_date": meeting["meeting_date"],
        "member_id": payload.member_id,
        "member_name": member.get("name", ""),
        "give": (payload.give or "").strip(),
        "ask": (payload.ask or "").strip(),
        "give_status": "",
        "ask_status": "",
        "created_at": now,
        "updated_at": now,
    }
    await db.bni_give_asks.insert_one(doc)
    doc.pop("_id", None)
    return doc


@bni_give_ask_router.put("/{entry_id}")
async def update_give_ask(entry_id: str, payload: GiveAskUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    entry = await db.bni_give_asks.find_one({"entry_id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Give & Ask entry not found")

    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if "give_status" in update_data and update_data["give_status"] and update_data["give_status"] not in GIVE_ASK_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid give_status: {update_data['give_status']}")
    if "ask_status" in update_data and update_data["ask_status"] and update_data["ask_status"] not in GIVE_ASK_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid ask_status: {update_data['ask_status']}")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.bni_give_asks.update_one({"entry_id": entry_id}, {"$set": update_data})
    return await db.bni_give_asks.find_one({"entry_id": entry_id}, {"_id": 0})
