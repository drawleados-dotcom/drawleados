"""
Social Media & Creative Design Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

social_media_router = APIRouter(prefix="/social-media", tags=["social-media"])
creative_router = APIRouter(prefix="/creative", tags=["creative"])

db = None

def init_social_creative_db(database):
    global db
    db = database

# ============== SOCIAL MEDIA MODELS ==============

class SocialPost(BaseModel):
    platform: str  # instagram, facebook, linkedin, twitter, youtube
    content_type: str  # Image, Video, Carousel, Reel, Story, Text
    caption: str = ""
    hashtags: str = ""
    design_url: str = ""
    scheduled_date: str = ""
    scheduled_time: str = ""
    status: str = "Draft"  # Draft, In Review, Approved, Scheduled, Posted
    assigned_to: str = ""
    project_id: str = ""

class SocialProject(BaseModel):
    name: str
    client_name: str = ""
    description: str = ""
    platform: str = ""

# ============== SOCIAL MEDIA ROUTES ==============

@social_media_router.get("/posts")
async def get_social_posts(platform: str = None):
    """Get all social media posts"""
    try:
        query = {}
        if platform:
            query["platform"] = platform
        posts = await db.social_posts.find(query, {"_id": 0}).sort("scheduled_date", -1).to_list(500)
        return posts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_media_router.post("/posts")
async def create_social_post(post: SocialPost):
    """Create a social media post"""
    try:
        post_doc = {
            "post_id": f"post_{uuid.uuid4().hex[:12]}",
            **post.dict(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.social_posts.insert_one(post_doc)
        return {"message": "Post created", "post_id": post_doc["post_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_media_router.put("/posts/{post_id}")
async def update_social_post(post_id: str, update: dict):
    """Update a social media post"""
    try:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.social_posts.update_one({"post_id": post_id}, {"$set": update})
        return {"message": "Post updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_media_router.delete("/posts/{post_id}")
async def delete_social_post(post_id: str):
    """Delete a social media post"""
    try:
        await db.social_posts.delete_one({"post_id": post_id})
        return {"message": "Post deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_media_router.get("/projects")
async def get_social_projects():
    """Get all social media projects"""
    try:
        projects = await db.social_projects.find({}, {"_id": 0}).to_list(100)
        return projects
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@social_media_router.post("/projects")
async def create_social_project(project: SocialProject):
    """Create a social media project"""
    try:
        project_doc = {
            "project_id": f"smproj_{uuid.uuid4().hex[:12]}",
            **project.dict(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.social_projects.insert_one(project_doc)
        return {"message": "Project created", "project_id": project_doc["project_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============== CREATIVE DESIGN MODELS ==============

class CreativeProject(BaseModel):
    name: str
    description: str = ""
    client_name: str = ""
    deadline: str = ""
    assigned_to: str = ""
    tag: str = "created"  # created, assigned

class StageDetail(BaseModel):
    due_date: str = ""
    assignee: str = ""
    link: str = ""
    status: str = "To-Do"

class CreativeTask(BaseModel):
    title: str
    description: str = ""
    project_id: str = ""
    design_type: str = "poster"  # poster, story, brochure, social_post, banner, logo, etc.
    design_size: str = ""
    # Stage details for tracking progress
    stages: dict = {}  # {design_content: {...}, design_file: {...}, review: {...}, final: {...}}
    overall_status: str = "To-Do"  # To-Do, In Progress, Review, Completed, On Hold
    tag: str = "created"  # created, assigned

# ============== CREATIVE DESIGN ROUTES ==============

@creative_router.get("/projects")
async def get_creative_projects():
    """Get all creative projects"""
    try:
        projects = await db.creative_projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
        return projects
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@creative_router.post("/projects")
async def create_creative_project(project: CreativeProject):
    """Create a creative project"""
    try:
        project_doc = {
            "project_id": f"cproj_{uuid.uuid4().hex[:12]}",
            **project.dict(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.creative_projects.insert_one(project_doc)
        return {"message": "Project created", "project_id": project_doc["project_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@creative_router.put("/projects/{project_id}")
async def update_creative_project(project_id: str, update: dict):
    """Update a creative project"""
    try:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.creative_projects.update_one({"project_id": project_id}, {"$set": update})
        return {"message": "Project updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@creative_router.delete("/projects/{project_id}")
async def delete_creative_project(project_id: str):
    """Delete a creative project"""
    try:
        await db.creative_projects.delete_one({"project_id": project_id})
        await db.creative_tasks.delete_many({"project_id": project_id})
        return {"message": "Project deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@creative_router.get("/tasks")
async def get_creative_tasks(project_id: str = None, stage: str = None):
    """Get all creative tasks"""
    try:
        query = {}
        if project_id:
            query["project_id"] = project_id
        if stage:
            query["stage"] = stage
        tasks = await db.creative_tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        return tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@creative_router.post("/tasks")
async def create_creative_task(task: CreativeTask):
    """Create a creative task"""
    try:
        task_data = task.dict()
        # Ensure stages is properly formatted
        if not task_data.get("stages"):
            task_data["stages"] = {
                "design_content": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "design_file": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "review": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
                "final": {"due_date": "", "assignee": "", "link": "", "status": "To-Do"},
            }
        task_doc = {
            "task_id": f"ctask_{uuid.uuid4().hex[:12]}",
            **task_data,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.creative_tasks.insert_one(task_doc)
        return {"message": "Task created", "task_id": task_doc["task_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@creative_router.put("/tasks/{task_id}")
async def update_creative_task(task_id: str, update: dict):
    """Update a creative task"""
    try:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.creative_tasks.update_one({"task_id": task_id}, {"$set": update})
        return {"message": "Task updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@creative_router.delete("/tasks/{task_id}")
async def delete_creative_task(task_id: str):
    """Delete a creative task"""
    try:
        await db.creative_tasks.delete_one({"task_id": task_id})
        return {"message": "Task deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to assign task from other departments
@creative_router.post("/tasks/assign")
async def assign_task_to_creative(task_data: dict):
    """Assign task from other departments to creative team"""
    try:
        task_doc = {
            "task_id": f"ctask_{uuid.uuid4().hex[:12]}",
            "title": task_data.get("title", ""),
            "description": task_data.get("description", ""),
            "project_id": task_data.get("project_id", ""),
            "stage": task_data.get("stage", "research"),
            "assigned_to": task_data.get("assigned_to", ""),
            "due_date": task_data.get("due_date", ""),
            "status": "To-Do",
            "link": task_data.get("link", ""),
            "tag": "assigned",  # Mark as assigned from other department
            "source_department": task_data.get("source_department", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.creative_tasks.insert_one(task_doc)
        return {"message": "Task assigned to creative team", "task_id": task_doc["task_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== DESIGN TYPES MANAGEMENT ==============

class DesignType(BaseModel):
    id: str
    name: str
    sizes: List[str] = []

@creative_router.get("/design-types")
async def get_design_types():
    """Get all design types (built-in + custom)"""
    try:
        # Built-in design types
        built_in = [
            {"id": "poster", "name": "Poster", "sizes": ["A4", "A3", "A2", "18x24", "24x36", "Custom"], "is_custom": False},
            {"id": "story", "name": "Story", "sizes": ["1080x1920", "9:16", "Custom"], "is_custom": False},
            {"id": "brochure", "name": "Brochure", "sizes": ["A4 Bi-fold", "A4 Tri-fold", "A5", "DL", "Custom"], "is_custom": False},
            {"id": "social_post", "name": "Social Post", "sizes": ["1080x1080", "1200x628", "1080x1350", "Custom"], "is_custom": False},
            {"id": "banner", "name": "Banner", "sizes": ["728x90", "300x250", "160x600", "970x250", "Custom"], "is_custom": False},
            {"id": "logo", "name": "Logo", "sizes": ["Square", "Horizontal", "Vertical", "Icon"], "is_custom": False},
            {"id": "video_thumbnail", "name": "Video Thumbnail", "sizes": ["1280x720", "1920x1080", "Custom"], "is_custom": False},
            {"id": "presentation", "name": "Presentation", "sizes": ["16:9", "4:3", "A4"], "is_custom": False},
        ]
        
        # Get custom design types from DB
        custom_types = await db.design_types.find({}, {"_id": 0}).to_list(100)
        
        return {"built_in": built_in, "custom": custom_types}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@creative_router.post("/design-types")
async def create_design_type(design_type: DesignType):
    """Create a custom design type"""
    try:
        type_doc = {
            **design_type.dict(),
            "is_custom": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.design_types.insert_one(type_doc)
        return {"message": "Design type created", "id": design_type.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@creative_router.delete("/design-types/{type_id}")
async def delete_design_type(type_id: str):
    """Delete a custom design type"""
    try:
        await db.design_types.delete_one({"id": type_id})
        return {"message": "Design type deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
