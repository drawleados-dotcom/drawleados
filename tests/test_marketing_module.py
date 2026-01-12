"""
Marketing Module API Tests
Tests for: Dashboard, Analytics, Blog CRUD, Social Media Content CRUD, Emails, Seed Demo
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMarketingAuth:
    """Test authentication for marketing module"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login as admin and get session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session token in response"
        return data["session_token"]
    
    def test_login_admin(self, auth_token):
        """Test admin login works"""
        assert auth_token is not None
        assert auth_token.startswith("session_")


class TestMarketingDashboard:
    """Test marketing dashboard endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    def test_get_dashboard(self, auth_token):
        """GET /api/marketing/dashboard - returns dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/marketing/dashboard", 
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "platform_stats" in data
        assert "blog_stats" in data
        assert "upcoming_content" in data
        assert "total_content" in data
        
        # Verify platform_stats structure
        assert isinstance(data["platform_stats"], list)
        if len(data["platform_stats"]) > 0:
            platform = data["platform_stats"][0]
            assert "platform" in platform
            assert "total" in platform
            assert "published" in platform
            assert "scheduled" in platform
    
    def test_dashboard_unauthorized(self):
        """GET /api/marketing/dashboard - requires auth"""
        response = requests.get(f"{BASE_URL}/api/marketing/dashboard")
        assert response.status_code == 401


class TestMarketingAnalytics:
    """Test analytics endpoint (demo data)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    def test_get_analytics_7d(self, auth_token):
        """GET /api/marketing/analytics?period=7d - returns 7 day analytics"""
        response = requests.get(f"{BASE_URL}/api/marketing/analytics?period=7d",
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "period" in data
        assert data["period"] == "7d"
        assert "is_demo" in data
        assert "summary" in data
        assert "traffic_sources" in data
        assert "top_pages" in data
        assert "daily_data" in data
        
        # Verify summary metrics
        summary = data["summary"]
        assert "users" in summary
        assert "sessions" in summary
        assert "pageviews" in summary
        assert "bounce_rate" in summary
        assert "avg_session_duration" in summary
    
    def test_get_analytics_30d(self, auth_token):
        """GET /api/marketing/analytics?period=30d - returns 30 day analytics"""
        response = requests.get(f"{BASE_URL}/api/marketing/analytics?period=30d",
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "30d"


class TestMarketingBlog:
    """Test blog CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    def test_get_blogs(self, auth_token):
        """GET /api/marketing/blog - returns blog list"""
        response = requests.get(f"{BASE_URL}/api/marketing/blog",
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_blog(self, auth_token):
        """POST /api/marketing/blog - creates new blog post"""
        blog_data = {
            "title": "TEST_Marketing Module Test Blog",
            "slug": "test-marketing-module-test-blog",
            "content": "<h2>Test Content</h2><p>This is a test blog post.</p>",
            "featured_image": "",
            "category": "Testing",
            "tags": ["test", "marketing"],
            "seo_title": "Test Blog Post",
            "seo_description": "A test blog post for marketing module testing",
            "status": "draft"
        }
        
        response = requests.post(f"{BASE_URL}/api/marketing/blog", json=blog_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response
        assert "blog_id" in data
        assert data["title"] == blog_data["title"]
        assert data["slug"] == blog_data["slug"]
        assert data["status"] == "draft"
        
        return data["blog_id"]
    
    def test_create_and_get_blog(self, auth_token):
        """Create blog and verify it appears in list"""
        # Create
        blog_data = {
            "title": "TEST_Verify Blog Creation",
            "slug": "test-verify-blog-creation",
            "content": "Test content",
            "status": "published",
            "category": "Test"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/marketing/blog", json=blog_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        assert create_response.status_code == 200
        created_blog = create_response.json()
        blog_id = created_blog["blog_id"]
        
        # Get all blogs and verify
        get_response = requests.get(f"{BASE_URL}/api/marketing/blog",
            headers={"Authorization": f"Bearer {auth_token}"})
        assert get_response.status_code == 200
        blogs = get_response.json()
        
        # Find our blog
        found = any(b["blog_id"] == blog_id for b in blogs)
        assert found, "Created blog not found in list"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/marketing/blog/{blog_id}",
            headers={"Authorization": f"Bearer {auth_token}"})
    
    def test_update_blog(self, auth_token):
        """PUT /api/marketing/blog/{blog_id} - updates blog"""
        # First create a blog
        blog_data = {
            "title": "TEST_Blog to Update",
            "slug": "test-blog-to-update",
            "content": "Original content",
            "status": "draft"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/marketing/blog", json=blog_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        blog_id = create_response.json()["blog_id"]
        
        # Update the blog
        update_data = {
            "title": "TEST_Updated Blog Title",
            "status": "published"
        }
        
        update_response = requests.put(f"{BASE_URL}/api/marketing/blog/{blog_id}", json=update_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert update_response.status_code == 200
        updated_blog = update_response.json()
        assert updated_blog["title"] == "TEST_Updated Blog Title"
        assert updated_blog["status"] == "published"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/marketing/blog/{blog_id}",
            headers={"Authorization": f"Bearer {auth_token}"})
    
    def test_delete_blog(self, auth_token):
        """DELETE /api/marketing/blog/{blog_id} - deletes blog"""
        # Create a blog to delete
        blog_data = {
            "title": "TEST_Blog to Delete",
            "slug": "test-blog-to-delete",
            "content": "Will be deleted",
            "status": "draft"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/marketing/blog", json=blog_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        blog_id = create_response.json()["blog_id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/marketing/blog/{blog_id}",
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Blog deleted"
        
        # Verify deleted - should not appear in list
        get_response = requests.get(f"{BASE_URL}/api/marketing/blog",
            headers={"Authorization": f"Bearer {auth_token}"})
        blogs = get_response.json()
        found = any(b["blog_id"] == blog_id for b in blogs)
        assert not found, "Deleted blog still appears in list"


class TestMarketingContent:
    """Test social media content CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    def test_get_all_content(self, auth_token):
        """GET /api/marketing/content - returns all content"""
        response = requests.get(f"{BASE_URL}/api/marketing/content",
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_content_by_platform(self, auth_token):
        """GET /api/marketing/content/{platform} - returns platform content"""
        platforms = ["instagram", "linkedin", "youtube", "twitter"]
        
        for platform in platforms:
            response = requests.get(f"{BASE_URL}/api/marketing/content/{platform}",
                headers={"Authorization": f"Bearer {auth_token}"})
            
            assert response.status_code == 200, f"Failed for platform: {platform}"
            data = response.json()
            assert isinstance(data, list)
    
    def test_create_instagram_content(self, auth_token):
        """POST /api/marketing/content - creates Instagram content"""
        content_data = {
            "title": "TEST_Instagram Post",
            "platform": "instagram",
            "content_type": "post",
            "caption": "Test caption for Instagram #test #marketing",
            "hashtags": ["test", "marketing", "instagram"],
            "status": "idea",
            "scheduled_date": "2025-01-20",
            "scheduled_time": "10:00"
        }
        
        response = requests.post(f"{BASE_URL}/api/marketing/content", json=content_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert "content_id" in data
        assert data["title"] == content_data["title"]
        assert data["platform"] == "instagram"
        assert data["content_type"] == "post"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/marketing/content/{data['content_id']}",
            headers={"Authorization": f"Bearer {auth_token}"})
    
    def test_create_linkedin_content(self, auth_token):
        """POST /api/marketing/content - creates LinkedIn content"""
        content_data = {
            "title": "TEST_LinkedIn Article",
            "platform": "linkedin",
            "content_type": "article",
            "caption": "Professional content for LinkedIn",
            "hashtags": ["business", "marketing"],
            "status": "in_creation",
            "cta": "Learn more at our website"
        }
        
        response = requests.post(f"{BASE_URL}/api/marketing/content", json=content_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["platform"] == "linkedin"
        assert data["cta"] == "Learn more at our website"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/marketing/content/{data['content_id']}",
            headers={"Authorization": f"Bearer {auth_token}"})
    
    def test_create_youtube_content(self, auth_token):
        """POST /api/marketing/content - creates YouTube content"""
        content_data = {
            "title": "TEST_YouTube Video",
            "platform": "youtube",
            "content_type": "video",
            "caption": "Video description",
            "hashtags": ["youtube", "video"],
            "status": "review",
            "video_url": "https://youtube.com/watch?v=test",
            "thumbnail_url": "https://example.com/thumb.jpg",
            "duration": "10:30"
        }
        
        response = requests.post(f"{BASE_URL}/api/marketing/content", json=content_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["platform"] == "youtube"
        assert data["content_type"] == "video"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/marketing/content/{data['content_id']}",
            headers={"Authorization": f"Bearer {auth_token}"})
    
    def test_create_twitter_thread(self, auth_token):
        """POST /api/marketing/content - creates Twitter thread"""
        content_data = {
            "title": "TEST_Twitter Thread",
            "platform": "twitter",
            "content_type": "thread",
            "caption": "Thread content",
            "hashtags": ["twitter", "thread"],
            "status": "scheduled",
            "is_thread": True,
            "scheduled_date": "2025-01-25"
        }
        
        response = requests.post(f"{BASE_URL}/api/marketing/content", json=content_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["platform"] == "twitter"
        assert data["is_thread"] == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/marketing/content/{data['content_id']}",
            headers={"Authorization": f"Bearer {auth_token}"})
    
    def test_update_content(self, auth_token):
        """PUT /api/marketing/content/{content_id} - updates content"""
        # Create content
        content_data = {
            "title": "TEST_Content to Update",
            "platform": "instagram",
            "content_type": "reel",
            "status": "idea"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/marketing/content", json=content_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        content_id = create_response.json()["content_id"]
        
        # Update
        update_data = {
            "title": "TEST_Updated Content Title",
            "status": "in_creation",
            "caption": "Updated caption"
        }
        
        update_response = requests.put(f"{BASE_URL}/api/marketing/content/{content_id}", json=update_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["title"] == "TEST_Updated Content Title"
        assert updated["status"] == "in_creation"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/marketing/content/{content_id}",
            headers={"Authorization": f"Bearer {auth_token}"})
    
    def test_delete_content(self, auth_token):
        """DELETE /api/marketing/content/{content_id} - deletes content"""
        # Create content
        content_data = {
            "title": "TEST_Content to Delete",
            "platform": "instagram",
            "content_type": "post",
            "status": "idea"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/marketing/content", json=content_data,
            headers={"Authorization": f"Bearer {auth_token}"})
        content_id = create_response.json()["content_id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/marketing/content/{content_id}",
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Content deleted"


class TestMarketingEmails:
    """Test email endpoint (demo data)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    def test_get_emails_inbox(self, auth_token):
        """GET /api/marketing/emails - returns inbox emails"""
        response = requests.get(f"{BASE_URL}/api/marketing/emails?folder=inbox&limit=20",
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert "emails" in data
        assert "is_demo" in data
        assert "total" in data
        assert isinstance(data["emails"], list)
        
        # Verify email structure
        if len(data["emails"]) > 0:
            email = data["emails"][0]
            assert "email_id" in email
            assert "from_name" in email
            assert "from_email" in email
            assert "subject" in email
            assert "date" in email
    
    def test_get_emails_starred(self, auth_token):
        """GET /api/marketing/emails?folder=starred - returns starred emails"""
        response = requests.get(f"{BASE_URL}/api/marketing/emails?folder=starred",
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200


class TestMarketingIntegrations:
    """Test integration settings endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    def test_get_integrations(self, auth_token):
        """GET /api/marketing/integrations - returns integration status"""
        response = requests.get(f"{BASE_URL}/api/marketing/integrations",
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Should have default integrations
        integration_types = [i["type"] for i in data]
        assert "google_analytics" in integration_types or len(data) == 0


class TestMarketingSeedDemo:
    """Test seed demo data endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    def test_seed_demo_data(self, auth_token):
        """POST /api/marketing/seed-demo - seeds demo data"""
        response = requests.post(f"{BASE_URL}/api/marketing/seed-demo", json={},
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Demo data seeded successfully" in data["message"]
    
    def test_verify_seeded_content(self, auth_token):
        """Verify demo data was seeded"""
        # Check content exists
        content_response = requests.get(f"{BASE_URL}/api/marketing/content",
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert content_response.status_code == 200
        content = content_response.json()
        assert len(content) > 0, "No content after seeding"
        
        # Check blogs exist
        blog_response = requests.get(f"{BASE_URL}/api/marketing/blog",
            headers={"Authorization": f"Bearer {auth_token}"})
        
        assert blog_response.status_code == 200
        blogs = blog_response.json()
        assert len(blogs) > 0, "No blogs after seeding"


# Cleanup test data after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    
    # Login
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "vinoth@drawlead.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        return
    
    token = response.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Cleanup blogs
    blogs_response = requests.get(f"{BASE_URL}/api/marketing/blog", headers=headers)
    if blogs_response.status_code == 200:
        for blog in blogs_response.json():
            if blog.get("title", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/marketing/blog/{blog['blog_id']}", headers=headers)
    
    # Cleanup content
    content_response = requests.get(f"{BASE_URL}/api/marketing/content", headers=headers)
    if content_response.status_code == 200:
        for item in content_response.json():
            if item.get("title", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/marketing/content/{item['content_id']}", headers=headers)
