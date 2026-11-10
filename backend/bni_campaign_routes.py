"""
BNI Outreach — WhatsApp Campaigns (Meta WhatsApp Cloud API)

Sends approved WhatsApp template messages to BNI Outreach members picked by
business category, tracks delivery/read receipts and replies through Meta's
webhook, and reports response + one-to-one conversion per campaign and per
category.

Meta only lets a business START a conversation with a pre-approved template;
free-text messages are allowed only within 24 hours of the member's last
message. So campaigns always send a template (with {{1}}, {{2}}… filled from
each member's record), and the Inbox reply box only works inside that window.

Collections:
  wa_settings              one doc {"key": "default"} — Cloud API credentials
  bni_wa_templates         synced copy of the WABA's message templates
  bni_campaigns            a campaign: template + variable mapping + audience
  bni_campaign_recipients  one row per (campaign, outreach member)
  bni_wa_messages          every inbound/outbound WhatsApp message (inbox)

Credentials can also come from env vars (WHATSAPP_ACCESS_TOKEN,
WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_WABA_ID, WHATSAPP_VERIFY_TOKEN,
WHATSAPP_APP_SECRET); a value saved from the Setup screen wins.
"""
import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from bni_outreach_routes import _guess_location_type, _sync_cross_chapter_oto

logger = logging.getLogger(__name__)

bni_campaign_router = APIRouter(prefix="/bni/campaigns", tags=["bni"])

DEFAULT_API_VERSION = "v21.0"
SEND_INTERVAL_SECONDS = 1.0       # gap between sends — gentle on number quality
RUNNER_LEASE_SECONDS = 60         # a runner whose heartbeat is older is presumed dead
REPLY_WINDOW_HOURS = 24

# Values a template variable can be filled from — keys of a bni_outreach row,
# plus "custom" (same fixed text for everyone).
VARIABLE_SOURCES = ["name", "brand_name", "category_name", "chapter_name", "location", "custom"]
# Friendly tokens accepted when writing a new template in the OS.
TOKEN_SOURCES = {
    "name": "name", "member": "name", "member_name": "name",
    "company": "brand_name", "brand": "brand_name", "brand_name": "brand_name",
    "category": "category_name", "chapter": "chapter_name", "location": "location",
}
SAMPLE_VALUES = {
    "name": "Hitesh", "brand_name": "Hitesh Electrical", "category_name": "Electrical Contractor",
    "chapter_name": "Gazelles", "location": "Dubai", "custom": "sample",
}

# Strong references to running sender tasks (asyncio only keeps weak ones).
_TASKS = set()

RESPONSE_STATUSES = ["Pending", "Replied", "Interested", "Not Interested", "Scheduled One to One", "One to One Completed"]
_RESPONSE_RANK = {"Pending": 0, "Replied": 1, "Interested": 2, "Not Interested": 2, "Scheduled One to One": 3, "One to One Completed": 4}
_SEND_RANK = {"queued": 0, "sending": 0, "failed": 0, "sent": 1, "delivered": 2, "read": 3}
OPT_OUT_WORDS = {"stop", "unsubscribe", "stop messages", "remove me"}

# Meta error codes worth explaining in plain words.
_META_ERRORS = {
    131026: "Not deliverable — the number may not be on WhatsApp.",
    131047: "More than 24 hours since the member's last message — send a template instead.",
    131049: "Meta held this marketing message back (per-user marketing limit). Try again in a few days.",
    132001: "Template not found for this language — sync templates and check it's approved.",
    132000: "Template variable count doesn't match.",
    131056: "Too many messages to this number in a short time.",
    190: "Access token expired or invalid — update it in Setup.",
    100: "Invalid parameter — check Phone Number ID / WABA ID in Setup.",
}


# ============================ pure helpers (unit-tested) ============================

def normalize_phone(raw: str, country_code: str = "") -> str:
    """Turn a free-text phone into WhatsApp's digits-only international form.
    A leading + or 00 means the number already carries its country code; a
    leading 0 or a short (<=10 digit) number gets `country_code` prepended.
    Returns "" when the result can't be a real number."""
    raw = (raw or "").strip()
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    cc = re.sub(r"\D", "", country_code or "")
    if raw.startswith("+"):
        pass
    elif digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = cc + digits.lstrip("0") if cc else ""
    elif len(digits) <= 10:
        digits = cc + digits if cc else ""
    return digits if 8 <= len(digits) <= 15 else ""


def convert_tokens(body: str):
    """Rewrite friendly {{name}}/{{company}}/… tokens into Meta's positional
    {{1}}, {{2}}… (in order of first appearance). Returns (text, variable_map)
    where variable_map[i] is the outreach field that fills {{i+1}}. Raises
    ValueError on an unknown token."""
    var_map: List[str] = []

    def repl(m):
        token = m.group(1).strip().lower().replace(" ", "_")
        if token.isdigit():
            raise ValueError("Use named tokens like {{name}} instead of {{1}}")
        source = TOKEN_SOURCES.get(token)
        if not source:
            raise ValueError(f"Unknown token {{{{{m.group(1)}}}}} — use {{{{name}}}}, {{{{company}}}}, {{{{category}}}}, {{{{chapter}}}} or {{{{location}}}}")
        if source not in var_map:
            var_map.append(source)
        return "{{" + str(var_map.index(source) + 1) + "}}"

    return re.sub(r"\{\{\s*([^}]+?)\s*\}\}", repl, body or ""), var_map


def count_variables(text: str) -> int:
    nums = [int(n) for n in re.findall(r"\{\{\s*(\d+)\s*\}\}", text or "")]
    return max(nums) if nums else 0


def variable_values(entry: dict, variables: list) -> List[str]:
    """The text for each template variable for one member. Meta rejects empty
    parameters, so blanks fall back to the variable's fallback (or "there")."""
    out = []
    for v in variables:
        src = v.get("source") or "custom"
        val = (v.get("value") or "") if src == "custom" else (entry.get(src) or "")
        val = " ".join(str(val).split())
        out.append(val or (v.get("fallback") or "").strip() or "there")
    return out


def render_body(body: str, values: List[str]) -> str:
    def repl(m):
        i = int(m.group(1)) - 1
        return values[i] if 0 <= i < len(values) else m.group(0)
    return re.sub(r"\{\{\s*(\d+)\s*\}\}", repl, body or "")


def effective_response(recipient_status: str, outreach_status: str) -> str:
    """A recipient's response status, advanced by what's since happened on the
    outreach row itself (someone may mark the one-to-one in the Outreach tab
    or the BNI module instead of here)."""
    current = recipient_status or "Pending"
    mapped = {
        "Scheduled One to One": "Scheduled One to One",
        "One to One Completed": "One to One Completed",
        "Not Interested": "Not Interested",
    }.get(outreach_status or "")
    if not mapped:
        return current
    if mapped == "Not Interested":
        return mapped if current in ("Pending", "Replied", "Interested") else current
    return mapped if _RESPONSE_RANK[mapped] > _RESPONSE_RANK.get(current, 0) else current


def inbound_text(msg: dict) -> str:
    """Readable text for any inbound webhook message type."""
    t = msg.get("type")
    if t == "text":
        return (msg.get("text") or {}).get("body", "")
    if t == "button":
        return (msg.get("button") or {}).get("text", "")
    if t == "interactive":
        inter = msg.get("interactive") or {}
        return (inter.get("button_reply") or inter.get("list_reply") or {}).get("title", "")
    if t in ("image", "video", "document", "audio", "sticker"):
        caption = (msg.get(t) or {}).get("caption", "")
        return f"[{t}] {caption}".strip()
    if t == "location":
        return "[location]"
    if t == "reaction":
        return f"[reaction {(msg.get('reaction') or {}).get('emoji', '')}]".strip()
    return f"[{t or 'message'}]"


def classify_reply(text: str, is_button: bool) -> Optional[str]:
    """Response status implied by a reply. Quick-reply buttons are explicit;
    free text only maps opt-outs — everything else is just "Replied" and is
    left for a human to judge."""
    t = " ".join((text or "").lower().split())
    if t in OPT_OUT_WORDS:
        return "Not Interested"
    if is_button:
        if re.search(r"\b(not|no|later|busy)\b", t):
            return "Not Interested"
        if re.search(r"\b(interested|yes|sure|meet|call|ok)\b", t):
            return "Interested"
    return None


def verify_signature(app_secret: str, body: bytes, header: str) -> bool:
    if not app_secret:
        return True
    expected = "sha256=" + hmac.new(app_secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header or "")


def _meta_error(resp_json: dict) -> str:
    err = (resp_json or {}).get("error") or {}
    code = err.get("code")
    details = (err.get("error_data") or {}).get("details") or ""
    friendly = _META_ERRORS.get(code)
    base = friendly or err.get("message") or "Unknown error from Meta"
    return f"{base} (code {code}){' — ' + details if details and not friendly else ''}" if code else base


def _now():
    return datetime.now(timezone.utc)


def _iso(dt=None):
    # Fixed microsecond precision so these strings sort correctly against
    # Meta's whole-second webhook timestamps (see _ts).
    return (dt or _now()).isoformat(timespec="microseconds")


# ============================ settings ============================

async def _get_settings(db) -> dict:
    doc = await db.wa_settings.find_one({"key": "default"}, {"_id": 0}) or {}
    env = {
        "access_token": os.environ.get("WHATSAPP_ACCESS_TOKEN", ""),
        "phone_number_id": os.environ.get("WHATSAPP_PHONE_NUMBER_ID", ""),
        "waba_id": os.environ.get("WHATSAPP_WABA_ID", ""),
        "verify_token": os.environ.get("WHATSAPP_VERIFY_TOKEN", ""),
        "app_secret": os.environ.get("WHATSAPP_APP_SECRET", ""),
    }
    s = {k: doc.get(k) or v for k, v in env.items()}
    s["api_version"] = doc.get("api_version") or DEFAULT_API_VERSION
    s["local_country_code"] = doc.get("local_country_code") or "91"
    s["international_country_code"] = doc.get("international_country_code") or "971"
    s["daily_send_cap"] = int(doc.get("daily_send_cap") or 250)
    return s


def _require_configured(s: dict, need_waba: bool = False):
    missing = [k for k in (["access_token", "phone_number_id"] + (["waba_id"] if need_waba else [])) if not s.get(k)]
    if missing:
        raise HTTPException(status_code=400, detail="WhatsApp isn't connected yet — fill " + ", ".join(missing) + " in Campaigns → Setup.")


def _graph(s: dict, path: str) -> str:
    return f"https://graph.facebook.com/{s['api_version']}/{path.lstrip('/')}"


def _auth(s: dict) -> dict:
    return {"Authorization": f"Bearer {s['access_token']}"}


def _mask(token: str) -> str:
    return f"{token[:6]}…{token[-4:]}" if len(token or "") > 12 else ("set" if token else "")


def _phone_for(entry: dict, s: dict) -> str:
    loc_type = entry.get("location_type") or _guess_location_type(entry.get("location", ""))
    cc = s["international_country_code"] if loc_type == "international" else s["local_country_code"]
    for field in ("phone", "phone2"):
        p = normalize_phone(entry.get(field, ""), cc)
        if p:
            return p
    return ""


class SettingsUpdate(BaseModel):
    access_token: Optional[str] = None   # blank / omitted = keep the saved one
    phone_number_id: Optional[str] = None
    waba_id: Optional[str] = None
    verify_token: Optional[str] = None
    app_secret: Optional[str] = None     # blank / omitted = keep the saved one
    api_version: Optional[str] = None
    local_country_code: Optional[str] = None
    international_country_code: Optional[str] = None
    daily_send_cap: Optional[int] = None


def _public_settings(s: dict) -> dict:
    return {
        "configured": bool(s.get("access_token") and s.get("phone_number_id")),
        "phone_number_id": s.get("phone_number_id", ""),
        "waba_id": s.get("waba_id", ""),
        "access_token_masked": _mask(s.get("access_token", "")),
        "verify_token": s.get("verify_token", ""),
        "app_secret_set": bool(s.get("app_secret")),
        "api_version": s["api_version"],
        "local_country_code": s["local_country_code"],
        "international_country_code": s["international_country_code"],
        "daily_send_cap": s["daily_send_cap"],
        "webhook_path": "/api/bni/campaigns/webhook",
    }


@bni_campaign_router.get("/settings")
async def get_settings(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    return _public_settings(await _get_settings(db))


@bni_campaign_router.put("/settings")
async def update_settings(payload: SettingsUpdate, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    data = {}
    for k, v in payload.dict().items():
        if v is None:
            continue
        if isinstance(v, str):
            v = v.strip()
            if k in ("access_token", "app_secret") and not v:
                continue
        data[k] = v
    if "daily_send_cap" in data and data["daily_send_cap"] < 1:
        raise HTTPException(status_code=400, detail="Daily send cap must be at least 1")
    if not data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    data["updated_at"] = _iso()
    await db.wa_settings.update_one({"key": "default"}, {"$set": data}, upsert=True)
    return _public_settings(await _get_settings(db))


@bni_campaign_router.post("/settings/test")
async def test_settings(request: Request):
    """Ask Meta about the configured number — proves the token + Phone Number
    ID work and shows the number's quality rating and messaging tier."""
    from server import get_current_user, db
    await get_current_user(request)
    s = await _get_settings(db)
    _require_configured(s)
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(
            _graph(s, s["phone_number_id"]),
            params={"fields": "display_phone_number,verified_name,quality_rating,messaging_limit_tier,code_verification_status"},
            headers=_auth(s),
        )
    data = resp.json() if resp.content else {}
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail=_meta_error(data))
    return data


# ============================ templates ============================

def _parse_template(t: dict) -> dict:
    body, header, footer, buttons = "", None, "", []
    supported, reason = True, ""
    for c in t.get("components") or []:
        ctype = (c.get("type") or "").upper()
        if ctype == "BODY":
            body = c.get("text", "")
        elif ctype == "HEADER":
            header = {"format": c.get("format"), "text": c.get("text", "")}
            if c.get("format") != "TEXT":
                supported, reason = False, f"{c.get('format', '').lower()} headers aren't supported for campaigns yet"
            elif count_variables(c.get("text", "")):
                supported, reason = False, "header variables aren't supported for campaigns yet"
        elif ctype == "FOOTER":
            footer = c.get("text", "")
        elif ctype == "BUTTONS":
            for b in c.get("buttons") or []:
                buttons.append({"type": b.get("type"), "text": b.get("text", "")})
                if b.get("type") == "URL" and "{{" in (b.get("url") or ""):
                    supported, reason = False, "dynamic URL buttons aren't supported for campaigns yet"
    return {
        "meta_template_id": t.get("id", ""),
        "name": t.get("name", ""),
        "language": t.get("language", ""),
        "status": t.get("status", ""),
        "category": t.get("category", ""),
        "body": body,
        "header": header,
        "footer": footer,
        "buttons": buttons,
        "variable_count": count_variables(body),
        "supported": supported,
        "unsupported_reason": reason,
        "rejected_reason": t.get("rejected_reason", ""),
    }


@bni_campaign_router.get("/templates")
async def list_templates(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    return await db.bni_wa_templates.find({}, {"_id": 0}).sort("name", 1).to_list(1000)


@bni_campaign_router.post("/templates/sync")
async def sync_templates(request: Request):
    """Pull every template (and its approval status) from the WABA. Keeps the
    OS-side variable mapping of templates that were written here."""
    from server import get_current_user, db
    await get_current_user(request)
    s = await _get_settings(db)
    _require_configured(s, need_waba=True)
    fetched = []
    url = _graph(s, f"{s['waba_id']}/message_templates")
    params = {"fields": "id,name,language,status,category,components,rejected_reason", "limit": 100}
    async with httpx.AsyncClient(timeout=30.0) as client:
        while url:
            resp = await client.get(url, params=params, headers=_auth(s))
            data = resp.json() if resp.content else {}
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=_meta_error(data))
            fetched.extend(data.get("data") or [])
            url = (data.get("paging") or {}).get("next")
            params = None  # the `next` URL already carries them
    existing = {(t["name"], t["language"]): t for t in await db.bni_wa_templates.find({}, {"_id": 0}).to_list(1000)}
    now = _iso()
    keep = []
    for raw in fetched:
        parsed = _parse_template(raw)
        key = (parsed["name"], parsed["language"])
        old = existing.get(key) or {}
        var_map = old.get("variable_map") or (["name"] + ["custom"] * (parsed["variable_count"] - 1) if parsed["variable_count"] else [])
        parsed.update({
            "template_id": old.get("template_id") or f"watpl_{uuid.uuid4().hex[:10]}",
            "variable_map": var_map[:parsed["variable_count"]] + ["custom"] * max(0, parsed["variable_count"] - len(var_map)),
            "created_in_os": old.get("created_in_os", False),
            "synced_at": now,
        })
        await db.bni_wa_templates.update_one({"name": key[0], "language": key[1]}, {"$set": parsed}, upsert=True)
        keep.append(key)
    # Templates deleted in Meta disappear here too.
    for key in set(existing) - set(keep):
        await db.bni_wa_templates.delete_one({"name": key[0], "language": key[1]})
    approved = sum(1 for t in fetched if t.get("status") == "APPROVED")
    return {"total": len(fetched), "approved": approved}


class TemplateCreate(BaseModel):
    name: str
    language: str = "en"
    category: str = "MARKETING"   # MARKETING | UTILITY
    body: str                     # with {{name}}, {{company}}, {{category}}, {{chapter}}, {{location}}
    footer: str = ""
    quick_replies: List[str] = []  # e.g. ["Interested", "Not now"]


@bni_campaign_router.post("/templates")
async def create_template(payload: TemplateCreate, request: Request):
    """Write a message in the OS and submit it to Meta for approval."""
    from server import get_current_user, db
    user = await get_current_user(request)
    s = await _get_settings(db)
    _require_configured(s, need_waba=True)
    name = payload.name.strip().lower().replace(" ", "_")
    if not re.fullmatch(r"[a-z0-9_]{1,512}", name):
        raise HTTPException(status_code=400, detail="Template name: lowercase letters, numbers and underscores only")
    if payload.category not in ("MARKETING", "UTILITY"):
        raise HTTPException(status_code=400, detail="Category must be MARKETING or UTILITY")
    try:
        body, var_map = convert_tokens(payload.body.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not body:
        raise HTTPException(status_code=400, detail="Message body is required")
    if re.match(r"^\s*\{\{", body) or re.search(r"\}\}\s*[.!?]?\s*$", body):
        raise HTTPException(status_code=400, detail="Meta rejects a message that starts or ends with a variable — add some words before/after it.")
    replies = [r.strip()[:25] for r in payload.quick_replies if r.strip()][:3]

    body_component = {"type": "BODY", "text": body}
    if var_map:
        body_component["example"] = {"body_text": [[SAMPLE_VALUES[v] for v in var_map]]}
    components = [body_component]
    if payload.footer.strip():
        components.append({"type": "FOOTER", "text": payload.footer.strip()[:60]})
    if replies:
        components.append({"type": "BUTTONS", "buttons": [{"type": "QUICK_REPLY", "text": r} for r in replies]})

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            _graph(s, f"{s['waba_id']}/message_templates"),
            json={"name": name, "language": payload.language, "category": payload.category, "components": components},
            headers=_auth(s),
        )
    data = resp.json() if resp.content else {}
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=400, detail=_meta_error(data))

    doc = {
        "template_id": f"watpl_{uuid.uuid4().hex[:10]}",
        "meta_template_id": data.get("id", ""),
        "name": name,
        "language": payload.language,
        "status": data.get("status") or "PENDING",
        "category": data.get("category") or payload.category,
        "body": body,
        "header": None,
        "footer": payload.footer.strip(),
        "buttons": [{"type": "QUICK_REPLY", "text": r} for r in replies],
        "variable_count": len(var_map),
        "variable_map": var_map,
        "supported": True,
        "unsupported_reason": "",
        "rejected_reason": "",
        "created_in_os": True,
        "created_by": user.user_id,
        "synced_at": _iso(),
    }
    await db.bni_wa_templates.update_one({"name": name, "language": payload.language}, {"$set": doc}, upsert=True)
    return doc


# ============================ audience ============================

class AudienceFilter(BaseModel):
    category_names: List[str] = []       # empty = every category
    location_type: str = "all"           # all | local | international
    statuses: List[str] = []             # outreach statuses; empty = any
    skip_previously_messaged: bool = True
    exclude_outreach_ids: List[str] = []


async def _resolve_audience(db, f: AudienceFilter, s: dict):
    """Outreach rows matching the filter, split into sendable members and the
    reasons the rest are skipped."""
    query = {}
    if f.category_names:
        query["category_name"] = {"$in": f.category_names}
    if f.statuses:
        query["status"] = {"$in": f.statuses}
    rows = await db.bni_outreach.find(query, {"_id": 0}).to_list(20000)
    messaged = set()
    if f.skip_previously_messaged:
        messaged = set(await db.bni_campaign_recipients.distinct(
            "outreach_id", {"send_status": {"$in": ["sent", "delivered", "read", "queued", "sending"]}}
        ))
    exclude = set(f.exclude_outreach_ids)
    eligible, skipped = [], {"no_phone": 0, "opted_out": 0, "already_messaged": 0, "duplicate_phone": 0, "excluded": 0}
    seen_phones = set()
    for r in rows:
        loc_type = r.get("location_type") or _guess_location_type(r.get("location", ""))
        if f.location_type in ("local", "international") and loc_type != f.location_type:
            continue
        if r["outreach_id"] in exclude:
            skipped["excluded"] += 1
            continue
        if r.get("wa_opt_out"):
            skipped["opted_out"] += 1
            continue
        if r["outreach_id"] in messaged:
            skipped["already_messaged"] += 1
            continue
        phone = _phone_for({**r, "location_type": loc_type}, s)
        if not phone:
            skipped["no_phone"] += 1
            continue
        if phone in seen_phones:
            skipped["duplicate_phone"] += 1
            continue
        seen_phones.add(phone)
        eligible.append({**r, "wa_phone": phone})
    return eligible, skipped


@bni_campaign_router.post("/audience/preview")
async def preview_audience(payload: AudienceFilter, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    s = await _get_settings(db)
    eligible, skipped = await _resolve_audience(db, payload, s)
    by_category = {}
    for e in eligible:
        k = e.get("category_name") or "Uncategorised"
        by_category[k] = by_category.get(k, 0) + 1
    return {
        "eligible": len(eligible),
        "skipped": skipped,
        "by_category": sorted([{"category_name": k, "count": v} for k, v in by_category.items()], key=lambda x: -x["count"]),
        "members": [
            {k: e.get(k, "") for k in ("outreach_id", "name", "brand_name", "category_name", "chapter_name", "location", "status", "wa_phone")}
            for e in eligible[:500]
        ],
        "daily_send_cap": s["daily_send_cap"],
    }


# ============================ campaigns ============================

class CampaignVariable(BaseModel):
    source: str = "name"
    value: str = ""      # used when source == "custom"
    fallback: str = ""


class CampaignCreate(BaseModel):
    name: str
    template_id: str
    variables: List[CampaignVariable] = []
    audience: AudienceFilter
    send_now: bool = False


async def _campaign_stats(db, campaign_ids: List[str]) -> dict:
    recips = await db.bni_campaign_recipients.find(
        {"campaign_id": {"$in": campaign_ids}},
        {"_id": 0, "campaign_id": 1, "send_status": 1, "replied_at": 1, "response_status": 1, "outreach_id": 1},
    ).to_list(100000)
    outreach_status = await _outreach_status_map(db, {r["outreach_id"] for r in recips})
    stats = {cid: _empty_stats() for cid in campaign_ids}
    for r in recips:
        _add_to_stats(stats[r["campaign_id"]], r, outreach_status.get(r["outreach_id"], ""))
    for st in stats.values():
        _finish_stats(st)
    return stats


async def _outreach_status_map(db, ids) -> dict:
    if not ids:
        return {}
    rows = await db.bni_outreach.find({"outreach_id": {"$in": list(ids)}}, {"_id": 0, "outreach_id": 1, "status": 1}).to_list(len(ids) + 10)
    return {r["outreach_id"]: r.get("status", "") for r in rows}


def _empty_stats():
    return {"total": 0, "queued": 0, "failed": 0, "contacted": 0, "delivered": 0, "read": 0, "replied": 0,
            "not_replied": 0, "interested": 0, "not_interested": 0, "scheduled": 0, "completed": 0}


def _add_to_stats(st: dict, r: dict, outreach_status: str):
    st["total"] += 1
    send = r.get("send_status")
    if send in ("queued", "sending"):
        st["queued"] += 1
        return
    if send == "failed":
        st["failed"] += 1
        return
    st["contacted"] += 1
    if send in ("delivered", "read"):
        st["delivered"] += 1
    if send == "read":
        st["read"] += 1
    resp = effective_response(r.get("response_status"), outreach_status)
    if r.get("replied_at"):
        st["replied"] += 1
    if resp in ("Interested", "Scheduled One to One", "One to One Completed"):
        st["interested"] += 1
    if resp == "Not Interested":
        st["not_interested"] += 1
    # Scheduled is cumulative — a completed meeting was scheduled first.
    if resp in ("Scheduled One to One", "One to One Completed"):
        st["scheduled"] += 1
    if resp == "One to One Completed":
        st["completed"] += 1


def _finish_stats(st: dict):
    st["not_replied"] = st["contacted"] - st["replied"]
    c = st["contacted"] or 0
    st["reply_rate"] = round(st["replied"] * 100 / c, 1) if c else 0
    st["meeting_rate"] = round(st["scheduled"] * 100 / c, 1) if c else 0
    st["delivery_rate"] = round(st["delivered"] * 100 / c, 1) if c else 0


def _is_running(c: dict) -> bool:
    hb = c.get("runner_heartbeat")
    if not hb:
        return False
    try:
        return (_now() - datetime.fromisoformat(hb)).total_seconds() < RUNNER_LEASE_SECONDS
    except Exception:
        return False


@bni_campaign_router.get("")
async def list_campaigns(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    camps = await db.bni_campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    stats = await _campaign_stats(db, [c["campaign_id"] for c in camps])
    for c in camps:
        c["stats"] = stats.get(c["campaign_id"], _empty_stats())
        c["is_running"] = _is_running(c)
    return camps


@bni_campaign_router.post("")
async def create_campaign(payload: CampaignCreate, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Campaign name is required")
    tpl = await db.bni_wa_templates.find_one({"template_id": payload.template_id}, {"_id": 0})
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found — sync templates first")
    if tpl.get("status") != "APPROVED":
        raise HTTPException(status_code=400, detail=f'Template "{tpl["name"]}" is {tpl.get("status", "not approved")} — only APPROVED templates can be sent.')
    if not tpl.get("supported", True):
        raise HTTPException(status_code=400, detail=f'Template "{tpl["name"]}": {tpl.get("unsupported_reason")}')
    variables = [v.dict() for v in payload.variables][:tpl.get("variable_count", 0)]
    if len(variables) != tpl.get("variable_count", 0):
        raise HTTPException(status_code=400, detail=f"This template needs {tpl.get('variable_count', 0)} variable(s) mapped")
    for v in variables:
        if v["source"] not in VARIABLE_SOURCES:
            raise HTTPException(status_code=400, detail=f"Unknown variable source: {v['source']}")
        if v["source"] == "custom" and not v["value"].strip():
            raise HTTPException(status_code=400, detail="Custom variables need a value")

    s = await _get_settings(db)
    eligible, skipped = await _resolve_audience(db, payload.audience, s)
    if not eligible:
        raise HTTPException(status_code=400, detail="No members to send to with these filters")

    now = _iso()
    campaign_id = f"bnicmp_{uuid.uuid4().hex[:10]}"
    camp = {
        "campaign_id": campaign_id,
        "name": payload.name.strip(),
        "template_id": tpl["template_id"],
        "template_name": tpl["name"],
        "template_language": tpl["language"],
        "template_body": tpl["body"],
        "variables": variables,
        "audience": payload.audience.dict(),
        "skipped": skipped,
        "status": "draft",
        "pause_reason": "",
        "created_by": user.user_id,
        "created_at": now,
        "started_at": None,
        "completed_at": None,
        "runner_heartbeat": None,
    }
    await db.bni_campaigns.insert_one(camp)
    recipients = []
    for e in eligible:
        recipients.append({
            "recipient_id": f"bnircp_{uuid.uuid4().hex[:12]}",
            "campaign_id": campaign_id,
            "outreach_id": e["outreach_id"],
            "name": e.get("name", ""),
            "brand_name": e.get("brand_name", ""),
            "category_id": e.get("category_id", ""),
            "category_name": e.get("category_name", "") or "Uncategorised",
            "chapter_name": e.get("chapter_name", ""),
            "wa_phone": e["wa_phone"],
            "rendered_body": render_body(tpl["body"], variable_values(e, variables)),
            "params": variable_values(e, variables),
            "send_status": "queued",
            "wa_message_id": "",
            "error": "",
            "sent_at": None, "delivered_at": None, "read_at": None,
            "replied_at": None, "last_reply_at": None, "last_reply_text": "", "reply_count": 0,
            "response_status": "Pending",
            "created_at": now,
        })
    await db.bni_campaign_recipients.insert_many(recipients)
    if payload.send_now:
        await _start(db, campaign_id)
    camp.pop("_id", None)
    camp["recipient_count"] = len(recipients)
    return camp


async def _sent_last_24h(db) -> int:
    since = _iso(_now() - timedelta(hours=24))
    return await db.bni_campaign_recipients.count_documents({"sent_at": {"$gte": since}})


async def _start(db, campaign_id: str):
    camp = await db.bni_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if _is_running(camp):
        return
    s = await _get_settings(db)
    _require_configured(s)
    # A runner that died mid-send leaves rows "sending" — put them back.
    stale = _iso(_now() - timedelta(seconds=RUNNER_LEASE_SECONDS * 2))
    await db.bni_campaign_recipients.update_many(
        {"campaign_id": campaign_id, "send_status": "sending", "claimed_at": {"$lt": stale}},
        {"$set": {"send_status": "queued"}},
    )
    await db.bni_campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": {"status": "sending", "pause_reason": "", "started_at": camp.get("started_at") or _iso()}},
    )
    task = asyncio.create_task(_run_campaign(campaign_id))
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)


@bni_campaign_router.post("/{campaign_id}/send")
async def send_campaign(campaign_id: str, request: Request):
    """Start (or resume) sending a campaign's queued messages."""
    from server import get_current_user, db
    await get_current_user(request)
    await _start(db, campaign_id)
    return {"success": True}


@bni_campaign_router.post("/{campaign_id}/pause")
async def pause_campaign(campaign_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    res = await db.bni_campaigns.update_one(
        {"campaign_id": campaign_id, "status": "sending"},
        {"$set": {"status": "paused", "pause_reason": "Paused manually"}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=400, detail="Campaign isn't sending")
    return {"success": True}


async def _send_template(client, s: dict, to: str, camp: dict, params: List[str]):
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {"name": camp["template_name"], "language": {"code": camp["template_language"]}},
    }
    if params:
        payload["template"]["components"] = [{"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}]
    resp = await client.post(_graph(s, f"{s['phone_number_id']}/messages"), json=payload, headers=_auth(s))
    data = resp.json() if resp.content else {}
    if resp.status_code == 200 and data.get("messages"):
        return data["messages"][0]["id"], ""
    return "", _meta_error(data)


async def _run_campaign(campaign_id: str):
    """Background sender. Takes a lease on the campaign (heartbeat) so only
    one worker process sends it, then claims recipients one at a time with
    find_one_and_update so no member is ever messaged twice."""
    from server import db
    runner = uuid.uuid4().hex
    lease_cutoff = _iso(_now() - timedelta(seconds=RUNNER_LEASE_SECONDS))
    got = await db.bni_campaigns.find_one_and_update(
        {"campaign_id": campaign_id, "status": "sending",
         "$or": [{"runner_heartbeat": None}, {"runner_heartbeat": {"$lt": lease_cutoff}}]},
        {"$set": {"runner_id": runner, "runner_heartbeat": _iso()}},
    )
    if not got:
        return
    try:
        s = await _get_settings(db)
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                camp = await db.bni_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
                if not camp or camp.get("status") != "sending" or camp.get("runner_id") != runner:
                    return
                if await _sent_last_24h(db) >= s["daily_send_cap"]:
                    await db.bni_campaigns.update_one({"campaign_id": campaign_id}, {"$set": {
                        "status": "paused",
                        "pause_reason": f"Daily send cap of {s['daily_send_cap']} reached — resume after 24 hours (or raise the cap in Setup once Meta lifts your tier).",
                    }})
                    return
                r = await db.bni_campaign_recipients.find_one_and_update(
                    {"campaign_id": campaign_id, "send_status": "queued"},
                    {"$set": {"send_status": "sending", "claimed_at": _iso()}},
                )
                if not r:
                    await db.bni_campaigns.update_one(
                        {"campaign_id": campaign_id, "runner_id": runner},
                        {"$set": {"status": "completed", "completed_at": _iso()}},
                    )
                    return
                try:
                    msg_id, err = await _send_template(client, s, r["wa_phone"], camp, r.get("params") or [])
                except Exception as e:  # network hiccup — count as failed, keep going
                    msg_id, err = "", f"Network error: {e}"
                now = _iso()
                if msg_id:
                    await db.bni_campaign_recipients.update_one(
                        {"recipient_id": r["recipient_id"]},
                        {"$set": {"send_status": "sent", "wa_message_id": msg_id, "sent_at": now, "error": ""}},
                    )
                    await db.bni_wa_messages.insert_one({
                        "message_id": msg_id, "wa_phone": r["wa_phone"], "direction": "out", "type": "template",
                        "text": r.get("rendered_body", ""), "status": "sent", "timestamp": now,
                        "outreach_id": r["outreach_id"], "campaign_id": campaign_id, "recipient_id": r["recipient_id"],
                        "read_by_us": True,
                    })
                    await _mark_outreach_contacted(db, r, camp, now)
                else:
                    await db.bni_campaign_recipients.update_one(
                        {"recipient_id": r["recipient_id"]},
                        {"$set": {"send_status": "failed", "error": err, "sent_at": None}},
                    )
                    if "(code 190)" in err:  # bad token — every further send would fail too
                        await db.bni_campaigns.update_one({"campaign_id": campaign_id}, {"$set": {"status": "paused", "pause_reason": err}})
                        return
                await db.bni_campaigns.update_one({"campaign_id": campaign_id, "runner_id": runner}, {"$set": {"runner_heartbeat": _iso()}})
                await asyncio.sleep(SEND_INTERVAL_SECONDS)
    except Exception as e:
        logger.exception("Campaign %s runner crashed", campaign_id)
        await db.bni_campaigns.update_one({"campaign_id": campaign_id}, {"$set": {"status": "paused", "pause_reason": f"Stopped by an error: {e}"}})
    finally:
        await db.bni_campaigns.update_one({"campaign_id": campaign_id, "runner_id": runner}, {"$set": {"runner_heartbeat": None}})


async def _mark_outreach_contacted(db, r: dict, camp: dict, now: str):
    """Untouched prospects move to "Contacted" once the message is accepted;
    the send is also logged in the row's reach-out history."""
    await db.bni_outreach.update_one(
        {"outreach_id": r["outreach_id"], "status": {"$in": ["To do", "New Lead"]}},
        {"$set": {"status": "Contacted", "updated_at": now}},
    )
    await db.bni_outreach.update_one({"outreach_id": r["outreach_id"]}, {
        "$set": {"reached_out_at": now},
        "$push": {"reach_out_history": {
            "channel": "whatsapp_api", "campaign_id": camp["campaign_id"], "campaign_name": camp["name"],
            "template_name": camp["template_name"], "sent_at": now,
        }},
    })


@bni_campaign_router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str, request: Request):
    """Removes the campaign and its recipient rows. Inbox messages stay."""
    from server import get_current_user, db
    await get_current_user(request)
    camp = await db.bni_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if camp.get("status") == "sending":
        raise HTTPException(status_code=400, detail="Pause the campaign before deleting it")
    await db.bni_campaign_recipients.delete_many({"campaign_id": campaign_id})
    await db.bni_campaigns.delete_one({"campaign_id": campaign_id})
    return {"success": True}


# ============================ recipients / responses ============================

def _recipient_view(r: dict, outreach_status: str) -> dict:
    r["outreach_status"] = outreach_status
    r["response_status"] = effective_response(r.get("response_status"), outreach_status)
    r.pop("params", None)
    return r


@bni_campaign_router.get("/responses")
async def list_responses(request: Request, campaign_id: Optional[str] = None, category_name: Optional[str] = None,
                         response_status: Optional[str] = None, replied: Optional[str] = None):
    """Member-wise tracking across campaigns: who was messaged, delivery,
    whether and what they replied, and where they stand now."""
    from server import get_current_user, db
    await get_current_user(request)
    q = {"send_status": {"$nin": ["queued", "sending"]}}
    if campaign_id:
        q["campaign_id"] = campaign_id
    if category_name:
        q["category_name"] = category_name
    if replied == "yes":
        q["replied_at"] = {"$ne": None}
    elif replied == "no":
        q["replied_at"] = None
        q["send_status"] = {"$in": ["sent", "delivered", "read"]}
    rows = await db.bni_campaign_recipients.find(q, {"_id": 0}).sort([("last_reply_at", -1), ("sent_at", -1)]).to_list(5000)
    statuses = await _outreach_status_map(db, {r["outreach_id"] for r in rows})
    camp_names = {c["campaign_id"]: c["name"] for c in await db.bni_campaigns.find({}, {"_id": 0, "campaign_id": 1, "name": 1}).to_list(500)}
    out = []
    for r in rows:
        v = _recipient_view(r, statuses.get(r["outreach_id"], ""))
        if response_status and v["response_status"] != response_status:
            continue
        v["campaign_name"] = camp_names.get(r["campaign_id"], "")
        out.append(v)
    return out


@bni_campaign_router.get("/{campaign_id}")
async def get_campaign(campaign_id: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    camp = await db.bni_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    recips = await db.bni_campaign_recipients.find({"campaign_id": campaign_id}, {"_id": 0}).sort("name", 1).to_list(20000)
    statuses = await _outreach_status_map(db, {r["outreach_id"] for r in recips})
    camp["recipients"] = [_recipient_view(r, statuses.get(r["outreach_id"], "")) for r in recips]
    camp["stats"] = (await _campaign_stats(db, [campaign_id]))[campaign_id]
    camp["is_running"] = _is_running(camp)
    return camp


class RecipientUpdate(BaseModel):
    response_status: str
    meeting_date: Optional[str] = None
    meeting_time: Optional[str] = None


@bni_campaign_router.put("/recipients/{recipient_id}")
async def update_recipient(recipient_id: str, payload: RecipientUpdate, request: Request):
    """Set a member's response status. Not Interested / Scheduled / Completed
    are mirrored onto the Outreach row (and Scheduled/Completed into the BNI
    One-to-One tab, same as changing the status on the Outreach tab)."""
    from server import get_current_user, db
    user = await get_current_user(request)
    if payload.response_status not in RESPONSE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid response status: {payload.response_status}")
    r = await db.bni_campaign_recipients.find_one({"recipient_id": recipient_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Recipient not found")
    await db.bni_campaign_recipients.update_one({"recipient_id": recipient_id}, {"$set": {"response_status": payload.response_status}})
    outreach_status = {
        "Not Interested": "Not Interested",
        "Scheduled One to One": "Scheduled One to One",
        "One to One Completed": "One to One Completed",
    }.get(payload.response_status)
    if outreach_status:
        await db.bni_outreach.update_one({"outreach_id": r["outreach_id"]}, {"$set": {"status": outreach_status, "updated_at": _iso()}})
        entry = await db.bni_outreach.find_one({"outreach_id": r["outreach_id"]}, {"_id": 0})
        if entry and outreach_status != "Not Interested":
            meeting = "Scheduled" if outreach_status == "Scheduled One to One" else "Completed"
            await _sync_cross_chapter_oto(db, entry, meeting, user.user_id, payload.meeting_date, payload.meeting_time)
    elif payload.response_status in ("Pending", "Replied", "Interested"):
        # Stepping back down from a status that was mirrored onto the outreach
        # row would otherwise be overridden by effective_response on the next
        # read — put the outreach row back to plain "Contacted".
        await db.bni_outreach.update_one(
            {"outreach_id": r["outreach_id"], "status": {"$in": ["Not Interested", "Scheduled One to One", "One to One Completed"]}},
            {"$set": {"status": "Contacted", "updated_at": _iso()}},
        )
    return {"success": True}


# ============================ analytics ============================

@bni_campaign_router.get("/analytics/summary")
async def analytics(request: Request, campaign_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
    """Totals plus a category-by-category breakdown (contacted → delivered →
    replied → interested → scheduled → completed)."""
    from server import get_current_user, db
    await get_current_user(request)
    q = {}
    if campaign_id:
        q["campaign_id"] = campaign_id
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to + "T23:59:59"
        q["sent_at"] = rng
    recips = await db.bni_campaign_recipients.find(
        q, {"_id": 0, "campaign_id": 1, "send_status": 1, "replied_at": 1, "response_status": 1, "outreach_id": 1, "category_name": 1},
    ).to_list(100000)
    statuses = await _outreach_status_map(db, {r["outreach_id"] for r in recips})
    total = _empty_stats()
    by_cat = {}
    for r in recips:
        st_out = statuses.get(r["outreach_id"], "")
        _add_to_stats(total, r, st_out)
        _add_to_stats(by_cat.setdefault(r.get("category_name") or "Uncategorised", _empty_stats()), r, st_out)
    _finish_stats(total)
    categories = []
    for name, st in by_cat.items():
        _finish_stats(st)
        categories.append({"category_name": name, **st})
    categories.sort(key=lambda c: (-c["meeting_rate"], -c["reply_rate"], -c["contacted"]))
    unread = await db.bni_wa_messages.count_documents({"direction": "in", "read_by_us": False})
    return {"summary": total, "by_category": categories, "unread_messages": unread,
            "campaigns": await db.bni_campaigns.count_documents({})}


# ============================ inbox ============================

@bni_campaign_router.get("/inbox/conversations")
async def inbox_conversations(request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    pipeline = [
        {"$sort": {"timestamp": 1}},
        {"$group": {
            "_id": "$wa_phone",
            "last_text": {"$last": "$text"},
            "last_direction": {"$last": "$direction"},
            "last_at": {"$last": "$timestamp"},
            "last_inbound_at": {"$max": {"$cond": [{"$eq": ["$direction", "in"]}, "$timestamp", None]}},
            "unread": {"$sum": {"$cond": [{"$and": [{"$eq": ["$direction", "in"]}, {"$eq": ["$read_by_us", False]}]}, 1, 0]}},
            "outreach_id": {"$max": "$outreach_id"},
            "profile_name": {"$max": "$profile_name"},
        }},
        {"$sort": {"last_at": -1}},
        {"$limit": 500},
    ]
    convs = await db.bni_wa_messages.aggregate(pipeline).to_list(500)
    ids = [c["outreach_id"] for c in convs if c.get("outreach_id")]
    members = {m["outreach_id"]: m for m in await db.bni_outreach.find(
        {"outreach_id": {"$in": ids}}, {"_id": 0, "outreach_id": 1, "name": 1, "brand_name": 1, "category_name": 1, "status": 1}
    ).to_list(len(ids) + 10)}
    out = []
    for c in convs:
        m = members.get(c.get("outreach_id")) or {}
        out.append({
            "wa_phone": c["_id"],
            "name": m.get("name") or c.get("profile_name") or f"+{c['_id']}",
            "brand_name": m.get("brand_name", ""),
            "category_name": m.get("category_name", ""),
            "outreach_status": m.get("status", ""),
            "outreach_id": c.get("outreach_id") or "",
            "last_text": c.get("last_text", ""),
            "last_direction": c.get("last_direction"),
            "last_at": c.get("last_at"),
            "last_inbound_at": c.get("last_inbound_at"),
            "unread": c.get("unread", 0),
            "window_open": _window_open(c.get("last_inbound_at")),
        })
    return out


def _window_open(last_inbound_at: Optional[str]) -> bool:
    if not last_inbound_at:
        return False
    try:
        return _now() - datetime.fromisoformat(last_inbound_at) < timedelta(hours=REPLY_WINDOW_HOURS)
    except Exception:
        return False


@bni_campaign_router.get("/inbox/conversations/{wa_phone}")
async def inbox_thread(wa_phone: str, request: Request):
    from server import get_current_user, db
    await get_current_user(request)
    msgs = await db.bni_wa_messages.find({"wa_phone": wa_phone}, {"_id": 0}).sort("timestamp", 1).to_list(2000)
    await db.bni_wa_messages.update_many({"wa_phone": wa_phone, "direction": "in", "read_by_us": False}, {"$set": {"read_by_us": True}})
    last_in = max((m["timestamp"] for m in msgs if m["direction"] == "in"), default=None)
    return {"messages": msgs, "window_open": _window_open(last_in), "last_inbound_at": last_in}


class ReplyPayload(BaseModel):
    text: str


@bni_campaign_router.post("/inbox/conversations/{wa_phone}/reply")
async def inbox_reply(wa_phone: str, payload: ReplyPayload, request: Request):
    from server import get_current_user, db
    user = await get_current_user(request)
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Type a message")
    s = await _get_settings(db)
    _require_configured(s)
    last_in = await db.bni_wa_messages.find_one({"wa_phone": wa_phone, "direction": "in"}, {"_id": 0}, sort=[("timestamp", -1)])
    if not last_in or not _window_open(last_in["timestamp"]):
        raise HTTPException(status_code=400, detail="The 24-hour reply window is closed — WhatsApp only allows an approved template now. Reply from the WhatsApp Business app or send a new campaign.")
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            _graph(s, f"{s['phone_number_id']}/messages"),
            json={"messaging_product": "whatsapp", "to": wa_phone, "type": "text", "text": {"body": text[:4096]}},
            headers=_auth(s),
        )
    data = resp.json() if resp.content else {}
    if resp.status_code != 200 or not data.get("messages"):
        raise HTTPException(status_code=400, detail=_meta_error(data))
    doc = {
        "message_id": data["messages"][0]["id"], "wa_phone": wa_phone, "direction": "out", "type": "text",
        "text": text, "status": "sent", "timestamp": _iso(), "outreach_id": last_in.get("outreach_id", ""),
        "campaign_id": last_in.get("campaign_id", ""), "recipient_id": last_in.get("recipient_id", ""),
        "read_by_us": True, "sent_by": user.user_id,
    }
    await db.bni_wa_messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ============================ webhook (public — called by Meta) ============================
# Registered under /webhook — kept public (no session) because Meta calls it.
# GET is the one-time verification handshake; POST carries delivery receipts
# and incoming messages. Always answer 200 quickly so Meta doesn't retry.

webhook_router = APIRouter(prefix="/bni/campaigns", tags=["bni"])


@webhook_router.get("/webhook")
async def webhook_verify(request: Request):
    from server import db
    s = await _get_settings(db)
    p = request.query_params
    if p.get("hub.mode") == "subscribe" and s.get("verify_token") and p.get("hub.verify_token") == s["verify_token"]:
        return PlainTextResponse(p.get("hub.challenge", ""))
    raise HTTPException(status_code=403, detail="Verification failed")


@webhook_router.post("/webhook")
async def webhook_receive(request: Request):
    from server import db
    raw = await request.body()
    s = await _get_settings(db)
    if not verify_signature(s.get("app_secret", ""), raw, request.headers.get("X-Hub-Signature-256", "")):
        raise HTTPException(status_code=403, detail="Bad signature")
    try:
        body = json.loads(raw or b"{}")
    except Exception:
        return {"ok": True}
    for entry in body.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            try:
                for st in value.get("statuses") or []:
                    await _handle_status(db, st)
                names = {c.get("wa_id"): (c.get("profile") or {}).get("name", "") for c in value.get("contacts") or []}
                for msg in value.get("messages") or []:
                    await _handle_inbound(db, s, msg, names.get(msg.get("from"), ""))
            except Exception:
                logger.exception("WhatsApp webhook processing failed")
    return {"ok": True}


def _ts(unix) -> str:
    try:
        return _iso(datetime.fromtimestamp(int(unix), tz=timezone.utc))
    except Exception:
        return _iso()


async def _handle_status(db, st: dict):
    msg_id, status = st.get("id"), st.get("status")
    if not msg_id or status not in ("sent", "delivered", "read", "failed"):
        return
    ts = _ts(st.get("timestamp"))
    await db.bni_wa_messages.update_one({"message_id": msg_id}, {"$set": {"status": status}})
    r = await db.bni_campaign_recipients.find_one({"wa_message_id": msg_id}, {"_id": 0, "recipient_id": 1, "send_status": 1})
    if not r:
        return
    current = r.get("send_status")
    if status == "failed":
        # Receipts can arrive out of order — a message already delivered stays delivered.
        if _SEND_RANK.get(current, 0) < 2:
            errs = st.get("errors") or [{}]
            err = _META_ERRORS.get(errs[0].get("code")) or errs[0].get("title") or errs[0].get("message") or "Failed"
            await db.bni_campaign_recipients.update_one({"recipient_id": r["recipient_id"]}, {"$set": {"send_status": "failed", "error": err}})
        return
    update = {f"{status}_at": ts} if status != "sent" else {}
    if _SEND_RANK[status] > _SEND_RANK.get(current, 0):
        update["send_status"] = status
    if status == "read":
        update.setdefault("delivered_at", ts)
    if update:
        await db.bni_campaign_recipients.update_one({"recipient_id": r["recipient_id"]}, {"$set": update})


async def _find_outreach_by_phone(db, s: dict, wa_phone: str) -> Optional[dict]:
    rows = await db.bni_outreach.find({}, {"_id": 0, "outreach_id": 1, "phone": 1, "phone2": 1, "location": 1, "location_type": 1}).to_list(20000)
    for r in rows:
        loc_type = r.get("location_type") or _guess_location_type(r.get("location", ""))
        cc = s["international_country_code"] if loc_type == "international" else s["local_country_code"]
        if wa_phone in (normalize_phone(r.get("phone", ""), cc), normalize_phone(r.get("phone2", ""), cc)):
            return r
    return None


async def _handle_inbound(db, s: dict, msg: dict, profile_name: str):
    msg_id, wa_phone = msg.get("id"), msg.get("from")
    if not msg_id or not wa_phone:
        return
    if await db.bni_wa_messages.find_one({"message_id": msg_id}, {"_id": 1}):
        return  # Meta retried a delivery we already stored
    text = inbound_text(msg)
    ts = _ts(msg.get("timestamp"))
    recipient = await db.bni_campaign_recipients.find_one(
        {"wa_phone": wa_phone, "send_status": {"$in": ["sent", "delivered", "read"]}}, {"_id": 0}, sort=[("sent_at", -1)],
    )
    outreach_id = recipient["outreach_id"] if recipient else ((await _find_outreach_by_phone(db, s, wa_phone)) or {}).get("outreach_id", "")
    await db.bni_wa_messages.insert_one({
        "message_id": msg_id, "wa_phone": wa_phone, "direction": "in", "type": msg.get("type", ""),
        "text": text, "status": "received", "timestamp": ts, "profile_name": profile_name,
        "outreach_id": outreach_id, "campaign_id": (recipient or {}).get("campaign_id", ""),
        "recipient_id": (recipient or {}).get("recipient_id", ""), "read_by_us": False,
    })
    implied = classify_reply(text, msg.get("type") in ("button", "interactive"))
    if recipient:
        update = {"last_reply_at": ts, "last_reply_text": text}
        if not recipient.get("replied_at"):
            update["replied_at"] = ts
        current = recipient.get("response_status") or "Pending"
        if implied and _RESPONSE_RANK[implied] >= _RESPONSE_RANK.get(current, 0) and current not in ("Scheduled One to One", "One to One Completed"):
            update["response_status"] = implied
        elif current == "Pending":
            update["response_status"] = "Replied"
        # A reply proves the number is reachable — make sure it reads as delivered.
        if _SEND_RANK.get(recipient.get("send_status"), 0) < 2:
            update["send_status"] = "delivered"
            update["delivered_at"] = recipient.get("delivered_at") or ts
        await db.bni_campaign_recipients.update_one(
            {"recipient_id": recipient["recipient_id"]}, {"$set": update, "$inc": {"reply_count": 1}},
        )
    if outreach_id:
        set_fields = {"wa_last_reply_at": ts, "updated_at": _iso()}
        if " ".join(text.lower().split()) in OPT_OUT_WORDS:
            set_fields["wa_opt_out"] = True
        await db.bni_outreach.update_one({"outreach_id": outreach_id}, {"$set": set_fields})
        if implied == "Not Interested":
            await db.bni_outreach.update_one(
                {"outreach_id": outreach_id, "status": {"$nin": ["Scheduled One to One", "One to One Completed", "Lead", "Relationship"]}},
                {"$set": {"status": "Not Interested"}},
            )
