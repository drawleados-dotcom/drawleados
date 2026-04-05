"""
Test Project Creation Wizard - 4-Step Multi-Tab Wizard
Tests: Type/Platform Selection, Requirements, Branding, Project Details (5 tabs)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestProjectCreationWizard:
    """Test the comprehensive project creation wizard with requirements and branding"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("session_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip("Authentication failed - skipping tests")
        
        yield
        
        # Cleanup: Delete test projects
        self._cleanup_test_projects()
    
    def _cleanup_test_projects(self):
        """Delete all test projects created during testing"""
        try:
            response = self.session.get(f"{BASE_URL}/api/website-projects/all-projects-summary")
            if response.status_code == 200:
                projects = response.json()
                for project in projects:
                    if project.get("name", "").startswith("TEST_"):
                        self.session.delete(f"{BASE_URL}/api/website-projects/projects/{project['project_id']}")
        except:
            pass
    
    # ============== STEP 1: TYPE/PLATFORM SELECTION ==============
    
    def test_create_landing_page_wordpress(self):
        """Test creating a Landing Page with WordPress platform"""
        project_data = {
            "name": "TEST_Landing_WordPress",
            "website_type": "Landing Page",
            "platform": "WordPress",
            "workflow_stage": "creation",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Landing_WordPress"
        assert data["website_type"] == "Landing Page"
        assert data["platform"] == "WordPress"
        assert "project_id" in data
        assert data.get("pages_created", 0) >= 1  # Landing Page should have at least 1 page
        print(f"✓ Created Landing Page WordPress project with {data.get('pages_created')} pages")
    
    def test_create_business_website_webflow(self):
        """Test creating a Business Website with Webflow platform"""
        project_data = {
            "name": "TEST_Business_Webflow",
            "website_type": "Business Website",
            "platform": "Webflow",
            "workflow_stage": "creation",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["website_type"] == "Business Website"
        assert data["platform"] == "Webflow"
        # Business Website should have multiple pages (Home, About, Services, etc.)
        assert data.get("pages_created", 0) >= 5
        print(f"✓ Created Business Website Webflow project with {data.get('pages_created')} pages")
    
    def test_create_ecommerce_shopify(self):
        """Test creating an Ecommerce site with Shopify platform"""
        project_data = {
            "name": "TEST_Ecommerce_Shopify",
            "website_type": "Ecommerce",
            "platform": "Shopify",
            "workflow_stage": "creation",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["website_type"] == "Ecommerce"
        assert data["platform"] == "Shopify"
        print(f"✓ Created Ecommerce Shopify project with {data.get('pages_created')} pages")
    
    def test_create_webapp_custom_code(self):
        """Test creating a Web App with Custom Code platform"""
        project_data = {
            "name": "TEST_WebApp_Custom",
            "website_type": "Web App",
            "platform": "Custom Code",
            "workflow_stage": "creation",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["website_type"] == "Web App"
        assert data["platform"] == "Custom Code"
        print(f"✓ Created Web App Custom Code project with {data.get('pages_created')} pages")
    
    # ============== STEP 2: REQUIREMENTS (Dynamic based on type) ==============
    
    def test_create_project_with_landing_page_requirements(self):
        """Test creating a Landing Page with dynamic requirements fields"""
        project_data = {
            "name": "TEST_Landing_Requirements",
            "website_type": "Landing Page",
            "platform": "Framer",
            "workflow_stage": "creation",
            "status": "active",
            "requirements": {
                "business_name": "Test Business Inc",
                "tagline": "Your Success Partner",
                "about_text": "We help businesses grow with innovative solutions.",
                "cta_text": "Get Started Today",
                "contact_info": "contact@testbusiness.com",
                "social_links": "https://twitter.com/testbusiness"
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["requirements"]["business_name"] == "Test Business Inc"
        assert data["requirements"]["tagline"] == "Your Success Partner"
        assert data["requirements"]["cta_text"] == "Get Started Today"
        print("✓ Created Landing Page with requirements data")
    
    def test_create_project_with_business_requirements(self):
        """Test creating a Business Website with dynamic requirements fields"""
        project_data = {
            "name": "TEST_Business_Requirements",
            "website_type": "Business Website",
            "platform": "WordPress",
            "workflow_stage": "creation",
            "status": "active",
            "requirements": {
                "business_name": "Corporate Solutions Ltd",
                "tagline": "Excellence in Every Detail",
                "about_text": "Leading provider of corporate solutions since 2010.",
                "services_list": "Consulting\nDevelopment\nSupport",
                "team_info": "50+ experienced professionals",
                "testimonials": "Great service! - John D.",
                "contact_info": "info@corporate.com",
                "social_links": "LinkedIn, Twitter, Facebook"
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["requirements"]["services_list"] == "Consulting\nDevelopment\nSupport"
        assert data["requirements"]["team_info"] == "50+ experienced professionals"
        print("✓ Created Business Website with requirements data")
    
    def test_create_project_with_ecommerce_requirements(self):
        """Test creating an Ecommerce site with dynamic requirements fields"""
        project_data = {
            "name": "TEST_Ecommerce_Requirements",
            "website_type": "Ecommerce",
            "platform": "Shopify",
            "workflow_stage": "creation",
            "status": "active",
            "requirements": {
                "store_name": "Fashion Hub",
                "product_categories": "Clothing, Accessories, Footwear",
                "products_count": "500+",
                "collections_list": "Summer Collection\nWinter Collection\nSale Items",
                "variants_info": "Size, Color, Material",
                "shipping_zones": "US, Canada, UK, EU",
                "payment_methods": "Credit Card, PayPal, Apple Pay",
                "return_policy": "30-day return policy for all items"
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["requirements"]["store_name"] == "Fashion Hub"
        assert data["requirements"]["shipping_zones"] == "US, Canada, UK, EU"
        assert data["requirements"]["return_policy"] == "30-day return policy for all items"
        print("✓ Created Ecommerce with requirements data")
    
    def test_create_project_with_webapp_requirements(self):
        """Test creating a Web App with dynamic requirements fields"""
        project_data = {
            "name": "TEST_WebApp_Requirements",
            "website_type": "Web App",
            "platform": "AI Builder",
            "workflow_stage": "creation",
            "status": "active",
            "requirements": {
                "app_name": "TaskMaster Pro",
                "description": "A comprehensive task management application",
                "core_features": "Task creation\nTeam collaboration\nReporting",
                "user_roles": "Admin, Manager, Employee",
                "integrations": "Slack, Google Calendar, Jira",
                "tech_stack": "React, Node.js, MongoDB",
                "auth_method": "OAuth 2.0 + JWT",
                "api_requirements": "RESTful API with GraphQL support"
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["requirements"]["app_name"] == "TaskMaster Pro"
        assert data["requirements"]["tech_stack"] == "React, Node.js, MongoDB"
        assert data["requirements"]["auth_method"] == "OAuth 2.0 + JWT"
        print("✓ Created Web App with requirements data")
    
    # ============== STEP 3: BRANDING ==============
    
    def test_create_project_with_branding(self):
        """Test creating a project with full branding information"""
        project_data = {
            "name": "TEST_Project_Branding",
            "website_type": "Business Website",
            "platform": "Webflow",
            "workflow_stage": "creation",
            "status": "active",
            "branding": {
                "logo_url": "https://drive.google.com/logo.png",
                "favicon_url": "https://drive.google.com/favicon.ico",
                "primary_color": "#6366f1",
                "secondary_color": "#22c55e",
                "accent_color": "#f59e0b",
                "primary_font": "Inter",
                "secondary_font": "Playfair Display",
                "guidelines_url": "https://docs.google.com/brand-guidelines"
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["branding"]["logo_url"] == "https://drive.google.com/logo.png"
        assert data["branding"]["primary_color"] == "#6366f1"
        assert data["branding"]["secondary_color"] == "#22c55e"
        assert data["branding"]["accent_color"] == "#f59e0b"
        assert data["branding"]["primary_font"] == "Inter"
        assert data["branding"]["secondary_font"] == "Playfair Display"
        print("✓ Created project with full branding data")
    
    def test_create_project_with_partial_branding(self):
        """Test creating a project with partial branding (only colors)"""
        project_data = {
            "name": "TEST_Project_PartialBranding",
            "website_type": "Landing Page",
            "platform": "Wix",
            "workflow_stage": "creation",
            "status": "active",
            "branding": {
                "primary_color": "#ff5733",
                "secondary_color": "#33ff57",
                "accent_color": "#3357ff"
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["branding"]["primary_color"] == "#ff5733"
        print("✓ Created project with partial branding data")
    
    # ============== STEP 4: PROJECT DETAILS (5 Tabs) ==============
    
    def test_create_project_with_basic_details(self):
        """Test creating a project with Basic tab details"""
        project_data = {
            "name": "TEST_Project_BasicDetails",
            "website_type": "Business Website",
            "platform": "WordPress",
            "workflow_stage": "creation",
            "status": "active",
            "domain_url": "www.testproject.com",
            "onboarding_date": "2026-01-15",
            "deadline": "2026-03-15",
            "notes": "High priority project for Q1 launch"
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["domain_url"] == "www.testproject.com"
        assert data["onboarding_date"] == "2026-01-15"
        assert data["deadline"] == "2026-03-15"
        assert data["notes"] == "High priority project for Q1 launch"
        print("✓ Created project with Basic tab details")
    
    def test_create_project_with_client_details(self):
        """Test creating a project with Client tab details"""
        project_data = {
            "name": "TEST_Project_ClientDetails",
            "website_type": "Ecommerce",
            "platform": "Shopify",
            "workflow_stage": "creation",
            "status": "active",
            "client_name": "Acme Corporation",
            "client_email": "contact@acme.com",
            "client_phone": "+1 234 567 8900",
            "client_location": "New York, USA"
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["client_name"] == "Acme Corporation"
        assert data["client_email"] == "contact@acme.com"
        assert data["client_phone"] == "+1 234 567 8900"
        assert data["client_location"] == "New York, USA"
        print("✓ Created project with Client tab details")
    
    def test_create_project_with_credentials(self):
        """Test creating a project with Credentials tab details"""
        project_data = {
            "name": "TEST_Project_Credentials",
            "website_type": "Business Website",
            "platform": "WordPress",
            "workflow_stage": "creation",
            "status": "active",
            "domain_username": "admin_domain",
            "domain_password": "secure_pass_123",
            "wp_username": "wp_admin",
            "wp_password": "wp_secure_456"
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["domain_username"] == "admin_domain"
        assert data["domain_password"] == "secure_pass_123"
        assert data["wp_username"] == "wp_admin"
        assert data["wp_password"] == "wp_secure_456"
        print("✓ Created project with Credentials tab details")
    
    def test_create_project_with_team_assignment(self):
        """Test creating a project with Team tab details"""
        project_data = {
            "name": "TEST_Project_Team",
            "website_type": "Web App",
            "platform": "Custom Code",
            "workflow_stage": "creation",
            "status": "active",
            "developer": "John Developer",
            "designer": "Jane Designer",
            "content_writer": "Bob Writer",
            "project_manager": "Alice Manager"
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["developer"] == "John Developer"
        assert data["designer"] == "Jane Designer"
        assert data["content_writer"] == "Bob Writer"
        assert data["project_manager"] == "Alice Manager"
        print("✓ Created project with Team tab details")
    
    def test_create_project_with_links(self):
        """Test creating a project with Links tab details"""
        project_data = {
            "name": "TEST_Project_Links",
            "website_type": "Landing Page",
            "platform": "Framer",
            "workflow_stage": "creation",
            "status": "active",
            "client_drive_url": "https://drive.google.com/project-folder",
            "documents_url": "https://docs.google.com/project-docs",
            "communication_url": "https://slack.com/project-channel"
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        assert data["client_drive_url"] == "https://drive.google.com/project-folder"
        assert data["documents_url"] == "https://docs.google.com/project-docs"
        assert data["communication_url"] == "https://slack.com/project-channel"
        print("✓ Created project with Links tab details")
    
    # ============== COMPREHENSIVE TEST: ALL 4 STEPS ==============
    
    def test_create_complete_project_all_steps(self):
        """Test creating a project with all 4 steps data (Type, Requirements, Branding, Details)"""
        project_data = {
            # Step 1: Type/Platform
            "name": "TEST_Complete_Project",
            "website_type": "Business Website",
            "platform": "Webflow",
            "workflow_stage": "creation",
            "status": "active",
            
            # Step 2: Requirements
            "requirements": {
                "business_name": "Complete Solutions Inc",
                "tagline": "Your Complete Partner",
                "about_text": "Full-service business solutions provider.",
                "services_list": "Web Design\nDevelopment\nSEO\nMarketing",
                "team_info": "25+ professionals",
                "testimonials": "Excellent work! - Client A",
                "contact_info": "hello@complete.com",
                "social_links": "LinkedIn, Twitter"
            },
            
            # Step 3: Branding
            "branding": {
                "logo_url": "https://drive.google.com/complete-logo.png",
                "favicon_url": "https://drive.google.com/complete-favicon.ico",
                "primary_color": "#1a1a2e",
                "secondary_color": "#16213e",
                "accent_color": "#e94560",
                "primary_font": "Poppins",
                "secondary_font": "Open Sans",
                "guidelines_url": "https://docs.google.com/complete-brand"
            },
            
            # Step 4: Project Details (all 5 tabs)
            # Basic
            "domain_url": "www.completesolutions.com",
            "onboarding_date": "2026-01-10",
            "deadline": "2026-04-10",
            "notes": "Complete project with all details filled",
            
            # Client
            "client_name": "Complete Corp",
            "client_email": "client@complete.com",
            "client_phone": "+1 555 123 4567",
            "client_location": "San Francisco, CA",
            
            # Credentials
            "domain_username": "complete_admin",
            "domain_password": "complete_pass",
            "wp_username": "complete_wp",
            "wp_password": "complete_wp_pass",
            
            # Team
            "developer": "Dev Team Lead",
            "designer": "Design Team Lead",
            "content_writer": "Content Lead",
            "project_manager": "PM Lead",
            
            # Links
            "client_drive_url": "https://drive.google.com/complete-drive",
            "documents_url": "https://docs.google.com/complete-docs",
            "communication_url": "https://slack.com/complete-channel"
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        
        data = response.json()
        
        # Verify Step 1
        assert data["website_type"] == "Business Website"
        assert data["platform"] == "Webflow"
        
        # Verify Step 2
        assert data["requirements"]["business_name"] == "Complete Solutions Inc"
        assert data["requirements"]["services_list"] == "Web Design\nDevelopment\nSEO\nMarketing"
        
        # Verify Step 3
        assert data["branding"]["primary_color"] == "#1a1a2e"
        assert data["branding"]["primary_font"] == "Poppins"
        
        # Verify Step 4 - Basic
        assert data["domain_url"] == "www.completesolutions.com"
        assert data["deadline"] == "2026-04-10"
        
        # Verify Step 4 - Client
        assert data["client_name"] == "Complete Corp"
        assert data["client_location"] == "San Francisco, CA"
        
        # Verify Step 4 - Credentials
        assert data["domain_username"] == "complete_admin"
        assert data["wp_username"] == "complete_wp"
        
        # Verify Step 4 - Team
        assert data["developer"] == "Dev Team Lead"
        assert data["project_manager"] == "PM Lead"
        
        # Verify Step 4 - Links
        assert data["client_drive_url"] == "https://drive.google.com/complete-drive"
        
        print("✓ Created complete project with all 4 steps data")
        
        # Verify project can be retrieved with all data
        project_id = data["project_id"]
        get_response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{project_id}")
        assert get_response.status_code == 200
        
        retrieved = get_response.json()
        assert retrieved["requirements"]["business_name"] == "Complete Solutions Inc"
        assert retrieved["branding"]["primary_color"] == "#1a1a2e"
        print("✓ Verified project data persisted correctly")
    
    # ============== VALIDATION TESTS ==============
    
    def test_create_project_requires_name(self):
        """Test that project creation requires a name"""
        project_data = {
            "website_type": "Landing Page",
            "platform": "WordPress"
        }
        
        response = self.session.post(f"{BASE_URL}/api/website-projects/projects", json=project_data)
        # Should fail validation
        assert response.status_code in [400, 422], "Should require project name"
        print("✓ Validation: Project name is required")
    
    def test_get_team_members_for_assignment(self):
        """Test getting team members for Team tab dropdowns"""
        response = self.session.get(f"{BASE_URL}/api/website-projects/team-members")
        assert response.status_code == 200, f"Failed to get team members: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        # Should have at least one team member
        if len(data) > 0:
            member = data[0]
            assert "user_id" in member
            assert "name" in member
        print(f"✓ Retrieved {len(data)} team members for assignment dropdowns")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
