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
  Users, CalendarDays, Code, Palette, FileEdit, Box, Mail, PanelLeftClose, PanelLeft,
  Play, Pause, Square, Timer, Eye, RefreshCw, AlertCircle, CheckCircle2,
  Home, FolderKanban, Settings, Menu, ChevronRight, ArrowRight
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
  
  // BDE-style Task States
  const [projectBDETasks, setProjectBDETasks] = useState([]);
  const [taskFilter, setTaskFilter] = useState('all'); // all, pending, in_progress, completed
  const [taskDateFilter, setTaskDateFilter] = useState('all'); // all, today, this_week, this_month
  const [viewingTask, setViewingTask] = useState(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [runningTimers, setRunningTimers] = useState({});
  
  // SOP/Template Management
  const [templates, setTemplates] = useState([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', website_type: '', platform: '', default_pages: [], default_tasks: [] });
  
  // Mobile Responsive States
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileActiveTab, setMobileActiveTab] = useState('projects'); // projects, tasks, filters
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Workflow Stage States
  const [workflowStage, setWorkflowStage] = useState(searchParams.get('stage') || 'all');
  const isProjectManager = user?.role === 'project_manager';
  
  // Content Stage Specific Filters
  const [contentWriterFilter, setContentWriterFilter] = useState('all');
  const [pageAssigneeFilter, setPageAssigneeFilter] = useState('all');
  const [contentDateFilter, setContentDateFilter] = useState('');
  const [contentDayFilter, setContentDayFilter] = useState('all'); // all, today, this_week, overdue
  
  // Workflow Stage Definitions
  const WORKFLOW_STAGES = [
    { id: 'creation', label: 'Project Creation', color: 'bg-yellow-500', description: 'New projects awaiting initial setup' },
    { id: 'discovery', label: 'Discovery Call', color: 'bg-orange-500', description: 'Requirements gathering and planning' },
    { id: 'content', label: 'Content', color: 'bg-blue-500', description: 'Content writing and collection' },
    { id: 'wireframe', label: 'Wireframe', color: 'bg-purple-500', description: 'Wireframe design and client approval' },
    { id: 'ui', label: 'UI Design', color: 'bg-pink-500', description: 'UI design and client approval' },
    { id: 'development', label: 'Development', color: 'bg-green-500', description: 'Development in progress' },
    { id: 'testing', label: 'Testing', color: 'bg-cyan-500', description: 'QA testing and bug fixes' },
    { id: 'delivered', label: 'Delivered', color: 'bg-emerald-500', description: 'Project completed and delivered' }
  ];
  
  // Mobile resize detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Sync workflow stage from URL
  useEffect(() => {
    const stageFromUrl = searchParams.get('stage');
    if (stageFromUrl) {
      setWorkflowStage(stageFromUrl);
      setCurrentView('all-projects');
    }
  }, [searchParams]);
  
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

  // Load BDE-style tasks for website project
  const loadProjectBDETasks = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      const res = await axios.get(`${API}/api/departments/website/projects/${projectId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjectBDETasks(res.data);
    } catch (error) {
      console.error('Error loading BDE tasks:', error);
    }
  }, [token]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/departments/website/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(res.data?.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }, [token]);

  // Format duration helper
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer actions for BDE tasks
  const handleTimerAction = async (taskId, action) => {
    try {
      const res = await axios.put(
        `${API}/api/departments/website/projects/${selectedProject}/tasks/${taskId}`,
        { timer_action: action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update task in state
      setProjectBDETasks(prev => prev.map(t => t.task_id === taskId ? res.data : t));
      
      // Handle running timer UI
      if (action === 'start') {
        setRunningTimers(prev => ({ ...prev, [taskId]: true }));
        toast.success('Timer started');
      } else if (action === 'stop') {
        setRunningTimers(prev => ({ ...prev, [taskId]: false }));
        toast.success('Timer stopped');
      }
    } catch (error) {
      toast.error('Failed to update timer');
    }
  };

  // Create BDE task
  const handleCreateBDETask = async (taskData) => {
    try {
      await axios.post(
        `${API}/api/departments/website/projects/${selectedProject}/tasks`,
        taskData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Task created');
      loadProjectBDETasks(selectedProject);
      setIsAddTaskModalOpen(false);
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  // Update BDE task status
  const handleBDETaskStatusChange = async (taskId, status) => {
    try {
      await axios.put(
        `${API}/api/departments/website/projects/${selectedProject}/tasks/${taskId}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadProjectBDETasks(selectedProject);
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  // Delete BDE task
  const handleDeleteBDETask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await axios.delete(
        `${API}/api/departments/website/projects/${selectedProject}/tasks/${taskId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Task deleted');
      loadProjectBDETasks(selectedProject);
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

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
      loadProjectBDETasks(selectedProject);
    }
  }, [selectedProject, currentView, loadProjectDetail, loadProjectTasks, loadProjectBDETasks]);

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

  // Workflow Stage Transition
  const handleStageTransition = async (projectId, newStage, notes = '') => {
    try {
      // Frontend validation for Project Creation -> Discovery Call
      if (newStage === 'discovery') {
        const project = allProjectsSummary.find(p => p.project_id === projectId);
        if (project) {
          const missingFields = [];
          if (!project.name?.trim()) missingFields.push('Project Name');
          if (!project.client_name?.trim()) missingFields.push('Client Name');
          if (!project.website_type?.trim()) missingFields.push('Website Type');
          if (!project.platform?.trim()) missingFields.push('Platform');
          
          if (missingFields.length > 0) {
            toast.error(`Cannot move to Discovery Call. Missing: ${missingFields.join(', ')}. Please edit the project first.`);
            return;
          }
        }
      }
      
      await axios.put(
        `${API}/api/website-projects/projects/${projectId}/transition`,
        { stage: newStage, notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Project moved to ${WORKFLOW_STAGES.find(s => s.id === newStage)?.label || newStage}`);
      loadAllProjectsSummary();
      if (projectDetail?.project_id === projectId) {
        loadProjectDetail(projectId);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to move project';
      toast.error(errorMsg);
    }
  };

  // Get next stage in workflow
  const getNextStage = (currentStage) => {
    const stages = ['creation', 'discovery', 'content', 'wireframe', 'ui', 'development', 'testing', 'delivered'];
    const currentIndex = stages.indexOf(currentStage || 'creation');
    if (currentIndex < stages.length - 1) {
      return stages[currentIndex + 1];
    }
    return null;
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

  const filteredProjectsSummary = allProjectsSummary.filter(p => {
    // Text search
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    // Developer filter
    const matchesDeveloper = developerFilter === 'all' || developerFilter === '' || p.developer === developerFilter;
    // Workflow stage filter
    const projectStage = p.workflow_stage || 'creation';
    const matchesStage = workflowStage === 'all' || projectStage === workflowStage;
    
    // Content stage-specific filters
    let matchesContentFilters = true;
    if (workflowStage === 'content') {
      // Content Writer filter (project level)
      if (contentWriterFilter !== 'all') {
        matchesContentFilters = matchesContentFilters && (p.content_writer === contentWriterFilter);
      }
      
      // Page Assignee filter (check if any page has this assignee)
      if (pageAssigneeFilter !== 'all') {
        const hasPageWithAssignee = (p.pages || []).some(pg => 
          pg.content_assignee === pageAssigneeFilter
        );
        matchesContentFilters = matchesContentFilters && hasPageWithAssignee;
      }
      
      // Content Date filter (check if any page has this due date)
      if (contentDateFilter) {
        const hasPageWithDate = (p.pages || []).some(pg => 
          pg.content_due === contentDateFilter
        );
        matchesContentFilters = matchesContentFilters && hasPageWithDate;
      }
      
      // Day filter for content
      if (contentDayFilter !== 'all') {
        const today = new Date().toISOString().split('T')[0];
        const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const matchesDayFilter = (p.pages || []).some(pg => {
          const pageDue = pg.content_due;
          if (!pageDue) return contentDayFilter === 'no_date';
          
          switch (contentDayFilter) {
            case 'today': return pageDue === today;
            case 'this_week': return pageDue >= today && pageDue <= weekFromNow;
            case 'overdue': return pageDue < today;
            default: return true;
          }
        });
        matchesContentFilters = matchesContentFilters && matchesDayFilter;
      }
    }
    
    return matchesSearch && matchesDeveloper && matchesStage && matchesContentFilters;
  });

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
        <div className="flex flex-col h-full pb-16 md:pb-0" data-testid="website-projects-page">
          {/* Header - Mobile Responsive */}
          <div className={`p-3 md:p-4 border-b ${borderColor}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <Globe className="h-5 w-5 md:h-6 md:w-6 text-[#6366f1]" />
                <h1 className={`text-base md:text-xl font-bold ${textPrimary}`}>
                  {workflowStage !== 'all' 
                    ? WORKFLOW_STAGES.find(s => s.id === workflowStage)?.label || 'Projects'
                    : isMobile ? 'Projects' : 'All Website Projects'
                  }
                </h1>
                <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs">
                  {workflowStage !== 'all' 
                    ? filteredProjectsSummary.length 
                    : allProjectsSummary.length
                  }
                </Badge>
              </div>
              <Button 
                onClick={() => setIsCreateModalOpen(true)} 
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-9 px-3 md:px-4" 
                data-testid="create-project-btn"
              >
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">New Project</span>
              </Button>
            </div>
          </div>

          {/* Workflow Stages Bar - For Project Manager */}
          {isProjectManager && (
            <div className={`hidden md:block p-3 border-b ${borderColor} overflow-x-auto`}>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={workflowStage === 'all' ? 'default' : 'outline'}
                  onClick={() => { setWorkflowStage('all'); setSearchParams({}); }}
                  className={`h-8 ${workflowStage === 'all' ? 'bg-[#6366f1]' : ''}`}
                >
                  All
                </Button>
                {WORKFLOW_STAGES.map(stage => {
                  const stageCount = allProjectsSummary.filter(p => (p.workflow_stage || 'creation') === stage.id).length;
                  return (
                    <Button
                      key={stage.id}
                      size="sm"
                      variant={workflowStage === stage.id ? 'default' : 'outline'}
                      onClick={() => { setWorkflowStage(stage.id); setSearchParams({ stage: stage.id }); }}
                      className={`h-8 gap-2 ${workflowStage === stage.id ? 'bg-[#6366f1]' : ''}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                      {stage.label}
                      {stageCount > 0 && <Badge className="ml-1 h-5 bg-white/20">{stageCount}</Badge>}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* View Mode Toggle & Filters - Desktop */}
          <div className={`hidden md:block p-4 border-b ${borderColor}`}>
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

              {/* Content Stage Specific Filters */}
              {workflowStage === 'content' && (
                <>
                  {/* Content Writer Filter */}
                  <Select value={contentWriterFilter} onValueChange={setContentWriterFilter}>
                    <SelectTrigger className={`w-44 ${bgSecondary} border-none`}>
                      <FileEdit className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Content Writer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Writers</SelectItem>
                      {teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {/* Page Assignee Filter */}
                  <Select value={pageAssigneeFilter} onValueChange={setPageAssigneeFilter}>
                    <SelectTrigger className={`w-44 ${bgSecondary} border-none`}>
                      <User className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Page Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assignees</SelectItem>
                      {teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {/* Content Due Date Filter */}
                  <div className="flex items-center gap-2">
                    <Input 
                      type="date" 
                      value={contentDateFilter} 
                      onChange={(e) => setContentDateFilter(e.target.value)} 
                      className={`w-40 ${bgSecondary} border-none`} 
                      placeholder="Content Due" 
                    />
                    {contentDateFilter && (
                      <Button variant="ghost" size="sm" onClick={() => setContentDateFilter('')} className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Day Filter */}
                  <Select value={contentDayFilter} onValueChange={setContentDayFilter}>
                    <SelectTrigger className={`w-36 ${bgSecondary} border-none`}>
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Day Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Days</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="no_date">No Date Set</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}

              {/* Clear All Filters */}
              {(dueDateFilter || developerFilter !== 'all' || phaseFil !== 'all' || statusFilter !== 'all' || searchTerm || 
                contentWriterFilter !== 'all' || pageAssigneeFilter !== 'all' || contentDateFilter || contentDayFilter !== 'all') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setDueDateFilter('');
                    setDeveloperFilter('all');
                    setPhaseFil('all');
                    setStatusFilter('all');
                    setSearchTerm('');
                    setContentWriterFilter('all');
                    setPageAssigneeFilter('all');
                    setContentDateFilter('');
                    setContentDayFilter('all');
                  }}
                  className="text-red-400"
                >
                  <X className="h-4 w-4 mr-1" /> Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Search & Quick Filters */}
          <div className={`md:hidden p-3 border-b ${borderColor} space-y-3`}>
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search projects..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className={`pl-10 ${bgSecondary} border-none h-10`} 
              />
            </div>
            
            {/* Quick Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
              <Button 
                size="sm" 
                variant={viewMode === 'projects' ? 'default' : 'outline'}
                onClick={() => setViewMode('projects')}
                className={`h-8 ${viewMode === 'projects' ? 'bg-[#6366f1]' : ''} whitespace-nowrap`}
              >
                <LayoutGrid className="h-3 w-3 mr-1" /> Projects
              </Button>
              <Button 
                size="sm" 
                variant={viewMode === 'tasks' ? 'default' : 'outline'}
                onClick={() => setViewMode('tasks')}
                className={`h-8 ${viewMode === 'tasks' ? 'bg-[#6366f1]' : ''} whitespace-nowrap`}
              >
                <ListTodo className="h-3 w-3 mr-1" /> Tasks
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="h-8 whitespace-nowrap"
              >
                <Filter className="h-3 w-3 mr-1" /> Filters
                {(statusFilter !== 'all' || developerFilter !== 'all') && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-[#6366f1]" />
                )}
              </Button>
            </div>

            {/* Expandable Filters */}
            {showMobileFilters && (
              <div className={`p-3 rounded-lg ${bgSecondary} space-y-3`}>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={`w-full ${bgCard}`}><SelectValue placeholder="All Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={developerFilter} onValueChange={setDeveloperFilter}>
                  <SelectTrigger className={`w-full ${bgCard}`}><SelectValue placeholder="All Developers" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Developers</SelectItem>
                    {teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(statusFilter !== 'all' || developerFilter !== 'all') && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setStatusFilter('all'); setDeveloperFilter('all'); }}
                    className="text-red-400 w-full"
                  >
                    <X className="h-4 w-4 mr-1" /> Clear Filters
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Projects List View */}
            {viewMode === 'projects' && (
              <div className="flex-1 overflow-auto">
                {/* Desktop Table View */}
                <table className="w-full hidden md:table">
                  <thead className={`${bgSecondary} sticky top-0 z-10`}>
                    <tr className={`text-xs ${textSecondary} uppercase`}>
                      <th className="px-4 py-3 text-left font-semibold">Project</th>
                      <th className="px-4 py-3 text-center font-semibold">Stage</th>
                      <th className="px-4 py-3 text-center font-semibold">Progress</th>
                      <th className="px-4 py-3 text-center font-semibold">Developer</th>
                      <th className="px-4 py-3 text-center font-semibold">Deadline</th>
                      <th className="px-4 py-3 text-center font-semibold">Pages</th>
                      <th className="px-4 py-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjectsSummary.map(project => {
                      const currentStage = project.workflow_stage || 'creation';
                      const stageInfo = WORKFLOW_STAGES.find(s => s.id === currentStage);
                      const nextStage = getNextStage(currentStage);
                      const nextStageInfo = nextStage ? WORKFLOW_STAGES.find(s => s.id === nextStage) : null;
                      
                      return (
                        <tr key={project.project_id} 
                            className={`border-b ${borderColor} hover:${bgSecondary} transition-colors`}>
                          <td className="px-4 py-3 cursor-pointer" onClick={() => openProject(project.project_id)}>
                            <div className="flex items-center gap-3">
                              <Globe className="h-5 w-5 text-[#6366f1]" />
                              <div>
                                <p className={`font-medium ${textPrimary}`}>{project.name}</p>
                                <p className={`text-xs ${textSecondary}`}>{project.platform} • {project.website_type}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${stageInfo?.color || 'bg-gray-500'}`} />
                              <span className={`text-sm ${textPrimary}`}>{stageInfo?.label || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Progress value={project.overall_percent} className="w-20 h-2" />
                              <span className={`text-sm font-medium ${textPrimary}`}>{project.overall_percent}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm ${textSecondary}`}>{project.developer || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-medium ${project.deadline && new Date(project.deadline) < new Date() ? 'text-red-400' : textPrimary}`}>
                              {project.deadline || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline">{project.total_pages}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openProject(project.project_id)}
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {nextStageInfo && (
                                <Button
                                  size="sm"
                                  onClick={() => handleStageTransition(project.project_id, nextStage)}
                                  className="h-8 bg-[#6366f1] hover:bg-[#5855eb] px-2"
                                >
                                  <ArrowRight className="h-3 w-3 mr-1" />
                                  {nextStageInfo.label}
                                </Button>
                              )}
                              {!nextStageInfo && (
                                <Badge className="bg-emerald-500/20 text-emerald-400">Completed</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="md:hidden p-3 space-y-3">
                  {filteredProjectsSummary.length === 0 ? (
                    <div className={`text-center py-12 ${textSecondary}`}>
                      <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No projects found</p>
                    </div>
                  ) : (
                    filteredProjectsSummary.map(project => {
                      const currentStage = project.workflow_stage || 'creation';
                      const stageInfo = WORKFLOW_STAGES.find(s => s.id === currentStage);
                      const nextStage = getNextStage(currentStage);
                      const nextStageInfo = nextStage ? WORKFLOW_STAGES.find(s => s.id === nextStage) : null;
                      
                      return (
                        <div 
                          key={project.project_id} 
                          className={`p-4 rounded-xl border ${borderColor} ${bgCard} transition-all`}
                        >
                          {/* Project Header */}
                          <div className="flex items-start justify-between mb-3" onClick={() => openProject(project.project_id)}>
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-lg bg-[#6366f1]/10 flex items-center justify-center">
                                <Globe className="h-5 w-5 text-[#6366f1]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold ${textPrimary} truncate`}>{project.name}</p>
                                <p className={`text-xs ${textSecondary} truncate`}>{project.platform} • {project.website_type}</p>
                              </div>
                            </div>
                          </div>

                          {/* Workflow Stage Badge */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${stageInfo?.color || 'bg-gray-500'}`} />
                              <span className={`text-sm font-medium ${textPrimary}`}>{stageInfo?.label || 'Unknown'}</span>
                            </div>
                            <Badge className={`text-xs ${
                              project.status === 'active' ? 'bg-green-500/20 text-green-400' :
                              project.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {project.status || 'active'}
                            </Badge>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-3" onClick={() => openProject(project.project_id)}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs ${textSecondary}`}>Progress</span>
                              <span className={`text-xs font-semibold ${textPrimary}`}>{project.overall_percent}%</span>
                            </div>
                            <Progress value={project.overall_percent} className="h-2" />
                          </div>

                          {/* Stats Row */}
                          <div className="flex items-center justify-between text-xs mb-3" onClick={() => openProject(project.project_id)}>
                            <div className={`flex items-center gap-1 ${textSecondary}`}>
                              <FileText className="h-3 w-3" />
                              <span>{project.total_pages} pages</span>
                            </div>
                            {project.deadline && (
                              <div className={`flex items-center gap-1 ${new Date(project.deadline) < new Date() ? 'text-red-400' : textSecondary}`}>
                                <Calendar className="h-3 w-3" />
                                <span>{project.deadline}</span>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-2 border-t border-dashed" style={{ borderColor: isDark ? '#3f3f46' : '#e5e7eb' }}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openProject(project.project_id)}
                              className="flex-1 h-8"
                            >
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                            {nextStageInfo && (
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleStageTransition(project.project_id, nextStage); }}
                                className="flex-1 h-8 bg-[#6366f1] hover:bg-[#5855eb]"
                              >
                                <ArrowRight className="h-3 w-3 mr-1" /> {nextStageInfo.label}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
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

          {/* Mobile Bottom Navigation */}
          <div className={`md:hidden fixed bottom-0 left-0 right-0 ${bgCard} border-t ${borderColor} px-2 py-2 z-50 safe-area-inset-bottom`}>
            <div className="flex items-center justify-around">
              <button 
                onClick={() => setViewMode('projects')}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  viewMode === 'projects' ? 'text-[#6366f1] bg-[#6366f1]/10' : textSecondary
                }`}
              >
                <FolderKanban className="h-5 w-5" />
                <span className="text-xs font-medium">Projects</span>
              </button>
              <button 
                onClick={() => setViewMode('tasks')}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  viewMode === 'tasks' ? 'text-[#6366f1] bg-[#6366f1]/10' : textSecondary
                }`}
              >
                <ListTodo className="h-5 w-5" />
                <span className="text-xs font-medium">Tasks</span>
              </button>
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-[#6366f1] text-white -mt-4 shadow-lg"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs font-medium">New</span>
              </button>
              <button 
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  showMobileFilters ? 'text-[#6366f1] bg-[#6366f1]/10' : textSecondary
                }`}
              >
                <Filter className="h-5 w-5" />
                <span className="text-xs font-medium">Filter</span>
              </button>
              <button 
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${textSecondary}`}
              >
                <Settings className="h-5 w-5" />
                <span className="text-xs font-medium">More</span>
              </button>
            </div>
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
        <div className="flex flex-col h-full pb-16 md:pb-0" data-testid="project-detail-view">
          {/* Sticky Header Bar - Mobile Responsive */}
          <div className={`sticky top-0 z-20 border-b ${borderColor} ${bgCard} shadow-sm`}>
            {/* Top Row - Back button, title, actions */}
            <div className={`p-2 md:p-3 flex items-center justify-between`}>
              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                <Button variant="ghost" size="sm" onClick={goBackToAllProjects} className={`${textSecondary} p-1 md:p-2`}>
                  <ArrowLeft className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Back</span>
                </Button>
                <h1 className={`text-sm md:text-lg font-bold ${textPrimary} truncate`}>{projectDetail.name}</h1>
                <Badge className={`${statusStyle.bg} ${statusStyle.text} px-2 py-0.5 md:px-3 md:py-1 font-semibold text-xs md:text-sm shrink-0`}>
                  {(projectDetail.status || 'Active').toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-1 md:gap-2 shrink-0">
                {canEdit && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { setNewProject(projectDetail); setIsEditProjectModalOpen(true); }}
                    className="h-8 px-2 md:px-3"
                  >
                    <Edit2 className="h-4 w-4 md:mr-1" />
                    <span className="hidden md:inline">Edit</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Links Bar - Scrollable on Mobile */}
            <div className={`px-2 md:px-3 pb-2 md:pb-3 flex items-center gap-2 md:gap-4 overflow-x-auto hide-scrollbar`}>
              {/* Documents */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => projectDetail.documents_url && setDocPopupUrl(projectDetail.documents_url)}
                className={`gap-1 md:gap-2 shrink-0 h-8 ${projectDetail.documents_url ? 'text-[#6366f1] border-[#6366f1]/30' : `${textSecondary} opacity-50`}`}
                disabled={!projectDetail.documents_url}
              >
                <FileText className="h-4 w-4" />
                <span className="text-xs md:text-sm">Docs</span>
              </Button>

              {/* Drive */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => projectDetail.client_drive_url && setDocPopupUrl(projectDetail.client_drive_url)}
                className={`gap-1 md:gap-2 shrink-0 h-8 ${projectDetail.client_drive_url ? 'text-[#22c55e] border-[#22c55e]/30' : `${textSecondary} opacity-50`}`}
                disabled={!projectDetail.client_drive_url}
              >
                <Folder className="h-4 w-4" />
                <span className="text-xs md:text-sm">Drive</span>
              </Button>

              {/* Deadline - Mobile Compact */}
              <div className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'} shrink-0`}>
                <Clock className="h-3 w-3 md:h-4 md:w-4 text-[#f59e0b]" />
                <span className={`text-xs md:text-sm font-medium ${projectDetail.deadline ? textPrimary : 'text-red-400'}`}>
                  {projectDetail.deadline || 'No Deadline'}
                </span>
              </div>

              {/* Progress */}
              <div className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'} shrink-0`}>
                <Progress value={projectDetail.stats?.overall_completed / projectDetail.stats?.total_pages * 100 || 0} className="w-16 md:w-24 h-2" />
                <span className={`text-xs md:text-sm ${textSecondary}`}>{projectDetail.stats?.overall_completed || 0}/{projectDetail.stats?.total_pages || 0}</span>
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

          {/* Tabs - Sticky with Mobile Responsiveness */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className={`sticky top-0 z-10 border-b ${borderColor} ${bgCard} px-2 md:px-4 pt-2 pb-2`}>
              {/* Mobile Tab Bar - Scrollable */}
              <div className="flex items-center justify-between gap-2">
                <TabsList className={`${bgSecondary} overflow-x-auto hide-scrollbar flex-shrink-0`}>
                  <TabsTrigger value="pages" className="text-xs md:text-sm px-2 md:px-3">
                    <LayoutGrid className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                    <span className="hidden md:inline">Pages</span>
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="text-xs md:text-sm px-2 md:px-3">
                    <ListTodo className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                    <span className="hidden md:inline">Tasks</span>
                    <Badge className="ml-1 bg-[#6366f1]/20 text-[#6366f1] text-xs">{projectBDETasks.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="requirements" className="text-xs md:text-sm px-2 md:px-3">
                    <FileText className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                    <span className="hidden md:inline">Requirements</span>
                  </TabsTrigger>
                  <TabsTrigger value="branding" className="text-xs md:text-sm px-2 md:px-3">
                    <Palette className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                    <span className="hidden md:inline">Branding</span>
                  </TabsTrigger>
                </TabsList>
                
                {/* Desktop Search & Actions */}
                <div className="hidden md:flex items-center gap-2">
                  <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-48 ${bgSecondary} border-none`} />
                  {activeTab === 'pages' && <Button onClick={() => setIsAddPageModalOpen(true)} size="sm" className="bg-[#6366f1]"><Plus className="h-4 w-4 mr-1" /> Add Page</Button>}
                  {activeTab === 'tasks' && <Button onClick={() => setIsAddTaskModalOpen(true)} size="sm" className="bg-[#6366f1]"><Plus className="h-4 w-4 mr-1" /> Add Task</Button>}
                </div>
                
                {/* Mobile Add Button */}
                <div className="md:hidden flex gap-1">
                  {activeTab === 'pages' && (
                    <Button onClick={() => setIsAddPageModalOpen(true)} size="sm" className="bg-[#6366f1] h-8 w-8 p-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                  {activeTab === 'tasks' && (
                    <Button onClick={() => setIsAddTaskModalOpen(true)} size="sm" className="bg-[#6366f1] h-8 w-8 p-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <TabsContent value="pages" className="flex-1 overflow-auto m-0">
              {/* Desktop Table */}
              <table className="w-full hidden md:table">
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
              
              {/* Mobile Pages Card View */}
              <div className="md:hidden p-3 space-y-3">
                {filteredPages.length === 0 ? (
                  <div className={`text-center py-12 ${textSecondary}`}>
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No pages yet</p>
                  </div>
                ) : (
                  filteredPages.map((task, idx) => (
                    <div 
                      key={task.task_id}
                      onClick={() => openPage(task)}
                      className={`p-4 rounded-xl border ${borderColor} ${bgCard} active:scale-[0.98] transition-all cursor-pointer`}
                    >
                      {/* Page Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${bgSecondary} px-2 py-1 rounded`}>{task.sno}</span>
                          <p className={`font-semibold ${textPrimary}`}>{task.page_name}</p>
                        </div>
                        <StatusBadge status={task.overall_status} onChange={(v) => handleStatusChange(task.task_id, 'overall_status', v)} />
                      </div>
                      
                      {/* Phase Progress */}
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        {['wireframe', 'ui', 'content', 'dev'].map(phase => {
                          const status = task[`${phase}_status`];
                          const isComplete = status === 'Completed';
                          const isProgress = status === 'In Progress';
                          return (
                            <div key={phase} className="text-center">
                              <div className={`w-full h-1.5 rounded-full mb-1 ${
                                isComplete ? 'bg-[#22c55e]' : 
                                isProgress ? 'bg-[#6366f1]' : 
                                bgSecondary
                              }`} />
                              <span className={`text-[10px] ${textSecondary} capitalize`}>{phase === 'dev' ? 'Dev' : phase}</span>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Due Date if any */}
                      {task.wireframe_due && (
                        <div className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                          <Calendar className="h-3 w-3" />
                          <span>Due: {task.wireframe_due}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="flex-1 overflow-auto m-0">
              {/* BDE-Style Tasks View */}
              <div className="p-3 md:p-4 space-y-3 md:space-y-4">
                {/* Task Stats Cards - Responsive Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                  <div className={`p-3 md:p-4 rounded-xl ${bgCard} border ${borderColor}`}>
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="p-1.5 md:p-2 rounded-lg bg-[#6366f1]/10">
                        <ListTodo className="h-4 w-4 md:h-5 md:w-5 text-[#6366f1]" />
                      </div>
                      <div>
                        <p className={`text-lg md:text-2xl font-bold ${textPrimary}`}>{projectBDETasks.length}</p>
                        <p className={`text-[10px] md:text-xs ${textSecondary}`}>Total</p>
                      </div>
                    </div>
                  </div>
                  <div className={`p-3 md:p-4 rounded-xl ${bgCard} border ${borderColor}`}>
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="p-1.5 md:p-2 rounded-lg bg-[#f59e0b]/10">
                        <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-[#f59e0b]" />
                      </div>
                      <div>
                        <p className={`text-lg md:text-2xl font-bold ${textPrimary}`}>{projectBDETasks.filter(t => t.status === 'pending').length}</p>
                        <p className={`text-[10px] md:text-xs ${textSecondary}`}>Pending</p>
                      </div>
                    </div>
                  </div>
                  <div className={`p-3 md:p-4 rounded-xl ${bgCard} border ${borderColor}`}>
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="p-1.5 md:p-2 rounded-lg bg-[#3b82f6]/10">
                        <Timer className="h-4 w-4 md:h-5 md:w-5 text-[#3b82f6]" />
                      </div>
                      <div>
                        <p className={`text-lg md:text-2xl font-bold ${textPrimary}`}>{projectBDETasks.filter(t => t.status === 'in_progress').length}</p>
                        <p className={`text-[10px] md:text-xs ${textSecondary}`}>In Progress</p>
                      </div>
                    </div>
                  </div>
                  <div className={`p-3 md:p-4 rounded-xl ${bgCard} border ${borderColor}`}>
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="p-1.5 md:p-2 rounded-lg bg-[#22c55e]/10">
                        <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-[#22c55e]" />
                      </div>
                      <div>
                        <p className={`text-lg md:text-2xl font-bold ${textPrimary}`}>{projectBDETasks.filter(t => t.status === 'completed').length}</p>
                        <p className={`text-[10px] md:text-xs ${textSecondary}`}>Done</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filters Row - Mobile Responsive */}
                <div className="flex items-center gap-2 md:gap-3 flex-wrap overflow-x-auto hide-scrollbar">
                  {/* Status Filter Pills */}
                  <div className={`inline-flex rounded-lg p-0.5 md:p-1 ${bgSecondary} shrink-0`}>
                    {['all', 'pending', 'in_progress', 'completed'].map(status => (
                      <Button
                        key={status}
                        size="sm"
                        variant={taskFilter === status ? 'default' : 'ghost'}
                        onClick={() => setTaskFilter(status)}
                        className={`text-xs md:text-sm h-7 md:h-8 px-2 md:px-3 ${taskFilter === status ? 'bg-[#6366f1]' : ''}`}
                      >
                        {status === 'all' ? 'All' : status === 'in_progress' ? 'Active' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </Button>
                    ))}
                  </div>

                  {/* Date Filter - Hidden on Mobile */}
                  <Select value={taskDateFilter} onValueChange={setTaskDateFilter}>
                    <SelectTrigger className={`w-28 md:w-40 ${bgSecondary} border-none h-8 text-xs md:text-sm`}>
                      <CalendarDays className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tasks Table - Desktop */}
                <div className={`hidden md:block rounded-xl border ${borderColor} overflow-hidden`}>
                  <table className="w-full">
                    <thead className={bgSecondary}>
                      <tr className={`text-xs ${textSecondary} uppercase`}>
                        <th className="px-4 py-3 text-left font-semibold">Task</th>
                        <th className="px-4 py-3 text-center font-semibold">Status</th>
                        <th className="px-4 py-3 text-center font-semibold">Priority</th>
                        <th className="px-4 py-3 text-center font-semibold">Due Date</th>
                        <th className="px-4 py-3 text-center font-semibold">Time</th>
                        <th className="px-4 py-3 text-center font-semibold">Timer</th>
                        <th className="px-4 py-3 text-center font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectBDETasks
                        .filter(task => {
                          if (taskFilter !== 'all' && task.status !== taskFilter) return false;
                          if (taskDateFilter === 'today') {
                            const today = new Date().toISOString().split('T')[0];
                            return task.due_date === today;
                          }
                          return true;
                        })
                        .map(task => (
                          <tr key={task.task_id} className={`border-t ${borderColor} hover:${bgSecondary}`}>
                            <td className="px-4 py-3">
                              <div>
                                <p className={`font-medium ${textPrimary}`}>{task.task_name}</p>
                                {task.description && <p className={`text-xs ${textSecondary} mt-1`}>{task.description}</p>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={`text-xs ${
                                task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                                task.status === 'on_hold' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {task.status === 'in_progress' ? 'In Progress' : task.status?.charAt(0).toUpperCase() + task.status?.slice(1)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className={`text-sm ${textSecondary}`}>
                                {task.due_date || '-'}
                                {task.due_time && <span className="block text-xs">{task.due_time}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Timer className={`h-4 w-4 ${task.timer_running ? 'text-[#10b981] animate-pulse' : textSecondary}`} />
                                <span className={`text-sm font-medium ${textPrimary}`}>{formatDuration(task.total_time_seconds || 0)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {!task.timer_running ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleTimerAction(task.task_id, 'start')}
                                    className="h-8 w-8 p-0 text-[#10b981] hover:bg-[#10b981]/10"
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleTimerAction(task.task_id, 'stop')}
                                    className="h-8 w-8 p-0 text-[#f59e0b] hover:bg-[#f59e0b]/10"
                                  >
                                    <Pause className="h-4 w-4" />
                                  </Button>
                                )}
                                {task.status === 'completed' && (
                                  <Badge className="bg-green-500/20 text-green-400 text-xs">Done</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setViewingTask(task); setIsTaskDetailOpen(true); }}
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteBDETask(task.task_id)}
                                  className="h-8 w-8 p-0 text-red-400 hover:bg-red-400/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {projectBDETasks.length === 0 && (
                    <div className={`p-8 text-center ${textSecondary}`}>
                      <ListTodo className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No tasks yet. Click "Add Task" to create one.</p>
                    </div>
                  )}
                </div>

                {/* Tasks Cards - Mobile */}
                <div className="md:hidden space-y-3">
                  {projectBDETasks
                    .filter(task => {
                      if (taskFilter !== 'all' && task.status !== taskFilter) return false;
                      if (taskDateFilter === 'today') {
                        const today = new Date().toISOString().split('T')[0];
                        return task.due_date === today;
                      }
                      return true;
                    })
                    .map(task => (
                      <div 
                        key={task.task_id} 
                        className={`p-4 rounded-xl border ${borderColor} ${bgCard}`}
                        onClick={() => { setViewingTask(task); setIsTaskDetailOpen(true); }}
                      >
                        {/* Task Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold ${textPrimary} truncate`}>{task.task_name}</p>
                            {task.description && <p className={`text-xs ${textSecondary} mt-0.5 line-clamp-1`}>{task.description}</p>}
                          </div>
                          <Badge className={`text-xs shrink-0 ml-2 ${
                            task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {task.status === 'in_progress' ? 'Active' : task.status?.charAt(0).toUpperCase() + task.status?.slice(1)}
                          </Badge>
                        </div>
                        
                        {/* Task Meta Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</Badge>
                            {task.due_date && (
                              <span className={`text-xs ${textSecondary} flex items-center gap-1`}>
                                <Calendar className="h-3 w-3" />
                                {task.due_date}
                              </span>
                            )}
                          </div>
                          
                          {/* Timer */}
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${bgSecondary}`}>
                              <Timer className={`h-3 w-3 ${task.timer_running ? 'text-[#10b981] animate-pulse' : textSecondary}`} />
                              <span className={`text-xs font-medium ${textPrimary}`}>{formatDuration(task.total_time_seconds || 0)}</span>
                            </div>
                            {!task.timer_running ? (
                              <Button
                                size="sm"
                                onClick={() => handleTimerAction(task.task_id, 'start')}
                                className="h-7 w-7 p-0 bg-[#10b981] hover:bg-[#10b981]/80"
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleTimerAction(task.task_id, 'stop')}
                                className="h-7 w-7 p-0 bg-[#f59e0b] hover:bg-[#f59e0b]/80"
                              >
                                <Pause className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  
                  {projectBDETasks.length === 0 && (
                    <div className={`p-8 text-center ${textSecondary}`}>
                      <ListTodo className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No tasks yet. Tap + to create one.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Task Detail Modal */}
              <Dialog open={isTaskDetailOpen} onOpenChange={setIsTaskDetailOpen}>
                <DialogContent className={`${bgCard} ${textPrimary} max-w-lg`}>
                  <DialogHeader>
                    <DialogTitle>{viewingTask?.task_name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {viewingTask?.description && (
                      <div>
                        <label className={`text-sm ${textSecondary}`}>Description</label>
                        <p className={textPrimary}>{viewingTask.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`text-sm ${textSecondary}`}>Status</label>
                        <Badge className={`mt-1 ${
                          viewingTask?.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          viewingTask?.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {viewingTask?.status}
                        </Badge>
                      </div>
                      <div>
                        <label className={`text-sm ${textSecondary}`}>Priority</label>
                        <Badge className={`mt-1 ${PRIORITY_COLORS[viewingTask?.priority]}`}>{viewingTask?.priority}</Badge>
                      </div>
                      <div>
                        <label className={`text-sm ${textSecondary}`}>Due Date</label>
                        <p className={textPrimary}>{viewingTask?.due_date || 'Not set'}</p>
                      </div>
                      <div>
                        <label className={`text-sm ${textSecondary}`}>Time Spent</label>
                        <p className={textPrimary}>{formatDuration(viewingTask?.total_time_seconds || 0)}</p>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsTaskDetailOpen(false)}>Close</Button>
                    {viewingTask?.status !== 'completed' && (
                      <Button
                        onClick={() => { handleBDETaskStatusChange(viewingTask.task_id, 'completed'); setIsTaskDetailOpen(false); }}
                        className="bg-[#22c55e] hover:bg-[#16a34a]"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" /> Mark Complete
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Requirements Tab */}
            <TabsContent value="requirements" className="flex-1 overflow-auto m-0 p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className={`p-6 rounded-xl border ${borderColor} ${bgCard}`}>
                  <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Project Requirements</h3>
                  <p className={`text-sm ${textSecondary} mb-6`}>
                    Based on {projectDetail?.platform} {projectDetail?.website_type}
                  </p>
                  
                  {/* Dynamic Requirements based on Type */}
                  <div className="space-y-6">
                    {/* Business Info Section */}
                    <div className={`p-4 rounded-lg ${bgSecondary}`}>
                      <h4 className={`font-medium ${textPrimary} mb-4`}>Business Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Business/Store Name</label>
                          <Input placeholder="Enter business name..." className={bgCard} />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Tagline</label>
                          <Input placeholder="Enter tagline..." className={bgCard} />
                        </div>
                        <div className="col-span-2">
                          <label className={`text-sm ${textSecondary} block mb-1`}>About Text</label>
                          <Textarea placeholder="Describe the business..." className={bgCard} rows={3} />
                        </div>
                      </div>
                    </div>

                    {/* Services/Products Section */}
                    <div className={`p-4 rounded-lg ${bgSecondary}`}>
                      <h4 className={`font-medium ${textPrimary} mb-4`}>
                        {['Shopify Store', 'E-commerce'].includes(projectDetail?.website_type) ? 'Products & Collections' : 'Services'}
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {['Shopify Store', 'E-commerce'].includes(projectDetail?.website_type) ? (
                          <>
                            <div>
                              <label className={`text-sm ${textSecondary} block mb-1`}>Product Categories</label>
                              <Input placeholder="e.g., Clothing, Electronics" className={bgCard} />
                            </div>
                            <div>
                              <label className={`text-sm ${textSecondary} block mb-1`}>Approx. Products Count</label>
                              <Input type="number" placeholder="e.g., 50" className={bgCard} />
                            </div>
                            <div className="col-span-2">
                              <label className={`text-sm ${textSecondary} block mb-1`}>Collections List</label>
                              <Textarea placeholder="List your product collections..." className={bgCard} rows={2} />
                            </div>
                            <div>
                              <label className={`text-sm ${textSecondary} block mb-1`}>Shipping Zones</label>
                              <Input placeholder="e.g., Local, National, International" className={bgCard} />
                            </div>
                            <div>
                              <label className={`text-sm ${textSecondary} block mb-1`}>Payment Methods</label>
                              <Input placeholder="e.g., COD, Card, UPI" className={bgCard} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="col-span-2">
                              <label className={`text-sm ${textSecondary} block mb-1`}>Services List</label>
                              <Textarea placeholder="List your services (one per line)..." className={bgCard} rows={3} />
                            </div>
                            {projectDetail?.website_type !== 'Landing Page' && (
                              <div className="col-span-2">
                                <label className={`text-sm ${textSecondary} block mb-1`}>Portfolio Items</label>
                                <Textarea placeholder="List portfolio items or projects..." className={bgCard} rows={2} />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Contact Section */}
                    <div className={`p-4 rounded-lg ${bgSecondary}`}>
                      <h4 className={`font-medium ${textPrimary} mb-4`}>Contact Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Email</label>
                          <Input placeholder="contact@example.com" className={bgCard} />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Phone</label>
                          <Input placeholder="+91 XXXXX XXXXX" className={bgCard} />
                        </div>
                        <div className="col-span-2">
                          <label className={`text-sm ${textSecondary} block mb-1`}>Address</label>
                          <Input placeholder="Business address..." className={bgCard} />
                        </div>
                        <div className="col-span-2">
                          <label className={`text-sm ${textSecondary} block mb-1`}>Social Media Links</label>
                          <Input placeholder="Instagram, Facebook, LinkedIn URLs..." className={bgCard} />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-6">
                    <Button className="bg-[#6366f1]">Save Requirements</Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Branding Tab */}
            <TabsContent value="branding" className="flex-1 overflow-auto m-0 p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className={`p-6 rounded-xl border ${borderColor} ${bgCard}`}>
                  <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Brand Guidelines</h3>
                  
                  <div className="space-y-6">
                    {/* Logo & Assets */}
                    <div className={`p-4 rounded-lg ${bgSecondary}`}>
                      <h4 className={`font-medium ${textPrimary} mb-4`}>Logo & Assets</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Logo URL</label>
                          <Input placeholder="Google Drive / Dropbox link" className={bgCard} />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Favicon URL</label>
                          <Input placeholder="Favicon link" className={bgCard} />
                        </div>
                        <div className="col-span-2">
                          <label className={`text-sm ${textSecondary} block mb-1`}>Brand Guidelines Document</label>
                          <Input placeholder="Link to brand guidelines PDF/Doc" className={bgCard} />
                        </div>
                      </div>
                    </div>

                    {/* Color Palette */}
                    <div className={`p-4 rounded-lg ${bgSecondary}`}>
                      <h4 className={`font-medium ${textPrimary} mb-4`}>Color Palette</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Primary Color</label>
                          <div className="flex gap-2">
                            <input type="color" defaultValue="#6366f1" className="w-10 h-10 rounded cursor-pointer" />
                            <Input placeholder="#6366f1" className={`flex-1 ${bgCard}`} />
                          </div>
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Secondary Color</label>
                          <div className="flex gap-2">
                            <input type="color" defaultValue="#22c55e" className="w-10 h-10 rounded cursor-pointer" />
                            <Input placeholder="#22c55e" className={`flex-1 ${bgCard}`} />
                          </div>
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Accent Color</label>
                          <div className="flex gap-2">
                            <input type="color" defaultValue="#f59e0b" className="w-10 h-10 rounded cursor-pointer" />
                            <Input placeholder="#f59e0b" className={`flex-1 ${bgCard}`} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Typography */}
                    <div className={`p-4 rounded-lg ${bgSecondary}`}>
                      <h4 className={`font-medium ${textPrimary} mb-4`}>Typography</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Primary Font</label>
                          <Input placeholder="e.g., Inter, Roboto" className={bgCard} />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Secondary Font</label>
                          <Input placeholder="e.g., Playfair Display" className={bgCard} />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-6">
                    <Button className="bg-[#6366f1]">Save Branding</Button>
                  </div>
                </div>
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
            <DialogContent className={`${bgCard} ${textPrimary} max-w-lg`}>
              <DialogHeader><DialogTitle>Add New Task</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Task Name *</label>
                  <Input value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} placeholder="Task title" className={bgSecondary} />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Description</label>
                  <Textarea value={newTask.description} onChange={(e) => setNewTask({...newTask, description: e.target.value})} placeholder="Description" className={bgSecondary} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Assign To</label>
                    <Select value={newTask.assigned_to} onValueChange={(v) => setNewTask({...newTask, assigned_to: v})}>
                      <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select team member" /></SelectTrigger>
                      <SelectContent>{teamMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Priority</label>
                    <Select value={newTask.priority} onValueChange={(v) => setNewTask({...newTask, priority: v})}>
                      <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Due Date</label>
                    <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({...newTask, due_date: e.target.value})} className={bgSecondary} />
                  </div>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Due Time</label>
                    <Input type="time" value={newTask.due_time || ''} onChange={(e) => setNewTask({...newTask, due_time: e.target.value})} className={bgSecondary} />
                  </div>
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Task Type</label>
                  <Select value={newTask.type || 'general'} onValueChange={(v) => setNewTask({...newTask, type: v})}>
                    <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
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
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsAddTaskModalOpen(false)}>Cancel</Button>
                <Button 
                  onClick={() => handleCreateBDETask({ 
                    task_name: newTask.title, 
                    description: newTask.description, 
                    assigned_to: newTask.assigned_to, 
                    priority: newTask.priority, 
                    due_date: newTask.due_date,
                    due_time: newTask.due_time,
                    type: newTask.type || 'general'
                  })} 
                  className="bg-[#6366f1]"
                  disabled={!newTask.title}
                >
                  Add Task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Mobile Bottom Navigation for Project Detail */}
          <div className={`md:hidden fixed bottom-0 left-0 right-0 ${bgCard} border-t ${borderColor} px-2 py-2 z-50 safe-area-inset-bottom`}>
            <div className="flex items-center justify-around">
              <button 
                onClick={() => setActiveTab('pages')}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                  activeTab === 'pages' ? 'text-[#6366f1] bg-[#6366f1]/10' : textSecondary
                }`}
              >
                <LayoutGrid className="h-5 w-5" />
                <span className="text-xs font-medium">Pages</span>
              </button>
              <button 
                onClick={() => setActiveTab('tasks')}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                  activeTab === 'tasks' ? 'text-[#6366f1] bg-[#6366f1]/10' : textSecondary
                }`}
              >
                <ListTodo className="h-5 w-5" />
                <span className="text-xs font-medium">Tasks</span>
              </button>
              <button 
                onClick={() => {
                  if (activeTab === 'pages') setIsAddPageModalOpen(true);
                  else if (activeTab === 'tasks') setIsAddTaskModalOpen(true);
                }}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-[#6366f1] text-white -mt-4 shadow-lg"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs font-medium">Add</span>
              </button>
              <button 
                onClick={() => setActiveTab('requirements')}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                  activeTab === 'requirements' ? 'text-[#6366f1] bg-[#6366f1]/10' : textSecondary
                }`}
              >
                <FileText className="h-5 w-5" />
                <span className="text-xs font-medium">Info</span>
              </button>
              <button 
                onClick={() => setActiveTab('branding')}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                  activeTab === 'branding' ? 'text-[#6366f1] bg-[#6366f1]/10' : textSecondary
                }`}
              >
                <Palette className="h-5 w-5" />
                <span className="text-xs font-medium">Brand</span>
              </button>
            </div>
          </div>

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
  const [createStep, setCreateStep] = useState(isEdit ? 4 : 1); // Step 1: Type/Platform, Step 2: Requirements, Step 3: Branding, Step 4: Details
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

  // Dynamic requirements based on website type
  const getRequirementsConfig = () => {
    const type = project.website_type;
    const configs = {
      'Landing Page': {
        sections: [
          { title: 'Basic Info', fields: ['business_name', 'tagline', 'about_text'] },
          { title: 'Content', fields: ['services_list', 'cta_text', 'contact_info'] },
        ],
        noShopify: true
      },
      'Business Website': {
        sections: [
          { title: 'Company Info', fields: ['business_name', 'tagline', 'about_text', 'team_info'] },
          { title: 'Content', fields: ['services_list', 'portfolio_items', 'testimonials', 'contact_info', 'social_links'] },
        ],
        noShopify: true
      },
      'Shopify Store': {
        sections: [
          { title: 'Store Info', fields: ['store_name', 'tagline', 'about_text'] },
          { title: 'Products & Collections', fields: ['product_categories', 'products_count', 'collections_list', 'variants_info'] },
          { title: 'Shipping & Payments', fields: ['shipping_zones', 'payment_methods', 'return_policy'] },
        ],
        hasShopify: true
      },
      'E-commerce': {
        sections: [
          { title: 'Store Info', fields: ['store_name', 'tagline', 'about_text'] },
          { title: 'Products', fields: ['product_categories', 'products_count', 'collections_list'] },
          { title: 'Checkout', fields: ['shipping_zones', 'payment_methods'] },
        ],
        hasShopify: true
      },
      'Web App': {
        sections: [
          { title: 'App Info', fields: ['app_name', 'tagline', 'description'] },
          { title: 'Features', fields: ['core_features', 'user_roles', 'integrations'] },
          { title: 'Technical', fields: ['tech_stack', 'api_requirements', 'auth_method'] },
        ],
        noShopify: true
      },
      'Portfolio': {
        sections: [
          { title: 'Personal Info', fields: ['full_name', 'tagline', 'bio'] },
          { title: 'Work', fields: ['skills_list', 'projects_list', 'experience'] },
          { title: 'Contact', fields: ['contact_info', 'social_links'] },
        ],
        noShopify: true
      },
    };
    return configs[type] || configs['Business Website'];
  };

  const fieldLabels = {
    business_name: 'Business Name', tagline: 'Tagline', about_text: 'About Text',
    services_list: 'Services (one per line)', cta_text: 'Call to Action Text', contact_info: 'Contact Information',
    team_info: 'Team Information', portfolio_items: 'Portfolio Items', testimonials: 'Testimonials',
    social_links: 'Social Media Links', store_name: 'Store Name', product_categories: 'Product Categories',
    products_count: 'Approx. Products Count', collections_list: 'Collections List', variants_info: 'Product Variants Info',
    shipping_zones: 'Shipping Zones', payment_methods: 'Payment Methods', return_policy: 'Return/Refund Policy',
    app_name: 'Application Name', description: 'Description', core_features: 'Core Features',
    user_roles: 'User Roles', integrations: 'Required Integrations', tech_stack: 'Tech Stack',
    api_requirements: 'API Requirements', auth_method: 'Authentication Method',
    full_name: 'Full Name', bio: 'Bio', skills_list: 'Skills', projects_list: 'Projects', experience: 'Experience',
  };

  // Reset step when modal opens for create
  useEffect(() => {
    if (isOpen && !isEdit) {
      setCreateStep(1);
      // Initialize requirements object
      setProject(prev => ({ ...prev, requirements: prev.requirements || {}, branding: prev.branding || {} }));
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
    if (createStep === 1) {
      if (!project.website_type || !project.platform) {
        toast.error('Please select Website Type and Platform');
        return;
      }
    }
    setCreateStep(createStep + 1);
  };

  const handleBack = () => {
    setCreateStep(createStep - 1);
  };

  // Step Progress Indicator
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4].map(step => (
        <div key={step} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
            createStep >= step ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary}`
          }`}>
            {createStep > step ? <Check className="h-4 w-4" /> : step}
          </div>
          {step < 4 && <div className={`w-8 h-0.5 mx-1 ${createStep > step ? 'bg-[#6366f1]' : bgSecondary}`} />}
        </div>
      ))}
    </div>
  );

  // Step 1: Type and Platform Selection
  if (createStep === 1 && !isEdit) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`${bgCard} ${textPrimary} max-w-2xl`}>
          <DialogHeader><DialogTitle className="text-xl">Create Website Project</DialogTitle></DialogHeader>
          <StepIndicator />
          
          <div className="space-y-6 py-2">
            {/* Website Type Selection */}
            <div>
              <label className={`text-base font-semibold ${textPrimary} block mb-3`}>Select Website Type</label>
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
              <label className={`text-base font-semibold ${textPrimary} block mb-3`}>Select Platform</label>
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
              Next: Requirements
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2: Dynamic Requirements based on Type
  if (createStep === 2 && !isEdit) {
    const config = getRequirementsConfig();
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`${bgCard} ${textPrimary} max-w-3xl max-h-[85vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle className="text-xl">Project Requirements</DialogTitle>
            <p className={`text-sm ${textSecondary}`}>{project.platform} • {project.website_type}</p>
          </DialogHeader>
          <StepIndicator />
          
          <div className="space-y-6 py-2">
            {config.sections.map((section, idx) => (
              <div key={idx} className={`p-4 rounded-lg border ${borderColor}`}>
                <h3 className={`font-semibold ${textPrimary} mb-4`}>{section.title}</h3>
                <div className="grid grid-cols-1 gap-4">
                  {section.fields.map(field => (
                    <div key={field}>
                      <label className={`text-sm ${textSecondary} block mb-1`}>{fieldLabels[field] || field}</label>
                      {['about_text', 'services_list', 'testimonials', 'collections_list', 'core_features', 'bio', 'experience'].includes(field) ? (
                        <Textarea
                          value={project.requirements?.[field] || ''}
                          onChange={(e) => setProject({ ...project, requirements: { ...project.requirements, [field]: e.target.value } })}
                          placeholder={`Enter ${fieldLabels[field] || field}...`}
                          className={bgSecondary}
                          rows={3}
                        />
                      ) : (
                        <Input
                          value={project.requirements?.[field] || ''}
                          onChange={(e) => setProject({ ...project, requirements: { ...project.requirements, [field]: e.target.value } })}
                          placeholder={`Enter ${fieldLabels[field] || field}...`}
                          className={bgSecondary}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <p className={`text-xs ${textSecondary} italic`}>
              You can skip optional fields and fill them later from the project details.
            </p>
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>Back</Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setCreateStep(4)}>Skip to Details</Button>
              <Button onClick={handleNext} className="bg-[#6366f1] hover:bg-[#4f46e5]">Next: Branding</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 3: Branding Information
  if (createStep === 3 && !isEdit) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`${bgCard} ${textPrimary} max-w-2xl`}>
          <DialogHeader>
            <DialogTitle className="text-xl">Branding Information</DialogTitle>
            <p className={`text-sm ${textSecondary}`}>{project.platform} • {project.website_type}</p>
          </DialogHeader>
          <StepIndicator />
          
          <div className="space-y-6 py-2">
            {/* Logo & Favicon */}
            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h3 className={`font-semibold ${textPrimary} mb-4`}>Logo & Assets</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Logo URL</label>
                  <Input
                    value={project.branding?.logo_url || ''}
                    onChange={(e) => setProject({ ...project, branding: { ...project.branding, logo_url: e.target.value } })}
                    placeholder="https://drive.google.com/..."
                    className={bgSecondary}
                  />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Favicon URL</label>
                  <Input
                    value={project.branding?.favicon_url || ''}
                    onChange={(e) => setProject({ ...project, branding: { ...project.branding, favicon_url: e.target.value } })}
                    placeholder="https://drive.google.com/..."
                    className={bgSecondary}
                  />
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h3 className={`font-semibold ${textPrimary} mb-4`}>Color Palette</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Primary Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={project.branding?.primary_color || '#6366f1'}
                      onChange={(e) => setProject({ ...project, branding: { ...project.branding, primary_color: e.target.value } })}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={project.branding?.primary_color || ''}
                      onChange={(e) => setProject({ ...project, branding: { ...project.branding, primary_color: e.target.value } })}
                      placeholder="#6366f1"
                      className={`flex-1 ${bgSecondary}`}
                    />
                  </div>
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Secondary Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={project.branding?.secondary_color || '#22c55e'}
                      onChange={(e) => setProject({ ...project, branding: { ...project.branding, secondary_color: e.target.value } })}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={project.branding?.secondary_color || ''}
                      onChange={(e) => setProject({ ...project, branding: { ...project.branding, secondary_color: e.target.value } })}
                      placeholder="#22c55e"
                      className={`flex-1 ${bgSecondary}`}
                    />
                  </div>
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Accent Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={project.branding?.accent_color || '#f59e0b'}
                      onChange={(e) => setProject({ ...project, branding: { ...project.branding, accent_color: e.target.value } })}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={project.branding?.accent_color || ''}
                      onChange={(e) => setProject({ ...project, branding: { ...project.branding, accent_color: e.target.value } })}
                      placeholder="#f59e0b"
                      className={`flex-1 ${bgSecondary}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Fonts & Guidelines */}
            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h3 className={`font-semibold ${textPrimary} mb-4`}>Typography & Guidelines</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Primary Font</label>
                  <Input
                    value={project.branding?.primary_font || ''}
                    onChange={(e) => setProject({ ...project, branding: { ...project.branding, primary_font: e.target.value } })}
                    placeholder="Inter, Roboto, etc."
                    className={bgSecondary}
                  />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Secondary Font</label>
                  <Input
                    value={project.branding?.secondary_font || ''}
                    onChange={(e) => setProject({ ...project, branding: { ...project.branding, secondary_font: e.target.value } })}
                    placeholder="Playfair Display, etc."
                    className={bgSecondary}
                  />
                </div>
                <div className="col-span-2">
                  <label className={`text-sm ${textSecondary} block mb-1`}>Brand Guidelines URL</label>
                  <Input
                    value={project.branding?.guidelines_url || ''}
                    onChange={(e) => setProject({ ...project, branding: { ...project.branding, guidelines_url: e.target.value } })}
                    placeholder="Link to brand guidelines document"
                    className={bgSecondary}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>Back</Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setCreateStep(4)}>Skip</Button>
              <Button onClick={handleNext} className="bg-[#6366f1] hover:bg-[#4f46e5]">Next: Project Details</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 4: Full Project Details Form
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${bgCard} ${textPrimary} max-w-4xl max-h-[85vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEdit ? title : 'Project Details'}
          </DialogTitle>
          {!isEdit && (
            <p className={`text-sm ${textSecondary}`}>
              {project.platform} • {project.website_type}
              <Button variant="link" size="sm" className="text-[#6366f1] ml-2" onClick={() => setCreateStep(1)}>Change</Button>
            </p>
          )}
        </DialogHeader>
        
        {!isEdit && (
          <div className="flex items-center justify-center gap-2 mb-4">
            {[1, 2, 3, 4].map(step => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  createStep >= step ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary}`
                }`}>
                  {createStep > step ? <Check className="h-4 w-4" /> : step}
                </div>
                {step < 4 && <div className={`w-8 h-0.5 mx-1 ${createStep > step ? 'bg-[#6366f1]' : bgSecondary}`} />}
              </div>
            ))}
          </div>
        )}
        
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

        <DialogFooter className="mt-4 flex justify-between">
          {!isEdit && <Button variant="outline" onClick={handleBack}>Back</Button>}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={onSubmit} className="bg-[#6366f1] hover:bg-[#5855eb]">{isEdit ? 'Update' : 'Create'} Project</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WebsiteProjectsPage;
