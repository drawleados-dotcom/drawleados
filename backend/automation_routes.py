"""
Automation Module — Drawlead OS

Phase 1: LinkedIn Partnership automation. Built as the first automation
inside a reusable framework: a Partner-style CRM (create/update/pipeline),
an AI Profile Analyzer, and an AI Message Generator. Every future
automation (Email Outreach, WhatsApp, AI Agents, ...) is expected to
follow this same shape — its own collection + stage list + AI helpers
mounted under this same `/automation` prefix.

LinkedIn actions themselves (connecting, sending, replying) are
intentionally NOT automated here — no bot logs into LinkedIn or clicks
anything. The AI drafts messages; a human reviews and sends them via
LinkedIn directly. This keeps the tool squarely on the right side of
LinkedIn's terms of use while still giving the team AI leverage.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage

automation_router = APIRouter(prefix="/automation", tags=["Automation"])
db = None

def init_automation_db(database):
    global db
    db = database

# ============== PIPELINE STAGES ==============

PARTNER_STAGES = [
    "New", "Analyzed", "Ready to Connect", "Invitation Sent", "Accepted",
    "Intro Sent", "Conversation", "Interested", "Call Scheduled",
    "Proposal", "Partner", "Lost",
]
# Stages counted as "reached" a milestone even if the partner has since
# moved further along — used for cumulative dashboard metrics.
_STAGE_INDEX = {name: i for i, name in enumerate(PARTNER_STAGES)}

AGENCY_TYPES = [
    "Marketing Agency", "Branding Agency", "SEO Agency",
    "Performance Marketing Agency", "Shopify Agency", "Software Company",
    "Business Consultant", "Founder", "Technology Partner",
]

MESSAGE_TYPES = {
    "connection_request": "a short, warm LinkedIn connection request note (under 300 characters, LinkedIn's limit)",
    "intro": "a first message after they've accepted the connection, introducing yourself and finding common ground",
    "follow_up": "a friendly follow-up message since there's been no reply yet — no pressure, add value",
    "meeting_request": "a message proposing a short call to explore a partnership, with a couple of time suggestions",
    "thank_you": "a thank-you message after a call or meeting, summarizing next steps warmly",
}

# ============== MODELS ==============

class PartnerCreate(BaseModel):
    name: str
    company: str = ""
    country: str = ""
    industry: str = ""
    linkedin_url: str = ""
    agency_type: str = ""
    status: str = "New"
    assigned_to: str = ""
    next_action: str = ""
    notes: str = ""
    deal_value: float = 0

class PartnerUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    country: Optional[str] = None
    industry: Optional[str] = None
    linkedin_url: Optional[str] = None
    agency_type: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    next_action: Optional[str] = None
    notes: Optional[str] = None
    deal_value: Optional[float] = None

class AnalyzeProfileRequest(BaseModel):
    profile_text: str  # pasted LinkedIn profile/About content — never scraped

class GenerateMessageRequest(BaseModel):
    message_type: str  # one of MESSAGE_TYPES keys
    extra_context: str = ""  # e.g. pasted conversation history for follow-ups

# ============== AUTH HELPER (mirrors ai_routes.py's local pattern) ==============

async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def _llm_chat(session_id: str, system_message: str) -> LlmChat:
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    return LlmChat(
        api_key=api_key, session_id=session_id, system_message=system_message
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

# ============== PARTNERS CRUD ==============

@automation_router.get("/linkedin-partnership/stages")
async def get_partner_stages(request: Request):
    await get_current_user(request)
    return PARTNER_STAGES

@automation_router.get("/linkedin-partnership/agency-types")
async def get_agency_types(request: Request):
    await get_current_user(request)
    return AGENCY_TYPES

@automation_router.get("/linkedin-partnership/partners")
async def list_partners(request: Request):
    await get_current_user(request)
    partners = await db.automation_partners.find(
        {"is_deleted": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    return partners

@automation_router.post("/linkedin-partnership/partners")
async def create_partner(payload: PartnerCreate, request: Request):
    user = await get_current_user(request)
    partner_id = f"ptnr_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    doc = {
        "partner_id": partner_id,
        **payload.dict(),
        "generated_messages": [],
        "activity_log": [{"action": "Partner created", "at": now.isoformat(), "by": user.get("name", "")}],
        "last_activity": now.isoformat(),
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    await db.automation_partners.insert_one(doc)
    doc.pop("_id", None)
    return doc

@automation_router.put("/linkedin-partnership/partners/{partner_id}")
async def update_partner(partner_id: str, payload: PartnerUpdate, request: Request):
    user = await get_current_user(request)
    partner = await db.automation_partners.find_one({"partner_id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    update_dict = {k: v for k, v in payload.dict().items() if v is not None}
    if update_dict.get("status") and update_dict["status"] not in PARTNER_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage: {update_dict['status']}")
    now = datetime.now(timezone.utc)
    update_dict["updated_at"] = now

    push_ops = {}
    if update_dict.get("status") and update_dict["status"] != partner.get("status"):
        update_dict["last_activity"] = now.isoformat()
        push_ops["activity_log"] = {
            "action": f"Moved to {update_dict['status']}", "at": now.isoformat(), "by": user.get("name", ""),
        }

    mongo_update = {"$set": update_dict}
    if push_ops:
        mongo_update["$push"] = push_ops

    await db.automation_partners.update_one({"partner_id": partner_id}, mongo_update)
    return await db.automation_partners.find_one({"partner_id": partner_id}, {"_id": 0})

@automation_router.delete("/linkedin-partnership/partners/{partner_id}")
async def delete_partner(partner_id: str, request: Request):
    await get_current_user(request)
    await db.automation_partners.update_one(
        {"partner_id": partner_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Partner deleted"}

# ============== DASHBOARD ==============

@automation_router.get("/linkedin-partnership/dashboard")
async def get_dashboard(request: Request):
    await get_current_user(request)
    partners = await db.automation_partners.find({"is_deleted": {"$ne": True}}, {"_id": 0}).to_list(5000)

    def reached(stage_name: str) -> int:
        threshold = _STAGE_INDEX[stage_name]
        return sum(1 for p in partners if _STAGE_INDEX.get(p.get("status"), 0) >= threshold)

    by_stage = {name: 0 for name in PARTNER_STAGES}
    for p in partners:
        s = p.get("status")
        if s in by_stage:
            by_stage[s] += 1

    invitations_sent = reached("Invitation Sent")
    accepted = reached("Accepted")
    interested = reached("Interested")
    calls_booked = reached("Call Scheduled")
    won = by_stage.get("Partner", 0)
    revenue = sum((p.get("deal_value") or 0) for p in partners if p.get("status") == "Partner")

    return {
        "total_partners": len(partners),
        "new_leads": by_stage.get("New", 0),
        "invitations_sent": invitations_sent,
        "accepted": accepted,
        "reply_rate": round((accepted and interested / accepted * 100) or 0, 1) if invitations_sent else 0,
        "interested": interested,
        "calls_booked": calls_booked,
        "partners_won": won,
        "revenue_generated": revenue,
        "by_stage": by_stage,
    }

# ============== AI PROFILE ANALYZER ==============

ANALYZER_SYSTEM_PROMPT = """You are an expert B2B partnership researcher for Drawlead, a digital agency.
Given a pasted LinkedIn profile (About section, headline, experience, etc.) for a potential AGENCY/BUSINESS PARTNER
(not a client), extract a structured analysis to help Drawlead build a genuine, long-term partnership with them —
never a sales pitch. Return ONLY valid JSON (no markdown fences, no commentary) with exactly these keys:
{
  "headline": "", "company": "", "about_summary": "", "industry": "", "location": "", "website": "",
  "agency_type": "one of: Marketing Agency, Branding Agency, SEO Agency, Performance Marketing Agency, Shopify Agency, Software Company, Business Consultant, Founder, Technology Partner, or Other",
  "business_summary": "2-3 sentences on what they do and who they serve",
  "target_customers": ["short phrase", "short phrase"],
  "pain_points": ["likely pain point", "likely pain point"],
  "ideal_partnership_angle": "1-2 sentences on how Drawlead and this person could genuinely help each other's clients",
  "ice_breakers": ["a specific, genuine observation about their work to open with", "another one"],
  "suggested_opening": "a warm, specific, non-salesy opening line referencing something concrete from their profile"
}
If information for a field isn't present in the text, use an empty string or empty list — never invent facts."""

def _parse_json_response(text: str) -> Dict[str, Any]:
    import json
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    try:
        return json.loads(cleaned.strip())
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned an unexpected format — please try again")

@automation_router.post("/linkedin-partnership/partners/{partner_id}/analyze")
async def analyze_partner_profile(partner_id: str, payload: AnalyzeProfileRequest, request: Request):
    user = await get_current_user(request)
    partner = await db.automation_partners.find_one({"partner_id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    if not payload.profile_text.strip():
        raise HTTPException(status_code=400, detail="profile_text is required")

    chat = _llm_chat(f"automation_analyze_{partner_id}_{uuid.uuid4().hex[:8]}", ANALYZER_SYSTEM_PROMPT)
    try:
        response = await chat.send_message(UserMessage(text=payload.profile_text))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {str(e)}")

    analysis = _parse_json_response(response)
    now = datetime.now(timezone.utc)

    update_dict = {
        "headline": analysis.get("headline", ""),
        "about": analysis.get("about_summary", ""),
        "location": analysis.get("location", ""),
        "website": analysis.get("website", ""),
        "business_summary": analysis.get("business_summary", ""),
        "target_customers": analysis.get("target_customers", []),
        "pain_points": analysis.get("pain_points", []),
        "ideal_partnership_angle": analysis.get("ideal_partnership_angle", ""),
        "ice_breakers": analysis.get("ice_breakers", []),
        "suggested_opening": analysis.get("suggested_opening", ""),
        "analyzed_at": now,
        "updated_at": now,
        "last_activity": now.isoformat(),
    }
    if analysis.get("company") and not partner.get("company"):
        update_dict["company"] = analysis["company"]
    if analysis.get("industry") and not partner.get("industry"):
        update_dict["industry"] = analysis["industry"]
    if analysis.get("agency_type") and not partner.get("agency_type"):
        update_dict["agency_type"] = analysis["agency_type"]
    if partner.get("status") == "New":
        update_dict["status"] = "Analyzed"

    await db.automation_partners.update_one(
        {"partner_id": partner_id},
        {
            "$set": update_dict,
            "$push": {"activity_log": {"action": "AI profile analyzed", "at": now.isoformat(), "by": user.get("name", "")}},
        },
    )
    return await db.automation_partners.find_one({"partner_id": partner_id}, {"_id": 0})

# ============== AI MESSAGE GENERATOR ==============

MESSAGE_SYSTEM_PROMPT = """You are writing LinkedIn outreach messages on behalf of a person at Drawlead, a digital agency,
to a potential AGENCY/BUSINESS PARTNER — never a sales prospect. The goal is building a genuine, long-term partnership,
not closing a deal. Rules, no exceptions:
- Never sound like a sales pitch, never mention pricing or "our services" as a pitch.
- Always build trust first — be specific, reference something real about them, be human.
- Keep it short. LinkedIn connection notes must be under 300 characters.
- No generic templates like "I came across your profile and would love to connect" — always personalize.
- Sign off naturally, no corporate boilerplate.
Return ONLY the message text — no quotes, no markdown, no explanation."""

@automation_router.post("/linkedin-partnership/partners/{partner_id}/generate-message")
async def generate_message(partner_id: str, payload: GenerateMessageRequest, request: Request):
    user = await get_current_user(request)
    partner = await db.automation_partners.find_one({"partner_id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    if payload.message_type not in MESSAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid message_type. Must be one of: {', '.join(MESSAGE_TYPES.keys())}")

    prior_messages = partner.get("generated_messages") or []
    history_lines = [f"- ({m.get('message_type')}): {m.get('text')}" for m in prior_messages[-5:]]

    prompt = f"""Write {MESSAGE_TYPES[payload.message_type]}.

PARTNER:
- Name: {partner.get('name', '')}
- Company: {partner.get('company', '')}
- Industry: {partner.get('industry', '')}
- Agency Type: {partner.get('agency_type', '')}
- Business Summary: {partner.get('business_summary', '')}
- Ideal Partnership Angle: {partner.get('ideal_partnership_angle', '')}
- Suggested Opening (from profile analysis, use as inspiration): {partner.get('suggested_opening', '')}

PRIOR MESSAGES SENT (don't repeat these):
{chr(10).join(history_lines) if history_lines else '(none yet)'}

ADDITIONAL CONTEXT (e.g. their reply, conversation so far):
{payload.extra_context or '(none)'}"""

    chat = _llm_chat(f"automation_msg_{partner_id}_{uuid.uuid4().hex[:8]}", MESSAGE_SYSTEM_PROMPT)
    try:
        text = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Message generation failed: {str(e)}")

    now = datetime.now(timezone.utc)
    entry = {
        "message_id": f"msg_{uuid.uuid4().hex[:10]}",
        "message_type": payload.message_type,
        "text": text.strip(),
        "created_by": user["user_id"],
        "created_at": now.isoformat(),
    }
    await db.automation_partners.update_one(
        {"partner_id": partner_id},
        {
            "$push": {
                "generated_messages": entry,
                "activity_log": {"action": f"Generated {payload.message_type} message", "at": now.isoformat(), "by": user.get("name", "")},
            },
            "$set": {"updated_at": now, "last_activity": now.isoformat()},
        },
    )
    return entry
