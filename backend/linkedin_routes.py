"""
LinkedIn Integration Routes — first slice per the "LinkedIn Auto-Scheduling"
plan: personal-profile OAuth connect + a manual "Publish Now" call. No
background scheduler yet (see backend/linkedin_scheduler.py, added in a
later slice, for the actual auto-publish-at-scheduled-time piece).

Mirrors backend/google_calendar_routes.py's OAuth shape. Key difference:
LinkedIn's standard 3-legged access tokens (~60 days) do NOT come with a
refresh token unless the app has the separate, approval-gated
"Programmatic Refresh Tokens" product — so there is no refresh_access_token
here. Once a token expires, the user just reconnects.
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import os
import requests
import logging

logger = logging.getLogger(__name__)

linkedin_router = APIRouter(prefix="/oauth/linkedin", tags=["LinkedIn"])

db = None


def init_linkedin_db(database):
    global db
    db = database

LINKEDIN_CLIENT_ID = os.environ.get("LINKEDIN_CLIENT_ID", "")
LINKEDIN_CLIENT_SECRET = os.environ.get("LINKEDIN_CLIENT_SECRET", "")
FRONTEND_URL = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")[0]
LINKEDIN_REDIRECT_URI = os.environ.get(
    "LINKEDIN_REDIRECT_URI", "https://os.drawlead.com/api/oauth/linkedin/callback"
)

# "Share on LinkedIn" (w_member_social) + OpenID Connect (to resolve the
# member's URN via /v2/userinfo) — both self-serve products.
SCOPES = ["openid", "profile", "w_member_social"]

LINKEDIN_API_VERSION = "202405"  # LinkedIn-Version header, YYYYMM


class LinkedInPublishRequest(BaseModel):
    text: str
    link: Optional[str] = None


async def get_linkedin_connection(user_id: str):
    return await db.linkedin_connections.find_one(
        {"user_id": user_id, "is_active": True}, {"_id": 0}
    )


async def get_valid_linkedin_credentials(user_id: str):
    """No refresh path (see module docstring) — returns None past expiry,
    forcing the caller to prompt reconnect rather than silently failing."""
    connection = await get_linkedin_connection(user_id)
    if not connection:
        return None
    expiry = connection.get("token_expiry")
    if expiry:
        if isinstance(expiry, str):
            expiry = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) >= expiry:
            return None
    return connection


async def publish_linkedin_post(user_id: str, text: str, link: Optional[str] = None) -> str:
    """Publish a text (+ optional link) post to the user's personal LinkedIn
    profile. Raises HTTPException on any failure — callers decide how to
    surface that (e.g. store publish_error on a Content Calendar entry)."""
    connection = await get_valid_linkedin_credentials(user_id)
    if not connection:
        raise HTTPException(status_code=400, detail="LinkedIn account not connected or needs reconnecting")

    author_urn = connection["linkedin_member_urn"]
    body = {
        "author": author_urn,
        "commentary": text,
        "visibility": "PUBLIC",
        "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    if link:
        body["content"] = {"article": {"source": link}}

    resp = requests.post(
        "https://api.linkedin.com/rest/posts",
        headers={
            "Authorization": f"Bearer {connection['access_token']}",
            "LinkedIn-Version": LINKEDIN_API_VERSION,
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=20,
    )
    if resp.status_code not in (200, 201):
        logger.error(f"LinkedIn publish failed for user {user_id}: {resp.status_code} {resp.text}")
        raise HTTPException(status_code=502, detail=f"LinkedIn publish failed: {resp.text[:300]}")

    # LinkedIn returns the new post's URN in the x-restli-id / x-linkedin-id header.
    return resp.headers.get("x-restli-id") or resp.headers.get("x-linkedin-id") or ""


# ============== OAUTH ROUTES ==============

@linkedin_router.get("/connect")
async def start_oauth(request: Request):
    from server import get_current_user
    user = await get_current_user(request)

    if not LINKEDIN_CLIENT_ID or not LINKEDIN_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="LinkedIn is not configured")

    auth_url = (
        "https://www.linkedin.com/oauth/v2/authorization"
        f"?client_id={LINKEDIN_CLIENT_ID}"
        f"&redirect_uri={LINKEDIN_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={'%20'.join(SCOPES)}"
        f"&state={user.user_id}"
    )
    return {"authorization_url": auth_url}


@linkedin_router.get("/callback")
async def oauth_callback(code: str = None, state: str = None, error: str = None):
    if error:
        logger.error(f"LinkedIn OAuth error: {error}")
        return RedirectResponse(f"{FRONTEND_URL}/dashboard?linkedin_error={error}")
    if not code:
        return RedirectResponse(f"{FRONTEND_URL}/dashboard?linkedin_error=no_code")

    user_id = state
    if not user_id:
        return RedirectResponse(f"{FRONTEND_URL}/dashboard?linkedin_error=invalid_state")

    try:
        token_resp = requests.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": LINKEDIN_REDIRECT_URI,
                "client_id": LINKEDIN_CLIENT_ID,
                "client_secret": LINKEDIN_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=20,
        )
        if token_resp.status_code != 200:
            logger.error(f"LinkedIn token exchange failed: {token_resp.text}")
            return RedirectResponse(f"{FRONTEND_URL}/dashboard?linkedin_error=token_exchange_failed")

        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        expires_in = tokens.get("expires_in", 60 * 24 * 3600)

        userinfo_resp = requests.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=20,
        )
        member_urn, linkedin_name = None, "LinkedIn User"
        if userinfo_resp.status_code == 200:
            info = userinfo_resp.json()
            member_urn = f"urn:li:person:{info.get('sub')}"
            linkedin_name = info.get("name") or linkedin_name

        if not member_urn:
            logger.error(f"LinkedIn userinfo lookup failed: {userinfo_resp.text}")
            return RedirectResponse(f"{FRONTEND_URL}/dashboard?linkedin_error=userinfo_failed")

        connection_doc = {
            "user_id": user_id,
            "linkedin_member_urn": member_urn,
            "linkedin_name": linkedin_name,
            "access_token": access_token,
            "token_expiry": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
            "connected_at": datetime.now(timezone.utc),
            "is_active": True,
        }
        await db.linkedin_connections.update_one(
            {"user_id": user_id}, {"$set": connection_doc}, upsert=True
        )
        logger.info(f"LinkedIn connected for user {user_id} ({linkedin_name})")
        return RedirectResponse(f"{FRONTEND_URL}/dashboard?linkedin_connected=true")
    except Exception as e:
        logger.error(f"LinkedIn OAuth callback error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/dashboard?linkedin_error=callback_failed")


@linkedin_router.get("/status")
async def get_connection_status(request: Request):
    from server import get_current_user
    user = await get_current_user(request)
    connection = await get_linkedin_connection(user.user_id)
    if connection:
        return {
            "connected": True,
            "linkedin_name": connection.get("linkedin_name"),
            "connected_at": connection.get("connected_at"),
            "token_expiry": connection.get("token_expiry"),
        }
    return {"connected": False}


@linkedin_router.post("/disconnect")
async def disconnect_linkedin(request: Request):
    from server import get_current_user
    user = await get_current_user(request)
    await db.linkedin_connections.update_one(
        {"user_id": user.user_id}, {"$set": {"is_active": False}}
    )
    return {"message": "LinkedIn disconnected"}


@linkedin_router.post("/publish")
async def publish_now(payload: LinkedInPublishRequest, request: Request):
    """Manual "Publish Now" — posts as the CURRENT user's connected LinkedIn
    account. First slice: no scheduler, this is a synchronous call."""
    from server import get_current_user
    user = await get_current_user(request)
    post_urn = await publish_linkedin_post(user.user_id, payload.text, payload.link)
    return {"published": True, "linkedin_post_urn": post_urn}
