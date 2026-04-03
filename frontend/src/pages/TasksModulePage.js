import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
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
import { Progress } from '../components/ui/progress';
import {
  Plus, Calendar, Clock, User, CheckCircle2, Circle, 
  Trash2, Edit2, X, Briefcase, XCircle, CreditCard,
  Play, Pause, Square, Timer, Eye, Link as LinkIcon, Filter,
  ChevronRight, ArrowLeft, FileSpreadsheet, ExternalLink,
  Search, Building2, Layers, LayoutGrid, List, FileText,
  Repeat, Users, Globe, Code, Palette, FileEdit,
  Video, MapPin, UserCheck, ClipboardCheck, CalendarDays
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
  'on_hold': 'bg-[#f59e0b]/20 text-[#f59e0b]',
  'on-hold': 'bg-[#f59e0b]/20 text-[#f59e0b]',
  'cancelled': 'bg-[#ef4444]/20 text-[#ef4444]'
};

// Website page status colors
const WEBSITE_STATUS_COLORS = {
  'To-Do': 'bg-gray-500/20 text-gray-400',
  'In Progress': 'bg-blue-500/20 text-blue-400',
  'Client Review': 'bg-purple-500/20 text-purple-400',
  'Client Approved': 'bg-emerald-500/20 text-emerald-400',
  'Completed': 'bg-green-500/20 text-green-400',
  'On Hold': 'bg-orange-500/20 text-orange-400'
};

const WEBSITE_STATUS_OPTIONS = ['To-Do', 'In Progress', 'Client Review', 'Client Approved', 'Completed', 'On Hold'];

export default function TasksModulePage() {
  const { isDark } = useTheme();
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  
  // Check URL for my-tasks view
  const urlParams = new URLSearchParams(location.search);
  const initialView = urlParams.get('view') === 'my-tasks' ? 'my-tasks' : 'departments';
  
  // Navigation state
  const [view, setView] = useState(initialView);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // My Tasks Sub-tabs state
  const [myTasksSubTab, setMyTasksSubTab] = useState('all'); // all, tasks, meetings, approvals
  const [myTasksAssignFilter, setMyTasksAssignFilter] = useState('to_me'); // by_me, to_me
  const [myTasksDeptFilter, setMyTasksDeptFilter] = useState('all'); // all, seo, social_media, bde, operations, meta, website, erp
  const [myTasks, setMyTasks] = useState([]);
  const [myTasksLoading, setMyTasksLoading] = useState(false);
  const [myTasksDateFilter, setMyTasksDateFilter] = useState('all'); // all, today, week, month, range
  const [myTasksDateRange, setMyTasksDateRange] = useState({ from: '', to: '' });
  const [showMyTaskModal, setShowMyTaskModal] = useState(false);
  const [dailyQuote, setDailyQuote] = useState('');
  const [myTaskForm, setMyTaskForm] = useState({
    task_name: '',
    description: '',
    priority: 'medium',
    type: 'task', // task, meeting, approval
    assigned_to: '',
    department: '', // for department filter
    due_date: '',
    due_time: '',
    status: 'pending',
    // Meeting specific fields
    meeting_type: '', // operations, client
    meeting_mode: '', // office, team, client, department, personal
    meeting_format: 'online', // online, offline
    meeting_location: '',
    meeting_link: '',
    attendees: [],
    // Approval specific
    approval_type: '', // review, approval
    approval_for: '' // user_id who needs to approve
  });
  
  // Pending approvals state
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  
  // Motivational quotes (31 positive 3-word quotes)
  const motivationalQuotes = [
    "Believe in yourself",
    "Never give up",
    "Dream big today",
    "Stay always positive",
    "Keep moving forward",
    "You are enough",
    "Chase your dreams",
    "Make it happen",
    "Be the change",
    "Start right now",
    "Embrace every challenge",
    "Rise and shine",
    "Create your future",
    "Trust the process",
    "Stay focused always",
    "Push your limits",
    "Shine bright today",
    "Own your journey",
    "Be unstoppable now",
    "Growth takes time",
    "Courage conquers fear",
    "Progress not perfection",
    "Inspire others daily",
    "Success awaits you",
    "Today matters most",
    "Live with purpose",
    "Action creates results",
    "Persistence beats resistance",
    "You got this",
    "Make today count",
    "Excellence every day"
  ];
  
  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };
  
  // Get daily quote (changes each day)
  useEffect(() => {
    const dayOfMonth = new Date().getDate();
    const quoteIndex = (dayOfMonth - 1) % motivationalQuotes.length;
    setDailyQuote(motivationalQuotes[quoteIndex]);
  }, []);
  
  // Department options for filter
  const departmentOptions = [
    { id: 'all', label: 'All Departments' },
    { id: 'seo', label: 'SEO' },
    { id: 'social_media', label: 'Social Media' },
    { id: 'bde', label: 'Business Dev' },
    { id: 'operations', label: 'Operations' },
    { id: 'meta', label: 'Meta' },
    { id: 'website', label: 'Website' },
    { id: 'erp', label: 'ERP' }
  ];
  
  // Data
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectDetail, setProjectDetail] = useState(null);
  const [users, setUsers] = useState([]);
  
  // Website specific
  const [websiteProjects, setWebsiteProjects] = useState([]);
  const [websiteProjectDetail, setWebsiteProjectDetail] = useState(null);
  const [websiteViewMode, setWebsiteViewMode] = useState('projects'); // projects, tasks
  const [websiteFilters, setWebsiteFilters] = useState({ search: '', developer: 'all', status: 'all', date: '' });
  const [showWebsiteProjectModal, setShowWebsiteProjectModal] = useState(false);
  const [showWebsitePageModal, setShowWebsitePageModal] = useState(false);
  const [editingWebsitePage, setEditingWebsitePage] = useState(null);
  const [websiteProjectTab, setWebsiteProjectTab] = useState('pages'); // pages, tasks
  const [websitePageSearch, setWebsitePageSearch] = useState('');
  const [showEditWebsiteProjectModal, setShowEditWebsiteProjectModal] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(null); // { taskId, field } for adding URLs
  const [urlInput, setUrlInput] = useState('');
  
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
  const hoverBg = isDark ? 'hover:bg-[#3f3f46]' : 'hover:bg-gray-200';

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

  // ========== MY TASKS FUNCTIONS ==========
  
  // Load my tasks (tasks assigned to me or created by me)
  const loadMyTasks = useCallback(async () => {
    setMyTasksLoading(true);
    try {
      const res = await axios.get(`${API}/api/tasks/my-tasks`, { headers });
      setMyTasks(res.data);
    } catch (error) {
      console.error('Error loading my tasks:', error);
      // Fallback to BDE tasks if my-tasks endpoint doesn't exist
      try {
        const bdeRes = await axios.get(`${API}/api/bde/tasks`, { headers });
        setMyTasks(bdeRes.data);
      } catch (e) {
        setMyTasks([]);
      }
    }
    setMyTasksLoading(false);
  }, []);

  // Load pending approvals from various departments
  const loadPendingApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      // Get salary approvals pending CEO review
      const salaryRes = await axios.get(`${API}/api/hr/admin/payslips?status=ceo_review`, { headers });
      const salaryApprovals = (salaryRes.data || []).map(p => ({
        approval_id: p.payslip_id,
        type: 'salary',
        title: `Salary Approval - ${p.employee_name}`,
        description: `${new Date(0, p.month - 1).toLocaleString('default', { month: 'long' })} ${p.year} Payslip`,
        department: 'HR',
        amount: p.net_salary,
        status: p.status,
        requested_by: p.created_by_name || 'HR Admin',
        created_at: p.created_at,
        data: p
      }));
      
      // Get task approvals
      const taskApprovals = myTasks
        .filter(t => t.type === 'approval' || t.needs_approval)
        .map(t => ({
          approval_id: t.task_id,
          type: 'task',
          title: t.task_name,
          description: t.description,
          department: t.department || 'General',
          status: t.status,
          requested_by: t.created_by_name || 'Unknown',
          created_at: t.created_at,
          data: t
        }));
      
      setPendingApprovals([...salaryApprovals, ...taskApprovals]);
    } catch (error) {
      console.error('Error loading approvals:', error);
      setPendingApprovals([]);
    }
    setApprovalsLoading(false);
  }, [myTasks]);

  // Handle approval action
  const handleApprovalAction = async (approval, action, remarks) => {
    try {
      if (approval.type === 'salary') {
        // Handle salary approval
        const endpoint = action === 'approve' 
          ? `${API}/api/hr/admin/payslip/${approval.approval_id}/ceo-approve`
          : `${API}/api/hr/admin/payslip/${approval.approval_id}/reject`;
        
        await axios.post(endpoint, { 
          remarks,
          ...(action === 'approve' ? { ceo_remarks: remarks } : { rejection_reason: remarks })
        }, { headers });
        
        toast.success(`Payslip ${action}d successfully`);
      } else {
        // Handle task approval
        await axios.put(`${API}/api/bde/tasks/${approval.approval_id}`, {
          status: action === 'approve' ? 'completed' : 'rejected',
          approval_remarks: remarks
        }, { headers });
        
        toast.success(`Task ${action}d successfully`);
      }
      
      setShowApprovalModal(false);
      setSelectedApproval(null);
      setApprovalRemarks('');
      loadPendingApprovals();
      loadMyTasks();
    } catch (error) {
      toast.error(`Failed to ${action} approval`);
    }
  };

  // Create my task
  const handleCreateMyTask = async () => {
    if (!myTaskForm.task_name.trim()) {
      toast.error('Task name is required');
      return;
    }
    try {
      const payload = {
        ...myTaskForm,
        // Include meeting details if type is meeting
        meeting_details: myTaskForm.type === 'meeting' ? {
          meeting_type: myTaskForm.meeting_type,
          meeting_mode: myTaskForm.meeting_mode,
          meeting_format: myTaskForm.meeting_format,
          meeting_location: myTaskForm.meeting_location,
          meeting_link: myTaskForm.meeting_link,
          attendees: myTaskForm.attendees
        } : null,
        // Include approval details if type is approval
        approval_details: myTaskForm.type === 'approval' ? {
          approval_type: myTaskForm.approval_type,
          approval_for: myTaskForm.approval_for
        } : null
      };
      await axios.post(`${API}/api/bde/tasks`, payload, { headers });
      toast.success('Task created successfully');
      setShowMyTaskModal(false);
      resetMyTaskForm();
      loadMyTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create task');
    }
  };

  const resetMyTaskForm = () => {
    setMyTaskForm({
      task_name: '', description: '', priority: 'medium', type: 'task',
      assigned_to: '', due_date: '', due_time: '', status: 'pending',
      meeting_type: '', meeting_mode: '', meeting_format: 'online',
      meeting_location: '', meeting_link: '', attendees: [],
      approval_type: '', approval_for: ''
    });
  };

  // Filter my tasks by sub-tab, assignment, department and date
  const filteredMyTasks = myTasks.filter(task => {
    // Sub-tab filter
    if (myTasksSubTab === 'tasks') {
      if (task.type === 'meeting' || task.type === 'approval') return false;
      
      // Assignment filter (only for Tasks tab)
      if (myTasksAssignFilter === 'by_me' && task.created_by !== user?.user_id) return false;
      if (myTasksAssignFilter === 'to_me' && task.assigned_to !== user?.user_id) return false;
      
      // Department filter
      if (myTasksDeptFilter !== 'all') {
        const taskDept = (task.department || '').toLowerCase().replace(/\s+/g, '_');
        if (taskDept !== myTasksDeptFilter && !taskDept.includes(myTasksDeptFilter)) return false;
      }
    }
    if (myTasksSubTab === 'meetings' && task.type !== 'meeting') return false;
    if (myTasksSubTab === 'approvals' && task.type !== 'approval' && !task.needs_approval) return false;
    
    // Date filter
    const taskDate = task.due_date || task.created_at?.split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    if (myTasksDateFilter === 'today' && taskDate !== today) return false;
    if (myTasksDateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      if (taskDate < weekAgo.toISOString().split('T')[0]) return false;
    }
    if (myTasksDateFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      if (taskDate < monthAgo.toISOString().split('T')[0]) return false;
    }
    if (myTasksDateFilter === 'range') {
      if (myTasksDateRange.from && taskDate < myTasksDateRange.from) return false;
      if (myTasksDateRange.to && taskDate > myTasksDateRange.to) return false;
    }
    
    return true;
  });

  // My tasks stats
  const myTasksStats = {
    all: myTasks.length,
    tasks: myTasks.filter(t => t.type !== 'meeting' && t.type !== 'approval' && !t.needs_approval).length,
    meetings: myTasks.filter(t => t.type === 'meeting').length,
    approvals: pendingApprovals.length || myTasks.filter(t => t.type === 'approval' || t.needs_approval).length
  };

  // ========== WEBSITE SPECIFIC FUNCTIONS ==========
  
  // Load website projects
  const loadWebsiteProjects = useCallback(async () => {
    try {
      let url = `${API}/api/departments/website/projects`;
      const params = new URLSearchParams();
      if (websiteFilters.status && websiteFilters.status !== 'all') params.append('status', websiteFilters.status);
      if (websiteFilters.developer && websiteFilters.developer !== 'all') params.append('developer', websiteFilters.developer);
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await axios.get(url, { headers });
      setWebsiteProjects(res.data);
    } catch (error) {
      console.error('Error loading website projects:', error);
    }
  }, [websiteFilters.status, websiteFilters.developer]);

  // Load website project detail
  const loadWebsiteProjectDetail = useCallback(async (projectId) => {
    try {
      const res = await axios.get(`${API}/api/departments/website/projects/${projectId}`, { headers });
      setWebsiteProjectDetail(res.data);
    } catch (error) {
      console.error('Error loading website project:', error);
    }
  }, []);

  // Check if department is Website type
  const isWebsiteDepartment = (dept) => {
    return dept?.dept_type === 'website' || dept?.name === 'Website';
  };

  useEffect(() => {
    loadDepartments();
    loadUsers();
  }, [loadDepartments, loadUsers]);

  // Update view when URL changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'my-tasks') {
      setView('my-tasks');
    }
  }, [location.search]);

  // Load my tasks when switching to my-tasks view
  useEffect(() => {
    if (view === 'my-tasks') {
      loadMyTasks();
    }
  }, [view, loadMyTasks]);

  // Load approvals when switching to approvals tab
  useEffect(() => {
    if (myTasksSubTab === 'approvals') {
      loadPendingApprovals();
    }
  }, [myTasksSubTab, loadPendingApprovals]);

  useEffect(() => {
    if (selectedDepartment) {
      if (isWebsiteDepartment(selectedDepartment)) {
        loadWebsiteProjects();
      } else {
        loadProjects(selectedDepartment.department_id);
      }
    }
  }, [selectedDepartment, loadProjects, loadWebsiteProjects]);

  useEffect(() => {
    if (selectedProject) {
      if (isWebsiteDepartment(selectedDepartment)) {
        loadWebsiteProjectDetail(selectedProject.project_id);
      } else {
        loadProjectDetail(selectedProject.project_id);
      }
    }
  }, [selectedProject, selectedDepartment, loadProjectDetail, loadWebsiteProjectDetail]);

  // Navigate to department
  const handleSelectDepartment = (dept) => {
    setSelectedDepartment(dept);
    setSelectedProject(null);
    setProjectDetail(null);
    setWebsiteProjectDetail(null);
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
      setWebsiteProjectDetail(null);
      setView('projects');
    } else if (view === 'projects') {
      setSelectedDepartment(null);
      setProjects([]);
      setWebsiteProjects([]);
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

  // Filter website projects
  const filteredWebsiteProjects = websiteProjects.filter(p => {
    if (websiteFilters.search) {
      const search = websiteFilters.search.toLowerCase();
      return p.name.toLowerCase().includes(search);
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

  // ========== WEBSITE PROJECT CRUD ==========
  
  const [websiteProjectForm, setWebsiteProjectForm] = useState({
    name: '', onboarding_date: '', deadline: '', status: 'active', platform: 'Website',
    website_type: 'Business Website', developer: '', designer: '', domain_url: '',
    client_name: '', location: '', client_drive_url: '', documents_url: ''
  });

  const handleCreateWebsiteProject = async () => {
    if (!websiteProjectForm.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/departments/website/projects`, websiteProjectForm, { headers });
      toast.success('Website project created');
      setShowWebsiteProjectModal(false);
      setWebsiteProjectForm({ name: '', onboarding_date: '', deadline: '', status: 'active', platform: 'Website', website_type: 'Business Website', developer: '', designer: '', domain_url: '', client_name: '', location: '', client_drive_url: '', documents_url: '' });
      loadWebsiteProjects();
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  const handleDeleteWebsiteProject = async (projectId) => {
    if (!window.confirm('Delete this project and all its pages?')) return;
    try {
      await axios.delete(`${API}/api/departments/website/projects/${projectId}`, { headers });
      toast.success('Project deleted');
      loadWebsiteProjects();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  // Website page handlers
  const [websitePageForm, setWebsitePageForm] = useState({ page_name: '', assigned_to: '', notes: '' });

  const handleAddWebsitePage = async () => {
    if (!websitePageForm.page_name.trim()) {
      toast.error('Page name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/departments/website/projects/${selectedProject.project_id}/pages`, websitePageForm, { headers });
      toast.success('Page added');
      setShowWebsitePageModal(false);
      setWebsitePageForm({ page_name: '', assigned_to: '', notes: '' });
      loadWebsiteProjectDetail(selectedProject.project_id);
    } catch (error) {
      toast.error('Failed to add page');
    }
  };

  const handleUpdateWebsitePage = async (taskId, updates) => {
    try {
      await axios.put(`${API}/api/departments/website/pages/${taskId}`, updates, { headers });
      loadWebsiteProjectDetail(selectedProject.project_id);
    } catch (error) {
      toast.error('Failed to update page');
    }
  };

  const handleDeleteWebsitePage = async (taskId) => {
    if (!window.confirm('Delete this page?')) return;
    try {
      await axios.delete(`${API}/api/departments/website/pages/${taskId}`, { headers });
      toast.success('Page deleted');
      loadWebsiteProjectDetail(selectedProject.project_id);
    } catch (error) {
      toast.error('Failed to delete page');
    }
  };

  // Get user initials for avatar
  const getUserInitials = (userId) => {
    const u = users.find(x => x.user_id === userId);
    if (!u) return '?';
    const names = u.name.split(' ');
    return names.length > 1 ? `${names[0][0]}${names[1][0]}` : names[0][0];
  };

  // Get user name
  const getUserName = (userId) => {
    const u = users.find(x => x.user_id === userId);
    return u?.name || 'Unassigned';
  };

  // Handle adding URL to a page column
  const handleAddUrl = async (taskId, field) => {
    if (!urlInput.trim()) {
      toast.error('Please enter a URL');
      return;
    }
    try {
      await axios.put(`${API}/api/departments/website/pages/${taskId}`, { [field]: urlInput }, { headers });
      setShowUrlModal(null);
      setUrlInput('');
      loadWebsiteProjectDetail(selectedProject.project_id);
      toast.success('URL added');
    } catch (error) {
      toast.error('Failed to add URL');
    }
  };

  // Handle edit website project
  const handleEditWebsiteProject = async () => {
    try {
      await axios.put(`${API}/api/departments/website/projects/${websiteProjectDetail.project_id}`, websiteProjectForm, { headers });
      toast.success('Project updated');
      setShowEditWebsiteProjectModal(false);
      loadWebsiteProjectDetail(websiteProjectDetail.project_id);
    } catch (error) {
      toast.error('Failed to update project');
    }
  };

  // Open edit project modal with current data
  const openEditProjectModal = () => {
    setWebsiteProjectForm({
      name: websiteProjectDetail.name || '',
      onboarding_date: websiteProjectDetail.onboarding_date || '',
      deadline: websiteProjectDetail.deadline || '',
      status: websiteProjectDetail.status || 'active',
      platform: websiteProjectDetail.platform || 'Website',
      website_type: websiteProjectDetail.website_type || 'Business Website',
      developer: websiteProjectDetail.developer || '',
      designer: websiteProjectDetail.designer || '',
      domain_url: websiteProjectDetail.domain_url || '',
      client_name: websiteProjectDetail.client_name || '',
      location: websiteProjectDetail.location || '',
      client_drive_url: websiteProjectDetail.client_drive_url || '',
      documents_url: websiteProjectDetail.documents_url || ''
    });
    setShowEditWebsiteProjectModal(true);
  };

  // Format date for input
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Format date for display
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
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
        {/* Header - Hide when in My Tasks view */}
        {view !== 'my-tasks' && (
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
              {view === 'departments' && (
                <Button 
                  onClick={() => setView('my-tasks')} 
                  variant="outline"
                  className={`${borderColor} ${textPrimary}`}
                  data-testid="my-tasks-btn"
                >
                  <User className="h-4 w-4 mr-2" />
                  My Tasks
                </Button>
              )}
              {view === 'departments' && isAdmin && (
                <Button onClick={() => setShowDeptModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              )}
              {view === 'projects' && !isWebsiteDepartment(selectedDepartment) && (
                <Button onClick={() => { setEditingProject(null); setProjectForm({ name: '', client_name: '', description: '', start_date: '', end_date: '', status: 'active', team_members: [] }); setShowProjectModal(true); }} className="bg-[#10b981] hover:bg-[#059669]">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              )}
              {view === 'projects' && isWebsiteDepartment(selectedDepartment) && (
                <Button onClick={() => setShowWebsiteProjectModal(true)} className="bg-[#10b981] hover:bg-[#059669]">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              )}
              {view === 'project-detail' && !isWebsiteDepartment(selectedDepartment) && (
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
              {view === 'project-detail' && isWebsiteDepartment(selectedDepartment) && (
                <Button onClick={() => setShowWebsitePageModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Page
                </Button>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* My Tasks View */}
          {view === 'my-tasks' && (
            <div className="space-y-6">
              {/* Greeting Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className={`text-2xl font-bold ${textPrimary}`}>
                      {getGreeting()}, {user?.name?.split(' ')[0] || 'User'}!
                    </h1>
                    <p className="text-lg text-[#6366f1] font-medium mt-1 italic">
                      "{dailyQuote}"
                    </p>
                  </div>
                  <Button onClick={() => setShowMyTaskModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <Card className={`${bgCard} border ${borderColor} p-4`}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                      <Briefcase className="h-5 w-5 text-[#6366f1]" />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${textPrimary}`}>{myTasksStats.all}</p>
                      <p className={`text-sm ${textSecondary}`}>Total Tasks</p>
                    </div>
                  </div>
                </Card>
                <Card className={`${bgCard} border ${borderColor} p-4`}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-[#f59e0b]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#f59e0b]">{myTasks.filter(t => t.status === 'pending').length}</p>
                      <p className={`text-sm ${textSecondary}`}>Pending</p>
                    </div>
                  </div>
                </Card>
                <Card className={`${bgCard} border ${borderColor} p-4`}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center">
                      <Timer className="h-5 w-5 text-[#3b82f6]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#3b82f6]">{myTasks.filter(t => t.status === 'in_progress').length}</p>
                      <p className={`text-sm ${textSecondary}`}>In Progress</p>
                    </div>
                  </div>
                </Card>
                <Card className={`${bgCard} border ${borderColor} p-4`}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#10b981]/20 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-[#10b981]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#10b981]">{myTasks.filter(t => t.status === 'completed').length}</p>
                      <p className={`text-sm ${textSecondary}`}>Completed</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Main Tabs: All | Tasks | Meetings | Review/Approval */}
              <div className={`flex rounded-lg ${bgCard} border ${borderColor} p-1 w-fit`}>
                {[
                  { id: 'all', label: 'All', icon: Layers, count: myTasksStats.all },
                  { id: 'tasks', label: 'Tasks', icon: CheckCircle2, count: myTasksStats.tasks },
                  { id: 'meetings', label: 'Meetings', icon: Video, count: myTasksStats.meetings },
                  { id: 'approvals', label: 'Review/Approval', icon: ClipboardCheck, count: myTasksStats.approvals }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setMyTasksSubTab(tab.id)}
                    data-testid={`my-tasks-tab-${tab.id}`}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      myTasksSubTab === tab.id
                        ? 'bg-[#6366f1] text-white'
                        : `${textSecondary} hover:bg-[#27272a]`
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    <Badge className={`ml-1 ${myTasksSubTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#27272a]'}`}>
                      {tab.count}
                    </Badge>
                  </button>
                ))}
              </div>

              {/* Tasks Tab Sub-filters */}
              {myTasksSubTab === 'tasks' && (
                <div className="space-y-4">
                  {/* Assigned by me / Assigned to me Toggle */}
                  <div className="flex items-center gap-4">
                    <div className={`flex rounded-lg ${bgSecondary} p-1`}>
                      <button
                        onClick={() => setMyTasksAssignFilter('to_me')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          myTasksAssignFilter === 'to_me'
                            ? 'bg-[#6366f1] text-white'
                            : `${textSecondary} ${hoverBg}`
                        }`}
                        data-testid="filter-assigned-to-me"
                      >
                        Assigned to me
                      </button>
                      <button
                        onClick={() => setMyTasksAssignFilter('by_me')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          myTasksAssignFilter === 'by_me'
                            ? 'bg-[#6366f1] text-white'
                            : `${textSecondary} ${hoverBg}`
                        }`}
                        data-testid="filter-assigned-by-me"
                      >
                        Assigned by me
                      </button>
                    </div>

                    {/* Date Filter */}
                    <Select value={myTasksDateFilter} onValueChange={setMyTasksDateFilter}>
                      <SelectTrigger className={`w-36 ${bgCard} ${borderColor}`}>
                        <CalendarDays className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="range">Date Range</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {myTasksDateFilter === 'range' && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={myTasksDateRange.from}
                          onChange={(e) => setMyTasksDateRange({ ...myTasksDateRange, from: e.target.value })}
                          className={`w-36 ${bgCard} ${borderColor}`}
                        />
                        <span className={textSecondary}>to</span>
                        <Input
                          type="date"
                          value={myTasksDateRange.to}
                          onChange={(e) => setMyTasksDateRange({ ...myTasksDateRange, to: e.target.value })}
                          className={`w-36 ${bgCard} ${borderColor}`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Department Filter Pills */}
                  <div className="flex flex-wrap gap-2">
                    {departmentOptions.map(dept => (
                      <button
                        key={dept.id}
                        onClick={() => setMyTasksDeptFilter(dept.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          myTasksDeptFilter === dept.id
                            ? 'bg-[#6366f1] text-white'
                            : `${bgSecondary} ${textSecondary} ${hoverBg}`
                        }`}
                        data-testid={`dept-filter-${dept.id}`}
                      >
                        {dept.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date Filters for non-tasks tabs */}
              {myTasksSubTab !== 'tasks' && myTasksSubTab !== 'approvals' && (
                <div className="flex items-center gap-2">
                  <Select value={myTasksDateFilter} onValueChange={setMyTasksDateFilter}>
                    <SelectTrigger className={`w-36 ${bgCard} ${borderColor}`}>
                      <CalendarDays className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={bgCard}>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="range">Date Range</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {myTasksDateFilter === 'range' && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={myTasksDateRange.from}
                        onChange={(e) => setMyTasksDateRange({ ...myTasksDateRange, from: e.target.value })}
                        className={`w-36 ${bgCard} ${borderColor}`}
                      />
                      <span className={textSecondary}>to</span>
                      <Input
                        type="date"
                        value={myTasksDateRange.to}
                        onChange={(e) => setMyTasksDateRange({ ...myTasksDateRange, to: e.target.value })}
                        className={`w-36 ${bgCard} ${borderColor}`}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Approvals Tab Content */}
              {myTasksSubTab === 'approvals' && (
                <div className="space-y-4">
                  {approvalsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin h-8 w-8 border-2 border-[#6366f1] border-t-transparent rounded-full" />
                    </div>
                  ) : pendingApprovals.length === 0 ? (
                    <Card className={`${bgCard} border ${borderColor}`}>
                      <div className="p-12 text-center">
                        <ClipboardCheck className={`h-16 w-16 mx-auto mb-4 ${textSecondary}`} />
                        <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>No pending approvals</h3>
                        <p className={textSecondary}>All caught up! Check back later for new approval requests.</p>
                      </div>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {pendingApprovals.map(approval => (
                        <Card key={approval.approval_id} className={`${bgCard} border ${borderColor} hover:border-[#f59e0b]/50 transition-all`}>
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  {approval.type === 'salary' ? (
                                    <div className="h-10 w-10 rounded-lg bg-[#10b981]/20 flex items-center justify-center">
                                      <CreditCard className="h-5 w-5 text-[#10b981]" />
                                    </div>
                                  ) : (
                                    <div className="h-10 w-10 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center">
                                      <ClipboardCheck className="h-5 w-5 text-[#f59e0b]" />
                                    </div>
                                  )}
                                  <div>
                                    <h4 className={`font-medium ${textPrimary}`}>{approval.title}</h4>
                                    <p className={`text-sm ${textSecondary}`}>{approval.description}</p>
                                  </div>
                                  <Badge variant="outline" className="text-[#6366f1] border-[#6366f1] ml-auto">
                                    {approval.department}
                                  </Badge>
                                </div>
                                
                                {/* Preview Summary */}
                                <div className={`mt-4 p-4 rounded-lg ${bgSecondary}`}>
                                  {approval.type === 'salary' && approval.data && (
                                    <div className="grid grid-cols-4 gap-4 text-sm">
                                      <div>
                                        <p className={textSecondary}>Employee</p>
                                        <p className={`font-medium ${textPrimary}`}>{approval.data.employee_name}</p>
                                      </div>
                                      <div>
                                        <p className={textSecondary}>Period</p>
                                        <p className={`font-medium ${textPrimary}`}>
                                          {new Date(0, approval.data.month - 1).toLocaleString('default', { month: 'short' })} {approval.data.year}
                                        </p>
                                      </div>
                                      <div>
                                        <p className={textSecondary}>Net Salary</p>
                                        <p className="font-medium text-[#10b981]">₹{approval.data.net_salary?.toLocaleString()}</p>
                                      </div>
                                      <div>
                                        <p className={textSecondary}>Days Present</p>
                                        <p className={`font-medium ${textPrimary}`}>{approval.data.attendance?.days_present || 0}</p>
                                      </div>
                                    </div>
                                  )}
                                  {approval.type !== 'salary' && (
                                    <div className="text-sm">
                                      <p className={textSecondary}>Requested by: <span className={textPrimary}>{approval.requested_by}</span></p>
                                      {approval.data?.description && (
                                        <p className={`mt-2 ${textPrimary}`}>{approval.data.description}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                
                                <div className={`flex items-center gap-4 mt-4 text-sm ${textSecondary}`}>
                                  <span>From: {approval.requested_by}</span>
                                  <span>•</span>
                                  <span>{new Date(approval.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => { setSelectedApproval(approval); setShowApprovalModal(true); }}
                                  className="bg-[#10b981] hover:bg-[#059669] text-white"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Review & Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedApproval({ ...approval, action: 'reject' }); setShowApprovalModal(true); }}
                                  className="text-red-500 border-red-500 hover:bg-red-500/10"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tasks List - for All, Tasks, Meetings tabs */}
              {myTasksSubTab !== 'approvals' && (myTasksLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-[#6366f1] border-t-transparent rounded-full" />
                </div>
              ) : filteredMyTasks.length === 0 ? (
                <Card className={`${bgCard} border ${borderColor}`}>
                  <div className="p-12 text-center">
                    <Briefcase className={`h-16 w-16 mx-auto mb-4 ${textSecondary}`} />
                    <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>No {myTasksSubTab === 'all' ? 'tasks' : myTasksSubTab} found</h3>
                    <p className={textSecondary}>Create a new {myTasksSubTab === 'meetings' ? 'meeting' : myTasksSubTab === 'approvals' ? 'approval request' : 'task'} to get started</p>
                    <Button onClick={() => setShowMyTaskModal(true)} className="mt-4 bg-[#6366f1] hover:bg-[#4f46e5]">
                      <Plus className="h-4 w-4 mr-2" />
                      Create {myTasksSubTab === 'meetings' ? 'Meeting' : myTasksSubTab === 'approvals' ? 'Approval' : 'Task'}
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredMyTasks.map(task => (
                    <Card key={task.task_id} className={`${bgCard} border ${borderColor} hover:border-[#6366f1]/50 transition-all`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {task.type === 'meeting' ? (
                                <Video className="h-5 w-5 text-[#6366f1]" />
                              ) : task.type === 'approval' || task.needs_approval ? (
                                <ClipboardCheck className="h-5 w-5 text-[#f59e0b]" />
                              ) : (
                                <CheckCircle2 className={`h-5 w-5 ${task.status === 'completed' ? 'text-[#10b981]' : 'text-[#71717a]'}`} />
                              )}
                              <h4 className={`font-medium ${textPrimary}`}>{task.task_name}</h4>
                              <Badge className={priorityColors[task.priority] || priorityColors.medium}>
                                {task.priority || 'Medium'}
                              </Badge>
                              <Badge className={statusColors[task.status]?.bg + ' ' + statusColors[task.status]?.text}>
                                {statusColors[task.status]?.label || task.status}
                              </Badge>
                              {task.department && (
                                <Badge variant="outline" className="text-[#6366f1] border-[#6366f1]">
                                  {task.department}
                                </Badge>
                              )}
                            </div>
                            
                            {task.description && (
                              <p className={`text-sm ${textSecondary} mb-2`}>{task.description}</p>
                            )}
                            
                            <div className="flex items-center gap-4 text-sm">
                              {task.due_date && (
                                <div className={`flex items-center gap-1 ${textSecondary}`}>
                                  <Calendar className="h-4 w-4" />
                                  <span>{formatDateDisplay(task.due_date)}</span>
                                  {task.due_time && <span>at {task.due_time}</span>}
                                </div>
                              )}
                              
                              {task.assigned_to_name && (
                                <div className={`flex items-center gap-1 ${textSecondary}`}>
                                  <User className="h-4 w-4" />
                                  <span>{task.assigned_to_name}</span>
                                </div>
                              )}
                              
                              {/* Meeting specific info */}
                              {task.type === 'meeting' && task.meeting_details && (
                                <>
                                  {task.meeting_details.meeting_type && (
                                    <Badge variant="outline" className="text-[#6366f1] border-[#6366f1]">
                                      {task.meeting_details.meeting_type === 'operations' ? 'Operations Meeting' : 'Client Meeting'}
                                    </Badge>
                                  )}
                                  {task.meeting_details.meeting_format === 'online' ? (
                                    <div className={`flex items-center gap-1 ${textSecondary}`}>
                                      <Video className="h-4 w-4" />
                                      <span>Online</span>
                                    </div>
                                  ) : (
                                    <div className={`flex items-center gap-1 ${textSecondary}`}>
                                      <MapPin className="h-4 w-4" />
                                      <span>{task.meeting_details.meeting_location || 'Office'}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className={textSecondary}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className={textSecondary}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}

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

          {/* Projects View - Standard */}
          {view === 'projects' && selectedDepartment && !isWebsiteDepartment(selectedDepartment) && (
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

          {/* Website Projects View */}
          {view === 'projects' && selectedDepartment && isWebsiteDepartment(selectedDepartment) && (
            <div className="space-y-4">
              {/* Header with count and toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className={`text-lg font-semibold ${textPrimary}`}>All Website Projects</h2>
                  <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{filteredWebsiteProjects.length} Projects</Badge>
                </div>
                <div className={`flex items-center ${bgCard} border ${borderColor} rounded-lg p-1`}>
                  <button onClick={() => setWebsiteViewMode('projects')} className={`px-3 py-1 rounded text-sm ${websiteViewMode === 'projects' ? 'bg-[#6366f1] text-white' : textSecondary}`}>
                    Projects
                  </button>
                  <button onClick={() => setWebsiteViewMode('tasks')} className={`px-3 py-1 rounded text-sm ${websiteViewMode === 'tasks' ? 'bg-[#6366f1] text-white' : textSecondary}`}>
                    Task View
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
                  <Input
                    placeholder="Search projects..."
                    value={websiteFilters.search}
                    onChange={(e) => setWebsiteFilters({ ...websiteFilters, search: e.target.value })}
                    className={`pl-10 ${bgCard} ${borderColor}`}
                  />
                </div>
                
                <Input
                  type="date"
                  value={websiteFilters.date}
                  onChange={(e) => setWebsiteFilters({ ...websiteFilters, date: e.target.value })}
                  className={`w-40 ${bgCard} ${borderColor}`}
                />
                
                <Select value={websiteFilters.developer} onValueChange={(v) => { setWebsiteFilters({ ...websiteFilters, developer: v }); }}>
                  <SelectTrigger className={`w-40 ${bgCard} ${borderColor}`}>
                    <SelectValue placeholder="All Developers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Developers</SelectItem>
                    {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                
                <Select value={websiteFilters.status} onValueChange={(v) => { setWebsiteFilters({ ...websiteFilters, status: v }); }}>
                  <SelectTrigger className={`w-40 ${bgCard} ${borderColor}`}>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Website Projects Table */}
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={bgSecondary}>
                        <tr>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Project</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Status</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Dev %</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Overall %</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Developer</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Onboarding</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Deadline</th>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Pages</th>
                          <th className={`px-4 py-3`}></th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-200'}`}>
                        {filteredWebsiteProjects.length === 0 ? (
                          <tr>
                            <td colSpan={9} className={`px-4 py-8 text-center ${textSecondary}`}>
                              <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p>No website projects found</p>
                            </td>
                          </tr>
                        ) : filteredWebsiteProjects.map(project => (
                          <tr key={project.project_id} className={`hover:${bgSecondary} cursor-pointer`} onClick={() => handleSelectProject(project)}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Globe className="h-5 w-5 text-[#22c55e]" />
                                <div>
                                  <div className={`font-medium ${textPrimary}`}>{project.name}</div>
                                  <div className={`text-xs ${textSecondary}`}>{project.website_type || 'Website'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={projectStatusColors[project.status] || projectStatusColors['active']}>{project.status}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-16 h-2 rounded-full ${bgSecondary}`}>
                                  <div className="h-2 rounded-full bg-[#3b82f6]" style={{ width: `${project.dev_percent || 0}%` }} />
                                </div>
                                <span className={`text-xs ${textSecondary}`}>{project.dev_percent || 0}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={`${project.overall_percent >= 100 ? 'bg-[#10b981]/20 text-[#10b981]' : project.overall_percent >= 50 ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'bg-[#71717a]/20 text-[#71717a]'}`}>
                                {project.overall_percent || 0}%
                              </Badge>
                            </td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{project.developer_name || '-'}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{formatDateDisplay(project.onboarding_date)}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{formatDateDisplay(project.deadline)}</td>
                            <td className="px-4 py-3">
                              <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{project.total_pages || 0}</Badge>
                            </td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteWebsiteProject(project.project_id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
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

          {/* Project Detail View with BDE-style Tasks */}
          {view === 'project-detail' && projectDetail && !isWebsiteDepartment(selectedDepartment) && (
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

          {/* Website Project Detail View - Operations Style Redesign */}
          {view === 'project-detail' && websiteProjectDetail && isWebsiteDepartment(selectedDepartment) && (
            <div className="space-y-4">
              {/* Project Header Card - Operations Style */}
              <Card className={`${bgCard} border ${borderColor}`}>
                <div className="p-5">
                  {/* Top Row: Project Name, Status Badge, Action Buttons */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Globe className="h-8 w-8 text-[#22c55e]" />
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className={`text-xl font-bold ${textPrimary}`}>{websiteProjectDetail.name}</h2>
                          <Badge className={`${projectStatusColors[websiteProjectDetail.status] || projectStatusColors['active']} uppercase text-xs`}>
                            {websiteProjectDetail.status}
                          </Badge>
                        </div>
                        <p className={`text-sm ${textSecondary}`}>{websiteProjectDetail.website_type || 'Website'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {websiteProjectDetail.documents_url && (
                        <a href={websiteProjectDetail.documents_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className={`${borderColor} gap-2`}>
                            <FileText className="h-4 w-4" /> Docs
                          </Button>
                        </a>
                      )}
                      {websiteProjectDetail.client_drive_url && (
                        <a href={websiteProjectDetail.client_drive_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className={`${borderColor} gap-2`}>
                            <ExternalLink className="h-4 w-4" /> Drive
                          </Button>
                        </a>
                      )}
                      <Button size="sm" className="bg-[#6366f1] hover:bg-[#4f46e5] gap-2" onClick={openEditProjectModal}>
                        <Edit2 className="h-4 w-4" /> Edit
                      </Button>
                    </div>
                  </div>
                  
                  {/* Progress Bar with count */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`flex-1 h-3 rounded-full ${isDark ? 'bg-[#3f3f46]' : 'bg-gray-200'}`}>
                      <div 
                        className="h-3 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]" 
                        style={{ width: `${websiteProjectDetail.overall_percent || 0}%` }} 
                      />
                    </div>
                    <span className={`text-sm font-semibold ${textPrimary}`}>
                      {(websiteProjectDetail.pages || []).filter(p => p.overall_status === 'Completed').length}/{websiteProjectDetail.total_pages || 0}
                    </span>
                  </div>
                  
                  {/* Dates Row */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className={`h-4 w-4 ${textSecondary}`} />
                      <span className={textSecondary}>Onboarding:</span>
                      <span className={textPrimary}>{formatDateDisplay(websiteProjectDetail.onboarding_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className={`h-4 w-4 ${textSecondary}`} />
                      <span className={textSecondary}>Deadline:</span>
                      <span className={websiteProjectDetail.deadline ? textPrimary : 'text-red-500'}>
                        {websiteProjectDetail.deadline ? formatDateDisplay(websiteProjectDetail.deadline) : 'Not Set'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Project Details Info Row */}
              <div className="grid grid-cols-6 gap-3">
                <div className={`p-3 rounded-lg ${bgCard} border ${borderColor}`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Domain</p>
                  {websiteProjectDetail.domain_url ? (
                    <a href={websiteProjectDetail.domain_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#6366f1] truncate block">
                      {websiteProjectDetail.domain_url.replace(/^https?:\/\//, '').split('/')[0]}
                    </a>
                  ) : (
                    <span className={`text-sm ${textSecondary}`}>-</span>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${bgCard} border ${borderColor}`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Developer</p>
                  <div className="flex items-center gap-2">
                    {websiteProjectDetail.developer ? (
                      <>
                        <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs font-medium">
                          {getUserInitials(websiteProjectDetail.developer)}
                        </div>
                        <span className={`text-sm ${textPrimary} truncate`}>{getUserName(websiteProjectDetail.developer)}</span>
                      </>
                    ) : (
                      <span className={`text-sm ${textSecondary}`}>-</span>
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${bgCard} border ${borderColor}`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Platform</p>
                  <p className={`text-sm ${textPrimary}`}>{websiteProjectDetail.platform || 'Website'}</p>
                </div>
                <div className={`p-3 rounded-lg ${bgCard} border ${borderColor}`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Type</p>
                  <p className={`text-sm ${textPrimary}`}>{websiteProjectDetail.website_type || 'Business'}</p>
                </div>
                <div className={`p-3 rounded-lg ${bgCard} border ${borderColor}`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Client</p>
                  <p className={`text-sm ${textPrimary}`}>{websiteProjectDetail.client_name || '-'}</p>
                </div>
                <div className={`p-3 rounded-lg ${bgCard} border ${borderColor}`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Location</p>
                  <p className={`text-sm ${textPrimary}`}>{websiteProjectDetail.location || '-'}</p>
                </div>
              </div>

              {/* Pages/Tasks Tabs */}
              <Card className={`${bgCard} border ${borderColor}`}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${borderColor}`}>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setWebsiteProjectTab('pages')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        websiteProjectTab === 'pages' 
                          ? 'bg-[#6366f1] text-white' 
                          : `${textSecondary} hover:${bgSecondary}`
                      }`}
                    >
                      Pages
                    </button>
                    <button
                      onClick={() => setWebsiteProjectTab('tasks')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        websiteProjectTab === 'tasks' 
                          ? 'bg-[#6366f1] text-white' 
                          : `${textSecondary} hover:${bgSecondary}`
                      }`}
                    >
                      Tasks
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
                      <Input
                        placeholder="Search pages..."
                        value={websitePageSearch}
                        onChange={(e) => setWebsitePageSearch(e.target.value)}
                        className={`pl-9 h-9 w-64 ${bgSecondary} ${borderColor}`}
                      />
                    </div>
                    <Button size="sm" className="bg-[#6366f1] hover:bg-[#4f46e5] gap-2" onClick={() => setShowWebsitePageModal(true)}>
                      <Plus className="h-4 w-4" /> Add Page
                    </Button>
                  </div>
                </div>

                {/* Pages Table - Enhanced with per-column controls */}
                {websiteProjectTab === 'pages' && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1200px]">
                      <thead className={bgSecondary}>
                        <tr>
                          <th className={`px-3 py-3 text-left text-xs font-semibold ${textSecondary} uppercase w-12`}>#</th>
                          <th className={`px-3 py-3 text-left text-xs font-semibold ${textSecondary} uppercase w-36`}>Page Name</th>
                          <th className={`px-3 py-3 text-left text-xs font-semibold ${textSecondary} uppercase`}>
                            <div>Wireframe</div>
                            <div className={`text-[10px] font-normal ${textSecondary} opacity-70`}>Status / Assignee / Due</div>
                          </th>
                          <th className={`px-3 py-3 text-left text-xs font-semibold ${textSecondary} uppercase`}>
                            <div>UI Design</div>
                            <div className={`text-[10px] font-normal ${textSecondary} opacity-70`}>Status / Assignee / Due</div>
                          </th>
                          <th className={`px-3 py-3 text-left text-xs font-semibold ${textSecondary} uppercase`}>
                            <div>Content</div>
                            <div className={`text-[10px] font-normal ${textSecondary} opacity-70`}>Status / Assignee / Due</div>
                          </th>
                          <th className={`px-3 py-3 text-left text-xs font-semibold ${textSecondary} uppercase`}>
                            <div>Development</div>
                            <div className={`text-[10px] font-normal ${textSecondary} opacity-70`}>Status / Assignee / Due</div>
                          </th>
                          <th className={`px-3 py-3 text-left text-xs font-semibold ${textSecondary} uppercase`}>
                            <div>Overall</div>
                            <div className={`text-[10px] font-normal ${textSecondary} opacity-70`}>Status / URL</div>
                          </th>
                          <th className={`px-3 py-3 text-center text-xs font-semibold ${textSecondary} uppercase w-16`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-200'}`}>
                        {(websiteProjectDetail.pages || []).filter(p => 
                          !websitePageSearch || p.page_name.toLowerCase().includes(websitePageSearch.toLowerCase())
                        ).length === 0 ? (
                          <tr>
                            <td colSpan={8} className={`px-4 py-12 text-center ${textSecondary}`}>
                              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                              <p className="text-base">No pages yet</p>
                              <p className="text-sm opacity-70">Click "Add Page" to add your first page</p>
                            </td>
                          </tr>
                        ) : (websiteProjectDetail.pages || []).filter(p => 
                          !websitePageSearch || p.page_name.toLowerCase().includes(websitePageSearch.toLowerCase())
                        ).map((page, idx) => (
                          <tr key={page.task_id} className={`hover:${isDark ? 'bg-[#27272a]/50' : 'bg-gray-50'}`}>
                            {/* S.No */}
                            <td className={`px-3 py-3 ${textSecondary} text-sm`}>{page.sno || idx + 1}</td>
                            
                            {/* Page Name */}
                            <td className={`px-3 py-3`}>
                              <span className={`font-medium ${textPrimary} text-sm`}>{page.page_name}</span>
                            </td>
                            
                            {/* Wireframe Column */}
                            <td className="px-3 py-2">
                              <div className="space-y-1.5">
                                <Select value={page.wireframe_status || 'To-Do'} onValueChange={(v) => handleUpdateWebsitePage(page.task_id, { wireframe_status: v })}>
                                  <SelectTrigger className={`h-7 w-28 text-xs ${WEBSITE_STATUS_COLORS[page.wireframe_status || 'To-Do']} border-0`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {WEBSITE_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1.5">
                                  <Select value={page.wireframe_assignee || 'unassigned'} onValueChange={(v) => handleUpdateWebsitePage(page.task_id, { wireframe_assignee: v === 'unassigned' ? null : v })}>
                                    <SelectTrigger className={`h-7 w-7 p-0 ${bgSecondary} border-0 rounded-full`}>
                                      {page.wireframe_assignee ? (
                                        <div className="w-6 h-6 rounded-full bg-[#8b5cf6] flex items-center justify-center text-white text-[10px] font-medium">
                                          {getUserInitials(page.wireframe_assignee)}
                                        </div>
                                      ) : (
                                        <User className={`h-3.5 w-3.5 ${textSecondary}`} />
                                      )}
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">Unassigned</SelectItem>
                                      {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="date"
                                    value={formatDateForInput(page.wireframe_due)}
                                    onChange={(e) => handleUpdateWebsitePage(page.task_id, { wireframe_due: e.target.value })}
                                    className={`h-7 w-28 text-xs ${bgSecondary} border-0 px-2`}
                                  />
                                </div>
                                {page.wireframe_url ? (
                                  <a href={page.wireframe_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#6366f1] truncate block max-w-[120px]">
                                    View URL
                                  </a>
                                ) : (
                                  <button 
                                    onClick={() => { setShowUrlModal({ taskId: page.task_id, field: 'wireframe_url' }); setUrlInput(''); }}
                                    className="text-[10px] text-[#3b82f6] hover:underline"
                                  >
                                    + Add URL
                                  </button>
                                )}
                              </div>
                            </td>
                            
                            {/* UI Design Column */}
                            <td className="px-3 py-2">
                              <div className="space-y-1.5">
                                <Select value={page.ui_status || 'To-Do'} onValueChange={(v) => handleUpdateWebsitePage(page.task_id, { ui_status: v })}>
                                  <SelectTrigger className={`h-7 w-28 text-xs ${WEBSITE_STATUS_COLORS[page.ui_status || 'To-Do']} border-0`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {WEBSITE_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1.5">
                                  <Select value={page.ui_assignee || 'unassigned'} onValueChange={(v) => handleUpdateWebsitePage(page.task_id, { ui_assignee: v === 'unassigned' ? null : v })}>
                                    <SelectTrigger className={`h-7 w-7 p-0 ${bgSecondary} border-0 rounded-full`}>
                                      {page.ui_assignee ? (
                                        <div className="w-6 h-6 rounded-full bg-[#ec4899] flex items-center justify-center text-white text-[10px] font-medium">
                                          {getUserInitials(page.ui_assignee)}
                                        </div>
                                      ) : (
                                        <User className={`h-3.5 w-3.5 ${textSecondary}`} />
                                      )}
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">Unassigned</SelectItem>
                                      {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="date"
                                    value={formatDateForInput(page.ui_due)}
                                    onChange={(e) => handleUpdateWebsitePage(page.task_id, { ui_due: e.target.value })}
                                    className={`h-7 w-28 text-xs ${bgSecondary} border-0 px-2`}
                                  />
                                </div>
                                {page.ui_url ? (
                                  <a href={page.ui_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#6366f1] truncate block max-w-[120px]">
                                    View URL
                                  </a>
                                ) : (
                                  <button 
                                    onClick={() => { setShowUrlModal({ taskId: page.task_id, field: 'ui_url' }); setUrlInput(''); }}
                                    className="text-[10px] text-[#3b82f6] hover:underline"
                                  >
                                    + Add URL
                                  </button>
                                )}
                              </div>
                            </td>
                            
                            {/* Content Column */}
                            <td className="px-3 py-2">
                              <div className="space-y-1.5">
                                <Select value={page.content_status || 'To-Do'} onValueChange={(v) => handleUpdateWebsitePage(page.task_id, { content_status: v })}>
                                  <SelectTrigger className={`h-7 w-28 text-xs ${WEBSITE_STATUS_COLORS[page.content_status || 'To-Do']} border-0`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {WEBSITE_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1.5">
                                  <Select value={page.content_assignee || 'unassigned'} onValueChange={(v) => handleUpdateWebsitePage(page.task_id, { content_assignee: v === 'unassigned' ? null : v })}>
                                    <SelectTrigger className={`h-7 w-7 p-0 ${bgSecondary} border-0 rounded-full`}>
                                      {page.content_assignee ? (
                                        <div className="w-6 h-6 rounded-full bg-[#f59e0b] flex items-center justify-center text-white text-[10px] font-medium">
                                          {getUserInitials(page.content_assignee)}
                                        </div>
                                      ) : (
                                        <User className={`h-3.5 w-3.5 ${textSecondary}`} />
                                      )}
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">Unassigned</SelectItem>
                                      {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="date"
                                    value={formatDateForInput(page.content_due)}
                                    onChange={(e) => handleUpdateWebsitePage(page.task_id, { content_due: e.target.value })}
                                    className={`h-7 w-28 text-xs ${bgSecondary} border-0 px-2`}
                                  />
                                </div>
                                {page.content_url ? (
                                  <a href={page.content_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#6366f1] truncate block max-w-[120px]">
                                    View URL
                                  </a>
                                ) : (
                                  <button 
                                    onClick={() => { setShowUrlModal({ taskId: page.task_id, field: 'content_url' }); setUrlInput(''); }}
                                    className="text-[10px] text-[#3b82f6] hover:underline"
                                  >
                                    + Add URL
                                  </button>
                                )}
                              </div>
                            </td>
                            
                            {/* Development Column */}
                            <td className="px-3 py-2">
                              <div className="space-y-1.5">
                                <Select value={page.dev_status || 'To-Do'} onValueChange={(v) => handleUpdateWebsitePage(page.task_id, { dev_status: v })}>
                                  <SelectTrigger className={`h-7 w-28 text-xs ${WEBSITE_STATUS_COLORS[page.dev_status || 'To-Do']} border-0`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {WEBSITE_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1.5">
                                  <Select value={page.dev_assignee || 'unassigned'} onValueChange={(v) => handleUpdateWebsitePage(page.task_id, { dev_assignee: v === 'unassigned' ? null : v })}>
                                    <SelectTrigger className={`h-7 w-7 p-0 ${bgSecondary} border-0 rounded-full`}>
                                      {page.dev_assignee ? (
                                        <div className="w-6 h-6 rounded-full bg-[#10b981] flex items-center justify-center text-white text-[10px] font-medium">
                                          {getUserInitials(page.dev_assignee)}
                                        </div>
                                      ) : (
                                        <User className={`h-3.5 w-3.5 ${textSecondary}`} />
                                      )}
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">Unassigned</SelectItem>
                                      {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="date"
                                    value={formatDateForInput(page.dev_due)}
                                    onChange={(e) => handleUpdateWebsitePage(page.task_id, { dev_due: e.target.value })}
                                    className={`h-7 w-28 text-xs ${bgSecondary} border-0 px-2`}
                                  />
                                </div>
                                {page.dev_url ? (
                                  <a href={page.dev_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#6366f1] truncate block max-w-[120px]">
                                    View URL
                                  </a>
                                ) : (
                                  <button 
                                    onClick={() => { setShowUrlModal({ taskId: page.task_id, field: 'dev_url' }); setUrlInput(''); }}
                                    className="text-[10px] text-[#3b82f6] hover:underline"
                                  >
                                    + Add URL
                                  </button>
                                )}
                              </div>
                            </td>
                            
                            {/* Overall Column */}
                            <td className="px-3 py-2">
                              <div className="space-y-1.5">
                                <Select value={page.overall_status || 'To-Do'} onValueChange={(v) => handleUpdateWebsitePage(page.task_id, { overall_status: v })}>
                                  <SelectTrigger className={`h-7 w-28 text-xs ${WEBSITE_STATUS_COLORS[page.overall_status || 'To-Do']} border-0 font-medium`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {WEBSITE_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                {page.overall_url ? (
                                  <a href={page.overall_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#6366f1] truncate block max-w-[120px]">
                                    View URL
                                  </a>
                                ) : (
                                  <button 
                                    onClick={() => { setShowUrlModal({ taskId: page.task_id, field: 'overall_url' }); setUrlInput(''); }}
                                    className="text-[10px] text-[#3b82f6] hover:underline"
                                  >
                                    + Add URL
                                  </button>
                                )}
                              </div>
                            </td>
                            
                            {/* Actions */}
                            <td className="px-3 py-2 text-center">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8 p-0" 
                                onClick={() => handleDeleteWebsitePage(page.task_id)}
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

                {/* Tasks Tab - Placeholder for future */}
                {websiteProjectTab === 'tasks' && (
                  <div className={`p-8 text-center ${textSecondary}`}>
                    <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p className="text-base">Project Tasks</p>
                    <p className="text-sm opacity-70">Task management for this project (Coming Soon)</p>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>

        {/* URL Add Modal */}
        {showUrlModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-semibold ${textPrimary}`}>Add URL</h3>
                <button onClick={() => setShowUrlModal(null)} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4">
                <Label className={textPrimary}>URL</Label>
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  className={`mt-2 ${bgSecondary} ${borderColor}`}
                />
              </div>
              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => setShowUrlModal(null)}>Cancel</Button>
                <Button onClick={() => handleAddUrl(showUrlModal.taskId, showUrlModal.field)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                  Save URL
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Edit Website Project Modal */}
        {showEditWebsiteProjectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-lg ${bgCard} border ${borderColor}`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-semibold ${textPrimary} flex items-center gap-2`}>
                  <Globe className="h-5 w-5 text-[#22c55e]" />
                  Edit Website Project
                </h3>
                <button onClick={() => setShowEditWebsiteProjectModal(false)} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <Label className={textPrimary}>Project Name *</Label>
                  <Input value={websiteProjectForm.name} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, name: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Client Name</Label>
                    <Input value={websiteProjectForm.client_name} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, client_name: e.target.value })} placeholder="Client/Company" className={`${bgSecondary} ${borderColor}`} />
                  </div>
                  <div>
                    <Label className={textPrimary}>Location</Label>
                    <Input value={websiteProjectForm.location} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, location: e.target.value })} placeholder="City, Country" className={`${bgSecondary} ${borderColor}`} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Website Type</Label>
                    <Select value={websiteProjectForm.website_type} onValueChange={(v) => setWebsiteProjectForm({ ...websiteProjectForm, website_type: v })}>
                      <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Business Website">Business Website</SelectItem>
                        <SelectItem value="E-commerce">E-commerce</SelectItem>
                        <SelectItem value="Portfolio">Portfolio</SelectItem>
                        <SelectItem value="Landing Page">Landing Page</SelectItem>
                        <SelectItem value="Blog">Blog</SelectItem>
                        <SelectItem value="Web App">Web App</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={textPrimary}>Status</Label>
                    <Select value={websiteProjectForm.status} onValueChange={(v) => setWebsiteProjectForm({ ...websiteProjectForm, status: v })}>
                      <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on-hold">On Hold</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Onboarding Date</Label>
                    <Input type="date" value={formatDateForInput(websiteProjectForm.onboarding_date)} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, onboarding_date: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                  </div>
                  <div>
                    <Label className={textPrimary}>Deadline</Label>
                    <Input type="date" value={formatDateForInput(websiteProjectForm.deadline)} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, deadline: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                  </div>
                </div>
                <div>
                  <Label className={textPrimary}>Developer</Label>
                  <Select value={websiteProjectForm.developer || 'none'} onValueChange={(v) => setWebsiteProjectForm({ ...websiteProjectForm, developer: v === 'none' ? '' : v })}>
                    <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue placeholder="Select developer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>Domain URL</Label>
                  <Input value={websiteProjectForm.domain_url} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, domain_url: e.target.value })} placeholder="https://example.com" className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Docs Link</Label>
                    <Input value={websiteProjectForm.documents_url} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, documents_url: e.target.value })} placeholder="Google Docs link" className={`${bgSecondary} ${borderColor}`} />
                  </div>
                  <div>
                    <Label className={textPrimary}>Drive Link</Label>
                    <Input value={websiteProjectForm.client_drive_url} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, client_drive_url: e.target.value })} placeholder="Google Drive link" className={`${bgSecondary} ${borderColor}`} />
                  </div>
                </div>
              </div>
              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => setShowEditWebsiteProjectModal(false)}>Cancel</Button>
                <Button onClick={handleEditWebsiteProject} className="bg-[#22c55e] hover:bg-[#16a34a]">Save Changes</Button>
              </div>
            </Card>
          </div>
        )}

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

        {/* Website Project Modal */}
        {showWebsiteProjectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-lg ${bgCard} border ${borderColor}`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-semibold ${textPrimary} flex items-center gap-2`}>
                  <Globe className="h-5 w-5 text-[#22c55e]" />
                  New Website Project
                </h3>
                <button onClick={() => setShowWebsiteProjectModal(false)} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <Label className={textPrimary}>Project Name *</Label>
                  <Input value={websiteProjectForm.name} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, name: e.target.value })} placeholder="e.g., Acme Corp Website" className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Client Name</Label>
                    <Input value={websiteProjectForm.client_name} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, client_name: e.target.value })} placeholder="Client/Company name" className={`${bgSecondary} ${borderColor}`} />
                  </div>
                  <div>
                    <Label className={textPrimary}>Location</Label>
                    <Input value={websiteProjectForm.location} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, location: e.target.value })} placeholder="City, Country" className={`${bgSecondary} ${borderColor}`} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Website Type</Label>
                    <Select value={websiteProjectForm.website_type} onValueChange={(v) => setWebsiteProjectForm({ ...websiteProjectForm, website_type: v })}>
                      <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Business Website">Business Website</SelectItem>
                        <SelectItem value="E-commerce">E-commerce</SelectItem>
                        <SelectItem value="Portfolio">Portfolio</SelectItem>
                        <SelectItem value="Landing Page">Landing Page</SelectItem>
                        <SelectItem value="Blog">Blog</SelectItem>
                        <SelectItem value="Web App">Web App</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={textPrimary}>Status</Label>
                    <Select value={websiteProjectForm.status} onValueChange={(v) => setWebsiteProjectForm({ ...websiteProjectForm, status: v })}>
                      <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on-hold">On Hold</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Onboarding Date</Label>
                    <Input type="date" value={websiteProjectForm.onboarding_date} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, onboarding_date: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                  </div>
                  <div>
                    <Label className={textPrimary}>Deadline</Label>
                    <Input type="date" value={websiteProjectForm.deadline} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, deadline: e.target.value })} className={`${bgSecondary} ${borderColor}`} />
                  </div>
                </div>
                <div>
                  <Label className={textPrimary}>Developer</Label>
                  <Select value={websiteProjectForm.developer || 'none'} onValueChange={(v) => setWebsiteProjectForm({ ...websiteProjectForm, developer: v === 'none' ? '' : v })}>
                    <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue placeholder="Select developer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>Domain URL</Label>
                  <Input value={websiteProjectForm.domain_url} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, domain_url: e.target.value })} placeholder="https://example.com" className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Docs Link</Label>
                    <Input value={websiteProjectForm.documents_url} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, documents_url: e.target.value })} placeholder="Google Docs link" className={`${bgSecondary} ${borderColor}`} />
                  </div>
                  <div>
                    <Label className={textPrimary}>Drive Link</Label>
                    <Input value={websiteProjectForm.client_drive_url} onChange={(e) => setWebsiteProjectForm({ ...websiteProjectForm, client_drive_url: e.target.value })} placeholder="Google Drive link" className={`${bgSecondary} ${borderColor}`} />
                  </div>
                </div>
              </div>
              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => setShowWebsiteProjectModal(false)}>Cancel</Button>
                <Button onClick={handleCreateWebsiteProject} className="bg-[#22c55e] hover:bg-[#16a34a]">Create Project</Button>
              </div>
            </Card>
          </div>
        )}

        {/* Website Page Modal */}
        {showWebsitePageModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
                <h3 className={`font-semibold ${textPrimary}`}>Add Page</h3>
                <button onClick={() => setShowWebsitePageModal(false)} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <Label className={textPrimary}>Page Name *</Label>
                  <Input value={websitePageForm.page_name} onChange={(e) => setWebsitePageForm({ ...websitePageForm, page_name: e.target.value })} placeholder="e.g., About Us" className={`${bgSecondary} ${borderColor}`} />
                </div>
                <div>
                  <Label className={textPrimary}>Assign To</Label>
                  <Select value={websitePageForm.assigned_to} onValueChange={(v) => setWebsitePageForm({ ...websitePageForm, assigned_to: v })}>
                    <SelectTrigger className={`${bgSecondary} ${borderColor}`}><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>Notes</Label>
                  <Textarea value={websitePageForm.notes} onChange={(e) => setWebsitePageForm({ ...websitePageForm, notes: e.target.value })} placeholder="Any notes..." className={`${bgSecondary} ${borderColor}`} />
                </div>
              </div>
              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => setShowWebsitePageModal(false)}>Cancel</Button>
                <Button onClick={handleAddWebsitePage} className="bg-[#6366f1] hover:bg-[#4f46e5]">Add Page</Button>
              </div>
            </Card>
          </div>
        )}

        {/* My Task Creation Modal */}
        {showMyTaskModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className={`w-full max-w-2xl ${bgCard} border ${borderColor} max-h-[90vh] overflow-y-auto`}>
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between sticky top-0 ${bgCard} z-10`}>
                <h3 className={`font-semibold ${textPrimary}`}>
                  {myTaskForm.type === 'meeting' ? 'Schedule Meeting' : myTaskForm.type === 'approval' ? 'Request Approval' : 'Create Task'}
                </h3>
                <button onClick={() => { setShowMyTaskModal(false); resetMyTaskForm(); }} className={textSecondary}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Task Type Selector */}
                <div>
                  <Label className={textPrimary}>Type *</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { id: 'task', label: 'Task', icon: CheckCircle2, color: '#10b981' },
                      { id: 'meeting', label: 'Meeting', icon: Video, color: '#6366f1' },
                      { id: 'approval', label: 'Approval', icon: ClipboardCheck, color: '#f59e0b' }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setMyTaskForm({ ...myTaskForm, type: type.id })}
                        className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-all ${
                          myTaskForm.type === type.id
                            ? `border-[${type.color}] bg-[${type.color}]/10`
                            : `${borderColor} hover:border-[#6366f1]/50`
                        }`}
                        data-testid={`task-type-${type.id}`}
                      >
                        <type.icon className={`h-5 w-5`} style={{ color: type.color }} />
                        <span className={textPrimary}>{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Basic Fields */}
                <div>
                  <Label className={textPrimary}>
                    {myTaskForm.type === 'meeting' ? 'Meeting Title' : myTaskForm.type === 'approval' ? 'Approval Title' : 'Task Name'} *
                  </Label>
                  <Input
                    value={myTaskForm.task_name}
                    onChange={(e) => setMyTaskForm({ ...myTaskForm, task_name: e.target.value })}
                    placeholder={myTaskForm.type === 'meeting' ? 'e.g., Client Review Meeting' : 'Enter title...'}
                    className={`${bgSecondary} ${borderColor}`}
                  />
                </div>

                <div>
                  <Label className={textPrimary}>Description</Label>
                  <Textarea
                    value={myTaskForm.description}
                    onChange={(e) => setMyTaskForm({ ...myTaskForm, description: e.target.value })}
                    placeholder="Add details..."
                    rows={3}
                    className={`${bgSecondary} ${borderColor}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Due Date</Label>
                    <Input
                      type="date"
                      value={myTaskForm.due_date}
                      onChange={(e) => setMyTaskForm({ ...myTaskForm, due_date: e.target.value })}
                      className={`${bgSecondary} ${borderColor}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Time</Label>
                    <Input
                      type="time"
                      value={myTaskForm.due_time}
                      onChange={(e) => setMyTaskForm({ ...myTaskForm, due_time: e.target.value })}
                      className={`${bgSecondary} ${borderColor}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Priority</Label>
                    <Select value={myTaskForm.priority} onValueChange={(v) => setMyTaskForm({ ...myTaskForm, priority: v })}>
                      <SelectTrigger className={`${bgSecondary} ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={textPrimary}>Assign To</Label>
                    <Select value={myTaskForm.assigned_to} onValueChange={(v) => setMyTaskForm({ ...myTaskForm, assigned_to: v })}>
                      <SelectTrigger className={`${bgSecondary} ${borderColor}`}>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        {users.map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Department & Status Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Department</Label>
                    <Select value={myTaskForm.department || ''} onValueChange={(v) => setMyTaskForm({ ...myTaskForm, department: v })}>
                      <SelectTrigger className={`${bgSecondary} ${borderColor}`}>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="hr">HR</SelectItem>
                        <SelectItem value="seo">SEO</SelectItem>
                        <SelectItem value="social_media">Social Media</SelectItem>
                        <SelectItem value="bde">Business Development</SelectItem>
                        <SelectItem value="operations">Operations</SelectItem>
                        <SelectItem value="meta">Meta</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="erp">ERP</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={textPrimary}>Status</Label>
                    <Select value={myTaskForm.status} onValueChange={(v) => setMyTaskForm({ ...myTaskForm, status: v })}>
                      <SelectTrigger className={`${bgSecondary} ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Meeting Specific Fields */}
                {myTaskForm.type === 'meeting' && (
                  <div className={`p-4 rounded-lg ${bgSecondary} space-y-4`}>
                    <h4 className={`font-medium ${textPrimary} flex items-center gap-2`}>
                      <Video className="h-4 w-4 text-[#6366f1]" />
                      Meeting Details
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className={textSecondary}>Meeting Type</Label>
                        <Select value={myTaskForm.meeting_type} onValueChange={(v) => setMyTaskForm({ ...myTaskForm, meeting_type: v })}>
                          <SelectTrigger className={`${bgCard} ${borderColor}`}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className={bgCard}>
                            <SelectItem value="operations">Operations Meeting</SelectItem>
                            <SelectItem value="client">Client Meeting</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className={textSecondary}>Mode</Label>
                        <Select value={myTaskForm.meeting_mode} onValueChange={(v) => setMyTaskForm({ ...myTaskForm, meeting_mode: v })}>
                          <SelectTrigger className={`${bgCard} ${borderColor}`}>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent className={bgCard}>
                            <SelectItem value="office">Office</SelectItem>
                            <SelectItem value="team">Team</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                            <SelectItem value="department">Department</SelectItem>
                            <SelectItem value="personal">Personal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className={textSecondary}>Format</Label>
                      <div className="flex gap-4 mt-2">
                        <label className={`flex items-center gap-2 cursor-pointer ${textPrimary}`}>
                          <input
                            type="radio"
                            checked={myTaskForm.meeting_format === 'online'}
                            onChange={() => setMyTaskForm({ ...myTaskForm, meeting_format: 'online', meeting_location: '' })}
                            className="accent-[#6366f1]"
                          />
                          <Video className="h-4 w-4" />
                          Online
                        </label>
                        <label className={`flex items-center gap-2 cursor-pointer ${textPrimary}`}>
                          <input
                            type="radio"
                            checked={myTaskForm.meeting_format === 'offline'}
                            onChange={() => setMyTaskForm({ ...myTaskForm, meeting_format: 'offline' })}
                            className="accent-[#6366f1]"
                          />
                          <MapPin className="h-4 w-4" />
                          Offline
                        </label>
                      </div>
                    </div>

                    {myTaskForm.meeting_format === 'online' ? (
                      <div>
                        <Label className={textSecondary}>Meeting Link</Label>
                        <Input
                          value={myTaskForm.meeting_link}
                          onChange={(e) => setMyTaskForm({ ...myTaskForm, meeting_link: e.target.value })}
                          placeholder="https://meet.google.com/..."
                          className={`${bgCard} ${borderColor}`}
                        />
                      </div>
                    ) : (
                      <div>
                        <Label className={textSecondary}>Location</Label>
                        <Input
                          value={myTaskForm.meeting_location}
                          onChange={(e) => setMyTaskForm({ ...myTaskForm, meeting_location: e.target.value })}
                          placeholder="e.g., Conference Room A, Office Floor 2"
                          className={`${bgCard} ${borderColor}`}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Approval Specific Fields */}
                {myTaskForm.type === 'approval' && (
                  <div className={`p-4 rounded-lg ${bgSecondary} space-y-4`}>
                    <h4 className={`font-medium ${textPrimary} flex items-center gap-2`}>
                      <ClipboardCheck className="h-4 w-4 text-[#f59e0b]" />
                      Approval Details
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className={textSecondary}>Approval Type</Label>
                        <Select value={myTaskForm.approval_type} onValueChange={(v) => setMyTaskForm({ ...myTaskForm, approval_type: v })}>
                          <SelectTrigger className={`${bgCard} ${borderColor}`}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className={bgCard}>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="approval">Approval</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className={textSecondary}>Request Approval From</Label>
                        <Select value={myTaskForm.approval_for} onValueChange={(v) => setMyTaskForm({ ...myTaskForm, approval_for: v })}>
                          <SelectTrigger className={`${bgCard} ${borderColor}`}>
                            <SelectValue placeholder="Select approver" />
                          </SelectTrigger>
                          <SelectContent className={bgCard}>
                            {users.map(u => (
                              <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => { setShowMyTaskModal(false); resetMyTaskForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateMyTask} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                  {myTaskForm.type === 'meeting' ? 'Schedule Meeting' : myTaskForm.type === 'approval' ? 'Request Approval' : 'Create Task'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Approval Review Modal */}
        {showApprovalModal && selectedApproval && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className={`${bgCard} border ${borderColor} w-full max-w-lg`}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                  {selectedApproval.action === 'reject' ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-[#10b981]" />
                  )}
                  {selectedApproval.action === 'reject' ? 'Reject' : 'Review & Approve'}: {selectedApproval.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Approval Summary */}
                <div className={`p-4 rounded-lg ${bgSecondary}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-[#6366f1] border-[#6366f1]">{selectedApproval.department}</Badge>
                    <Badge variant="outline">{selectedApproval.type}</Badge>
                  </div>
                  <p className={textSecondary}>{selectedApproval.description}</p>
                  
                  {selectedApproval.type === 'salary' && selectedApproval.data && (
                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <div>
                        <p className={textSecondary}>Employee</p>
                        <p className={`font-medium ${textPrimary}`}>{selectedApproval.data.employee_name}</p>
                      </div>
                      <div>
                        <p className={textSecondary}>Net Salary</p>
                        <p className="font-medium text-[#10b981]">₹{selectedApproval.data.net_salary?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className={textSecondary}>Days Present</p>
                        <p className={`font-medium ${textPrimary}`}>{selectedApproval.data.attendance?.days_present || 0}</p>
                      </div>
                      <div>
                        <p className={textSecondary}>Operations Review</p>
                        <p className={`font-medium ${textPrimary}`}>{selectedApproval.data.operations_review?.remarks || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Remarks Input */}
                <div>
                  <Label className={textPrimary}>
                    {selectedApproval.action === 'reject' ? 'Rejection Reason' : 'Approval Remarks'}
                  </Label>
                  <textarea
                    value={approvalRemarks}
                    onChange={(e) => setApprovalRemarks(e.target.value)}
                    placeholder={selectedApproval.action === 'reject' 
                      ? 'Please provide a reason for rejection...' 
                      : 'Add any remarks or comments...'}
                    rows={3}
                    className={`w-full mt-1 px-3 py-2 rounded-md ${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                </div>
              </CardContent>
              <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
                <Button variant="outline" onClick={() => { setShowApprovalModal(false); setSelectedApproval(null); setApprovalRemarks(''); }}>
                  Cancel
                </Button>
                {selectedApproval.action === 'reject' ? (
                  <Button
                    onClick={() => handleApprovalAction(selectedApproval, 'reject', approvalRemarks)}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    Reject
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleApprovalAction(selectedApproval, 'resend', approvalRemarks)}
                      className="text-[#f59e0b] border-[#f59e0b]"
                    >
                      Resend for Review
                    </Button>
                    <Button
                      onClick={() => handleApprovalAction(selectedApproval, 'approve', approvalRemarks)}
                      className="bg-[#10b981] hover:bg-[#059669] text-white"
                    >
                      Approve
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
