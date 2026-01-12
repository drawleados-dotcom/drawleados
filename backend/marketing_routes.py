"""
Marketing Module for Drawlead OS
- Google Analytics integration
- WordPress blog publishing
- Social media content calendars
- Gmail visibility
- Marketing dashboard
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid

marketing_router = APIRouter(prefix="/marketing", tags=["Marketing"])
db = None

def init_marketing_db(database):
    global db
    db = database

# ============== ENUMS ==============

class ContentStatus(str, Enum):
    IDEA = "idea"
    IN_CREATION = "in_creation"
    REVIEW = "review"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"

class Platform(str, Enum):
    INSTAGRAM = "instagram"
    LINKEDIN = "linkedin"
    YOUTUBE = "youtube"
    TWITTER = "twitter"

class ContentType(str, Enum):
    POST = "post"
    REEL = "reel"
    VIDEO = "video"
    SHORT = "short"
    ARTICLE = "article"
    TWEET = "tweet"
    THREAD = "thread"

class BlogStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"

# ============== MODELS ==============

class SocialContentCreate(BaseModel):
    title: str
    platform: Platform
    content_type: ContentType
    caption: str = ""
    hashtags: List[str] = []
    creative_url: str = ""
    assigned_to: Optional[str] = None
    status: ContentStatus = ContentStatus.IDEA
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    # Platform specific
    audio: Optional[str] = None  # Instagram
    duration: Optional[str] = None  # Instagram/YouTube
    cta: Optional[str] = None  # LinkedIn
    video_url: Optional[str] = None  # YouTube
    thumbnail_url: Optional[str] = None  # YouTube
    is_thread: bool = False  # Twitter

class SocialContentUpdate(BaseModel):
    title: Optional[str] = None
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    creative_url: Optional[str] = None
    assigned_to: Optional[str] = None
    status: Optional[ContentStatus] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    audio: Optional[str] = None
    duration: Optional[str] = None
    cta: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_thread: Optional[bool] = None

class BlogPostCreate(BaseModel):
    title: str
    slug: str
    content: str
    featured_image: str = ""
    category: str = ""
    tags: List[str] = []
    seo_title: str = ""
    seo_description: str = ""
    status: BlogStatus = BlogStatus.DRAFT
    scheduled_date: Optional[str] = None

class IntegrationSettings(BaseModel):
    type: str  # 'google_analytics', 'wordpress', 'gmail'
    settings: Dict[str, Any]

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

# ============== SOCIAL MEDIA CONTENT ROUTES ==============

@marketing_router.get("/content")
async def get_all_content(
    request: Request,
    platform: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get all social media content with filters"""
    await get_current_user(request)
    
    query = {}
    if platform:
        query["platform"] = platform
    if status:
        query["status"] = status
    if start_date:
        query["scheduled_date"] = {"$gte": start_date}
    if end_date:
        if "scheduled_date" in query:
            query["scheduled_date"]["$lte"] = end_date
        else:
            query["scheduled_date"] = {"$lte": end_date}
    
    content = await db.marketing_content.find(
        query,
        {"_id": 0}
    ).sort("scheduled_date", 1).to_list(500)
    
    return content

@marketing_router.get("/content/{platform}")
async def get_platform_content(platform: str, request: Request):
    """Get content for a specific platform"""
    await get_current_user(request)
    
    content = await db.marketing_content.find(
        {"platform": platform},
        {"_id": 0}
    ).sort("scheduled_date", 1).to_list(500)
    
    return content

@marketing_router.post("/content")
async def create_content(data: SocialContentCreate, request: Request):
    """Create new social media content"""
    user = await get_current_user(request)
    
    content_id = f"content_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    content_doc = {
        "content_id": content_id,
        "title": data.title,
        "platform": data.platform,
        "content_type": data.content_type,
        "caption": data.caption,
        "hashtags": data.hashtags,
        "creative_url": data.creative_url,
        "assigned_to": data.assigned_to,
        "status": data.status,
        "scheduled_date": data.scheduled_date,
        "scheduled_time": data.scheduled_time,
        # Platform specific
        "audio": data.audio,
        "duration": data.duration,
        "cta": data.cta,
        "video_url": data.video_url,
        "thumbnail_url": data.thumbnail_url,
        "is_thread": data.is_thread,
        # Metadata
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.marketing_content.insert_one(content_doc)
    
    return await db.marketing_content.find_one({"content_id": content_id}, {"_id": 0})

@marketing_router.put("/content/{content_id}")
async def update_content(content_id: str, data: SocialContentUpdate, request: Request):
    """Update social media content"""
    await get_current_user(request)
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.marketing_content.update_one(
        {"content_id": content_id},
        {"$set": update_data}
    )
    
    return await db.marketing_content.find_one({"content_id": content_id}, {"_id": 0})

@marketing_router.delete("/content/{content_id}")
async def delete_content(content_id: str, request: Request):
    """Delete social media content"""
    await get_current_user(request)
    
    await db.marketing_content.delete_one({"content_id": content_id})
    
    return {"message": "Content deleted"}

# ============== BLOG ROUTES ==============

@marketing_router.get("/blog")
async def get_all_blogs(request: Request, status: Optional[str] = None):
    """Get all blog posts"""
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    
    blogs = await db.marketing_blogs.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return blogs

@marketing_router.post("/blog")
async def create_blog(data: BlogPostCreate, request: Request):
    """Create a new blog post"""
    user = await get_current_user(request)
    
    blog_id = f"blog_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    blog_doc = {
        "blog_id": blog_id,
        "title": data.title,
        "slug": data.slug,
        "content": data.content,
        "featured_image": data.featured_image,
        "category": data.category,
        "tags": data.tags,
        "seo_title": data.seo_title,
        "seo_description": data.seo_description,
        "status": data.status,
        "scheduled_date": data.scheduled_date,
        "wordpress_id": None,  # Set when published to WP
        "created_by": user["user_id"],
        "created_by_name": user.get("name", "Unknown"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.marketing_blogs.insert_one(blog_doc)
    
    return await db.marketing_blogs.find_one({"blog_id": blog_id}, {"_id": 0})

@marketing_router.put("/blog/{blog_id}")
async def update_blog(blog_id: str, data: Dict[str, Any], request: Request):
    """Update a blog post"""
    await get_current_user(request)
    
    allowed_fields = ["title", "slug", "content", "featured_image", "category", 
                      "tags", "seo_title", "seo_description", "status", "scheduled_date"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.marketing_blogs.update_one(
        {"blog_id": blog_id},
        {"$set": update_data}
    )
    
    return await db.marketing_blogs.find_one({"blog_id": blog_id}, {"_id": 0})

@marketing_router.delete("/blog/{blog_id}")
async def delete_blog(blog_id: str, request: Request):
    """Delete a blog post"""
    await get_current_user(request)
    
    await db.marketing_blogs.delete_one({"blog_id": blog_id})
    
    return {"message": "Blog deleted"}

# ============== ANALYTICS ROUTES (Demo Data) ==============

@marketing_router.get("/analytics")
async def get_analytics(request: Request, period: str = "7d"):
    """Get analytics data (demo or real if connected)"""
    await get_current_user(request)
    
    # Check if GA is connected
    integration = await db.marketing_integrations.find_one({"type": "google_analytics"})
    
    if integration and integration.get("connected"):
        # TODO: Fetch real GA data using stored credentials
        pass
    
    # Return demo data
    import random
    
    days = 7 if period == "7d" else 30 if period == "30d" else 90
    
    # Generate demo metrics
    base_users = random.randint(1000, 5000)
    base_sessions = int(base_users * 1.3)
    base_pageviews = int(base_sessions * 2.5)
    
    demo_data = {
        "period": period,
        "is_demo": not (integration and integration.get("connected")),
        "summary": {
            "users": base_users,
            "users_change": round(random.uniform(-10, 25), 1),
            "sessions": base_sessions,
            "sessions_change": round(random.uniform(-5, 20), 1),
            "pageviews": base_pageviews,
            "pageviews_change": round(random.uniform(-8, 30), 1),
            "bounce_rate": round(random.uniform(35, 55), 1),
            "bounce_rate_change": round(random.uniform(-5, 5), 1),
            "avg_session_duration": f"{random.randint(1, 4)}:{random.randint(10, 59):02d}",
        },
        "traffic_sources": [
            {"source": "Organic Search", "users": int(base_users * 0.4), "percentage": 40},
            {"source": "Direct", "users": int(base_users * 0.25), "percentage": 25},
            {"source": "Social", "users": int(base_users * 0.2), "percentage": 20},
            {"source": "Referral", "users": int(base_users * 0.1), "percentage": 10},
            {"source": "Email", "users": int(base_users * 0.05), "percentage": 5},
        ],
        "top_pages": [
            {"page": "/", "views": int(base_pageviews * 0.3), "avg_time": "2:34"},
            {"page": "/services", "views": int(base_pageviews * 0.15), "avg_time": "1:45"},
            {"page": "/about", "views": int(base_pageviews * 0.12), "avg_time": "1:20"},
            {"page": "/contact", "views": int(base_pageviews * 0.1), "avg_time": "0:55"},
            {"page": "/blog", "views": int(base_pageviews * 0.08), "avg_time": "3:10"},
        ],
        "daily_data": [
            {
                "date": (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d"),
                "users": random.randint(int(base_users/days * 0.7), int(base_users/days * 1.3)),
                "sessions": random.randint(int(base_sessions/days * 0.7), int(base_sessions/days * 1.3)),
                "pageviews": random.randint(int(base_pageviews/days * 0.7), int(base_pageviews/days * 1.3)),
            }
            for i in range(days)
        ]
    }
    
    return demo_data

# ============== EMAIL ROUTES (Demo Data) ==============

@marketing_router.get("/emails")
async def get_emails(request: Request, folder: str = "inbox", limit: int = 20):
    """Get emails (demo or real if connected)"""
    await get_current_user(request)
    
    # Check if Gmail is connected
    integration = await db.marketing_integrations.find_one({"type": "gmail"})
    
    if integration and integration.get("connected"):
        # TODO: Fetch real Gmail data
        pass
    
    # Return demo data
    demo_senders = [
        {"name": "John Smith", "email": "john@clientcompany.com"},
        {"name": "Sarah Marketing", "email": "sarah@agency.com"},
        {"name": "Google Ads", "email": "ads-noreply@google.com"},
        {"name": "Meta Business", "email": "notification@facebookmail.com"},
        {"name": "HubSpot", "email": "updates@hubspot.com"},
        {"name": "Campaign Monitor", "email": "noreply@campaignmonitor.com"},
        {"name": "LinkedIn", "email": "messages-noreply@linkedin.com"},
    ]
    
    demo_subjects = [
        "Re: Q1 Marketing Campaign Review",
        "New lead from website form",
        "Your campaign performance report",
        "Meeting reminder: Strategy call",
        "Invoice #1234 - January Services",
        "Content approval needed",
        "Weekly analytics summary",
        "New follower milestone reached!",
        "Proposal feedback requested",
        "Social media calendar review",
    ]
    
    import random
    
    emails = []
    for i in range(limit):
        sender = random.choice(demo_senders)
        emails.append({
            "email_id": f"email_{i}",
            "from_name": sender["name"],
            "from_email": sender["email"],
            "subject": random.choice(demo_subjects),
            "snippet": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore...",
            "date": (datetime.now() - timedelta(hours=random.randint(1, 72))).isoformat(),
            "is_read": random.choice([True, True, False]),
            "has_attachment": random.choice([True, False, False, False]),
            "folder": folder
        })
    
    return {
        "emails": emails,
        "is_demo": not (integration and integration.get("connected")),
        "total": len(emails)
    }

# ============== DASHBOARD ROUTES ==============

@marketing_router.get("/dashboard")
async def get_dashboard(request: Request):
    """Get marketing dashboard summary"""
    await get_current_user(request)
    
    # Content stats by platform
    platforms = ["instagram", "linkedin", "youtube", "twitter"]
    platform_stats = []
    
    for platform in platforms:
        total = await db.marketing_content.count_documents({"platform": platform})
        published = await db.marketing_content.count_documents({"platform": platform, "status": "published"})
        scheduled = await db.marketing_content.count_documents({"platform": platform, "status": "scheduled"})
        in_progress = await db.marketing_content.count_documents({
            "platform": platform, 
            "status": {"$in": ["idea", "in_creation", "review"]}
        })
        
        platform_stats.append({
            "platform": platform,
            "total": total,
            "published": published,
            "scheduled": scheduled,
            "in_progress": in_progress
        })
    
    # Blog stats
    total_blogs = await db.marketing_blogs.count_documents({})
    published_blogs = await db.marketing_blogs.count_documents({"status": "published"})
    draft_blogs = await db.marketing_blogs.count_documents({"status": "draft"})
    
    # Upcoming content (next 7 days)
    today = datetime.now().strftime("%Y-%m-%d")
    next_week = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
    
    upcoming = await db.marketing_content.find({
        "scheduled_date": {"$gte": today, "$lte": next_week},
        "status": {"$in": ["scheduled", "review"]}
    }, {"_id": 0}).sort("scheduled_date", 1).to_list(10)
    
    return {
        "platform_stats": platform_stats,
        "blog_stats": {
            "total": total_blogs,
            "published": published_blogs,
            "draft": draft_blogs
        },
        "upcoming_content": upcoming,
        "total_content": sum(p["total"] for p in platform_stats)
    }

# ============== INTEGRATION SETTINGS ==============

@marketing_router.get("/integrations")
async def get_integrations(request: Request):
    """Get all integration settings"""
    await get_current_user(request)
    
    integrations = await db.marketing_integrations.find({}, {"_id": 0}).to_list(10)
    
    # Return default structure if none exist
    if not integrations:
        return [
            {"type": "google_analytics", "connected": False, "settings": {}},
            {"type": "wordpress", "connected": False, "settings": {}},
            {"type": "gmail", "connected": False, "settings": {}},
        ]
    
    return integrations

@marketing_router.post("/integrations")
async def save_integration(data: IntegrationSettings, request: Request):
    """Save integration settings"""
    await get_current_user(request)
    
    await db.marketing_integrations.update_one(
        {"type": data.type},
        {"$set": {
            "type": data.type,
            "settings": data.settings,
            "connected": True,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return await db.marketing_integrations.find_one({"type": data.type}, {"_id": 0})

@marketing_router.delete("/integrations/{integration_type}")
async def disconnect_integration(integration_type: str, request: Request):
    """Disconnect an integration"""
    await get_current_user(request)
    
    await db.marketing_integrations.update_one(
        {"type": integration_type},
        {"$set": {"connected": False, "settings": {}}}
    )
    
    return {"message": f"{integration_type} disconnected"}

# ============== SEED DEMO DATA ==============

@marketing_router.post("/seed-demo")
async def seed_demo_data(request: Request):
    """Seed demo data for marketing module"""
    user = await get_current_user(request)
    
    now = datetime.now(timezone.utc)
    
    # Clear existing demo data
    await db.marketing_content.delete_many({})
    await db.marketing_blogs.delete_many({})
    
    # Instagram content
    instagram_content = [
        {"title": "New Year Campaign Post", "content_type": "post", "status": "published", "days_ago": 5},
        {"title": "Behind the Scenes Reel", "content_type": "reel", "status": "published", "days_ago": 3},
        {"title": "Client Success Story", "content_type": "post", "status": "scheduled", "days_ahead": 2},
        {"title": "Team Introduction Reel", "content_type": "reel", "status": "in_creation", "days_ahead": 5},
        {"title": "Product Launch Teaser", "content_type": "reel", "status": "review", "days_ahead": 7},
        {"title": "Weekend Vibes Post", "content_type": "post", "status": "idea", "days_ahead": 10},
    ]
    
    # LinkedIn content
    linkedin_content = [
        {"title": "Industry Insights Article", "content_type": "article", "status": "published", "days_ago": 7},
        {"title": "Company Update Post", "content_type": "post", "status": "published", "days_ago": 2},
        {"title": "Thought Leadership Post", "content_type": "post", "status": "scheduled", "days_ahead": 1},
        {"title": "Job Opening Announcement", "content_type": "post", "status": "in_creation", "days_ahead": 4},
        {"title": "Case Study Share", "content_type": "article", "status": "review", "days_ahead": 6},
    ]
    
    # YouTube content
    youtube_content = [
        {"title": "How-To Tutorial Video", "content_type": "video", "status": "published", "days_ago": 14},
        {"title": "Client Testimonial", "content_type": "video", "status": "published", "days_ago": 7},
        {"title": "Quick Tips Short", "content_type": "short", "status": "scheduled", "days_ahead": 3},
        {"title": "Product Demo Video", "content_type": "video", "status": "in_creation", "days_ahead": 10},
        {"title": "Behind the Scenes", "content_type": "short", "status": "idea", "days_ahead": 14},
    ]
    
    # Twitter content
    twitter_content = [
        {"title": "Industry News Share", "content_type": "tweet", "status": "published", "days_ago": 1},
        {"title": "Tips Thread", "content_type": "thread", "status": "published", "days_ago": 3, "is_thread": True},
        {"title": "Event Announcement", "content_type": "tweet", "status": "scheduled", "days_ahead": 1},
        {"title": "Poll Post", "content_type": "tweet", "status": "in_creation", "days_ahead": 2},
        {"title": "Weekly Roundup Thread", "content_type": "thread", "status": "review", "days_ahead": 5, "is_thread": True},
    ]
    
    # Insert content
    all_content = [
        (instagram_content, "instagram"),
        (linkedin_content, "linkedin"),
        (youtube_content, "youtube"),
        (twitter_content, "twitter"),
    ]
    
    for content_list, platform in all_content:
        for item in content_list:
            days = item.get("days_ago", -item.get("days_ahead", 0))
            scheduled_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d") if days > 0 else (datetime.now() + timedelta(days=-days)).strftime("%Y-%m-%d")
            
            content_doc = {
                "content_id": f"content_{uuid.uuid4().hex[:12]}",
                "title": item["title"],
                "platform": platform,
                "content_type": item["content_type"],
                "caption": f"Sample caption for {item['title']}. #marketing #agency #drawlead",
                "hashtags": ["marketing", "agency", "drawlead", platform],
                "creative_url": "",
                "assigned_to": user["user_id"],
                "status": item["status"],
                "scheduled_date": scheduled_date,
                "scheduled_time": "10:00",
                "is_thread": item.get("is_thread", False),
                "created_by": user["user_id"],
                "created_by_name": user.get("name", "Unknown"),
                "created_at": now,
                "updated_at": now
            }
            await db.marketing_content.insert_one(content_doc)
    
    # Blog posts
    blog_posts = [
        {"title": "10 Marketing Trends for 2025", "status": "published", "category": "Marketing"},
        {"title": "Complete Guide to Social Media Strategy", "status": "published", "category": "Social Media"},
        {"title": "SEO Best Practices", "status": "draft", "category": "SEO"},
        {"title": "Email Marketing That Converts", "status": "scheduled", "category": "Email"},
        {"title": "Content Creation Tips", "status": "draft", "category": "Content"},
    ]
    
    for blog in blog_posts:
        blog_doc = {
            "blog_id": f"blog_{uuid.uuid4().hex[:12]}",
            "title": blog["title"],
            "slug": blog["title"].lower().replace(" ", "-"),
            "content": f"<h2>Introduction</h2><p>This is sample content for {blog['title']}.</p><h2>Main Points</h2><p>Lorem ipsum dolor sit amet...</p>",
            "featured_image": "",
            "category": blog["category"],
            "tags": ["marketing", blog["category"].lower()],
            "seo_title": blog["title"],
            "seo_description": f"Learn about {blog['title']} in this comprehensive guide.",
            "status": blog["status"],
            "scheduled_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d") if blog["status"] == "scheduled" else None,
            "wordpress_id": None,
            "created_by": user["user_id"],
            "created_by_name": user.get("name", "Unknown"),
            "created_at": now,
            "updated_at": now
        }
        await db.marketing_blogs.insert_one(blog_doc)
    
    return {"message": "Demo data seeded successfully"}
