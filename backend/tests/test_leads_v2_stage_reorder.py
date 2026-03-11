"""
Test file for Leads V2 Stage Reordering Feature
This tests the bug fix where /stages/reorder endpoint was matching /stages/{stage_id} route
Root cause: FastAPI route ordering conflict - static routes must come before dynamic routes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')

class TestLeadsV2StageReorder:
    """Test suite for stage reordering feature"""
    
    auth_token = None
    original_stage_order = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token before tests"""
        if not TestLeadsV2StageReorder.auth_token:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": "vinoth@drawlead.com", "password": "admin123"}
            )
            assert response.status_code == 200, f"Login failed: {response.text}"
            data = response.json()
            TestLeadsV2StageReorder.auth_token = data["session_token"]
    
    @property
    def headers(self):
        return {"Authorization": f"Bearer {TestLeadsV2StageReorder.auth_token}"}
    
    def test_01_get_stages(self):
        """Test GET /stages endpoint returns stages sorted by order"""
        response = requests.get(f"{BASE_URL}/api/leads-v2/stages", headers=self.headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        stages = response.json()
        assert isinstance(stages, list), "Response should be a list"
        assert len(stages) > 0, "Should have at least one stage"
        
        # Verify stages have required fields
        for stage in stages:
            assert "stage_id" in stage, "Stage should have stage_id"
            assert "name" in stage, "Stage should have name"
            assert "order" in stage, "Stage should have order"
            assert "color" in stage, "Stage should have color"
        
        # Store original order for later test
        TestLeadsV2StageReorder.original_stage_order = [
            {"stage_id": s["stage_id"], "order": s["order"]} for s in stages
        ]
        
        # Verify stages are sorted by order
        orders = [s["order"] for s in stages]
        assert orders == sorted(orders), f"Stages should be sorted by order: {orders}"
        
        print(f"SUCCESS: GET /stages returned {len(stages)} stages in order: {[s['name'] for s in stages]}")
    
    def test_02_reorder_stages_endpoint(self):
        """Test PUT /stages/reorder endpoint - THE MAIN BUG FIX TEST"""
        # First get current stages
        response = requests.get(f"{BASE_URL}/api/leads-v2/stages", headers=self.headers)
        stages = response.json()
        
        if len(stages) < 2:
            pytest.skip("Need at least 2 stages to test reordering")
        
        # Swap first two stages
        reorder_payload = {
            "stages": [
                {"stage_id": stages[1]["stage_id"], "order": 0},
                {"stage_id": stages[0]["stage_id"], "order": 1}
            ]
        }
        # Add remaining stages with their original order
        for i, stage in enumerate(stages[2:], start=2):
            reorder_payload["stages"].append({"stage_id": stage["stage_id"], "order": i})
        
        # Call the reorder endpoint
        response = requests.put(
            f"{BASE_URL}/api/leads-v2/stages/reorder",
            json=reorder_payload,
            headers=self.headers
        )
        
        # This should return 200, not 422 (validation error) or 500
        # The bug was that 'reorder' was being interpreted as a stage_id
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, f"Response should have message: {data}"
        assert data["message"] == "Stages reordered", f"Unexpected message: {data['message']}"
        
        print("SUCCESS: PUT /stages/reorder returned 200 with correct message")
    
    def test_03_verify_reorder_persisted(self):
        """Verify that the reorder was actually persisted in the database"""
        response = requests.get(f"{BASE_URL}/api/leads-v2/stages", headers=self.headers)
        stages = response.json()
        
        # The first two stages should be swapped
        if len(stages) >= 2:
            # First stage should now be what was second
            original = TestLeadsV2StageReorder.original_stage_order
            if original and len(original) >= 2:
                # After swap: original[1] should be first, original[0] should be second
                assert stages[0]["stage_id"] == original[1]["stage_id"], \
                    f"First stage should be {original[1]['stage_id']}, got {stages[0]['stage_id']}"
                assert stages[1]["stage_id"] == original[0]["stage_id"], \
                    f"Second stage should be {original[0]['stage_id']}, got {stages[1]['stage_id']}"
                
                print(f"SUCCESS: Stage order persisted - Now: {[s['name'] for s in stages]}")
    
    def test_04_restore_original_order(self):
        """Restore original stage order for clean test state"""
        original = TestLeadsV2StageReorder.original_stage_order
        if not original:
            pytest.skip("No original order to restore")
        
        # Restore original order
        reorder_payload = {
            "stages": original
        }
        
        response = requests.put(
            f"{BASE_URL}/api/leads-v2/stages/reorder",
            json=reorder_payload,
            headers=self.headers
        )
        
        assert response.status_code == 200
        
        # Verify restoration
        response = requests.get(f"{BASE_URL}/api/leads-v2/stages", headers=self.headers)
        stages = response.json()
        
        for i, expected in enumerate(original):
            assert stages[i]["stage_id"] == expected["stage_id"], \
                f"Stage {i} should be {expected['stage_id']}"
        
        print("SUCCESS: Original stage order restored")
    
    def test_05_reorder_with_invalid_stage_id(self):
        """Test reorder with invalid stage_id returns appropriate error"""
        reorder_payload = {
            "stages": [
                {"stage_id": "invalid_stage_123", "order": 0}
            ]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/leads-v2/stages/reorder",
            json=reorder_payload,
            headers=self.headers
        )
        
        # Should return 200 (endpoint works, just doesn't update anything)
        # or could return 404/400 if validation added
        assert response.status_code in [200, 400, 404], \
            f"Expected 200/400/404, got {response.status_code}"
        
        print(f"SUCCESS: Invalid stage_id handled correctly (status: {response.status_code})")
    
    def test_06_put_stages_stage_id_still_works(self):
        """Verify that PUT /stages/{stage_id} still works after fix"""
        # Get first stage
        response = requests.get(f"{BASE_URL}/api/leads-v2/stages", headers=self.headers)
        stages = response.json()
        
        if not stages:
            pytest.skip("No stages to update")
        
        stage = stages[0]
        original_name = stage["name"]
        
        # Update the stage name
        response = requests.put(
            f"{BASE_URL}/api/leads-v2/stages/{stage['stage_id']}",
            json={"name": f"TEST_{original_name}"},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        updated = response.json()
        assert updated["name"] == f"TEST_{original_name}"
        
        # Restore original name
        response = requests.put(
            f"{BASE_URL}/api/leads-v2/stages/{stage['stage_id']}",
            json={"name": original_name},
            headers=self.headers
        )
        assert response.status_code == 200
        
        print(f"SUCCESS: PUT /stages/{stage['stage_id']} still works correctly")


class TestLeadsV2Authentication:
    """Test authentication for leads-v2 endpoints"""
    
    def test_unauthenticated_stages_request(self):
        """Test that unauthenticated request returns 401"""
        response = requests.get(f"{BASE_URL}/api/leads-v2/stages")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Unauthenticated request returns 401")
    
    def test_unauthenticated_reorder_request(self):
        """Test that unauthenticated reorder request returns 401"""
        response = requests.put(
            f"{BASE_URL}/api/leads-v2/stages/reorder",
            json={"stages": []}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Unauthenticated reorder request returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
