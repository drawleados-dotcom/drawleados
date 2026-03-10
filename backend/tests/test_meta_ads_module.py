"""
Meta Ads Board API Tests
Tests for: Campaigns CRUD, Ads CRUD, Custom Attributes CRUD
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMetaAdsModule:
    """Tests for Meta Ads Board feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "session_token" in data
        return data["session_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Auth headers for requests"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    # ============== CAMPAIGN TESTS ==============
    
    def test_get_campaigns_initial(self, headers):
        """Test GET /api/meta-ads/campaigns returns list"""
        response = requests.get(f"{BASE_URL}/api/meta-ads/campaigns", headers=headers)
        assert response.status_code == 200, f"Failed to get campaigns: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of campaigns"
        print(f"Found {len(data)} existing campaigns")
    
    def test_create_campaign_success(self, headers):
        """Test POST /api/meta-ads/campaigns creates new campaign"""
        unique_id = uuid.uuid4().hex[:8]
        campaign_data = {
            "client_name": f"TEST_Client_{unique_id}",
            "area": "Test Area",
            "mode": "Online",
            "month": "2026-01",
            "target_name": f"TEST_Target_{unique_id}",
            "service_angle": "Testing Campaign"
        }
        
        response = requests.post(f"{BASE_URL}/api/meta-ads/campaigns", json=campaign_data, headers=headers)
        assert response.status_code == 200, f"Failed to create campaign: {response.text}"
        
        data = response.json()
        assert "campaign_id" in data, "Response should contain campaign_id"
        assert data["client_name"] == campaign_data["client_name"]
        assert data["target_name"] == campaign_data["target_name"]
        assert data["month"] == "2026-01"
        print(f"Created campaign: {data['campaign_id']}")
        
        # Store campaign_id for cleanup
        TestMetaAdsModule.test_campaign_id = data["campaign_id"]
    
    def test_create_campaign_validation(self, headers):
        """Test campaign validation - missing required fields"""
        response = requests.post(f"{BASE_URL}/api/meta-ads/campaigns", json={
            "area": "Test",
            "mode": "Online"
        }, headers=headers)
        # Should fail validation - missing client_name and target_name
        assert response.status_code in [422, 400], "Should reject missing required fields"
    
    def test_get_single_campaign(self, headers):
        """Test GET /api/meta-ads/campaigns/{id}"""
        campaign_id = getattr(TestMetaAdsModule, 'test_campaign_id', None)
        if not campaign_id:
            pytest.skip("No test campaign created")
        
        response = requests.get(f"{BASE_URL}/api/meta-ads/campaigns/{campaign_id}", headers=headers)
        assert response.status_code == 200, f"Failed to get campaign: {response.text}"
        
        data = response.json()
        assert data["campaign_id"] == campaign_id
        assert "ads" in data, "Campaign should include ads array"
    
    def test_update_campaign(self, headers):
        """Test PUT /api/meta-ads/campaigns/{id}"""
        campaign_id = getattr(TestMetaAdsModule, 'test_campaign_id', None)
        if not campaign_id:
            pytest.skip("No test campaign created")
        
        update_data = {
            "service_angle": "Updated Service Angle",
            "area": "Updated Area"
        }
        
        response = requests.put(f"{BASE_URL}/api/meta-ads/campaigns/{campaign_id}", json=update_data, headers=headers)
        assert response.status_code == 200, f"Failed to update campaign: {response.text}"
        
        data = response.json()
        assert data["service_angle"] == "Updated Service Angle"
        assert data["area"] == "Updated Area"
        print(f"Updated campaign successfully")
    
    # ============== AD TESTS ==============
    
    def test_create_ad_success(self, headers):
        """Test POST /api/meta-ads/campaigns/{id}/ads creates new ad"""
        campaign_id = getattr(TestMetaAdsModule, 'test_campaign_id', None)
        if not campaign_id:
            pytest.skip("No test campaign created")
        
        unique_id = uuid.uuid4().hex[:8]
        ad_data = {
            "ad_title": f"TEST_Ad_{unique_id}",
            "ad_type": "Static",
            "content_status": "Not Started",
            "creative_status": "Yet to Start",
            "ad_status": "Draft",
            "leads_count": 5,
            "spend": 100.0
        }
        
        response = requests.post(f"{BASE_URL}/api/meta-ads/campaigns/{campaign_id}/ads", json=ad_data, headers=headers)
        assert response.status_code == 200, f"Failed to create ad: {response.text}"
        
        data = response.json()
        assert "ad_id" in data, "Response should contain ad_id"
        assert data["ad_title"] == ad_data["ad_title"]
        assert data["campaign_id"] == campaign_id
        assert data["leads_count"] == 5
        print(f"Created ad: {data['ad_id']}")
        
        TestMetaAdsModule.test_ad_id = data["ad_id"]
    
    def test_update_ad_status(self, headers):
        """Test PUT /api/meta-ads/campaigns/{campaign_id}/ads/{ad_id} updates ad status"""
        campaign_id = getattr(TestMetaAdsModule, 'test_campaign_id', None)
        ad_id = getattr(TestMetaAdsModule, 'test_ad_id', None)
        if not campaign_id or not ad_id:
            pytest.skip("No test campaign/ad created")
        
        # Test updating content_status
        update_data = {"content_status": "Writing"}
        response = requests.put(f"{BASE_URL}/api/meta-ads/campaigns/{campaign_id}/ads/{ad_id}", json=update_data, headers=headers)
        assert response.status_code == 200, f"Failed to update ad: {response.text}"
        
        data = response.json()
        assert data["content_status"] == "Writing"
        print("Updated ad content_status to 'Writing'")
    
    def test_update_ad_creative_status(self, headers):
        """Test updating creative status (used for Kanban view)"""
        campaign_id = getattr(TestMetaAdsModule, 'test_campaign_id', None)
        ad_id = getattr(TestMetaAdsModule, 'test_ad_id', None)
        if not campaign_id or not ad_id:
            pytest.skip("No test campaign/ad created")
        
        update_data = {"creative_status": "Design"}
        response = requests.put(f"{BASE_URL}/api/meta-ads/campaigns/{campaign_id}/ads/{ad_id}", json=update_data, headers=headers)
        assert response.status_code == 200, f"Failed to update ad: {response.text}"
        
        data = response.json()
        assert data["creative_status"] == "Design"
        print("Updated ad creative_status to 'Design'")
    
    def test_update_ad_ad_status(self, headers):
        """Test updating ad_status"""
        campaign_id = getattr(TestMetaAdsModule, 'test_campaign_id', None)
        ad_id = getattr(TestMetaAdsModule, 'test_ad_id', None)
        if not campaign_id or not ad_id:
            pytest.skip("No test campaign/ad created")
        
        update_data = {"ad_status": "Active"}
        response = requests.put(f"{BASE_URL}/api/meta-ads/campaigns/{campaign_id}/ads/{ad_id}", json=update_data, headers=headers)
        assert response.status_code == 200, f"Failed to update ad: {response.text}"
        
        data = response.json()
        assert data["ad_status"] == "Active"
        print("Updated ad ad_status to 'Active'")
    
    def test_update_ad_leads_count(self, headers):
        """Test updating leads_count tracking"""
        campaign_id = getattr(TestMetaAdsModule, 'test_campaign_id', None)
        ad_id = getattr(TestMetaAdsModule, 'test_ad_id', None)
        if not campaign_id or not ad_id:
            pytest.skip("No test campaign/ad created")
        
        update_data = {"leads_count": 25}
        response = requests.put(f"{BASE_URL}/api/meta-ads/campaigns/{campaign_id}/ads/{ad_id}", json=update_data, headers=headers)
        assert response.status_code == 200, f"Failed to update ad: {response.text}"
        
        data = response.json()
        assert data["leads_count"] == 25
        print("Updated ad leads_count to 25")
    
    # ============== CUSTOM ATTRIBUTES TESTS ==============
    
    def test_get_custom_attributes(self, headers):
        """Test GET /api/meta-ads/custom-attributes"""
        response = requests.get(f"{BASE_URL}/api/meta-ads/custom-attributes", headers=headers)
        assert response.status_code == 200, f"Failed to get custom attributes: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of custom attributes"
        print(f"Found {len(data)} custom attributes")
    
    def test_create_custom_attribute_select(self, headers):
        """Test POST /api/meta-ads/custom-attributes - select type"""
        unique_id = uuid.uuid4().hex[:8]
        attr_data = {
            "name": f"TEST_Attribute_{unique_id}",
            "attr_type": "select"
        }
        
        response = requests.post(f"{BASE_URL}/api/meta-ads/custom-attributes", json=attr_data, headers=headers)
        assert response.status_code == 200, f"Failed to create custom attribute: {response.text}"
        
        data = response.json()
        assert "attr_id" in data, "Response should contain attr_id"
        assert data["name"] == attr_data["name"]
        assert data["attr_type"] == "select"
        assert "options" in data and len(data["options"]) > 0, "Select type should have default options"
        print(f"Created custom attribute: {data['attr_id']} with {len(data['options'])} default options")
        
        TestMetaAdsModule.test_attr_id = data["attr_id"]
    
    def test_create_custom_attribute_text(self, headers):
        """Test creating text type custom attribute"""
        unique_id = uuid.uuid4().hex[:8]
        attr_data = {
            "name": f"TEST_TextAttr_{unique_id}",
            "attr_type": "text"
        }
        
        response = requests.post(f"{BASE_URL}/api/meta-ads/custom-attributes", json=attr_data, headers=headers)
        assert response.status_code == 200, f"Failed to create text attribute: {response.text}"
        
        data = response.json()
        assert data["attr_type"] == "text"
        print(f"Created text attribute: {data['attr_id']}")
    
    def test_add_attribute_option(self, headers):
        """Test POST /api/meta-ads/custom-attributes/{id}/options"""
        attr_id = getattr(TestMetaAdsModule, 'test_attr_id', None)
        if not attr_id:
            pytest.skip("No test attribute created")
        
        option_data = {
            "name": "Custom Option",
            "color": "#ff5500"
        }
        
        response = requests.post(f"{BASE_URL}/api/meta-ads/custom-attributes/{attr_id}/options", json=option_data, headers=headers)
        assert response.status_code == 200, f"Failed to add option: {response.text}"
        
        data = response.json()
        # Verify option was added
        option_names = [opt["name"] for opt in data.get("options", [])]
        assert "Custom Option" in option_names, "Custom option should be in options list"
        print("Added custom option to attribute")
    
    def test_delete_custom_attribute(self, headers):
        """Test DELETE /api/meta-ads/custom-attributes/{id}"""
        attr_id = getattr(TestMetaAdsModule, 'test_attr_id', None)
        if not attr_id:
            pytest.skip("No test attribute created")
        
        response = requests.delete(f"{BASE_URL}/api/meta-ads/custom-attributes/{attr_id}", headers=headers)
        assert response.status_code == 200, f"Failed to delete attribute: {response.text}"
        
        data = response.json()
        assert data.get("message") == "Custom attribute deleted"
        print(f"Deleted custom attribute: {attr_id}")
    
    # ============== STATS TESTS ==============
    
    def test_get_stats(self, headers):
        """Test GET /api/meta-ads/stats"""
        response = requests.get(f"{BASE_URL}/api/meta-ads/stats", headers=headers)
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        data = response.json()
        assert "total_campaigns" in data
        assert "total_ads" in data
        assert "total_leads" in data
        assert "total_spend" in data
        print(f"Stats: {data['total_campaigns']} campaigns, {data['total_ads']} ads, {data['total_leads']} leads")
    
    def test_get_monthly_stats(self, headers):
        """Test GET /api/meta-ads/stats/monthly"""
        response = requests.get(f"{BASE_URL}/api/meta-ads/stats/monthly", headers=headers)
        assert response.status_code == 200, f"Failed to get monthly stats: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of monthly stats"
        print(f"Monthly stats for {len(data)} months")
    
    # ============== FILTER TESTS ==============
    
    def test_filter_campaigns_by_month(self, headers):
        """Test filtering campaigns by month"""
        response = requests.get(f"{BASE_URL}/api/meta-ads/campaigns?month=2026-01", headers=headers)
        assert response.status_code == 200, f"Failed to filter campaigns: {response.text}"
        
        data = response.json()
        # All returned campaigns should be from 2026-01
        for campaign in data:
            assert campaign.get("month") == "2026-01" or len(data) == 0
        print(f"Filtered {len(data)} campaigns for month 2026-01")
    
    def test_filter_campaigns_by_mode(self, headers):
        """Test filtering campaigns by mode"""
        response = requests.get(f"{BASE_URL}/api/meta-ads/campaigns?mode=Online", headers=headers)
        assert response.status_code == 200, f"Failed to filter campaigns: {response.text}"
        
        data = response.json()
        for campaign in data:
            assert campaign.get("mode") == "Online" or len(data) == 0
        print(f"Filtered {len(data)} Online campaigns")
    
    # ============== DELETE AD TEST ==============
    
    def test_delete_ad(self, headers):
        """Test DELETE /api/meta-ads/campaigns/{campaign_id}/ads/{ad_id}"""
        campaign_id = getattr(TestMetaAdsModule, 'test_campaign_id', None)
        ad_id = getattr(TestMetaAdsModule, 'test_ad_id', None)
        if not campaign_id or not ad_id:
            pytest.skip("No test campaign/ad created")
        
        response = requests.delete(f"{BASE_URL}/api/meta-ads/campaigns/{campaign_id}/ads/{ad_id}", headers=headers)
        assert response.status_code == 200, f"Failed to delete ad: {response.text}"
        
        data = response.json()
        assert data.get("message") == "Ad deleted"
        print(f"Deleted ad: {ad_id}")
    
    # ============== CLEANUP - DELETE CAMPAIGN ==============
    
    def test_delete_campaign(self, headers):
        """Test DELETE /api/meta-ads/campaigns/{id} - cleanup test data"""
        campaign_id = getattr(TestMetaAdsModule, 'test_campaign_id', None)
        if not campaign_id:
            pytest.skip("No test campaign to delete")
        
        response = requests.delete(f"{BASE_URL}/api/meta-ads/campaigns/{campaign_id}", headers=headers)
        assert response.status_code == 200, f"Failed to delete campaign: {response.text}"
        
        data = response.json()
        assert data.get("message") == "Campaign deleted"
        print(f"Deleted campaign: {campaign_id}")
    
    # ============== AUTH TESTS ==============
    
    def test_campaigns_require_auth(self):
        """Test that campaigns endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/meta-ads/campaigns")
        assert response.status_code == 401, "Should require authentication"
    
    def test_custom_attributes_require_auth(self):
        """Test that custom attributes endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/meta-ads/custom-attributes")
        assert response.status_code == 401, "Should require authentication"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
