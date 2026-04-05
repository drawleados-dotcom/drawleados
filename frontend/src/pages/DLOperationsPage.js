import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Globe, Plus, Search, Eye, ArrowRight, FolderKanban, 
  Calendar, FileText, LayoutGrid, ListTodo, Filter, X, Check, User, Building2,
  Palette, Type, Link2, Users, Settings, Play, Square, Pencil, Trash2, ExternalLink, Clock,
  Video, CheckSquare, ClipboardList, UserCircle, ArrowUpDown
} from 'lucide-react';
import { Progress } from '../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Website Types
const WEBSITE_TYPES = ['Landing Page', 'Business Website', 'Ecommerce', 'Web App'];

// Platform options based on website type
const PLATFORM_OPTIONS = {
  'Landing Page': ['WordPress', 'Wix', 'Webflow', 'Framer', 'AI Builder', 'Custom Code'],
  'Business Website': ['WordPress', 'Wix', 'Webflow', 'Framer', 'AI Builder', 'Custom Code'],
  'Ecommerce': ['Shopify', 'Wix', 'WooCommerce'],
  'Web App': ['AI Builder', 'Custom Code']
};

// Dynamic requirements based on website type
const REQUIREMENTS_CONFIG = {
  'Landing Page': {
    sections: [
      { title: 'Content', fields: ['business_name', 'tagline', 'about_text', 'cta_text'] },
      { title: 'Contact', fields: ['contact_info', 'social_links'] }
    ]
  },
  'Business Website': {
    sections: [
      { title: 'Business Info', fields: ['business_name', 'tagline', 'about_text'] },
      { title: 'Content', fields: ['services_list', 'team_info', 'testimonials'] },
      { title: 'Contact', fields: ['contact_info', 'social_links'] }
    ]
  },
  'Ecommerce': {
    sections: [
      { title: 'Store Info', fields: ['store_name', 'product_categories', 'products_count'] },
      { title: 'Collections', fields: ['collections_list', 'variants_info'] },
      { title: 'Policies', fields: ['shipping_zones', 'payment_methods', 'return_policy'] }
    ]
  },
  'Web App': {
    sections: [
      { title: 'App Info', fields: ['app_name', 'description', 'core_features'] },
      { title: 'Technical', fields: ['user_roles', 'integrations', 'tech_stack'] },
      { title: 'Auth & API', fields: ['auth_method', 'api_requirements'] }
    ]
  }
};

// Field labels
const FIELD_LABELS = {
  business_name: 'Business Name', tagline: 'Tagline', about_text: 'About Text',
  services_list: 'Services (one per line)', cta_text: 'Call to Action Text', contact_info: 'Contact Information',
  team_info: 'Team Information', testimonials: 'Testimonials', social_links: 'Social Media Links',
  store_name: 'Store Name', product_categories: 'Product Categories', products_count: 'Approx. Products Count',
  collections_list: 'Collections List', variants_info: 'Product Variants Info', shipping_zones: 'Shipping Zones',
  payment_methods: 'Payment Methods', return_policy: 'Return/Refund Policy', app_name: 'Application Name',
  description: 'Description', core_features: 'Core Features', user_roles: 'User Roles',
  integrations: 'Required Integrations', tech_stack: 'Tech Stack', api_requirements: 'API Requirements',
  auth_method: 'Authentication Method'
};

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

// Stage to assignee field mapping
const STAGE_ASSIGNEE_MAP = {
  'content': 'content_assignee',
  'wireframe': 'wireframe_assignee',
  'ui': 'ui_assignee',
  'development': 'dev_assignee',
  'responsive': 'responsive_assignee',
  'testing': 'test_assignee',
  'delivery': 'delivery_assignee'
};

// Task Stages (for task-level tracking - excludes creation/discovery/delivered)
const TASK_STAGES = [
  { id: 'all', label: 'All Tasks', color: 'bg-[#6366f1]' },
  { id: 'content', label: 'Content', color: 'bg-blue-500' },
  { id: 'wireframe', label: 'Wireframe', color: 'bg-purple-500' },
  { id: 'ui', label: 'UI Design', color: 'bg-pink-500' },
  { id: 'development', label: 'Development', color: 'bg-green-500' },
  { id: 'responsive', label: 'Responsive', color: 'bg-teal-500' },
  { id: 'testing', label: 'Testing', color: 'bg-cyan-500' },
  { id: 'delivery', label: 'Delivery', color: 'bg-emerald-500' }
];

export default function DLOperationsPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]); // All page tasks from all projects
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [workflowStage, setWorkflowStage] = useState('all');
  const [developerFilter, setDeveloperFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [teamMembers, setTeamMembers] = useState([]);
  const [mainTab, setMainTab] = useState('dashboard'); // dashboard | projects
  const [showFilters, setShowFilters] = useState(false);
  
  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => new Date().toISOString().split('T')[0];
  const getCurrentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM
  
  // Part 1 - Project Overview Filters (default to current date)
  const [overviewDateType, setOverviewDateType] = useState('date'); // all, date, range, month, year
  const [overviewDate, setOverviewDate] = useState(getCurrentDate());
  const [overviewDateStart, setOverviewDateStart] = useState('');
  const [overviewDateEnd, setOverviewDateEnd] = useState('');
  const [overviewMonth, setOverviewMonth] = useState(getCurrentMonth());
  const [overviewYear, setOverviewYear] = useState(new Date().getFullYear().toString());
  
  // Part 2 - Stage Task Board (default to current date)
  const [taskDateType, setTaskDateType] = useState('date'); // date, range, month
  const [taskDate, setTaskDate] = useState(getCurrentDate());
  const [taskDateStart, setTaskDateStart] = useState('');
  const [taskDateEnd, setTaskDateEnd] = useState('');
  const [taskMonth, setTaskMonth] = useState(getCurrentMonth());
  const [taskYear, setTaskYear] = useState(new Date().getFullYear().toString());
  const [taskProjectFilter, setTaskProjectFilter] = useState('all'); // all or specific project_id
  const [selectedTaskStage, setSelectedTaskStage] = useState('all'); // Default to all tasks
  const [taskViewMode, setTaskViewMode] = useState('task'); // task | project
  const [runningTimers, setRunningTimers] = useState({}); // { task_id: { stage, startTime } }
  
  // Project Wise filters
  const [projectStatusFilter, setProjectStatusFilter] = useState('all'); // all, ongoing, delivered, new
  const [projectTypeFilter, setProjectTypeFilter] = useState('all'); // all, ecommerce, business, landing
  
  // Master Board Tab (new tabbed structure)
  const [masterBoardTab, setMasterBoardTab] = useState('tasks'); // tasks, trackboard, pages, team, adtasks, meetings
  
  // Additional Tasks state
  const [additionalTasks, setAdditionalTasks] = useState([]);
  const [showAdTaskModal, setShowAdTaskModal] = useState(false);
  const [newAdTask, setNewAdTask] = useState({
    title: '', description: '', project_id: '', assignee: '', assignee_id: '',
    due_date: '', priority: 'medium', status: 'To-Do', category: '', tags: []
  });
  const [adTaskTimers, setAdTaskTimers] = useState({});
  
  // Meetings state
  const [meetings, setMeetings] = useState([]);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    title: '', description: '', date: '', start_time: '', end_time: '',
    meeting_type: 'video', meeting_link: '', location: '', attendees: [],
    project_id: '', agenda: '', reminder: 15
  });
  
  // Sort state
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
  const [sortField, setSortField] = useState('due_date'); // due_date, priority
  
  // Create Project Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newProject, setNewProject] = useState({
    name: '',
    website_type: '',
    platform: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    client_location: '',
    domain_url: '',
    deadline: '',
    onboarding_date: '',
    notes: '',
    developer: '',
    designer: '',
    content_writer: '',
    project_manager: '',
    // Credentials
    domain_username: '',
    domain_password: '',
    wp_username: '',
    wp_password: '',
    // Links
    client_drive_url: '',
    documents_url: '',
    communication_url: '',
    // Requirements (dynamic based on type)
    requirements: {},
    // Branding
    branding: {
      logo_url: '',
      favicon_url: '',
      primary_color: '#6366f1',
      secondary_color: '#22c55e',
      accent_color: '#f59e0b',
      primary_font: '',
      secondary_font: '',
      guidelines_url: ''
    }
  });
  const [detailsTab, setDetailsTab] = useState('basic');
  
  const token = localStorage.getItem('session_token');
  
  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  
  // ═══════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS (defined BEFORE computed values that use them)
  // ═══════════════════════════════════════════════════════════════════
  
  // Check if user is PM or Operations Head (can see all)
  const isMasterUser = () => {
    if (!user) return false;
    const role = user.role?.toLowerCase() || '';
    const name = user.name?.toLowerCase() || '';
    return role.includes('manager') || role.includes('admin') || role.includes('operations') || 
           role.includes('head') || role.includes('super') || name.includes('vinoth');
  };
  
  // Check if user can act on a specific stage task
  const canActOnTask = (task, stageId) => {
    if (isMasterUser()) return true;
    const assigneeField = STAGE_ASSIGNEE_MAP[stageId];
    if (!assigneeField || !task[assigneeField]) return false;
    const assigneeName = task[assigneeField]?.toLowerCase() || '';
    const userName = user?.name?.toLowerCase() || '';
    return assigneeName.includes(userName) || userName.includes(assigneeName);
  };
  
  // Check if user is assigned to a project (any role)
  const isUserAssignedToProject = (project) => {
    if (isMasterUser()) return true;
    const userName = user?.name?.toLowerCase() || '';
    const assignedRoles = [
      project.developer, project.designer, project.content_writer, project.project_manager
    ].filter(Boolean).map(n => n.toLowerCase());
    return assignedRoles.some(r => r.includes(userName) || userName.includes(r));
  };
  
  // Date filter helper
  const filterByDate = (dateStr, filterType, specificDate, startDate, endDate, month, year) => {
    if (filterType === 'all' || !dateStr) return true;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return true;
    
    if (filterType === 'date' && specificDate) {
      return dateStr === specificDate;
    }
    if (filterType === 'range' && startDate && endDate) {
      return dateStr >= startDate && dateStr <= endDate;
    }
    if (filterType === 'month' && month) {
      const [filterYear, filterMonth] = month.split('-');
      return date.getFullYear() === parseInt(filterYear) && (date.getMonth() + 1) === parseInt(filterMonth);
    }
    if (filterType === 'year' && year) {
      return date.getFullYear() === parseInt(year);
    }
    return true;
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // COMPUTED VALUES (use helper functions defined above)
  // ═══════════════════════════════════════════════════════════════════
  
  // Role-filtered projects (team members see only their assigned projects)
  const roleFilteredProjects = projects.filter(p => isUserAssignedToProject(p));
  
  // Overview date-filtered projects
  const overviewFilteredProjects = roleFilteredProjects.filter(p => {
    const dateToCheck = p.deadline || p.onboarding_date;
    return filterByDate(dateToCheck, overviewDateType, overviewDate, overviewDateStart, overviewDateEnd, overviewMonth, overviewYear);
  });
  
  // Computed stats for Part 1
  const totalProjects = overviewFilteredProjects.length;
  const newProjects = overviewFilteredProjects.filter(p => (p.workflow_stage || 'creation') === 'creation').length;
  const currentProjects = overviewFilteredProjects.filter(p => {
    const stage = p.workflow_stage || 'creation';
    return ['discovery', 'content', 'wireframe', 'ui', 'development', 'responsive', 'testing'].includes(stage);
  }).length;
  const deliveredProjects = overviewFilteredProjects.filter(p => (p.workflow_stage || 'creation') === 'delivered').length;
  
  // Legacy stats (for other parts)
  const uniqueClients = [...new Set(overviewFilteredProjects.map(p => p.client_name).filter(Boolean))].length;
  const uniqueDevelopers = [...new Set(overviewFilteredProjects.map(p => p.developer).filter(Boolean))].length;
  const totalPages = overviewFilteredProjects.reduce((sum, p) => sum + (p.total_pages || 0), 0);
  
  // Get unique values for filters
  const clientNames = [...new Set(roleFilteredProjects.map(p => p.client_name).filter(Boolean))];
  const developerNames = [...new Set(roleFilteredProjects.map(p => p.developer).filter(Boolean))];
  
  // Tasks filtered by stage, date, and project for Part 2
  const getTasksForStage = (stageId) => {
    // Apply date and project filters first to all tasks
    const filteredTasks = allTasks.filter(task => {
      // Date filter
      const dateToCheck = task.due_date;
      const passesDate = filterByDate(dateToCheck, taskDateType, taskDate, taskDateStart, taskDateEnd, taskMonth, '');
      
      // Project filter
      const passesProject = taskProjectFilter === 'all' || task.project_id === taskProjectFilter;
      
      return passesDate && passesProject;
    });
    
    // For "all" tab - show ALL incomplete tasks (any stage not fully completed)
    if (stageId === 'all') {
      return filteredTasks.filter(task => {
        // Check if task is fully completed (all stages done)
        const stageOrder = ['content', 'wireframe', 'ui', 'development', 'responsive', 'testing', 'delivery'];
        const isFullyComplete = stageOrder.every(stage => {
          const status = (task[`${stage}_status`] || 'To-Do').toLowerCase();
          return status === 'completed' || status === 'approved';
        });
        // Show if NOT fully complete (has pending work)
        return !isFullyComplete;
      });
    }
    
    // For specific stages - show tasks that are at this stage
    const stageTasks = filteredTasks.filter(task => {
      const stageStatus = (task[`${stageId}_status`] || 'To-Do').toLowerCase();
      
      // If this stage is completed, don't show it
      if (stageStatus === 'completed' || stageStatus === 'approved') return false;
      
      // For content (first stage), show all non-completed content tasks
      if (stageId === 'content') {
        return true;
      }
      
      // For other stages, check if all previous stages are completed/approved
      const stageOrder = ['content', 'wireframe', 'ui', 'development', 'responsive', 'testing', 'delivery'];
      const currentStageIndex = stageOrder.indexOf(stageId);
      
      // All previous stages should be completed/approved
      for (let i = 0; i < currentStageIndex; i++) {
        const prevStageStatus = (task[`${stageOrder[i]}_status`] || 'To-Do').toLowerCase();
        if (prevStageStatus !== 'completed' && prevStageStatus !== 'approved') {
          return false;
        }
      }
      
      return true;
    });
    
    return stageTasks;
  };
  
  // Get stage task counts
  const getStageCounts = () => {
    const counts = {};
    TASK_STAGES.forEach(stage => {
      counts[stage.id] = getTasksForStage(stage.id).length;
    });
    return counts;
  };
  
  const stageCounts = getStageCounts();
  
  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/website-projects/all-projects-summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data);
      
      // Also load all tasks for the stage task board
      const tasksRes = await axios.get(`${API}/api/website-projects/all-tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllTasks(tasksRes.data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      // If all-tasks endpoint doesn't exist yet, fallback to empty
      setAllTasks([]);
    } finally {
      setLoading(false);
    }
  }, [token]);
  
  // Load team members
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
  
  // Load additional tasks
  const loadAdditionalTasks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/additional-tasks/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdditionalTasks(res.data || []);
    } catch (error) {
      console.error('Error loading additional tasks:', error);
    }
  }, [token]);
  
  // Load meetings
  const loadMeetings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/meetings/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMeetings(res.data || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
    }
  }, [token]);
  
  useEffect(() => {
    loadProjects();
    loadTeamMembers();
    loadAdditionalTasks();
    loadMeetings();
  }, [loadProjects, loadTeamMembers, loadAdditionalTasks, loadMeetings]);
  
  // Open create project modal
  const handleNewProject = () => {
    setShowCreateModal(true);
    setCreateStep(1);
    setDetailsTab('basic');
    setNewProject({
      name: '',
      website_type: '',
      platform: '',
      client_name: '',
      client_email: '',
      client_phone: '',
      client_location: '',
      domain_url: '',
      deadline: '',
      onboarding_date: '',
      notes: '',
      developer: '',
      designer: '',
      content_writer: '',
      project_manager: '',
      domain_username: '',
      domain_password: '',
      wp_username: '',
      wp_password: '',
      client_drive_url: '',
      documents_url: '',
      communication_url: '',
      requirements: {},
      branding: {
        logo_url: '',
        favicon_url: '',
        primary_color: '#6366f1',
        secondary_color: '#22c55e',
        accent_color: '#f59e0b',
        primary_font: '',
        secondary_font: '',
        guidelines_url: ''
      }
    });
  };
  
  // Create project
  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast.error('Please enter a project name');
      return;
    }
    if (!newProject.website_type || !newProject.platform) {
      toast.error('Please select website type and platform');
      return;
    }
    
    try {
      const projectData = {
        ...newProject,
        workflow_stage: 'creation',
        status: 'active'
      };
      
      await axios.post(
        `${API}/api/website-projects/projects`,
        projectData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Project created successfully!');
      setShowCreateModal(false);
      loadProjects();
    } catch (error) {
      toast.error('Failed to create project');
    }
  };
  
  // Close create modal
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateStep(1);
  };
  
  // Open project detail page (navigate instead of modal)
  const openProject = (projectId) => {
    navigate(`/project/${projectId}`);
  };
  
  // Start timer for a task stage
  const handleStartTimer = async (taskId, stage) => {
    try {
      // Update status to In Progress
      await axios.put(
        `${API}/api/website-projects/pages/${taskId}/stage-status`,
        { stage: stage, status: 'In Progress' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Start timer locally
      setRunningTimers(prev => ({
        ...prev,
        [taskId]: { stage, startTime: Date.now() }
      }));
      
      toast.success(`Timer started for ${stage}`);
      loadProjects();
    } catch (error) {
      toast.error('Failed to start timer');
    }
  };
  
  // Stop timer for a task stage
  const handleStopTimer = async (taskId, stage) => {
    try {
      const timerInfo = runningTimers[taskId];
      if (timerInfo) {
        const elapsedSeconds = Math.floor((Date.now() - timerInfo.startTime) / 1000);
        
        // Update time spent on backend
        await axios.put(
          `${API}/api/website-projects/pages/${taskId}/add-time`,
          { stage: stage, seconds: elapsedSeconds },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      // Remove from running timers
      setRunningTimers(prev => {
        const newTimers = { ...prev };
        delete newTimers[taskId];
        return newTimers;
      });
      
      toast.success(`Timer stopped`);
      loadProjects();
    } catch (error) {
      toast.error('Failed to stop timer');
    }
  };
  
  // Format time display (seconds to HH:MM:SS)
  const formatTime = (seconds) => {
    if (!seconds) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // ADDITIONAL TASKS FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════
  
  const handleCreateAdTask = async () => {
    if (!newAdTask.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }
    try {
      await axios.post(`${API}/api/additional-tasks/`, newAdTask, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task created!');
      setShowAdTaskModal(false);
      setNewAdTask({ title: '', description: '', project_id: '', assignee: '', assignee_id: '', due_date: '', priority: 'medium', status: 'To-Do', category: '', tags: [] });
      loadAdditionalTasks();
    } catch (error) {
      toast.error('Failed to create task');
    }
  };
  
  const handleUpdateAdTaskStatus = async (taskId, status) => {
    try {
      await axios.put(`${API}/api/additional-tasks/${taskId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadAdditionalTasks();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };
  
  const handleDeleteAdTask = async (taskId) => {
    try {
      await axios.delete(`${API}/api/additional-tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task deleted');
      loadAdditionalTasks();
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };
  
  const handleStartAdTaskTimer = (taskId) => {
    handleUpdateAdTaskStatus(taskId, 'In Progress');
    setAdTaskTimers(prev => ({ ...prev, [taskId]: { startTime: Date.now() } }));
  };
  
  const handleStopAdTaskTimer = async (taskId) => {
    const timerInfo = adTaskTimers[taskId];
    if (timerInfo) {
      const elapsedSeconds = Math.floor((Date.now() - timerInfo.startTime) / 1000);
      try {
        await axios.put(`${API}/api/additional-tasks/${taskId}/add-time`, { seconds: elapsedSeconds }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAdTaskTimers(prev => { const n = {...prev}; delete n[taskId]; return n; });
        loadAdditionalTasks();
      } catch (error) {
        toast.error('Failed to save time');
      }
    }
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // MEETINGS FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════
  
  const handleCreateMeeting = async () => {
    if (!newMeeting.title.trim() || !newMeeting.date || !newMeeting.start_time) {
      toast.error('Please fill in title, date, and start time');
      return;
    }
    try {
      await axios.post(`${API}/api/meetings/`, newMeeting, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Meeting scheduled!');
      setShowMeetingModal(false);
      setNewMeeting({ title: '', description: '', date: '', start_time: '', end_time: '', meeting_type: 'video', meeting_link: '', location: '', attendees: [], project_id: '', agenda: '', reminder: 15 });
      loadMeetings();
    } catch (error) {
      toast.error('Failed to create meeting');
    }
  };
  
  const handleUpdateMeetingStatus = async (meetingId, status) => {
    try {
      await axios.put(`${API}/api/meetings/${meetingId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadMeetings();
    } catch (error) {
      toast.error('Failed to update meeting');
    }
  };
  
  const handleDeleteMeeting = async (meetingId) => {
    try {
      await axios.delete(`${API}/api/meetings/${meetingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Meeting deleted');
      loadMeetings();
    } catch (error) {
      toast.error('Failed to delete meeting');
    }
  };
  
  // Sort helper
  const sortItems = (items, field, order) => {
    return [...items].sort((a, b) => {
      let valA = a[field] || '';
      let valB = b[field] || '';
      if (field === 'due_date' || field === 'date') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      }
      if (field === 'priority') {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        valA = priorityOrder[valA?.toLowerCase()] || 0;
        valB = priorityOrder[valB?.toLowerCase()] || 0;
      }
      return order === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  };
  
  // Handle stage transition
  const handleStageTransition = async (projectId, newStage) => {
    try {
      await axios.put(
        `${API}/api/website-projects/projects/${projectId}/transition`,
        { stage: newStage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Project moved to ${WORKFLOW_STAGES.find(s => s.id === newStage)?.label || newStage}`);
      loadProjects();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to move project';
      toast.error(errorMsg);
    }
  };
  
  // Get next stage
  const getNextStage = (currentStage) => {
    const stages = ['creation', 'discovery', 'content', 'wireframe', 'ui', 'development', 'testing', 'delivered'];
    const currentIndex = stages.indexOf(currentStage || 'creation');
    if (currentIndex < stages.length - 1) {
      return stages[currentIndex + 1];
    }
    return null;
  };
  
  if (loading) {
    return (
      <Layout>
        <div className={`flex items-center justify-center h-full ${textPrimary}`}>Loading...</div>
      </Layout>
    );
  }
  
  // Filter projects for Projects tab
  const filteredProjects = roleFilteredProjects.filter(project => {
    const matchesSearch = !searchTerm || 
      project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = workflowStage === 'all' || (project.workflow_stage || 'creation') === workflowStage;
    const matchesDeveloper = developerFilter === 'all' || project.developer === developerFilter;
    const matchesClient = clientFilter === 'all' || project.client_name === clientFilter;
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStage && matchesDeveloper && matchesClient && matchesStatus;
  });
  
  return (
    <Layout>
      <div className="flex flex-col h-full pb-16 md:pb-0" data-testid="dl-operations-page">
        {/* Title Row - Fixed at top */}
        <div className={`shrink-0 p-4 md:p-6 border-b ${borderColor} ${isDark ? 'bg-[#0c0a09]' : 'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className={`text-xl md:text-2xl font-bold ${textPrimary}`}>Website Developments</h1>
                {!isMasterUser() && (
                  <p className={`text-xs ${textSecondary}`}>Showing your assigned projects</p>
                )}
              </div>
            </div>
            <Button 
              onClick={handleNewProject}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              data-testid="new-project-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>
        
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PART 1: PROJECT OVERVIEW SECTION - Collapsible */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className={`shrink-0 p-4 md:p-6 border-b ${borderColor} ${bgCard}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${textPrimary}`}>Project Overview</h2>
            
            {/* Date Filter for Overview */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={overviewDateType} onValueChange={setOverviewDateType}>
                <SelectTrigger className={`w-24 h-8 ${bgSecondary} border-none text-xs`}>
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="range">Range</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>
              
              {overviewDateType === 'date' && (
                <Input
                  type="date"
                  value={overviewDate}
                  onChange={(e) => setOverviewDate(e.target.value)}
                  className={`w-36 h-8 ${bgSecondary} border-none text-xs`}
                />
              )}
              
              {overviewDateType === 'range' && (
                <>
                  <Input
                    type="date"
                    value={overviewDateStart}
                    onChange={(e) => setOverviewDateStart(e.target.value)}
                    className={`w-32 h-8 ${bgSecondary} border-none text-xs`}
                    placeholder="Start"
                  />
                  <span className={textSecondary}>to</span>
                  <Input
                    type="date"
                    value={overviewDateEnd}
                    onChange={(e) => setOverviewDateEnd(e.target.value)}
                    className={`w-32 h-8 ${bgSecondary} border-none text-xs`}
                    placeholder="End"
                  />
                </>
              )}
              
              {overviewDateType === 'month' && (
                <Input
                  type="month"
                  value={overviewMonth}
                  onChange={(e) => setOverviewMonth(e.target.value)}
                  className={`w-36 h-8 ${bgSecondary} border-none text-xs`}
                />
              )}
              
              {overviewDateType === 'year' && (
                <Select value={overviewYear} onValueChange={setOverviewYear}>
                  <SelectTrigger className={`w-24 h-8 ${bgSecondary} border-none text-xs`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          
          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Projects */}
            <div 
              className={`p-4 rounded-xl ${bgSecondary} cursor-pointer hover:ring-2 hover:ring-[#6366f1]/50 transition-all`}
              onClick={() => { setMainTab('projects'); setWorkflowStage('all'); }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs ${textSecondary}`}>Total Projects</p>
                <FolderKanban className="h-4 w-4 text-[#6366f1]" />
              </div>
              <p className={`text-3xl font-bold ${textPrimary}`}>{totalProjects}</p>
            </div>
            
            {/* New Projects (Creation stage) */}
            <div 
              className={`p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 cursor-pointer hover:ring-2 hover:ring-yellow-500/50 transition-all`}
              onClick={() => { setMainTab('projects'); setWorkflowStage('creation'); }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs ${textSecondary}`}>New Projects</p>
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
              </div>
              <p className="text-3xl font-bold text-yellow-500">{newProjects}</p>
              <p className={`text-xs ${textSecondary}`}>Not started</p>
            </div>
            
            {/* Current Projects (Discovery → Testing) */}
            <div 
              className={`p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all`}
              onClick={() => { setMainTab('projects'); setWorkflowStage('all'); setStatusFilter('active'); }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs ${textSecondary}`}>Current Projects</p>
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
              </div>
              <p className="text-3xl font-bold text-blue-500">{currentProjects}</p>
              <p className={`text-xs ${textSecondary}`}>In progress</p>
            </div>
            
            {/* Delivered */}
            <div 
              className={`p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer hover:ring-2 hover:ring-emerald-500/50 transition-all`}
              onClick={() => { setMainTab('projects'); setWorkflowStage('delivered'); }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs ${textSecondary}`}>Delivered</p>
                <Check className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-3xl font-bold text-emerald-500">{deliveredProjects}</p>
              <p className={`text-xs ${textSecondary}`}>Completed</p>
            </div>
          </div>
        </div>
        
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PART 2: MASTER BOARD - Fixed Header + Tabbed Content */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className={`flex-1 flex flex-col min-h-0 ${bgCard}`}>
          {/* MASTER BOARD TABS */}
          <div className={`shrink-0 p-4 border-b ${borderColor} ${bgCard}`}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                {[
                  { id: 'tasks', label: 'Tasks', icon: ListTodo },
                  { id: 'trackboard', label: 'Trackboard', icon: ClipboardList },
                  { id: 'pages', label: 'Pages', icon: FileText },
                  { id: 'team', label: 'Team', icon: Users },
                  { id: 'adtasks', label: 'Ad.Tasks', icon: CheckSquare },
                  { id: 'meetings', label: 'Meeting', icon: Video }
                ].map(tab => (
                  <Button
                    key={tab.id}
                    size="sm"
                    variant={masterBoardTab === tab.id ? 'default' : 'ghost'}
                    onClick={() => setMasterBoardTab(tab.id)}
                    className={`h-9 gap-2 shrink-0 ${masterBoardTab === tab.id ? 'bg-[#6366f1]' : ''}`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </Button>
                ))}
              </div>
              
              {/* Sort Toggle (visible for lists) */}
              {['tasks', 'adtasks', 'meetings'].includes(masterBoardTab) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="h-8 gap-2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
                </Button>
              )}
              
              {/* Add Buttons per Tab */}
              {masterBoardTab === 'adtasks' && (
                <Button size="sm" onClick={() => setShowAdTaskModal(true)} className="bg-[#6366f1] h-8">
                  <Plus className="h-4 w-4 mr-1" /> Add Task
                </Button>
              )}
              {masterBoardTab === 'meetings' && (
                <Button size="sm" onClick={() => setShowMeetingModal(true)} className="bg-[#6366f1] h-8">
                  <Plus className="h-4 w-4 mr-1" /> Schedule Meeting
                </Button>
              )}
            </div>
            
            {/* SUB-FILTERS FOR TASKS TAB */}
            {masterBoardTab === 'tasks' && (
              <>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    {/* Task Wise / Project Wise Toggle */}
                    <div className={`inline-flex rounded-lg p-1 ${bgSecondary}`}>
                      <Button 
                        size="sm" 
                        variant={taskViewMode === 'task' ? 'default' : 'ghost'}
                        onClick={() => setTaskViewMode('task')}
                        className={`h-7 text-xs ${taskViewMode === 'task' ? 'bg-[#6366f1]' : ''}`}
                      >
                        Task Wise
                      </Button>
                      <Button 
                        size="sm" 
                        variant={taskViewMode === 'project' ? 'default' : 'ghost'}
                        onClick={() => setTaskViewMode('project')}
                        className={`h-7 text-xs ${taskViewMode === 'project' ? 'bg-[#6366f1]' : ''}`}
                      >
                        Project Wise
                      </Button>
                    </div>
                  </div>
              
              {/* FILTERS - Different for Task Wise vs Project Wise */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Date Filter - Common for both */}
                <div className="flex items-center gap-2">
                  <Select value={taskDateType} onValueChange={setTaskDateType}>
                    <SelectTrigger className={`w-28 h-8 ${bgSecondary} border-none text-xs`}>
                      <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="range">Date Range</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {taskDateType === 'date' && (
                    <Input
                      type="date"
                      value={taskDate}
                      onChange={(e) => setTaskDate(e.target.value)}
                      className={`w-36 h-8 ${bgSecondary} border-none text-xs`}
                    />
                  )}
                  
                  {taskDateType === 'range' && (
                    <>
                      <Input
                        type="date"
                        value={taskDateStart}
                        onChange={(e) => setTaskDateStart(e.target.value)}
                        className={`w-32 h-8 ${bgSecondary} border-none text-xs`}
                      />
                      <span className={textSecondary}>to</span>
                      <Input
                        type="date"
                        value={taskDateEnd}
                        onChange={(e) => setTaskDateEnd(e.target.value)}
                        className={`w-32 h-8 ${bgSecondary} border-none text-xs`}
                      />
                    </>
                  )}
                  
                  {taskDateType === 'month' && (
                    <Input
                      type="month"
                      value={taskMonth}
                      onChange={(e) => setTaskMonth(e.target.value)}
                      className={`w-36 h-8 ${bgSecondary} border-none text-xs`}
                    />
                  )}
                  
                  {taskDateType === 'year' && (
                    <Select value={taskYear} onValueChange={setTaskYear}>
                      <SelectTrigger className={`w-24 h-8 ${bgSecondary} border-none text-xs`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026].map(y => (
                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                {/* Task Wise: Project Filter */}
                {taskViewMode === 'task' && (
                  <Select value={taskProjectFilter} onValueChange={setTaskProjectFilter}>
                    <SelectTrigger className={`w-48 h-8 ${bgSecondary} border-none text-xs`}>
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {roleFilteredProjects.map(p => (
                        <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            
            {/* Task Wise: Stage Tabs */}
            {taskViewMode === 'task' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
                {TASK_STAGES.map(stage => {
                  const count = stageCounts[stage.id] || 0;
                  return (
                    <Button
                      key={stage.id}
                      size="sm"
                      variant={selectedTaskStage === stage.id ? 'default' : 'outline'}
                      onClick={() => setSelectedTaskStage(stage.id)}
                      className={`h-9 gap-2 shrink-0 ${selectedTaskStage === stage.id ? stage.color.replace('bg-', 'bg-') : ''}`}
                      style={selectedTaskStage === stage.id ? { backgroundColor: stage.color.includes('blue') ? '#3b82f6' : stage.color.includes('purple') ? '#a855f7' : stage.color.includes('pink') ? '#ec4899' : stage.color.includes('green') ? '#22c55e' : stage.color.includes('teal') ? '#14b8a6' : stage.color.includes('cyan') ? '#06b6d4' : stage.color.includes('emerald') ? '#10b981' : '#6366f1' } : {}}
                    >
                      <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                      {stage.label}
                      <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
                    </Button>
                  );
                })}
              </div>
            )}
            
            {/* Project Wise: Status & Type Filter Tabs */}
            {taskViewMode === 'project' && (
              <div className="flex items-center gap-4 flex-wrap">
                {/* Status Filter: Ongoing | Delivered | New */}
                <div className={`inline-flex rounded-lg p-1 ${bgSecondary}`}>
                  <Button 
                    size="sm" 
                    variant={projectStatusFilter === 'all' ? 'default' : 'ghost'}
                    onClick={() => setProjectStatusFilter('all')}
                    className={`h-7 text-xs ${projectStatusFilter === 'all' ? 'bg-[#6366f1]' : ''}`}
                  >
                    All
                  </Button>
                  <Button 
                    size="sm" 
                    variant={projectStatusFilter === 'ongoing' ? 'default' : 'ghost'}
                    onClick={() => setProjectStatusFilter('ongoing')}
                    className={`h-7 text-xs ${projectStatusFilter === 'ongoing' ? 'bg-blue-500' : ''}`}
                  >
                    Ongoing
                  </Button>
                  <Button 
                    size="sm" 
                    variant={projectStatusFilter === 'delivered' ? 'default' : 'ghost'}
                    onClick={() => setProjectStatusFilter('delivered')}
                    className={`h-7 text-xs ${projectStatusFilter === 'delivered' ? 'bg-emerald-500' : ''}`}
                  >
                    Delivered
                  </Button>
                  <Button 
                    size="sm" 
                    variant={projectStatusFilter === 'new' ? 'default' : 'ghost'}
                    onClick={() => setProjectStatusFilter('new')}
                    className={`h-7 text-xs ${projectStatusFilter === 'new' ? 'bg-yellow-500' : ''}`}
                  >
                    New
                  </Button>
                </div>
                
                {/* Type Filter: Ecommerce | Business | Landing Pages */}
                <div className={`inline-flex rounded-lg p-1 ${bgSecondary}`}>
                  <Button 
                    size="sm" 
                    variant={projectTypeFilter === 'all' ? 'default' : 'ghost'}
                    onClick={() => setProjectTypeFilter('all')}
                    className={`h-7 text-xs ${projectTypeFilter === 'all' ? 'bg-[#6366f1]' : ''}`}
                  >
                    All Types
                  </Button>
                  <Button 
                    size="sm" 
                    variant={projectTypeFilter === 'ecommerce' ? 'default' : 'ghost'}
                    onClick={() => setProjectTypeFilter('ecommerce')}
                    className={`h-7 text-xs ${projectTypeFilter === 'ecommerce' ? 'bg-purple-500' : ''}`}
                  >
                    Ecommerce
                  </Button>
                  <Button 
                    size="sm" 
                    variant={projectTypeFilter === 'business' ? 'default' : 'ghost'}
                    onClick={() => setProjectTypeFilter('business')}
                    className={`h-7 text-xs ${projectTypeFilter === 'business' ? 'bg-blue-500' : ''}`}
                  >
                    Business
                  </Button>
                  <Button 
                    size="sm" 
                    variant={projectTypeFilter === 'landing' ? 'default' : 'ghost'}
                    onClick={() => setProjectTypeFilter('landing')}
                    className={`h-7 text-xs ${projectTypeFilter === 'landing' ? 'bg-teal-500' : ''}`}
                  >
                    Landing Pages
                  </Button>
                </div>
              </div>
            )}
              </>
            )}
          </div>
          
          {/* SCROLLABLE Content Area */}
          <div className="flex-1 overflow-auto p-4">
            {/* TASKS TAB */}
            {masterBoardTab === 'tasks' && (
              <>
                {taskViewMode === 'project' ? (
              /* Project Wise View - Simple List of Projects */
              <div className="space-y-3">
                {(() => {
                  // Filter projects based on status and type
                  const filteredProjs = roleFilteredProjects.filter(p => {
                    // Status filter
                    const stage = p.workflow_stage || 'creation';
                    if (projectStatusFilter === 'new' && stage !== 'creation') return false;
                    if (projectStatusFilter === 'delivered' && stage !== 'delivered') return false;
                    if (projectStatusFilter === 'ongoing' && (stage === 'creation' || stage === 'delivered')) return false;
                    
                    // Type filter
                    const type = (p.website_type || '').toLowerCase();
                    if (projectTypeFilter === 'ecommerce' && !type.includes('ecommerce') && !type.includes('e-commerce')) return false;
                    if (projectTypeFilter === 'business' && !type.includes('business')) return false;
                    if (projectTypeFilter === 'landing' && !type.includes('landing')) return false;
                    
                    // Date filter
                    const dateToCheck = p.deadline || p.onboarding_date;
                    return filterByDate(dateToCheck, taskDateType, taskDate, taskDateStart, taskDateEnd, taskMonth, taskYear);
                  });
                  
                  if (filteredProjs.length === 0) {
                    return (
                      <div className={`text-center py-12 ${textSecondary}`}>
                        <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No projects found</p>
                      </div>
                    );
                  }
                  
                  return filteredProjs.map(project => {
                    const workflowStage = WORKFLOW_STAGES.find(s => s.id === (project.workflow_stage || 'creation'));
                    
                    return (
                      <div 
                        key={project.project_id}
                        className={`p-4 rounded-xl border ${borderColor} ${bgSecondary} hover:border-[#6366f1]/50 transition-all cursor-pointer`}
                        onClick={() => navigate(`/project/${project.project_id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                              <Globe className="h-5 w-5 text-[#6366f1]" />
                            </div>
                            <div>
                              <p className={`font-semibold ${textPrimary}`}>{project.name}</p>
                              <p className={`text-sm ${textSecondary}`}>{project.client_name || 'No Client'} • {project.website_type || 'Website'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <Badge className={`${workflowStage?.color}/20`} style={{ color: workflowStage?.color?.includes('yellow') ? '#eab308' : workflowStage?.color?.includes('blue') ? '#3b82f6' : workflowStage?.color?.includes('green') ? '#22c55e' : '#6366f1' }}>
                              {workflowStage?.label || 'Creation'}
                            </Badge>
                            <Button size="sm" variant="outline" className="h-8">
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              /* Task Wise View - Tracker Table Format */
              <div className={`rounded-xl border ${borderColor} ${bgCard} overflow-hidden`}>
                <table className="w-full">
                  <thead className={bgSecondary}>
                    <tr className={`text-xs ${textSecondary} uppercase`}>
                      <th className="px-4 py-3 text-left font-semibold">Task</th>
                      <th className="px-3 py-3 text-center font-semibold">Status</th>
                      <th className="px-3 py-3 text-left font-semibold">Assigned</th>
                      <th className="px-3 py-3 text-center font-semibold">Due Date</th>
                      <th className="px-3 py-3 text-center font-semibold">Link</th>
                      <th className="px-3 py-3 text-center font-semibold">Time</th>
                      <th className="px-3 py-3 text-center font-semibold">Timer</th>
                      <th className="px-3 py-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getTasksForStage(selectedTaskStage).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center">
                          <div className={textSecondary}>
                            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No tasks for the selected filters</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      getTasksForStage(selectedTaskStage).map(task => {
                        // Determine current stage of the task
                        const stageOrder = ['content', 'wireframe', 'ui', 'development', 'responsive', 'testing', 'delivery'];
                        let currentStage = 'content';
                        for (const stage of stageOrder) {
                          const status = (task[`${stage}_status`] || 'To-Do').toLowerCase();
                          if (status !== 'completed' && status !== 'approved') {
                            currentStage = stage;
                            break;
                          }
                        }
                        
                        const displayStage = selectedTaskStage === 'all' ? currentStage : selectedTaskStage;
                        const canAct = canActOnTask(task, displayStage);
                        const assigneeField = STAGE_ASSIGNEE_MAP[displayStage];
                        const assignee = task[assigneeField];
                        const stageInfo = TASK_STAGES.find(s => s.id === displayStage);
                        const stageStatus = task[`${displayStage}_status`] || 'Not Started';
                        const timeSpent = task[`${displayStage}_time_spent`] || 0;
                        const isTimerRunning = runningTimers[task.task_id]?.stage === displayStage;
                        
                        return (
                          <tr key={task.task_id} className={`border-t ${borderColor} hover:${bgSecondary} transition-colors`}>
                            {/* Task Name + Stage */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-1 h-10 rounded-full ${stageInfo?.color || 'bg-gray-500'}`} />
                                <div>
                                  <p className={`font-medium ${textPrimary}`}>{task.page_name || task.name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs ${textSecondary}`}>{task.project_name}</span>
                                    {selectedTaskStage === 'all' && (
                                      <Badge className={`${stageInfo?.color}/20 text-xs`} style={{ color: stageInfo?.color?.includes('blue') ? '#3b82f6' : stageInfo?.color?.includes('purple') ? '#a855f7' : stageInfo?.color?.includes('pink') ? '#ec4899' : stageInfo?.color?.includes('green') ? '#22c55e' : '#14b8a6' }}>
                                        {stageInfo?.label}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            
                            {/* Status */}
                            <td className="px-3 py-3 text-center">
                              <Badge variant="outline" className={`text-xs ${
                                stageStatus === 'Not Started' || stageStatus === 'To-Do' ? 'bg-gray-500/10 text-gray-400 border-gray-500/30' : 
                                stageStatus === 'In Progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 
                                stageStatus === 'Completed' || stageStatus === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                              }`}>
                                {stageStatus}
                              </Badge>
                            </td>
                            
                            {/* Assigned */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${assignee ? 'bg-[#6366f1] text-white' : bgSecondary + ' ' + textSecondary}`}>
                                  {assignee ? assignee.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : <User className="h-3 w-3" />}
                                </div>
                                <span className={`text-sm ${textSecondary}`}>{assignee || '-'}</span>
                              </div>
                            </td>
                            
                            {/* Due Date */}
                            <td className={`px-3 py-3 text-center text-sm ${textSecondary}`}>
                              {task.due_date || '-'}
                            </td>
                            
                            {/* Link */}
                            <td className="px-3 py-3 text-center">
                              {task.reference_link ? (
                                <a href={task.reference_link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              ) : (
                                <span className={textSecondary}>-</span>
                              )}
                            </td>
                            
                            {/* Time Spent */}
                            <td className={`px-3 py-3 text-center text-sm ${textPrimary}`}>
                              <div className="flex items-center justify-center gap-1">
                                <Clock className="h-3 w-3 text-[#6366f1]" />
                                {formatTime(timeSpent)}
                              </div>
                            </td>
                            
                            {/* Timer Start/Stop */}
                            <td className="px-3 py-3 text-center">
                              {canAct ? (
                                isTimerRunning ? (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="h-8 border-red-500/50 text-red-500 hover:bg-red-500/10"
                                    onClick={() => handleStopTimer(task.task_id, displayStage)}
                                  >
                                    <Square className="h-3 w-3 mr-1 fill-red-500" /> Stop
                                  </Button>
                                ) : (
                                  <Button 
                                    size="sm" 
                                    className="h-8 bg-emerald-500 hover:bg-emerald-600"
                                    onClick={() => handleStartTimer(task.task_id, displayStage)}
                                  >
                                    <Play className="h-3 w-3 mr-1 fill-white" /> Start
                                  </Button>
                                )
                              ) : (
                                <span className={`text-xs ${textSecondary}`}>-</span>
                              )}
                            </td>
                            
                            {/* Actions */}
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0"
                                  onClick={() => navigate(`/project/${task.project_id}`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canAct && (
                                  <>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-8 w-8 p-0"
                                      onClick={() => navigate(`/project/${task.project_id}?tab=pages&edit=${task.task_id}`)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 text-emerald-500 hover:bg-emerald-500/10"
                                      onClick={async () => {
                                        try {
                                          await axios.put(
                                            `${API}/api/website-projects/pages/${task.task_id}/stage-status`,
                                            { stage: displayStage, status: 'Completed' },
                                            { headers: { Authorization: `Bearer ${token}` } }
                                          );
                                          toast.success(`${stageInfo?.label} completed!`);
                                          loadProjects();
                                        } catch (error) {
                                          toast.error('Failed to update status');
                                        }
                                      }}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
              </>
            )}
            
            {/* TRACKBOARD TAB - Overview of time tracking */}
            {masterBoardTab === 'trackboard' && (
              <div className="space-y-4">
                <div className={`rounded-xl border ${borderColor} ${bgCard} overflow-hidden`}>
                  <div className={`p-4 ${bgSecondary}`}>
                    <h3 className={`font-semibold ${textPrimary}`}>Time Tracking Overview</h3>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className={`p-4 rounded-lg ${bgSecondary}`}>
                        <p className={`text-xs ${textSecondary}`}>Total Time Today</p>
                        <p className={`text-2xl font-bold ${textPrimary}`}>{formatTime(allTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0))}</p>
                      </div>
                      <div className={`p-4 rounded-lg ${bgSecondary}`}>
                        <p className={`text-xs ${textSecondary}`}>Active Timers</p>
                        <p className={`text-2xl font-bold text-emerald-500`}>{Object.keys(runningTimers).length}</p>
                      </div>
                      <div className={`p-4 rounded-lg ${bgSecondary}`}>
                        <p className={`text-xs ${textSecondary}`}>Tasks Completed</p>
                        <p className={`text-2xl font-bold text-blue-500`}>{allTasks.filter(t => t.delivery_status === 'Completed').length}</p>
                      </div>
                    </div>
                    <p className={`text-sm ${textSecondary}`}>Detailed time tracking analytics coming soon...</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* PAGES TAB - Page-level tasks */}
            {masterBoardTab === 'pages' && (
              <div className="space-y-3">
                {allTasks.length === 0 ? (
                  <div className={`text-center py-12 ${textSecondary}`}>
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No pages found</p>
                  </div>
                ) : (
                  sortItems(allTasks, sortField, sortOrder).map(task => (
                    <div 
                      key={task.task_id}
                      className={`p-4 rounded-xl border ${borderColor} ${bgSecondary} hover:border-[#6366f1]/50 transition-all cursor-pointer`}
                      onClick={() => navigate(`/project/${task.project_id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-[#6366f1]" />
                          <div>
                            <p className={`font-medium ${textPrimary}`}>{task.page_name || task.name}</p>
                            <p className={`text-xs ${textSecondary}`}>{task.project_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{task.due_date || 'No date'}</Badge>
                          <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {/* TEAM TAB - Team overview */}
            {masterBoardTab === 'team' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamMembers.map(member => {
                    const memberTasks = allTasks.filter(t => 
                      t.content_assignee === member.name || 
                      t.wireframe_assignee === member.name ||
                      t.ui_assignee === member.name ||
                      t.dev_assignee === member.name
                    );
                    return (
                      <div key={member.user_id} className={`p-4 rounded-xl border ${borderColor} ${bgSecondary}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-[#6366f1]/20 flex items-center justify-center">
                            <UserCircle className="h-5 w-5 text-[#6366f1]" />
                          </div>
                          <div>
                            <p className={`font-medium ${textPrimary}`}>{member.name}</p>
                            <p className={`text-xs ${textSecondary}`}>{member.role || 'Team Member'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className={textSecondary}>Tasks: <strong className={textPrimary}>{memberTasks.length}</strong></span>
                          <span className={textSecondary}>Active: <strong className="text-emerald-500">{memberTasks.filter(t => t.content_status === 'In Progress' || t.dev_status === 'In Progress').length}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {teamMembers.length === 0 && (
                  <div className={`text-center py-12 ${textSecondary}`}>
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No team members found</p>
                  </div>
                )}
              </div>
            )}
            
            {/* AD.TASKS TAB - Additional tasks */}
            {masterBoardTab === 'adtasks' && (
              <div className="space-y-3">
                {additionalTasks.length === 0 ? (
                  <div className={`text-center py-12 ${textSecondary}`}>
                    <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No additional tasks</p>
                    <Button className="mt-4 bg-[#6366f1]" onClick={() => setShowAdTaskModal(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Create Task
                    </Button>
                  </div>
                ) : (
                  sortItems(additionalTasks, 'due_date', sortOrder).map(task => (
                    <div key={task.task_id} className={`p-4 rounded-xl border ${borderColor} ${bgSecondary}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-10 rounded-full ${task.priority === 'urgent' ? 'bg-red-500' : task.priority === 'high' ? 'bg-orange-500' : task.priority === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                          <div>
                            <p className={`font-medium ${textPrimary}`}>{task.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{task.status}</Badge>
                              {task.due_date && <span className={`text-xs ${textSecondary}`}>Due: {task.due_date}</span>}
                              {task.assignee && <span className={`text-xs ${textSecondary}`}>• {task.assignee}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${textSecondary}`}>{formatTime(task.time_spent || 0)}</span>
                          {adTaskTimers[task.task_id] ? (
                            <Button size="sm" variant="outline" className="h-8 border-red-500/50 text-red-500" onClick={() => handleStopAdTaskTimer(task.task_id)}>
                              <Square className="h-3 w-3 mr-1 fill-red-500" /> Stop
                            </Button>
                          ) : (
                            <Button size="sm" className="h-8 bg-emerald-500 hover:bg-emerald-600" onClick={() => handleStartAdTaskTimer(task.task_id)}>
                              <Play className="h-3 w-3 mr-1" /> Start
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleUpdateAdTaskStatus(task.task_id, 'Completed')}><Check className="h-4 w-4 text-emerald-500" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteAdTask(task.task_id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {/* MEETINGS TAB */}
            {masterBoardTab === 'meetings' && (
              <div className="space-y-3">
                {meetings.length === 0 ? (
                  <div className={`text-center py-12 ${textSecondary}`}>
                    <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No meetings scheduled</p>
                    <Button className="mt-4 bg-[#6366f1]" onClick={() => setShowMeetingModal(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Schedule Meeting
                    </Button>
                  </div>
                ) : (
                  sortItems(meetings, 'date', sortOrder).map(meeting => (
                    <div key={meeting.meeting_id} className={`p-4 rounded-xl border ${borderColor} ${bgSecondary}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meeting.meeting_type === 'video' ? 'bg-blue-500/20' : meeting.meeting_type === 'audio' ? 'bg-green-500/20' : 'bg-purple-500/20'}`}>
                            <Video className={`h-5 w-5 ${meeting.meeting_type === 'video' ? 'text-blue-500' : meeting.meeting_type === 'audio' ? 'text-green-500' : 'text-purple-500'}`} />
                          </div>
                          <div>
                            <p className={`font-medium ${textPrimary}`}>{meeting.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs ${textSecondary}`}>{meeting.date} • {meeting.start_time} - {meeting.end_time}</span>
                              <Badge variant="outline" className="text-xs">{meeting.status}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {meeting.meeting_link && (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => window.open(meeting.meeting_link, '_blank')}>
                              <ExternalLink className="h-4 w-4 mr-1" /> Join
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleUpdateMeetingStatus(meeting.meeting_id, 'completed')}><Check className="h-4 w-4 text-emerald-500" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteMeeting(meeting.meeting_id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PROJECTS TAB (kept for direct project list access) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {mainTab === 'projects' && (
          <div className="flex-1 overflow-auto">
            {/* Filter Bar */}
            <div className={`p-4 border-b ${borderColor} ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Search projects..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className={`pl-10 ${bgSecondary} border-none`} 
                  />
                </div>
                
                {/* Stage Filter */}
                <Select value={workflowStage} onValueChange={setWorkflowStage}>
                  <SelectTrigger className={`w-44 ${bgSecondary} border-none`}>
                    <SelectValue placeholder="All Stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    {WORKFLOW_STAGES.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Client Filter */}
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className={`w-44 ${bgSecondary} border-none`}>
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clientNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
                
                {/* Developer Filter */}
                <Select value={developerFilter} onValueChange={setDeveloperFilter}>
                  <SelectTrigger className={`w-44 ${bgSecondary} border-none`}>
                    <SelectValue placeholder="All Developers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Developers</SelectItem>
                    {developerNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Projects Grid */}
            <div className="p-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.length === 0 ? (
                  <div className={`col-span-full p-12 text-center ${textSecondary}`}>
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No projects found</p>
                  </div>
                ) : (
                  filteredProjects.map(project => {
                    const stage = WORKFLOW_STAGES.find(s => s.id === (project.workflow_stage || 'creation'));
                    return (
                      <div 
                        key={project.project_id}
                        className={`${bgCard} rounded-xl border ${borderColor} p-4 hover:border-[#6366f1]/50 transition-all cursor-pointer`}
                        onClick={() => openProject(project.project_id)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                              <Globe className="h-5 w-5 text-[#6366f1]" />
                            </div>
                            <div>
                              <p className={`font-semibold ${textPrimary}`}>{project.name}</p>
                              <p className={`text-xs ${textSecondary}`}>{project.client_name || 'No Client'}</p>
                            </div>
                          </div>
                          <Badge className={`${stage?.color}/20 ${stage?.color?.replace('bg-', 'text-')} text-xs`}>
                            {stage?.label || 'Creation'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
                            <p className={`text-xs ${textSecondary}`}>Platform</p>
                            <p className={`text-sm font-medium ${textPrimary}`}>{project.platform || '-'}</p>
                          </div>
                          <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
                            <p className={`text-xs ${textSecondary}`}>Pages</p>
                            <p className={`text-sm font-medium ${textPrimary}`}>{project.total_pages || 0}</p>
                          </div>
                          <div className={`p-2 rounded-lg ${bgSecondary} text-center`}>
                            <p className={`text-xs ${textSecondary}`}>Developer</p>
                            <p className={`text-sm font-medium ${textPrimary} truncate`}>{project.developer || '-'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Progress value={project.overall_percent || 0} className="flex-1 h-2" />
                            <span className={`text-xs ${textSecondary}`}>{project.overall_percent || 0}%</span>
                          </div>
                          <Button size="sm" variant="ghost" className="ml-2" onClick={(e) => { e.stopPropagation(); openProject(project.project_id); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="create-project-modal">
          <div className={`${bgCard} rounded-xl w-full max-w-2xl border ${borderColor} max-h-[90vh] overflow-hidden`}>
            {/* Header */}
            <div className={`p-6 border-b ${borderColor} flex items-center justify-between`}>
              <h2 className={`text-xl font-bold ${textPrimary}`}>Create New Project</h2>
              <Button variant="ghost" size="sm" onClick={closeCreateModal} className="h-8 w-8 p-0">
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Step Indicator */}
            <div className="px-6 pt-4">
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
              <div className="flex justify-center gap-6 text-xs mb-2">
                <span className={createStep >= 1 ? 'text-[#6366f1]' : textSecondary}>Type</span>
                <span className={createStep >= 2 ? 'text-[#6366f1]' : textSecondary}>Requirements</span>
                <span className={createStep >= 3 ? 'text-[#6366f1]' : textSecondary}>Branding</span>
                <span className={createStep >= 4 ? 'text-[#6366f1]' : textSecondary}>Details</span>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Step 1: Website Type & Platform */}
              {createStep === 1 && (
                <div className="space-y-6">
                  {/* Website Type */}
                  <div>
                    <label className={`text-base font-semibold ${textPrimary} block mb-3`}>Select Website Type</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {WEBSITE_TYPES.map(type => (
                        <button
                          key={type}
                          onClick={() => setNewProject({ ...newProject, website_type: type, platform: '' })}
                          className={`p-4 rounded-xl border-2 transition-all text-left ${
                            newProject.website_type === type
                              ? 'border-[#6366f1] bg-[#6366f1]/10'
                              : `border-transparent ${bgSecondary} hover:border-[#6366f1]/50`
                          }`}
                        >
                          <p className={`font-medium ${textPrimary}`}>{type}</p>
                          <p className={`text-xs ${textSecondary} mt-1`}>
                            {type === 'Landing Page' && 'Single page website'}
                            {type === 'Business Website' && 'Multi-page corporate site'}
                            {type === 'Ecommerce' && 'Online store'}
                            {type === 'Web App' && 'Custom web application'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Platform - Shows only when website type is selected */}
                  {newProject.website_type && (
                    <div>
                      <label className={`text-base font-semibold ${textPrimary} block mb-3`}>
                        Select Platform
                        <span className={`text-sm font-normal ${textSecondary} ml-2`}>
                          (for {newProject.website_type})
                        </span>
                      </label>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        {PLATFORM_OPTIONS[newProject.website_type]?.map(platform => (
                          <button
                            key={platform}
                            onClick={() => setNewProject({ ...newProject, platform: platform })}
                            className={`p-3 rounded-xl border-2 transition-all text-center ${
                              newProject.platform === platform
                                ? 'border-[#6366f1] bg-[#6366f1]/10'
                                : `border-transparent ${bgSecondary} hover:border-[#6366f1]/50`
                            }`}
                          >
                            <p className={`font-medium text-sm ${textPrimary}`}>{platform}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Selection Preview */}
                  {newProject.website_type && newProject.platform && (
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-[#6366f1]/10' : 'bg-[#6366f1]/5'} border border-[#6366f1]/30`}>
                      <p className={`text-sm ${textSecondary}`}>Creating:</p>
                      <p className={`font-semibold ${textPrimary}`}>{newProject.platform} {newProject.website_type}</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Step 2: Dynamic Requirements */}
              {createStep === 2 && (
                <div className="space-y-6">
                  <p className={`text-sm ${textSecondary}`}>{newProject.platform} • {newProject.website_type}</p>
                  
                  {REQUIREMENTS_CONFIG[newProject.website_type]?.sections.map((section, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border ${borderColor}`}>
                      <h3 className={`font-semibold ${textPrimary} mb-4`}>{section.title}</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {section.fields.map(field => (
                          <div key={field}>
                            <label className={`text-sm ${textSecondary} block mb-1`}>{FIELD_LABELS[field] || field}</label>
                            {['about_text', 'services_list', 'testimonials', 'collections_list', 'core_features', 'bio', 'experience', 'return_policy'].includes(field) ? (
                              <Textarea
                                value={newProject.requirements?.[field] || ''}
                                onChange={(e) => setNewProject({ 
                                  ...newProject, 
                                  requirements: { ...newProject.requirements, [field]: e.target.value } 
                                })}
                                placeholder={`Enter ${FIELD_LABELS[field] || field}...`}
                                className={`${bgSecondary} border-none`}
                                rows={3}
                              />
                            ) : (
                              <Input
                                value={newProject.requirements?.[field] || ''}
                                onChange={(e) => setNewProject({ 
                                  ...newProject, 
                                  requirements: { ...newProject.requirements, [field]: e.target.value } 
                                })}
                                placeholder={`Enter ${FIELD_LABELS[field] || field}...`}
                                className={`${bgSecondary} border-none`}
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
              )}
              
              {/* Step 3: Branding Information */}
              {createStep === 3 && (
                <div className="space-y-6">
                  <p className={`text-sm ${textSecondary}`}>{newProject.platform} • {newProject.website_type}</p>
                  
                  {/* Logo & Favicon */}
                  <div className={`p-4 rounded-lg border ${borderColor}`}>
                    <h3 className={`font-semibold ${textPrimary} mb-4`}>Logo & Assets</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`text-sm ${textSecondary} block mb-1`}>Logo URL</label>
                        <Input
                          value={newProject.branding?.logo_url || ''}
                          onChange={(e) => setNewProject({ 
                            ...newProject, 
                            branding: { ...newProject.branding, logo_url: e.target.value } 
                          })}
                          placeholder="https://drive.google.com/..."
                          className={`${bgSecondary} border-none`}
                        />
                      </div>
                      <div>
                        <label className={`text-sm ${textSecondary} block mb-1`}>Favicon URL</label>
                        <Input
                          value={newProject.branding?.favicon_url || ''}
                          onChange={(e) => setNewProject({ 
                            ...newProject, 
                            branding: { ...newProject.branding, favicon_url: e.target.value } 
                          })}
                          placeholder="https://drive.google.com/..."
                          className={`${bgSecondary} border-none`}
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
                            value={newProject.branding?.primary_color || '#6366f1'}
                            onChange={(e) => setNewProject({ 
                              ...newProject, 
                              branding: { ...newProject.branding, primary_color: e.target.value } 
                            })}
                            className="w-10 h-10 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={newProject.branding?.primary_color || '#6366f1'}
                            onChange={(e) => setNewProject({ 
                              ...newProject, 
                              branding: { ...newProject.branding, primary_color: e.target.value } 
                            })}
                            placeholder="#6366f1"
                            className={`flex-1 ${bgSecondary} border-none`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={`text-sm ${textSecondary} block mb-1`}>Secondary Color</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={newProject.branding?.secondary_color || '#22c55e'}
                            onChange={(e) => setNewProject({ 
                              ...newProject, 
                              branding: { ...newProject.branding, secondary_color: e.target.value } 
                            })}
                            className="w-10 h-10 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={newProject.branding?.secondary_color || '#22c55e'}
                            onChange={(e) => setNewProject({ 
                              ...newProject, 
                              branding: { ...newProject.branding, secondary_color: e.target.value } 
                            })}
                            placeholder="#22c55e"
                            className={`flex-1 ${bgSecondary} border-none`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={`text-sm ${textSecondary} block mb-1`}>Accent Color</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={newProject.branding?.accent_color || '#f59e0b'}
                            onChange={(e) => setNewProject({ 
                              ...newProject, 
                              branding: { ...newProject.branding, accent_color: e.target.value } 
                            })}
                            className="w-10 h-10 rounded cursor-pointer border-0"
                          />
                          <Input
                            value={newProject.branding?.accent_color || '#f59e0b'}
                            onChange={(e) => setNewProject({ 
                              ...newProject, 
                              branding: { ...newProject.branding, accent_color: e.target.value } 
                            })}
                            placeholder="#f59e0b"
                            className={`flex-1 ${bgSecondary} border-none`}
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
                          value={newProject.branding?.primary_font || ''}
                          onChange={(e) => setNewProject({ 
                            ...newProject, 
                            branding: { ...newProject.branding, primary_font: e.target.value } 
                          })}
                          placeholder="Inter, Roboto, etc."
                          className={`${bgSecondary} border-none`}
                        />
                      </div>
                      <div>
                        <label className={`text-sm ${textSecondary} block mb-1`}>Secondary Font</label>
                        <Input
                          value={newProject.branding?.secondary_font || ''}
                          onChange={(e) => setNewProject({ 
                            ...newProject, 
                            branding: { ...newProject.branding, secondary_font: e.target.value } 
                          })}
                          placeholder="Playfair Display, etc."
                          className={`${bgSecondary} border-none`}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className={`text-sm ${textSecondary} block mb-1`}>Brand Guidelines URL</label>
                        <Input
                          value={newProject.branding?.guidelines_url || ''}
                          onChange={(e) => setNewProject({ 
                            ...newProject, 
                            branding: { ...newProject.branding, guidelines_url: e.target.value } 
                          })}
                          placeholder="Link to brand guidelines document"
                          className={`${bgSecondary} border-none`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Step 4: Project Details with Tabs */}
              {createStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm ${textSecondary}`}>{newProject.platform} • {newProject.website_type}</p>
                    <Button variant="link" size="sm" className="text-[#6366f1]" onClick={() => setCreateStep(1)}>
                      Change Type
                    </Button>
                  </div>
                  
                  <Tabs value={detailsTab} onValueChange={setDetailsTab} className="w-full">
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
                          <Input
                            value={newProject.name}
                            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                            placeholder="Client/Project Name"
                            className={`${bgSecondary} border-none`}
                          />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Domain URL</label>
                          <Input
                            value={newProject.domain_url}
                            onChange={(e) => setNewProject({ ...newProject, domain_url: e.target.value })}
                            placeholder="www.example.com"
                            className={`${bgSecondary} border-none`}
                          />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Onboarding Date</label>
                          <Input
                            type="date"
                            value={newProject.onboarding_date}
                            onChange={(e) => setNewProject({ ...newProject, onboarding_date: e.target.value })}
                            className={`${bgSecondary} border-none`}
                          />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Deadline</label>
                          <Input
                            type="date"
                            value={newProject.deadline}
                            onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                            className={`${bgSecondary} border-none`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={`text-sm ${textSecondary} block mb-1`}>Notes</label>
                        <Textarea
                          value={newProject.notes}
                          onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                          placeholder="Any additional notes..."
                          className={`${bgSecondary} border-none`}
                          rows={3}
                        />
                      </div>
                    </TabsContent>

                    {/* Client Tab */}
                    <TabsContent value="client" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Client Name</label>
                          <Input
                            value={newProject.client_name}
                            onChange={(e) => setNewProject({ ...newProject, client_name: e.target.value })}
                            placeholder="Client/Company Name"
                            className={`${bgSecondary} border-none`}
                          />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Location</label>
                          <Input
                            value={newProject.client_location || ''}
                            onChange={(e) => setNewProject({ ...newProject, client_location: e.target.value })}
                            placeholder="City, Country"
                            className={`${bgSecondary} border-none`}
                          />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Email</label>
                          <Input
                            type="email"
                            value={newProject.client_email}
                            onChange={(e) => setNewProject({ ...newProject, client_email: e.target.value })}
                            placeholder="client@email.com"
                            className={`${bgSecondary} border-none`}
                          />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Phone</label>
                          <Input
                            value={newProject.client_phone}
                            onChange={(e) => setNewProject({ ...newProject, client_phone: e.target.value })}
                            placeholder="+1 234 567 8900"
                            className={`${bgSecondary} border-none`}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    {/* Credentials Tab */}
                    <TabsContent value="credentials" className="space-y-4">
                      <div className={`p-4 rounded-lg border ${borderColor}`}>
                        <h4 className={`font-medium ${textPrimary} mb-3`}>Domain & Hosting</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={`text-sm ${textSecondary} block mb-1`}>Username</label>
                            <Input
                              value={newProject.domain_username || ''}
                              onChange={(e) => setNewProject({ ...newProject, domain_username: e.target.value })}
                              placeholder="Domain login"
                              className={`${bgSecondary} border-none`}
                            />
                          </div>
                          <div>
                            <label className={`text-sm ${textSecondary} block mb-1`}>Password</label>
                            <Input
                              type="password"
                              value={newProject.domain_password || ''}
                              onChange={(e) => setNewProject({ ...newProject, domain_password: e.target.value })}
                              placeholder="••••••••"
                              className={`${bgSecondary} border-none`}
                            />
                          </div>
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg border ${borderColor}`}>
                        <h4 className={`font-medium ${textPrimary} mb-3`}>WordPress (if applicable)</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={`text-sm ${textSecondary} block mb-1`}>WP Username</label>
                            <Input
                              value={newProject.wp_username || ''}
                              onChange={(e) => setNewProject({ ...newProject, wp_username: e.target.value })}
                              placeholder="WordPress admin"
                              className={`${bgSecondary} border-none`}
                            />
                          </div>
                          <div>
                            <label className={`text-sm ${textSecondary} block mb-1`}>WP Password</label>
                            <Input
                              type="password"
                              value={newProject.wp_password || ''}
                              onChange={(e) => setNewProject({ ...newProject, wp_password: e.target.value })}
                              placeholder="••••••••"
                              className={`${bgSecondary} border-none`}
                            />
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Team Tab */}
                    <TabsContent value="team" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Developer</label>
                          <Select
                            value={newProject.developer || ''}
                            onValueChange={(v) => setNewProject({ ...newProject, developer: v })}
                          >
                            <SelectTrigger className={`${bgSecondary} border-none`}>
                              <SelectValue placeholder="Select developer" />
                            </SelectTrigger>
                            <SelectContent>
                              {teamMembers.map(m => (
                                <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Project Manager</label>
                          <Select
                            value={newProject.project_manager || ''}
                            onValueChange={(v) => setNewProject({ ...newProject, project_manager: v })}
                          >
                            <SelectTrigger className={`${bgSecondary} border-none`}>
                              <SelectValue placeholder="Select PM" />
                            </SelectTrigger>
                            <SelectContent>
                              {teamMembers.map(m => (
                                <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Designer</label>
                          <Select
                            value={newProject.designer || ''}
                            onValueChange={(v) => setNewProject({ ...newProject, designer: v })}
                          >
                            <SelectTrigger className={`${bgSecondary} border-none`}>
                              <SelectValue placeholder="Select designer" />
                            </SelectTrigger>
                            <SelectContent>
                              {teamMembers.map(m => (
                                <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Content Writer</label>
                          <Select
                            value={newProject.content_writer || ''}
                            onValueChange={(v) => setNewProject({ ...newProject, content_writer: v })}
                          >
                            <SelectTrigger className={`${bgSecondary} border-none`}>
                              <SelectValue placeholder="Select writer" />
                            </SelectTrigger>
                            <SelectContent>
                              {teamMembers.map(m => (
                                <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Links Tab */}
                    <TabsContent value="links" className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Google Drive URL</label>
                          <Input
                            value={newProject.client_drive_url || ''}
                            onChange={(e) => setNewProject({ ...newProject, client_drive_url: e.target.value })}
                            placeholder="https://drive.google.com/..."
                            className={`${bgSecondary} border-none`}
                          />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Documents URL</label>
                          <Input
                            value={newProject.documents_url || ''}
                            onChange={(e) => setNewProject({ ...newProject, documents_url: e.target.value })}
                            placeholder="https://docs.google.com/..."
                            className={`${bgSecondary} border-none`}
                          />
                        </div>
                        <div>
                          <label className={`text-sm ${textSecondary} block mb-1`}>Communication Channel</label>
                          <Input
                            value={newProject.communication_url || ''}
                            onChange={(e) => setNewProject({ ...newProject, communication_url: e.target.value })}
                            placeholder="Slack, Discord, WhatsApp group link..."
                            className={`${bgSecondary} border-none`}
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className={`p-6 border-t ${borderColor} flex justify-between`}>
              <Button 
                variant="outline" 
                onClick={() => createStep > 1 ? setCreateStep(createStep - 1) : closeCreateModal()}
              >
                {createStep > 1 ? 'Back' : 'Cancel'}
              </Button>
              
              <div className="flex gap-2">
                {/* Skip button for steps 2 and 3 */}
                {(createStep === 2 || createStep === 3) && (
                  <Button 
                    variant="ghost" 
                    onClick={() => setCreateStep(4)}
                  >
                    Skip to Details
                  </Button>
                )}
                
                {createStep < 4 ? (
                  <Button 
                    onClick={() => setCreateStep(createStep + 1)}
                    className="bg-[#6366f1] hover:bg-[#4f46e5]"
                    disabled={createStep === 1 && (!newProject.website_type || !newProject.platform)}
                  >
                    {createStep === 1 && 'Next: Requirements'}
                    {createStep === 2 && 'Next: Branding'}
                    {createStep === 3 && 'Next: Details'}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCreateProject}
                    className="bg-[#6366f1] hover:bg-[#4f46e5]"
                    disabled={!newProject.name.trim()}
                  >
                    Create Project
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Additional Task Modal */}
      {showAdTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${bgCard} rounded-xl w-full max-w-md border ${borderColor} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-bold ${textPrimary}`}>Create Additional Task</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowAdTaskModal(false)} className="h-8 w-8 p-0">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <Input
                placeholder="Task title *"
                value={newAdTask.title}
                onChange={(e) => setNewAdTask({ ...newAdTask, title: e.target.value })}
                className={`${bgSecondary} border-none`}
              />
              <Textarea
                placeholder="Description"
                value={newAdTask.description}
                onChange={(e) => setNewAdTask({ ...newAdTask, description: e.target.value })}
                className={`${bgSecondary} border-none`}
                rows={3}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  value={newAdTask.due_date}
                  onChange={(e) => setNewAdTask({ ...newAdTask, due_date: e.target.value })}
                  className={`${bgSecondary} border-none`}
                />
                <Select value={newAdTask.priority} onValueChange={(v) => setNewAdTask({ ...newAdTask, priority: v })}>
                  <SelectTrigger className={`${bgSecondary} border-none`}>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={newAdTask.assignee_id || 'none'} onValueChange={(v) => {
                if (v === 'none') {
                  setNewAdTask({ ...newAdTask, assignee_id: '', assignee: '' });
                } else {
                  const member = teamMembers.find(m => m.user_id === v);
                  setNewAdTask({ ...newAdTask, assignee_id: v, assignee: member?.name || '' });
                }
              }}>
                <SelectTrigger className={`${bgSecondary} border-none`}>
                  <SelectValue placeholder="Assign to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {teamMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newAdTask.project_id || 'none'} onValueChange={(v) => setNewAdTask({ ...newAdTask, project_id: v === 'none' ? '' : v })}>
                <SelectTrigger className={`${bgSecondary} border-none`}>
                  <SelectValue placeholder="Link to project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Project</SelectItem>
                  {roleFilteredProjects.map(p => (
                    <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowAdTaskModal(false)}>Cancel</Button>
              <Button onClick={handleCreateAdTask} className="bg-[#6366f1]">Create Task</Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${bgCard} rounded-xl w-full max-w-md border ${borderColor} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-bold ${textPrimary}`}>Schedule Meeting</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowMeetingModal(false)} className="h-8 w-8 p-0">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <Input
                placeholder="Meeting title *"
                value={newMeeting.title}
                onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                className={`${bgSecondary} border-none`}
              />
              <Textarea
                placeholder="Agenda / Description"
                value={newMeeting.agenda}
                onChange={(e) => setNewMeeting({ ...newMeeting, agenda: e.target.value })}
                className={`${bgSecondary} border-none`}
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs ${textSecondary} mb-1 block`}>Date *</label>
                  <Input
                    type="date"
                    value={newMeeting.date}
                    onChange={(e) => setNewMeeting({ ...newMeeting, date: e.target.value })}
                    className={`${bgSecondary} border-none`}
                  />
                </div>
                <Select value={newMeeting.meeting_type} onValueChange={(v) => setNewMeeting({ ...newMeeting, meeting_type: v })}>
                  <SelectTrigger className={`${bgSecondary} border-none mt-5`}>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video Call</SelectItem>
                    <SelectItem value="audio">Audio Call</SelectItem>
                    <SelectItem value="in-person">In Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs ${textSecondary} mb-1 block`}>Start Time *</label>
                  <Input
                    type="time"
                    value={newMeeting.start_time}
                    onChange={(e) => setNewMeeting({ ...newMeeting, start_time: e.target.value })}
                    className={`${bgSecondary} border-none`}
                  />
                </div>
                <div>
                  <label className={`text-xs ${textSecondary} mb-1 block`}>End Time</label>
                  <Input
                    type="time"
                    value={newMeeting.end_time}
                    onChange={(e) => setNewMeeting({ ...newMeeting, end_time: e.target.value })}
                    className={`${bgSecondary} border-none`}
                  />
                </div>
              </div>
              <Input
                placeholder="Meeting link (Google Meet, Zoom, etc.)"
                value={newMeeting.meeting_link}
                onChange={(e) => setNewMeeting({ ...newMeeting, meeting_link: e.target.value })}
                className={`${bgSecondary} border-none`}
              />
              <Select value={newMeeting.project_id || 'none'} onValueChange={(v) => setNewMeeting({ ...newMeeting, project_id: v === 'none' ? '' : v })}>
                <SelectTrigger className={`${bgSecondary} border-none`}>
                  <SelectValue placeholder="Link to project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Project</SelectItem>
                  {roleFilteredProjects.map(p => (
                    <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowMeetingModal(false)}>Cancel</Button>
              <Button onClick={handleCreateMeeting} className="bg-[#6366f1]">Schedule Meeting</Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
