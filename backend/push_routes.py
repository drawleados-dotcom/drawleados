"""
Web Push notifications — browser/mobile-Chrome push that arrives even when
Drawlead OS isn't open, via a service worker + the Push API.

Requires VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_CLAIMS_EMAIL in
backend/.env (see DEPLOY.md or ask whoever generated them). Without those,
subscribe/send just fail gracefully — no crash, pushes simply don't go out.

Triggers wired up:
- Task assigned to someone else (our_tasks_routes.create_task)
- Daily, once each: standard_login_time ("work day started"),
  the active lunch_schedule's lunch_start_time ("lunch time"),
  standard_logout_time ("time to log out") — all read from the same HR
  settings/lunch-schedule the rest of the app already uses, not hardcoded,
  so changing office hours in HR Admin changes these too.
- Any open break exceeding 45 minutes ("your break has run long") — checked
  every 5 minutes, one notification per break (not repeated every cycle).
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import asyncio
import json
import logging
import os

push_router = APIRouter(prefix="/push", tags=["push"])

db = None


def init_push_db(database):
    global db
    db = database


VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS_EMAIL = os.environ.get("VAPID_CLAIMS_EMAIL", "admin@drawlead.com")
PUSH_ENABLED = bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)

if not PUSH_ENABLED:
    logging.warning(
        "Push notifications disabled — VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set in backend/.env"
    )

try:
    from pywebpush import webpush, WebPushException
except ImportError:
    webpush = None
    WebPushException = Exception
    logging.warning("pywebpush not installed — push notifications disabled")


class PushSubscriptionPayload(BaseModel):
    endpoint: str
    keys: Dict[str, str]  # {"p256dh": ..., "auth": ...}


@push_router.get("/vapid-public-key")
async def get_vapid_public_key():
    return {"publicKey": VAPID_PUBLIC_KEY, "enabled": PUSH_ENABLED}


@push_router.post("/subscribe")
async def subscribe(payload: PushSubscriptionPayload, request: Request):
    from server import get_current_user
    user = await get_current_user(request)
    await db.push_subscriptions.update_one(
        {"user_id": user.user_id, "endpoint": payload.endpoint},
        {"$set": {
            "user_id": user.user_id,
            "endpoint": payload.endpoint,
            "keys": payload.keys,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"message": "Subscribed"}


@push_router.post("/unsubscribe")
async def unsubscribe(payload: Dict[str, Any], request: Request):
    from server import get_current_user
    user = await get_current_user(request)
    endpoint = payload.get("endpoint")
    if endpoint:
        await db.push_subscriptions.delete_one({"user_id": user.user_id, "endpoint": endpoint})
    else:
        await db.push_subscriptions.delete_many({"user_id": user.user_id})
    return {"message": "Unsubscribed"}


async def _send_to_subscription(sub: dict, title: str, body: str, url: str):
    if not PUSH_ENABLED or webpush is None:
        return
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": f"mailto:{VAPID_CLAIMS_EMAIL}"},
        )
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        if status in (404, 410):
            # Subscription expired/revoked on the browser side — stop trying it.
            await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
        else:
            logging.warning(f"Push send failed for {sub.get('endpoint', '')[:60]}: {e}")
    except Exception as e:
        logging.warning(f"Push send error: {e}")


async def send_push_notification(user_id: str, title: str, body: str, url: str = "/"):
    """Push to every device a specific user has subscribed on."""
    if not PUSH_ENABLED:
        return
    subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(20)
    await asyncio.gather(*[_send_to_subscription(s, title, body, url) for s in subs])


async def send_push_to_all(title: str, body: str, url: str = "/"):
    """Push to every subscribed device across every user — used for the
    daily work/lunch/logout reminders."""
    if not PUSH_ENABLED:
        return
    subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(5000)
    await asyncio.gather(*[_send_to_subscription(s, title, body, url) for s in subs])


# ============== SCHEDULER ==============
# A plain asyncio loop rather than a new scheduler dependency (APScheduler
# etc.) — this backend already uses asyncio.create_task for fire-and-forget
# background work (see notification_service usage throughout hr_routes.py),
# so this matches the existing pattern instead of adding new machinery.

IST = timezone(timedelta(hours=5, minutes=30))


async def _get_hr_settings_times():
    settings = await db.hr_settings.find_one({}, {"_id": 0}) or {}
    return (
        settings.get("standard_login_time", "10:00"),
        settings.get("standard_logout_time", "18:00"),
    )


async def _get_active_lunch_start():
    today_str = datetime.now(IST).strftime("%Y-%m-%d")
    entries = await db.lunch_schedule.find({}, {"_id": 0}).sort("effective_from", -1).to_list(200)
    active = next((e for e in entries if e.get("effective_from", "") <= today_str), None)
    return (active or {}).get("lunch_start_time", "13:00")


async def _check_long_breaks():
    """Anyone whose current break has run past 45 minutes gets nudged once
    per break — tracked via a `long_break_notified` flag on the open break
    entry itself so this doesn't re-fire every 5-minute cycle."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    records = await db.attendance.find(
        {"date": {"$gte": today_start}, "breaks.end_time": None},
        {"_id": 0, "attendance_id": 1, "user_id": 1, "breaks": 1},
    ).to_list(500)
    for r in records:
        breaks = r.get("breaks") or []
        changed = False
        for b in breaks:
            if b.get("end_time") is not None or b.get("long_break_notified"):
                continue
            start = b.get("start_time")
            if isinstance(start, str):
                start = datetime.fromisoformat(start.replace("Z", "+00:00"))
            if not start:
                continue
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            elapsed_minutes = (now - start).total_seconds() / 60
            if elapsed_minutes > 45:
                await send_push_notification(
                    r["user_id"],
                    "Break running long",
                    "Your break has been over 45 minutes — remember to clock back in.",
                    url="/",
                )
                b["long_break_notified"] = True
                changed = True
        if changed:
            await db.attendance.update_one(
                {"attendance_id": r["attendance_id"]}, {"$set": {"breaks": breaks}}
            )


async def push_scheduler_loop():
    """Runs for the life of the process. Checks every minute for the three
    daily HH:MM triggers (fires once per day, tracked in-memory by date), and
    every 5 minutes for long-running breaks."""
    if not PUSH_ENABLED:
        return
    last_fired = {"login": None, "lunch": None, "logout": None}
    last_break_check = None
    while True:
        try:
            now_ist = datetime.now(IST)
            today = now_ist.strftime("%Y-%m-%d")
            hhmm = now_ist.strftime("%H:%M")

            login_time, logout_time = await _get_hr_settings_times()
            lunch_time = await _get_active_lunch_start()

            if hhmm == login_time and last_fired["login"] != today:
                await send_push_to_all("Work day started", "Good morning! It's time to clock in.", url="/")
                last_fired["login"] = today
            if hhmm == lunch_time and last_fired["lunch"] != today:
                await send_push_to_all("Lunch time", "It's lunch time!", url="/")
                last_fired["lunch"] = today
            if hhmm == logout_time and last_fired["logout"] != today:
                await send_push_to_all("Time to log out", "It's time to clock out for the day.", url="/")
                last_fired["logout"] = today

            if last_break_check is None or (now_ist - last_break_check) >= timedelta(minutes=5):
                await _check_long_breaks()
                last_break_check = now_ist
        except Exception as e:
            logging.warning(f"push_scheduler_loop tick failed: {e}")
        await asyncio.sleep(60)
