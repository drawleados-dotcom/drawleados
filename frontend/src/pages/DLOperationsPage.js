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
  Palette, Type, Link2, Users, Settings
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
  const [taskDateType, setTaskDateType] = useState('date'); // all, date, range, month, year
  const [taskDate, setTaskDate] = useState(getCurrentDate());
  const [taskDateStart, setTaskDateStart] = useState('');
  const [taskDateEnd, setTaskDateEnd] = useState('');
  const [taskMonth, setTaskMonth] = useState(getCurrentMonth());
  const [taskYear, setTaskYear] = useState(new Date().getFullYear().toString());
  const [selectedTaskStage, setSelectedTaskStage] = useState('all'); // Default to all tasks
  const [taskViewMode, setTaskViewMode] = useState('task'); // task | project
  
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
  
  // Tasks filtered by stage and date for Part 2
  const getTasksForStage = (stageId) => {
    // Apply date filter first to all tasks
    const dateFilteredTasks = allTasks.filter(task => {
      const dateToCheck = task.due_date;
      return filterByDate(dateToCheck, taskDateType, taskDate, taskDateStart, taskDateEnd, taskMonth, taskYear);
    });
    
    // For "all" tab - show ALL incomplete tasks (any stage not fully completed)
    if (stageId === 'all') {
      return dateFilteredTasks.filter(task => {
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
    const stageTasks = dateFilteredTasks.filter(task => {
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
  
  useEffect(() => {
    loadProjects();
    loadTeamMembers();
  }, [loadProjects, loadTeamMembers]);
  
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
      <div className="flex flex-col h-full pb-16 md:pb-0 overflow-auto" data-testid="dl-operations-page">
        {/* Title Row */}
        <div className={`p-4 md:p-6 border-b ${borderColor} ${isDark ? 'bg-[#0c0a09]' : 'bg-white'}`}>
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
        {/* PART 1: PROJECT OVERVIEW SECTION */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className={`p-4 md:p-6 border-b ${borderColor} ${bgCard}`}>
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
        {/* PART 2: STAGE TASK BOARD */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className={`flex-1 ${bgCard}`}>
          {/* Header with filters */}
          <div className={`p-4 border-b ${borderColor}`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h2 className={`text-lg font-semibold ${textPrimary}`}>Stage Task Board</h2>
                
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
              
              {/* Date Filter for Stage Board */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={taskDateType} onValueChange={setTaskDateType}>
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
            </div>
            
            {/* Horizontal Stage Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto mt-4 pb-2 hide-scrollbar">
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
          </div>
          
          {/* Task List for Selected Stage */}
          <div className="p-4">
            {taskViewMode === 'task' ? (
              /* Task Wise View */
              <div className="space-y-3">
                {getTasksForStage(selectedTaskStage).length === 0 ? (
                  <div className={`text-center py-12 ${textSecondary}`}>
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No tasks for today</p>
                    <p className="text-sm">Change the date filter or check other stages</p>
                  </div>
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
                    
                    return (
                      <div 
                        key={task.task_id}
                        className={`p-4 rounded-xl border ${borderColor} ${bgSecondary} hover:border-[#6366f1]/50 transition-all`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-10 rounded-full ${stageInfo?.color || 'bg-gray-500'}`} />
                            <div>
                              <p className={`font-medium ${textPrimary}`}>{task.project_name || 'Unknown Project'}</p>
                              <p className={`text-sm ${textSecondary}`}>{task.page_name || task.name}</p>
                            </div>
                            {/* Show current stage badge when viewing All Tasks */}
                            {selectedTaskStage === 'all' && (
                              <Badge className={`${stageInfo?.color}/20 text-xs ml-2`} style={{ color: stageInfo?.color?.includes('blue') ? '#3b82f6' : stageInfo?.color?.includes('purple') ? '#a855f7' : stageInfo?.color?.includes('pink') ? '#ec4899' : stageInfo?.color?.includes('green') ? '#22c55e' : stageInfo?.color?.includes('teal') ? '#14b8a6' : stageInfo?.color?.includes('cyan') ? '#06b6d4' : '#10b981' }}>
                                {stageInfo?.label}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {/* Assignee */}
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${assignee ? 'bg-[#6366f1] text-white' : bgCard + ' ' + textSecondary}`}>
                                {assignee ? assignee.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : <User className="h-4 w-4" />}
                              </div>
                              <span className={`text-sm ${textSecondary}`}>{assignee || 'Unassigned'}</span>
                            </div>
                            
                            {/* Due Date */}
                            {task.due_date && (
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-4 w-4 text-[#6366f1]" />
                                <span className={textSecondary}>{task.due_date}</span>
                              </div>
                            )}
                            
                            {/* Actions */}
                            {canAct && (
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => navigate(`/project/${task.project_id}`)}
                                  className="h-8"
                                >
                                  <Eye className="h-4 w-4 mr-1" /> View
                                </Button>
                                <Button 
                                  size="sm"
                                  className="h-8 bg-[#6366f1] hover:bg-[#4f46e5]"
                                  onClick={async () => {
                                    try {
                                      await axios.put(
                                        `${API}/api/website-projects/pages/${task.task_id}/stage-status`,
                                        { stage: displayStage, status: 'completed' },
                                        { headers: { Authorization: `Bearer ${token}` } }
                                      );
                                      toast.success(`${stageInfo?.label} completed!`);
                                      loadProjects();
                                    } catch (error) {
                                      toast.error('Failed to update status');
                                    }
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-1" /> Complete
                                </Button>
                              </div>
                            )}
                            {!canAct && (
                              <Badge variant="secondary">View Only</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Project Wise View */
              <div className="space-y-4">
                {(() => {
                  // Group tasks by project
                  const tasksByProject = {};
                  getTasksForStage(selectedTaskStage).forEach(task => {
                    const projectId = task.project_id;
                    if (!tasksByProject[projectId]) {
                      tasksByProject[projectId] = {
                        project_id: projectId,
                        project_name: task.project_name,
                        tasks: []
                      };
                    }
                    tasksByProject[projectId].tasks.push(task);
                  });
                  
                  const projectGroups = Object.values(tasksByProject);
                  
                  if (projectGroups.length === 0) {
                    return (
                      <div className={`text-center py-12 ${textSecondary}`}>
                        <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No tasks for today</p>
                        <p className="text-sm">Change the date filter to see more tasks</p>
                      </div>
                    );
                  }
                  
                  return projectGroups.map(group => (
                    <div key={group.project_id} className={`rounded-xl border ${borderColor} overflow-hidden`}>
                      {/* Project Header */}
                      <div 
                        className={`p-4 ${bgSecondary} flex items-center justify-between cursor-pointer hover:opacity-90`}
                        onClick={() => navigate(`/project/${group.project_id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <Globe className="h-5 w-5 text-[#6366f1]" />
                          <span className={`font-semibold ${textPrimary}`}>{group.project_name}</span>
                          <Badge variant="secondary">{group.tasks.length} pages</Badge>
                        </div>
                        <ArrowRight className="h-5 w-5 text-[#6366f1]" />
                      </div>
                      
                      {/* Tasks List */}
                      <div className="divide-y divide-gray-800">
                        {group.tasks.map(task => {
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
                          
                          return (
                            <div key={task.task_id} className={`p-3 ${bgCard} flex items-center justify-between`}>
                              <div className="flex items-center gap-3">
                                <FileText className={`h-4 w-4 ${textSecondary}`} />
                                <span className={textPrimary}>{task.page_name || task.name}</span>
                                {selectedTaskStage === 'all' && (
                                  <Badge className={`${stageInfo?.color}/20 text-xs`} style={{ color: stageInfo?.color?.includes('blue') ? '#3b82f6' : stageInfo?.color?.includes('purple') ? '#a855f7' : '#22c55e' }}>
                                    {stageInfo?.label}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-sm ${textSecondary}`}>{assignee || 'Unassigned'}</span>
                                {task.due_date && (
                                  <span className={`text-xs ${textSecondary}`}>{task.due_date}</span>
                                )}
                                {canAct ? (
                                  <Button 
                                    size="sm"
                                    className="h-7 text-xs bg-[#6366f1] hover:bg-[#4f46e5]"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        await axios.put(
                                          `${API}/api/website-projects/pages/${task.task_id}/stage-status`,
                                          { stage: displayStage, status: 'completed' },
                                          { headers: { Authorization: `Bearer ${token}` } }
                                        );
                                        toast.success(`${stageInfo?.label} completed!`);
                                        loadProjects();
                                      } catch (error) {
                                        toast.error('Failed to update');
                                      }
                                    }}
                                  >
                                    <Check className="h-3 w-3 mr-1" /> Done
                                  </Button>
                                ) : (
                                  <Badge variant="outline" className="text-xs">View Only</Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
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
    </Layout>
  );
}
