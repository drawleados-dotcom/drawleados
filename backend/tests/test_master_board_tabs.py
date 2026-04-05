"""
Test Master Board Tabs - Additional Tasks and Meetings APIs
Tests for the new tabs in Web Dev Master Board: Ad.Tasks and Meetings
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMasterBoardTabs:
    """Test suite for Master Board new tabs: Ad.Tasks and Meetings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get session token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        self.token = data.get("session_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        # Cleanup test data
        self._cleanup_test_data()
    
    def _cleanup_test_data(self):
        """Clean up test-created data"""
        # Get all additional tasks and delete TEST_ prefixed ones
        try:
            tasks = self.session.get(f"{BASE_URL}/api/additional-tasks/").json()
            for task in tasks:
                if task.get("title", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/additional-tasks/{task['task_id']}")
        except:
            pass
        
        # Get all meetings and delete TEST_ prefixed ones
        try:
            meetings = self.session.get(f"{BASE_URL}/api/meetings/").json()
            for meeting in meetings:
                if meeting.get("title", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/meetings/{meeting['meeting_id']}")
        except:
            pass
    
    # ==================== ADDITIONAL TASKS TESTS ====================
    
    def test_get_all_additional_tasks(self):
        """Test GET /api/additional-tasks/ - List all tasks"""
        response = self.session.get(f"{BASE_URL}/api/additional-tasks/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} additional tasks")
    
    def test_create_additional_task(self):
        """Test POST /api/additional-tasks/ - Create new task"""
        task_data = {
            "title": "TEST_AdTask_Create",
            "description": "Test task for automated testing",
            "priority": "high",
            "status": "To-Do",
            "due_date": "2026-01-25",
            "category": "Testing"
        }
        
        response = self.session.post(f"{BASE_URL}/api/additional-tasks/", json=task_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "task" in data
        
        task = data["task"]
        assert task["title"] == "TEST_AdTask_Create"
        assert task["priority"] == "high"
        assert task["status"] == "To-Do"
        assert "task_id" in task
        print(f"Created task: {task['task_id']}")
    
    def test_update_additional_task_status(self):
        """Test PUT /api/additional-tasks/{task_id}/status - Update status"""
        # First create a task
        create_response = self.session.post(f"{BASE_URL}/api/additional-tasks/", json={
            "title": "TEST_AdTask_Status",
            "status": "To-Do"
        })
        task_id = create_response.json()["task"]["task_id"]
        
        # Update status to In Progress
        response = self.session.put(
            f"{BASE_URL}/api/additional-tasks/{task_id}/status",
            json={"status": "In Progress"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "In Progress"
        
        # Update status to Completed
        response = self.session.put(
            f"{BASE_URL}/api/additional-tasks/{task_id}/status",
            json={"status": "Completed"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "Completed"
        print(f"Task {task_id} status updated successfully")
    
    def test_add_time_to_additional_task(self):
        """Test PUT /api/additional-tasks/{task_id}/add-time - Add time spent"""
        # First create a task
        create_response = self.session.post(f"{BASE_URL}/api/additional-tasks/", json={
            "title": "TEST_AdTask_Time",
            "status": "In Progress"
        })
        task_id = create_response.json()["task"]["task_id"]
        
        # Add 5 minutes (300 seconds)
        response = self.session.put(
            f"{BASE_URL}/api/additional-tasks/{task_id}/add-time",
            json={"seconds": 300}
        )
        assert response.status_code == 200
        assert response.json()["total_time"] == 300
        
        # Add another 10 minutes (600 seconds)
        response = self.session.put(
            f"{BASE_URL}/api/additional-tasks/{task_id}/add-time",
            json={"seconds": 600}
        )
        assert response.status_code == 200
        assert response.json()["total_time"] == 900  # 300 + 600
        print(f"Task {task_id} time tracking working: 900 seconds total")
    
    def test_delete_additional_task(self):
        """Test DELETE /api/additional-tasks/{task_id} - Delete task"""
        # First create a task
        create_response = self.session.post(f"{BASE_URL}/api/additional-tasks/", json={
            "title": "TEST_AdTask_Delete"
        })
        task_id = create_response.json()["task"]["task_id"]
        
        # Delete the task
        response = self.session.delete(f"{BASE_URL}/api/additional-tasks/{task_id}")
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify task is deleted (should return 404)
        get_response = self.session.get(f"{BASE_URL}/api/additional-tasks/")
        tasks = get_response.json()
        task_ids = [t["task_id"] for t in tasks]
        assert task_id not in task_ids
        print(f"Task {task_id} deleted successfully")
    
    def test_invalid_status_additional_task(self):
        """Test invalid status update returns error"""
        # First create a task
        create_response = self.session.post(f"{BASE_URL}/api/additional-tasks/", json={
            "title": "TEST_AdTask_InvalidStatus"
        })
        task_id = create_response.json()["task"]["task_id"]
        
        # Try invalid status
        response = self.session.put(
            f"{BASE_URL}/api/additional-tasks/{task_id}/status",
            json={"status": "InvalidStatus"}
        )
        assert response.status_code == 400
        print("Invalid status correctly rejected")
    
    # ==================== MEETINGS TESTS ====================
    
    def test_get_all_meetings(self):
        """Test GET /api/meetings/ - List all meetings"""
        response = self.session.get(f"{BASE_URL}/api/meetings/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} meetings")
    
    def test_create_meeting(self):
        """Test POST /api/meetings/ - Create new meeting"""
        meeting_data = {
            "title": "TEST_Meeting_Create",
            "description": "Test meeting for automated testing",
            "date": "2026-01-25",
            "start_time": "14:00",
            "end_time": "15:00",
            "meeting_type": "video",
            "meeting_link": "https://meet.google.com/test-meeting",
            "agenda": "1. Review test results\n2. Plan next sprint"
        }
        
        response = self.session.post(f"{BASE_URL}/api/meetings/", json=meeting_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "meeting" in data
        
        meeting = data["meeting"]
        assert meeting["title"] == "TEST_Meeting_Create"
        assert meeting["meeting_type"] == "video"
        assert meeting["status"] == "scheduled"
        assert "meeting_id" in meeting
        print(f"Created meeting: {meeting['meeting_id']}")
    
    def test_update_meeting_status(self):
        """Test PUT /api/meetings/{meeting_id}/status - Update status"""
        # First create a meeting
        create_response = self.session.post(f"{BASE_URL}/api/meetings/", json={
            "title": "TEST_Meeting_Status",
            "date": "2026-01-25",
            "start_time": "10:00",
            "end_time": "11:00"
        })
        meeting_id = create_response.json()["meeting"]["meeting_id"]
        
        # Update status to ongoing
        response = self.session.put(
            f"{BASE_URL}/api/meetings/{meeting_id}/status",
            json={"status": "ongoing"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "ongoing"
        
        # Update status to completed
        response = self.session.put(
            f"{BASE_URL}/api/meetings/{meeting_id}/status",
            json={"status": "completed"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "completed"
        print(f"Meeting {meeting_id} status updated successfully")
    
    def test_delete_meeting(self):
        """Test DELETE /api/meetings/{meeting_id} - Delete meeting"""
        # First create a meeting
        create_response = self.session.post(f"{BASE_URL}/api/meetings/", json={
            "title": "TEST_Meeting_Delete",
            "date": "2026-01-25",
            "start_time": "16:00",
            "end_time": "17:00"
        })
        meeting_id = create_response.json()["meeting"]["meeting_id"]
        
        # Delete the meeting
        response = self.session.delete(f"{BASE_URL}/api/meetings/{meeting_id}")
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify meeting is deleted
        get_response = self.session.get(f"{BASE_URL}/api/meetings/")
        meetings = get_response.json()
        meeting_ids = [m["meeting_id"] for m in meetings]
        assert meeting_id not in meeting_ids
        print(f"Meeting {meeting_id} deleted successfully")
    
    def test_get_upcoming_meetings(self):
        """Test GET /api/meetings/upcoming - Get upcoming meetings"""
        response = self.session.get(f"{BASE_URL}/api/meetings/upcoming")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} upcoming meetings")
    
    def test_get_my_meetings(self):
        """Test GET /api/meetings/my-meetings - Get user's meetings"""
        response = self.session.get(f"{BASE_URL}/api/meetings/my-meetings")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} user meetings")
    
    def test_invalid_meeting_status(self):
        """Test invalid meeting status returns error"""
        # First create a meeting
        create_response = self.session.post(f"{BASE_URL}/api/meetings/", json={
            "title": "TEST_Meeting_InvalidStatus",
            "date": "2026-01-25",
            "start_time": "09:00",
            "end_time": "10:00"
        })
        meeting_id = create_response.json()["meeting"]["meeting_id"]
        
        # Try invalid status
        response = self.session.put(
            f"{BASE_URL}/api/meetings/{meeting_id}/status",
            json={"status": "invalid_status"}
        )
        assert response.status_code == 400
        print("Invalid meeting status correctly rejected")
    
    def test_calendar_status(self):
        """Test GET /api/meetings/calendar/status - Check Google Calendar connection"""
        response = self.session.get(f"{BASE_URL}/api/meetings/calendar/status")
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        assert "message" in data
        print(f"Calendar status: connected={data['connected']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
