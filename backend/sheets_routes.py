"""Google Sheets OAuth + sync routes for Leads & Prospect sheets."""
import os
import asyncio
import uuid
import re
import warnings
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

import logging

sheets_router = APIRouter(tags=["google-sheets"])
logger = logging.getLogger(__name__)

# OAuth config — read from MongoDB first (admin-managed via Settings UI),
# fall back to env vars for back-compat. Cached briefly to avoid hammering Mongo.
_CFG_CACHE = {"value": None, "fetched_at": None}
_CFG_TTL_SECONDS = 30


async def _load_oauth_cfg():
    """Returns dict {client_id, client_secret, redirect_uri}. DB > env."""
    now = datetime.now(timezone.utc)
    cached = _CFG_CACHE.get("value")
    fetched = _CFG_CACHE.get("fetched_at")
    if cached and fetched and (now - fetched).total_seconds() < _CFG_TTL_SECONDS:
        return cached
    cfg = {
        "client_id": os.environ.get("GOOGLE_SHEETS_CLIENT_ID"),
        "client_secret": os.environ.get("GOOGLE_SHEETS_CLIENT_SECRET"),
        "redirect_uri": os.environ.get("GOOGLE_SHEETS_REDIRECT_URI"),
    }
    try:
        from server import db
        doc = await db.system_settings.find_one({"key": "sheets_oauth"})
        if doc:
            if doc.get("client_id"):
                cfg["client_id"] = doc["client_id"]
            if doc.get("client_secret"):
                cfg["client_secret"] = doc["client_secret"]
            if doc.get("redirect_uri"):
                cfg["redirect_uri"] = doc["redirect_uri"]
    except Exception:
        pass  # DB unavailable — fall back to env
    # Sanitize client_id — strip any accidental scheme/whitespace
    # (DB values saved before the input-time fix may still have "http://" prefix.)
    cid = (cfg.get("client_id") or "").strip()
    for scheme in ("https://", "http://"):
        if cid.lower().startswith(scheme):
            cid = cid[len(scheme):]
    cfg["client_id"] = cid.strip("/ ") or None
    _CFG_CACHE["value"] = cfg
    _CFG_CACHE["fetched_at"] = now
    return cfg


def _invalidate_cfg_cache():
    _CFG_CACHE["value"] = None
    _CFG_CACHE["fetched_at"] = None


async def _compute_redirect_uri(request: Optional[Request]) -> str:
    """Derive callback URL from the incoming request so the same code works
    on preview & production. Falls back to admin-saved redirect_uri (DB) or env."""
    cfg = await _load_oauth_cfg()
    cfg_uri = cfg.get("redirect_uri")
    if request is not None:
        scheme = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        if host:
            return f"{scheme}://{host}/api/oauth/sheets/callback"
    return cfg_uri
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

SHEET_TYPES = ("prospect", "lead")


async def _flow(redirect_uri: Optional[str] = None):
    cfg = await _load_oauth_cfg()
    return Flow.from_client_config(
        {
            "web": {
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=redirect_uri or cfg["redirect_uri"],
    )


def _extract_sheet_id(url: str) -> Optional[str]:
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url or "")
    return m.group(1) if m else None


async def _get_creds(db, user_id: str) -> Credentials:
    cfg = await _load_oauth_cfg()
    tok = await db.google_sheets_tokens.find_one({"user_id": user_id})
    if not tok:
        raise HTTPException(status_code=401, detail="Google Sheets not connected. Click Connect first.")
    creds = Credentials(
        token=tok.get("access_token"),
        refresh_token=tok.get("refresh_token"),
        token_uri=tok.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=cfg["client_id"],
        client_secret=cfg["client_secret"],
    )
    expires = tok.get("expires_at")
    if expires:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) >= expires - timedelta(seconds=60):
            try:
                creds.refresh(GoogleRequest())
                await db.google_sheets_tokens.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "access_token": creds.token,
                        "expires_at": creds.expiry.replace(tzinfo=timezone.utc) if creds.expiry else None,
                    }},
                )
            except Exception:
                # The stored token is dead (revoked, or — most commonly — the
                # OAuth consent screen is still in Google Cloud Console's
                # "Testing" publishing status, which hard-expires refresh
                # tokens after 7 days no matter what). Clear it so /sheets/status
                # stops reporting "connected" for a token that doesn't work —
                # otherwise the UI shows a misleading green checkmark and the
                # user has to Disconnect before they can Connect again.
                await db.google_sheets_tokens.delete_many({"user_id": user_id})
                raise HTTPException(status_code=401, detail="Google Sheets connection expired or was revoked. Click Connect Google to reconnect.")
    return creds


# ---------- OAuth flow ----------
@sheets_router.get("/oauth/sheets/login")
async def sheets_login(request: Request, user_id: str, sheet_type: str = "prospect"):
    """Returns the Google consent screen URL. Frontend opens this in a popup."""
    from server import db
    if sheet_type not in SHEET_TYPES:
        raise HTTPException(status_code=400, detail="sheet_type must be 'prospect' or 'lead'")
    redirect_uri = await _compute_redirect_uri(request)
    flow = await _flow(redirect_uri=redirect_uri)
    url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
    )
    await db.google_oauth_states.update_one(
        {"state": state},
        {"$set": {
            "state": state,
            "user_id": user_id,
            "sheet_type": sheet_type,
            "code_verifier": getattr(flow, "code_verifier", None),
            "redirect_uri": redirect_uri,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"auth_url": url}


@sheets_router.get("/oauth/sheets/callback")
async def sheets_callback(request: Request, code: str, state: str):
    """Handles the Google callback, stores tokens, redirects user back to /leads."""
    import logging
    logger = logging.getLogger("sheets_oauth")
    from server import db
    try:
        rec = await db.google_oauth_states.find_one({"state": state})
        if not rec:
            # User probably initiated on one env (preview) and finished on another (prod).
            return RedirectResponse(url="/leads?sheets_error=invalid_state")
        user_id = rec["user_id"]
        sheet_type = rec.get("sheet_type", "prospect")
        # Use the SAME redirect_uri that was used for login (required by Google)
        redirect_uri = rec.get("redirect_uri") or (await _compute_redirect_uri(request))

        flow = await _flow(redirect_uri=redirect_uri)
        if rec.get("code_verifier"):
            flow.code_verifier = rec["code_verifier"]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            flow.fetch_token(code=code)
        creds = flow.credentials

        required = {"https://www.googleapis.com/auth/spreadsheets.readonly"}
        granted = set(creds.scopes or [])
        if not required.issubset(granted):
            missing = required - granted
            return RedirectResponse(url=f"/leads?sheets_error=missing_scopes&detail={','.join(missing)}")

        expires_at = creds.expiry.replace(tzinfo=timezone.utc) if creds.expiry else None
        await db.google_sheets_tokens.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "access_token": creds.token,
                "refresh_token": creds.refresh_token,
                "token_uri": "https://oauth2.googleapis.com/token",
                "scopes": list(creds.scopes or []),
                "expires_at": expires_at,
                "updated_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
        await db.google_oauth_states.delete_one({"state": state})
        # Bounce back to the Leads page with a flag so frontend can refresh
        return RedirectResponse(url=f"/leads?sheets_connected=1&sheet_type={sheet_type}")
    except Exception as e:
        logger.exception("Sheets OAuth callback failed: %s", e)
        # Show a readable message in the browser instead of blank 500
        from urllib.parse import quote
        return RedirectResponse(url=f"/leads?sheets_error=callback_failed&detail={quote(str(e)[:200])}")


@sheets_router.get("/sheets/status")
async def sheets_status(request: Request):
    from server import db, get_current_user
    user = await get_current_user(request)
    tok = await db.google_sheets_tokens.find_one({"user_id": user.user_id}, {"_id": 0, "access_token": 0, "refresh_token": 0})
    return {"connected": bool(tok), "scopes": (tok or {}).get("scopes", []), "expires_at": (tok or {}).get("expires_at")}


@sheets_router.delete("/sheets/disconnect")
async def sheets_disconnect(request: Request):
    from server import db, get_current_user
    user = await get_current_user(request)
    await db.google_sheets_tokens.delete_many({"user_id": user.user_id})
    return {"message": "Disconnected"}


# ---------- Admin OAuth credentials management ----------
class SheetsOAuthConfig(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = None


def _mask_secret(s: Optional[str]) -> str:
    if not s:
        return ""
    if len(s) <= 8:
        return "*" * len(s)
    return s[:4] + "*" * (len(s) - 8) + s[-4:]


async def _require_super_admin(request: Request):
    from server import get_current_user
    user = await get_current_user(request)
    role = (getattr(user, "role", "") or "").lower()
    if role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super_admin can manage OAuth credentials")
    return user


@sheets_router.get("/sheets/oauth-config")
async def get_oauth_config(request: Request):
    """Returns the current OAuth config. Secret is MASKED for security."""
    await _require_super_admin(request)
    cfg = await _load_oauth_cfg()
    # Determine source for each field — DB-saved doc takes priority
    from server import db
    db_doc = await db.system_settings.find_one({"key": "sheets_oauth"}) or {}
    return {
        "client_id": cfg.get("client_id") or "",
        "client_secret_masked": _mask_secret(cfg.get("client_secret")),
        "has_client_secret": bool(cfg.get("client_secret")),
        "redirect_uri": cfg.get("redirect_uri") or "",
        "source": {
            "client_id": "db" if db_doc.get("client_id") else ("env" if os.environ.get("GOOGLE_SHEETS_CLIENT_ID") else "none"),
            "client_secret": "db" if db_doc.get("client_secret") else ("env" if os.environ.get("GOOGLE_SHEETS_CLIENT_SECRET") else "none"),
            "redirect_uri": "db" if db_doc.get("redirect_uri") else ("env" if os.environ.get("GOOGLE_SHEETS_REDIRECT_URI") else "none"),
        },
        "updated_at": db_doc.get("updated_at"),
    }


@sheets_router.put("/sheets/oauth-config")
async def put_oauth_config(payload: SheetsOAuthConfig, request: Request):
    """Save / update OAuth credentials. Empty / null fields are kept unchanged.
    Sending an empty string explicitly clears the override (falls back to env)."""
    user = await _require_super_admin(request)
    from server import db
    update_fields = {"updated_at": datetime.now(timezone.utc), "updated_by": user.user_id}
    if payload.client_id is not None:
        # Sanitize — strip whitespace and any accidental scheme/path prefix
        # (Google client IDs are bare strings like "1234-abc.apps.googleusercontent.com",
        # users sometimes paste them as "https://1234-abc..." which Google rejects with
        # invalid_client.)
        cid = payload.client_id.strip()
        for scheme in ("https://", "http://"):
            if cid.lower().startswith(scheme):
                cid = cid[len(scheme):]
        cid = cid.strip("/ ")
        update_fields["client_id"] = cid
    if payload.client_secret is not None:
        # Treat "***" placeholder (from the masked GET) as "no change"
        cs = payload.client_secret.strip()
        if cs and "*" not in cs:
            # If the user pasted the full credentials.json blob, auto-extract the
            # `client_secret` field. Same trick for `client_id`.
            if cs.startswith("{"):
                try:
                    import json
                    parsed = json.loads(cs)
                    container = parsed.get("web") or parsed.get("installed") or parsed
                    extracted_secret = container.get("client_secret")
                    extracted_id = container.get("client_id")
                    if extracted_secret:
                        cs = extracted_secret.strip()
                    if extracted_id and payload.client_id is None:
                        # Also auto-set client_id if not explicitly provided in this request
                        update_fields["client_id"] = extracted_id.strip()
                except Exception:
                    pass  # Fall through with the raw value; Google will reject as before
            update_fields["client_secret"] = cs
        elif cs == "":
            update_fields["client_secret"] = ""
    if payload.redirect_uri is not None:
        update_fields["redirect_uri"] = payload.redirect_uri.strip()

    await db.system_settings.update_one(
        {"key": "sheets_oauth"},
        {"$set": update_fields, "$setOnInsert": {"key": "sheets_oauth", "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    _invalidate_cfg_cache()
    return {"ok": True, "message": "Google Sheets OAuth credentials updated"}


@sheets_router.delete("/sheets/oauth-config")
async def delete_oauth_config(request: Request):
    """Clear all DB-saved overrides so the app falls back to env vars."""
    await _require_super_admin(request)
    from server import db
    await db.system_settings.delete_one({"key": "sheets_oauth"})
    _invalidate_cfg_cache()
    return {"ok": True, "message": "OAuth overrides cleared — falling back to env vars"}


# ---------- Sheet config CRUD ----------
# Originally one sheet per (user_id, sheet_type). Now a type can hold many
# sheets (e.g. a Meta Ads sheet and a separate WhatsApp sheet both feeding
# "lead") — each gets its own config_id, and CRUD/preview/sync/rows are all
# addressed by config_id instead of sheet_type.
class SheetConfig(BaseModel):
    sheet_type: str  # 'prospect' | 'lead'
    name: Optional[str] = ""
    sheet_url: str
    source_type: Optional[str] = "website"  # meta | whatsapp | website | walk_in | referral | link | other
    tabs: Optional[List[str]] = None  # worksheet titles to sync; empty = the first tab (pre-tab-picker behaviour)


class SheetConfigUpdate(BaseModel):
    name: Optional[str] = None
    sheet_url: Optional[str] = None
    source_type: Optional[str] = None
    tabs: Optional[List[str]] = None


async def _backfill_config_id(db, doc: dict) -> dict:
    """Configs saved before multi-sheet support have no config_id — assign
    one lazily on first read (instead of a migration script), and tag that
    same config_id onto any leads already synced from it so the new
    config_id-scoped dedup in sync_sheet() doesn't treat them as new rows
    the next time this sheet syncs."""
    if doc.get("config_id"):
        return doc
    config_id = f"shcfg_{uuid.uuid4().hex[:12]}"
    await db.leads_sheet_configs.update_one(
        {"user_id": doc["user_id"], "sheet_type": doc["sheet_type"], "config_id": {"$exists": False}},
        {"$set": {"config_id": config_id, "created_at": doc.get("updated_at") or datetime.now(timezone.utc)}},
    )
    # Re-fetch rather than trust the locally-generated id — if a concurrent
    # request (e.g. two tabs loading at once) won the update above, this
    # picks up whichever config_id actually got persisted so the leads_v2
    # backfill below never disagrees with what's really stored.
    fresh = await db.leads_sheet_configs.find_one(
        {"user_id": doc["user_id"], "sheet_type": doc["sheet_type"]}, {"_id": 0, "config_id": 1}
    )
    config_id = (fresh or {}).get("config_id") or config_id
    await db.leads_v2.update_many(
        {"imported_from_sheet": doc["sheet_type"], "created_by": doc["user_id"], "imported_from_config_id": {"$exists": False}},
        {"$set": {"imported_from_config_id": config_id}},
    )
    doc["config_id"] = config_id
    return doc


@sheets_router.get("/sheets/configs")
async def list_configs(request: Request):
    from server import db, get_current_user
    user = await get_current_user(request)
    docs = await db.leads_sheet_configs.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    docs = [await _backfill_config_id(db, d) for d in docs]
    return {
        "prospect": [d for d in docs if d.get("sheet_type") == "prospect"],
        "lead": [d for d in docs if d.get("sheet_type") == "lead"],
    }


@sheets_router.post("/sheets/config")
async def save_config(payload: SheetConfig, request: Request):
    """Always adds a new sheet connection — use PUT .../{config_id} to edit one in place."""
    from server import db, get_current_user
    user = await get_current_user(request)
    if payload.sheet_type not in SHEET_TYPES:
        raise HTTPException(status_code=400, detail="sheet_type must be 'prospect' or 'lead'")
    sheet_id = _extract_sheet_id(payload.sheet_url)
    if not sheet_id:
        raise HTTPException(status_code=400, detail="Could not parse a Google Sheet ID from that URL")
    now = datetime.now(timezone.utc)
    doc = {
        "config_id": f"shcfg_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "sheet_type": payload.sheet_type,
        "name": (payload.name or "").strip(),
        "sheet_url": payload.sheet_url,
        "sheet_id": sheet_id,
        "source_type": payload.source_type or "website",
        "tabs": [t for t in (payload.tabs or []) if t],
        "last_synced_at": None,
        "last_synced_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    await db.leads_sheet_configs.insert_one(doc)
    doc.pop("_id", None)
    return doc


@sheets_router.put("/sheets/config/{config_id}")
async def update_config(config_id: str, payload: SheetConfigUpdate, request: Request):
    from server import db, get_current_user
    user = await get_current_user(request)
    cfg = await db.leads_sheet_configs.find_one({"config_id": config_id, "user_id": user.user_id})
    if not cfg:
        raise HTTPException(status_code=404, detail="Sheet not found")
    updates = {"updated_at": datetime.now(timezone.utc)}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.sheet_url is not None:
        sheet_id = _extract_sheet_id(payload.sheet_url)
        if not sheet_id:
            raise HTTPException(status_code=400, detail="Could not parse a Google Sheet ID from that URL")
        updates["sheet_url"] = payload.sheet_url
        updates["sheet_id"] = sheet_id
    if payload.source_type is not None:
        updates["source_type"] = payload.source_type
    if payload.tabs is not None:
        updates["tabs"] = [t for t in payload.tabs if t]
    await db.leads_sheet_configs.update_one({"config_id": config_id}, {"$set": updates})
    return await db.leads_sheet_configs.find_one({"config_id": config_id}, {"_id": 0})


@sheets_router.delete("/sheets/config/{config_id}")
async def delete_config(config_id: str, request: Request):
    from server import db, get_current_user
    user = await get_current_user(request)
    res = await db.leads_sheet_configs.delete_one({"config_id": config_id, "user_id": user.user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sheet not found")
    await db.leads_sheet_rows.delete_many({"config_id": config_id})
    return {"message": "Removed"}


# ---------- Read sheet & preview / sync ----------
# Every read goes through spreadsheets.get (tab list + each tab's real grid
# size) and then values.batchGet with ranges sized to each tab exactly —
# no oversized "A1:ZZ50000" guess, and any tab can be read, not just the
# first one.

def _col_letter(n: int) -> str:
    s = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s or "A"


def _quote_tab(title: str) -> str:
    return "'" + title.replace("'", "''") + "'"


def _read_workbook(creds: Credentials, sheet_id: str, titles: Optional[List[str]] = None):
    """Returns (spreadsheet_title, tabs, values_by_title). `titles` = which
    tabs to read values for (None = all of them; [] = none)."""
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)
    meta = service.spreadsheets().get(
        spreadsheetId=sheet_id,
        fields="properties.title,sheets.properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount))",
    ).execute()
    tabs = []
    for sh in meta.get("sheets", []):
        pr = sh.get("properties", {})
        grid = pr.get("gridProperties", {}) or {}
        tabs.append({
            "title": pr.get("title", ""),
            "gid": pr.get("sheetId"),
            "index": pr.get("index", 0),
            "hidden": bool(pr.get("hidden")),
            "rows": int(grid.get("rowCount") or 0),
            "cols": int(grid.get("columnCount") or 0),
        })
    tabs.sort(key=lambda t: t["index"])
    wanted = [t for t in tabs if (titles is None or t["title"] in titles) and t["rows"] and t["cols"]]
    values = {}
    if wanted:
        ranges = [f"{_quote_tab(t['title'])}!A1:{_col_letter(t['cols'])}{t['rows']}" for t in wanted]
        res = service.spreadsheets().values().batchGet(spreadsheetId=sheet_id, ranges=ranges).execute()
        for t, vr in zip(wanted, res.get("valueRanges", [])):
            values[t["title"]] = vr.get("values", [])
    return (meta.get("properties", {}) or {}).get("title", ""), tabs, values


async def _account_email(db, user_id: str, creds: Optional[Credentials] = None) -> str:
    """Which Google account the stored token belongs to (looked up once via
    the userinfo endpoint, then cached on the token doc)."""
    tok = await db.google_sheets_tokens.find_one({"user_id": user_id}, {"_id": 0, "email": 1, "access_token": 1})
    if not tok:
        return ""
    if tok.get("email"):
        return tok["email"]
    try:
        import httpx
        token = (creds.token if creds else None) or tok.get("access_token")
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={"Authorization": f"Bearer {token}"})
        email = (r.json() or {}).get("email", "") if r.status_code == 200 else ""
    except Exception:
        email = ""
    if email:
        await db.google_sheets_tokens.update_one({"user_id": user_id}, {"$set": {"email": email}})
    return email


async def _read_or_explain(db, user_id: str, creds: Credentials, sheet_id: str, titles=None):
    """_read_workbook, but Google's errors come back as a readable message
    instead of a bare 500 ("Sync failed" with no reason)."""
    try:
        return await asyncio.to_thread(_read_workbook, creds, sheet_id, titles)
    except HttpError as e:
        status = getattr(e.resp, "status", 0)
        if status in (403, 404):
            email = await _account_email(db, user_id, creds)
            who = email or "the Google account connected here"
            raise HTTPException(
                status_code=400,
                detail=f"{who} can't open this sheet. In Google Sheets click Share and add {who} as a Viewer — or Disconnect Google and reconnect with the account that owns the sheet.",
            )
        reason = ""
        try:
            reason = e.error_details if isinstance(e.error_details, str) else ""
            reason = reason or e._get_reason()
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=f"Google Sheets error: {reason or e}")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Reading Google Sheet %s failed", sheet_id)
        raise HTTPException(status_code=502, detail=f"Couldn't read the sheet: {e}")


# Column names (lower-case) recognised for each lead field. Includes the
# names Meta Lead Ads / Zapier commonly export under.
NAME_COLS = ("name", "lead_name", "full name", "full_name", "contact name", "customer name", "client name")
PHONE_COLS = ("phone", "mobile", "contact", "phone number", "phone_number", "whatsapp number", "contact number", "mobile number")
EMAIL_COLS = ("email", "email id", "e-mail", "email address", "e mail")
LOCATION_COLS = ("location", "city", "city/town")
WEBSITE_COLS = ("website", "site", "url")
COMPANY_COLS = ("company_name", "company name", "company", "organization", "business_name")
WHAT_COLS = ("what_do_you_want_to_do?", "what_do_you_want_to_do", "what do you do", "what_do_you_do")
NOTES_COLS = ("notes", "remarks", "comments", "message")
MAPPED_COLS = set(NAME_COLS + PHONE_COLS + EMAIL_COLS + LOCATION_COLS + WEBSITE_COLS + COMPANY_COLS + WHAT_COLS + NOTES_COLS)


def _cell(lower_headers, row, candidates):
    for c in candidates:
        if c in lower_headers:
            idx = lower_headers.index(c)
            if idx < len(row):
                return row[idx]
    return ""


def _normalize_phone(p):
    """Last 10 digits — country-code/formatting agnostic."""
    digits = "".join(ch for ch in str(p or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


def _row_keys(lower_headers, row):
    """(email_key, phone_key) used to recognise the same person across sheets."""
    return str(_cell(lower_headers, row, EMAIL_COLS)).strip().lower(), _normalize_phone(_cell(lower_headers, row, PHONE_COLS))


def _is_blank(row) -> bool:
    # Google Sheets can report rows past the real data as blank-string rows
    # (any cell that ever held content or formatting) — never turn those
    # into dummy leads named "—".
    return not any(str(cell).strip() for cell in row)


async def _lead_keys(db, exclude_config_id: Optional[str] = None):
    """Emails / phones of every live lead (optionally not counting one sheet's
    own imports) — what "already in leads" is checked against."""
    query = {"is_deleted": {"$ne": True}}
    if exclude_config_id:
        query["imported_from_config_id"] = {"$ne": exclude_config_id}
    emails, phones = set(), set()
    async for d in db.leads_v2.find(query, {"_id": 0, "email": 1, "phone": 1}):
        e = (d.get("email") or "").strip().lower()
        if e:
            emails.add(e)
        p = _normalize_phone(d.get("phone"))
        if p:
            phones.add(p)
    return emails, phones


def tab_summary(rows, lead_emails, lead_phones) -> dict:
    """Counts for one tab: data rows, rows already in Leads (same email or
    phone), and new rows. Rows with neither email nor phone count as new."""
    if not rows:
        return {"total": 0, "new": 0, "existing": 0, "headers": []}
    headers = [str(h).strip() for h in rows[0]]
    lower = [h.lower() for h in headers]
    total = existing = 0
    for r in rows[1:]:
        if _is_blank(r):
            continue
        total += 1
        email, phone = _row_keys(lower, r)
        if (email and email in lead_emails) or (phone and phone in lead_phones):
            existing += 1
    return {"total": total, "new": total - existing, "existing": existing, "headers": headers}


class InspectRequest(BaseModel):
    sheet_url: str


@sheets_router.post("/sheets/inspect")
async def inspect_sheet(payload: InspectRequest, request: Request):
    """Tabs inside a pasted sheet, each with its row count and how many of
    those rows are new vs already in Leads — powers the tab picker."""
    from server import db, get_current_user
    user = await get_current_user(request)
    sheet_id = _extract_sheet_id(payload.sheet_url)
    if not sheet_id:
        raise HTTPException(status_code=400, detail="Could not parse a Google Sheet ID from that URL")
    creds = await _get_creds(db, user.user_id)
    title, tabs, values = await _read_or_explain(db, user.user_id, creds, sheet_id)
    emails, phones = await _lead_keys(db)
    out = []
    for t in tabs:
        summary = tab_summary(values.get(t["title"], []), emails, phones)
        out.append({"title": t["title"], "gid": t["gid"], "hidden": t["hidden"], **summary})
    return {"spreadsheet_title": title, "tabs": out}


def _config_tabs(cfg: dict, tabs: list) -> list:
    """Tab titles a config syncs. Configs saved before the tab picker have no
    `tabs` → the first tab, exactly what the old range-without-a-tab read."""
    if cfg.get("tabs"):
        return list(cfg["tabs"])
    return [tabs[0]["title"]] if tabs else []


@sheets_router.get("/sheets/preview/{config_id}")
async def preview_sheet(config_id: str, request: Request):
    from server import db, get_current_user
    user = await get_current_user(request)
    cfg = await db.leads_sheet_configs.find_one({"config_id": config_id, "user_id": user.user_id})
    if not cfg:
        raise HTTPException(status_code=404, detail="Sheet not found")
    creds = await _get_creds(db, user.user_id)
    _, tabs, _ = await _read_or_explain(db, user.user_id, creds, cfg["sheet_id"], [])
    first = _config_tabs(cfg, tabs)[:1]
    _, _, values = await _read_or_explain(db, user.user_id, creds, cfg["sheet_id"], first)
    rows = values.get(first[0], []) if first else []
    if not rows:
        return {"headers": [], "rows": [], "total": 0}
    data = [r for r in rows[1:] if not _is_blank(r)]
    return {"headers": rows[0], "rows": data[-5:], "total": len(data)}


@sheets_router.post("/sheets/sync/{config_id}")
async def sync_sheet(config_id: str, request: Request):
    """Read every selected tab, store a snapshot, and upsert rows into
    leads_v2 under the matching stage. A row whose email/phone already
    belongs to a lead from anywhere else is skipped, not duplicated."""
    from server import db, get_current_user
    user = await get_current_user(request)
    cfg = await db.leads_sheet_configs.find_one({"config_id": config_id, "user_id": user.user_id})
    if not cfg:
        raise HTTPException(status_code=404, detail="Sheet not found")
    sheet_type = cfg["sheet_type"]
    creds = await _get_creds(db, user.user_id)
    _, all_tabs, _ = await _read_or_explain(db, user.user_id, creds, cfg["sheet_id"], [])
    titles = _config_tabs(cfg, all_tabs)
    missing = [t for t in titles if t not in {x["title"] for x in all_tabs}]
    if missing:
        raise HTTPException(status_code=400, detail=f"Tab(s) not found in the sheet anymore: {', '.join(missing)} — edit this sheet and re-pick its tabs.")
    _, _, values = await _read_or_explain(db, user.user_id, creds, cfg["sheet_id"], titles)
    # Pre-tab-picker configs keep sheet_tab None so their earlier imports
    # (which have no sheet_tab) still match by row index.
    legacy = not cfg.get("tabs")

    # Replace previous snapshot of raw rows for THIS sheet only.
    await db.leads_sheet_rows.delete_many({"config_id": config_id})

    stage = await db.lead_stages.find_one(
        {"name": {"$regex": f"^{sheet_type}$", "$options": "i"}, "is_deleted": {"$ne": True}},
        {"_id": 0, "stage_id": 1, "name": 1},
    )
    stage_id = stage.get("stage_id") if stage else ""

    # This sheet's own earlier imports are upserted, matched by (tab, row
    # index). Email/phone matching only covers imports from before row
    # indexes were stored — otherwise a second row for the same person
    # would overwrite the first one's lead.
    existing = await db.leads_v2.find(
        {"imported_from_config_id": config_id, "created_by": user.user_id, "is_deleted": {"$ne": True}},
        {"_id": 0, "lead_id": 1, "email": 1, "phone": 1, "sheet_row_index": 1, "sheet_tab": 1},
    ).to_list(50000)
    existing_by_row = {(e.get("sheet_tab"), e["sheet_row_index"]): e["lead_id"] for e in existing if e.get("sheet_row_index") is not None}
    pre_index = [e for e in existing if e.get("sheet_row_index") is None]
    existing_by_email = {(e.get("email") or "").strip().lower(): e["lead_id"] for e in pre_index if e.get("email")}
    existing_by_phone = {_normalize_phone(e.get("phone")): e["lead_id"] for e in pre_index if _normalize_phone(e.get("phone"))}
    # Leads from anywhere else — rows matching these are skipped.
    other_emails, other_phones = await _lead_keys(db, exclude_config_id=config_id)
    # People already taken by an earlier row in this sync (any tab).
    seen_emails, seen_phones = set(), set()

    sheet_docs = []
    inserted = updated = skipped_blank = skipped_existing = 0
    per_tab = []
    now = datetime.now(timezone.utc)
    seq = 0  # keeps sheet order across tabs for created_at
    for title in titles:
        rows = values.get(title, [])
        tab_key = None if legacy else title
        t_ins = t_upd = t_skip = 0
        if rows:
            headers_arr = [str(h).strip() for h in rows[0]]
            lower_headers = [h.lower() for h in headers_arr]
            for row_index, r in enumerate(rows[1:]):
                if _is_blank(r):
                    skipped_blank += 1
                    continue
                seq += 1
                record = {h: (r[i] if i < len(r) else "") for i, h in enumerate(headers_arr)}
                row_id = f"row_{uuid.uuid4().hex[:12]}"
                email_key, phone_key = _row_keys(lower_headers, r)
                existing_lead_id = (
                    existing_by_row.get((tab_key, row_index))
                    or (existing_by_email.get(email_key) if email_key else None)
                    or (existing_by_phone.get(phone_key) if phone_key else None)
                )
                duplicate = not existing_lead_id and bool(
                    (email_key and (email_key in other_emails or email_key in seen_emails))
                    or (phone_key and (phone_key in other_phones or phone_key in seen_phones))
                )
                sheet_docs.append({
                    "row_id": row_id, "user_id": user.user_id, "config_id": config_id, "sheet_type": sheet_type,
                    "sheet_tab": title, "source_type": cfg.get("source_type") or "website",
                    "data": record, "already_in_leads": bool(duplicate), "imported_at": now,
                })
                if duplicate:
                    skipped_existing += 1
                    t_skip += 1
                    continue
                if email_key:
                    seen_emails.add(email_key)
                if phone_key:
                    seen_phones.add(phone_key)
                common_fields = {
                    "name": str(_cell(lower_headers, r, NAME_COLS)).strip() or "—",
                    "phone": str(_cell(lower_headers, r, PHONE_COLS)).strip(),
                    "email": str(_cell(lower_headers, r, EMAIL_COLS)).strip(),
                    "location": str(_cell(lower_headers, r, LOCATION_COLS)).strip(),
                    "website": str(_cell(lower_headers, r, WEBSITE_COLS)).strip(),
                    "company_name": str(_cell(lower_headers, r, COMPANY_COLS)).strip(),
                    "what_do_you_do": str(_cell(lower_headers, r, WHAT_COLS)).strip(),
                    "source": cfg.get("source_type") or "website",
                    "lead_owner": user.user_id,
                    "notes": str(_cell(lower_headers, r, NOTES_COLS)).strip(),
                    "imported_from_sheet": sheet_type,
                    "imported_from_config_id": config_id,
                    "sheet_tab": tab_key,
                    "sheet_row_id": row_id,
                    "sheet_row_index": row_index,
                    "custom_fields": {k: v for k, v in record.items() if k.lower() not in MAPPED_COLS},
                    "updated_at": now,
                    "is_deleted": False,
                }
                if existing_lead_id:
                    # UPSERT — keep stage_id, lead_id and manual edits; refresh sheet fields only.
                    await db.leads_v2.update_one({"lead_id": existing_lead_id}, {"$set": common_fields})
                    updated += 1
                    t_upd += 1
                else:
                    # Offset by sheet order so newest-first sorting keeps the sheet's row order.
                    await db.leads_v2.insert_one({
                        "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                        "stage_id": stage_id,
                        "created_by": user.user_id,
                        "created_at": now + timedelta(microseconds=seq),
                        **common_fields,
                    })
                    inserted += 1
                    t_ins += 1
        per_tab.append({"title": title, "inserted": t_ins, "updated": t_upd, "skipped_existing": t_skip})

    if sheet_docs:
        await db.leads_sheet_rows.insert_many(sheet_docs)

    total_synced = inserted + updated
    await db.leads_sheet_configs.update_one(
        {"config_id": config_id},
        {"$set": {"last_synced_at": now, "last_synced_count": total_synced, "last_skipped_existing": skipped_existing}},
    )
    return {
        "synced": total_synced,
        "inserted": inserted,
        "updated": updated,
        "skipped_blank": skipped_blank,
        "skipped_existing": skipped_existing,
        "tabs": per_tab,
        "stage_id": stage_id,
        "stage_matched": bool(stage_id),
        "last_synced_at": now,
    }


@sheets_router.get("/sheets/rows/{config_id}")
async def list_rows(config_id: str, request: Request, limit: int = 100):
    from server import db, get_current_user
    user = await get_current_user(request)
    docs = await db.leads_sheet_rows.find(
        {"user_id": user.user_id, "config_id": config_id},
        {"_id": 0},
    ).sort("imported_at", -1).to_list(limit)
    return docs
