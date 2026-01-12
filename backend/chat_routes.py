"""
Slack-like Chat Module for Drawlead OS
Project-linked channels with real-time messaging
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

chat_router = APIRouter(prefix="/chat", tags=["Chat"])
db = None

def init_chat_db(database):
    global db
    db = database

# ============== MODELS ==============

class MessageCreate(BaseModel):
    content: str
    
class ChannelCreate(BaseModel):
    name: str
    description: str = ""
    project_id: Optional[str] = None
    icon: str = "#"

# ============== HELPERS ==============

async def get_current_user(request: Request):
    """Get current user from session token"""
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

# ============== CHANNEL ROUTES ==============

@chat_router.get("/channels")
async def get_all_channels(request: Request):
    """Get all chat channels"""
    user = await get_current_user(request)
    
    channels = await db.chat_channels.find(
        {},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Get unread counts for each channel
    for channel in channels:
        # Get last read timestamp for this user
        last_read = await db.chat_read_status.find_one({
            "channel_id": channel["channel_id"],
            "user_id": user["user_id"]
        })
        
        last_read_time = last_read["last_read_at"] if last_read else datetime.min.replace(tzinfo=timezone.utc)
        
        # Count unread messages
        unread_count = await db.chat_messages.count_documents({
            "channel_id": channel["channel_id"],
            "created_at": {"$gt": last_read_time},
            "user_id": {"$ne": user["user_id"]}  # Don't count own messages
        })
        
        channel["unread_count"] = unread_count
        
        # Get last message preview
        last_msg = await db.chat_messages.find_one(
            {"channel_id": channel["channel_id"]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        channel["last_message"] = last_msg
    
    return channels

@chat_router.get("/channels/project/{project_id}")
async def get_project_channel(project_id: str, request: Request):
    """Get or create a channel for a project"""
    user = await get_current_user(request)
    
    # Check if channel exists for this project
    channel = await db.chat_channels.find_one(
        {"project_id": project_id},
        {"_id": 0}
    )
    
    if not channel:
        # Get project details
        project = await db.notion_projects.find_one({"project_id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Create channel for project
        channel_id = f"ch_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        
        channel = {
            "channel_id": channel_id,
            "name": project["name"],
            "description": f"Chat for {project['name']} project",
            "icon": project.get("icon", "📁"),
            "project_id": project_id,
            "is_project_channel": True,
            "created_by": user["user_id"],
            "created_at": now
        }
        
        await db.chat_channels.insert_one(channel)
        channel.pop("_id", None)
    
    return channel

@chat_router.post("/channels")
async def create_channel(data: ChannelCreate, request: Request):
    """Create a new chat channel"""
    user = await get_current_user(request)
    
    channel_id = f"ch_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    channel_doc = {
        "channel_id": channel_id,
        "name": data.name,
        "description": data.description,
        "icon": data.icon,
        "project_id": data.project_id,
        "is_project_channel": bool(data.project_id),
        "created_by": user["user_id"],
        "created_at": now
    }
    
    await db.chat_channels.insert_one(channel_doc)
    
    return await db.chat_channels.find_one({"channel_id": channel_id}, {"_id": 0})

@chat_router.delete("/channels/{channel_id}")
async def delete_channel(channel_id: str, request: Request):
    """Delete a channel and its messages"""
    await get_current_user(request)
    
    await db.chat_channels.delete_one({"channel_id": channel_id})
    await db.chat_messages.delete_many({"channel_id": channel_id})
    await db.chat_read_status.delete_many({"channel_id": channel_id})
    
    return {"message": "Channel deleted"}

# ============== MESSAGE ROUTES ==============

@chat_router.get("/channels/{channel_id}/messages")
async def get_channel_messages(channel_id: str, request: Request, limit: int = 50, before: str = None):
    """Get messages in a channel"""
    user = await get_current_user(request)
    
    query = {"channel_id": channel_id}
    
    if before:
        query["created_at"] = {"$lt": datetime.fromisoformat(before)}
    
    messages = await db.chat_messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Reverse to get chronological order
    messages.reverse()
    
    # Mark channel as read
    await db.chat_read_status.update_one(
        {"channel_id": channel_id, "user_id": user["user_id"]},
        {"$set": {"last_read_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    return messages

@chat_router.post("/channels/{channel_id}/messages")
async def send_message(channel_id: str, data: MessageCreate, request: Request):
    """Send a message to a channel"""
    user = await get_current_user(request)
    
    # Verify channel exists
    channel = await db.chat_channels.find_one({"channel_id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    message_doc = {
        "message_id": message_id,
        "channel_id": channel_id,
        "content": data.content,
        "user_id": user["user_id"],
        "user_name": user.get("name", "Unknown"),
        "user_picture": user.get("picture"),
        "created_at": now,
        "edited_at": None,
        "is_edited": False
    }
    
    await db.chat_messages.insert_one(message_doc)
    
    # Update read status for sender
    await db.chat_read_status.update_one(
        {"channel_id": channel_id, "user_id": user["user_id"]},
        {"$set": {"last_read_at": now}},
        upsert=True
    )
    
    return await db.chat_messages.find_one({"message_id": message_id}, {"_id": 0})

@chat_router.put("/channels/{channel_id}/messages/{message_id}")
async def edit_message(channel_id: str, message_id: str, data: MessageCreate, request: Request):
    """Edit a message"""
    user = await get_current_user(request)
    
    # Verify ownership
    message = await db.chat_messages.find_one({"message_id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Can only edit your own messages")
    
    await db.chat_messages.update_one(
        {"message_id": message_id},
        {"$set": {
            "content": data.content,
            "edited_at": datetime.now(timezone.utc),
            "is_edited": True
        }}
    )
    
    return await db.chat_messages.find_one({"message_id": message_id}, {"_id": 0})

@chat_router.delete("/channels/{channel_id}/messages/{message_id}")
async def delete_message(channel_id: str, message_id: str, request: Request):
    """Delete a message"""
    user = await get_current_user(request)
    
    # Verify ownership
    message = await db.chat_messages.find_one({"message_id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Can only delete your own messages")
    
    await db.chat_messages.delete_one({"message_id": message_id})
    
    return {"message": "Message deleted"}

# ============== READ STATUS ==============

@chat_router.post("/channels/{channel_id}/read")
async def mark_channel_read(channel_id: str, request: Request):
    """Mark all messages in a channel as read"""
    user = await get_current_user(request)
    
    await db.chat_read_status.update_one(
        {"channel_id": channel_id, "user_id": user["user_id"]},
        {"$set": {"last_read_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    return {"message": "Channel marked as read"}

@chat_router.get("/unread-count")
async def get_total_unread_count(request: Request):
    """Get total unread message count across all channels"""
    user = await get_current_user(request)
    
    channels = await db.chat_channels.find({}, {"channel_id": 1}).to_list(100)
    
    total_unread = 0
    for channel in channels:
        last_read = await db.chat_read_status.find_one({
            "channel_id": channel["channel_id"],
            "user_id": user["user_id"]
        })
        
        last_read_time = last_read["last_read_at"] if last_read else datetime.min.replace(tzinfo=timezone.utc)
        
        unread = await db.chat_messages.count_documents({
            "channel_id": channel["channel_id"],
            "created_at": {"$gt": last_read_time},
            "user_id": {"$ne": user["user_id"]}
        })
        
        total_unread += unread
    
    return {"unread_count": total_unread}

# ============== ONLINE STATUS ==============

@chat_router.post("/online")
async def update_online_status(request: Request):
    """Update user's online status (heartbeat)"""
    user = await get_current_user(request)
    
    await db.user_online_status.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "user_id": user["user_id"],
            "user_name": user.get("name"),
            "last_seen": datetime.now(timezone.utc),
            "is_online": True
        }},
        upsert=True
    )
    
    return {"status": "online"}

@chat_router.get("/online-users")
async def get_online_users(request: Request):
    """Get list of online users (active in last 2 minutes)"""
    await get_current_user(request)
    
    cutoff = datetime.now(timezone.utc).replace(microsecond=0)
    from datetime import timedelta
    cutoff = cutoff - timedelta(minutes=2)
    
    online_users = await db.user_online_status.find(
        {"last_seen": {"$gt": cutoff}},
        {"_id": 0}
    ).to_list(100)
    
    return online_users
