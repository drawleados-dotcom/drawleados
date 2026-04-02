import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import {
  Plus, Calendar, Clock, User, CheckCircle2, Circle, 
  Trash2, Edit2, X, Briefcase,
  Play, Pause, Square, Timer, Eye, Link as LinkIcon, Filter,
  ChevronRight, ArrowLeft, FileSpreadsheet, ExternalLink,
  Search, Building2, Layers, LayoutGrid, List, FileText,
  Repeat, Users
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const priorityColors = {
  high: 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]',
  medium: 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]',
  low: 'bg-[#71717a]/20 text-[#71717a] border-[#71717a]'
};

const statusColors = {
  'pending': { bg: 'bg-[#71717a]/20', text: 'text-[#71717a]', label: 'Pending' },
  'in_progress': { bg: 'bg-[#3b82f6]/20', text: 'text-[#3b82f6]', label: 'In Progress' },
  'completed': { bg: 'bg-[#10b981]/20', text: 'text-[#10b981]', label: 'Completed' },
  'on_hold': { bg: 'bg-[#f59e0b]/20', text: 'text-[#f59e0b]', label: 'On Hold' }
};

const projectStatusColors = {
  'active': 'bg-[#10b981]/20 text-[#10b981]',
  'completed': 'bg-[#6366f1]/20 text-[#6366f1]',
  'on_hold': 'bg-[#f59e0b]/20 text-[#f59e0b]'
};

export default function TasksModulePage() {
  const { isDark } = useTheme();
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Navigation state
  const [view, setView] = useState('departments');
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // Data
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectDetail, setProjectDetail] = useState(null);
  const [users, setUsers] = useState([]);
  
  // Filters
  const [projectFilter, setProjectFilter] = useState({ status: 'all', search: '' });
  const [taskQuickFilter, setTaskQuickFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const [taskFilters, setTaskFilters] = useState({
    dateFilter: 'all',
    dateFrom: '',
    dateTo: '',
    singleDate: '',
    assignedTo: 'all',
    assignedBy: 'all',
    taskType: 'all',
    status: 'all'
  });
  
  // Modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  
  // View mode for projects
  const [projectViewMode, setProjectViewMode] = useState('grid');
  
  // Embedded doc viewer
  const [viewingDoc, setViewingDoc] = useState(null);
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Theme classes
  const bgPage = isDark ? 'bg-[#09090b]' : 'bg-gray-50';
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  // Load departments
  const loadDepartments = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/departments`, { headers });
      setDepartments(res.data);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
    setLoading(false);
  }, []);

  // Load projects for selected department
  const loadProjects = useCallback(async (deptId) => {
    try {
      let url = `${API}/api/departments/${deptId}/projects`;
      if (projectFilter.status !== 'all') {
        url += `?status=${projectFilter.status}`;
      }
      const res = await axios.get(url, { headers });
      setProjects(res.data);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }, [projectFilter.status]);

  // Load project detail
  const loadProjectDetail = useCallback(async (projectId) => {
    try {
      const res = await axios.get(`${API}/api/departments/projects/${projectId}`, { headers });
      setProjectDetail(res.data);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  }, []);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/users/basic`, { headers });
      setUsers(res.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
    loadUsers();
  }, [loadDepartments, loadUsers]);

  useEffect(() => {
    if (selectedDepartment) {
      loadProjects(selectedDepartment.department_id);
    }
  }, [selectedDepartment, loadProjects]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectDetail(selectedProject.project_id);
    }
  }, [selectedProject, loadProjectDetail]);

  // Navigate to department
  const handleSelectDepartment = (dept) => {
    setSelectedDepartment(dept);
    setSelectedProject(null);
    setProjectDetail(null);
    setView('projects');
  };

  // Navigate to project
  const handleSelectProject = (project) => {
    setSelectedProject(project);
    setView('project-detail');
  };

  // Go back
  const handleBack = () => {
    if (view === 'project-detail') {
      setSelectedProject(null);
      setProjectDetail(null);
      setView('projects');
    } else if (view === 'projects') {
      setSelectedDepartment(null);
      setProjects([]);
      setView('departments');
    }
  };

  // Filter projects by search
  const filteredProjects = projects.filter(p => {
    if (projectFilter.search) {
      const search = projectFilter.search.toLowerCase();
      return p.name.toLowerCase().includes(search) || 
             (p.client_name && p.client_name.toLowerCase().includes(search));
    }
    return true;
  });

  // Get today's date string
  const getTodayString = () => new Date().toISOString().split('T')[0];

  // Filter tasks with advanced filters
  const filteredTasks = (projectDetail?.tasks || []).filter(task => {
    // Quick filter (tabs)
    if (taskQuickFilter === 'my' && !(task.created_by === user?.user_id || task.assigned_to === user?.user_id)) return false;
    if (taskQuickFilter !== 'all' && taskQuickFilter !== 'my' && task.status !== taskQuickFilter) return false;
    
    // Date filter
    if (taskFilters.dateFilter === 'today') {
      const today = getTodayString();
      const taskDate = task.due_date || task.created_at?.split('T')[0];
      if (taskDate !== today) return false;
    } else if (taskFilters.dateFilter === 'single' && taskFilters.singleDate) {
      const taskDate = task.due_date || task.created_at?.split('T')[0];
      if (taskDate !== taskFilters.singleDate) return false;
    } else if (taskFilters.dateFilter === 'range' && (taskFilters.dateFrom || taskFilters.dateTo)) {
      const taskDate = task.due_date || task.created_at?.split('T')[0];
      if (taskFilters.dateFrom && taskDate < taskFilters.dateFrom) return false;
      if (taskFilters.dateTo && taskDate > taskFilters.dateTo) return false;
    }
    
    // Assigned To filter
    if (taskFilters.assignedTo === 'myself' && task.assigned_to !== user?.user_id) return false;
    if (taskFilters.assignedTo !== 'all' && taskFilters.assignedTo !== 'myself' && task.assigned_to !== taskFilters.assignedTo) return false;
    
    // Assigned By filter
    if (taskFilters.assignedBy !== 'all' && task.assigned_by !== taskFilters.assignedBy) return false;
    
    // Type filter
    if (taskFilters.taskType !== 'all' && task.type !== taskFilters.taskType) return false;
    
    // Status filter (from advanced filters)
    if (taskFilters.status !== 'all' && task.status !== taskFilters.status) return false;
    
    return true;
  });

  // Reset task filters
  const resetTaskFilters = () => {
    setTaskFilters({
      dateFilter: 'all',
      dateFrom: '',
      dateTo: '',
      singleDate: '',
      assignedTo: 'all',
      assignedBy: 'all',
      taskType: 'all',
      status: 'all'
    });
  };

  // Task stats
  const taskStats = {
    total: projectDetail?.tasks?.length || 0,
    pending: (projectDetail?.tasks || []).filter(t => t.status === 'pending').length,
    in_progress: (projectDetail?.tasks || []).filter(t => t.status === 'in_progress').length,
    completed: (projectDetail?.tasks || []).filter(t => t.status === 'completed').length
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Get recurrence label
  const getRecurrenceLabel = (task) => {
    const recurrence = task?.recurrence || 'none';
    if (recurrence === 'none') return null;
    if (recurrence === 'daily') return 'Daily';
    if (recurrence === 'weekly') return 'Weekly';
    if (recurrence === 'monthly') return 'Monthly';
    if (recurrence === 'yearly') return 'Yearly';
    if (recurrence === 'weekdays') return 'Every Mon, Tue, Wed, Thu, Fri';
    if (recurrence === 'custom') {
      const customRec = task?.custom_recurrence || {};
      const repeatOnDays = customRec.repeat_on_days || [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      if (repeatOnDays.length > 0) {
        return `Every ${repeatOnDays.sort((a, b) => a - b).map(d => dayNames[d]).join(', ')}`;
      }
      return `Every ${customRec.repeat_every || 1} ${customRec.repeat_unit || 'week'}(s)`;
    }
    return null;
  };

  // Time tracking button
  const getTimeTrackingButton = (task) => {
    const tracking = task.time_tracking || { status: 'not_started', total_seconds: 0 };
    const status = tracking.status;
    
    switch (status) {
      case 'not_started':
        return (
          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleTimeTracking(task, 'start'); }} className="bg-[#10b981] hover:bg-[#059669] text-white h-8 px-3">
            <Play className="h-3 w-3 mr-1" /> Start
          </Button>
        );
      case 'running':
        return (
          <div className="flex gap-1">
            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleTimeTracking(task, 'pause'); }} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white h-8 px-3">
              <Pause className="h-3 w-3 mr-1" /> Resume
            </Button>
            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleTimeTracking(task, 'finish'); }} className="bg-[#ef4444] hover:bg-[#dc2626] text-white h-8 px-3">
              <Square className="h-3 w-3 mr-1" /> Finish
            </Button>
          </div>
        );
      case 'paused':
        return (
          <div className="flex gap-1">
            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleTimeTracking(task, 'resume'); }} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white h-8 px-3">
              <Play className="h-3 w-3 mr-1" /> Resume
            </Button>
            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleTimeTracking(task, 'finish'); }} className="bg-[#ef4444] hover:bg-[#dc2626] text-white h-8 px-3">
              <Square className="h-3 w-3 mr-1" /> Finish
            </Button>
          </div>
        );
      case 'finished':
        return (
          <Badge className="bg-[#10b981]/20 text-[#10b981]">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Done
          </Badge>
        );
      default:
        return null;
    }
  };

  // Handle time tracking
  const handleTimeTracking = async (task, action) => {
    try {
      await axios.post(`${API}/api/departments/projects/${selectedProject.project_id}/tasks/${task.task_id}/time-tracking`, { action }, { headers });
      toast.success(`Timer ${action}ed`);
      loadProjectDetail(selectedProject.project_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action} timer`);
    }
  };

  // ========== DEPARTMENT CRUD ==========
  const [deptForm, setDeptForm] = useState({ name: '', icon: '📁', color: '#6366f1', description: '' });

  const handleCreateDepartment = async () => {
    if (!deptForm.name.trim()) {
      toast.error('Department name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/departments`, deptForm, { headers });
      toast.success('Department created');
      setShowDeptModal(false);
      setDeptForm({ name: '', icon: '📁', color: '#6366f1', description: '' });
      loadDepartments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create department');
    }
  };

  // ========== PROJECT CRUD ==========
  const [projectForm, setProjectForm] = useState({
    name: '', client_name: '', description: '', start_date: '', end_date: '', status: 'active', team_members: []
  });

  const handleCreateProject = async () => {
    if (!projectForm.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    try {
      if (editingProject) {
        await axios.put(`${API}/api/departments/projects/${editingProject.project_id}`, projectForm, { headers });
        toast.success('Project updated');
      } else {
        await axios.post(`${API}/api/departments/${selectedDepartment.department_id}/projects`, projectForm, { headers });
        toast.success('Project created');
      }
      setShowProjectModal(false);
      setEditingProject(null);
      setProjectForm({ name: '', client_name: '', description: '', start_date: '', end_date: '', status: 'active', team_members: [] });
      loadProjects(selectedDepartment.department_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save project');
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await axios.delete(`${API}/api/departments/projects/${projectId}`, { headers });
      toast.success('Project deleted');
      loadProjects(selectedDepartment.department_id);
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  // ========== TASK CRUD ==========
  const [taskForm, setTaskForm] = useState({
    task_name: '', description: '', priority: 'medium', type: 'general', assigned_to: '', 
    due_date: '', due_time: '', all_day: false, recurrence: 'none', custom_recurrence: {
      repeat_every: 1, repeat_unit: 'week', repeat_on_days: [], ends: 'never', end_date: '', occurrences: 13
    }, status: 'pending', work_link: ''
  });

  const resetTaskForm = () => {
    setTaskForm({
      task_name: '', description: '', priority: 'medium', type: 'general', assigned_to: '', 
      due_date: '', due_time: '', all_day: false, recurrence: 'none', custom_recurrence: {
        repeat_every: 1, repeat_unit: 'week', repeat_on_days: [], ends: 'never', end_date: '', occurrences: 13
      }, status: 'pending', work_link: ''
    });
  };

  const handleCreateTask = async () => {
    if (!taskForm.task_name.trim()) {
      toast.error('Task name is required');
      return;
    }
    if (taskForm.recurrence && taskForm.recurrence !== 'none' && !taskForm.due_date) {
      toast.error('Start date is required for recurring tasks');
      return;
    }
    try {
      if (editingTask) {
        await axios.put(`${API}/api/departments/projects/${selectedProject.project_id}/tasks/${editingTask.task_id}`, taskForm, { headers });
        toast.success('Task updated');
      } else {
        await axios.post(`${API}/api/departments/projects/${selectedProject.project_id}/tasks`, taskForm, { headers });
        toast.success('Task created');
      }
      setShowTaskModal(false);
      setEditingTask(null);
      resetTaskForm();
      loadProjectDetail(selectedProject.project_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await axios.delete(`${API}/api/departments/projects/${selectedProject.project_id}/tasks/${taskId}`, { headers });
      toast.success('Task deleted');
      loadProjectDetail(selectedProject.project_id);
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const openEditTaskModal = (task) => {
    setTaskForm({
      task_name: task.task_name,
      description: task.description || '',
      priority: task.priority,
      type: task.type || 'general',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
      due_time: task.due_time || '',
      all_day: task.all_day || false,
      recurrence: task.recurrence || 'none',
      custom_recurrence: task.custom_recurrence || { repeat_every: 1, repeat_unit: 'week', repeat_on_days: [], ends: 'never', end_date: '', occurrences: 13 },
      status: task.status,
      work_link: task.work_link || ''
    });
    setEditingTask(task);
    setShowTaskModal(true);
  };

  // ========== DOCUMENT CRUD ==========
  const [docForm, setDocForm] = useState({ name: '', link: '', doc_type: 'sheet' });

  const handleAddDocument = async () => {
    if (!docForm.name.trim() || !docForm.link.trim()) {
      toast.error('Name and link are required');
      return;
    }
    try {
      await axios.post(`${API}/api/departments/projects/${selectedProject.project_id}/documents`, docForm, { headers });
      toast.success('Document added');
      setShowDocModal(false);
      setDocForm({ name: '', link: '', doc_type: 'sheet' });
      loadProjectDetail(selectedProject.project_id);
    } catch (error) {
      toast.error('Failed to add document');
    }
  };

  const handleRemoveDocument = async (docId) => {
    try {
      await axios.delete(`${API}/api/departments/projects/${selectedProject.project_id}/documents/${docId}`, { headers });
      toast.success('Document removed');
      loadProjectDetail(selectedProject.project_id);
    } catch (error) {
      toast.error('Failed to remove document');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className={`h-full flex items-center justify-center ${bgPage}`}>
          <div className="animate-spin h-8 w-8 border-2 border-[#6366f1] border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`h-full flex flex-col ${bgPage}`} data-testid="tasks-module-page">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${borderColor} ${bgCard}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {view !== 'departments' && (
                <Button variant="ghost" size="icon" onClick={handleBack} className={textSecondary}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              
              {/* Breadcrumb */}
              <div className="flex items-center gap-2">
                <button onClick={() => { setView('departments'); setSelectedDepartment(null); setSelectedProject(null); }} className={`flex items-center gap-2 ${textSecondary} hover:${textPrimary}`}>
                  <Layers className="h-5 w-5" />
                  <span className="font-medium">Tasks</span>
                </button>
                
                {selectedDepartment && (
                  <>
                    <ChevronRight className={`h-4 w-4 ${textSecondary}`} />
                    <button onClick={() => { setView('projects'); setSelectedProject(null); }} className={`flex items-center gap-2 ${view === 'projects' ? textPrimary : textSecondary} hover:${textPrimary}`}>
                      <span>{selectedDepartment.icon}</span>
                      <span className="font-medium">{selectedDepartment.name}</span>
                    </button>
                  </>
                )}
                
                {selectedProject && (
                  <>
                    <ChevronRight className={`h-4 w-4 ${textSecondary}`} />
                    <span className={`font-medium ${textPrimary}`}>{selectedProject.name}</span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {view === 'departments' && isAdmin && (
                <Button onClick={() => setShowDeptModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              )}
              {view === 'projects' && (
                <Button onClick={() => { setEditingProject(null); setProjectForm({ name: '', client_name: '', description: '', start_date: '', end_date: '', status: 'active', team_members: [] }); setShowProjectModal(true); }} className="bg-[#10b981] hover:bg-[#059669]">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              )}
              {view === 'project-detail' && (
                <>
                  <Button variant="outline" onClick={() => setShowDocModal(true)} className={borderColor}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Add Document
                  </Button>
                  <Button onClick={() => { setEditingTask(null); resetTaskForm(); setShowTaskModal(true); }} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Departments View */}
          {view === 'departments' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {departments.map(dept => (
                <Card
                  key={dept.department_id}
                  className={`${bgCard} border ${borderColor} hover:border-[#6366f1]/50 cursor-pointer transition-all group`}
                  onClick={() => handleSelectDepartment(dept)}
                  data-testid={`dept-card-${dept.department_id}`}
                >
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="text-3xl" style={{ filter: `drop-shadow(0 0 8px ${dept.color}40)` }}>{dept.icon}</div>
                      <div className="flex-1">
                        <h3 className={`font-semibold ${textPrimary}`}>{dept.name}</h3>
                        <p className={`text-sm ${textSecondary}`}>{dept.project_count || 0} projects</p>
                      </div>
                      <ChevronRight className={`h-5 w-5 ${textSecondary} group-hover:text-[#6366f1] transition-colors`} />
                    </div>
                    <div className="h-1 rounded-full" style={{ backgroundColor: `${dept.color}30` }}>
                      <div className="h-1 rounded-full w-1/2" style={{ backgroundColor: dept.color }} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Projects View */}
          {view === 'projects' && selectedDepartment && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
                  <Input
                    placeholder="Search projects..."
                    value={projectFilter.search}
                    onChange={(e) => setProjectFilter({ ...projectFilter, search: e.target.value })}
                    className={`pl-10 ${bgCard} ${borderColor}`}
                  />
                </div>
                
                <Select value={projectFilter.status} onValueChange={(v) => setProjectFilter({ ...projectFilter, status: v })}>
                  <SelectTrigger className={`w-40 ${bgCard} ${borderColor}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className={`flex items-center ${bgCard} border ${borderColor} rounded-lg p-1`}>
                  <button onClick={() => setProjectViewMode('grid')} className={`p-2 rounded ${projectViewMode === 'grid' ? 'bg-[#6366f1] text-white' : textSecondary}`}>
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button onClick={() => setProjectViewMode('list')} className={`p-2 rounded ${projectViewMode === 'list' ? 'bg-[#6366f1] text-white' : textSecondary}`}>
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Project Grid/List */}
              {projectViewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects.map(project => (
                    <Card
                      key={project.project_id}
                      className={`${bgCard} border ${borderColor} hover:border-[#6366f1]/50 cursor-pointer transition-all group`}
                      onClick={() => handleSelectProject(project)}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className={`font-semibold ${textPrimary} group-hover:text-[#6366f1] transition-colors`}>{project.name}</h3>
                            {project.client_name && (
                              <p className={`text-sm ${textSecondary} flex items-center gap-1 mt-1`}>
                                <Building2 className="h-3 w-3" />
                                {project.client_name}
                              </p>
                            )}
                          </div>
                          <Badge className={projectStatusColors[project.status]}>{project.status}</Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-4">
                          <div className={`flex items-center gap-1 text-sm ${textSecondary}`}>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{project.completed_tasks || 0}/{project.total_tasks || 0}</span>
                          </div>
                          <div className={`flex items-center gap-1 text-sm ${textSecondary}`}>
                            <FileText className="h-4 w-4" />
                            <span>{project.document_count || 0}</span>
                          </div>
                          {project.team_members?.length > 0 && (
                            <div className={`flex items-center gap-1 text-sm ${textSecondary}`}>
                              <Users className="h-4 w-4" />
                              <span>{project.team_members.length}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className={`mt-4 h-1.5 rounded-full ${bgSecondary}`}>
                          <div className="h-1.5 rounded-full bg-[#10b981]" style={{ width: `${project.total_tasks ? (project.completed_tasks / project.total_tasks) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className={`${bgCard} border ${borderColor} rounded-lg overflow-hidden`}>
                  <table className="w-full">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-sm font-medium ${textSecondary}`}>Project</th>
                        <th className={`px-4 py-3 text-left text-sm font-medium ${textSecondary}`}>Client</th>
                        <th className={`px-4 py-3 text-left text-sm font-medium ${textSecondary}`}>Status</th>
                        <th className={`px-4 py-3 text-left text-sm font-medium ${textSecondary}`}>Tasks</th>
                        <th className={`px-4 py-3 text-left text-sm font-medium ${textSecondary}`}>Docs</th>
                        <th className={`px-4 py-3`}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProjects.map(project => (
                        <tr key={project.project_id} className={`border-t ${borderColor} hover:${bgSecondary} cursor-pointer`} onClick={() => handleSelectProject(project)}>
                          <td className={`px-4 py-3 font-medium ${textPrimary}`}>{project.name}</td>
                          <td className={`px-4 py-3 ${textSecondary}`}>{project.client_name || '-'}</td>
                          <td className="px-4 py-3"><Badge className={projectStatusColors[project.status]}>{project.status}</Badge></td>
                          <td className={`px-4 py-3 ${textSecondary}`}>{project.completed_tasks}/{project.total_tasks}</td>
                          <td className={`px-4 py-3 ${textSecondary}`}>{project.document_count}</td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.project_id); }} className="text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {filteredProjects.length === 0 && (
                <div className={`text-center py-12 ${textSecondary}`}>
                  <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No projects found. Create your first project!</p>
                </div>
              )}
            </div>
          )}

          {/* Project Detail View with BDE-style Tasks */}
          {view === 'project-detail' && projectDetail && (
            <div className="space-y-6">
              {/* Project Info */}
              <Card className={`${bgCard} border ${borderColor}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className={`text-xl font-semibold ${textPrimary}`}>{projectDetail.name}</h2>
                      {projectDetail.client_name && (
                        <p className={`${textSecondary} flex items-center gap-1 mt-1`}>
                          <Building2 className="h-4 w-4" />
                          {projectDetail.client_name}
                        </p>
                      )}
                      {projectDetail.description && <p className={`mt-2 ${textSecondary}`}>{projectDetail.description}</p>}
                    </div>
                    <Badge className={projectStatusColors[projectDetail.status]}>{projectDetail.status}</Badge>
                  </div>
                  
                  {/* Documents */}
                  {projectDetail.documents?.length > 0 && (
                    <div className={`mt-4 pt-4 border-t ${borderColor}`}>
                      <h4 className={`text-sm font-medium ${textSecondary} mb-2`}>Documents</h4>
                      <div className="flex flex-wrap gap-2">
                        {projectDetail.documents.map(doc => (
                          <button key={doc.doc_id} onClick={() => setViewingDoc(doc)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bgSecondary} hover:bg-[#6366f1]/20 transition-colors group`}>
                            {doc.doc_type === 'sheet' ? <FileSpreadsheet className="h-4 w-4 text-[#10b981]" /> : <FileText className="h-4 w-4 text-[#3b82f6]" />}
                            <span className={textPrimary}>{doc.name}</span>
                            <X className={`h-3 w-3 ${textSecondary} opacity-0 group-hover:opacity-100`} onClick={(e) => { e.stopPropagation(); handleRemoveDocument(doc.doc_id); }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Stats Cards - BDE Style */}
              <div className="grid grid-cols-4 gap-4">
                <Card className={`${bgCard} border ${borderColor}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm ${textSecondary}`}>Total Tasks</p>
                        <p className={`text-2xl font-bold ${textPrimary}`}>{taskStats.total}</p>
                      </div>
                      <Briefcase className="h-8 w-8 text-[#6366f1]" />
                    </div>
                  </CardContent>
                </Card>
                <Card className={`${bgCard} border ${borderColor}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm ${textSecondary}`}>Pending</p>
                        <p className="text-2xl font-bold text-[#71717a]">{taskStats.pending}</p>
                      </div>
                      <Circle className="h-8 w-8 text-[#71717a]" />
                    </div>
                  </CardContent>
                </Card>
                <Card className={`${bgCard} border ${borderColor}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm ${textSecondary}`}>In Progress</p>
                        <p className="text-2xl font-bold text-[#3b82f6]">{taskStats.in_progress}</p>
                      </div>
                      <Clock className="h-8 w-8 text-[#3b82f6]" />
                    </div>
                  </CardContent>
                </Card>
                <Card className={`${bgCard} border ${borderColor}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm ${textSecondary}`}>Completed</p>
                        <p className="text-2xl font-bold text-[#10b981]">{taskStats.completed}</p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-[#10b981]" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filter Tabs & Advanced Filters - BDE Style */}
              <div className="space-y-4">
                <div className="flex gap-2 justify-between items-center flex-wrap">
                  <div className="flex gap-2 flex-wrap">
                    {['all', 'my', 'pending', 'in_progress', 'completed'].map(f => (
                      <Button key={f} variant={taskQuickFilter === f ? 'default' : 'outline'} size="sm" onClick={() => setTaskQuickFilter(f)} className={taskQuickFilter === f ? 'bg-[#6366f1]' : ''}>
                        {f === 'all' ? 'All' : f === 'my' ? 'My Tasks' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={showAdvancedFilters ? 'bg-[#6366f1] text-white' : ''}>
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </div>

                {/* Advanced Filters Panel */}
                {showAdvancedFilters && (
                  <Card className={`${bgCard} border ${borderColor}`}>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {/* Date Filter */}
                        <div>
                          <Label className={`text-xs ${textSecondary}`}>Date</Label>
                          <Select value={taskFilters.dateFilter} onValueChange={(v) => setTaskFilters({...taskFilters, dateFilter: v})}>
                            <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Time</SelectItem>
                              <SelectItem value="today">Today</SelectItem>
                              <SelectItem value="single">Single Date</SelectItem>
                              <SelectItem value="range">Date Range</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {taskFilters.dateFilter === 'single' && (
                          <div>
                            <Label className={`text-xs ${textSecondary}`}>Select Date</Label>
                            <Input type="date" value={taskFilters.singleDate} onChange={(e) => setTaskFilters({...taskFilters, singleDate: e.target.value})} className={`h-9 ${bgSecondary} border ${borderColor}`} />
                          </div>
                        )}
                        
                        {taskFilters.dateFilter === 'range' && (
                          <>
                            <div>
                              <Label className={`text-xs ${textSecondary}`}>From</Label>
                              <Input type="date" value={taskFilters.dateFrom} onChange={(e) => setTaskFilters({...taskFilters, dateFrom: e.target.value})} className={`h-9 ${bgSecondary} border ${borderColor}`} />
                            </div>
                            <div>
                              <Label className={`text-xs ${textSecondary}`}>To</Label>
                              <Input type="date" value={taskFilters.dateTo} onChange={(e) => setTaskFilters({...taskFilters, dateTo: e.target.value})} className={`h-9 ${bgSecondary} border ${borderColor}`} />
                            </div>
                          </>
                        )}
                        
                        {/* Assigned To */}
                        <div>
                          <Label className={`text-xs ${textSecondary}`}>Assigned To</Label>
                          <Select value={taskFilters.assignedTo} onValueChange={(v) => setTaskFilters({...taskFilters, assignedTo: v})}>
                            <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="myself">Myself</SelectItem>
                              {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Assigned By */}
                        <div>
                          <Label className={`text-xs ${textSecondary}`}>Assigned By</Label>
                          <Select value={taskFilters.assignedBy} onValueChange={(v) => setTaskFilters({...taskFilters, assignedBy: v})}>
                            <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Task Type */}
                        <div>
                          <Label className={`text-xs ${textSecondary}`}>Type</Label>
                          <Select value={taskFilters.taskType} onValueChange={(v) => setTaskFilters({...taskFilters, taskType: v})}>
                            <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Types</SelectItem>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="meeting">Meeting</SelectItem>
                              <SelectItem value="follow_up">Follow Up</SelectItem>
                              <SelectItem value="proposal">Proposal</SelectItem>
                              <SelectItem value="call">Call</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Status */}
                        <div>
                          <Label className={`text-xs ${textSecondary}`}>Status</Label>
                          <Select value={taskFilters.status} onValueChange={(v) => setTaskFilters({...taskFilters, status: v})}>
                            <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="on_hold">On Hold</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="flex justify-end mt-4">
                        <Button variant="ghost" size="sm" onClick={resetTaskFilters}>Reset Filters</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Tasks Table - BDE Style */}
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={bgSecondary}>
                        <tr>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Task</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Status</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Created / Assigned</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Due Date</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Link</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Time</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Timer</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-200'}`}>
                        {filteredTasks.length === 0 ? (
                          <tr>
                            <td colSpan={8} className={`px-4 py-8 text-center ${textSecondary}`}>
                              <Briefcase className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                              <p>No tasks found</p>
                            </td>
                          </tr>
                        ) : filteredTasks.map(task => (
                          <tr key={task.task_id} className={`${bgCard} hover:${bgSecondary} cursor-pointer transition-colors`} onClick={() => { setViewingTask(task); setShowTaskDetailModal(true); }}>
                            <td className="px-4 py-3">
                              <div className={`font-medium ${textPrimary}`}>{task.task_name}</div>
                              {task.description && <div className={`text-xs ${textSecondary} truncate max-w-xs`}>{task.description}</div>}
                              <Badge className="text-xs mt-1" variant="outline">{task.type || 'general'}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={`${statusColors[task.status]?.bg} ${statusColors[task.status]?.text}`}>
                                {task.status?.replace('_', ' ') || 'Pending'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {task.created_by === user?.user_id ? (
                                <div>
                                  <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs mb-1">Created by you</Badge>
                                  <p className={`text-xs ${textSecondary}`}>{formatDate(task.created_at)}</p>
                                </div>
                              ) : task.assigned_to === user?.user_id ? (
                                <div>
                                  <Badge className="bg-[#10b981]/20 text-[#10b981] text-xs mb-1">Assigned to you</Badge>
                                  <p className={`text-xs ${textSecondary}`}>by {task.assigned_by_name || task.created_by_name || 'Unknown'}</p>
                                </div>
                              ) : (
                                <div>
                                  <p className={textPrimary}>{task.created_by_name || '-'}</p>
                                  {task.assigned_to_name && <p className={`text-xs ${textSecondary}`}>→ {task.assigned_to_name}</p>}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {task.due_date ? (
                                <div>
                                  <span className={new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-[#ef4444]' : textPrimary}>
                                    {formatDate(task.due_date)}
                                  </span>
                                  {task.due_time && <span className={`text-xs ${textSecondary} ml-1`}>at {task.due_time}</span>}
                                  {task.recurrence && task.recurrence !== 'none' && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Repeat className="h-3 w-3 text-[#6366f1]" />
                                      <span className="text-[10px] text-[#6366f1]">{getRecurrenceLabel(task)}</span>
                                    </div>
                                  )}
                                </div>
                              ) : <span className={textSecondary}>-</span>}
                            </td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              {task.work_link ? (
                                <a href={task.work_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#3b82f6] hover:text-[#2563eb]">
                                  <LinkIcon className="h-4 w-4" />
                                </a>
                              ) : <span className={textSecondary}>-</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Timer className={`h-4 w-4 ${task.time_tracking?.status === 'running' ? 'text-[#10b981] animate-pulse' : textSecondary}`} />
                                <span className={`text-sm font-medium ${textPrimary}`}>{formatDuration(task.time_tracking?.total_seconds || 0)}</span>
                              </div>
                              {task.time_tracking?.status === 'running' && <div className="text-xs text-[#10b981] mt-1">Running...</div>}
                            </td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              {getTimeTrackingButton(task)}
                            </td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="text-[#6366f1]" onClick={() => { setViewingTask(task); setShowTaskDetailModal(true); }}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openEditTaskModal(task)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => handleDeleteTask(task.task_id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Document Viewer Modal */}
        {viewingDoc && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-5xl h-[80vh] ${bgCard} border ${borderColor} flex flex-col`}>
              <div className={`flex items-center justify-between px-4 py-3 border-b ${borderColor}`}>
                <div className="flex items-center gap-2">
                  {viewingDoc.doc_type === 'sheet' ? <FileSpreadsheet className="h-4 w-4 text-[#10b981]" /> : <FileText className="h-4 w-4 text-[#3b82f6]" />}
                  <span className={`font-medium ${textPrimary}`}>{viewingDoc.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a href={viewingDoc.link} target="_blank" rel="noopener noreferrer" className={textSecondary}><ExternalLink className="h-4 w-4" /></a>
                  <button onClick={() => setViewingDoc(null)} className={textSecondary}><X className="h-4 w-4" /></button>
                </div>
              </div>
              <iframe src={viewingDoc.link.includes('docs.google.com') ? viewingDoc.link.replace('/edit', '/preview') : viewingDoc.link} className="flex-1 w-full" title={viewingDoc.name} />
            </Card>
          </div>
        )}

        {/* Department Modal */}
        {showDeptModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-semibold ${textPrimary}`}>Add Department</h3>
                <button onClick={() => setShowDeptModal(false)} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <Label className={textSecondary}>Name *</Label>
                  <Input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="e.g., Content Writing" className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textSecondary}>Icon</Label>
                    <Input value={deptForm.icon} onChange={(e) => setDeptForm({ ...deptForm, icon: e.target.value })} placeholder="📁" className={`${bgSecondary} ${borderColor}`} />
                  </div>
                  <div>
                    <Label className={textSecondary}>Color</Label>
                    <Input type="color" value={deptForm.color} onChange={(e) => setDeptForm({ ...deptForm, color: e.target.value })} className={`${bgSecondary} ${borderColor} h-10`} />
                  </div>
                </div>
                <div>
                  <Label className={textSecondary}>Description</Label>
                  <Textarea value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                </div>
              </div>
              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => setShowDeptModal(false)}>Cancel</Button>
                <Button onClick={handleCreateDepartment} className="bg-[#6366f1] hover:bg-[#4f46e5]">Create Department</Button>
              </div>
            </Card>
          </div>
        )}

        {/* Project Modal */}
        {showProjectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-lg ${bgCard} border ${borderColor}`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-semibold ${textPrimary}`}>{editingProject ? 'Edit Project' : 'New Project'}</h3>
                <button onClick={() => setShowProjectModal(false)} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <Label className={textSecondary}>Project Name *</Label>
                  <Input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} placeholder="Enter project name" className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div>
                  <Label className={textSecondary}>Client/Company Name</Label>
                  <Input value={projectForm.client_name} onChange={(e) => setProjectForm({ ...projectForm, client_name: e.target.value })} placeholder="Enter client name" className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div>
                  <Label className={textSecondary}>Description</Label>
                  <Textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textSecondary}>Start Date</Label>
                    <Input type="date" value={projectForm.start_date} onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                  </div>
                  <div>
                    <Label className={textSecondary}>End Date</Label>
                    <Input type="date" value={projectForm.end_date} onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                  </div>
                </div>
                <div>
                  <Label className={textSecondary}>Status</Label>
                  <Select value={projectForm.status} onValueChange={(v) => setProjectForm({ ...projectForm, status: v })}>
                    <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textSecondary}>Team Members</Label>
                  <Select value="" onValueChange={(v) => { if (!projectForm.team_members.includes(v)) setProjectForm({ ...projectForm, team_members: [...projectForm.team_members, v] }); }}>
                    <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue placeholder="Add team member" /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {projectForm.team_members.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {projectForm.team_members.map(uid => {
                        const u = users.find(x => x.user_id === uid);
                        return (
                          <Badge key={uid} className={`${bgSecondary} ${textPrimary}`}>
                            {u?.name || uid}
                            <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setProjectForm({ ...projectForm, team_members: projectForm.team_members.filter(x => x !== uid) })} />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => setShowProjectModal(false)}>Cancel</Button>
                <Button onClick={handleCreateProject} className="bg-[#10b981] hover:bg-[#059669]">{editingProject ? 'Update' : 'Create'} Project</Button>
              </div>
            </Card>
          </div>
        )}

        {/* Task Modal - BDE Style */}
        {showTaskModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-lg ${bgCard} border ${borderColor}`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-semibold ${textPrimary} flex items-center gap-2`}>
                  <Briefcase className="h-5 w-5 text-[#6366f1]" />
                  {editingTask ? 'Edit Task' : 'Create New Task'}
                </h3>
                <button onClick={() => { setShowTaskModal(false); setEditingTask(null); resetTaskForm(); }} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <Label className={textPrimary}>Task Name *</Label>
                  <Input value={taskForm.task_name} onChange={(e) => setTaskForm({ ...taskForm, task_name: e.target.value })} placeholder="Enter task name" className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div>
                  <Label className={textPrimary}>Description</Label>
                  <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Task description" rows={3} className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Priority</Label>
                    <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                      <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={textPrimary}>Type</Label>
                    <Select value={taskForm.type} onValueChange={(v) => setTaskForm({ ...taskForm, type: v })}>
                      <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="call">Call</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className={textPrimary}>Assign To</Label>
                  <Select value={taskForm.assigned_to} onValueChange={(v) => setTaskForm({ ...taskForm, assigned_to: v })}>
                    <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Due Date</Label>
                    <Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                  </div>
                  <div>
                    <Label className={textPrimary}>Due Time</Label>
                    <Input type="time" value={taskForm.due_time} onChange={(e) => setTaskForm({ ...taskForm, due_time: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                  </div>
                </div>
                <div>
                  <Label className={textPrimary}>Recurrence</Label>
                  <Select value={taskForm.recurrence} onValueChange={(v) => setTaskForm({ ...taskForm, recurrence: v })}>
                    <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (One-time)</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="weekdays">Weekdays (Mon-Fri)</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {taskForm.recurrence === 'custom' && (
                  <div className={`p-3 rounded-lg ${bgSecondary} space-y-3`}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className={textSecondary}>Repeat Every</Label>
                        <Input type="number" min="1" value={taskForm.custom_recurrence.repeat_every} onChange={(e) => setTaskForm({ ...taskForm, custom_recurrence: { ...taskForm.custom_recurrence, repeat_every: parseInt(e.target.value) || 1 } })} className={`${bgCard} ${borderColor}`} />
                      </div>
                      <div>
                        <Label className={textSecondary}>Unit</Label>
                        <Select value={taskForm.custom_recurrence.repeat_unit} onValueChange={(v) => setTaskForm({ ...taskForm, custom_recurrence: { ...taskForm.custom_recurrence, repeat_unit: v } })}>
                          <SelectTrigger className={`${bgCard} ${borderColor}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">Day(s)</SelectItem>
                            <SelectItem value="week">Week(s)</SelectItem>
                            <SelectItem value="month">Month(s)</SelectItem>
                            <SelectItem value="year">Year(s)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {taskForm.custom_recurrence.repeat_unit === 'week' && (
                      <div>
                        <Label className={textSecondary}>Repeat On</Label>
                        <div className="flex gap-2 mt-1">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                            <button key={i} onClick={() => {
                              const days = taskForm.custom_recurrence.repeat_on_days || [];
                              setTaskForm({ ...taskForm, custom_recurrence: { ...taskForm.custom_recurrence, repeat_on_days: days.includes(i) ? days.filter(d => d !== i) : [...days, i] } });
                            }} className={`px-2 py-1 rounded text-xs ${(taskForm.custom_recurrence.repeat_on_days || []).includes(i) ? 'bg-[#6366f1] text-white' : `${bgCard} ${textSecondary}`}`}>
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <Label className={textPrimary}>Status</Label>
                  <Select value={taskForm.status} onValueChange={(v) => setTaskForm({ ...taskForm, status: v })}>
                    <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>Work Link</Label>
                  <Input value={taskForm.work_link} onChange={(e) => setTaskForm({ ...taskForm, work_link: e.target.value })} placeholder="https://..." className={`${bgSecondary} ${borderColor}`} />
                </div>
              </div>
              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => { setShowTaskModal(false); setEditingTask(null); resetTaskForm(); }}>Cancel</Button>
                <Button onClick={handleCreateTask} className="bg-[#6366f1] hover:bg-[#4f46e5]">{editingTask ? 'Update' : 'Create'} Task</Button>
              </div>
            </Card>
          </div>
        )}

        {/* Document Modal */}
        {showDocModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-semibold ${textPrimary}`}>Add Document</h3>
                <button onClick={() => setShowDocModal(false)} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <Label className={textSecondary}>Document Name *</Label>
                  <Input value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} placeholder="e.g., Project Brief" className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div>
                  <Label className={textSecondary}>Link *</Label>
                  <Input value={docForm.link} onChange={(e) => setDocForm({ ...docForm, link: e.target.value })} placeholder="https://docs.google.com/..." className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div>
                  <Label className={textSecondary}>Type</Label>
                  <Select value={docForm.doc_type} onValueChange={(v) => setDocForm({ ...docForm, doc_type: v })}>
                    <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sheet">Google Sheet</SelectItem>
                      <SelectItem value="doc">Google Doc</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => setShowDocModal(false)}>Cancel</Button>
                <Button onClick={handleAddDocument} className="bg-[#10b981] hover:bg-[#059669]">Add Document</Button>
              </div>
            </Card>
          </div>
        )}

        {/* Task Detail Modal */}
        {showTaskDetailModal && viewingTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-lg ${bgCard} border ${borderColor}`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-semibold ${textPrimary}`}>Task Details</h3>
                <button onClick={() => { setShowTaskDetailModal(false); setViewingTask(null); }} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <h2 className={`text-lg font-semibold ${textPrimary}`}>{viewingTask.task_name}</h2>
                  {viewingTask.description && <p className={`mt-2 ${textSecondary}`}>{viewingTask.description}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={priorityColors[viewingTask.priority]}>{viewingTask.priority}</Badge>
                  <Badge className={`${statusColors[viewingTask.status]?.bg} ${statusColors[viewingTask.status]?.text}`}>{viewingTask.status?.replace('_', ' ')}</Badge>
                  <Badge variant="outline">{viewingTask.type || 'general'}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className={textSecondary}>Due Date</p>
                    <p className={textPrimary}>{viewingTask.due_date ? formatDate(viewingTask.due_date) : '-'}{viewingTask.due_time ? ` at ${viewingTask.due_time}` : ''}</p>
                  </div>
                  <div>
                    <p className={textSecondary}>Time Spent</p>
                    <p className={textPrimary}>{formatDuration(viewingTask.time_tracking?.total_seconds || 0)}</p>
                  </div>
                  <div>
                    <p className={textSecondary}>Created By</p>
                    <p className={textPrimary}>{viewingTask.created_by_name || '-'}</p>
                  </div>
                  <div>
                    <p className={textSecondary}>Assigned To</p>
                    <p className={textPrimary}>{viewingTask.assigned_to_name || '-'}</p>
                  </div>
                </div>
                {viewingTask.recurrence && viewingTask.recurrence !== 'none' && (
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-[#6366f1]" />
                    <span className={textPrimary}>{getRecurrenceLabel(viewingTask)}</span>
                  </div>
                )}
                {viewingTask.work_link && (
                  <a href={viewingTask.work_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#3b82f6]">
                    <LinkIcon className="h-4 w-4" />
                    Open Work Link
                  </a>
                )}
              </div>
              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => { setShowTaskDetailModal(false); openEditTaskModal(viewingTask); }}>
                  <Edit2 className="h-4 w-4 mr-2" /> Edit
                </Button>
                <Button onClick={() => setShowTaskDetailModal(false)}>Close</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
