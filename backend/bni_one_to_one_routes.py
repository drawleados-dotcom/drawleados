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
# Meeting lifecycle status — separate from the relationship-outcome status
# above (which is only set from the Remarks popup once a One-to-One has
# actually happened).
MEETING_STATUSES = ["To do", "Scheduled", "Completed"]
MEETING_MODES = ["offline", "online"]


class OneToOneCreate(BaseModel):
    entry_type: str = "chapter"  # chapter | cross_chapter
    member_id: str
    meeting_date: str
    meeting_time: str = ""
    location: str = ""
    invited_by: str = "me"  # me | member
    meeting_mode: str = "offline"  # offline | online


class OneToOneEdit(BaseModel):
    member_id: Optional[str] = None
    meeting_date: Optional[str] = None
    meeting_time: Optional[str] = None
    location: Optional[str] = None
    invited_by: Optional[str] = None
    meeting_mode: Optional[str] = None


class OneToOneReschedule(BaseModel):
    meeting_date: Optional[str] = None
    meeting_time: Optional[str] = None
    location: Optional[str] = None


class OneToOneRemarksUpdate(BaseModel):
    remark: Optional[str] = None
    gives: Optional[List[str]] = None
    referrals: Optional[List[str]] = None
    status: Optional[str] = None


class MeetingStatusUpdate(BaseModel):
    meeting_status: str


class OneToOneExpenseCreate(BaseModel):
    gst_type: str  # gst | non_gst — which cashbook this posts to
    amount: float
    date: str = ""
    payment_mode: str = "cash"  # cash | cheque | bank | upi
    bank_id: Optional[str] = None
    notes: str = ""


async def _ensure_one_to_one_category(db):
    """Resolve (creating if needed) the "One to Ones" Expense Split
    sub-category that sits under the chapter's "BNI" bucket, so a One-to-One
    expense is tagged consistently and rolls up under the same budget.
    Returns (split_category_id, split_top_category_id) — both None when no
    "BNI" split category has been set up yet (expense is still recorded, just
    untagged)."""
    bni_cat = await db.expense_split_categories.find_one(
        {"name": {"$regex": "^bni$", "$options": "i"}, "parent_id": {"$ne": None}, "is_deleted": {"$ne": True}},
        {"_id": 0, "category_id": 1, "parent_id": 1},
    )
    if not bni_cat:
        return None, None
    top_id = bni_cat.get("parent_id") or bni_cat["category_id"]
    oto_cat = await db.expense_split_categories.find_one(
        {"name": {"$regex": "^one ?to ?ones?$", "$options": "i"}, "parent_id": bni_cat["category_id"], "is_deleted": {"$ne": True}},
        {"_id": 0, "category_id": 1},
    )
    if oto_cat:
        return oto_cat["category_id"], top_id
    siblings = await db.expense_split_categories.find(
        {"parent_id": bni_cat["category_id"], "is_deleted": {"$ne": True}},
    ).sort("order", -1).to_list(1)
    next_order = (siblings[0].get("order", -1) + 1) if siblings else 0
    new_id = f"esc_{uuid.uuid4().hex[:10]}"
    await db.expense_split_categories.insert_one({
        "category_id": new_id,
        "name": "One to Ones",
        "percent": 0,
        "parent_id": bni_cat["category_id"],
        "color": "#6366f1",
        "order": next_order,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc),
    })
    return new_id, top_id


@bni_one_to_one_router.get("")
async def list_one_to_ones(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    return await db.bni_one_to_ones.find({}, {"_id": 0}).sort("meeting_date", -1).to_list(5000)


@bni_one_to_one_router.get("/expenses")
async def list_one_to_one_expenses(request: Request):
    """Cashbook debit entries created from a One-to-One (the "One-to-One
    Payment History" sub-view) plus an all-time total."""
    from server import get_current_user, db
    await get_current_user(request)
    entries = await db.cashbook_entries.find(
        {"bni_one_to_one_id": {"$nin": [None, ""]}}, {"_id": 0},
    ).sort("date", -1).to_list(2000)
    for e in entries:
        if isinstance(e.get("created_at"), datetime):
            e["created_at"] = e["created_at"].isoformat()
    total = sum(float(e.get("amount") or 0) for e in entries)
    return {"entries": entries, "summary": {"total_amount": round(total, 2), "count": len(entries)}}


@bni_one_to_one_router.post("/{entry_id}/expense")
async def log_one_to_one_expense(entry_id: str, payload: OneToOneExpenseCreate, request: Request):
    """Record a real Cashbook debit for an Offline One-to-One (e.g. coffee/
    lunch cost). Deducts from the chosen GST / Non-GST cashbook and tags the
    entry under "BNI > One to Ones" so it appears in Payment History."""
    from server import get_current_user, db
    user = await get_current_user(request)
    entry = await db.bni_one_to_ones.find_one({"entry_id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="One-to-One not found")
    if entry.get("meeting_mode", "offline") != "offline":
        raise HTTPException(status_code=400, detail="Expenses can only be logged for Offline One-to-Ones")
    if entry.get("expense_entry_id"):
        raise HTTPException(status_code=400, detail="An expense has already been logged for this One-to-One")
    if payload.gst_type not in ("gst", "non_gst"):
        raise HTTPException(status_code=400, detail="gst_type must be 'gst' or 'non_gst'")
    if not payload.amount or payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be > 0")

    bank_label = None
    bank_id = None
    if payload.payment_mode == "bank":
        if not payload.bank_id:
            raise HTTPException(status_code=400, detail="Select a bank when payment mode is 'bank'")
        bank_doc = await db.finance_banks.find_one({"bank_id": payload.bank_id, "is_deleted": {"$ne": True}}, {"_id": 0})
        if not bank_doc:
            raise HTTPException(status_code=400, detail="Bank not found")
        if (bank_doc.get("gst_type") or "").lower() != payload.gst_type:
            raise HTTPException(status_code=400, detail=f"Selected bank is not a {payload.gst_type.upper()} bank")
        bank_id = payload.bank_id
        bank_label = bank_doc.get("account_holder") or bank_doc.get("bank_name")

    split_category_id, split_top_category_id = await _ensure_one_to_one_category(db)

    now = datetime.now(timezone.utc)
    cashbook_entry = {
        "entry_id": f"cb_{uuid.uuid4().hex[:12]}",
        "kind": "debit",
        "gst_type": payload.gst_type,
        "amount": float(payload.amount),
        "date": payload.date or entry.get("meeting_date") or now.date().isoformat(),
        "payment_mode": payload.payment_mode,
        "bank_id": bank_id,
        "bank_label": bank_label,
        "to": entry.get("member_name", ""),
        "category": "One to Ones",
        "category_label": "One to Ones",
        "notes": (payload.notes or "").strip(),
        "split_category_id": split_category_id,
        "split_top_category_id": split_top_category_id,
        "bni_one_to_one_id": entry_id,
        "revenue_kind": None,
        "created_by": user.user_id,
        "created_at": now,
    }
    await db.cashbook_entries.insert_one(cashbook_entry)
    await db.bni_one_to_ones.update_one(
        {"entry_id": entry_id},
        {"$set": {"expense_entry_id": cashbook_entry["entry_id"], "expense_amount": float(payload.amount), "updated_at": now.isoformat()}},
    )
    cashbook_entry.pop("_id", None)
    cashbook_entry["created_at"] = cashbook_entry["created_at"].isoformat()
    return cashbook_entry


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
        "meeting_mode": payload.meeting_mode if payload.meeting_mode in MEETING_MODES else "offline",
        "remark": "",
        "gives": [],
        "referrals": [],
        "status": "",
        "meeting_status": "Scheduled",
        "expense_entry_id": "",
        "expense_amount": 0,
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
    if "meeting_mode" in update_data and update_data["meeting_mode"] not in MEETING_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid meeting mode: {update_data['meeting_mode']}")
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


@bni_one_to_one_router.put("/{entry_id}/meeting-status")
async def update_meeting_status(entry_id: str, payload: MeetingStatusUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    if payload.meeting_status not in MEETING_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid meeting status: {payload.meeting_status}")
    entry = await db.bni_one_to_ones.find_one({"entry_id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="One-to-One not found")

    await db.bni_one_to_ones.update_one(
        {"entry_id": entry_id},
        {"$set": {"meeting_status": payload.meeting_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
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
