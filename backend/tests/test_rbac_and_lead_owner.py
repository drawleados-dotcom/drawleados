"""
Test Role-Based Access Control and Lead Owner features
- Admin create user with manual password and email notification
- Business Development role with limited access (Leads, HR, Settings)
- Lead Owner auto-assignment when creating leads
- Lead Owner filter in leads list
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRBACAndLeadOwnerFeatures:
    """Test RBAC and Lead Owner functionality"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data["session_token"], data["user"]
    
    @pytest.fixture(scope="class")
    def headers(self, admin_token):
        """Get request headers with admin token"""
        token, _ = admin_token
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    # ============== ADMIN CREATE USER TESTS ==============
    
    def test_01_admin_login_success(self, admin_token):
        """Test admin can login successfully"""
        token, user = admin_token
        assert token is not None
        assert user["email"] == "vinoth@drawlead.com"
        assert user["role"] == "super_admin"
        print(f"PASS: Admin login successful - role: {user['role']}")
    
    def test_02_get_available_roles(self, headers):
        """Test getting available roles for user creation"""
        response = requests.get(f"{BASE_URL}/api/admin/roles", headers=headers)
        assert response.status_code == 200
        roles = response.json()
        
        # Verify business_development role exists
        role_values = [r["value"] for r in roles]
        assert "business_development" in role_values, "business_development role not found"
        
        # Verify business_development has correct access
        bd_role = next(r for r in roles if r["value"] == "business_development")
        assert "leads" in bd_role["default_access"]
        assert "hr" in bd_role["default_access"]
        assert "settings" in bd_role["default_access"]
        assert "operations" not in bd_role["default_access"]
        assert "finance" not in bd_role["default_access"]
        
        print(f"PASS: Roles API returns {len(roles)} roles with business_development role configured correctly")
    
    def test_03_admin_create_user_with_password(self, headers):
        """Test admin can create user with manual password"""
        unique_email = f"test_bd_{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/admin/create-user", 
            headers=headers,
            json={
                "name": "TEST_BD_NewUser",
                "email": unique_email,
                "password": "testpass123",
                "role": "business_development"
            }
        )
        
        assert response.status_code == 200, f"Failed to create user: {response.text}"
        data = response.json()
        
        # Verify user was created
        assert "user" in data
        user = data["user"]
        assert user["name"] == "TEST_BD_NewUser"
        assert user["email"] == unique_email
        assert user["role"] == "business_development"
        
        # Verify module_access is set correctly for business_development
        assert "leads" in user["module_access"]
        assert "hr" in user["module_access"]
        assert "settings" in user["module_access"]
        
        # Verify permissions are set correctly (BD should not manage users)
        assert user["can_manage_users"] == False
        
        # Email notification result
        print(f"PASS: User created successfully. Email sent: {data.get('email_sent', False)}")
        
        # Store user_id for cleanup
        self.__class__.created_bd_user_id = user["user_id"]
        self.__class__.created_bd_email = unique_email
    
    def test_04_created_user_can_login(self, headers):
        """Test newly created user can login with provided password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.__class__.created_bd_email,
            "password": "testpass123"
        })
        
        assert response.status_code == 200, f"BD user login failed: {response.text}"
        data = response.json()
        
        assert data["user"]["role"] == "business_development"
        assert "leads" in data["user"]["module_access"]
        assert "hr" in data["user"]["module_access"]
        assert "settings" in data["user"]["module_access"]
        
        # Store token for further tests
        self.__class__.bd_user_token = data["session_token"]
        print(f"PASS: BD user can login with provided password")
    
    def test_05_bd_user_cannot_access_admin_roles(self):
        """Test BD user cannot access admin endpoints"""
        bd_headers = {
            "Authorization": f"Bearer {self.__class__.bd_user_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(f"{BASE_URL}/api/admin/roles", headers=bd_headers)
        assert response.status_code == 403, f"BD user should not access admin/roles: {response.status_code}"
        print(f"PASS: BD user correctly denied access to admin/roles endpoint")
    
    # ============== LEAD OWNER AUTO-ASSIGNMENT TESTS ==============
    
    def test_06_lead_auto_assigns_current_user_as_owner(self, headers, admin_token):
        """Test creating a lead auto-assigns current user as lead_owner"""
        _, admin_user = admin_token
        
        response = requests.post(f"{BASE_URL}/api/leads-v2/leads",
            headers=headers,
            json={
                "name": "TEST_AutoAssign_Lead",
                "email": "autoassign@test.com",
                "phone": "9876543210"
            }
        )
        
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        lead = response.json()
        
        # Verify lead_owner is auto-assigned to current user
        assert lead["lead_owner"] == admin_user["user_id"], \
            f"lead_owner should be {admin_user['user_id']}, got {lead['lead_owner']}"
        assert lead["lead_owner_name"] == admin_user["name"]
        
        print(f"PASS: Lead auto-assigned lead_owner to {lead['lead_owner_name']}")
        
        # Store for cleanup
        self.__class__.auto_assign_lead_id = lead["lead_id"]
    
    def test_07_lead_with_explicit_owner(self, headers):
        """Test creating a lead with explicit lead_owner"""
        # Use the BD user we created as lead owner
        bd_user_id = self.__class__.created_bd_user_id
        
        response = requests.post(f"{BASE_URL}/api/leads-v2/leads",
            headers=headers,
            json={
                "name": "TEST_ExplicitOwner_Lead",
                "email": "explicitowner@test.com",
                "phone": "8765432109",
                "lead_owner": bd_user_id
            }
        )
        
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        lead = response.json()
        
        # Verify lead_owner is the explicit one
        assert lead["lead_owner"] == bd_user_id
        
        print(f"PASS: Lead created with explicit lead_owner: {bd_user_id}")
        
        # Store for cleanup
        self.__class__.explicit_owner_lead_id = lead["lead_id"]
    
    # ============== LEAD OWNER FILTER TESTS ==============
    
    def test_08_team_members_endpoint(self, headers):
        """Test team members endpoint for Lead Owner dropdown"""
        response = requests.get(f"{BASE_URL}/api/leads-v2/team-members", headers=headers)
        
        assert response.status_code == 200
        members = response.json()
        
        assert len(members) >= 1
        
        # Verify structure
        for member in members:
            assert "user_id" in member
            assert "name" in member
            assert "email" in member
            assert "role" in member
        
        print(f"PASS: Team members endpoint returns {len(members)} members")
    
    def test_09_leads_filter_by_owner(self, headers, admin_token):
        """Test filtering leads by lead_owner"""
        _, admin_user = admin_token
        
        # Get all leads first
        all_response = requests.get(f"{BASE_URL}/api/leads-v2/leads", headers=headers)
        assert all_response.status_code == 200
        all_leads = all_response.json()
        
        # Filter by admin user_id
        filter_response = requests.get(
            f"{BASE_URL}/api/leads-v2/leads?lead_owner={admin_user['user_id']}", 
            headers=headers
        )
        assert filter_response.status_code == 200
        filtered_leads = filter_response.json()
        
        # Verify all filtered leads belong to admin
        for lead in filtered_leads:
            assert lead["lead_owner"] == admin_user["user_id"], \
                f"Lead {lead['lead_id']} has wrong lead_owner: {lead['lead_owner']}"
        
        print(f"PASS: Lead filter by owner works - {len(filtered_leads)} leads for admin out of {len(all_leads)} total")
    
    def test_10_leads_filter_by_bd_owner(self, headers):
        """Test filtering leads by BD user lead_owner"""
        bd_user_id = self.__class__.created_bd_user_id
        
        response = requests.get(
            f"{BASE_URL}/api/leads-v2/leads?lead_owner={bd_user_id}", 
            headers=headers
        )
        assert response.status_code == 200
        leads = response.json()
        
        # Should have at least the one we created with explicit owner
        bd_leads = [l for l in leads if l["lead_owner"] == bd_user_id]
        assert len(bd_leads) >= 1
        
        print(f"PASS: Lead filter by BD owner returns {len(bd_leads)} leads")
    
    # ============== REQUEST OTP / CHANGE PASSWORD TESTS ==============
    
    def test_11_request_password_otp(self, headers):
        """Test requesting OTP for password change"""
        response = requests.post(f"{BASE_URL}/api/auth/request-otp", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "email" in data
        # Email should be partially masked
        assert "***" in data["email"]
        
        print(f"PASS: OTP request successful - email hint: {data['email']}")
    
    # ============== CLEANUP ==============
    
    def test_99_cleanup(self, headers):
        """Clean up test data"""
        # Delete test leads
        if hasattr(self.__class__, 'auto_assign_lead_id'):
            requests.delete(f"{BASE_URL}/api/leads-v2/leads/{self.__class__.auto_assign_lead_id}", headers=headers)
        
        if hasattr(self.__class__, 'explicit_owner_lead_id'):
            requests.delete(f"{BASE_URL}/api/leads-v2/leads/{self.__class__.explicit_owner_lead_id}", headers=headers)
        
        # Deactivate test user
        if hasattr(self.__class__, 'created_bd_user_id'):
            requests.delete(f"{BASE_URL}/api/users/{self.__class__.created_bd_user_id}", headers=headers)
        
        print("PASS: Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
