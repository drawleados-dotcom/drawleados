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

sheets_router = APIRouter(tags=["google-sheets"])

# Env values read lazily (server.py loads dotenv after importing this module)
def _env():
    return {
        "client_id": os.environ.get("GOOGLE_SHEETS_CLIENT_ID"),
        "client_secret": os.environ.get("GOOGLE_SHEETS_CLIENT_SECRET"),
        "redirect_uri": os.environ.get("GOOGLE_SHEETS_REDIRECT_URI"),
    }


def _compute_redirect_uri(request: Optional[Request]) -> str:
    """Derive callback URL from the incoming request so the same code works
    on preview & production. Falls back to GOOGLE_SHEETS_REDIRECT_URI env var."""
    cfg_uri = os.environ.get("GOOGLE_SHEETS_REDIRECT_URI")
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


def _flow(redirect_uri: Optional[str] = None):
    cfg = _env()
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
    cfg = _env()
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
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"Token refresh failed: {e}. Reconnect Google.")
    return creds


# ---------- OAuth flow ----------
@sheets_router.get("/oauth/sheets/login")
async def sheets_login(request: Request, user_id: str, sheet_type: str = "prospect"):
    """Returns the Google consent screen URL. Frontend opens this in a popup."""
    from server import db
    if sheet_type not in SHEET_TYPES:
        raise HTTPException(status_code=400, detail="sheet_type must be 'prospect' or 'lead'")
    redirect_uri = _compute_redirect_uri(request)
    flow = _flow(redirect_uri=redirect_uri)
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
        redirect_uri = rec.get("redirect_uri") or _compute_redirect_uri(request)

        flow = _flow(redirect_uri=redirect_uri)
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


# ---------- Sheet config CRUD ----------
class SheetConfig(BaseModel):
    sheet_type: str  # 'prospect' | 'lead'
    name: Optional[str] = ""
    sheet_url: str
    source_type: Optional[str] = "website"  # meta | whatsapp | website | walk_in | referral | link | other


@sheets_router.get("/sheets/configs")
async def list_configs(request: Request):
    from server import db, get_current_user
    user = await get_current_user(request)
    docs = await db.leads_sheet_configs.find({"user_id": user.user_id}, {"_id": 0}).to_list(20)
    by_type = {d.get("sheet_type"): d for d in docs}
    return {
        "prospect": by_type.get("prospect"),
        "lead": by_type.get("lead"),
    }


@sheets_router.post("/sheets/config")
async def save_config(payload: SheetConfig, request: Request):
    from server import db, get_current_user
    user = await get_current_user(request)
    if payload.sheet_type not in SHEET_TYPES:
        raise HTTPException(status_code=400, detail="sheet_type must be 'prospect' or 'lead'")
    sheet_id = _extract_sheet_id(payload.sheet_url)
    if not sheet_id:
        raise HTTPException(status_code=400, detail="Could not parse a Google Sheet ID from that URL")
    doc = {
        "user_id": user.user_id,
        "sheet_type": payload.sheet_type,
        "name": (payload.name or "").strip(),
        "sheet_url": payload.sheet_url,
        "sheet_id": sheet_id,
        "source_type": payload.source_type or "website",
        "last_synced_at": None,
        "last_synced_count": 0,
        "updated_at": datetime.now(timezone.utc),
    }
    await db.leads_sheet_configs.update_one(
        {"user_id": user.user_id, "sheet_type": payload.sheet_type},
        {"$set": doc},
        upsert=True,
    )
    saved = await db.leads_sheet_configs.find_one(
        {"user_id": user.user_id, "sheet_type": payload.sheet_type},
        {"_id": 0},
    )
    return saved


@sheets_router.delete("/sheets/config/{sheet_type}")
async def delete_config(sheet_type: str, request: Request):
    from server import db, get_current_user
    user = await get_current_user(request)
    if sheet_type not in SHEET_TYPES:
        raise HTTPException(status_code=400, detail="sheet_type must be 'prospect' or 'lead'")
    await db.leads_sheet_configs.delete_one({"user_id": user.user_id, "sheet_type": sheet_type})
    await db.leads_sheet_rows.delete_many({"user_id": user.user_id, "sheet_type": sheet_type})
    return {"message": "Removed"}


# ---------- Read sheet & preview / sync ----------
def _read_sheet_rows(creds: Credentials, sheet_id: str, range_: str = "A1:Z200"):
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)
    result = service.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range=range_,
    ).execute()
    return result.get("values", [])


@sheets_router.get("/sheets/preview/{sheet_type}")
async def preview_sheet(sheet_type: str, request: Request):
    from server import db, get_current_user
    user = await get_current_user(request)
    if sheet_type not in SHEET_TYPES:
        raise HTTPException(status_code=400, detail="sheet_type must be 'prospect' or 'lead'")
    cfg = await db.leads_sheet_configs.find_one({"user_id": user.user_id, "sheet_type": sheet_type})
    if not cfg:
        raise HTTPException(status_code=404, detail="No sheet configured for this type")
    creds = await _get_creds(db, user.user_id)
    rows = await asyncio.to_thread(_read_sheet_rows, creds, cfg["sheet_id"])
    if not rows:
        return {"headers": [], "rows": [], "total": 0}
    headers = rows[0]
    data = rows[1:] if len(rows) > 1 else []
    return {
        "headers": headers,
        "rows": data[-5:],  # last 5 only for the preview
        "total": len(data),
    }


@sheets_router.post("/sheets/sync/{sheet_type}")
async def sync_sheet(sheet_type: str, request: Request):
    """Read every row from the connected sheet, store snapshot + push into leads_v2 under matching stage."""
    from server import db, get_current_user
    user = await get_current_user(request)
    if sheet_type not in SHEET_TYPES:
        raise HTTPException(status_code=400, detail="sheet_type must be 'prospect' or 'lead'")
    cfg = await db.leads_sheet_configs.find_one({"user_id": user.user_id, "sheet_type": sheet_type})
    if not cfg:
        raise HTTPException(status_code=404, detail="No sheet configured for this type")
    creds = await _get_creds(db, user.user_id)
    rows = await asyncio.to_thread(_read_sheet_rows, creds, cfg["sheet_id"])
    if not rows:
        return {"synced": 0, "note": "Sheet is empty"}
    headers_arr = [h.strip() for h in rows[0]]
    body_rows = rows[1:]

    # Replace previous snapshot of raw rows
    await db.leads_sheet_rows.delete_many({"user_id": user.user_id, "sheet_type": sheet_type})

    # Find matching stage_id for this sheet type ('lead' or 'prospect')
    stage = await db.lead_stages.find_one(
        {"name": {"$regex": f"^{sheet_type}$", "$options": "i"}, "is_deleted": {"$ne": True}},
        {"_id": 0, "stage_id": 1, "name": 1},
    )
    stage_id = stage.get("stage_id") if stage else ""

    # Remove previously sheet-imported leads for this sheet_type so re-sync is idempotent
    await db.leads_v2.delete_many({
        "imported_from_sheet": sheet_type,
        "created_by": user.user_id,
    })

    sheet_docs = []
    lead_docs = []
    lower_headers = [h.lower() for h in headers_arr]

    def _col(row, *candidates):
        for c in candidates:
            if c in lower_headers:
                idx = lower_headers.index(c)
                if idx < len(row):
                    return row[idx]
        return ""

    now = datetime.now(timezone.utc)
    for r in body_rows:
        record = {h: (r[i] if i < len(r) else "") for i, h in enumerate(headers_arr)}
        row_id = f"row_{uuid.uuid4().hex[:12]}"
        sheet_docs.append({
            "row_id": row_id,
            "user_id": user.user_id,
            "sheet_type": sheet_type,
            "source_type": cfg.get("source_type") or "website",
            "data": record,
            "imported_at": now,
        })
        # Map common column names → lead_v2 fields
        name = _col(r, "name", "lead_name", "full name", "contact name") or "—"
        phone = _col(r, "phone", "mobile", "contact", "phone number")
        email = _col(r, "email", "email id", "e-mail")
        notes = _col(r, "notes", "remarks", "comments", "message")
        lead_docs.append({
            "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
            "name": str(name).strip() or "—",
            "phone": str(phone).strip(),
            "email": str(email).strip(),
            "source": cfg.get("source_type") or "website",
            "stage_id": stage_id,
            "lead_owner": user.user_id,
            "notes": str(notes).strip(),
            "imported_from_sheet": sheet_type,
            "sheet_row_id": row_id,
            "custom_fields": {k: v for k, v in record.items() if k.lower() not in ("name", "lead_name", "phone", "mobile", "email", "notes")},
            "created_by": user.user_id,
            "created_at": now,
            "updated_at": now,
            "is_deleted": False,
        })

    if sheet_docs:
        await db.leads_sheet_rows.insert_many(sheet_docs)
    if lead_docs:
        await db.leads_v2.insert_many(lead_docs)

    await db.leads_sheet_configs.update_one(
        {"user_id": user.user_id, "sheet_type": sheet_type},
        {"$set": {"last_synced_at": now, "last_synced_count": len(lead_docs)}},
    )
    return {
        "synced": len(lead_docs),
        "stage_id": stage_id,
        "stage_matched": bool(stage_id),
        "last_synced_at": now,
    }


@sheets_router.get("/sheets/rows/{sheet_type}")
async def list_rows(sheet_type: str, request: Request, limit: int = 100):
    from server import db, get_current_user
    user = await get_current_user(request)
    docs = await db.leads_sheet_rows.find(
        {"user_id": user.user_id, "sheet_type": sheet_type},
        {"_id": 0},
    ).sort("imported_at", -1).to_list(limit)
    return docs
