from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# ============== OPERATIONS MODELS ==============

class Project(BaseModel):
    project_id: str
    project_name: str
    client_id: str
    client_name: str
    service_id: str
    service_name: str
    service_type: str  # website, shopify, performance_marketing, social_media, whatsapp
    lead_id: Optional[str] = None
    description: Optional[str] = None
    assigned_pm: str  # User ID of project manager
    assigned_pm_name: str
    status: str  # not_started, in_progress, waiting_client, review, completed, on_hold
    priority: str = "medium"  # low, medium, high
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    estimated_hours: float = 0.0
    actual_hours: float = 0.0
    progress_percent: int = 0
    created_by: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False

class ProjectCreate(BaseModel):
    project_name: str
    client_id: str
    service_id: str
    description: Optional[str] = None
    assigned_pm: str
    status: str = "not_started"
    priority: str = "medium"
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    estimated_hours: float = 0.0

class Task(BaseModel):
    task_id: str
    project_id: str
    project_name: str
    task_name: str
    client_id: str
    client_name: str
    service_type: str
    assigned_to: str  # Employee user_id
    assigned_to_name: str
    assigned_by: str
    assigned_by_name: str
    priority: str  # low, medium, high
    status: str  # not_started, in_progress, waiting_client, review, completed, on_hold
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    estimated_time: float = 0.0  # hours
    actual_time: float = 0.0  # hours
    delay_hours: float = 0.0
    description: Optional[str] = None
    
    # Service-specific fields (stored as JSON)
    service_fields: Dict[str, Any] = {}
    
    created_by: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False

class TaskCreate(BaseModel):
    project_id: str
    task_name: str
    assigned_to: str
    priority: str = "medium"
    status: str = "not_started"
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    estimated_time: float = 0.0
    description: Optional[str] = None
    service_fields: Dict[str, Any] = {}

class TaskUpdate(BaseModel):
    task_name: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    estimated_time: Optional[float] = None
    description: Optional[str] = None
    service_fields: Optional[Dict[str, Any]] = None

class Subtask(BaseModel):
    subtask_id: str
    task_id: str
    subtask_name: str
    status: str  # pending, completed
    assigned_to: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

class SubtaskCreate(BaseModel):
    task_id: str
    subtask_name: str
    assigned_to: Optional[str] = None

class TaskComment(BaseModel):
    comment_id: str
    task_id: str
    user_id: str
    user_name: str
    comment_text: str
    file_urls: List[str] = []
    mentioned_users: List[str] = []
    created_at: datetime

class TaskCommentCreate(BaseModel):
    task_id: str
    comment_text: str
    file_urls: List[str] = []
    mentioned_users: List[str] = []

class TimeEntry(BaseModel):
    entry_id: str
    task_id: str
    user_id: str
    user_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_hours: float = 0.0
    notes: Optional[str] = None
    is_running: bool = True
    created_at: datetime

class TimeEntryStart(BaseModel):
    task_id: str
    notes: Optional[str] = None

class TimeEntryStop(BaseModel):
    entry_id: str

class TaskHistory(BaseModel):
    history_id: str
    task_id: str
    user_id: str
    user_name: str
    action: str  # status_changed, assigned, updated, commented
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    timestamp: datetime

class ProductivityStats(BaseModel):
    user_id: str
    user_name: str
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    overdue_tasks: int
    on_time_completion_rate: float
    avg_completion_time: float
    total_hours_logged: float

class SavedView(BaseModel):
    view_id: str
    user_id: str
    view_name: str
    filters: Dict[str, Any]
    created_at: datetime
