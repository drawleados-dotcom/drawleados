"""
Test Tracker Board Workflow - 2-Level Approval System
Tests: Start/Pause/Finish buttons, Finish modal with link, PM→Ops approval chain, 
       Corrections/Rejection, Move to Next Stage
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "vinoth@drawlead.com"
TEST_PASSWORD = "admin123"
PROJECT_ID = "wp_e5aecea32221"  # Acacia Homess project

class TestTrackerBoardWorkflow:
    """Test the complete tracker board workflow with 2-level approval"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("session_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.user = data.get("user", {})
        yield
    
    # ==================== TIMER ENDPOINTS ====================
    
    def test_timer_start_changes_status_to_in_progress(self):
        """Test: Start button changes task status to 'in_progress'"""
        # First get stage tasks
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        assert response.status_code == 200
        tasks = response.json()
        
        # Find a pending task in content stage
        content_tasks = tasks.get("content", [])
        pending_task = None
        for task in content_tasks:
            if task.get("status") in ["pending", "paused", "corrections"]:
                pending_task = task
                break
        
        if not pending_task:
            pytest.skip("No pending task found to test timer start")
        
        task_id = pending_task["task_id"]
        
        # Start the timer
        response = self.session.post(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/timer",
            json={"action": "start"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("status") == "in_progress"
        print(f"✓ Timer start: Task {task_id} status changed to 'in_progress'")
    
    def test_timer_pause_changes_status_to_paused(self):
        """Test: Pause button changes task status to 'paused'"""
        # Get stage tasks
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        assert response.status_code == 200
        tasks = response.json()
        
        # Find an in_progress task
        in_progress_task = None
        for stage, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task.get("status") == "in_progress":
                    in_progress_task = task
                    break
            if in_progress_task:
                break
        
        if not in_progress_task:
            # Start a task first
            content_tasks = tasks.get("content", [])
            if content_tasks:
                task_id = content_tasks[0]["task_id"]
                self.session.post(
                    f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/timer",
                    json={"action": "start"}
                )
                in_progress_task = {"task_id": task_id}
        
        if not in_progress_task:
            pytest.skip("No task available to test pause")
        
        task_id = in_progress_task["task_id"]
        
        # Pause the timer
        response = self.session.post(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/timer",
            json={"action": "pause"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("status") == "paused"
        print(f"✓ Timer pause: Task {task_id} status changed to 'paused'")
    
    # ==================== FINISH & SUBMIT ====================
    
    def test_submit_task_sets_status_to_waiting_pm(self):
        """Test: Finish button submits task with link, sets status to 'waiting_pm'"""
        # Get stage tasks
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        assert response.status_code == 200
        tasks = response.json()
        
        # Find a task that can be submitted (in_progress or paused)
        submittable_task = None
        stage = None
        for s, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task.get("status") in ["in_progress", "paused", "pending"]:
                    submittable_task = task
                    stage = s
                    break
            if submittable_task:
                break
        
        if not submittable_task:
            pytest.skip("No task available to test submit")
        
        task_id = submittable_task["task_id"]
        test_link = "https://figma.com/test-design-link"
        
        # Submit for approval
        response = self.session.put(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/submit",
            json={
                "stage": stage,
                "link": test_link,
                "assignee_type": "project_manager"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "PM approval" in data.get("message", "")
        print(f"✓ Submit task: Task {task_id} submitted with link, status set to 'waiting_pm'")
        
        # Verify the task status
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        tasks = response.json()
        for s, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task["task_id"] == task_id:
                    assert task.get("status") == "waiting_pm"
                    assert task.get("link") == test_link
                    assert task.get("pm_approved") == False
                    assert task.get("ops_approved") == False
                    print(f"✓ Verified: Task has status='waiting_pm', pm_approved=False, ops_approved=False")
                    return
    
    # ==================== 2-LEVEL APPROVAL ====================
    
    def test_pm_approval_sets_pm_approved_and_waiting_ops(self):
        """Test: PM Approval sets pm_approved=true and status='waiting_ops'"""
        # Get stage tasks
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        assert response.status_code == 200
        tasks = response.json()
        
        # Find a task waiting for PM approval
        waiting_pm_task = None
        stage = None
        for s, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task.get("status") == "waiting_pm":
                    waiting_pm_task = task
                    stage = s
                    break
            if waiting_pm_task:
                break
        
        if not waiting_pm_task:
            pytest.skip("No task waiting for PM approval")
        
        task_id = waiting_pm_task["task_id"]
        
        # PM Approve
        response = self.session.put(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/pm-approve",
            json={"stage": stage}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "PM approved" in data.get("message", "")
        print(f"✓ PM Approval: Task {task_id} PM approved")
        
        # Verify the task status
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        tasks = response.json()
        for s, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task["task_id"] == task_id:
                    assert task.get("pm_approved") == True
                    assert task.get("status") == "waiting_ops"
                    print(f"✓ Verified: pm_approved=True, status='waiting_ops'")
                    return
    
    def test_ops_approval_sets_ops_approved_and_approved(self):
        """Test: Ops Approval sets ops_approved=true and status='approved'"""
        # Get stage tasks
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        assert response.status_code == 200
        tasks = response.json()
        
        # Find a task waiting for Ops approval (pm_approved=true, ops_approved=false)
        waiting_ops_task = None
        stage = None
        for s, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task.get("pm_approved") == True and task.get("ops_approved") != True:
                    waiting_ops_task = task
                    stage = s
                    break
            if waiting_ops_task:
                break
        
        if not waiting_ops_task:
            pytest.skip("No task waiting for Ops approval")
        
        task_id = waiting_ops_task["task_id"]
        
        # Ops Approve
        response = self.session.put(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/ops-approve",
            json={"stage": stage}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "approved" in data.get("message", "").lower()
        print(f"✓ Ops Approval: Task {task_id} Ops approved")
        
        # Verify the task status
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        tasks = response.json()
        for s, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task["task_id"] == task_id:
                    assert task.get("ops_approved") == True
                    assert task.get("status") == "approved"
                    print(f"✓ Verified: ops_approved=True, status='approved'")
                    return
    
    # ==================== CORRECTIONS/REJECTION ====================
    
    def test_corrections_resets_approval_flags(self):
        """Test: Corrections endpoint resets approval flags and sets status='corrections'"""
        # Get stage tasks
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        assert response.status_code == 200
        tasks = response.json()
        
        # Find a task that's waiting for approval
        approval_task = None
        stage = None
        for s, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task.get("status") in ["waiting_pm", "waiting_ops", "waiting_approval"]:
                    approval_task = task
                    stage = s
                    break
            if approval_task:
                break
        
        if not approval_task:
            pytest.skip("No task waiting for approval to test corrections")
        
        task_id = approval_task["task_id"]
        test_remarks = "Please fix the alignment issues on the header section"
        
        # Request corrections
        response = self.session.put(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/corrections",
            json={"stage": stage, "remarks": test_remarks}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Corrections requested for task {task_id}")
        
        # Verify the task status
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        tasks = response.json()
        for s, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task["task_id"] == task_id:
                    assert task.get("status") == "corrections"
                    assert task.get("pm_approved") == False
                    assert task.get("ops_approved") == False
                    assert task.get("correction_remarks") == test_remarks
                    print(f"✓ Verified: status='corrections', pm_approved=False, ops_approved=False")
                    return
    
    # ==================== MOVE TO NEXT STAGE ====================
    
    def test_move_to_next_stage_creates_new_task(self):
        """Test: Move to Next Stage creates new task in the next workflow stage"""
        # Get stage tasks
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        assert response.status_code == 200
        tasks = response.json()
        
        # Find a fully approved task (pm_approved=true, ops_approved=true)
        approved_task = None
        stage = None
        for s, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task.get("pm_approved") == True and task.get("ops_approved") == True and not task.get("moved_to_next"):
                    approved_task = task
                    stage = s
                    break
            if approved_task:
                break
        
        if not approved_task:
            pytest.skip("No fully approved task to test move-next")
        
        task_id = approved_task["task_id"]
        
        # Move to next stage
        response = self.session.post(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/move-next",
            json={"current_stage": stage}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "new_task_id" in data
        new_task_id = data.get("new_task_id")
        print(f"✓ Move to next stage: Created new task {new_task_id}")
        
        # Verify the new task exists in next stage
        stage_order = ["content", "wireframe", "ui", "responsive", "development", "testing", "delivery"]
        current_idx = stage_order.index(stage)
        next_stage = stage_order[current_idx + 1]
        
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        tasks = response.json()
        next_stage_tasks = tasks.get(next_stage, [])
        
        found_new_task = False
        for task in next_stage_tasks:
            if task["task_id"] == new_task_id:
                found_new_task = True
                assert task.get("status") == "pending"
                assert task.get("moved_from") == task_id
                print(f"✓ Verified: New task in {next_stage} stage with status='pending'")
                break
        
        assert found_new_task, f"New task not found in {next_stage} stage"
    
    def test_move_next_requires_full_approval(self):
        """Test: Move to Next Stage fails if task is not fully approved"""
        # Get stage tasks
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        assert response.status_code == 200
        tasks = response.json()
        
        # Find a task that's NOT fully approved
        not_approved_task = None
        stage = None
        for s, stage_tasks in tasks.items():
            for task in stage_tasks:
                if not (task.get("pm_approved") == True and task.get("ops_approved") == True):
                    not_approved_task = task
                    stage = s
                    break
            if not_approved_task:
                break
        
        if not not_approved_task:
            pytest.skip("All tasks are fully approved")
        
        task_id = not_approved_task["task_id"]
        
        # Try to move to next stage (should fail)
        response = self.session.post(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/move-next",
            json={"current_stage": stage}
        )
        assert response.status_code == 400
        data = response.json()
        assert "fully approved" in data.get("detail", "").lower()
        print(f"✓ Move-next correctly rejected for non-approved task")
    
    # ==================== APPROVALS PAGE ====================
    
    def test_approvals_page_pm_filter(self):
        """Test: Approvals Page shows PM Approvals when approval_level=pm"""
        response = self.session.get(
            f"{BASE_URL}/api/approvals/pending",
            params={"approval_level": "pm"}
        )
        assert response.status_code == 200
        approvals = response.json()
        print(f"✓ PM Approvals endpoint returned {len(approvals)} items")
        
        # All items should be waiting for PM approval
        for approval in approvals:
            if approval.get("type") == "website_stage":
                # Should be waiting_pm or not yet pm_approved
                assert approval.get("status") == "pending"
    
    def test_approvals_page_ops_filter(self):
        """Test: Approvals Page shows Ops Approvals when approval_level=ops"""
        response = self.session.get(
            f"{BASE_URL}/api/approvals/pending",
            params={"approval_level": "ops"}
        )
        assert response.status_code == 200
        approvals = response.json()
        print(f"✓ Ops Approvals endpoint returned {len(approvals)} items")
    
    def test_approvals_page_website_department_filter(self):
        """Test: Approvals Page filters by website department"""
        response = self.session.get(
            f"{BASE_URL}/api/approvals/pending",
            params={"department": "website"}
        )
        assert response.status_code == 200
        approvals = response.json()
        
        # All items should be website department
        for approval in approvals:
            assert approval.get("department") == "website"
        print(f"✓ Website department filter returned {len(approvals)} items")


class TestEndToEndWorkflow:
    """Test complete end-to-end workflow: Start → Pause → Finish → PM Approve → Ops Approve → Move"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("session_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    def test_complete_workflow(self):
        """Test complete workflow from start to move-next"""
        # Get stage tasks
        response = self.session.get(f"{BASE_URL}/api/website-projects/projects/{PROJECT_ID}/stage-tasks")
        assert response.status_code == 200
        tasks = response.json()
        
        # Find a pending task
        test_task = None
        stage = None
        for s, stage_tasks in tasks.items():
            for task in stage_tasks:
                if task.get("status") == "pending" and not task.get("moved_to_next"):
                    test_task = task
                    stage = s
                    break
            if test_task:
                break
        
        if not test_task:
            pytest.skip("No pending task available for e2e test")
        
        task_id = test_task["task_id"]
        print(f"\n=== E2E Test: Task {task_id} in {stage} stage ===")
        
        # Step 1: Start
        response = self.session.post(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/timer",
            json={"action": "start"}
        )
        assert response.status_code == 200
        print("✓ Step 1: Started task")
        
        # Step 2: Pause
        response = self.session.post(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/timer",
            json={"action": "pause"}
        )
        assert response.status_code == 200
        print("✓ Step 2: Paused task")
        
        # Step 3: Submit (Finish)
        response = self.session.put(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/submit",
            json={"stage": stage, "link": "https://figma.com/e2e-test"}
        )
        assert response.status_code == 200
        print("✓ Step 3: Submitted for approval (waiting_pm)")
        
        # Step 4: PM Approve
        response = self.session.put(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/pm-approve",
            json={"stage": stage}
        )
        assert response.status_code == 200
        print("✓ Step 4: PM approved (waiting_ops)")
        
        # Step 5: Ops Approve
        response = self.session.put(
            f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/ops-approve",
            json={"stage": stage}
        )
        assert response.status_code == 200
        print("✓ Step 5: Ops approved (approved)")
        
        # Step 6: Move to Next Stage (if not at final stage)
        stage_order = ["content", "wireframe", "ui", "responsive", "development", "testing", "delivery"]
        if stage != "delivery":
            response = self.session.post(
                f"{BASE_URL}/api/website-projects/stage-tasks/{task_id}/move-next",
                json={"current_stage": stage}
            )
            assert response.status_code == 200
            data = response.json()
            print(f"✓ Step 6: Moved to next stage, new task: {data.get('new_task_id')}")
        else:
            print("✓ Step 6: Skipped (already at delivery stage)")
        
        print("=== E2E Test Complete ===\n")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
