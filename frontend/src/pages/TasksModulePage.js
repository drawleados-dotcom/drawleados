import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Plus, Calendar, Clock, User, CheckCircle2, Circle, 
  MoreHorizontal, Trash2, Edit2, X, AlertCircle, Briefcase,
  Play, Pause, Square, Timer, Eye, FileText, Tag, Users, Link as LinkIcon, Filter,
  FolderOpen, ChevronRight, ChevronDown, ArrowLeft, FileSpreadsheet, ExternalLink,
  Search, Building2, Layers, LayoutGrid, List
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
  const [view, setView] = useState('departments'); // departments, projects, project-detail
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // Data
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectDetail, setProjectDetail] = useState(null);
  const [users, setUsers] = useState([]);
  
  // Filters
  const [projectFilter, setProjectFilter] = useState({ status: 'all', search: '' });
  const [taskFilter, setTaskFilter] = useState('all');
  
  // Modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  
  // View mode for projects
  const [projectViewMode, setProjectViewMode] = useState('grid'); // grid, list
  
  // Running timers
  const [runningTimers, setRunningTimers] = useState({});
  
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

  // Filter tasks
  const filteredTasks = (projectDetail?.tasks || []).filter(t => {
    if (taskFilter === 'all') return true;
    return t.status === taskFilter;
  });

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
    task_name: '', description: '', priority: 'medium', type: 'general', assigned_to: '', due_date: '', due_time: '', status: 'pending', work_link: ''
  });

  const handleCreateTask = async () => {
    if (!taskForm.task_name.trim()) {
      toast.error('Task name is required');
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
      setTaskForm({ task_name: '', description: '', priority: 'medium', type: 'general', assigned_to: '', due_date: '', due_time: '', status: 'pending', work_link: '' });
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

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await axios.put(`${API}/api/departments/projects/${selectedProject.project_id}/tasks/${taskId}`, { status: newStatus }, { headers });
      loadProjectDetail(selectedProject.project_id);
    } catch (error) {
      toast.error('Failed to update task');
    }
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

  // ========== TIMER ==========
  const handleStartTimer = async (taskId) => {
    try {
      const res = await axios.post(`${API}/api/departments/tasks/${taskId}/timer/start`, {}, { headers });
      setRunningTimers(prev => ({ ...prev, [taskId]: res.data }));
      loadProjectDetail(selectedProject.project_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start timer');
    }
  };

  const handleStopTimer = async (taskId) => {
    try {
      await axios.post(`${API}/api/departments/tasks/${taskId}/timer/stop`, {}, { headers });
      setRunningTimers(prev => {
        const newTimers = { ...prev };
        delete newTimers[taskId];
        return newTimers;
      });
      loadProjectDetail(selectedProject.project_id);
    } catch (error) {
      toast.error('Failed to stop timer');
    }
  };

  // Format time spent
  const formatTimeSpent = (seconds) => {
    if (!seconds) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
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
                  <Button variant="outline" onClick={() => setShowDocModal(true)} className={`${borderColor}`}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Add Document
                  </Button>
                  <Button onClick={() => { setEditingTask(null); setTaskForm({ task_name: '', description: '', priority: 'medium', type: 'general', assigned_to: '', due_date: '', due_time: '', status: 'pending', work_link: '' }); setShowTaskModal(true); }} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
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
                      data-testid={`project-card-${project.project_id}`}
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
                        
                        {/* Progress bar */}
                        <div className={`mt-4 h-1.5 rounded-full ${bgSecondary}`}>
                          <div 
                            className="h-1.5 rounded-full bg-[#10b981]" 
                            style={{ width: `${project.total_tasks ? (project.completed_tasks / project.total_tasks) * 100 : 0}%` }} 
                          />
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
                        <tr 
                          key={project.project_id} 
                          className={`border-t ${borderColor} hover:${bgSecondary} cursor-pointer`}
                          onClick={() => handleSelectProject(project)}
                        >
                          <td className={`px-4 py-3 font-medium ${textPrimary}`}>{project.name}</td>
                          <td className={`px-4 py-3 ${textSecondary}`}>{project.client_name || '-'}</td>
                          <td className="px-4 py-3">
                            <Badge className={projectStatusColors[project.status]}>{project.status}</Badge>
                          </td>
                          <td className={`px-4 py-3 ${textSecondary}`}>{project.completed_tasks}/{project.total_tasks}</td>
                          <td className={`px-4 py-3 ${textSecondary}`}>{project.document_count}</td>
                          <td className="px-4 py-3">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.project_id); }}
                              className="text-red-500"
                            >
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
                  <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No projects found. Create your first project!</p>
                </div>
              )}
            </div>
          )}

          {/* Project Detail View */}
          {view === 'project-detail' && projectDetail && (
            <div className="flex gap-6">
              {/* Main Content */}
              <div className={`flex-1 ${viewingDoc ? 'w-1/2' : 'w-full'}`}>
                {/* Project Info */}
                <Card className={`${bgCard} border ${borderColor} mb-6`}>
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
                        {projectDetail.description && (
                          <p className={`mt-2 ${textSecondary}`}>{projectDetail.description}</p>
                        )}
                      </div>
                      <Badge className={projectStatusColors[projectDetail.status]}>{projectDetail.status}</Badge>
                    </div>
                    
                    {/* Documents */}
                    {projectDetail.documents?.length > 0 && (
                      <div className={`mt-4 pt-4 border-t ${borderColor}`}>
                        <h4 className={`text-sm font-medium ${textSecondary} mb-2`}>Documents</h4>
                        <div className="flex flex-wrap gap-2">
                          {projectDetail.documents.map(doc => (
                            <button
                              key={doc.doc_id}
                              onClick={() => setViewingDoc(doc)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bgSecondary} hover:bg-[#6366f1]/20 transition-colors group`}
                            >
                              {doc.doc_type === 'sheet' ? <FileSpreadsheet className="h-4 w-4 text-[#10b981]" /> : <FileText className="h-4 w-4 text-[#3b82f6]" />}
                              <span className={textPrimary}>{doc.name}</span>
                              <X 
                                className={`h-3 w-3 ${textSecondary} opacity-0 group-hover:opacity-100`}
                                onClick={(e) => { e.stopPropagation(); handleRemoveDocument(doc.doc_id); }}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Task Filters */}
                <div className="flex items-center gap-2 mb-4">
                  {['all', 'pending', 'in_progress', 'completed', 'on_hold'].map(status => (
                    <button
                      key={status}
                      onClick={() => setTaskFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        taskFilter === status 
                          ? 'bg-[#6366f1] text-white' 
                          : `${bgSecondary} ${textSecondary} hover:text-[#6366f1]`
                      }`}
                    >
                      {status === 'all' ? 'All' : statusColors[status]?.label || status}
                    </button>
                  ))}
                </div>

                {/* Tasks */}
                <div className="space-y-3">
                  {filteredTasks.map(task => (
                    <Card key={task.task_id} className={`${bgCard} border ${borderColor} group`}>
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Status checkbox */}
                          <button
                            onClick={() => handleUpdateTaskStatus(task.task_id, task.status === 'completed' ? 'pending' : 'completed')}
                            className={`mt-1 ${task.status === 'completed' ? 'text-[#10b981]' : textSecondary}`}
                          >
                            {task.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                          </button>
                          
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className={`font-medium ${textPrimary} ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}>
                                  {task.task_name}
                                </h4>
                                {task.description && (
                                  <p className={`text-sm ${textSecondary} mt-1`}>{task.description}</p>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Timer */}
                                {runningTimers[task.task_id] ? (
                                  <Button variant="ghost" size="sm" onClick={() => handleStopTimer(task.task_id)} className="text-red-500">
                                    <Square className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="sm" onClick={() => handleStartTimer(task.task_id)} className={textSecondary}>
                                    <Play className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => { setEditingTask(task); setTaskForm(task); setShowTaskModal(true); }} className={textSecondary}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.task_id)} className="text-red-500">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 mt-3 flex-wrap">
                              <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                              <Badge className={`${statusColors[task.status]?.bg} ${statusColors[task.status]?.text}`}>
                                {statusColors[task.status]?.label}
                              </Badge>
                              
                              {task.due_date && (
                                <span className={`flex items-center gap-1 text-sm ${textSecondary}`}>
                                  <Calendar className="h-3 w-3" />
                                  {task.due_date}
                                </span>
                              )}
                              
                              {task.assigned_to_name && (
                                <span className={`flex items-center gap-1 text-sm ${textSecondary}`}>
                                  <User className="h-3 w-3" />
                                  {task.assigned_to_name}
                                </span>
                              )}
                              
                              {task.time_spent > 0 && (
                                <span className={`flex items-center gap-1 text-sm ${textSecondary}`}>
                                  <Timer className="h-3 w-3" />
                                  {formatTimeSpent(task.time_spent)}
                                </span>
                              )}
                              
                              {task.work_link && (
                                <a href={task.work_link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] flex items-center gap-1 text-sm">
                                  <LinkIcon className="h-3 w-3" />
                                  Link
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                  
                  {filteredTasks.length === 0 && (
                    <div className={`text-center py-8 ${textSecondary}`}>
                      <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No tasks yet. Add your first task!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Document Viewer */}
              {viewingDoc && (
                <div className={`w-1/2 ${bgCard} border ${borderColor} rounded-lg overflow-hidden`}>
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${borderColor}`}>
                    <div className="flex items-center gap-2">
                      {viewingDoc.doc_type === 'sheet' ? <FileSpreadsheet className="h-4 w-4 text-[#10b981]" /> : <FileText className="h-4 w-4 text-[#3b82f6]" />}
                      <span className={`font-medium ${textPrimary}`}>{viewingDoc.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={viewingDoc.link} target="_blank" rel="noopener noreferrer" className={textSecondary}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button onClick={() => setViewingDoc(null)} className={textSecondary}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <iframe
                    src={viewingDoc.link.includes('docs.google.com') ? viewingDoc.link.replace('/edit', '/preview') : viewingDoc.link}
                    className="w-full h-[calc(100vh-300px)]"
                    title={viewingDoc.name}
                  />
                </div>
              )}
            </div>
          )}
        </div>

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
                      {users.map(u => (
                        <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>
                      ))}
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

        {/* Task Modal */}
        {showTaskModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-lg ${bgCard} border ${borderColor}`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-semibold ${textPrimary}`}>{editingTask ? 'Edit Task' : 'Add Task'}</h3>
                <button onClick={() => setShowTaskModal(false)} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <Label className={textSecondary}>Task Name *</Label>
                  <Input value={taskForm.task_name} onChange={(e) => setTaskForm({ ...taskForm, task_name: e.target.value })} placeholder="Enter task name" className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div>
                  <Label className={textSecondary}>Description</Label>
                  <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textSecondary}>Priority</Label>
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
                    <Label className={textSecondary}>Type</Label>
                    <Select value={taskForm.type} onValueChange={(v) => setTaskForm({ ...taskForm, type: v })}>
                      <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className={textSecondary}>Assign To</Label>
                  <Select value={taskForm.assigned_to} onValueChange={(v) => setTaskForm({ ...taskForm, assigned_to: v })}>
                    <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textSecondary}>Due Date</Label>
                    <Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                  </div>
                  <div>
                    <Label className={textSecondary}>Due Time</Label>
                    <Input type="time" value={taskForm.due_time} onChange={(e) => setTaskForm({ ...taskForm, due_time: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                  </div>
                </div>
                <div>
                  <Label className={textSecondary}>Status</Label>
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
                  <Label className={textSecondary}>Work Link</Label>
                  <Input value={taskForm.work_link} onChange={(e) => setTaskForm({ ...taskForm, work_link: e.target.value })} placeholder="https://..." className={`${bgSecondary} ${borderColor}`} />
                </div>
              </div>
              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => setShowTaskModal(false)}>Cancel</Button>
                <Button onClick={handleCreateTask} className="bg-[#6366f1] hover:bg-[#4f46e5]">{editingTask ? 'Update' : 'Add'} Task</Button>
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
      </div>
    </Layout>
  );
}
