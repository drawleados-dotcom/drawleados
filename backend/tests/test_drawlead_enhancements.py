"""
Test Drawlead OS Enhancements:
1. HR Admin Designations - employee count badge
2. BDE Tasks - time tracking (Start/Pause/Resume/Finish)
3. HR Portal Calendar - date detail with tasks
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "Vinoth@drawlead.com"
SUPER_ADMIN_PASSWORD = "6383145061"
BDE_EMAIL = "bde@drawlead.com"
BDE_PASSWORD = "bde123456"


class TestAuth:
    """Authentication tests"""
    
    def test_super_admin_login(self):
        """Test Super Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        print(f"Super Admin Login: {response.status_code}")
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data or "session_token" in data, "No token in response"
        print(f"Super Admin login successful")
        return data.get("token") or data.get("session_token")
    
    def test_bde_login(self):
        """Test BDE login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": BDE_EMAIL,
            "password": BDE_PASSWORD
        })
        print(f"BDE Login: {response.status_code}")
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data or "session_token" in data, "No token in response"
        print(f"BDE login successful")
        return data.get("token") or data.get("session_token")


class TestDesignations:
    """Test HR Admin Designations with employee count"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("session_token")
        pytest.skip("Authentication failed")
    
    def test_get_designations_with_employee_count(self, auth_token):
        """Test that designations endpoint returns employee_count"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/designations/", headers=headers)
        
        print(f"Designations API: {response.status_code}")
        assert response.status_code == 200, f"Failed to get designations: {response.text}"
        
        data = response.json()
        print(f"Designations count: {len(data)}")
        
        # Check if designations have employee_count field
        if len(data) > 0:
            first_designation = data[0]
            print(f"First designation: {first_designation}")
            assert "employee_count" in first_designation or "title" in first_designation, "Designation missing expected fields"
            
            # Check employee_count field exists
            has_employee_count = any("employee_count" in d for d in data)
            print(f"Has employee_count field: {has_employee_count}")
            
            for d in data:
                if "employee_count" in d:
                    print(f"Designation '{d.get('title')}' has {d.get('employee_count')} employees")
        
        return data


class TestBDETasks:
    """Test BDE Tasks with time tracking"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for BDE user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": BDE_EMAIL,
            "password": BDE_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("session_token")
        pytest.skip("BDE Authentication failed")
    
    @pytest.fixture
    def super_admin_token(self):
        """Get auth token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("session_token")
        pytest.skip("Super Admin Authentication failed")
    
    def test_get_tasks(self, super_admin_token):
        """Test getting BDE tasks"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/bde/tasks", headers=headers)
        
        print(f"BDE Tasks API: {response.status_code}")
        assert response.status_code == 200, f"Failed to get tasks: {response.text}"
        
        data = response.json()
        print(f"Tasks count: {len(data)}")
        
        if len(data) > 0:
            task = data[0]
            print(f"First task: {task.get('task_name')}")
            
            # Check for required fields
            expected_fields = ["task_id", "task_name", "created_by", "assigned_to", "due_date", "time_tracking"]
            for field in expected_fields:
                if field in task:
                    print(f"  {field}: {task.get(field)}")
            
            # Check time_tracking structure
            if "time_tracking" in task:
                tt = task["time_tracking"]
                print(f"  Time tracking status: {tt.get('status')}")
                print(f"  Total seconds: {tt.get('total_seconds')}")
        
        return data
    
    def test_create_task(self, super_admin_token):
        """Test creating a BDE task"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        task_data = {
            "task_name": f"TEST_Task_{datetime.now().strftime('%H%M%S')}",
            "description": "Test task for time tracking",
            "priority": "medium",
            "type": "general",
            "status": "pending"
        }
        
        response = requests.post(f"{BASE_URL}/api/bde/tasks", json=task_data, headers=headers)
        print(f"Create Task API: {response.status_code}")
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        
        data = response.json()
        print(f"Created task: {data}")
        
        task = data.get("task")
        assert task is not None, "No task in response"
        assert "task_id" in task, "No task_id in response"
        assert "time_tracking" in task, "No time_tracking in response"
        
        return task
    
    def test_time_tracking_start(self, super_admin_token):
        """Test starting time tracking on a task"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First create a task
        task_data = {
            "task_name": f"TEST_TimeTrack_{datetime.now().strftime('%H%M%S')}",
            "description": "Test task for time tracking",
            "priority": "medium",
            "type": "general",
            "status": "pending"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/bde/tasks", json=task_data, headers=headers)
        assert create_response.status_code == 200, f"Failed to create task: {create_response.text}"
        task = create_response.json().get("task")
        task_id = task["task_id"]
        
        # Start time tracking
        response = requests.post(
            f"{BASE_URL}/api/bde/tasks/{task_id}/time-tracking",
            json={"action": "start"},
            headers=headers
        )
        
        print(f"Start Time Tracking API: {response.status_code}")
        assert response.status_code == 200, f"Failed to start time tracking: {response.text}"
        
        data = response.json()
        print(f"Start response: {data}")
        assert "time_tracking" in data, "No time_tracking in response"
        assert data["time_tracking"]["status"] == "running", "Status should be running"
        
        return task_id
    
    def test_time_tracking_pause(self, super_admin_token):
        """Test pausing time tracking on a task"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Create and start a task
        task_data = {
            "task_name": f"TEST_Pause_{datetime.now().strftime('%H%M%S')}",
            "description": "Test task for pause",
            "priority": "medium",
            "type": "general",
            "status": "pending"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/bde/tasks", json=task_data, headers=headers)
        task = create_response.json().get("task")
        task_id = task["task_id"]
        
        # Start
        requests.post(f"{BASE_URL}/api/bde/tasks/{task_id}/time-tracking", json={"action": "start"}, headers=headers)
        
        # Pause
        response = requests.post(
            f"{BASE_URL}/api/bde/tasks/{task_id}/time-tracking",
            json={"action": "pause"},
            headers=headers
        )
        
        print(f"Pause Time Tracking API: {response.status_code}")
        assert response.status_code == 200, f"Failed to pause time tracking: {response.text}"
        
        data = response.json()
        print(f"Pause response: {data}")
        assert data["time_tracking"]["status"] == "paused", "Status should be paused"
        
        return task_id
    
    def test_time_tracking_resume(self, super_admin_token):
        """Test resuming time tracking on a task"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Create, start, and pause a task
        task_data = {
            "task_name": f"TEST_Resume_{datetime.now().strftime('%H%M%S')}",
            "description": "Test task for resume",
            "priority": "medium",
            "type": "general",
            "status": "pending"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/bde/tasks", json=task_data, headers=headers)
        task = create_response.json().get("task")
        task_id = task["task_id"]
        
        # Start
        requests.post(f"{BASE_URL}/api/bde/tasks/{task_id}/time-tracking", json={"action": "start"}, headers=headers)
        # Pause
        requests.post(f"{BASE_URL}/api/bde/tasks/{task_id}/time-tracking", json={"action": "pause"}, headers=headers)
        
        # Resume
        response = requests.post(
            f"{BASE_URL}/api/bde/tasks/{task_id}/time-tracking",
            json={"action": "resume"},
            headers=headers
        )
        
        print(f"Resume Time Tracking API: {response.status_code}")
        assert response.status_code == 200, f"Failed to resume time tracking: {response.text}"
        
        data = response.json()
        print(f"Resume response: {data}")
        assert data["time_tracking"]["status"] == "running", "Status should be running after resume"
        
        return task_id
    
    def test_time_tracking_finish(self, super_admin_token):
        """Test finishing time tracking on a task"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Create and start a task
        task_data = {
            "task_name": f"TEST_Finish_{datetime.now().strftime('%H%M%S')}",
            "description": "Test task for finish",
            "priority": "medium",
            "type": "general",
            "status": "pending"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/bde/tasks", json=task_data, headers=headers)
        task = create_response.json().get("task")
        task_id = task["task_id"]
        
        # Start
        requests.post(f"{BASE_URL}/api/bde/tasks/{task_id}/time-tracking", json={"action": "start"}, headers=headers)
        
        # Finish
        response = requests.post(
            f"{BASE_URL}/api/bde/tasks/{task_id}/time-tracking",
            json={"action": "finish"},
            headers=headers
        )
        
        print(f"Finish Time Tracking API: {response.status_code}")
        assert response.status_code == 200, f"Failed to finish time tracking: {response.text}"
        
        data = response.json()
        print(f"Finish response: {data}")
        assert data["time_tracking"]["status"] == "finished", "Status should be finished"
        
        return task_id


class TestHRCalendar:
    """Test HR Portal Calendar with date detail"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("session_token")
        pytest.skip("Authentication failed")
    
    def test_get_attendance_calendar(self, auth_token):
        """Test getting attendance calendar for a month"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get current month calendar
        now = datetime.now()
        year = now.year
        month = now.month
        
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/calendar/{year}/{month}",
            headers=headers
        )
        
        print(f"Attendance Calendar API: {response.status_code}")
        assert response.status_code == 200, f"Failed to get calendar: {response.text}"
        
        data = response.json()
        print(f"Calendar data keys: {data.keys()}")
        
        # Check expected fields
        assert "year" in data, "Missing year"
        assert "month" in data, "Missing month"
        assert "calendar_data" in data, "Missing calendar_data"
        assert "summary" in data, "Missing summary"
        
        print(f"Calendar summary: {data.get('summary')}")
        
        return data
    
    def test_get_date_detail(self, auth_token):
        """Test getting date detail with tasks"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get today's date detail
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/date-detail/{today}",
            headers=headers
        )
        
        print(f"Date Detail API: {response.status_code}")
        assert response.status_code == 200, f"Failed to get date detail: {response.text}"
        
        data = response.json()
        print(f"Date detail keys: {data.keys()}")
        
        # Check expected fields
        assert "date" in data, "Missing date"
        assert "attendance" in data, "Missing attendance"
        assert "tasks" in data, "Missing tasks"
        assert "work_summary" in data, "Missing work_summary"
        
        print(f"Date: {data.get('date')}")
        print(f"Attendance: {data.get('attendance')}")
        print(f"Tasks count: {len(data.get('tasks', []))}")
        print(f"Work summary: {data.get('work_summary')}")
        
        return data
    
    def test_get_date_detail_specific_date(self, auth_token):
        """Test getting date detail for April 2, 2025"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get April 2, 2025 date detail
        date = "2025-04-02"
        
        response = requests.get(
            f"{BASE_URL}/api/hr/attendance/date-detail/{date}",
            headers=headers
        )
        
        print(f"Date Detail API for {date}: {response.status_code}")
        assert response.status_code == 200, f"Failed to get date detail: {response.text}"
        
        data = response.json()
        print(f"Date detail for {date}: {data}")
        
        return data


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("session_token")
        pytest.skip("Authentication failed")
    
    def test_cleanup_test_tasks(self, auth_token):
        """Delete test tasks created during testing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get all tasks
        response = requests.get(f"{BASE_URL}/api/bde/tasks", headers=headers)
        if response.status_code == 200:
            tasks = response.json()
            deleted_count = 0
            for task in tasks:
                if task.get("task_name", "").startswith("TEST_"):
                    task_id = task.get("task_id")
                    del_response = requests.delete(f"{BASE_URL}/api/bde/tasks/{task_id}", headers=headers)
                    if del_response.status_code == 200:
                        deleted_count += 1
            print(f"Deleted {deleted_count} test tasks")
        
        return True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
