"""
BDE-Style Tasks Module Backend Tests
- Time tracking with start/pause/resume/finish states
- Recurrence support (daily/weekly/monthly/yearly/weekdays/custom)
- Task stats and filtering
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "vinoth@drawlead.com"
ADMIN_PASSWORD = "admin123"


class TestBDETasksAuth:
    """Authentication for BDE Tasks tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session_token in response"
        return data["session_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestTimeTracking(TestBDETasksAuth):
    """Time tracking tests with start/pause/resume/finish states"""
    
    @pytest.fixture(scope="class")
    def test_task(self, headers):
        """Create a task for time tracking testing"""
        # Get SEO department
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        departments = response.json()
        seo_dept = next((d for d in departments if d["name"] == "SEO"), None)
        assert seo_dept, "SEO department not found"
        
        # Get or create project
        response = requests.get(
            f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
            headers=headers
        )
        projects = response.json()
        
        if projects:
            project_id = projects[0]["project_id"]
        else:
            new_project = {
                "name": "TEST_Time Tracking Project",
                "status": "active"
            }
            response = requests.post(
                f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
                json=new_project,
                headers=headers
            )
            project_id = response.json()["project_id"]
        
        # Create task for time tracking testing
        new_task = {
            "task_name": "TEST_Time Tracking Task",
            "priority": "medium",
            "status": "pending",
            "type": "general"
        }
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{project_id}/tasks",
            json=new_task,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        task = response.json()
        
        # Verify initial time_tracking state
        assert "time_tracking" in task, "Missing time_tracking in task"
        assert task["time_tracking"]["status"] == "not_started", "Initial status should be not_started"
        assert task["time_tracking"]["total_seconds"] == 0, "Initial total_seconds should be 0"
        
        return {"task_id": task["task_id"], "project_id": project_id}
    
    def test_start_timer(self, headers, test_task):
        """POST /api/departments/projects/{project_id}/tasks/{task_id}/time-tracking - Start timer"""
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_task['project_id']}/tasks/{test_task['task_id']}/time-tracking",
            json={"action": "start"},
            headers=headers
        )
        assert response.status_code == 200, f"Failed to start timer: {response.text}"
        
        result = response.json()
        assert result["message"] == "Timer started", "Wrong message"
        assert result["time_tracking"]["status"] == "running", "Status should be running"
        
        print(f"✓ Started timer for task: {test_task['task_id']}")
    
    def test_start_timer_already_started_fails(self, headers, test_task):
        """Starting timer again should fail"""
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_task['project_id']}/tasks/{test_task['task_id']}/time-tracking",
            json={"action": "start"},
            headers=headers
        )
        assert response.status_code == 400, "Should fail when timer already started"
        print("✓ Starting timer again correctly fails")
    
    def test_pause_timer(self, headers, test_task):
        """POST /api/departments/projects/{project_id}/tasks/{task_id}/time-tracking - Pause timer"""
        # Wait a bit to accumulate time
        time.sleep(1)
        
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_task['project_id']}/tasks/{test_task['task_id']}/time-tracking",
            json={"action": "pause"},
            headers=headers
        )
        assert response.status_code == 200, f"Failed to pause timer: {response.text}"
        
        result = response.json()
        assert result["message"] == "Timer paused", "Wrong message"
        assert result["time_tracking"]["status"] == "paused", "Status should be paused"
        assert result["time_tracking"]["total_seconds"] >= 1, "Should have accumulated time"
        
        print(f"✓ Paused timer, accumulated {result['time_tracking']['total_seconds']} seconds")
    
    def test_resume_timer(self, headers, test_task):
        """POST /api/departments/projects/{project_id}/tasks/{task_id}/time-tracking - Resume timer"""
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_task['project_id']}/tasks/{test_task['task_id']}/time-tracking",
            json={"action": "resume"},
            headers=headers
        )
        assert response.status_code == 200, f"Failed to resume timer: {response.text}"
        
        result = response.json()
        assert result["message"] == "Timer resumed", "Wrong message"
        assert result["time_tracking"]["status"] == "running", "Status should be running"
        
        print("✓ Resumed timer")
    
    def test_finish_timer(self, headers, test_task):
        """POST /api/departments/projects/{project_id}/tasks/{task_id}/time-tracking - Finish timer"""
        # Wait a bit more
        time.sleep(1)
        
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_task['project_id']}/tasks/{test_task['task_id']}/time-tracking",
            json={"action": "finish"},
            headers=headers
        )
        assert response.status_code == 200, f"Failed to finish timer: {response.text}"
        
        result = response.json()
        assert result["message"] == "Timer finished", "Wrong message"
        assert result["time_tracking"]["status"] == "finished", "Status should be finished"
        assert result["time_tracking"]["total_seconds"] >= 2, "Should have accumulated time from both sessions"
        assert "finished_at" in result["time_tracking"], "Should have finished_at timestamp"
        
        print(f"✓ Finished timer, total time: {result['time_tracking']['total_seconds']} seconds")
    
    def test_get_timer_status(self, headers, test_task):
        """GET /api/departments/tasks/{task_id}/timer - Get timer status"""
        response = requests.get(
            f"{BASE_URL}/api/departments/tasks/{test_task['task_id']}/timer",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get timer status: {response.text}"
        
        result = response.json()
        assert "time_tracking" in result, "Missing time_tracking"
        assert result["time_tracking"]["status"] == "finished", "Status should be finished"
        
        print(f"✓ Got timer status: {result['time_tracking']['status']}")
    
    def test_cleanup_time_tracking_task(self, headers, test_task):
        """Cleanup: Delete the time tracking test task"""
        response = requests.delete(
            f"{BASE_URL}/api/departments/projects/{test_task['project_id']}/tasks/{test_task['task_id']}",
            headers=headers
        )
        assert response.status_code == 200
        print("✓ Cleaned up time tracking test task")


class TestRecurrence(TestBDETasksAuth):
    """Recurrence support tests"""
    
    @pytest.fixture(scope="class")
    def test_project_id(self, headers):
        """Get or create a test project for recurrence tests"""
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        departments = response.json()
        seo_dept = next((d for d in departments if d["name"] == "SEO"), None)
        
        response = requests.get(
            f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
            headers=headers
        )
        projects = response.json()
        
        if projects:
            return projects[0]["project_id"]
        else:
            new_project = {
                "name": "TEST_Recurrence Testing Project",
                "status": "active"
            }
            response = requests.post(
                f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
                json=new_project,
                headers=headers
            )
            return response.json()["project_id"]
    
    def test_create_task_with_daily_recurrence(self, headers, test_project_id):
        """Create task with daily recurrence"""
        new_task = {
            "task_name": "TEST_Daily Standup",
            "priority": "medium",
            "status": "pending",
            "due_date": "2026-01-20",
            "recurrence": "daily"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/tasks",
            json=new_task,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        
        task = response.json()
        assert task["recurrence"] == "daily", "Recurrence should be daily"
        
        self.__class__.daily_task_id = task["task_id"]
        self.__class__.test_project_id = test_project_id
        print(f"✓ Created task with daily recurrence: {task['task_id']}")
    
    def test_create_task_with_weekly_recurrence(self, headers, test_project_id):
        """Create task with weekly recurrence"""
        new_task = {
            "task_name": "TEST_Weekly Review",
            "priority": "high",
            "status": "pending",
            "due_date": "2026-01-20",
            "recurrence": "weekly"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/tasks",
            json=new_task,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        
        task = response.json()
        assert task["recurrence"] == "weekly", "Recurrence should be weekly"
        
        self.__class__.weekly_task_id = task["task_id"]
        print(f"✓ Created task with weekly recurrence: {task['task_id']}")
    
    def test_create_task_with_weekdays_recurrence(self, headers, test_project_id):
        """Create task with weekdays recurrence (Mon-Fri)"""
        new_task = {
            "task_name": "TEST_Weekday Task",
            "priority": "medium",
            "status": "pending",
            "due_date": "2026-01-20",
            "recurrence": "weekdays"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/tasks",
            json=new_task,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        
        task = response.json()
        assert task["recurrence"] == "weekdays", "Recurrence should be weekdays"
        
        self.__class__.weekdays_task_id = task["task_id"]
        print(f"✓ Created task with weekdays recurrence: {task['task_id']}")
    
    def test_create_task_with_custom_recurrence(self, headers, test_project_id):
        """Create task with custom recurrence (every 2 weeks on Mon, Wed, Fri)"""
        new_task = {
            "task_name": "TEST_Custom Recurring Task",
            "priority": "low",
            "status": "pending",
            "due_date": "2026-01-20",
            "recurrence": "custom",
            "custom_recurrence": {
                "repeat_every": 2,
                "repeat_unit": "week",
                "repeat_on_days": [1, 3, 5],  # Mon, Wed, Fri
                "ends": "never"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/tasks",
            json=new_task,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        
        task = response.json()
        assert task["recurrence"] == "custom", "Recurrence should be custom"
        assert task["custom_recurrence"]["repeat_every"] == 2, "repeat_every should be 2"
        assert task["custom_recurrence"]["repeat_unit"] == "week", "repeat_unit should be week"
        assert task["custom_recurrence"]["repeat_on_days"] == [1, 3, 5], "repeat_on_days should be [1, 3, 5]"
        
        self.__class__.custom_task_id = task["task_id"]
        print(f"✓ Created task with custom recurrence: {task['task_id']}")
    
    def test_update_task_recurrence(self, headers):
        """Update task recurrence from daily to monthly"""
        if not hasattr(self.__class__, 'daily_task_id'):
            pytest.skip("No daily task created")
        
        update_data = {"recurrence": "monthly"}
        
        response = requests.put(
            f"{BASE_URL}/api/departments/projects/{self.__class__.test_project_id}/tasks/{self.__class__.daily_task_id}",
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to update task: {response.text}"
        
        task = response.json()
        assert task["recurrence"] == "monthly", "Recurrence should be updated to monthly"
        print("✓ Updated task recurrence to monthly")
    
    def test_cleanup_recurrence_tasks(self, headers):
        """Cleanup: Delete all recurrence test tasks"""
        task_ids = []
        if hasattr(self.__class__, 'daily_task_id'):
            task_ids.append(self.__class__.daily_task_id)
        if hasattr(self.__class__, 'weekly_task_id'):
            task_ids.append(self.__class__.weekly_task_id)
        if hasattr(self.__class__, 'weekdays_task_id'):
            task_ids.append(self.__class__.weekdays_task_id)
        if hasattr(self.__class__, 'custom_task_id'):
            task_ids.append(self.__class__.custom_task_id)
        
        for task_id in task_ids:
            requests.delete(
                f"{BASE_URL}/api/departments/projects/{self.__class__.test_project_id}/tasks/{task_id}",
                headers=headers
            )
        
        print(f"✓ Cleaned up {len(task_ids)} recurrence test tasks")


class TestTaskTypes(TestBDETasksAuth):
    """Task type tests (general, meeting, follow_up, proposal, call)"""
    
    @pytest.fixture(scope="class")
    def test_project_id(self, headers):
        """Get or create a test project"""
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        departments = response.json()
        seo_dept = next((d for d in departments if d["name"] == "SEO"), None)
        
        response = requests.get(
            f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
            headers=headers
        )
        projects = response.json()
        
        if projects:
            return projects[0]["project_id"]
        else:
            new_project = {
                "name": "TEST_Task Types Project",
                "status": "active"
            }
            response = requests.post(
                f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
                json=new_project,
                headers=headers
            )
            return response.json()["project_id"]
    
    def test_create_meeting_task(self, headers, test_project_id):
        """Create task with type=meeting"""
        new_task = {
            "task_name": "TEST_Client Meeting",
            "priority": "high",
            "status": "pending",
            "type": "meeting",
            "due_date": "2026-01-20",
            "due_time": "10:00"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/tasks",
            json=new_task,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        
        task = response.json()
        assert task["type"] == "meeting", "Type should be meeting"
        
        self.__class__.meeting_task_id = task["task_id"]
        self.__class__.test_project_id = test_project_id
        print(f"✓ Created meeting task: {task['task_id']}")
    
    def test_create_follow_up_task(self, headers, test_project_id):
        """Create task with type=follow_up"""
        new_task = {
            "task_name": "TEST_Follow Up Call",
            "priority": "medium",
            "status": "pending",
            "type": "follow_up"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/tasks",
            json=new_task,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        
        task = response.json()
        assert task["type"] == "follow_up", "Type should be follow_up"
        
        self.__class__.follow_up_task_id = task["task_id"]
        print(f"✓ Created follow_up task: {task['task_id']}")
    
    def test_create_task_with_work_link(self, headers, test_project_id):
        """Create task with work_link"""
        new_task = {
            "task_name": "TEST_Task with Link",
            "priority": "medium",
            "status": "pending",
            "type": "general",
            "work_link": "https://docs.google.com/document/d/test123"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/departments/projects/{test_project_id}/tasks",
            json=new_task,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        
        task = response.json()
        assert task["work_link"] == "https://docs.google.com/document/d/test123", "work_link mismatch"
        
        self.__class__.link_task_id = task["task_id"]
        print(f"✓ Created task with work_link: {task['task_id']}")
    
    def test_cleanup_type_tasks(self, headers):
        """Cleanup: Delete all type test tasks"""
        task_ids = []
        if hasattr(self.__class__, 'meeting_task_id'):
            task_ids.append(self.__class__.meeting_task_id)
        if hasattr(self.__class__, 'follow_up_task_id'):
            task_ids.append(self.__class__.follow_up_task_id)
        if hasattr(self.__class__, 'link_task_id'):
            task_ids.append(self.__class__.link_task_id)
        
        for task_id in task_ids:
            requests.delete(
                f"{BASE_URL}/api/departments/projects/{self.__class__.test_project_id}/tasks/{task_id}",
                headers=headers
            )
        
        print(f"✓ Cleaned up {len(task_ids)} type test tasks")


class TestExistingTaskWithRecurrence(TestBDETasksAuth):
    """Test existing task with recurrence='weekdays' and time_tracking"""
    
    def test_get_acme_corp_project(self, headers):
        """Get Acme Corp SEO Campaign project with existing tasks"""
        # Get SEO department
        response = requests.get(f"{BASE_URL}/api/departments", headers=headers)
        assert response.status_code == 200
        departments = response.json()
        seo_dept = next((d for d in departments if d["name"] == "SEO"), None)
        assert seo_dept, "SEO department not found"
        
        # Get projects in SEO department
        response = requests.get(
            f"{BASE_URL}/api/departments/{seo_dept['department_id']}/projects",
            headers=headers
        )
        assert response.status_code == 200
        projects = response.json()
        
        # Find Acme Corp project
        acme_project = next((p for p in projects if "Acme" in p.get("name", "")), None)
        if acme_project:
            print(f"✓ Found Acme Corp project: {acme_project['name']} ({acme_project['project_id']})")
            self.__class__.acme_project_id = acme_project["project_id"]
        else:
            print("⚠ Acme Corp project not found, skipping related tests")
            pytest.skip("Acme Corp project not found")
    
    def test_get_project_detail_with_tasks(self, headers):
        """Get project detail with tasks including recurrence and time_tracking"""
        if not hasattr(self.__class__, 'acme_project_id'):
            pytest.skip("Acme Corp project not found")
        
        response = requests.get(
            f"{BASE_URL}/api/departments/projects/{self.__class__.acme_project_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get project: {response.text}"
        
        project = response.json()
        assert "tasks" in project, "Missing tasks array"
        
        # Check for tasks with recurrence
        tasks_with_recurrence = [t for t in project["tasks"] if t.get("recurrence") and t["recurrence"] != "none"]
        print(f"✓ Found {len(tasks_with_recurrence)} tasks with recurrence")
        
        # Check for tasks with time_tracking
        tasks_with_time = [t for t in project["tasks"] if t.get("time_tracking", {}).get("total_seconds", 0) > 0]
        print(f"✓ Found {len(tasks_with_time)} tasks with time logged")
        
        # Verify task structure
        for task in project["tasks"]:
            assert "task_id" in task, "Missing task_id"
            assert "task_name" in task, "Missing task_name"
            assert "status" in task, "Missing status"
            # time_tracking may not exist for older tasks
            if "time_tracking" in task:
                print(f"  Task '{task['task_name']}' has time_tracking: {task['time_tracking']['status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
