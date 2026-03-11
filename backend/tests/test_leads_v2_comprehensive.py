"""
Comprehensive tests for Leads V2 Module with new features:
- 8 new stages: Prospect, Lead, Qualified, Proposal, Negotiation, Followup, Payment Stage, Deal Closed
- Services API with add new feature
- Industries API with add new feature
- Team Members API for Lead Owner dropdown
- Follow-up API with auto-date capture
- Lead CRUD with all comprehensive fields
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "vinoth@drawlead.com"
TEST_PASSWORD = "admin123"

class TestLeadsV2Authentication:
    """Tests for authentication"""
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "session_token" in data or "token" in data
        print(f"✓ Login successful")

class TestLeadsV2Stages:
    """Tests for the 8 new stages"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = response.json().get("session_token") or response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_stages_returns_8_default(self):
        """Test that default stages are created correctly"""
        response = requests.get(f"{BASE_URL}/api/leads-v2/stages", headers=self.headers)
        assert response.status_code == 200, f"Failed to get stages: {response.text}"
        stages = response.json()
        
        # Expected stages from the PRD
        expected_stage_names = ["Prospect", "Lead", "Qualified", "Proposal", "Negotiation", "Followup", "Payment Stage", "Deal Closed"]
        
        print(f"✓ Received {len(stages)} stages")
        for stage in stages:
            print(f"  - {stage['name']} (order: {stage.get('order')})")
        
        # Check if all expected stages exist
        stage_names = [s['name'] for s in stages]
        for expected in expected_stage_names:
            assert expected in stage_names, f"Missing expected stage: {expected}"
        
        print(f"✓ All 8 expected stages found")
    
    def test_stages_have_required_fields(self):
        """Test that stages have all required fields"""
        response = requests.get(f"{BASE_URL}/api/leads-v2/stages", headers=self.headers)
        stages = response.json()
        
        for stage in stages:
            assert "stage_id" in stage, "Missing stage_id"
            assert "name" in stage, "Missing name"
            assert "color" in stage, "Missing color"
            assert "order" in stage, "Missing order"
        
        print(f"✓ All stages have required fields")

class TestLeadsV2Services:
    """Tests for Services dropdown API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = response.json().get("session_token") or response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_services(self):
        """Test GET /api/leads-v2/services"""
        response = requests.get(f"{BASE_URL}/api/leads-v2/services", headers=self.headers)
        assert response.status_code == 200, f"Failed to get services: {response.text}"
        services = response.json()
        
        assert isinstance(services, list), "Services should be a list"
        print(f"✓ Retrieved {len(services)} services")
        
        # Check default services exist
        if len(services) > 0:
            service_names = [s['name'] for s in services]
            print(f"  Services: {', '.join(service_names)}")
    
    def test_create_service(self):
        """Test POST /api/leads-v2/services - Add new service"""
        unique_name = f"TEST_Service_{uuid.uuid4().hex[:6]}"
        response = requests.post(
            f"{BASE_URL}/api/leads-v2/services",
            json={"name": unique_name},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to create service: {response.text}"
        data = response.json()
        
        assert data["name"] == unique_name, "Service name mismatch"
        assert "service_id" in data, "Missing service_id in response"
        print(f"✓ Created service: {unique_name}")
    
    def test_create_duplicate_service_fails(self):
        """Test that creating duplicate service fails"""
        unique_name = f"TEST_DupService_{uuid.uuid4().hex[:6]}"
        # Create first
        requests.post(f"{BASE_URL}/api/leads-v2/services", json={"name": unique_name}, headers=self.headers)
        # Try to create duplicate
        response = requests.post(f"{BASE_URL}/api/leads-v2/services", json={"name": unique_name}, headers=self.headers)
        assert response.status_code == 400, "Should reject duplicate service"
        print(f"✓ Duplicate service rejected correctly")

class TestLeadsV2Industries:
    """Tests for Industries dropdown API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = response.json().get("session_token") or response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_industries(self):
        """Test GET /api/leads-v2/industries"""
        response = requests.get(f"{BASE_URL}/api/leads-v2/industries", headers=self.headers)
        assert response.status_code == 200, f"Failed to get industries: {response.text}"
        industries = response.json()
        
        assert isinstance(industries, list), "Industries should be a list"
        print(f"✓ Retrieved {len(industries)} industries")
        
        # Check default industries exist
        if len(industries) > 0:
            industry_names = [i['name'] for i in industries]
            print(f"  Industries: {', '.join(industry_names[:5])}...")
    
    def test_create_industry(self):
        """Test POST /api/leads-v2/industries - Add new industry"""
        unique_name = f"TEST_Industry_{uuid.uuid4().hex[:6]}"
        response = requests.post(
            f"{BASE_URL}/api/leads-v2/industries",
            json={"name": unique_name},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to create industry: {response.text}"
        data = response.json()
        
        assert data["name"] == unique_name, "Industry name mismatch"
        assert "industry_id" in data, "Missing industry_id in response"
        print(f"✓ Created industry: {unique_name}")
    
    def test_create_duplicate_industry_fails(self):
        """Test that creating duplicate industry fails"""
        unique_name = f"TEST_DupInd_{uuid.uuid4().hex[:6]}"
        # Create first
        requests.post(f"{BASE_URL}/api/leads-v2/industries", json={"name": unique_name}, headers=self.headers)
        # Try to create duplicate
        response = requests.post(f"{BASE_URL}/api/leads-v2/industries", json={"name": unique_name}, headers=self.headers)
        assert response.status_code == 400, "Should reject duplicate industry"
        print(f"✓ Duplicate industry rejected correctly")

class TestLeadsV2TeamMembers:
    """Tests for Team Members API (Lead Owner dropdown)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = response.json().get("session_token") or response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_team_members(self):
        """Test GET /api/leads-v2/team-members"""
        response = requests.get(f"{BASE_URL}/api/leads-v2/team-members", headers=self.headers)
        assert response.status_code == 200, f"Failed to get team members: {response.text}"
        members = response.json()
        
        assert isinstance(members, list), "Team members should be a list"
        print(f"✓ Retrieved {len(members)} team members")
        
        # Verify member structure
        if len(members) > 0:
            member = members[0]
            assert "user_id" in member, "Missing user_id"
            assert "name" in member, "Missing name"
            print(f"  Team members: {', '.join([m.get('name', 'Unknown') for m in members])}")

class TestLeadsV2Leads:
    """Tests for Lead CRUD with comprehensive fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = response.json().get("session_token") or response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get stages for testing
        stages_res = requests.get(f"{BASE_URL}/api/leads-v2/stages", headers=self.headers)
        self.stages = stages_res.json()
    
    def test_create_lead_basic(self):
        """Test creating a lead with basic details"""
        lead_data = {
            "name": f"TEST_BasicLead_{uuid.uuid4().hex[:6]}",
            "email": "test@example.com",
            "phone": "+91 98765 43210",
            "location": "Chennai, Tamil Nadu",
            "stage_id": self.stages[0]["stage_id"] if self.stages else ""
        }
        
        response = requests.post(f"{BASE_URL}/api/leads-v2/leads", json=lead_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        
        data = response.json()
        assert data["name"] == lead_data["name"]
        assert data["email"] == lead_data["email"]
        assert "lead_id" in data
        
        print(f"✓ Created basic lead: {lead_data['name']}")
        return data["lead_id"]
    
    def test_create_lead_comprehensive(self):
        """Test creating a lead with all comprehensive fields"""
        lead_data = {
            # Basic Details
            "name": f"TEST_CompLead_{uuid.uuid4().hex[:6]}",
            "email": "comprehensive@test.com",
            "phone": "+91 98765 11111",
            "location": "Mumbai, Maharashtra",
            "website": "https://example.com",
            "social_media": "https://instagram.com/test",
            # Lead Details
            "source": "Website",
            "lead_owner": "",  # Will be empty for now
            "service": "Website Development",
            "priority": "High",
            "lead_type": "Inbound",
            "date_of_lead": "2024-01-15",
            "industry": "Technology",
            "estimation": 50000,
            "quotation_link": "https://drive.google.com/quotation",
            "proposal_link": "https://drive.google.com/proposal",
            "notes": "Test comprehensive lead creation",
            "stage_id": self.stages[0]["stage_id"] if self.stages else ""
        }
        
        response = requests.post(f"{BASE_URL}/api/leads-v2/leads", json=lead_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create comprehensive lead: {response.text}"
        
        data = response.json()
        # Verify all fields
        assert data["name"] == lead_data["name"]
        assert data["email"] == lead_data["email"]
        assert data["website"] == lead_data["website"]
        assert data["social_media"] == lead_data["social_media"]
        assert data["source"] == lead_data["source"]
        assert data["service"] == lead_data["service"]
        assert data["priority"] == lead_data["priority"]
        assert data["lead_type"] == lead_data["lead_type"]
        assert data["industry"] == lead_data["industry"]
        assert data["estimation"] == lead_data["estimation"]
        assert data["quotation_link"] == lead_data["quotation_link"]
        assert data["proposal_link"] == lead_data["proposal_link"]
        
        print(f"✓ Created comprehensive lead with all fields: {lead_data['name']}")
        return data["lead_id"]
    
    def test_get_leads(self):
        """Test GET /api/leads-v2/leads"""
        response = requests.get(f"{BASE_URL}/api/leads-v2/leads", headers=self.headers)
        assert response.status_code == 200, f"Failed to get leads: {response.text}"
        leads = response.json()
        
        assert isinstance(leads, list), "Leads should be a list"
        print(f"✓ Retrieved {len(leads)} leads")
    
    def test_update_lead(self):
        """Test updating a lead"""
        # First create a lead
        create_data = {
            "name": f"TEST_UpdateLead_{uuid.uuid4().hex[:6]}",
            "email": "update@test.com",
            "stage_id": self.stages[0]["stage_id"] if self.stages else ""
        }
        create_res = requests.post(f"{BASE_URL}/api/leads-v2/leads", json=create_data, headers=self.headers)
        lead_id = create_res.json()["lead_id"]
        
        # Now update it
        update_data = {
            "name": f"TEST_UpdatedLead_{uuid.uuid4().hex[:6]}",
            "priority": "High",
            "estimation": 75000
        }
        response = requests.put(f"{BASE_URL}/api/leads-v2/leads/{lead_id}", json=update_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to update lead: {response.text}"
        
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["priority"] == update_data["priority"]
        assert data["estimation"] == update_data["estimation"]
        
        print(f"✓ Updated lead: {update_data['name']}")
    
    def test_delete_lead(self):
        """Test deleting a lead"""
        # First create a lead
        create_data = {
            "name": f"TEST_DeleteLead_{uuid.uuid4().hex[:6]}",
            "stage_id": self.stages[0]["stage_id"] if self.stages else ""
        }
        create_res = requests.post(f"{BASE_URL}/api/leads-v2/leads", json=create_data, headers=self.headers)
        lead_id = create_res.json()["lead_id"]
        
        # Now delete it
        response = requests.delete(f"{BASE_URL}/api/leads-v2/leads/{lead_id}", headers=self.headers)
        assert response.status_code == 200, f"Failed to delete lead: {response.text}"
        
        print(f"✓ Deleted lead: {lead_id}")

class TestLeadsV2FollowUps:
    """Tests for Follow-up feature with auto-date capture"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = response.json().get("session_token") or response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get stages for testing
        stages_res = requests.get(f"{BASE_URL}/api/leads-v2/stages", headers=self.headers)
        self.stages = stages_res.json()
    
    def test_add_followup(self):
        """Test POST /api/leads-v2/leads/{lead_id}/followups"""
        # First create a lead
        create_data = {
            "name": f"TEST_FollowupLead_{uuid.uuid4().hex[:6]}",
            "stage_id": self.stages[0]["stage_id"] if self.stages else ""
        }
        create_res = requests.post(f"{BASE_URL}/api/leads-v2/leads", json=create_data, headers=self.headers)
        lead_id = create_res.json()["lead_id"]
        
        # Add a follow-up
        followup_data = {"remarks": "Test follow-up call completed"}
        response = requests.post(
            f"{BASE_URL}/api/leads-v2/leads/{lead_id}/followups",
            json=followup_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to add follow-up: {response.text}"
        
        data = response.json()
        assert "followups" in data, "Lead should have followups array"
        assert len(data["followups"]) > 0, "Should have at least one follow-up"
        
        followup = data["followups"][0]
        assert followup["remarks"] == followup_data["remarks"]
        assert "date" in followup, "Follow-up should have auto-captured date"
        assert "followup_id" in followup, "Follow-up should have an ID"
        assert "created_by" in followup, "Follow-up should have created_by"
        
        print(f"✓ Added follow-up with auto-date capture: {followup['date']}")
    
    def test_get_followups(self):
        """Test GET /api/leads-v2/leads/{lead_id}/followups"""
        # Create lead and add follow-up first
        create_data = {
            "name": f"TEST_GetFollowups_{uuid.uuid4().hex[:6]}",
            "stage_id": self.stages[0]["stage_id"] if self.stages else ""
        }
        create_res = requests.post(f"{BASE_URL}/api/leads-v2/leads", json=create_data, headers=self.headers)
        lead_id = create_res.json()["lead_id"]
        
        # Add two follow-ups
        requests.post(f"{BASE_URL}/api/leads-v2/leads/{lead_id}/followups", 
                     json={"remarks": "First follow-up"}, headers=self.headers)
        requests.post(f"{BASE_URL}/api/leads-v2/leads/{lead_id}/followups", 
                     json={"remarks": "Second follow-up"}, headers=self.headers)
        
        # Get follow-ups
        response = requests.get(f"{BASE_URL}/api/leads-v2/leads/{lead_id}/followups", headers=self.headers)
        assert response.status_code == 200, f"Failed to get follow-ups: {response.text}"
        
        followups = response.json()
        assert len(followups) == 2, f"Expected 2 follow-ups, got {len(followups)}"
        
        print(f"✓ Retrieved {len(followups)} follow-ups for lead")
    
    def test_followup_requires_remarks(self):
        """Test that follow-up requires remarks"""
        # Create lead
        create_data = {
            "name": f"TEST_NoRemarks_{uuid.uuid4().hex[:6]}",
            "stage_id": self.stages[0]["stage_id"] if self.stages else ""
        }
        create_res = requests.post(f"{BASE_URL}/api/leads-v2/leads", json=create_data, headers=self.headers)
        lead_id = create_res.json()["lead_id"]
        
        # Try to add follow-up without remarks
        response = requests.post(
            f"{BASE_URL}/api/leads-v2/leads/{lead_id}/followups",
            json={"remarks": ""},
            headers=self.headers
        )
        assert response.status_code == 400, "Should reject follow-up without remarks"
        
        print(f"✓ Empty remarks correctly rejected")
    
    def test_followup_nonexistent_lead(self):
        """Test follow-up on non-existent lead"""
        response = requests.get(
            f"{BASE_URL}/api/leads-v2/leads/nonexistent_lead_123/followups",
            headers=self.headers
        )
        assert response.status_code == 404, "Should return 404 for non-existent lead"
        
        print(f"✓ Non-existent lead correctly returns 404")

class TestLeadsV2Stats:
    """Tests for Stats endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = response.json().get("session_token") or response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_stats(self):
        """Test GET /api/leads-v2/stats"""
        response = requests.get(f"{BASE_URL}/api/leads-v2/stats", headers=self.headers)
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        stats = response.json()
        assert "total" in stats, "Stats should have total count"
        assert "by_stage" in stats, "Stats should have by_stage breakdown"
        
        print(f"✓ Stats: Total leads = {stats['total']}")
        print(f"  By stage breakdown:")
        for stage_id, stage_stats in stats.get("by_stage", {}).items():
            print(f"    - {stage_stats.get('name', 'Unknown')}: {stage_stats.get('count', 0)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
