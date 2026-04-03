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
  Users, CalendarDays, Code, Palette, FileEdit, Box, Mail, PanelLeftClose, PanelLeft
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
  const [phaseFil, setPhaseFil] = useState('all'); // wireframe, ui, content, dev
  const [viewMode, setViewMode] = useState('projects'); // projects, tasks, timeline
  
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
    // WordPress
    wp_username: '',
    wp_password: '',
    wp_backup: '',
    // Email
    email_address: '',
    email_password: '',
    email_2fa: '',
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
    // Calculate task-wise data across all projects
    const allTasks = [];
    allProjectsSummary.forEach(project => {
      (project.pages || []).forEach(page => {
        ['wireframe', 'ui', 'content', 'dev'].forEach(phase => {
          if (page[phase]) {
            allTasks.push({
              project_id: project.project_id,
              project_name: project.name,
              page_id: page.page_id,
              page_name: page.page_name,
              phase,
              status: page[phase].status,
              assignee: page[phase].assignee,
              due_date: page[phase].due_date,
              url: page[phase].url,
              developer: project.developer,
              deadline: project.deadline
            });
          }
        });
      });
    });

    // Filter tasks
    const filteredTasks = allTasks.filter(task => {
      const matchesDev = developerFilter === 'all' || task.assignee === developerFilter || task.developer === developerFilter;
      const matchesDate = !dueDateFilter || task.due_date === dueDateFilter;
      const matchesPhase = phaseFil === 'all' || task.phase === phaseFil;
      const matchesSearch = !searchTerm || task.project_name.toLowerCase().includes(searchTerm.toLowerCase()) || task.page_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesDev && matchesDate && matchesPhase && matchesSearch;
    });

    // Group tasks by project for task view
    const tasksByProject = filteredTasks.reduce((acc, task) => {
      if (!acc[task.project_id]) {
        acc[task.project_id] = { project_name: task.project_name, developer: task.developer, tasks: [] };
      }
      acc[task.project_id].tasks.push(task);
      return acc;
    }, {});

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

          {/* View Mode Toggle & Filters */}
          <div className={`p-4 border-b ${borderColor}`}>
            {/* View Mode Toggle */}
            <div className="flex items-center gap-4 mb-4">
              <div className={`inline-flex rounded-lg p-1 ${bgSecondary}`}>
                <Button 
                  size="sm" 
                  variant={viewMode === 'projects' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('projects')}
                  className={viewMode === 'projects' ? 'bg-[#6366f1]' : ''}
                >
                  <LayoutGrid className="h-4 w-4 mr-1" /> Projects
                </Button>
                <Button 
                  size="sm" 
                  variant={viewMode === 'tasks' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('tasks')}
                  className={viewMode === 'tasks' ? 'bg-[#6366f1]' : ''}
                >
                  <ListTodo className="h-4 w-4 mr-1" /> Task View
                </Button>
              </div>
              {viewMode === 'tasks' && (
                <Badge className="bg-[#22c55e]/20 text-[#22c55e]">{filteredTasks.length} Tasks</Badge>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search projects/pages..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`pl-10 ${bgSecondary} border-none`} />
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-400" />
                <Input 
                  type="date" 
                  value={dueDateFilter} 
                  onChange={(e) => setDueDateFilter(e.target.value)} 
                  className={`w-40 ${bgSecondary} border-none`} 
                  placeholder="Due Date" 
                />
                {dueDateFilter && (
                  <Button variant="ghost" size="sm" onClick={() => setDueDateFilter('')} className="h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Developer Filter */}
              <Select value={developerFilter} onValueChange={setDeveloperFilter}>
                <SelectTrigger className={`w-48 ${bgSecondary} border-none`}>
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Developers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Developers</SelectItem>
                  {teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Phase Filter (for task view) */}
              {viewMode === 'tasks' && (
                <Select value={phaseFil} onValueChange={setPhaseFil}>
                  <SelectTrigger className={`w-40 ${bgSecondary} border-none`}>
                    <SelectValue placeholder="All Phases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Phases</SelectItem>
                    <SelectItem value="wireframe">Wireframe</SelectItem>
                    <SelectItem value="ui">UI Design</SelectItem>
                    <SelectItem value="content">Content</SelectItem>
                    <SelectItem value="dev">Development</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={`w-36 ${bgSecondary} border-none`}>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear All Filters */}
              {(dueDateFilter || developerFilter !== 'all' || phaseFil !== 'all' || statusFilter !== 'all' || searchTerm) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setDueDateFilter('');
                    setDeveloperFilter('all');
                    setPhaseFil('all');
                    setStatusFilter('all');
                    setSearchTerm('');
                  }}
                  className="text-red-400"
                >
                  <X className="h-4 w-4 mr-1" /> Clear Filters
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Projects List View */}
            {viewMode === 'projects' && (
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className={`${bgSecondary} sticky top-0 z-10`}>
                    <tr className={`text-xs ${textSecondary} uppercase`}>
                      <th className="px-4 py-3 text-left font-semibold">Project</th>
                      <th className="px-4 py-3 text-center font-semibold">Status</th>
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
                          <Badge className={`text-xs ${
                            project.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            project.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                            project.status === 'on-hold' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {project.status || 'active'}
                          </Badge>
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
            )}

            {/* Task View */}
            {viewMode === 'tasks' && (
              <div className="flex-1 overflow-auto p-4">
                {Object.keys(tasksByProject).length === 0 ? (
                  <div className={`text-center py-12 ${textSecondary}`}>
                    <ListTodo className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No tasks found with current filters</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(tasksByProject).map(([projectId, projectData]) => (
                      <div key={projectId} className={`rounded-xl border ${borderColor} overflow-hidden`}>
                        {/* Project Header */}
                        <div 
                          className={`p-4 ${bgSecondary} cursor-pointer flex items-center justify-between`}
                          onClick={() => openProject(projectId)}
                        >
                          <div className="flex items-center gap-3">
                            <Globe className="h-5 w-5 text-[#6366f1]" />
                            <div>
                              <p className={`font-semibold ${textPrimary}`}>{projectData.project_name}</p>
                              <p className={`text-xs ${textSecondary}`}>Developer: {projectData.developer || 'Unassigned'}</p>
                            </div>
                          </div>
                          <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{projectData.tasks.length} Tasks</Badge>
                        </div>
                        
                        {/* Tasks Table */}
                        <table className="w-full">
                          <thead className={`text-xs ${textSecondary} uppercase`}>
                            <tr className={`border-b ${borderColor}`}>
                              <th className="px-4 py-2 text-left">Page</th>
                              <th className="px-4 py-2 text-center">Phase</th>
                              <th className="px-4 py-2 text-center">Status</th>
                              <th className="px-4 py-2 text-center">Assignee</th>
                              <th className="px-4 py-2 text-center">Due Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectData.tasks.map((task, idx) => (
                              <tr key={idx} className={`border-b ${borderColor} hover:${bgSecondary}`}>
                                <td className={`px-4 py-2 ${textPrimary}`}>{task.page_name}</td>
                                <td className="px-4 py-2 text-center">
                                  <Badge className={`text-xs ${
                                    task.phase === 'wireframe' ? 'bg-[#6366f1]/20 text-[#6366f1]' :
                                    task.phase === 'ui' ? 'bg-[#8b5cf6]/20 text-[#8b5cf6]' :
                                    task.phase === 'content' ? 'bg-[#10b981]/20 text-[#10b981]' :
                                    'bg-[#f59e0b]/20 text-[#f59e0b]'
                                  }`}>
                                    {task.phase === 'dev' ? 'Development' : task.phase.charAt(0).toUpperCase() + task.phase.slice(1)}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <Badge className={`text-xs ${
                                    task.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                                    task.status === 'In Progress' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {task.status || 'Not Started'}
                                  </Badge>
                                </td>
                                <td className={`px-4 py-2 text-center ${textSecondary}`}>{task.assignee || '-'}</td>
                                <td className={`px-4 py-2 text-center ${task.due_date && new Date(task.due_date) < new Date() ? 'text-red-400 font-medium' : textSecondary}`}>
                                  {task.due_date || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
    // Status color mapping
    const statusColors = {
      'active': { bg: 'bg-[#22c55e]', text: 'text-white' },
      'completed': { bg: 'bg-[#6366f1]', text: 'text-white' },
      'on-hold': { bg: 'bg-[#f59e0b]', text: 'text-white' },
      'cancelled': { bg: 'bg-[#ef4444]', text: 'text-white' },
    };
    const statusStyle = statusColors[projectDetail.status] || statusColors['active'];

    return (
      <Layout>
        <div className="flex flex-col h-full" data-testid="project-detail-view">
          {/* Sticky Header Bar */}
          <div className={`sticky top-0 z-20 border-b ${borderColor} ${bgCard} shadow-sm`}>
            {/* Top Row - Back button, title, actions */}
            <div className={`p-3 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={goBackToAllProjects} className={textSecondary}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <h1 className={`text-lg font-bold ${textPrimary}`}>{projectDetail.name}</h1>
                <Badge className={`${statusStyle.bg} ${statusStyle.text} px-3 py-1 font-semibold`}>
                  {(projectDetail.status || 'Active').toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { setNewProject(projectDetail); setIsEditProjectModalOpen(true); }}>
                      <Edit2 className="h-4 w-4 mr-1" /> Edit
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Links Bar - Docs, Drive, Deadline, Onboarding */}
            <div className={`px-3 pb-3 flex items-center gap-4 flex-wrap`}>
              {/* Documents - Opens Popup */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => projectDetail.documents_url && setDocPopupUrl(projectDetail.documents_url)}
                className={`gap-2 ${projectDetail.documents_url ? 'text-[#6366f1] border-[#6366f1]/30' : `${textSecondary} opacity-50`}`}
                disabled={!projectDetail.documents_url}
              >
                <FileText className="h-4 w-4" />
                Docs
              </Button>

              {/* Drive - Opens Popup */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => projectDetail.client_drive_url && setDocPopupUrl(projectDetail.client_drive_url)}
                className={`gap-2 ${projectDetail.client_drive_url ? 'text-[#22c55e] border-[#22c55e]/30' : `${textSecondary} opacity-50`}`}
                disabled={!projectDetail.client_drive_url}
              >
                <Folder className="h-4 w-4" />
                Drive
              </Button>

              {/* Deadline */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
                <Clock className="h-4 w-4 text-[#f59e0b]" />
                <span className={`text-sm ${textSecondary}`}>Deadline:</span>
                <span className={`text-sm font-medium ${projectDetail.deadline ? textPrimary : 'text-red-400'}`}>
                  {projectDetail.deadline || 'Not Set'}
                </span>
              </div>

              {/* Onboarding */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
                <Calendar className="h-4 w-4 text-[#6366f1]" />
                <span className={`text-sm ${textSecondary}`}>Onboarding:</span>
                <span className={`text-sm font-medium ${textPrimary}`}>
                  {projectDetail.onboarding_date || 'Not Set'}
                </span>
              </div>

              {/* Progress */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
                <Progress value={projectDetail.stats?.overall_completed / projectDetail.stats?.total_pages * 100 || 0} className="w-24 h-2" />
                <span className={`text-sm ${textSecondary}`}>{projectDetail.stats?.overall_completed || 0}/{projectDetail.stats?.total_pages || 0}</span>
              </div>
            </div>
          </div>

          {/* Expandable Details Section */}
          <div className={`border-b ${borderColor} ${bgCard}`}>
            <div className={`flex items-center justify-between px-4 py-2 cursor-pointer`} onClick={() => setExpandedHeader(!expandedHeader)}>
              <span className={`text-sm font-medium ${textSecondary}`}>{expandedHeader ? 'Hide' : 'Show'} Project Details</span>
              {expandedHeader ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>

            {expandedHeader && (
              <>
                {/* Row 1: Basic Info */}
                <div className={`px-4 pb-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3`}>
                  <MetadataCard icon={Globe} label="Domain" value={projectDetail.domain_url} link isDark={isDark} />
                  <MetadataCard icon={User} label="Developer" value={projectDetail.developer} isDark={isDark} />
                  <MetadataCard icon={Server} label="Platform" value={projectDetail.platform} isDark={isDark} />
                  <MetadataCard icon={Code} label="Type" value={projectDetail.website_type} isDark={isDark} />
                  <MetadataCard icon={User} label="Client" value={projectDetail.client_name} isDark={isDark} />
                  <MetadataCard icon={Globe} label="Location" value={projectDetail.client_location} isDark={isDark} />
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

          {/* Tabs - Sticky */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className={`sticky top-0 z-10 border-b ${borderColor} ${bgCard} px-4 pt-2 pb-2 flex items-center justify-between`}>
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
  const [createStep, setCreateStep] = useState(isEdit ? 2 : 1); // Step 1: Type/Platform, Step 2: Full form
  const [showPassword, setShowPassword] = useState({});
  const [showAddTypeInput, setShowAddTypeInput] = useState(false);
  const [newWebsiteType, setNewWebsiteType] = useState('');
  const [customWebsiteTypes, setCustomWebsiteTypes] = useState(() => {
    const saved = localStorage.getItem('custom_website_types');
    return saved ? JSON.parse(saved) : [];
  });
  
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';

  const PLATFORMS = ['WordPress', 'Shopify', 'Wix', 'Webflow', 'Framer', 'AI Builder', 'Custom Code', 'React', 'Next.js'];
  const WEBSITE_TYPES = ['Landing Page', 'Business Website', 'Shopify Store', 'Web App', 'E-commerce', 'Portfolio', 'Blog', 'SaaS', 'Corporate', ...customWebsiteTypes];
  const PROJECT_STATUS = ['active', 'completed', 'on-hold', 'cancelled'];

  // Reset step when modal opens for create
  useEffect(() => {
    if (isOpen && !isEdit) {
      setCreateStep(1);
    }
  }, [isOpen, isEdit]);

  const togglePassword = (field) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const addNewWebsiteType = () => {
    if (newWebsiteType.trim()) {
      const updated = [...customWebsiteTypes, newWebsiteType.trim()];
      setCustomWebsiteTypes(updated);
      localStorage.setItem('custom_website_types', JSON.stringify(updated));
      setProject({ ...project, website_type: newWebsiteType.trim() });
      setNewWebsiteType('');
      setShowAddTypeInput(false);
    }
  };

  const handleNext = () => {
    if (!project.website_type || !project.platform) {
      toast.error('Please select Website Type and Platform');
      return;
    }
    setCreateStep(2);
  };

  // Step 1: Type and Platform Selection
  if (createStep === 1 && !isEdit) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`${bgCard} ${textPrimary} max-w-2xl`}>
          <DialogHeader><DialogTitle className="text-xl">Create Website Project</DialogTitle></DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Website Type Selection */}
            <div>
              <label className={`text-base font-semibold ${textPrimary} block mb-3`}>1. Select Website Type</label>
              <div className="grid grid-cols-3 gap-3">
                {WEBSITE_TYPES.slice(0, 6).map(type => (
                  <button
                    key={type}
                    onClick={() => setProject({ ...project, website_type: type })}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      project.website_type === type
                        ? 'border-[#6366f1] bg-[#6366f1]/10'
                        : `border-transparent ${bgSecondary} hover:border-[#6366f1]/50`
                    }`}
                  >
                    <p className={`font-medium ${textPrimary}`}>{type}</p>
                    <p className={`text-xs ${textSecondary} mt-1`}>
                      {type === 'Landing Page' && 'Single page website'}
                      {type === 'Business Website' && 'Multi-page corporate site'}
                      {type === 'Shopify Store' && 'E-commerce store'}
                      {type === 'Web App' && 'Custom web application'}
                      {type === 'E-commerce' && 'Online store'}
                      {type === 'Portfolio' && 'Showcase work'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform Selection */}
            <div>
              <label className={`text-base font-semibold ${textPrimary} block mb-3`}>2. Select Platform</label>
              <div className="grid grid-cols-4 gap-3">
                {PLATFORMS.slice(0, 8).map(platform => (
                  <button
                    key={platform}
                    onClick={() => setProject({ ...project, platform: platform })}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      project.platform === platform
                        ? 'border-[#6366f1] bg-[#6366f1]/10'
                        : `border-transparent ${bgSecondary} hover:border-[#6366f1]/50`
                    }`}
                  >
                    <p className={`font-medium text-sm ${textPrimary}`}>{platform}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Info */}
            {project.website_type && project.platform && (
              <div className={`p-4 rounded-lg ${isDark ? 'bg-[#6366f1]/10' : 'bg-[#6366f1]/5'} border border-[#6366f1]/30`}>
                <p className={`text-sm ${textSecondary}`}>Creating:</p>
                <p className={`font-semibold ${textPrimary}`}>{project.platform} {project.website_type}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              onClick={handleNext} 
              className="bg-[#6366f1] hover:bg-[#4f46e5]"
              disabled={!project.website_type || !project.platform}
            >
              Next: Project Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${bgCard} ${textPrimary} max-w-4xl max-h-[85vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEdit ? title : 'Create Website Project'}
          </DialogTitle>
          {!isEdit && (
            <p className={`text-sm ${textSecondary}`}>
              {project.platform} • {project.website_type}
              <Button variant="link" size="sm" className="text-[#6366f1] ml-2" onClick={() => setCreateStep(1)}>Change</Button>
            </p>
          )}
        </DialogHeader>
        
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
              {isEdit && (
                <>
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
                </>
              )}
              
              {/* Shopify-specific fields */}
              {project.website_type === 'Shopify Store' && (
                <div className={`col-span-2 p-4 rounded-lg ${bgSecondary}`}>
                  <label className={`text-sm font-semibold ${textPrimary} block mb-3`}>Shopify Store Details</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`text-sm ${textSecondary} block mb-1`}>Store Name</label>
                      <Input value={project.store_name || ''} onChange={(e) => setProject({...project, store_name: e.target.value})} placeholder="My Shopify Store" className={bgCard} />
                    </div>
                    <div>
                      <label className={`text-sm ${textSecondary} block mb-1`}>Product Categories</label>
                      <Input value={project.product_categories || ''} onChange={(e) => setProject({...project, product_categories: e.target.value})} placeholder="Clothing, Electronics..." className={bgCard} />
                    </div>
                  </div>
                </div>
              )}

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
          <TabsContent value="credentials" className="space-y-4 max-h-[50vh] overflow-y-auto">
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

            {/* Website Credentials */}
            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h4 className={`font-semibold mb-3 ${textPrimary} flex items-center gap-2`}>
                <Globe className="w-5 h-5 text-[#6366f1]" />
                Website Credentials
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Username</label>
                  <Input value={project.wp_username} onChange={(e) => setProject({...project, wp_username: e.target.value})} placeholder="admin_user" className={bgSecondary} />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Password</label>
                  <div className="relative">
                    <Input type={showPassword.wp ? 'text' : 'password'} value={project.wp_password} onChange={(e) => setProject({...project, wp_password: e.target.value})} placeholder="••••••••" className={bgSecondary} />
                    <button type="button" onClick={() => togglePassword('wp')} className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${textSecondary}`}>{showPassword.wp ? 'Hide' : 'Show'}</button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className={`text-sm ${textSecondary} block mb-1`}>Backup Codes / Notes</label>
                  <Input value={project.wp_backup} onChange={(e) => setProject({...project, wp_backup: e.target.value})} placeholder="Backup codes or admin notes" className={bgSecondary} />
                </div>
              </div>
            </div>

            {/* Email Credentials */}
            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h4 className={`font-semibold mb-3 ${textPrimary} flex items-center gap-2`}>
                <Mail className="w-5 h-5 text-[#ea4335]" />
                Email Credentials
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Email Address</label>
                  <Input type="email" value={project.email_address} onChange={(e) => setProject({...project, email_address: e.target.value})} placeholder="admin@domain.com" className={bgSecondary} />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Password</label>
                  <div className="relative">
                    <Input type={showPassword.email ? 'text' : 'password'} value={project.email_password} onChange={(e) => setProject({...project, email_password: e.target.value})} placeholder="••••••••" className={bgSecondary} />
                    <button type="button" onClick={() => togglePassword('email')} className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${textSecondary}`}>{showPassword.email ? 'Hide' : 'Show'}</button>
                  </div>
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>2FA / Backup Codes</label>
                  <Input value={project.email_2fa} onChange={(e) => setProject({...project, email_2fa: e.target.value})} placeholder="2FA backup codes" className={bgSecondary} />
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
