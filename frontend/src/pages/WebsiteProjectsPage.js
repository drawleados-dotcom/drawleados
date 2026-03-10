import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Globe, Calendar, Clock, User, ExternalLink, Link2, Folder, Server,
  ChevronDown, ChevronUp, Search, Filter, Edit2, Trash2, CheckCircle, Circle, X,
  Image, FileText, ListTodo, LayoutGrid, Send, Check, ArrowLeft, Percent,
  Users, CalendarDays, Code, Palette, FileEdit, Box
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_COLORS = {
  'To-Do': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Client Review': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Client Approved': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Completed': 'bg-green-500/20 text-green-400 border-green-500/30',
  'On Hold': 'bg-orange-500/20 text-orange-400 border-orange-500/30'
};

const PRIORITY_COLORS = {
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-red-500/20 text-red-400'
};

const STATUS_OPTIONS = ['To-Do', 'In Progress', 'Client Review', 'Client Approved', 'Completed', 'On Hold'];

const WebsiteProjectsPage = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // View states
  const [currentView, setCurrentView] = useState('all-projects'); // all-projects, project-detail, page-detail
  const [projects, setProjects] = useState([]);
  const [allProjectsSummary, setAllProjectsSummary] = useState([]);
  const [crossProjectTasks, setCrossProjectTasks] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetail, setProjectDetail] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageSubtasks, setPageSubtasks] = useState([]);
  const [pageScreenshots, setPageScreenshots] = useState([]);
  const [pageSections, setPageSections] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [options, setOptions] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dueDateFilter, setDueDateFilter] = useState('');
  const [developerFilter, setDeveloperFilter] = useState('all');
  
  // UI States
  const [activeTab, setActiveTab] = useState('pages');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [expandedHeader, setExpandedHeader] = useState(true);
  
  // Section sidebar for page detail view
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionFeedback, setSectionFeedback] = useState([]);
  const [isSectionSidebarOpen, setIsSectionSidebarOpen] = useState(false);
  const [sectionActiveTab, setSectionActiveTab] = useState('wireframe');
  const [docPopupUrl, setDocPopupUrl] = useState(null);
  
  // Default pages for new projects
  const DEFAULT_PAGES = [
    'Home Page',
    'About Us',
    'Services',
    'Contact Us',
    'Privacy Policy',
    'Terms & Conditions'
  ];
  
  // Form states
  const [newProject, setNewProject] = useState({
    name: '', 
    // Basic Details
    onboarding_date: new Date().toISOString().split('T')[0], 
    deadline: '',
    status: 'active',
    // Client Info
    client_name: '',
    client_location: '',
    client_email: '',
    client_phone: '',
    // Domain & Hosting
    domain_url: '', 
    domain_username: '',
    domain_password: '',
    domain_2fa: '',
    domain_email_dns: '',
    // Server
    server_details: '', 
    server_username: '',
    server_password: '',
    server_2fa: '',
    // Platform
    platform: 'Website', 
    website_type: 'Business Website',
    // Team
    developer: '', 
    designer: '',
    content_writer: '',
    project_manager: '',
    // Product
    product_details: '',
    onboarding_form: '',
    // Links
    client_drive_url: '', 
    documents_url: '', 
    communication_url: ''
  });
  const [newPage, setNewPage] = useState({ page_name: '' });
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium' });
  const [newSection, setNewSection] = useState({ name: '', description: '', screenshot_url: '' });
  const [newFeedback, setNewFeedback] = useState({ content: '', feedback_type: 'comment' });
  const [newSubtask, setNewSubtask] = useState('');
  const [newScreenshotUrl, setNewScreenshotUrl] = useState('');

  const token = localStorage.getItem('session_token');

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';

  // Check URL params
  useEffect(() => {
    const projectId = searchParams.get('id');
    const pageId = searchParams.get('page');
    const action = searchParams.get('action');
    
    if (pageId) {
      setCurrentView('page-detail');
    } else if (projectId) {
      setSelectedProject(projectId);
      setCurrentView('project-detail');
    } else {
      setCurrentView('all-projects');
    }
    
    if (action === 'new') {
      setIsCreateModalOpen(true);
    }
  }, [searchParams]);

  // Load functions
  const loadProjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadAllProjectsSummary = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/all-projects-summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllProjectsSummary(res.data);
    } catch (error) {
      console.error('Error loading projects summary:', error);
    }
  }, [token]);

  const loadCrossProjectTasks = useCallback(async () => {
    try {
      let url = `${API}/api/website-projects/all-tasks`;
      const params = new URLSearchParams();
      if (dueDateFilter) params.append('due_date', dueDateFilter);
      if (developerFilter && developerFilter !== 'all') params.append('developer', developerFilter);
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setCrossProjectTasks(res.data);
    } catch (error) {
      console.error('Error loading cross-project tasks:', error);
    }
  }, [token, dueDateFilter, developerFilter]);

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/team-members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(res.data);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }, [token]);

  const checkPermission = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/check-permission`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCanEdit(res.data.can_edit);
    } catch (error) {
      console.error('Error checking permission:', error);
    }
  }, [token]);

  const loadOptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/options`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOptions(res.data);
    } catch (error) {
      console.error('Error loading options:', error);
    }
  }, [token]);

  const loadProjectDetail = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjectDetail(res.data);
    } catch (error) {
      console.error('Error loading project detail:', error);
    }
  }, [token]);

  const loadProjectTasks = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/projects/${projectId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjectTasks(res.data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [token]);

  const loadPageSubtasks = useCallback(async (pageId) => {
    if (!pageId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/pages/${pageId}/subtasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPageSubtasks(res.data);
    } catch (error) {
      console.error('Error loading subtasks:', error);
    }
  }, [token]);

  const loadPageScreenshots = useCallback(async (pageId) => {
    if (!pageId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/pages/${pageId}/screenshots`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPageScreenshots(res.data);
    } catch (error) {
      console.error('Error loading screenshots:', error);
    }
  }, [token]);

  const loadPageSections = useCallback(async (pageId) => {
    if (!pageId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/pages/${pageId}/sections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPageSections(res.data);
    } catch (error) {
      console.error('Error loading sections:', error);
    }
  }, [token]);

  const loadSectionFeedback = useCallback(async (sectionId) => {
    if (!sectionId) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/sections/${sectionId}/feedback`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSectionFeedback(res.data);
    } catch (error) {
      console.error('Error loading feedback:', error);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    loadProjects();
    loadAllProjectsSummary();
    loadTeamMembers();
    loadOptions();
    checkPermission();
  }, [loadProjects, loadAllProjectsSummary, loadTeamMembers, loadOptions, checkPermission]);

  // Load cross-project tasks when filters change
  useEffect(() => {
    if (currentView === 'all-projects') {
      loadCrossProjectTasks();
    }
  }, [currentView, loadCrossProjectTasks]);

  // Load project detail when selected
  useEffect(() => {
    if (selectedProject && currentView === 'project-detail') {
      loadProjectDetail(selectedProject);
      loadProjectTasks(selectedProject);
    }
  }, [selectedProject, currentView, loadProjectDetail, loadProjectTasks]);

  // Load page data when selected
  useEffect(() => {
    if (selectedPage && currentView === 'page-detail') {
      loadPageSubtasks(selectedPage.task_id);
      loadPageScreenshots(selectedPage.task_id);
      loadPageSections(selectedPage.task_id);
    }
  }, [selectedPage, currentView, loadPageSubtasks, loadPageScreenshots, loadPageSections]);

  // Load section feedback
  useEffect(() => {
    if (selectedSection) {
      loadSectionFeedback(selectedSection.section_id);
    }
  }, [selectedSection, loadSectionFeedback]);

  // Navigation functions
  const openProject = (projectId) => {
    setSelectedProject(projectId);
    setCurrentView('project-detail');
    setSearchParams({ id: projectId });
  };

  const openPage = (page) => {
    setSelectedPage(page);
    setCurrentView('page-detail');
    setSearchParams({ id: selectedProject, page: page.task_id });
    setIsSectionSidebarOpen(false);
    setSelectedSection(null);
  };

  const goBackToAllProjects = () => {
    setCurrentView('all-projects');
    setSelectedProject(null);
    setProjectDetail(null);
    setSearchParams({});
  };

  const goBackToProject = () => {
    setCurrentView('project-detail');
    setSelectedPage(null);
    setSearchParams({ id: selectedProject });
    setIsSectionSidebarOpen(false);
    setSelectedSection(null);
  };

  // CRUD handlers
  const handleCreateProject = async () => {
    if (!newProject.name) { toast.error('Project name is required'); return; }
    try {
      const res = await axios.post(`${API}/api/website-projects/projects`, newProject, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Project created with ${res.data.pages_created} default pages`);
      setIsCreateModalOpen(false);
      setNewProject({ name: '', domain_url: '', platform: 'Website', website_type: 'Business Website',
        developer: '', onboarding_date: new Date().toISOString().split('T')[0], deadline: '',
        server_details: '', client_drive_url: '', documents_url: '', communication_url: '' });
      loadProjects();
      loadAllProjectsSummary();
      openProject(res.data.project_id);
    } catch (error) { toast.error('Failed to create project'); }
  };

  const handleUpdateProject = async () => {
    try {
      await axios.put(`${API}/api/website-projects/projects/${selectedProject}`, newProject, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Project updated');
      setIsEditProjectModalOpen(false);
      loadProjectDetail(selectedProject);
      loadProjects();
      loadAllProjectsSummary();
    } catch (error) { toast.error('Failed to update project'); }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('Delete this project and all its pages?')) return;
    try {
      await axios.delete(`${API}/api/website-projects/projects/${selectedProject}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Project deleted');
      goBackToAllProjects();
      loadProjects();
      loadAllProjectsSummary();
    } catch (error) { toast.error('Failed to delete project'); }
  };

  const handleAddPage = async () => {
    if (!newPage.page_name) { toast.error('Page name is required'); return; }
    try {
      await axios.post(`${API}/api/website-projects/projects/${selectedProject}/pages`, newPage, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Page added');
      setIsAddPageModalOpen(false);
      setNewPage({ page_name: '' });
      loadProjectDetail(selectedProject);
    } catch (error) { toast.error('Failed to add page'); }
  };

  const handleAddTask = async () => {
    if (!newTask.title) { toast.error('Task title is required'); return; }
    try {
      await axios.post(`${API}/api/website-projects/projects/${selectedProject}/tasks`, newTask, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task added');
      setIsAddTaskModalOpen(false);
      setNewTask({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium' });
      loadProjectTasks(selectedProject);
    } catch (error) { toast.error('Failed to add task'); }
  };

  const handleStatusChange = async (taskId, field, value) => {
    try {
      await axios.put(`${API}/api/website-projects/pages/${taskId}`, { [field]: value }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadProjectDetail(selectedProject);
      if (selectedPage?.task_id === taskId) {
        setSelectedPage(prev => ({ ...prev, [field]: value }));
      }
    } catch (error) { toast.error('Failed to update'); }
  };

  const handleTaskStatusChange = async (taskId, status) => {
    try {
      await axios.put(`${API}/api/website-projects/tasks/${taskId}`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadProjectTasks(selectedProject);
    } catch (error) { toast.error('Failed to update task'); }
  };

  const handleDeletePage = async (taskId) => {
    if (!window.confirm('Delete this page?')) return;
    try {
      await axios.delete(`${API}/api/website-projects/pages/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Page deleted');
      loadProjectDetail(selectedProject);
    } catch (error) { toast.error('Failed to delete page'); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await axios.delete(`${API}/api/website-projects/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task deleted');
      loadProjectTasks(selectedProject);
    } catch (error) { toast.error('Failed to delete task'); }
  };

  // Subtask handlers
  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    try {
      await axios.post(`${API}/api/website-projects/pages/${selectedPage.task_id}/subtasks`, 
        { title: newSubtask }, { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewSubtask('');
      loadPageSubtasks(selectedPage.task_id);
    } catch (error) { toast.error('Failed to add subtask'); }
  };

  const handleToggleSubtask = async (subtask) => {
    try {
      await axios.put(`${API}/api/website-projects/subtasks/${subtask.subtask_id}`, 
        { completed: !subtask.completed }, { headers: { Authorization: `Bearer ${token}` } }
      );
      loadPageSubtasks(selectedPage.task_id);
    } catch (error) { toast.error('Failed to update subtask'); }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    try {
      await axios.delete(`${API}/api/website-projects/subtasks/${subtaskId}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadPageSubtasks(selectedPage.task_id);
    } catch (error) { toast.error('Failed to delete subtask'); }
  };

  // Screenshot handlers
  const handleAddScreenshot = async () => {
    if (!newScreenshotUrl.trim()) return;
    try {
      await axios.post(`${API}/api/website-projects/pages/${selectedPage.task_id}/screenshots`, 
        { url: newScreenshotUrl }, { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewScreenshotUrl('');
      loadPageScreenshots(selectedPage.task_id);
    } catch (error) { toast.error('Failed to add screenshot'); }
  };

  const handleDeleteScreenshot = async (screenshotId) => {
    try {
      await axios.delete(`${API}/api/website-projects/screenshots/${screenshotId}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadPageScreenshots(selectedPage.task_id);
    } catch (error) { toast.error('Failed to delete screenshot'); }
  };

  // Section handlers
  const handleAddSection = async () => {
    if (!newSection.name) { toast.error('Section name is required'); return; }
    try {
      await axios.post(`${API}/api/website-projects/pages/${selectedPage.task_id}/sections`, newSection, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Section added');
      setNewSection({ name: '', description: '', screenshot_url: '' });
      loadPageSections(selectedPage.task_id);
    } catch (error) { toast.error('Failed to add section'); }
  };

  const handleUpdateSection = async (sectionId, updates) => {
    try {
      await axios.put(`${API}/api/website-projects/sections/${sectionId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadPageSections(selectedPage.task_id);
      if (selectedSection?.section_id === sectionId) {
        setSelectedSection(prev => ({ ...prev, ...updates }));
      }
    } catch (error) { toast.error('Failed to update section'); }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!window.confirm('Delete this section?')) return;
    try {
      await axios.delete(`${API}/api/website-projects/sections/${sectionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Section deleted');
      loadPageSections(selectedPage.task_id);
      if (selectedSection?.section_id === sectionId) {
        setIsSectionSidebarOpen(false);
        setSelectedSection(null);
      }
    } catch (error) { toast.error('Failed to delete section'); }
  };

  // Feedback handlers
  const handleAddFeedback = async () => {
    if (!newFeedback.content) return;
    try {
      await axios.post(`${API}/api/website-projects/sections/${selectedSection.section_id}/feedback`, newFeedback, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewFeedback({ content: '', feedback_type: 'comment' });
      loadSectionFeedback(selectedSection.section_id);
    } catch (error) { toast.error('Failed to add feedback'); }
  };

  const handleResolveFeedback = async (feedbackId) => {
    try {
      await axios.put(`${API}/api/website-projects/feedback/${feedbackId}?status=resolved`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadSectionFeedback(selectedSection.section_id);
    } catch (error) { toast.error('Failed to resolve feedback'); }
  };

  // Filter handlers
  const filteredPages = projectDetail?.tasks?.filter(task => {
    const matchesSearch = task.page_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.overall_status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const filteredTasks = projectTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredProjectsSummary = allProjectsSummary.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (developerFilter === 'all' || developerFilter === '' || p.developer === developerFilter)
  );

  if (loading) {
    return (
      <Layout>
        <div className={`flex items-center justify-center h-full ${textPrimary}`}>Loading...</div>
      </Layout>
    );
  }

  // ==================== ALL PROJECTS VIEW ====================
  if (currentView === 'all-projects') {
    return (
      <Layout>
        <div className="flex flex-col h-full" data-testid="website-projects-page">
          {/* Header */}
          <div className={`p-4 border-b ${borderColor}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="h-6 w-6 text-[#6366f1]" />
                <h1 className={`text-xl font-bold ${textPrimary}`}>All Website Projects</h1>
                <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{allProjectsSummary.length} Projects</Badge>
              </div>
              <Button onClick={() => setIsCreateModalOpen(true)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="create-project-btn">
                <Plus className="h-4 w-4 mr-2" /> New Project
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className={`p-4 border-b ${borderColor} flex flex-wrap items-center gap-4`}>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search projects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`pl-10 ${bgSecondary} border-none`} />
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <Input type="date" value={dueDateFilter} onChange={(e) => setDueDateFilter(e.target.value)} className={`w-40 ${bgSecondary} border-none`} placeholder="Due Date" />
              {dueDateFilter && (
                <Button variant="ghost" size="sm" onClick={() => setDueDateFilter('')} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select value={developerFilter} onValueChange={setDeveloperFilter}>
              <SelectTrigger className={`w-48 ${bgSecondary} border-none`}>
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Developers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Developers</SelectItem>
                {teamMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Projects List */}
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className={`${bgSecondary} sticky top-0 z-10`}>
                  <tr className={`text-xs ${textSecondary} uppercase`}>
                    <th className="px-4 py-3 text-left font-semibold">Project</th>
                    <th className="px-4 py-3 text-center font-semibold">Dev %</th>
                    <th className="px-4 py-3 text-center font-semibold">Overall %</th>
                    <th className="px-4 py-3 text-center font-semibold">Developer</th>
                    <th className="px-4 py-3 text-center font-semibold">Onboarding</th>
                    <th className="px-4 py-3 text-center font-semibold">Deadline</th>
                    <th className="px-4 py-3 text-center font-semibold">Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjectsSummary.map(project => (
                    <tr key={project.project_id} onClick={() => openProject(project.project_id)} 
                        className={`border-b ${borderColor} hover:${bgSecondary} transition-colors cursor-pointer`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Globe className="h-5 w-5 text-[#6366f1]" />
                          <div>
                            <p className={`font-medium ${textPrimary}`}>{project.name}</p>
                            <p className={`text-xs ${textSecondary}`}>{project.domain_url || project.platform}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Progress value={project.dev_percent} className="w-16 h-2" />
                          <span className={`text-sm font-medium ${textPrimary}`}>{project.dev_percent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={project.overall_percent >= 80 ? 'bg-green-500/20 text-green-400' : project.overall_percent >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}>
                          {project.overall_percent}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm ${textSecondary}`}>{project.developer || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm ${textSecondary}`}>{project.onboarding_date || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-medium ${project.deadline && new Date(project.deadline) < new Date() ? 'text-red-400' : textPrimary}`}>
                          {project.deadline || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline">{project.total_pages}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cross-Project Tasks Panel */}
            {(dueDateFilter || (developerFilter && developerFilter !== 'all')) && (
              <div className={`w-80 border-l ${borderColor} ${bgCard} flex flex-col`}>
                <div className={`p-3 border-b ${borderColor}`}>
                  <h3 className={`text-sm font-semibold ${textPrimary}`}>
                    Tasks {dueDateFilter && `due ${dueDateFilter}`}
                  </h3>
                  <p className={`text-xs ${textSecondary}`}>{crossProjectTasks.length} tasks found</p>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-2">
                  {crossProjectTasks.map((task, idx) => (
                    <div key={idx} className={`p-3 rounded-lg ${bgSecondary}`}>
                      <p className={`text-sm font-medium ${textPrimary}`}>{task.title}</p>
                      <p className={`text-xs ${textSecondary}`}>{task.project_name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={`text-xs ${STATUS_COLORS[task.status]}`}>{task.status}</Badge>
                        {task.due_date && <span className="text-xs text-gray-400">{task.due_date}</span>}
                      </div>
                    </div>
                  ))}
                  {crossProjectTasks.length === 0 && (
                    <p className={`text-sm ${textSecondary} text-center py-4`}>No tasks match filters</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <ProjectModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Website Project" project={newProject} setProject={setNewProject} onSubmit={handleCreateProject} options={options} teamMembers={teamMembers} isDark={isDark} />
        </div>
      </Layout>
    );
  }

  // ==================== PROJECT DETAIL VIEW ====================
  if (currentView === 'project-detail' && projectDetail) {
    return (
      <Layout>
        <div className="flex flex-col h-full" data-testid="project-detail-view">
          {/* Header */}
          <div className={`p-4 border-b ${borderColor}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={goBackToAllProjects} className={textSecondary}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> All Projects
                </Button>
                <h1 className={`text-xl font-bold ${textPrimary}`}>{projectDetail.name}</h1>
                <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{projectDetail.stats?.total_pages || 0} Pages</Badge>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { setNewProject(projectDetail); setIsEditProjectModalOpen(true); }}>
                      <Edit2 className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeleteProject} className="text-red-400 border-red-400/30">
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Project Header - Collapsible */}
          <div className={`border-b ${borderColor} ${bgCard}`}>
            <div className={`flex items-center justify-between p-4 cursor-pointer`} onClick={() => setExpandedHeader(!expandedHeader)}>
              <div className="flex items-center gap-4">
                <Progress value={projectDetail.stats?.overall_completed / projectDetail.stats?.total_pages * 100 || 0} className="w-32 h-2" />
                <span className={`text-sm ${textSecondary}`}>{projectDetail.stats?.overall_completed || 0}/{projectDetail.stats?.total_pages || 0} Completed</span>
              </div>
              {expandedHeader ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>

            {expandedHeader && (
              <>
                {/* Row 1: Basic Info */}
                <div className={`px-4 pb-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3`}>
                  <MetadataCard icon={Globe} label="Domain" value={projectDetail.domain_url} link isDark={isDark} />
                  <MetadataCard icon={User} label="Developer" value={projectDetail.developer} isDark={isDark} />
                  <MetadataCard icon={Calendar} label="Onboarding" value={projectDetail.onboarding_date} isDark={isDark} />
                  <MetadataCard icon={Clock} label="Deadline" value={projectDetail.deadline} isDark={isDark} />
                  <MetadataCard icon={Server} label="Platform" value={projectDetail.platform} isDark={isDark} />
                  <MetadataCard icon={Code} label="Type" value={projectDetail.website_type} isDark={isDark} />
                </div>

                {/* Row 2: Client & Links */}
                <div className={`px-4 pb-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3`}>
                  <MetadataCard icon={User} label="Client" value={projectDetail.client_name} isDark={isDark} />
                  <MetadataCard icon={Globe} label="Location" value={projectDetail.client_location} isDark={isDark} />
                  <MetadataCard icon={Folder} label="Client Drive" value={projectDetail.client_drive_url} link isDark={isDark} />
                  <MetadataCard icon={FileText} label="Documents" value={projectDetail.documents_url} link onClick={() => projectDetail.documents_url && setDocPopupUrl(projectDetail.documents_url)} isDark={isDark} />
                  <MetadataCard icon={Server} label="Server" value={projectDetail.server_details} isDark={isDark} />
                </div>

                {/* Phase Stats */}
                <div className={`px-4 pb-4 grid grid-cols-4 gap-2`}>
                  <PhaseStatCard label="Wireframe" completed={projectDetail.stats?.wireframe?.completed || 0} total={projectDetail.stats?.total_pages} color="#6366f1" isDark={isDark} />
                  <PhaseStatCard label="UI Design" completed={projectDetail.stats?.ui?.completed || 0} total={projectDetail.stats?.total_pages} color="#8b5cf6" isDark={isDark} />
                  <PhaseStatCard label="Content" completed={projectDetail.stats?.content?.completed || 0} total={projectDetail.stats?.total_pages} color="#10b981" isDark={isDark} />
                  <PhaseStatCard label="Development" completed={projectDetail.stats?.dev?.completed || 0} total={projectDetail.stats?.total_pages} color="#f59e0b" isDark={isDark} />
                </div>
              </>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className={`border-b ${borderColor} px-4 pt-2 flex items-center justify-between`}>
              <TabsList className={bgSecondary}>
                <TabsTrigger value="pages"><LayoutGrid className="h-4 w-4 mr-1" /> Pages</TabsTrigger>
                <TabsTrigger value="tasks"><ListTodo className="h-4 w-4 mr-1" /> Tasks <Badge className="ml-1 bg-[#6366f1]/20 text-[#6366f1]">{projectTasks.length}</Badge></TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-48 ${bgSecondary} border-none`} />
                {activeTab === 'pages' && <Button onClick={() => setIsAddPageModalOpen(true)} size="sm" className="bg-[#6366f1]"><Plus className="h-4 w-4 mr-1" /> Add Page</Button>}
                {activeTab === 'tasks' && <Button onClick={() => setIsAddTaskModalOpen(true)} size="sm" className="bg-[#6366f1]"><Plus className="h-4 w-4 mr-1" /> Add Task</Button>}
              </div>
            </div>

            <TabsContent value="pages" className="flex-1 overflow-auto m-0">
              <table className="w-full">
                <thead className={`${bgSecondary} sticky top-0 z-10`}>
                  <tr className={`text-xs ${textSecondary} uppercase`}>
                    <th className="px-4 py-3 text-left font-semibold w-8">#</th>
                    <th className="px-4 py-3 text-left font-semibold min-w-[150px]">Page Name</th>
                    <th className="px-2 py-3 text-center font-semibold min-w-[130px]">
                      <div>Wireframe</div>
                      <div className="text-[10px] font-normal opacity-60">Status / URL / Due</div>
                    </th>
                    <th className="px-2 py-3 text-center font-semibold min-w-[130px]">
                      <div>UI Design</div>
                      <div className="text-[10px] font-normal opacity-60">Status / URL / Due</div>
                    </th>
                    <th className="px-2 py-3 text-center font-semibold min-w-[130px]">
                      <div>Content</div>
                      <div className="text-[10px] font-normal opacity-60">Status / URL / Due</div>
                    </th>
                    <th className="px-2 py-3 text-center font-semibold min-w-[130px]">
                      <div>Development</div>
                      <div className="text-[10px] font-normal opacity-60">Status / URL / Due</div>
                    </th>
                    <th className="px-4 py-3 text-center font-semibold w-24">Overall</th>
                    <th className="px-4 py-3 text-center font-semibold w-16">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPages.map((task, idx) => (
                    <tr key={task.task_id} className={`border-b ${borderColor} hover:${bgSecondary} transition-colors cursor-pointer`} onClick={() => openPage(task)}>
                      <td className={`px-4 py-2 text-sm ${textSecondary}`}>{task.sno}</td>
                      <td className={`px-4 py-2`}><span className={`text-sm font-medium ${textPrimary} hover:text-[#6366f1]`}>{task.page_name}</span></td>
                      <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                        <PhaseTableCell task={task} phase="wireframe" onUpdate={handleStatusChange} teamMembers={teamMembers} isDark={isDark} />
                      </td>
                      <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                        <PhaseTableCell task={task} phase="ui" onUpdate={handleStatusChange} teamMembers={teamMembers} isDark={isDark} />
                      </td>
                      <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                        <PhaseTableCell task={task} phase="content" onUpdate={handleStatusChange} teamMembers={teamMembers} isDark={isDark} />
                      </td>
                      <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                        <PhaseTableCell task={task} phase="dev" onUpdate={handleStatusChange} teamMembers={teamMembers} isDark={isDark} />
                      </td>
                      <td className="px-2 py-2" onClick={e => e.stopPropagation()}><StatusBadge status={task.overall_status} onChange={(v) => handleStatusChange(task.task_id, 'overall_status', v)} /></td>
                      <td className="px-4 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePage(task.task_id)} className="text-red-400 h-7 w-7 p-0"><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabsContent>

            <TabsContent value="tasks" className="flex-1 overflow-auto m-0 p-4">
              <div className="space-y-2">
                {filteredTasks.map(task => (
                  <div key={task.task_id} className={`p-4 rounded-lg border ${borderColor} ${bgCard} flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                      <button onClick={() => handleTaskStatusChange(task.task_id, task.status === 'Completed' ? 'To-Do' : 'Completed')}>
                        {task.status === 'Completed' ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-gray-400" />}
                      </button>
                      <div>
                        <p className={`font-medium ${task.status === 'Completed' ? 'line-through text-gray-500' : textPrimary}`}>{task.title}</p>
                        {task.description && <p className={`text-sm ${textSecondary}`}>{task.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                      {task.due_date && <span className={`text-sm ${textSecondary}`}>{task.due_date}</span>}
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task.task_id)} className="text-red-400 h-7 w-7 p-0"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                {filteredTasks.length === 0 && <p className={`text-center ${textSecondary} py-8`}>No tasks. Click "Add Task" to create one.</p>}
              </div>
            </TabsContent>
          </Tabs>

          <Dialog open={isAddPageModalOpen} onOpenChange={setIsAddPageModalOpen}>
            <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
              <DialogHeader><DialogTitle>Add New Page</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {/* Custom page name */}
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Page Name</label>
                  <Input value={newPage.page_name} onChange={(e) => setNewPage({ ...newPage, page_name: e.target.value })} placeholder="e.g., Gallery Page" className={bgSecondary} />
                </div>
                
                {/* Default pages quick add */}
                <div>
                  <label className={`text-sm ${textSecondary} block mb-2`}>Or add from defaults:</label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_PAGES.map(pageName => (
                      <Button 
                        key={pageName} 
                        variant="outline" 
                        size="sm" 
                        className={`text-xs ${bgSecondary}`}
                        onClick={() => setNewPage({ ...newPage, page_name: pageName })}
                      >
                        {pageName}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsAddPageModalOpen(false)}>Cancel</Button>
                <Button onClick={handleAddPage} className="bg-[#6366f1]">Add Page</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Document Popup */}
          <Dialog open={!!docPopupUrl} onOpenChange={() => setDocPopupUrl(null)}>
            <DialogContent className={`${bgCard} ${textPrimary} max-w-5xl h-[80vh]`}>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Website Documents</span>
                  <Button variant="ghost" size="sm" onClick={() => window.open(docPopupUrl, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-1" /> Open in New Tab
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 h-full min-h-[60vh]">
                <iframe 
                  src={docPopupUrl} 
                  className="w-full h-full rounded-lg border"
                  title="Website Documents"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddTaskModalOpen} onOpenChange={setIsAddTaskModalOpen}>
            <DialogContent className={`${bgCard} ${textPrimary}`}>
              <DialogHeader><DialogTitle>Add New Task</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} placeholder="Task title" className={bgSecondary} />
                <Textarea value={newTask.description} onChange={(e) => setNewTask({...newTask, description: e.target.value})} placeholder="Description" className={bgSecondary} />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={newTask.assigned_to} onValueChange={(v) => setNewTask({...newTask, assigned_to: v})}>
                    <SelectTrigger className={bgSecondary}><SelectValue placeholder="Assign to" /></SelectTrigger>
                    <SelectContent>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask({...newTask, priority: v})}>
                    <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                  </Select>
                </div>
                <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({...newTask, due_date: e.target.value})} className={bgSecondary} />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsAddTaskModalOpen(false)}>Cancel</Button>
                <Button onClick={handleAddTask} className="bg-[#6366f1]">Add Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ProjectModal isOpen={isEditProjectModalOpen} onClose={() => setIsEditProjectModalOpen(false)} title="Edit Project" project={newProject} setProject={setNewProject} onSubmit={handleUpdateProject} options={options} teamMembers={teamMembers} isDark={isDark} isEdit />
        </div>
      </Layout>
    );
  }

  // ==================== PAGE DETAIL VIEW (Google Docs-like) ====================
  if (currentView === 'page-detail' && selectedPage) {
    return (
      <Layout>
        <div className="flex h-full" data-testid="page-detail-view">
          {/* Main Content Area */}
          <div className={`flex-1 flex flex-col overflow-hidden ${isSectionSidebarOpen ? 'mr-96' : ''}`}>
            {/* Header */}
            <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={goBackToProject} className={textSecondary}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> {projectDetail?.name}
                </Button>
                <h1 className={`text-xl font-bold ${textPrimary}`}>{selectedPage.page_name}</h1>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedPage.overall_status} onChange={(v) => handleStatusChange(selectedPage.task_id, 'overall_status', v)} />
              </div>
            </div>

            {/* Phase Status Bar */}
            <div className={`p-4 border-b ${borderColor} ${bgSecondary}`}>
              <div className="grid grid-cols-4 gap-4">
                {['wireframe', 'ui', 'content', 'dev'].map(phase => (
                  <PhaseCard 
                    key={phase}
                    phase={phase}
                    page={selectedPage}
                    teamMembers={teamMembers}
                    onUpdate={(field, value) => handleStatusChange(selectedPage.task_id, field, value)}
                    isDark={isDark}
                  />
                ))}
              </div>
            </div>

            {/* Page Content - Google Docs Style */}
            <div className="flex-1 overflow-auto p-6">
              <div className={`max-w-4xl mx-auto space-y-6`}>
                {/* Screenshots Section */}
                <div className={`p-4 rounded-lg border ${borderColor} ${bgCard}`}>
                  <h3 className={`text-sm font-semibold ${textSecondary} mb-3 flex items-center gap-2`}>
                    <Image className="h-4 w-4" /> Screenshots
                  </h3>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {pageScreenshots.map(ss => (
                      <div key={ss.screenshot_id} className="relative group">
                        <img src={ss.url} alt="Screenshot" className="h-32 w-auto rounded-lg border border-gray-700" />
                        <button onClick={() => handleDeleteScreenshot(ss.screenshot_id)} className="absolute top-1 right-1 bg-red-500/80 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newScreenshotUrl} onChange={(e) => setNewScreenshotUrl(e.target.value)} placeholder="Paste screenshot URL..." className={`flex-1 ${bgSecondary}`} />
                    <Button onClick={handleAddScreenshot} size="sm" className="bg-[#6366f1]"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>

                {/* Sub-tasks Section (Notion-like) */}
                <div className={`p-4 rounded-lg border ${borderColor} ${bgCard}`}>
                  <h3 className={`text-sm font-semibold ${textSecondary} mb-3 flex items-center gap-2`}>
                    <ListTodo className="h-4 w-4" /> Tasks / Notes
                  </h3>
                  <div className="space-y-2 mb-3">
                    {pageSubtasks.map(st => (
                      <div key={st.subtask_id} className={`flex items-center gap-3 p-2 rounded ${bgSecondary}`}>
                        <Checkbox checked={st.completed} onCheckedChange={() => handleToggleSubtask(st)} />
                        <span className={`flex-1 text-sm ${st.completed ? 'line-through text-gray-500' : textPrimary}`}>{st.title}</span>
                        <span className={`text-xs ${textSecondary}`}>{new Date(st.created_at).toLocaleDateString()}</span>
                        <button onClick={() => handleDeleteSubtask(st.subtask_id)} className="text-red-400 hover:text-red-300">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddSubtask()} placeholder="Add a task or note..." className={`flex-1 ${bgSecondary}`} />
                    <Button onClick={handleAddSubtask} size="sm" className="bg-[#6366f1]"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>

                {/* Sections */}
                <div className={`p-4 rounded-lg border ${borderColor} ${bgCard}`}>
                  <h3 className={`text-sm font-semibold ${textSecondary} mb-3 flex items-center gap-2`}>
                    <Box className="h-4 w-4" /> Sections
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                    {pageSections.map(sec => (
                      <div key={sec.section_id} onClick={() => { setSelectedSection(sec); setIsSectionSidebarOpen(true); }}
                           className={`p-3 rounded-lg ${bgSecondary} cursor-pointer hover:ring-2 hover:ring-[#6366f1] transition-all`}>
                        {sec.screenshot_url && <img src={sec.screenshot_url} alt={sec.name} className="w-full h-20 object-cover rounded mb-2" />}
                        <p className={`font-medium ${textPrimary}`}>{sec.name}</p>
                        <div className="flex gap-1 mt-2">
                          <Badge className={`text-[10px] ${STATUS_COLORS[sec.wireframe_status]}`}>WF</Badge>
                          <Badge className={`text-[10px] ${STATUS_COLORS[sec.ui_status]}`}>UI</Badge>
                          <Badge className={`text-[10px] ${STATUS_COLORS[sec.content_status]}`}>CT</Badge>
                          <Badge className={`text-[10px] ${STATUS_COLORS[sec.dev_status]}`}>DV</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newSection.name} onChange={(e) => setNewSection({...newSection, name: e.target.value})} placeholder="Section name (e.g., Hero Section)" className={`flex-1 ${bgSecondary}`} />
                    <Input value={newSection.screenshot_url} onChange={(e) => setNewSection({...newSection, screenshot_url: e.target.value})} placeholder="Screenshot URL (optional)" className={`flex-1 ${bgSecondary}`} />
                    <Button onClick={handleAddSection} size="sm" className="bg-[#6366f1]"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section Sidebar */}
          {isSectionSidebarOpen && selectedSection && (
            <div className={`fixed right-0 top-0 h-full w-96 ${bgCard} border-l ${borderColor} shadow-xl z-50 flex flex-col`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-bold ${textPrimary}`}>{selectedSection.name}</h3>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteSection(selectedSection.section_id)} className="text-red-400"><Trash2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsSectionSidebarOpen(false)}><X className="h-4 w-4" /></Button>
                </div>
              </div>

              {selectedSection.screenshot_url && <img src={selectedSection.screenshot_url} alt={selectedSection.name} className="w-full h-32 object-cover" />}

              <Tabs value={sectionActiveTab} onValueChange={setSectionActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className={`${bgSecondary} m-2`}>
                  <TabsTrigger value="wireframe"><FileEdit className="h-3 w-3 mr-1" /> WF</TabsTrigger>
                  <TabsTrigger value="ui"><Palette className="h-3 w-3 mr-1" /> UI</TabsTrigger>
                  <TabsTrigger value="dev"><Code className="h-3 w-3 mr-1" /> Dev</TabsTrigger>
                  <TabsTrigger value="content"><FileText className="h-3 w-3 mr-1" /> Content</TabsTrigger>
                </TabsList>

                {['wireframe', 'ui', 'dev', 'content'].map(phase => (
                  <TabsContent key={phase} value={phase} className="flex-1 overflow-auto p-4 space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className={`text-xs ${textSecondary}`}>Status</label>
                        <Select value={selectedSection[`${phase}_status`] || 'To-Do'} onValueChange={(v) => handleUpdateSection(selectedSection.section_id, { [`${phase}_status`]: v })}>
                          <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className={`text-xs ${textSecondary}`}>Assignee</label>
                        <Select value={selectedSection[`${phase}_assignee`] || ''} onValueChange={(v) => handleUpdateSection(selectedSection.section_id, { [`${phase}_assignee`]: v })}>
                          <SelectTrigger className={bgSecondary}><SelectValue placeholder="Assign" /></SelectTrigger>
                          <SelectContent><SelectItem value="none">Unassigned</SelectItem>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className={`text-xs ${textSecondary}`}>Due Date</label>
                        <Input type="date" value={selectedSection[`${phase}_due`] || ''} onChange={(e) => handleUpdateSection(selectedSection.section_id, { [`${phase}_due`]: e.target.value })} className={bgSecondary} />
                      </div>
                      <div>
                        <label className={`text-xs ${textSecondary}`}>URL (Figma/Link)</label>
                        <Input placeholder="Paste URL" defaultValue={selectedSection[`${phase}_url`] || ''} onBlur={(e) => handleUpdateSection(selectedSection.section_id, { [`${phase}_url`]: e.target.value })} className={bgSecondary} />
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              {/* Feedback */}
              <div className={`border-t ${borderColor} p-4`}>
                <h4 className={`text-sm font-semibold ${textSecondary} mb-2`}>Client Feedback</h4>
                <div className="space-y-2 max-h-32 overflow-auto mb-2">
                  {sectionFeedback.map(fb => (
                    <div key={fb.feedback_id} className={`p-2 rounded ${bgSecondary} text-sm`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${textPrimary}`}>{fb.created_by_name}</span>
                        {fb.status === 'open' ? (
                          <Button variant="ghost" size="sm" onClick={() => handleResolveFeedback(fb.feedback_id)} className="h-6 text-xs text-green-400"><Check className="h-3 w-3 mr-1" /> Resolve</Button>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-400 text-xs">Resolved</Badge>
                        )}
                      </div>
                      <p className={textSecondary}>{fb.content}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add feedback..." value={newFeedback.content} onChange={(e) => setNewFeedback({...newFeedback, content: e.target.value})} className={`flex-1 ${bgSecondary}`} />
                  <Button onClick={handleAddFeedback} size="sm" className="bg-[#6366f1]"><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  return <Layout><div className={`p-8 ${textPrimary}`}>Loading...</div></Layout>;
};

// ==================== HELPER COMPONENTS ====================

const MetadataCard = ({ icon: Icon, label, value, link, isDark }) => {
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  
  return (
    <div className={`p-3 rounded-lg ${bgSecondary}`}>
      <div className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}><Icon className="h-3 w-3" /> {label}</div>
      {link && value ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-[#6366f1] hover:underline truncate block">{value} <ExternalLink className="inline h-3 w-3" /></a>
      ) : (
        <p className={`text-sm ${textPrimary} truncate`}>{value || 'Not set'}</p>
      )}
    </div>
  );
};

const PhaseStatCard = ({ label, completed, total, color, isDark }) => {
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  
  return (
    <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
      <p className={`text-xs ${textSecondary}`}>{label}</p>
      <p className="text-sm font-bold" style={{ color }}>{completed}/{total}</p>
    </div>
  );
};

const PhaseCard = ({ phase, page, teamMembers, onUpdate, isDark }) => {
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-300';
  
  const phaseLabels = { wireframe: 'Wireframe', ui: 'UI Design', content: 'Content', dev: 'Development' };
  const phaseIcons = { wireframe: FileEdit, ui: Palette, content: FileText, dev: Code };
  const Icon = phaseIcons[phase];
  
  return (
    <div className={`p-3 rounded-lg ${bgCard} border ${borderColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-[#6366f1]" />
        <span className={`text-sm font-medium ${textPrimary}`}>{phaseLabels[phase]}</span>
      </div>
      <div className="space-y-2">
        <Select value={page[`${phase}_status`] || 'To-Do'} onValueChange={(v) => onUpdate(`${phase}_status`, v)}>
          <SelectTrigger className={`h-7 text-xs ${STATUS_COLORS[page[`${phase}_status`] || 'To-Do']}`}><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={page[`${phase}_assignee`] || ''} onValueChange={(v) => onUpdate(`${phase}_assignee`, v)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent><SelectItem value="none">Unassigned</SelectItem>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={page[`${phase}_due`] || ''} onChange={(e) => onUpdate(`${phase}_due`, e.target.value)} className="h-7 text-xs" placeholder="Due" />
      </div>
    </div>
  );
};

const StatusBadge = ({ status, onChange }) => (
  <Select value={status || 'To-Do'} onValueChange={onChange}>
    <SelectTrigger className={`h-7 text-xs ${STATUS_COLORS[status || 'To-Do']} border w-full`}><SelectValue /></SelectTrigger>
    <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
  </Select>
);

// Phase Table Cell - All fields editable: Status, Assignee, Due Date, URL
const PhaseTableCell = ({ task, phase, onUpdate, teamMembers, isDark }) => {
  const status = task[`${phase}_status`] || 'To-Do';
  const assignee = task[`${phase}_assignee`] || 'none';
  const dueDate = task[`${phase}_due`] || '';
  const url = task[`${phase}_url`] || '';
  
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  return (
    <div className={`p-1.5 rounded ${bgSecondary} space-y-1`}>
      {/* Status Dropdown */}
      <Select value={status} onValueChange={(v) => onUpdate(task.task_id, `${phase}_status`, v)}>
        <SelectTrigger className={`h-6 text-[10px] ${STATUS_COLORS[status]} border w-full`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Assignee Dropdown */}
      <Select value={assignee} onValueChange={(v) => onUpdate(task.task_id, `${phase}_assignee`, v === 'none' ? '' : v)}>
        <SelectTrigger className="h-6 text-[10px] w-full">
          <User className="h-3 w-3 mr-1 opacity-50" />
          <SelectValue placeholder="Assign" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Unassigned</SelectItem>
          {teamMembers?.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Due Date */}
      <Input
        type="date"
        value={dueDate}
        onChange={(e) => onUpdate(task.task_id, `${phase}_due`, e.target.value)}
        className="h-6 text-[10px] w-full"
      />

      {/* URL */}
      {url ? (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[10px] text-[#6366f1] hover:underline flex items-center justify-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Link2 className="h-3 w-3" /> View URL
        </a>
      ) : (
        <Input
          placeholder="+ Add URL"
          onBlur={(e) => e.target.value && onUpdate(task.task_id, `${phase}_url`, e.target.value)}
          className={`h-6 text-[10px] w-full text-center ${textSecondary}`}
        />
      )}
    </div>
  );
};

const ProjectModal = ({ isOpen, onClose, title, project, setProject, onSubmit, options, teamMembers, isDark, isEdit }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [showPassword, setShowPassword] = useState({});
  
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';

  const PLATFORMS = options?.platforms || ['Website', 'Shopify', 'WordPress', 'Wix', 'Webflow', 'Custom', 'React', 'Next.js'];
  const WEBSITE_TYPES = options?.website_types || ['Business Website', 'E-commerce', 'Portfolio', 'Landing Page', 'Blog', 'SaaS', 'Corporate', 'Educational'];
  const PROJECT_STATUS = ['active', 'completed', 'on-hold', 'cancelled'];

  const togglePassword = (field) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${bgCard} ${textPrimary} max-w-4xl max-h-[85vh] overflow-y-auto`}>
        <DialogHeader><DialogTitle className="text-xl">{title}</DialogTitle></DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="client">Client</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
          </TabsList>

          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Project Name *</label>
                <Input value={project.name} onChange={(e) => setProject({...project, name: e.target.value})} placeholder="Client/Project Name" className={bgSecondary} />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Status</label>
                <Select value={project.status || 'active'} onValueChange={(v) => setProject({...project, status: v})}>
                  <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Onboarding Date</label>
                <Input type="date" value={project.onboarding_date} onChange={(e) => setProject({...project, onboarding_date: e.target.value})} className={bgSecondary} />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Project Deadline</label>
                <Input type="date" value={project.deadline} onChange={(e) => setProject({...project, deadline: e.target.value})} className={bgSecondary} />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Platform</label>
                <Select value={project.platform} onValueChange={(v) => setProject({...project, platform: v})}>
                  <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Website Type</label>
                <Select value={project.website_type} onValueChange={(v) => setProject({...project, website_type: v})}>
                  <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                  <SelectContent>{WEBSITE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className={`text-sm ${textSecondary} block mb-1`}>Product Details</label>
                <Textarea value={project.product_details} onChange={(e) => setProject({...project, product_details: e.target.value})} placeholder="Describe the product/service details..." className={bgSecondary} rows={3} />
              </div>
              <div className="col-span-2">
                <label className={`text-sm ${textSecondary} block mb-1`}>Onboarding Form Notes</label>
                <Textarea value={project.onboarding_form} onChange={(e) => setProject({...project, onboarding_form: e.target.value})} placeholder="Notes from client onboarding..." className={bgSecondary} rows={2} />
              </div>
            </div>
          </TabsContent>

          {/* Client Tab */}
          <TabsContent value="client" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Client Name</label>
                <Input value={project.client_name} onChange={(e) => setProject({...project, client_name: e.target.value})} placeholder="John Doe" className={bgSecondary} />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Location</label>
                <Input value={project.client_location} onChange={(e) => setProject({...project, client_location: e.target.value})} placeholder="Chennai, India" className={bgSecondary} />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Client Email</label>
                <Input type="email" value={project.client_email} onChange={(e) => setProject({...project, client_email: e.target.value})} placeholder="client@example.com" className={bgSecondary} />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Client Phone</label>
                <Input value={project.client_phone} onChange={(e) => setProject({...project, client_phone: e.target.value})} placeholder="+91 98765 43210" className={bgSecondary} />
              </div>
            </div>
          </TabsContent>

          {/* Credentials Tab */}
          <TabsContent value="credentials" className="space-y-4">
            {/* Domain Credentials */}
            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h4 className={`font-semibold mb-3 ${textPrimary}`}>Domain Credentials</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Domain URL</label>
                  <Input value={project.domain_url} onChange={(e) => setProject({...project, domain_url: e.target.value})} placeholder="www.example.com" className={bgSecondary} />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Username</label>
                  <Input value={project.domain_username} onChange={(e) => setProject({...project, domain_username: e.target.value})} placeholder="admin" className={bgSecondary} />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Password</label>
                  <div className="relative">
                    <Input type={showPassword.domain ? 'text' : 'password'} value={project.domain_password} onChange={(e) => setProject({...project, domain_password: e.target.value})} placeholder="••••••••" className={bgSecondary} />
                    <button type="button" onClick={() => togglePassword('domain')} className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${textSecondary}`}>{showPassword.domain ? 'Hide' : 'Show'}</button>
                  </div>
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>2FA / Backup Codes</label>
                  <Input value={project.domain_2fa} onChange={(e) => setProject({...project, domain_2fa: e.target.value})} placeholder="2FA backup codes" className={bgSecondary} />
                </div>
                <div className="col-span-2">
                  <label className={`text-sm ${textSecondary} block mb-1`}>Domain Email DNS</label>
                  <Input value={project.domain_email_dns} onChange={(e) => setProject({...project, domain_email_dns: e.target.value})} placeholder="DNS records for email configuration" className={bgSecondary} />
                </div>
              </div>
            </div>

            {/* Server Credentials */}
            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h4 className={`font-semibold mb-3 ${textPrimary}`}>Server Credentials</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={`text-sm ${textSecondary} block mb-1`}>Server Details</label>
                  <Input value={project.server_details} onChange={(e) => setProject({...project, server_details: e.target.value})} placeholder="Hosting provider, server IP, etc." className={bgSecondary} />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Username</label>
                  <Input value={project.server_username} onChange={(e) => setProject({...project, server_username: e.target.value})} placeholder="Server username" className={bgSecondary} />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Password</label>
                  <div className="relative">
                    <Input type={showPassword.server ? 'text' : 'password'} value={project.server_password} onChange={(e) => setProject({...project, server_password: e.target.value})} placeholder="••••••••" className={bgSecondary} />
                    <button type="button" onClick={() => togglePassword('server')} className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${textSecondary}`}>{showPassword.server ? 'Hide' : 'Show'}</button>
                  </div>
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>2FA / Backup Codes</label>
                  <Input value={project.server_2fa} onChange={(e) => setProject({...project, server_2fa: e.target.value})} placeholder="2FA backup codes" className={bgSecondary} />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Developer</label>
                <Select value={project.developer} onValueChange={(v) => setProject({...project, developer: v})}>
                  <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select Developer" /></SelectTrigger>
                  <SelectContent>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Designer</label>
                <Select value={project.designer} onValueChange={(v) => setProject({...project, designer: v})}>
                  <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select Designer" /></SelectTrigger>
                  <SelectContent>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Content Writer</label>
                <Select value={project.content_writer} onValueChange={(v) => setProject({...project, content_writer: v})}>
                  <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select Content Writer" /></SelectTrigger>
                  <SelectContent>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Project Manager</label>
                <Select value={project.project_manager} onValueChange={(v) => setProject({...project, project_manager: v})}>
                  <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select PM" /></SelectTrigger>
                  <SelectContent>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* Links Tab */}
          <TabsContent value="links" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Client Drive URL</label>
                <Input value={project.client_drive_url} onChange={(e) => setProject({...project, client_drive_url: e.target.value})} placeholder="Google Drive / Dropbox link for client assets" className={bgSecondary} />
                <p className={`text-xs ${textSecondary} mt-1`}>Opens in new tab</p>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Website Documents URL</label>
                <Input value={project.documents_url} onChange={(e) => setProject({...project, documents_url: e.target.value})} placeholder="Google Docs link for website content" className={bgSecondary} />
                <p className={`text-xs ${textSecondary} mt-1`}>Opens in popup within app</p>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Communication Link</label>
                <Input value={project.communication_url} onChange={(e) => setProject({...project, communication_url: e.target.value})} placeholder="Slack channel, WhatsApp group, etc." className={bgSecondary} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} className="bg-[#6366f1] hover:bg-[#5855eb]">{isEdit ? 'Update' : 'Create'} Project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WebsiteProjectsPage;
