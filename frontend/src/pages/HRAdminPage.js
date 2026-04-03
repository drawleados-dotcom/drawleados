import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { 
  Users, Clock, Calendar, CheckCircle, XCircle, 
  Home, Building, Edit, Edit2, Search, UserPlus, X, Trash2,
  AlertCircle, TrendingUp, Eye, EyeOff, FileText, Plus, User,
  Briefcase, CreditCard, FolderOpen, Shield, Mail, Key, Link, ExternalLink,
  Send, AlertTriangle, RefreshCcw, Settings, Globe, Star, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import PayrollManagementTab from '../components/hr/PayrollManagementTab';

const API = process.env.REACT_APP_BACKEND_URL;

// Role options with colors
const ROLES = [
  { value: 'super_admin', label: 'Super Admin', color: '#ef4444' },
  { value: 'admin', label: 'Admin', color: '#f59e0b' },
  { value: 'project_manager', label: 'Project Manager', color: '#8b5cf6' },
  { value: 'hr_manager', label: 'HR Manager', color: '#ec4899' },
  { value: 'business_development', label: 'Business Development', color: '#3b82f6' },
  { value: 'website_developer', label: 'Website Developer', color: '#22c55e' },
  { value: 'seo_specialist', label: 'SEO Specialist', color: '#f59e0b' },
  { value: 'content_writer', label: 'Content Writer', color: '#6366f1' },
  { value: 'graphic_designer', label: 'Graphic Designer', color: '#ec4899' },
  { value: 'social_media', label: 'Social Media', color: '#14b8a6' },
  { value: 'finance', label: 'Finance', color: '#22c55e' },
  { value: 'operations', label: 'Operations', color: '#8b5cf6' },
  { value: 'employee', label: 'Employee', color: '#71717a' },
];

// Module access options
const MODULES = [
  // Core Modules
  { value: 'calendar', label: 'Calendar', icon: Calendar },
  { value: 'my_tasks', label: 'My Tasks', icon: ClipboardList },
  { value: 'our_tasks', label: 'Our Tasks', icon: ClipboardList },
  { value: 'my_profile', label: 'My Profile', icon: User },
  
  // Sales
  { value: 'sales', label: 'Sales', icon: Users },
  { value: 'leads', label: 'Leads', icon: Users },
  { value: 'bde_tasks', label: 'BDE Tasks', icon: Briefcase },
  
  // Operations
  { value: 'operations', label: 'Operations', icon: Briefcase },
  { value: 'tasks', label: 'Tasks', icon: Briefcase },
  { value: 'website_projects', label: 'Website Projects', icon: Globe },
  { value: 'seo_works', label: 'SEO Works', icon: Globe },
  { value: 'social_media', label: 'Social Media', icon: Globe },
  { value: 'creative_board', label: 'Creative Board', icon: FileText },
  { value: 'meta_ads', label: 'Meta Ads', icon: Globe },
  
  // Admin Modules
  { value: 'hr', label: 'HR', icon: Users },
  { value: 'hr_admin', label: 'HR Admin', icon: Shield },
  { value: 'finance', label: 'Finance', icon: CreditCard },
  { value: 'settings', label: 'Settings', icon: Settings },
  { value: 'documentations', label: 'Documentations', icon: FileText },
  
  // Reports
  { value: 'reports', label: 'Reports', icon: FileText },
];

export default function HRAdminPage() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('attendance');
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  
  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const bgInput = isDark ? 'bg-[#09090b]' : 'bg-white';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  
  // Dashboard stats
  const [stats, setStats] = useState({});
  
  // Employees state
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Leave requests state
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveFilter, setLeaveFilter] = useState('pending');
  
  // Attendance state
  const [attendanceOverview, setAttendanceOverview] = useState([]);
  
  // Pending approvals state
  const [pendingApprovals, setPendingApprovals] = useState({ attendance: [], permissions: [], leaves: [] });
  
  // WFH/Remote requests state
  const [wfhRequests, setWfhRequests] = useState([]);
  const [wfhFilter, setWfhFilter] = useState('pending');
  
  // All attendance state
  const [allAttendance, setAllAttendance] = useState([]);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth() + 1);
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());
  
  // Calendar/Holidays state
  const [calendar, setCalendar] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  
  // Quotes state
  const [quotes, setQuotes] = useState([]);
  const [showAddQuoteModal, setShowAddQuoteModal] = useState(false);
  const [newQuoteText, setNewQuoteText] = useState('');
  const [editingQuote, setEditingQuote] = useState(null);
  
  // Payslips state
  const [payslips, setPayslips] = useState([]);
  const [payslipMonth, setPayslipMonth] = useState(new Date().getMonth() + 1);
  const [payslipYear, setPayslipYear] = useState(new Date().getFullYear());
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslipEmployee, setSelectedPayslipEmployee] = useState(null);
  
  // HR Settings state
  const [hrSettings, setHrSettings] = useState(null);
  
  // Designations and Departments state
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showDesignationModal, setShowDesignationModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [newDesignation, setNewDesignation] = useState({ title: '', description: '', roles_responsibilities: '', reporting_to: [], module_access: [] });
  const [newDepartment, setNewDepartment] = useState({ name: '', description: '' });
  const [editingDesignation, setEditingDesignation] = useState(null);

  // Payroll Management state
  const [payrollEmployees, setPayrollEmployees] = useState([]);
  const [selectedPayrollEmployee, setSelectedPayrollEmployee] = useState(null);
  const [showAddSalaryModal, setShowAddSalaryModal] = useState(false);
  const [newSalaryRecord, setNewSalaryRecord] = useState({
    user_id: '',
    amount: '',
    effective_from: '',
    reason: 'initial',
    notes: ''
  });
  const [hikeReasons, setHikeReasons] = useState([]);
  const [employeeSalaryHistory, setEmployeeSalaryHistory] = useState([]);
  const [payrollSearchQuery, setPayrollSearchQuery] = useState('');
  
  // Payslip workflow state (extends existing payslips state)
  const [companySettings, setCompanySettings] = useState({});

  // Reviews state
  const [reviewTab, setReviewTab] = useState('monthly'); // monthly, quarterly, yearly
  const [reviewPeriod, setReviewPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reviewEmployees, setReviewEmployees] = useState([]);
  const [selectedReviewEmployee, setSelectedReviewEmployee] = useState(null);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewTasks, setReviewTasks] = useState([]);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [reviewerTab, setReviewerTab] = useState('hr'); // hr, operations, ceo
  const [existingReviews, setExistingReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ rating: 0, review_text: '' });
  const [editingReview, setEditingReview] = useState(null);
  const [showTasksPopup, setShowTasksPopup] = useState(false);
  const [taskFilter, setTaskFilter] = useState('all'); // all, on_time, overdue

  const loadStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/admin/dashboard-stats`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [token]);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/admin/employees`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(res.data);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  }, [token]);

  const loadLeaveRequests = useCallback(async () => {
    try {
      const url = leaveFilter === 'all' 
        ? `${API}/api/hr/admin/all-requests`
        : `${API}/api/hr/admin/all-requests?status=${leaveFilter}`;
      const res = await axios.get(url, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeaveRequests(res.data);
    } catch (error) {
      console.error('Error loading leave requests:', error);
    }
  }, [leaveFilter, token]);

  const loadAttendanceOverview = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/team/attendance-overview`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttendanceOverview(res.data);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  }, [token]);

  const loadPendingApprovals = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/admin/attendance/pending-approvals`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingApprovals(res.data);
    } catch (error) {
      console.error('Error loading pending approvals:', error);
    }
  }, [token]);

  const loadWfhRequests = useCallback(async () => {
    try {
      const endpoint = wfhFilter === 'pending' 
        ? `${API}/api/hr/wfh/pending`
        : `${API}/api/hr/wfh/all?status=${wfhFilter}`;
      const res = await axios.get(endpoint, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setWfhRequests(res.data);
    } catch (error) {
      console.error('Error loading WFH requests:', error);
    }
  }, [token, wfhFilter]);

  const loadAllAttendance = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API}/api/hr/admin/attendance/all?month=${attendanceMonth}&year=${attendanceYear}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAllAttendance(res.data.records || []);
    } catch (error) {
      console.error('Error loading all attendance:', error);
    }
  }, [token, attendanceMonth, attendanceYear]);

  const loadCalendar = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API}/api/hr/admin/calendar/${calendarYear}/${calendarMonth}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCalendar(res.data);
    } catch (error) {
      console.error('Error loading calendar:', error);
    }
  }, [token, calendarMonth, calendarYear]);

  const loadPayslips = useCallback(async (month, year) => {
    try {
      const m = month || payslipMonth;
      const y = year || payslipYear;
      const res = await axios.get(
        `${API}/api/payroll/payslips?month=${m}&year=${y}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPayslips(res.data);
    } catch (error) {
      console.error('Error loading payslips:', error);
    }
  }, [token, payslipMonth, payslipYear]);

  const loadHRSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/admin/settings`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setHrSettings(res.data);
    } catch (error) {
      console.error('Error loading HR settings:', error);
    }
  }, [token]);

  const loadDesignations = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/designations/`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setDesignations(res.data);
    } catch (error) {
      console.error('Error loading designations:', error);
    }
  }, [token]);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/designations/departments/list`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setDepartments(res.data);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }, [token]);

  const loadQuotes = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/admin/quotes`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuotes(res.data);
    } catch (error) {
      console.error('Error loading quotes:', error);
    }
  }, [token]);

  // Quote management functions
  const handleAddQuote = async () => {
    if (!newQuoteText.trim()) {
      toast.error('Please enter a quote');
      return;
    }
    try {
      await axios.post(`${API}/api/hr/admin/quotes`, { text: newQuoteText }, { headers });
      toast.success('Quote added successfully');
      setNewQuoteText('');
      setShowAddQuoteModal(false);
      loadQuotes();
    } catch (error) {
      toast.error('Failed to add quote');
    }
  };

  const handleUpdateQuote = async (quoteId, updates) => {
    try {
      await axios.put(`${API}/api/hr/admin/quotes/${quoteId}`, updates, { headers });
      toast.success('Quote updated');
      setEditingQuote(null);
      loadQuotes();
    } catch (error) {
      toast.error('Failed to update quote');
    }
  };

  const handleDeleteQuote = async (quoteId) => {
    if (!window.confirm('Delete this quote?')) return;
    try {
      await axios.delete(`${API}/api/hr/admin/quotes/${quoteId}`, { headers });
      toast.success('Quote deleted');
      loadQuotes();
    } catch (error) {
      toast.error('Failed to delete quote');
    }
  };

  // Payroll Management functions
  const loadPayrollEmployees = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/payroll/employees`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayrollEmployees(res.data);
    } catch (error) {
      console.error('Error loading payroll employees:', error);
    }
  }, [token]);

  const loadHikeReasons = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/payroll/hike-reasons`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setHikeReasons(res.data);
    } catch (error) {
      console.error('Error loading hike reasons:', error);
    }
  }, [token]);

  const loadEmployeeSalaryHistory = useCallback(async (userId) => {
    try {
      const res = await axios.get(`${API}/api/payroll/salary-history/${userId}`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployeeSalaryHistory(res.data.salary_history || []);
    } catch (error) {
      console.error('Error loading salary history:', error);
      setEmployeeSalaryHistory([]);
    }
  }, [token]);

  const handleAddSalaryRecord = async () => {
    try {
      await axios.post(`${API}/api/payroll/salary/add`, newSalaryRecord, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Salary record added successfully!');
      setShowAddSalaryModal(false);
      setNewSalaryRecord({ user_id: '', amount: '', effective_from: '', reason: 'initial', notes: '' });
      loadPayrollEmployees();
      if (selectedPayrollEmployee) {
        loadEmployeeSalaryHistory(selectedPayrollEmployee.user_id);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add salary record');
    }
  };

  const handleDeleteSalaryRecord = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this salary record?')) return;
    try {
      await axios.delete(`${API}/api/payroll/salary/${recordId}`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Salary record deleted');
      loadPayrollEmployees();
      if (selectedPayrollEmployee) {
        loadEmployeeSalaryHistory(selectedPayrollEmployee.user_id);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete salary record');
    }
  };

  // Payslip workflow functions
  const loadCompanySettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/payroll/company-settings`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompanySettings(res.data);
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  }, [token]);

  // ====== REVIEW FUNCTIONS ======
  const loadReviewEmployees = useCallback(async () => {
    try {
      const token = localStorage.getItem('session_token');
      const res = await axios.get(`${API}/api/hr/employee-reviews/employees`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setReviewEmployees(res.data);
    } catch (error) {
      console.error('Error loading review employees:', error);
    }
  }, []);

  const loadReviewSummary = useCallback(async (employeeId) => {
    try {
      const token = localStorage.getItem('session_token');
      const res = await axios.get(
        `${API}/api/hr/employee-reviews/employee/${employeeId}/summary?review_type=${reviewTab}&period=${reviewPeriod}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReviewSummary(res.data);
    } catch (error) {
      console.error('Error loading review summary:', error);
      setReviewSummary(null);
    }
  }, [reviewTab, reviewPeriod]);

  const loadReviewTasks = useCallback(async (employeeId, filter = 'all') => {
    try {
      const token = localStorage.getItem('session_token');
      const res = await axios.get(
        `${API}/api/hr/employee-reviews/employee/${employeeId}/tasks?review_type=${reviewTab}&period=${reviewPeriod}&status_filter=${filter}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReviewTasks(res.data);
    } catch (error) {
      console.error('Error loading review tasks:', error);
      setReviewTasks([]);
    }
  }, [reviewTab, reviewPeriod]);

  const loadExistingReviews = useCallback(async (employeeId) => {
    try {
      const token = localStorage.getItem('session_token');
      const res = await axios.get(
        `${API}/api/hr/performance-reviews?employee_id=${employeeId}&review_type=${reviewTab}&period=${reviewPeriod}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setExistingReviews(res.data);
    } catch (error) {
      console.error('Error loading existing reviews:', error);
      setExistingReviews([]);
    }
  }, [reviewTab, reviewPeriod]);

  const handleOpenReviewPopup = async (employee) => {
    setSelectedReviewEmployee(employee);
    setShowReviewPopup(true);
    setReviewForm({ rating: 0, review_text: '' });
    setEditingReview(null);
    await loadReviewSummary(employee.user_id);
    await loadExistingReviews(employee.user_id);
  };

  const handleSubmitReview = async () => {
    if (reviewForm.rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    try {
      if (editingReview) {
        await axios.put(`${API}/api/hr/performance-reviews/${editingReview.review_id}`, {
          rating: reviewForm.rating,
          review_text: reviewForm.review_text
        }, { headers });
        toast.success('Review updated');
      } else {
        await axios.post(`${API}/api/hr/performance-reviews`, {
          employee_id: selectedReviewEmployee.user_id,
          review_type: reviewTab,
          period: reviewPeriod,
          reviewer_role: reviewerTab,
          rating: reviewForm.rating,
          review_text: reviewForm.review_text
        }, { headers });
        toast.success('Review submitted');
      }
      setReviewForm({ rating: 0, review_text: '' });
      setEditingReview(null);
      await loadExistingReviews(selectedReviewEmployee.user_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit review');
    }
  };

  const handleEditReview = (review) => {
    setReviewerTab(review.reviewer_role);
    setReviewForm({ rating: review.rating, review_text: review.review_text });
    setEditingReview(review);
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    try {
      await axios.delete(`${API}/api/hr/performance-reviews/${reviewId}`, { headers });
      toast.success('Review deleted');
      await loadExistingReviews(selectedReviewEmployee.user_id);
    } catch (error) {
      toast.error('Failed to delete review');
    }
  };

  const handleViewReviewTasks = async (filter = 'all') => {
    setTaskFilter(filter);
    await loadReviewTasks(selectedReviewEmployee.user_id, filter);
    setShowTasksPopup(true);
  };

  // Get period display text
  const getPeriodDisplay = () => {
    if (reviewTab === 'monthly') {
      const [year, month] = reviewPeriod.split('-');
      const date = new Date(year, parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (reviewTab === 'quarterly') {
      return reviewPeriod.replace('-', ' ');
    } else {
      return reviewPeriod;
    }
  };

  // Get current quarter
  const getCurrentQuarter = () => {
    const month = new Date().getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return `${new Date().getFullYear()}-Q${quarter}`;
  };

  const handleCreatePayslip = async (userId, hrRemarks = '') => {
    try {
      await axios.post(`${API}/api/payroll/payslip/create`, {
        user_id: userId,
        month: payslipMonth,
        year: payslipYear,
        hr_remarks: hrRemarks
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Payslip created!');
      loadPayslips(payslipMonth, payslipYear);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create payslip');
    }
  };

  const handleSubmitForOperations = async (payslipId) => {
    try {
      await axios.put(`${API}/api/payroll/payslip/${payslipId}/submit-for-operations`, {}, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Submitted for Operations review!');
      loadPayslips(payslipMonth, payslipYear);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit');
    }
  };

  const handleOperationsReview = async (payslipId, reviewText) => {
    try {
      await axios.put(`${API}/api/payroll/payslip/${payslipId}/operations-review`, 
        { review_text: reviewText }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Operations review added!');
      loadPayslips(payslipMonth, payslipYear);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add review');
    }
  };

  const handleCEOReview = async (payslipId, reviewText) => {
    try {
      await axios.put(`${API}/api/payroll/payslip/${payslipId}/ceo-review`, 
        { review_text: reviewText }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('CEO approved!');
      loadPayslips(payslipMonth, payslipYear);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleGeneratePayslip = async (payslipId) => {
    try {
      await axios.put(`${API}/api/payroll/payslip/${payslipId}/generate`, {}, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Payslip generated!');
      loadPayslips(payslipMonth, payslipYear);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate');
    }
  };

  const handleBulkSubmitOperations = async () => {
    try {
      await axios.put(`${API}/api/payroll/payslip/bulk/bulk-submit-operations?month=${payslipMonth}&year=${payslipYear}`, {}, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('All payslips submitted for review!');
      loadPayslips(payslipMonth, payslipYear);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit');
    }
  };

  useEffect(() => {
    // Always load designations and departments for Add Employee form
    loadDesignations();
    loadDepartments();
  }, [loadDesignations, loadDepartments]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadAllAttendance();
      loadEmployees();
      loadStats();
    } else if (activeTab === 'employees') {
      loadEmployees();
    } else if (activeTab === 'approvals') {
      loadPendingApprovals();
      loadLeaveRequests();
      loadWfhRequests();
    } else if (activeTab === 'calendar') {
      loadCalendar();
      loadHRSettings();
    } else if (activeTab === 'payroll') {
      loadPayrollEmployees();
      loadHikeReasons();
      loadPayslips(payslipMonth, payslipYear);
      loadCompanySettings();
      loadEmployees();
    } else if (activeTab === 'designations-depts') {
      loadDesignations();
      loadDepartments();
    } else if (activeTab === 'quotes') {
      loadQuotes();
    } else if (activeTab === 'reviews') {
      loadReviewEmployees();
    }
  }, [activeTab, loadStats, loadEmployees, loadLeaveRequests, loadAttendanceOverview, loadPendingApprovals, loadWfhRequests, loadAllAttendance, loadCalendar, loadPayslips, loadHRSettings, loadPayrollEmployees, loadHikeReasons, loadCompanySettings, payslipMonth, payslipYear, loadDesignations, loadDepartments, loadQuotes]);

  useEffect(() => {
    if (activeTab === 'approvals') {
      loadLeaveRequests();
    }
  }, [leaveFilter, loadLeaveRequests, activeTab]);

  useEffect(() => {
    if (activeTab === 'approvals') {
      loadWfhRequests();
    }
  }, [wfhFilter, loadWfhRequests, activeTab]);

  const handleApprove = async (leaveId) => {
    try {
      await axios.put(`${API}/api/hr/leave/${leaveId}/approve`, {}, { headers });
      toast.success('Leave request approved!');
      loadLeaveRequests();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleReject = async (leaveId) => {
    const reason = window.prompt('Reason for rejection (optional):');
    try {
      await axios.put(`${API}/api/hr/leave/${leaveId}/reject?reason=${encodeURIComponent(reason || '')}`, {}, { headers });
      toast.success('Leave request rejected.');
      loadLeaveRequests();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    }
  };

  // Enhanced leave workflow functions
  const handleViewTasks = async (leaveId) => {
    try {
      const res = await axios.get(`${API}/api/hr/leave/${leaveId}/tasks`, { headers });
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load tasks');
      return null;
    }
  };

  const handleSendForVerification = async (leaveId) => {
    try {
      await axios.post(`${API}/api/hr/leave/${leaveId}/send-for-verification`, {}, { headers });
      toast.success('Leave sent to Operations Admin for task verification');
      loadLeaveRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send for verification');
    }
  };

  const handleFinalApprove = async (leaveId) => {
    try {
      await axios.put(`${API}/api/hr/leave/${leaveId}/final-approve`, {}, { headers });
      toast.success('Leave request approved!');
      loadLeaveRequests();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleApproveAttendance = async (attendanceId, action = 'approve') => {
    try {
      await axios.post(
        `${API}/api/hr/admin/attendance/approve/${attendanceId}?action=${action}`,
        {},
        { headers }
      );
      toast.success(`Attendance ${action}d successfully`);
      loadPendingApprovals();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update attendance');
    }
  };

  const handleApprovePermission = async (permissionId, action = 'approve') => {
    try {
      await axios.post(
        `${API}/api/hr/admin/permission/approve/${permissionId}?action=${action}`,
        {},
        { headers }
      );
      toast.success(`Permission ${action}d successfully`);
      loadPendingApprovals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update permission');
    }
  };

  // WFH/Remote Work Request Handlers
  const handleApproveWfh = async (wfhId, remarks = '') => {
    try {
      await axios.post(
        `${API}/api/hr/wfh/${wfhId}/approve`,
        { remarks },
        { headers }
      );
      toast.success('WFH request approved');
      loadWfhRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve WFH request');
    }
  };

  const handleRejectWfh = async (wfhId, reason) => {
    try {
      if (!reason) {
        toast.error('Please provide a rejection reason');
        return;
      }
      await axios.post(
        `${API}/api/hr/wfh/${wfhId}/reject`,
        { reason },
        { headers }
      );
      toast.success('WFH request rejected');
      loadWfhRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject WFH request');
    }
  };

  const handleDeleteEmployee = async (userId) => {
    try {
      await axios.delete(
        `${API}/api/hr/admin/employee/${userId}`,
        { headers }
      );
      toast.success('Employee deleted successfully');
      loadEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete employee');
    }
  };

  const handleUpdateCalendar = async (calendarData) => {
    try {
      await axios.put(
        `${API}/api/hr/admin/calendar/${calendarYear}/${calendarMonth}`,
        calendarData,
        { headers }
      );
      toast.success('Calendar updated successfully');
      loadCalendar();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update calendar');
    }
  };

  const handleOldGeneratePayslip = async (userId) => {
    try {
      const res = await axios.post(
        `${API}/api/hr/admin/payslip/generate`,
        { user_id: userId, month: payslipMonth, year: payslipYear },
        { headers }
      );
      toast.success('Payslip generated successfully');
      loadPayslips(payslipMonth, payslipYear);
      setShowPayslipModal(false);
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate payslip');
      return null;
    }
  };

  const handlePayslipAction = async (payslipId, action) => {
    try {
      let url = '';
      if (action === 'submit') {
        url = `${API}/api/hr/admin/payslip/${payslipId}/submit`;
      } else if (action === 'approve') {
        url = `${API}/api/hr/admin/payslip/${payslipId}/approve?action=approve`;
      } else if (action === 'send-to-finance') {
        url = `${API}/api/hr/admin/payslip/${payslipId}/send-to-finance`;
      } else if (action === 'release') {
        url = `${API}/api/hr/finance/payslip/${payslipId}/release`;
      }
      
      await axios.put(url, {}, { headers });
      toast.success(`Payslip ${action} successful`);
      loadPayslips();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action} payslip`);
    }
  };

  const handleUpdateHRSettings = async (settingsData) => {
    try {
      await axios.put(`${API}/api/hr/admin/settings`, settingsData, { headers });
      toast.success('HR Settings updated');
      loadHRSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update settings');
    }
  };

  const handleCreateEmployee = async (employeeData) => {
    try {
      console.log('Creating employee:', employeeData);
      const res = await axios.post(`${API}/api/hr/admin/create-employee`, employeeData, { headers });
      console.log('Create response:', res.data);
      toast.success(`Employee ${employeeData.full_name} created successfully! Credentials: ${employeeData.email} / ${employeeData.password}`);
      setShowAddModal(false);
      loadEmployees();
      loadStats();
    } catch (error) {
      console.error('Create employee error:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to create employee';
      toast.error(errorMsg);
    }
  };

  const handleSaveProfile = async (profileData) => {
    try {
      await axios.put(
        `${API}/api/hr/admin/employee/${selectedEmployee.user_id}/profile`,
        profileData,
        { headers }
      );
      toast.success('Employee profile updated');
      setShowEditModal(false);
      loadEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    }
  };

  // Designation handlers
  const handleCreateDesignation = async () => {
    if (!newDesignation.title.trim()) {
      toast.error('Designation title is required');
      return;
    }
    try {
      await axios.post(`${API}/api/designations/`, newDesignation, { headers });
      toast.success('Designation created successfully');
      setShowDesignationModal(false);
      setNewDesignation({ title: '', description: '', roles_responsibilities: '', reporting_to: [], module_access: [] });
      loadDesignations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create designation');
    }
  };

  const handleUpdateDesignation = async () => {
    if (!editingDesignation?.title.trim()) {
      toast.error('Designation title is required');
      return;
    }
    try {
      await axios.put(`${API}/api/designations/${editingDesignation.designation_id}`, editingDesignation, { headers });
      toast.success('Designation updated successfully');
      setEditingDesignation(null);
      loadDesignations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update designation');
    }
  };

  const handleDeleteDesignation = async (id) => {
    try {
      await axios.delete(`${API}/api/designations/${id}`, { headers });
      toast.success('Designation deleted');
      loadDesignations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete designation');
    }
  };

  // Department handlers
  const handleCreateDepartment = async () => {
    if (!newDepartment.name.trim()) {
      toast.error('Department name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/designations/departments`, newDepartment, { headers });
      toast.success('Department created successfully');
      setShowDepartmentModal(false);
      setNewDepartment({ name: '', description: '' });
      loadDepartments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create department');
    }
  };

  const handleDeleteDepartment = async (id) => {
    try {
      await axios.delete(`${API}/api/designations/departments/${id}`, { headers });
      toast.success('Department deleted');
      loadDepartments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete department');
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'designations-depts', label: 'Designation & Depts', icon: Briefcase },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle },
    { id: 'payroll', label: 'Payroll Mgmt', icon: CreditCard },
    { id: 'reviews', label: 'Reviews', icon: ClipboardList },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'quotes', label: 'Quotes', icon: FileText },
  ];

  return (
    <Layout>
      <div className={`p-6 ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'} min-h-screen`} data-testid="hr-admin-page">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                HR Admin
              </span>
            </h1>
            <p className={textSecondary}>Manage employees, leave requests, and attendance</p>
          </div>
          {activeTab === 'employees' && (
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`hr-admin-tab-${tab.id}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#6366f1] !text-white font-medium'
                    : `${bgSecondary} ${textSecondary} hover:bg-[#3f3f46]`
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.id === 'requests' && stats.pending_leaves > 0 && (
                  <Badge className="ml-1 bg-red-500 text-white text-xs">{stats.pending_leaves}</Badge>
                )}
              </Button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'attendance' && (
          <EnhancedAttendanceTab
            records={allAttendance}
            employees={employees}
            stats={stats}
            month={attendanceMonth}
            year={attendanceYear}
            setMonth={setAttendanceMonth}
            setYear={setAttendanceYear}
            onRefresh={loadAllAttendance}
            formatDate={formatDate}
            formatTime={formatTime}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
            token={token}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeesTab
            employees={filteredEmployees}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onEdit={(emp) => { setSelectedEmployee(emp); setShowEditModal(true); }}
            onDelete={handleDeleteEmployee}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'designations-depts' && (
          <DesignationsDeptsTab
            designations={designations}
            departments={departments}
            editingDesignation={editingDesignation}
            setEditingDesignation={setEditingDesignation}
            showDesignationModal={showDesignationModal}
            setShowDesignationModal={setShowDesignationModal}
            showDepartmentModal={showDepartmentModal}
            setShowDepartmentModal={setShowDepartmentModal}
            newDesignation={newDesignation}
            setNewDesignation={setNewDesignation}
            newDepartment={newDepartment}
            setNewDepartment={setNewDepartment}
            onCreateDesignation={handleCreateDesignation}
            onUpdateDesignation={handleUpdateDesignation}
            onDeleteDesignation={handleDeleteDesignation}
            onCreateDepartment={handleCreateDepartment}
            onDeleteDepartment={handleDeleteDepartment}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'approvals' && (
          <EnhancedApprovalsTab
            pendingApprovals={pendingApprovals}
            leaveRequests={leaveRequests}
            leaveFilter={leaveFilter}
            setLeaveFilter={setLeaveFilter}
            wfhRequests={wfhRequests}
            wfhFilter={wfhFilter}
            setWfhFilter={setWfhFilter}
            onApproveAttendance={handleApproveAttendance}
            onApprovePermission={handleApprovePermission}
            onApproveLeave={handleApprove}
            onRejectLeave={handleReject}
            onApproveWfh={handleApproveWfh}
            onRejectWfh={handleRejectWfh}
            onViewTasks={handleViewTasks}
            onSendForVerification={handleSendForVerification}
            onFinalApprove={handleFinalApprove}
            formatDate={formatDate}
            formatTime={formatTime}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {/* Payroll Management Tab - with Payslips inside */}
        {activeTab === 'payroll' && (
          <PayrollManagementTab
            employees={payrollEmployees}
            selectedEmployee={selectedPayrollEmployee}
            setSelectedEmployee={setSelectedPayrollEmployee}
            salaryHistory={employeeSalaryHistory}
            loadSalaryHistory={loadEmployeeSalaryHistory}
            hikeReasons={hikeReasons}
            showAddModal={showAddSalaryModal}
            setShowAddModal={setShowAddSalaryModal}
            newSalaryRecord={newSalaryRecord}
            setNewSalaryRecord={setNewSalaryRecord}
            onAddSalary={handleAddSalaryRecord}
            onDeleteSalary={handleDeleteSalaryRecord}
            searchQuery={payrollSearchQuery}
            setSearchQuery={setPayrollSearchQuery}
            payslips={payslips}
            payslipMonth={payslipMonth}
            payslipYear={payslipYear}
            setPayslipMonth={setPayslipMonth}
            setPayslipYear={setPayslipYear}
            onCreatePayslip={handleCreatePayslip}
            onSubmitForOperations={handleSubmitForOperations}
            onOperationsReview={handleOperationsReview}
            onCEOReview={handleCEOReview}
            onGeneratePayslip={handleGeneratePayslip}
            onBulkSubmitOperations={handleBulkSubmitOperations}
            onRefreshPayslips={() => loadPayslips(payslipMonth, payslipYear)}
            companySettings={companySettings}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            bgInput={bgInput}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'calendar' && (
          <EnhancedCalendarTab
            calendar={calendar}
            hrSettings={hrSettings}
            month={calendarMonth}
            year={calendarYear}
            setMonth={setCalendarMonth}
            setYear={setCalendarYear}
            onUpdateCalendar={handleUpdateCalendar}
            onUpdateSettings={handleUpdateHRSettings}
            onRefresh={loadCalendar}
            loadHRSettings={loadHRSettings}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {/* Quotes Tab */}
        {activeTab === 'quotes' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-xl font-bold ${textPrimary}`}>Motivational Quotes</h2>
                <p className={textSecondary}>Manage daily quotes shown to employees on their task dashboard</p>
              </div>
              <Button onClick={() => setShowAddQuoteModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                <Plus className="h-4 w-4 mr-2" />
                Add Quote
              </Button>
            </div>

            {/* Quotes List */}
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-0">
                <div className="divide-y divide-[#3f3f46]">
                  {quotes.length === 0 ? (
                    <div className="p-8 text-center">
                      <FileText className={`h-12 w-12 mx-auto mb-4 ${textSecondary}`} />
                      <p className={textPrimary}>No quotes added yet</p>
                      <p className={`text-sm ${textSecondary}`}>Add motivational quotes to inspire your team</p>
                    </div>
                  ) : quotes.map((quote, index) => (
                    <div 
                      key={quote.quote_id} 
                      className={`p-4 flex items-center justify-between gap-4 ${!quote.active ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-8 w-8 rounded-full ${bgSecondary} flex items-center justify-center text-sm font-medium ${textPrimary}`}>
                          {index + 1}
                        </div>
                        {editingQuote === quote.quote_id ? (
                          <Input
                            defaultValue={quote.text}
                            onBlur={(e) => handleUpdateQuote(quote.quote_id, { text: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateQuote(quote.quote_id, { text: e.target.value });
                              if (e.key === 'Escape') setEditingQuote(null);
                            }}
                            className={`flex-1 ${bgSecondary} ${borderColor}`}
                            autoFocus
                          />
                        ) : (
                          <p className={`${textPrimary} italic`}>"{quote.text}"</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateQuote(quote.quote_id, { active: !quote.active })}
                          className={quote.active ? 'text-[#10b981]' : textSecondary}
                        >
                          {quote.active ? 'Active' : 'Inactive'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingQuote(quote.quote_id)}
                          className={textSecondary}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteQuote(quote.quote_id)}
                          className="text-red-500 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quote Statistics */}
            <div className="grid grid-cols-3 gap-4">
              <Card className={`${bgCard} border ${borderColor} p-4`}>
                <p className={`text-sm ${textSecondary}`}>Total Quotes</p>
                <p className={`text-2xl font-bold ${textPrimary}`}>{quotes.length}</p>
              </Card>
              <Card className={`${bgCard} border ${borderColor} p-4`}>
                <p className={`text-sm ${textSecondary}`}>Active</p>
                <p className="text-2xl font-bold text-[#10b981]">{quotes.filter(q => q.active).length}</p>
              </Card>
              <Card className={`${bgCard} border ${borderColor} p-4`}>
                <p className={`text-sm ${textSecondary}`}>Inactive</p>
                <p className="text-2xl font-bold text-[#f59e0b]">{quotes.filter(q => !q.active).length}</p>
              </Card>
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-6" data-testid="reviews-tab">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-xl font-bold ${textPrimary}`}>Employee Reviews</h2>
                <p className={textSecondary}>Performance reviews for {getPeriodDisplay()}</p>
              </div>
            </div>

            {/* Review Type Tabs & Period Filter */}
            <Card className={`${bgCard} border ${borderColor}`}>
              <div className={`p-4 flex flex-wrap items-center justify-between gap-4`}>
                {/* Review Type Tabs */}
                <div className="flex gap-2">
                  {[
                    { id: 'monthly', label: 'Monthly Review' },
                    { id: 'quarterly', label: 'Quarterly Review' },
                    { id: 'yearly', label: 'Yearly Review' }
                  ].map((tab) => (
                    <Button
                      key={tab.id}
                      onClick={() => {
                        setReviewTab(tab.id);
                        if (tab.id === 'monthly') {
                          const now = new Date();
                          setReviewPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                        } else if (tab.id === 'quarterly') {
                          setReviewPeriod(getCurrentQuarter());
                        } else {
                          setReviewPeriod(String(new Date().getFullYear()));
                        }
                      }}
                      data-testid={`review-tab-${tab.id}`}
                      className={`px-4 py-2 rounded-lg transition-all ${
                        reviewTab === tab.id
                          ? 'bg-[#6366f1] text-white'
                          : `${bgSecondary} ${textSecondary} hover:bg-[#3f3f46]`
                      }`}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>

                {/* Period Filter */}
                <div className="flex items-center gap-2">
                  <span className={textSecondary}>Period:</span>
                  {reviewTab === 'monthly' && (
                    <Input
                      type="month"
                      value={reviewPeriod}
                      onChange={(e) => setReviewPeriod(e.target.value)}
                      className={`w-48 ${bgSecondary} ${borderColor}`}
                    />
                  )}
                  {reviewTab === 'quarterly' && (
                    <Select value={reviewPeriod} onValueChange={setReviewPeriod}>
                      <SelectTrigger className={`w-48 ${bgSecondary} ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(8)].map((_, i) => {
                          const year = new Date().getFullYear() - Math.floor(i / 4);
                          const quarter = 4 - (i % 4);
                          return (
                            <SelectItem key={`${year}-Q${quarter}`} value={`${year}-Q${quarter}`}>
                              {year} Q{quarter}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  {reviewTab === 'yearly' && (
                    <Select value={reviewPeriod} onValueChange={setReviewPeriod}>
                      <SelectTrigger className={`w-48 ${bgSecondary} ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(5)].map((_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <SelectItem key={year} value={String(year)}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </Card>

            {/* Employee List */}
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader>
                <CardTitle className={`${textPrimary} text-lg`}>Employees ({reviewEmployees.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className={`divide-y ${isDark ? 'divide-[#3f3f46]' : 'divide-gray-200'}`}>
                  {reviewEmployees.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users className={`h-12 w-12 mx-auto mb-4 ${textSecondary}`} />
                      <p className={textPrimary}>No employees found</p>
                    </div>
                  ) : reviewEmployees.map((employee) => (
                    <div 
                      key={employee.user_id} 
                      onClick={() => handleOpenReviewPopup(employee)}
                      className={`p-4 flex items-center justify-between cursor-pointer hover:${isDark ? 'bg-[#27272a]' : 'bg-gray-50'} transition-colors`}
                      data-testid={`review-employee-${employee.user_id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-medium">
                          {employee.profile_photo ? (
                            <img src={employee.profile_photo} alt="" className="h-12 w-12 rounded-full object-cover" />
                          ) : (
                            employee.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className={`font-medium ${textPrimary}`}>{employee.name}</p>
                          <p className={`text-sm ${textSecondary}`}>{employee.designation || employee.department || 'Employee'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Eye className={`h-5 w-5 ${textSecondary}`} />
                        <span className={textSecondary}>Click to Review</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Review Popup Modal */}
        {showReviewPopup && selectedReviewEmployee && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowReviewPopup(false)}>
            <Card 
              className={`${bgCard} border ${borderColor} w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between shrink-0`}>
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-semibold text-lg">
                    {selectedReviewEmployee.profile_photo ? (
                      <img src={selectedReviewEmployee.profile_photo} alt="" className="h-14 w-14 rounded-full object-cover" />
                    ) : (
                      selectedReviewEmployee.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${textPrimary}`}>{selectedReviewEmployee.name}</h3>
                    <p className={textSecondary}>{selectedReviewEmployee.designation || selectedReviewEmployee.department || 'Employee'} • {getPeriodDisplay()}</p>
                  </div>
                </div>
                <button onClick={() => setShowReviewPopup(false)} className={textSecondary}>
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 overflow-y-auto flex-1 space-y-6">
                {/* Summary Stats */}
                {reviewSummary && (
                  <div className="grid grid-cols-3 gap-4">
                    {/* Attendance Card */}
                    <Card className={`${bgSecondary} border-0 p-4`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="h-5 w-5 text-[#6366f1]" />
                        <h4 className={`font-semibold ${textPrimary}`}>Attendance</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className={textSecondary}>Present</span>
                          <span className="text-[#10b981] font-medium">{reviewSummary.attendance?.present_days || 0} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textSecondary}>Absent</span>
                          <span className="text-red-500 font-medium">{reviewSummary.attendance?.absent_days || 0} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textSecondary}>Leave</span>
                          <span className="text-[#f59e0b] font-medium">{reviewSummary.attendance?.leave_days || 0} days</span>
                        </div>
                      </div>
                    </Card>

                    {/* Working Hours Card */}
                    <Card className={`${bgSecondary} border-0 p-4`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-5 w-5 text-[#8b5cf6]" />
                        <h4 className={`font-semibold ${textPrimary}`}>Working Hours</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className={textSecondary}>Total Hours</span>
                          <span className={`${textPrimary} font-medium`}>{reviewSummary.working_hours?.total_hours || 0}h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textSecondary}>Extra Hours</span>
                          <span className="text-[#10b981] font-medium">+{reviewSummary.working_hours?.extra_hours || 0}h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={textSecondary}>Avg Daily</span>
                          <span className={`${textPrimary} font-medium`}>{reviewSummary.working_hours?.average_daily || 0}h</span>
                        </div>
                      </div>
                    </Card>

                    {/* Delivery Timeline Card */}
                    <Card className={`${bgSecondary} border-0 p-4`}>
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="h-5 w-5 text-[#22c55e]" />
                        <h4 className={`font-semibold ${textPrimary}`}>Delivery Timeline</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className={textSecondary}>Total Tasks</span>
                          <span className={`${textPrimary} font-medium`}>{reviewSummary.delivery_timeline?.total_tasks || 0}</span>
                        </div>
                        <div 
                          className="flex justify-between cursor-pointer hover:bg-[#3f3f46]/30 p-1 rounded -mx-1"
                          onClick={() => handleViewReviewTasks('on_time')}
                        >
                          <span className={textSecondary}>On Time</span>
                          <span className="text-[#10b981] font-medium underline">{reviewSummary.delivery_timeline?.on_time || 0}</span>
                        </div>
                        <div 
                          className="flex justify-between cursor-pointer hover:bg-[#3f3f46]/30 p-1 rounded -mx-1"
                          onClick={() => handleViewReviewTasks('overdue')}
                        >
                          <span className={textSecondary}>Overdue</span>
                          <span className="text-red-500 font-medium underline">{reviewSummary.delivery_timeline?.overdue || 0}</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Review Tabs: HR | Operations | CEO */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-semibold ${textPrimary}`}>Write Review</h4>
                    <div className="flex gap-2">
                      {['hr', 'operations', 'ceo'].map((role) => (
                        <Button
                          key={role}
                          onClick={() => {
                            setReviewerTab(role);
                            setReviewForm({ rating: 0, review_text: '' });
                            setEditingReview(null);
                          }}
                          data-testid={`reviewer-tab-${role}`}
                          className={`px-4 py-2 capitalize ${
                            reviewerTab === role
                              ? role === 'hr' ? 'bg-[#ec4899] text-white' :
                                role === 'operations' ? 'bg-[#8b5cf6] text-white' :
                                'bg-[#f59e0b] text-white'
                              : `${bgSecondary} ${textSecondary}`
                          }`}
                        >
                          {role === 'hr' ? 'HR' : role === 'operations' ? 'Operations' : 'CEO'}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Review Form */}
                  <Card className={`${bgSecondary} border-0 p-4`}>
                    <div className="space-y-4">
                      {/* Star Rating */}
                      <div>
                        <Label className={textPrimary}>Rating</Label>
                        <div className="flex gap-2 mt-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                              className="focus:outline-none"
                              data-testid={`star-rating-${star}`}
                            >
                              <Star 
                                className={`h-8 w-8 transition-colors ${
                                  star <= reviewForm.rating 
                                    ? 'fill-[#f59e0b] text-[#f59e0b]' 
                                    : `${textSecondary}`
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Review Text */}
                      <div>
                        <Label className={textPrimary}>Review Comments</Label>
                        <textarea
                          value={reviewForm.review_text}
                          onChange={(e) => setReviewForm({ ...reviewForm, review_text: e.target.value })}
                          placeholder={`Write your ${reviewerTab === 'hr' ? 'HR' : reviewerTab === 'operations' ? 'Operations' : 'CEO'} review...`}
                          className={`w-full h-24 mt-2 p-3 rounded-lg ${bgCard} ${borderColor} border ${textPrimary} resize-none`}
                        />
                      </div>

                      {/* Submit Button */}
                      <div className="flex justify-end">
                        <Button 
                          onClick={handleSubmitReview}
                          className={
                            reviewerTab === 'hr' ? 'bg-[#ec4899] hover:bg-[#db2777]' :
                            reviewerTab === 'operations' ? 'bg-[#8b5cf6] hover:bg-[#7c3aed]' :
                            'bg-[#f59e0b] hover:bg-[#d97706]'
                          }
                          data-testid="submit-review-btn"
                        >
                          {editingReview ? 'Update Review' : 'Submit Review'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Existing Reviews */}
                {existingReviews.length > 0 && (
                  <div className="space-y-4">
                    <h4 className={`font-semibold ${textPrimary}`}>Submitted Reviews</h4>
                    <div className="grid gap-4">
                      {existingReviews.map((review) => (
                        <Card 
                          key={review.review_id} 
                          className={`${bgSecondary} border-0 p-4`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Badge className={
                                review.reviewer_role === 'hr' ? 'bg-[#ec4899] text-white' :
                                review.reviewer_role === 'operations' ? 'bg-[#8b5cf6] text-white' :
                                'bg-[#f59e0b] text-white'
                              }>
                                {review.reviewer_role === 'hr' ? 'HR' : review.reviewer_role === 'operations' ? 'Operations' : 'CEO'}
                              </Badge>
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star 
                                    key={star}
                                    className={`h-4 w-4 ${
                                      star <= review.rating 
                                        ? 'fill-[#f59e0b] text-[#f59e0b]' 
                                        : textSecondary
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditReview(review)}
                                className={textSecondary}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteReview(review.review_id)}
                                className="text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className={`mt-3 ${textPrimary}`}>{review.review_text || 'No comments provided.'}</p>
                          <p className={`text-xs ${textSecondary} mt-2`}>
                            By {review.reviewer_name} • {new Date(review.created_at).toLocaleDateString()}
                          </p>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Tasks Popup Modal */}
        {showTasksPopup && selectedReviewEmployee && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={() => setShowTasksPopup(false)}>
            <Card 
              className={`${bgCard} border ${borderColor} w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`p-4 border-b ${borderColor} flex items-center justify-between shrink-0`}>
                <div>
                  <h3 className={`font-bold ${textPrimary}`}>Tasks - {selectedReviewEmployee.name}</h3>
                  <p className={`text-sm ${textSecondary}`}>
                    {taskFilter === 'all' ? 'All Tasks' : taskFilter === 'on_time' ? 'On Time Tasks' : 'Overdue Tasks'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={taskFilter} onValueChange={(v) => handleViewReviewTasks(v)}>
                    <SelectTrigger className={`w-32 ${bgSecondary} ${borderColor}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="on_time">On Time</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={() => setShowTasksPopup(false)} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                {reviewTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className={`h-12 w-12 mx-auto mb-4 ${textSecondary}`} />
                    <p className={textPrimary}>No tasks found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviewTasks.map((task, idx) => (
                      <div 
                        key={task.task_id || idx}
                        className={`p-3 rounded-lg ${bgSecondary} flex items-center justify-between`}
                      >
                        <div className="flex-1">
                          <p className={`font-medium ${textPrimary}`}>{task.title || task.page_name || 'Untitled Task'}</p>
                          <p className={`text-sm ${textSecondary}`}>
                            {task.project_name || task.description || 'No description'}
                          </p>
                          {task.due_date && (
                            <p className={`text-xs ${textSecondary} mt-1`}>
                              Due: {new Date(task.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Badge className={
                          task.delivery_status === 'on_time' 
                            ? 'bg-[#10b981] text-white' 
                            : 'bg-red-500 text-white'
                        }>
                          {task.delivery_status === 'on_time' ? 'On Time' : 'Overdue'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Add Quote Modal */}
        {showAddQuoteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className={`${bgCard} border ${borderColor} w-full max-w-md`}>
              <CardHeader>
                <CardTitle className={textPrimary}>Add New Quote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className={textPrimary}>Quote Text</Label>
                  <Input
                    value={newQuoteText}
                    onChange={(e) => setNewQuoteText(e.target.value)}
                    placeholder="Enter a short motivational quote (3-5 words)"
                    className={`${bgSecondary} ${borderColor}`}
                  />
                  <p className={`text-xs ${textSecondary} mt-1`}>
                    Keep it short and positive (e.g., "Believe in yourself")
                  </p>
                </div>
              </CardContent>
              <div className={`p-4 border-t ${borderColor} flex gap-2 justify-end`}>
                <Button variant="outline" onClick={() => { setShowAddQuoteModal(false); setNewQuoteText(''); }}>
                  Cancel
                </Button>
                <Button onClick={handleAddQuote} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                  Add Quote
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Add Employee Modal */}
        {showAddModal && (
          <AddEmployeeModal
            onClose={() => setShowAddModal(false)}
            onSave={handleCreateEmployee}
            isDark={isDark}
            bgCard={bgCard}
            bgInput={bgInput}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
            designations={designations}
            departments={departments}
          />
        )}

        {/* Edit Employee Modal */}
        {showEditModal && selectedEmployee && (
          <EditEmployeeModal
            employee={selectedEmployee}
            onClose={() => setShowEditModal(false)}
            onSave={handleSaveProfile}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}
      </div>
    </Layout>
  );
}

// ============== ADD EMPLOYEE MODAL ==============
function AddEmployeeModal({ onClose, onSave, isDark, bgCard, bgInput, bgSecondary, textPrimary, textSecondary, borderColor, designations = [], departments = [] }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [showPassword, setShowPassword] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: '', link: '', description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, index: -1, typed: '' });
  
  const [formData, setFormData] = useState({
    // Basic Details
    full_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    blood_group: '',
    // Account Details
    account_holder_name: '',
    bank_name: '',
    branch: '',
    account_number: '',
    ifsc_code: '',
    upi_id: '',
    pan_number: '',
    aadhar_number: '',
    // Employment Details
    employee_id: '',
    designation_id: '',
    department: '',
    employment_type: 'full-time',
    joining_date: '',
    reporting_manager: '',
    work_location: 'office',
    // Role & Access (simplified - based on designation)
    password: '',
    // Emergency Contact
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    // Address
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addDocument = () => {
    if (!newDoc.name || !newDoc.link) {
      toast.error('Document name and link are required');
      return;
    }
    setDocuments(prev => [...prev, { ...newDoc, id: Date.now() }]);
    setNewDoc({ name: '', link: '', description: '' });
    setShowDocModal(false);
  };

  const removeDocument = (index) => {
    if (deleteConfirm.typed === 'DELETE') {
      setDocuments(prev => prev.filter((_, i) => i !== index));
      setDeleteConfirm({ show: false, index: -1, typed: '' });
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password }));
  };

  const handleSubmit = () => {
    if (!formData.full_name || !formData.full_name.trim()) {
      toast.error('Full Name is required');
      return;
    }
    if (!formData.email || !formData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      toast.error('Password is required (minimum 6 characters)');
      return;
    }
    if (!formData.designation_id) {
      toast.error('Please select a designation');
      return;
    }
    
    // Get designation details for role and module access
    const selectedDesignation = designations.find(d => d.designation_id === formData.designation_id);
    const submitData = {
      ...formData,
      designation: selectedDesignation?.title || '',
      role: 'employee', // All employees get 'employee' role, access based on designation
      module_access: selectedDesignation?.module_access || [],
      documents: documents
    };
    
    console.log('Submitting form data:', submitData);
    onSave(submitData);
  };

  const tabConfig = [
    { id: 'basic', label: 'Basic Details', icon: Users },
    { id: 'account', label: 'Account Details', icon: CreditCard },
    { id: 'employment', label: 'Employment', icon: Briefcase },
    { id: 'documents', label: 'Documents', icon: FolderOpen },
    { id: 'access', label: 'Role & Access', icon: Shield },
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={`${bgCard} ${textPrimary} max-w-3xl max-h-[90vh] overflow-hidden flex flex-col`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#6366f1]" />
            Add New Employee
          </DialogTitle>
          <DialogDescription className={textSecondary}>
            Fill in the employee details across all tabs to create a new account.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#3f3f46] pb-0 overflow-x-auto">
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#6366f1] text-[#6366f1]'
                    : `border-transparent ${textSecondary} hover:text-[#fafafa]`
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto py-4 px-1">
          {/* Basic Details Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={textPrimary}>Full Name *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    placeholder="Enter full name"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Personal Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="personal@email.com"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Phone Number</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+91 9999999999"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleChange('date_of_birth', e.target.value)}
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Gender</Label>
                  <Select value={formData.gender} onValueChange={(v) => handleChange('gender', v)}>
                    <SelectTrigger className={`${bgInput} border ${borderColor}`}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent className={`${bgCard} border ${borderColor}`}>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>Blood Group</Label>
                  <Select value={formData.blood_group} onValueChange={(v) => handleChange('blood_group', v)}>
                    <SelectTrigger className={`${bgInput} border ${borderColor}`}>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent className={`${bgCard} border ${borderColor}`}>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={`p-4 ${bgSecondary} rounded-lg mt-4`}>
                <h4 className={`font-medium ${textPrimary} mb-3`}>Address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label className={textSecondary}>Address</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      placeholder="Street address"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>City</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>State</Label>
                    <Input
                      value={formData.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>Pincode</Label>
                    <Input
                      value={formData.pincode}
                      onChange={(e) => handleChange('pincode', e.target.value)}
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                </div>
              </div>

              <div className={`p-4 ${bgSecondary} rounded-lg`}>
                <h4 className={`font-medium ${textPrimary} mb-3`}>Emergency Contact</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className={textSecondary}>Name</Label>
                    <Input
                      value={formData.emergency_contact_name}
                      onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>Phone</Label>
                    <Input
                      value={formData.emergency_contact_phone}
                      onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>Relation</Label>
                    <Input
                      value={formData.emergency_contact_relation}
                      onChange={(e) => handleChange('emergency_contact_relation', e.target.value)}
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account Details Tab */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div className={`p-4 ${bgSecondary} rounded-lg`}>
                <h4 className={`font-medium ${textPrimary} mb-3`}>Bank Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textSecondary}>A/C Holder Name</Label>
                    <Input
                      value={formData.account_holder_name}
                      onChange={(e) => handleChange('account_holder_name', e.target.value)}
                      placeholder="Account holder name"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>Bank Name</Label>
                    <Input
                      value={formData.bank_name}
                      onChange={(e) => handleChange('bank_name', e.target.value)}
                      placeholder="e.g., HDFC Bank"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>Branch</Label>
                    <Input
                      value={formData.branch}
                      onChange={(e) => handleChange('branch', e.target.value)}
                      placeholder="Branch name"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>Account Number</Label>
                    <Input
                      value={formData.account_number}
                      onChange={(e) => handleChange('account_number', e.target.value)}
                      placeholder="Account number"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>IFSC Code</Label>
                    <Input
                      value={formData.ifsc_code}
                      onChange={(e) => handleChange('ifsc_code', e.target.value)}
                      placeholder="e.g., HDFC0001234"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>UPI ID</Label>
                    <Input
                      value={formData.upi_id}
                      onChange={(e) => handleChange('upi_id', e.target.value)}
                      placeholder="e.g., name@upi"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                </div>
              </div>

              <div className={`p-4 ${bgSecondary} rounded-lg`}>
                <h4 className={`font-medium ${textPrimary} mb-3`}>Tax & ID Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textSecondary}>PAN Number</Label>
                    <Input
                      value={formData.pan_number}
                      onChange={(e) => handleChange('pan_number', e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>Aadhar Number</Label>
                    <Input
                      value={formData.aadhar_number}
                      onChange={(e) => handleChange('aadhar_number', e.target.value)}
                      placeholder="1234 5678 9012"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Employment Details Tab */}
          {activeTab === 'employment' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={textPrimary}>Employee ID</Label>
                  <Input
                    value={formData.employee_id}
                    onChange={(e) => handleChange('employee_id', e.target.value)}
                    placeholder="e.g., EMP001"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Designation *</Label>
                  <Select value={formData.designation_id} onValueChange={(v) => handleChange('designation_id', v)}>
                    <SelectTrigger className={`${bgInput} border ${borderColor}`}>
                      <SelectValue placeholder="Select designation" />
                    </SelectTrigger>
                    <SelectContent className={`${bgCard} border ${borderColor}`}>
                      {designations.map(desg => (
                        <SelectItem key={desg.designation_id} value={desg.designation_id}>
                          {desg.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>Department</Label>
                  <Select value={formData.department} onValueChange={(v) => handleChange('department', v)}>
                    <SelectTrigger className={`${bgInput} border ${borderColor}`}>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent className={`${bgCard} border ${borderColor}`}>
                      {departments.map(dept => (
                        <SelectItem key={dept.department_id || dept.name} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>Employment Type</Label>
                  <Select value={formData.employment_type} onValueChange={(v) => handleChange('employment_type', v)}>
                    <SelectTrigger className={`${bgInput} border ${borderColor}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={`${bgCard} border ${borderColor}`}>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="freelancer">Freelancer</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>Joining Date</Label>
                  <Input
                    type="date"
                    value={formData.joining_date}
                    onChange={(e) => handleChange('joining_date', e.target.value)}
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Reporting Manager</Label>
                  <Input
                    value={formData.reporting_manager}
                    onChange={(e) => handleChange('reporting_manager', e.target.value)}
                    placeholder="Manager's name"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Work Location</Label>
                  <Select value={formData.work_location} onValueChange={(v) => handleChange('work_location', v)}>
                    <SelectTrigger className={`${bgInput} border ${borderColor}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={`${bgCard} border ${borderColor}`}>
                      <SelectItem value="office">Office</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Show selected designation info */}
              {formData.designation_id && (
                <div className={`p-4 ${bgSecondary} rounded-lg mt-4`}>
                  {(() => {
                    const desg = designations.find(d => d.designation_id === formData.designation_id);
                    return desg ? (
                      <>
                        <h4 className={`font-medium ${textPrimary} mb-2`}>Designation Info: {desg.title}</h4>
                        {desg.description && <p className={`text-sm ${textSecondary} mb-2`}>{desg.description}</p>}
                        {desg.module_access?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className={`text-xs ${textSecondary}`}>Access:</span>
                            {desg.module_access.map(m => (
                              <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                            ))}
                          </div>
                        )}
                      </>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className={`text-sm ${textSecondary}`}>
                  Add employee documents with links
                </p>
                <Button 
                  onClick={() => setShowDocModal(true)}
                  className="bg-[#6366f1] hover:bg-[#4f46e5]"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </div>
              
              {/* Documents List */}
              {documents.length > 0 ? (
                <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
                  <table className="w-full">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>S.No</th>
                        <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Document Name</th>
                        <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Link</th>
                        <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3f3f46]">
                      {documents.map((doc, index) => (
                        <tr key={doc.id} className={bgCard}>
                          <td className={`px-4 py-3 text-sm ${textPrimary}`}>{index + 1}</td>
                          <td className={`px-4 py-3 text-sm ${textPrimary}`}>
                            {doc.name}
                            {doc.description && (
                              <p className={`text-xs ${textSecondary}`}>{doc.description}</p>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-sm`}>
                            <a 
                              href={doc.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[#6366f1] hover:underline flex items-center gap-1"
                            >
                              <Link className="h-3 w-3" />
                              View
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <a 
                                href={doc.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <Button variant="ghost" size="sm" className="text-[#6366f1]">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </a>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-[#ef4444]"
                                onClick={() => setDeleteConfirm({ show: true, index, typed: '' })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={`p-8 text-center ${bgSecondary} rounded-lg`}>
                  <FolderOpen className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                  <p className={textSecondary}>No documents added yet</p>
                  <p className={`text-sm ${textSecondary}`}>Click "Add Document" to upload employee documents</p>
                </div>
              )}
              
              {/* Add Document Modal */}
              {showDocModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4`}>
                    <CardHeader>
                      <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                        <Plus className="h-5 w-5 text-[#6366f1]" />
                        Add New Document
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className={textPrimary}>Document Name *</Label>
                        <Input
                          value={newDoc.name}
                          onChange={(e) => setNewDoc(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Resume, ID Proof"
                          className={`${bgInput} border ${borderColor} ${textPrimary}`}
                        />
                      </div>
                      <div>
                        <Label className={textPrimary}>Link *</Label>
                        <Input
                          value={newDoc.link}
                          onChange={(e) => setNewDoc(prev => ({ ...prev, link: e.target.value }))}
                          placeholder="https://drive.google.com/..."
                          className={`${bgInput} border ${borderColor} ${textPrimary}`}
                        />
                      </div>
                      <div>
                        <Label className={textSecondary}>Description (Optional)</Label>
                        <Input
                          value={newDoc.description}
                          onChange={(e) => setNewDoc(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Brief description"
                          className={`${bgInput} border ${borderColor} ${textPrimary}`}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setShowDocModal(false)}>Cancel</Button>
                        <Button onClick={addDocument} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                          Add Document
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {/* Delete Confirmation Modal */}
              {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <Card className={`${bgCard} border ${borderColor} w-full max-w-sm mx-4`}>
                    <CardHeader>
                      <CardTitle className={`text-[#ef4444] ${textPrimary}`}>Delete Document</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className={textSecondary}>Type "DELETE" to confirm deletion:</p>
                      <Input
                        value={deleteConfirm.typed}
                        onChange={(e) => setDeleteConfirm(prev => ({ ...prev, typed: e.target.value }))}
                        placeholder="Type DELETE"
                        className={`${bgInput} border ${borderColor} ${textPrimary}`}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setDeleteConfirm({ show: false, index: -1, typed: '' })}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => removeDocument(deleteConfirm.index)}
                          disabled={deleteConfirm.typed !== 'DELETE'}
                          className="bg-[#ef4444] hover:bg-[#dc2626]"
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Role & Access Tab */}
          {activeTab === 'access' && (
            <div className="space-y-6">
              {/* Info about designation-based access */}
              <div className={`p-4 ${bgSecondary} rounded-lg border border-[#6366f1]/30`}>
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-[#6366f1] mt-0.5" />
                  <div>
                    <h4 className={`font-medium ${textPrimary}`}>Access Control</h4>
                    <p className={`text-sm ${textSecondary} mt-1`}>
                      Module access is determined by the selected designation. 
                      Select a designation in the Employment tab to see the assigned permissions.
                    </p>
                    {formData.designation_id && (
                      <div className="mt-3">
                        {(() => {
                          const desg = designations.find(d => d.designation_id === formData.designation_id);
                          return desg ? (
                            <div className="flex flex-wrap gap-2">
                              <span className={`text-xs ${textSecondary}`}>Modules:</span>
                              {desg.module_access?.length > 0 ? (
                                desg.module_access.map(m => (
                                  <Badge key={m} className="bg-[#6366f1]/20 text-[#6366f1] text-xs">{m}</Badge>
                                ))
                              ) : (
                                <span className={`text-xs ${textSecondary}`}>No modules assigned</span>
                              )}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Login Credentials */}
              <div className={`p-4 ${bgSecondary} rounded-lg`}>
                <h4 className={`font-medium ${textPrimary} mb-3 flex items-center gap-2`}>
                  <Key className="h-4 w-4" />
                  Login Credentials
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className={textSecondary}>Work Email *</Label>
                    <div className="relative">
                      <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="employee@drawlead.com"
                        className={`pl-10 ${bgInput} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className={textSecondary}>Password *</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => handleChange('password', e.target.value)}
                          placeholder="Enter password"
                          className={`pr-10 ${bgInput} border ${borderColor} ${textPrimary}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSecondary}`}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        type="button"
                        onClick={generatePassword}
                        variant="outline"
                        className={`border ${borderColor}`}
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                </div>
                <p className={`text-xs ${textSecondary} mt-3`}>
                  These credentials will be shared with the employee for board access. Password can be regenerated later.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-[#3f3f46] pt-4">
          <Button variant="ghost" onClick={onClose} className={textSecondary}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-[#6366f1] hover:bg-[#4f46e5]">
            <UserPlus className="h-4 w-4 mr-2" />
            Create Employee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== DASHBOARD TAB ==============
function DashboardTab({ stats, attendanceOverview, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const presentCount = attendanceOverview.filter(a => a.status === 'present').length;
  const wfhCount = attendanceOverview.filter(a => a.work_location === 'home').length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <Users className="h-8 w-8 text-[#6366f1] mx-auto mb-2" />
            <p className={`text-2xl font-bold ${textPrimary}`}>{stats.total_employees || 0}</p>
            <p className={`text-xs ${textSecondary}`}>Total Employees</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-[#10b981] mx-auto mb-2" />
            <p className="text-2xl font-bold text-[#10b981]">{stats.present_today || presentCount}</p>
            <p className={`text-xs ${textSecondary}`}>Present Today</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <XCircle className="h-8 w-8 text-[#ef4444] mx-auto mb-2" />
            <p className="text-2xl font-bold text-[#ef4444]">{stats.absent_today || 0}</p>
            <p className={`text-xs ${textSecondary}`}>Absent Today</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <Home className="h-8 w-8 text-[#8b5cf6] mx-auto mb-2" />
            <p className="text-2xl font-bold text-[#8b5cf6]">{stats.wfh_today || wfhCount}</p>
            <p className={`text-xs ${textSecondary}`}>WFH Today</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <Building className="h-8 w-8 text-[#f59e0b] mx-auto mb-2" />
            <p className="text-2xl font-bold text-[#f59e0b]">{stats.wfo_today || 0}</p>
            <p className={`text-xs ${textSecondary}`}>In Office</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-8 w-8 text-[#ec4899] mx-auto mb-2" />
            <p className="text-2xl font-bold text-[#ec4899]">{stats.pending_leaves || 0}</p>
            <p className={`text-xs ${textSecondary}`}>Pending Leaves</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Attendance Overview */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Today's Team Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attendanceOverview.slice(0, 9).map((emp) => (
              <div key={emp.user_id} className={`flex items-center gap-3 p-3 ${bgSecondary} rounded-lg`}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${
                  emp.status === 'present' ? 'bg-[#10b981]' : 'bg-[#71717a]'
                }`}>
                  {emp.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${textPrimary}`}>{emp.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${
                      emp.status === 'present' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {emp.status === 'present' ? 'Present' : 'Absent'}
                    </Badge>
                    {emp.work_location && (
                      <Badge className={`text-xs ${
                        emp.work_location === 'home' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {emp.work_location === 'home' ? 'WFH' : 'Office'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============== EMPLOYEES TAB ==============
function EmployeesTab({ employees, searchQuery, setSearchQuery, onEdit, onDelete, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  // Calculate employee stats - active employees only
  const activeEmployees = employees.filter(e => e.status !== 'inactive');
  const officeEmployees = activeEmployees.filter(e => e.today_attendance && e.today_attendance.work_location !== 'home');
  const remoteEmployees = activeEmployees.filter(e => e.today_attendance && e.today_attendance.work_location === 'home');
  
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${textSecondary}`}>Total Employees</p>
                <p className={`text-3xl font-bold ${textPrimary}`}>{activeEmployees.length}</p>
                <p className={`text-xs ${textSecondary}`}>Active only</p>
              </div>
              <Users className="h-10 w-10 text-[#6366f1]" />
            </div>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${textSecondary}`}>Office</p>
                <p className={`text-3xl font-bold text-[#22c55e]`}>{officeEmployees.length}</p>
                <p className={`text-xs ${textSecondary}`}>Working from office</p>
              </div>
              <Building className="h-10 w-10 text-[#22c55e]" />
            </div>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${textSecondary}`}>Remote</p>
                <p className={`text-3xl font-bold text-[#8b5cf6]`}>{remoteEmployees.length}</p>
                <p className={`text-xs ${textSecondary}`}>Working from home</p>
              </div>
              <Home className="h-10 w-10 text-[#8b5cf6]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-10 ${bgSecondary} border ${borderColor} ${textPrimary}`}
          />
        </div>
      </div>

      {/* Employees List View */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader className="pb-2">
          <CardTitle className={`${textPrimary} flex items-center gap-2`}>
            <ClipboardList className="h-5 w-5" />
            Employees List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Employee</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Role</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Department</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Work Mode</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.filter(e => 
                  e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  e.email?.toLowerCase().includes(searchQuery.toLowerCase())
                ).map((emp) => (
                  <tr key={emp.user_id} className={`border-b ${borderColor} hover:${bgSecondary}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold">
                          {emp.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-medium ${textPrimary}`}>{emp.name}</p>
                          <p className={`text-xs ${textSecondary}`}>{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{emp.role}</Badge>
                    </td>
                    <td className={`px-4 py-3 ${textPrimary}`}>{emp.profile?.department || '-'}</td>
                    <td className="px-4 py-3">
                      {emp.today_attendance ? (
                        <Badge className={emp.today_attendance.work_location === 'home' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}>
                          {emp.today_attendance.work_location === 'home' ? 'Remote' : 'Office'}
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-500/20 text-gray-400">-</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={emp.status === 'inactive' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}>
                        {emp.status === 'inactive' ? 'Inactive' : 'Active'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => onEdit(emp)}
                          className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {emp.role !== 'super_admin' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteConfirm(emp)}
                            className="text-[#ef4444] border-[#ef4444] hover:bg-[#ef4444] hover:text-white"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`${bgCard} w-full max-w-md`}>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>Delete Employee?</h3>
                <p className={`${textSecondary} mb-4`}>
                  Are you sure you want to delete <span className="font-semibold text-[#ef4444]">{deleteConfirm.name}</span>?
                </p>
                <p className={`text-sm ${textSecondary} mb-6`}>
                  This will deactivate the employee account. Their data will be preserved.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm(null)}
                    className={`${textSecondary}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      onDelete(deleteConfirm.user_id);
                      setDeleteConfirm(null);
                    }}
                    className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============== LEAVE REQUESTS TAB ==============
function LeaveRequestsTab({ requests, filter, setFilter, onApprove, onReject, onViewTasks, onSendForVerification, onFinalApprove, formatDate, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [leaveTasks, setLeaveTasks] = useState(null);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const handleViewTasksClick = async (leaveId) => {
    setLoadingTasks(true);
    const data = await onViewTasks(leaveId);
    if (data) {
      setLeaveTasks(data);
      setSelectedLeave(leaveId);
      setShowTasksModal(true);
    }
    setLoadingTasks(false);
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      pending_verification: 'bg-purple-500/20 text-purple-400',
      verified_pending_approval: 'bg-blue-500/20 text-blue-400',
      verification_rejected: 'bg-orange-500/20 text-orange-400',
      approved: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400'
    };
    const statusLabels = {
      pending: 'Pending',
      pending_verification: 'Awaiting Verification',
      verified_pending_approval: 'Verified - Pending Approval',
      verification_rejected: 'Verification Rejected',
      approved: 'Approved',
      rejected: 'Rejected'
    };
    return (
      <Badge className={statusStyles[status] || 'bg-gray-500/20 text-gray-400'}>
        {statusLabels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['pending', 'pending_verification', 'verified_pending_approval', 'approved', 'rejected', 'all'].map((f) => (
          <Button
            key={f}
            onClick={() => setFilter(f)}
            size="sm"
            className={`${
              filter === f
                ? 'bg-[#6366f1] text-white'
                : `${bgSecondary} ${textSecondary} hover:bg-[#3f3f46]`
            }`}
          >
            {f === 'pending_verification' ? 'Verification' : 
             f === 'verified_pending_approval' ? 'Verified' : 
             f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {requests.map((req) => (
          <Card key={req.leave_id} className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full bg-[#6366f1] flex items-center justify-center text-white font-bold">
                      {req.user_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-semibold ${textPrimary}`}>{req.user_name}</p>
                      <p className={`text-xs ${textSecondary}`}>{req.user_email}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className={`text-xs ${textSecondary}`}>Type</p>
                      <Badge className={`${
                        req.leave_type === 'wfh' ? 'bg-purple-500/20 text-purple-400' :
                        req.leave_type === 'casual' ? 'bg-blue-500/20 text-blue-400' :
                        req.leave_type === 'sick' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {req.leave_type?.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <p className={`text-xs ${textSecondary}`}>Duration</p>
                      <p className={`text-sm ${textPrimary}`}>{formatDate(req.start_date)} - {formatDate(req.end_date)}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${textSecondary}`}>Reason</p>
                      <p className={`text-sm ${textPrimary}`}>{req.reason}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${textSecondary}`}>Status</p>
                      {getStatusBadge(req.status)}
                    </div>
                  </div>

                  {/* Verification info */}
                  {req.verified_by_name && (
                    <div className={`mt-3 p-2 rounded ${bgSecondary}`}>
                      <p className={`text-xs ${textSecondary}`}>
                        Verified by: <span className={textPrimary}>{req.verified_by_name}</span>
                        {req.verification_remarks && ` - "${req.verification_remarks}"`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* View Tasks button - always visible for pending statuses */}
                  {['pending', 'pending_verification', 'verified_pending_approval'].includes(req.status) && (
                    <Button
                      onClick={() => handleViewTasksClick(req.leave_id)}
                      disabled={loadingTasks}
                      className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
                      size="sm"
                    >
                      <Briefcase className="mr-1 h-4 w-4" />
                      View Tasks
                    </Button>
                  )}

                  {/* Pending: Send for verification or Direct approve/reject */}
                  {req.status === 'pending' && (
                    <>
                      <Button
                        onClick={() => onSendForVerification(req.leave_id)}
                        className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white"
                        size="sm"
                      >
                        <Send className="mr-1 h-4 w-4" />
                        Send for Verification
                      </Button>
                      <Button
                        onClick={() => onApprove(req.leave_id)}
                        className="bg-[#10b981] hover:bg-[#059669] text-white"
                        size="sm"
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Quick Approve
                      </Button>
                      <Button
                        onClick={() => onReject(req.leave_id)}
                        className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
                        size="sm"
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}

                  {/* Verified pending approval: Final approve/reject */}
                  {req.status === 'verified_pending_approval' && (
                    <>
                      <Button
                        onClick={() => onFinalApprove(req.leave_id)}
                        className="bg-[#10b981] hover:bg-[#059669] text-white"
                        size="sm"
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Final Approve
                      </Button>
                      <Button
                        onClick={() => onReject(req.leave_id)}
                        className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
                        size="sm"
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {requests.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-[#3f3f46] mx-auto mb-4" />
            <p className={textSecondary}>No {filter !== 'all' ? filter.replace('_', ' ') : ''} leave requests</p>
          </div>
        )}
      </div>

      {/* Tasks Modal */}
      {showTasksModal && leaveTasks && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`${bgCard} border ${borderColor} w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col`}>
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={textPrimary}>Tasks During Leave Period</CardTitle>
                  <p className={`text-sm ${textSecondary} mt-1`}>
                    {leaveTasks.user_name} | {leaveTasks.leave_dates?.start} to {leaveTasks.leave_dates?.end}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setShowTasksModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {leaveTasks.tasks_count === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-[#10b981] mx-auto mb-4" />
                  <p className={textPrimary}>No pending tasks during this period</p>
                  <p className={`text-sm ${textSecondary}`}>Leave can be approved safely</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className={`p-3 rounded ${bgSecondary} mb-4`}>
                    <p className={`text-sm ${textPrimary}`}>
                      <AlertTriangle className="h-4 w-4 inline mr-2 text-[#f59e0b]" />
                      {leaveTasks.tasks_count} pending task(s) found that need attention
                    </p>
                  </div>
                  {leaveTasks.tasks?.map((task) => (
                    <div key={task.task_id} className={`p-3 rounded border ${borderColor}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className={`font-medium ${textPrimary}`}>{task.task_name}</p>
                          <p className={`text-xs ${textSecondary} mt-1`}>
                            Due: {task.due_date} | Priority: {task.priority || 'Normal'}
                          </p>
                          {task.description && (
                            <p className={`text-sm ${textSecondary} mt-2`}>{task.description}</p>
                          )}
                        </div>
                        <Badge className={`${
                          task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============== ATTENDANCE TAB ==============
function AttendanceTab({ overview, formatTime, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  return (
    <Card className={`${bgCard} border ${borderColor}`}>
      <CardHeader>
        <CardTitle className={textPrimary}>Today's Attendance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${borderColor}`}>
                <th className={`text-left py-3 px-4 text-xs font-medium ${textSecondary}`}>EMPLOYEE</th>
                <th className={`text-left py-3 px-4 text-xs font-medium ${textSecondary}`}>STATUS</th>
                <th className={`text-left py-3 px-4 text-xs font-medium ${textSecondary}`}>CLOCK IN</th>
                <th className={`text-left py-3 px-4 text-xs font-medium ${textSecondary}`}>CLOCK OUT</th>
                <th className={`text-left py-3 px-4 text-xs font-medium ${textSecondary}`}>LOCATION</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((emp) => (
                <tr key={emp.user_id} className={`border-b ${borderColor}/50`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        emp.status === 'present' ? 'bg-[#10b981]' : 'bg-[#71717a]'
                      }`}>
                        {emp.name?.charAt(0).toUpperCase()}
                      </div>
                      <span className={textPrimary}>{emp.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge className={emp.status === 'present' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                      {emp.status === 'present' ? 'Present' : 'Absent'}
                    </Badge>
                  </td>
                  <td className={`py-3 px-4 text-sm ${textPrimary}`}>{formatTime(emp.clock_in)}</td>
                  <td className={`py-3 px-4 text-sm ${textPrimary}`}>{formatTime(emp.clock_out)}</td>
                  <td className="py-3 px-4">
                    {emp.work_location ? (
                      <Badge className={emp.work_location === 'home' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}>
                        {emp.work_location === 'home' ? 'WFH' : 'Office'}
                      </Badge>
                    ) : (
                      <span className={textSecondary}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============== EDIT EMPLOYEE MODAL ==============
function EditEmployeeModal({ employee, onClose, onSave, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(employee.profile?.profile_picture || employee.picture || '');
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    // Basic Details
    full_name: employee.profile?.full_name || employee.name || '',
    email: employee.profile?.email || employee.email || '',
    phone: employee.profile?.phone || '',
    date_of_birth: employee.profile?.date_of_birth ? employee.profile.date_of_birth.split('T')[0] : '',
    gender: employee.profile?.gender || '',
    blood_group: employee.profile?.blood_group || '',
    profile_picture: employee.profile?.profile_picture || employee.picture || '',
    // Account Details
    account_holder_name: employee.profile?.account_holder_name || '',
    bank_name: employee.profile?.bank_name || '',
    branch: employee.profile?.branch || '',
    account_number: employee.profile?.account_number || '',
    ifsc_code: employee.profile?.ifsc_code || '',
    upi_id: employee.profile?.upi_id || '',
    pan_number: employee.profile?.pan_number || '',
    aadhar_number: employee.profile?.aadhar_number || '',
    // Employment Details
    employee_id: employee.profile?.employee_id || '',
    designation: employee.profile?.designation || employee.role || '',
    department: employee.profile?.department || '',
    employment_type: employee.profile?.employment_type || 'full-time',
    joining_date: employee.profile?.joining_date ? employee.profile.joining_date.split('T')[0] : '',
    reporting_manager: employee.profile?.reporting_manager || '',
    work_location: employee.profile?.work_location || 'office',
    // Emergency Contact
    emergency_contact_name: employee.profile?.emergency_contact_name || '',
    emergency_contact_phone: employee.profile?.emergency_contact_phone || '',
    emergency_contact_relation: employee.profile?.emergency_contact_relation || '',
    // Address
    address: employee.profile?.address || '',
    city: employee.profile?.city || '',
    state: employee.profile?.state || '',
    pincode: employee.profile?.pincode || '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }
    
    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePhotoPreview(reader.result);
      handleChange('profile_picture', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const tabConfig = [
    { id: 'basic', label: 'Basic Details', icon: Users },
    { id: 'account', label: 'Account Details', icon: CreditCard },
    { id: 'employment', label: 'Employment', icon: Briefcase },
    { id: 'address', label: 'Address & Emergency', icon: Home },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className={`${bgCard} border ${borderColor} w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className={`flex items-center gap-3 ${textPrimary}`}>
            <Edit className="h-5 w-5 text-[#6366f1]" />
            Edit Employee Profile
          </CardTitle>
          <Button variant="ghost" onClick={onClose} className={textSecondary}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        
        {/* Profile Photo Section */}
        <div className={`px-6 pb-4 flex items-center gap-6 border-b ${borderColor}`}>
          <div className="relative">
            <div className="h-20 w-20 rounded-full overflow-hidden bg-[#27272a] border-2 border-[#6366f1]">
              {profilePhotoPreview ? (
                <img src={profilePhotoPreview} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-[#6366f1]">
                  {formData.full_name?.charAt(0)?.toUpperCase() || 'E'}
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-1 bg-[#6366f1] rounded-full cursor-pointer hover:bg-[#4f46e5] transition-colors">
              <Plus className="h-4 w-4 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                data-testid="profile-photo-input"
              />
            </label>
          </div>
          <div>
            <p className={`font-medium ${textPrimary}`}>{formData.full_name || 'Employee Name'}</p>
            <p className={`text-sm ${textSecondary}`}>{formData.designation || 'No designation'}</p>
            <p className="text-xs text-[#6366f1]">Click + to upload profile photo</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#3f3f46] px-6 overflow-x-auto">
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#6366f1] text-[#6366f1]'
                    : `border-transparent ${textSecondary} hover:text-[#fafafa]`
                }`}
                data-testid={`edit-employee-tab-${tab.id}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit}>
            {/* Basic Details Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Full Name *</Label>
                    <Input
                      value={formData.full_name}
                      onChange={(e) => handleChange('full_name', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Date of Birth</Label>
                    <Input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => handleChange('date_of_birth', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Gender</Label>
                    <Select value={formData.gender} onValueChange={(v) => handleChange('gender', v)}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent className={`${bgCard} border ${borderColor}`}>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={textPrimary}>Blood Group</Label>
                    <Select value={formData.blood_group} onValueChange={(v) => handleChange('blood_group', v)}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                        <SelectValue placeholder="Select blood group" />
                      </SelectTrigger>
                      <SelectContent className={`${bgCard} border ${borderColor}`}>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                          <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Account Details Tab */}
            {activeTab === 'account' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Account Holder Name</Label>
                    <Input
                      value={formData.account_holder_name}
                      onChange={(e) => handleChange('account_holder_name', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Bank Name</Label>
                    <Input
                      value={formData.bank_name}
                      onChange={(e) => handleChange('bank_name', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Branch</Label>
                    <Input
                      value={formData.branch}
                      onChange={(e) => handleChange('branch', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Account Number</Label>
                    <Input
                      value={formData.account_number}
                      onChange={(e) => handleChange('account_number', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>IFSC Code</Label>
                    <Input
                      value={formData.ifsc_code}
                      onChange={(e) => handleChange('ifsc_code', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>UPI ID</Label>
                    <Input
                      value={formData.upi_id}
                      onChange={(e) => handleChange('upi_id', e.target.value)}
                      placeholder="name@upi"
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>PAN Number</Label>
                    <Input
                      value={formData.pan_number}
                      onChange={(e) => handleChange('pan_number', e.target.value.toUpperCase())}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Aadhar Number</Label>
                    <Input
                      value={formData.aadhar_number}
                      onChange={(e) => handleChange('aadhar_number', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Employment Tab */}
            {activeTab === 'employment' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Employee ID</Label>
                    <Input
                      value={formData.employee_id}
                      onChange={(e) => handleChange('employee_id', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Designation</Label>
                    <Input
                      value={formData.designation}
                      onChange={(e) => handleChange('designation', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Department</Label>
                    <Input
                      value={formData.department}
                      onChange={(e) => handleChange('department', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Employment Type</Label>
                    <Select value={formData.employment_type} onValueChange={(v) => handleChange('employment_type', v)}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className={`${bgCard} border ${borderColor}`}>
                        <SelectItem value="full-time">Full Time</SelectItem>
                        <SelectItem value="part-time">Part Time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={textPrimary}>Joining Date</Label>
                    <Input
                      type="date"
                      value={formData.joining_date}
                      onChange={(e) => handleChange('joining_date', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Reporting Manager</Label>
                    <Input
                      value={formData.reporting_manager}
                      onChange={(e) => handleChange('reporting_manager', e.target.value)}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Work Location</Label>
                    <Select value={formData.work_location} onValueChange={(v) => handleChange('work_location', v)}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent className={`${bgCard} border ${borderColor}`}>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Address & Emergency Tab */}
            {activeTab === 'address' && (
              <div className="space-y-6">
                <div>
                  <h4 className={`font-medium ${textPrimary} mb-3`}>Address</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label className={textSecondary}>Street Address</Label>
                      <Input
                        value={formData.address}
                        onChange={(e) => handleChange('address', e.target.value)}
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textSecondary}>City</Label>
                      <Input
                        value={formData.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textSecondary}>State</Label>
                      <Input
                        value={formData.state}
                        onChange={(e) => handleChange('state', e.target.value)}
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textSecondary}>Pincode</Label>
                      <Input
                        value={formData.pincode}
                        onChange={(e) => handleChange('pincode', e.target.value)}
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className={`font-medium ${textPrimary} mb-3`}>Emergency Contact</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className={textSecondary}>Name</Label>
                      <Input
                        value={formData.emergency_contact_name}
                        onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textSecondary}>Phone</Label>
                      <Input
                        value={formData.emergency_contact_phone}
                        onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textSecondary}>Relation</Label>
                      <Input
                        value={formData.emergency_contact_relation}
                        onChange={(e) => handleChange('emergency_contact_relation', e.target.value)}
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Actions */}
        <div className={`flex gap-3 p-6 border-t ${borderColor}`}>
          <Button
            type="button"
            onClick={onClose}
            className={`flex-1 ${bgSecondary} hover:bg-[#3f3f46] ${textPrimary}`}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="save-employee-btn"
          >
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ============== APPROVALS TAB ==============
function ApprovalsTab({ pendingApprovals, onApproveAttendance, onApprovePermission, onApproveLeave, onRejectLeave, formatDate, formatTime, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const { attendance = [], permissions = [], leaves = [] } = pendingApprovals;
  const totalPending = attendance.length + permissions.length + leaves.length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary}`}>Attendance Approvals</p>
          <p className="text-2xl font-bold text-[#f59e0b]">{attendance.length}</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary}`}>Permission Requests</p>
          <p className="text-2xl font-bold text-[#8b5cf6]">{permissions.length}</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary}`}>Leave Requests</p>
          <p className="text-2xl font-bold text-[#3b82f6]">{leaves.length}</p>
        </Card>
      </div>

      {/* Attendance Approvals */}
      {attendance.length > 0 && (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardHeader>
            <CardTitle className={`${textPrimary} flex items-center gap-2`}>
              <Clock className="h-5 w-5 text-[#f59e0b]" />
              Attendance Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {attendance.map((att) => (
                <div key={att.attendance_id} className={`flex items-center justify-between p-4 ${bgSecondary} rounded-lg`}>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-[#f59e0b] flex items-center justify-center text-white font-bold">
                      {att.user_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{att.user_name}</p>
                      <p className={`text-xs ${textSecondary}`}>{formatDate(att.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={`${
                      att.approval_status === 'pending_early_login' 
                        ? 'bg-yellow-500/20 text-yellow-400' 
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {att.approval_status === 'pending_early_login' ? 'Early Login' : 'Early Logout'}
                    </Badge>
                    <div className={`text-sm ${textSecondary}`}>
                      {formatTime(att.clock_in)} - {formatTime(att.clock_out) || 'Not yet'}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => onApproveAttendance(att.attendance_id, 'approve')} className="bg-[#10b981] hover:bg-[#059669] text-white">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button onClick={() => onApproveAttendance(att.attendance_id, 'reject')} className="bg-[#ef4444] hover:bg-[#dc2626] text-white">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permission Requests */}
      {permissions.length > 0 && (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardHeader>
            <CardTitle className={`${textPrimary} flex items-center gap-2`}>
              <AlertCircle className="h-5 w-5 text-[#8b5cf6]" />
              Permission Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {permissions.map((perm) => (
                <div key={perm.permission_id} className={`flex items-center justify-between p-4 ${bgSecondary} rounded-lg`}>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-[#8b5cf6] flex items-center justify-center text-white font-bold">
                      {perm.user_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{perm.user_name}</p>
                      <p className={`text-xs ${textSecondary}`}>{formatDate(perm.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className="bg-[#8b5cf6]/20 text-[#8b5cf6]">
                      {perm.hours_requested} hours
                    </Badge>
                    <p className={`text-sm ${textSecondary} max-w-xs truncate`}>{perm.reason}</p>
                    <div className="flex gap-2">
                      <Button onClick={() => onApprovePermission(perm.permission_id, 'approve')} className="bg-[#10b981] hover:bg-[#059669] text-white">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button onClick={() => onApprovePermission(perm.permission_id, 'reject')} className="bg-[#ef4444] hover:bg-[#dc2626] text-white">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leave Requests */}
      {leaves.length > 0 && (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardHeader>
            <CardTitle className={`${textPrimary} flex items-center gap-2`}>
              <Calendar className="h-5 w-5 text-[#3b82f6]" />
              Leave Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaves.map((leave) => (
                <div key={leave.leave_id} className={`flex items-center justify-between p-4 ${bgSecondary} rounded-lg`}>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-[#3b82f6] flex items-center justify-center text-white font-bold">
                      {leave.user_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{leave.user_name}</p>
                      <p className={`text-xs ${textSecondary}`}>{formatDate(leave.start_date)} - {formatDate(leave.end_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className="bg-[#3b82f6]/20 text-[#3b82f6]">
                      {leave.leave_type?.toUpperCase()}
                    </Badge>
                    <p className={`text-sm ${textSecondary} max-w-xs truncate`}>{leave.reason}</p>
                    <div className="flex gap-2">
                      <Button onClick={() => onApproveLeave(leave.leave_id)} className="bg-[#10b981] hover:bg-[#059669] text-white">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button onClick={() => onRejectLeave(leave.leave_id)} className="bg-[#ef4444] hover:bg-[#dc2626] text-white">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {totalPending === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="h-12 w-12 text-[#10b981] mx-auto mb-4" />
          <p className={textPrimary}>All caught up!</p>
          <p className={textSecondary}>No pending approvals</p>
        </div>
      )}
    </div>
  );
}

// ============== ALL ATTENDANCE TAB ==============
function AllAttendanceTab({ records, month, year, setMonth, setYear, onRefresh, formatDate, formatTime, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div>
              <Label className={textSecondary}>Month</Label>
              <select 
                value={month}
                onChange={(e) => { setMonth(parseInt(e.target.value)); }}
                className={`w-40 p-2 rounded ${bgSecondary} border ${borderColor} ${textPrimary}`}
              >
                {months.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className={textSecondary}>Year</Label>
              <select 
                value={year}
                onChange={(e) => { setYear(parseInt(e.target.value)); }}
                className={`w-32 p-2 rounded ${bgSecondary} border ${borderColor} ${textPrimary}`}
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <Button onClick={onRefresh} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white mt-5">
              Load Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>All Employees Attendance - {months[month - 1]} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Employee</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Date</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Login</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Logout</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Lunch</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Permission</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Work Hrs</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Extra</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, idx) => (
                  <tr key={idx} className={`border-b ${borderColor} hover:${bgSecondary}`}>
                    <td className={`p-3 ${textPrimary}`}>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs font-bold">
                          {record.employee_name?.charAt(0) || record.user_name?.charAt(0) || '?'}
                        </div>
                        {record.employee_name || record.user_name}
                      </div>
                    </td>
                    <td className={`p-3 ${textPrimary}`}>{formatDate(record.date)}</td>
                    <td className={`p-3 ${textPrimary}`}>{formatTime(record.clock_in)}</td>
                    <td className={`p-3 ${textPrimary}`}>{formatTime(record.clock_out)}</td>
                    <td className={`p-3 ${textSecondary}`}>{record.lunch_duration ? `${record.lunch_duration}m` : '-'}</td>
                    <td className={`p-3 ${textSecondary}`}>{record.permission_hours ? `${record.permission_hours}h` : '-'}</td>
                    <td className={`p-3 font-medium ${textPrimary}`}>{record.total_hours?.toFixed(2) || '-'}</td>
                    <td className={`p-3 font-medium text-[#10b981]`}>{record.extra_hours?.toFixed(2) || '-'}</td>
                    <td className="p-3">
                      <Badge className={`${
                        record.approval_status === 'approved' || record.approval_status === 'auto' 
                          ? 'bg-green-500/20 text-green-400' 
                          : record.approval_status?.includes('pending')
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {record.approval_status === 'auto' ? 'OK' : record.approval_status || 'N/A'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={9} className={`p-8 text-center ${textSecondary}`}>
                      No attendance records found for this month
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============== CALENDAR TAB ==============
function CalendarTab({ calendar, month, year, setMonth, setYear, onUpdate, onRefresh, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
  const [workingDays, setWorkingDays] = useState(22);
  const [monthlyCasualLeave, setMonthlyCasualLeave] = useState(2);
  const [monthlySickLeave, setMonthlySickLeave] = useState(2);
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Check if the selected month is in the past (read-only)
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const isPastMonth = (year < currentYear) || (year === currentYear && month < currentMonth);
  const isCurrentMonth = year === currentYear && month === currentMonth;

  useEffect(() => {
    if (calendar) {
      setHolidays(calendar.holidays || []);
      setWorkingDays(calendar.working_days || 22);
      setMonthlyCasualLeave(calendar.monthly_casual_leave || 2);
      setMonthlySickLeave(calendar.monthly_sick_leave || 2);
    }
  }, [calendar]);

  const handleAddHoliday = () => {
    if (isPastMonth) return;
    if (newHoliday.date && newHoliday.name) {
      setHolidays([...holidays, newHoliday]);
      setNewHoliday({ date: '', name: '' });
    }
  };

  const handleRemoveHoliday = (index) => {
    if (isPastMonth) return;
    setHolidays(holidays.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (isPastMonth) return;
    onUpdate({ 
      holidays, 
      working_days: workingDays,
      monthly_casual_leave: monthlyCasualLeave,
      monthly_sick_leave: monthlySickLeave
    });
  };

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <Label className={textSecondary}>Month</Label>
              <select 
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className={`w-40 p-2 rounded ${bgSecondary} border ${borderColor} ${textPrimary}`}
              >
                {months.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className={textSecondary}>Year</Label>
              <select 
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className={`w-32 p-2 rounded ${bgSecondary} border ${borderColor} ${textPrimary}`}
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <Button onClick={onRefresh} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white mt-5">
              Load
            </Button>
            {isPastMonth && (
              <span className="text-yellow-500 text-sm mt-5 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                View Only (Past Month)
              </span>
            )}
            {isCurrentMonth && (
              <span className="text-green-500 text-sm mt-5">Current Month - Editable</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Working Days */}
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardHeader>
            <CardTitle className={textPrimary}>Working Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className={textSecondary}>Total Working Days in {months[month - 1]}</Label>
                <Input 
                  type="number"
                  value={workingDays}
                  onChange={(e) => !isPastMonth && setWorkingDays(parseInt(e.target.value))}
                  disabled={isPastMonth}
                  className={`w-32 ${bgSecondary} border ${borderColor} ${textPrimary} ${isPastMonth ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Holidays */}
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardHeader>
            <CardTitle className={textPrimary}>Holidays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Add Holiday - only show for current/future months */}
              {!isPastMonth && (
                <div className="flex gap-2">
                  <Input 
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                  <Input 
                    placeholder="Holiday name"
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday({...newHoliday, name: e.target.value})}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                  <Button onClick={handleAddHoliday} className="bg-[#10b981] hover:bg-[#059669] text-white">
                    Add
                  </Button>
                </div>
              )}
              
              {/* Holiday List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {holidays.map((h, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-2 ${bgSecondary} rounded`}>
                    <div>
                      <span className={textPrimary}>{h.name}</span>
                      <span className={`ml-2 text-sm ${textSecondary}`}>({h.date})</span>
                    </div>
                    {!isPastMonth && (
                      <Button variant="ghost" onClick={() => handleRemoveHoliday(idx)} className="text-red-400 hover:text-red-300">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {holidays.length === 0 && (
                  <p className={`text-center py-4 ${textSecondary}`}>No holidays added</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Leave Allocation */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Monthly Leave Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-sm ${textSecondary} mb-4`}>
            Configure the number of casual and sick leaves allocated per employee for {months[month - 1]} {year}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className={textSecondary}>Casual Leave (per month)</Label>
              <Input 
                type="number"
                min="0"
                max="10"
                value={monthlyCasualLeave}
                onChange={(e) => !isPastMonth && setMonthlyCasualLeave(parseInt(e.target.value) || 0)}
                disabled={isPastMonth}
                className={`w-32 ${bgSecondary} border ${borderColor} ${textPrimary} ${isPastMonth ? 'opacity-60 cursor-not-allowed' : ''}`}
                data-testid="monthly-casual-leave-input"
              />
            </div>
            <div>
              <Label className={textSecondary}>Sick Leave (per month)</Label>
              <Input 
                type="number"
                min="0"
                max="10"
                value={monthlySickLeave}
                onChange={(e) => !isPastMonth && setMonthlySickLeave(parseInt(e.target.value) || 0)}
                disabled={isPastMonth}
                className={`w-32 ${bgSecondary} border ${borderColor} ${textPrimary} ${isPastMonth ? 'opacity-60 cursor-not-allowed' : ''}`}
                data-testid="monthly-sick-leave-input"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button - only show for current/future months */}
      {!isPastMonth && (
        <div className="flex justify-end">
          <Button onClick={handleSave} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-8">
            Save Calendar
          </Button>
        </div>
      )}
    </div>
  );
}

// ============== PAYSLIPS TAB ==============
function PayslipsTab({ payslips, employees, month, year, setMonth, setYear, onGenerate, onAction, onRefresh, formatDate, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/20 text-gray-400';
      case 'pending_super_admin': return 'bg-yellow-500/20 text-yellow-400';
      case 'approved': return 'bg-blue-500/20 text-blue-400';
      case 'acknowledged': return 'bg-purple-500/20 text-purple-400';
      case 'pending_finance': return 'bg-orange-500/20 text-orange-400';
      case 'payment_released': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getNextAction = (status) => {
    switch (status) {
      case 'draft': return { action: 'submit', label: 'Submit for Approval', color: 'bg-[#f59e0b]' };
      case 'pending_super_admin': return { action: 'approve', label: 'Approve', color: 'bg-[#10b981]' };
      case 'approved': return null; // Wait for employee
      case 'acknowledged': return { action: 'send-to-finance', label: 'Send to Finance', color: 'bg-[#8b5cf6]' };
      case 'pending_finance': return { action: 'release', label: 'Release Payment', color: 'bg-[#10b981]' };
      default: return null;
    }
  };

  const handleGenerate = async () => {
    if (selectedEmployee) {
      await onGenerate(selectedEmployee);
      setShowGenerateModal(false);
      setSelectedEmployee('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters & Generate */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <Label className={textSecondary}>Month</Label>
                <select 
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className={`w-40 p-2 rounded ${bgSecondary} border ${borderColor} ${textPrimary}`}
                >
                  {months.map((m, idx) => (
                    <option key={idx} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className={textSecondary}>Year</Label>
                <select 
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className={`w-32 p-2 rounded ${bgSecondary} border ${borderColor} ${textPrimary}`}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <Button onClick={onRefresh} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white mt-5">
                Load
              </Button>
            </div>
            <Button onClick={() => setShowGenerateModal(true)} className="bg-[#10b981] hover:bg-[#059669] text-white">
              <FileText className="h-4 w-4 mr-2" />
              Generate Payslip
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payslips Table */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Payslips - {months[month - 1]} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Employee</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Days Present</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Gross</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Deductions</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Net Salary</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Status</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((payslip) => {
                  const nextAction = getNextAction(payslip.status);
                  return (
                    <tr key={payslip.payslip_id} className={`border-b ${borderColor} hover:${bgSecondary}`}>
                      <td className={`p-3 ${textPrimary}`}>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs font-bold">
                            {payslip.employee_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{payslip.employee_name}</p>
                            <p className={`text-xs ${textSecondary}`}>{payslip.designation}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`p-3 ${textPrimary}`}>
                        {payslip.days_present}/{payslip.total_working_days}
                      </td>
                      <td className={`p-3 ${textPrimary}`}>₹{payslip.gross_salary?.toLocaleString()}</td>
                      <td className={`p-3 text-red-400`}>
                        ₹{(payslip.pf_deduction + payslip.esi_deduction + payslip.professional_tax + payslip.other_deductions).toLocaleString()}
                      </td>
                      <td className={`p-3 font-bold text-[#10b981]`}>₹{payslip.net_salary?.toLocaleString()}</td>
                      <td className="p-3">
                        <Badge className={getStatusColor(payslip.status)}>
                          {payslip.status?.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {nextAction && (
                          <Button 
                            onClick={() => onAction(payslip.payslip_id, nextAction.action)}
                            className={`${nextAction.color} hover:opacity-80 text-white text-xs`}
                          >
                            {nextAction.label}
                          </Button>
                        )}
                        {payslip.status === 'approved' && (
                          <span className={`text-xs ${textSecondary}`}>Waiting for employee</span>
                        )}
                        {payslip.status === 'payment_released' && (
                          <span className="text-xs text-[#10b981]">✓ Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {payslips.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`p-8 text-center ${textSecondary}`}>
                      No payslips generated for this month yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={textPrimary}>Generate Payslip</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className={textSecondary}>Select Employee</Label>
                <select 
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className={`w-full p-2 rounded ${bgSecondary} border ${borderColor} ${textPrimary}`}
                >
                  <option value="">Select an employee</option>
                  {employees.map((emp) => (
                    <option key={emp.user_id} value={emp.user_id}>
                      {emp.name} - {emp.email}
                    </option>
                  ))}
                </select>
              </div>
              <p className={textSecondary}>
                Generate payslip for <strong>{months[month - 1]} {year}</strong>
              </p>
              <div className="flex gap-3 pt-4">
                <Button onClick={() => setShowGenerateModal(false)} className={`flex-1 ${bgSecondary} ${textPrimary}`}>
                  Cancel
                </Button>
                <Button onClick={handleGenerate} className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white" disabled={!selectedEmployee}>
                  Generate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============== WORK SETTINGS TAB ==============
function WorkSettingsTab({ settings, onUpdate, onRefresh, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [formData, setFormData] = useState({
    standard_work_hours: 9,
    standard_login_time: '09:00',
    standard_logout_time: '18:00',
    early_login_threshold_minutes: 60,
    grace_period_minutes: 15,
    default_lunch_duration: 60,
    overtime_rate_multiplier: 1.5
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        standard_work_hours: settings.standard_work_hours || 9,
        standard_login_time: settings.standard_login_time || '09:00',
        standard_logout_time: settings.standard_logout_time || '18:00',
        early_login_threshold_minutes: settings.early_login_threshold_minutes || 60,
        grace_period_minutes: settings.grace_period_minutes || 15,
        default_lunch_duration: settings.default_lunch_duration || 60,
        overtime_rate_multiplier: settings.overtime_rate_multiplier || 1.5
      });
    }
  }, [settings]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(formData);
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className={`text-xl font-semibold ${textPrimary}`}>Work Time Settings</h2>
          <p className={`text-sm ${textSecondary}`}>Configure standard work hours, login/logout times, and approval thresholds</p>
        </div>
        <Button onClick={onRefresh} variant="outline" className={`${borderColor}`}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Standard Work Hours */}
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
              <Clock className="h-5 w-5 text-[#6366f1]" />
              Work Hours Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={textPrimary}>Standard Work Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.standard_work_hours}
                  onChange={(e) => handleChange('standard_work_hours', parseFloat(e.target.value))}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                />
                <p className={`text-xs mt-1 ${textSecondary}`}>Hours per day (e.g., 9)</p>
              </div>
              <div>
                <Label className={textPrimary}>Default Lunch Duration</Label>
                <Input
                  type="number"
                  value={formData.default_lunch_duration}
                  onChange={(e) => handleChange('default_lunch_duration', parseInt(e.target.value))}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                />
                <p className={`text-xs mt-1 ${textSecondary}`}>Minutes (e.g., 60)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={textPrimary}>Standard Login Time</Label>
                <Input
                  type="time"
                  value={formData.standard_login_time}
                  onChange={(e) => handleChange('standard_login_time', e.target.value)}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                />
              </div>
              <div>
                <Label className={textPrimary}>Standard Logout Time</Label>
                <Input
                  type="time"
                  value={formData.standard_logout_time}
                  onChange={(e) => handleChange('standard_logout_time', e.target.value)}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Thresholds */}
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
              <AlertCircle className="h-5 w-5 text-[#f59e0b]" />
              Approval Thresholds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className={textPrimary}>Early Login Threshold</Label>
              <Input
                type="number"
                value={formData.early_login_threshold_minutes}
                onChange={(e) => handleChange('early_login_threshold_minutes', parseInt(e.target.value))}
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
              />
              <p className={`text-xs mt-1 ${textSecondary}`}>
                Minutes before standard login that triggers approval (e.g., 60 = 1 hour before)
              </p>
            </div>

            <div>
              <Label className={textPrimary}>Grace Period</Label>
              <Input
                type="number"
                value={formData.grace_period_minutes}
                onChange={(e) => handleChange('grace_period_minutes', parseInt(e.target.value))}
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
              />
              <p className={`text-xs mt-1 ${textSecondary}`}>
                Minutes of grace period for late login (e.g., 15)
              </p>
            </div>

            <div>
              <Label className={textPrimary}>Overtime Rate Multiplier</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.overtime_rate_multiplier}
                onChange={(e) => handleChange('overtime_rate_multiplier', parseFloat(e.target.value))}
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
              />
              <p className={`text-xs mt-1 ${textSecondary}`}>
                Extra hours pay multiplier (e.g., 1.5 = 1.5x)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-4">
          <div className={`p-4 rounded-lg ${bgSecondary}`}>
            <h4 className={`font-medium ${textPrimary} mb-2`}>How Approvals Work</h4>
            <ul className={`text-sm ${textSecondary} space-y-2`}>
              <li>• <strong>Early Login:</strong> If an employee clocks in more than {formData.early_login_threshold_minutes} minutes before {formData.standard_login_time}, it requires HR/Admin approval.</li>
              <li>• <strong>Early Logout:</strong> If an employee clocks out with less than {formData.standard_work_hours} hours worked (after deducting lunch), it requires HR/Admin approval.</li>
              <li>• <strong>Grace Period:</strong> Employees can clock in up to {formData.grace_period_minutes} minutes late without penalty.</li>
              <li>• <strong>Overtime:</strong> Hours worked beyond {formData.standard_work_hours} hours are calculated as extra hours, multiplied by {formData.overtime_rate_multiplier}x for payroll.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-8"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}



// ============ Enhanced Attendance Tab with Date Filters ============
function EnhancedAttendanceTab({ 
  records, employees, stats, month, year, setMonth, setYear, onRefresh, 
  formatDate, formatTime, bgCard, bgSecondary, textPrimary, textSecondary, borderColor, token 
}) {
  const [dateFilter, setDateFilter] = useState('day'); // day, range, month, year
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [employeeRecords, setEmployeeRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const API = process.env.REACT_APP_BACKEND_URL;

  // Get all employees with their attendance status for the selected date
  const getEmployeesWithStatus = () => {
    const today = selectedDate;
    const employeesWithStatus = employees.map(emp => {
      // Find attendance record for this employee on selected date
      const record = records.find(r => 
        r.user_id === emp.user_id && 
        r.date?.split('T')[0] === today
      );
      
      let status = 'yet_to_login';
      let checkIn = null;
      let checkOut = null;
      let workedHours = null;
      
      if (record) {
        checkIn = record.clock_in_time;
        checkOut = record.clock_out_time;
        if (checkOut) {
          status = 'present';
          // Calculate worked hours
          if (checkIn && checkOut) {
            const inTime = new Date(`2000-01-01T${checkIn}`);
            const outTime = new Date(`2000-01-01T${checkOut}`);
            workedHours = ((outTime - inTime) / (1000 * 60 * 60)).toFixed(1);
          }
        } else if (checkIn) {
          status = 'working';
        }
      }
      
      // Check leave/absent records
      const isAbsent = records.some(r => 
        r.user_id === emp.user_id && 
        r.date?.split('T')[0] === today && 
        r.leave_type
      );
      if (isAbsent) status = 'absent';
      
      return {
        ...emp,
        status,
        checkIn,
        checkOut,
        workedHours
      };
    });
    
    return employeesWithStatus.sort((a, b) => {
      const order = { 'present': 0, 'working': 1, 'yet_to_login': 2, 'absent': 3 };
      return order[a.status] - order[b.status];
    });
  };

  // Load detailed employee attendance records
  const loadEmployeeDetails = async (emp) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/hr/attendance/employee/${emp.user_id}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month, year }
      });
      setEmployeeRecords(res.data || []);
      setSelectedEmployee(emp);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to load employee records:', err);
      toast.error('Failed to load attendance details');
    }
    setLoading(false);
  };

  const employeesWithStatus = getEmployeesWithStatus();
  const presentCount = employeesWithStatus.filter(e => e.status === 'present' || e.status === 'working').length;
  const absentCount = employeesWithStatus.filter(e => e.status === 'absent').length;
  const yetToLoginCount = employeesWithStatus.filter(e => e.status === 'yet_to_login').length;
  
  // Calculate WFH count from records
  const wfhCount = records.filter(r => 
    r.date?.split('T')[0] === selectedDate && 
    r.work_location === 'home'
  ).length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'present': return <Badge className="bg-[#22c55e]/20 text-[#22c55e]">Present</Badge>;
      case 'working': return <Badge className="bg-[#3b82f6]/20 text-[#3b82f6]">Working</Badge>;
      case 'absent': return <Badge className="bg-[#ef4444]/20 text-[#ef4444]">Absent</Badge>;
      case 'yet_to_login': return <Badge className="bg-[#f59e0b]/20 text-[#f59e0b]">Yet to Login</Badge>;
      default: return <Badge className={bgSecondary}>Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Filters */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-2">
              {['day', 'range', 'month', 'year'].map(filter => (
                <Button
                  key={filter}
                  variant={dateFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter(filter)}
                  className={dateFilter === filter ? 'bg-[#6366f1]' : ''}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>
            
            {dateFilter === 'day' && (
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`w-48 ${bgSecondary} ${borderColor}`}
              />
            )}
            
            {dateFilter === 'range' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className={`w-40 ${bgSecondary} ${borderColor}`}
                />
                <span className={textSecondary}>to</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className={`w-40 ${bgSecondary} ${borderColor}`}
                />
              </div>
            )}
            
            {dateFilter === 'month' && (
              <div className="flex gap-2">
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className={`px-3 py-2 rounded-md ${bgSecondary} ${borderColor} ${textPrimary}`}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className={`w-24 ${bgSecondary} ${borderColor}`}
                  min="2020"
                  max="2030"
                />
              </div>
            )}
            
            {dateFilter === 'year' && (
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className={`w-24 ${bgSecondary} ${borderColor}`}
                min="2020"
                max="2030"
              />
            )}
            
            <Button onClick={onRefresh} variant="outline" size="sm" className={borderColor}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-[#6366f1]">{employees.length}</div>
            <div className={`text-sm ${textSecondary}`}>Total Employees</div>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor} cursor-pointer hover:border-[#22c55e]`}>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-[#22c55e]">{presentCount}</div>
            <div className={`text-sm ${textSecondary}`}>Present/Working</div>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor} cursor-pointer hover:border-[#8b5cf6]`}>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-[#8b5cf6]">{wfhCount}</div>
            <div className={`text-sm ${textSecondary}`}>Work from Home</div>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor} cursor-pointer hover:border-[#f59e0b]`}>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-[#f59e0b]">{yetToLoginCount}</div>
            <div className={`text-sm ${textSecondary}`}>Yet to Login</div>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor} cursor-pointer hover:border-[#ef4444]`}>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-[#ef4444]">{absentCount}</div>
            <div className={`text-sm ${textSecondary}`}>Absent/Leave</div>
          </CardContent>
        </Card>
      </div>

      {/* Employee List Table */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className={`p-4 border-b ${borderColor} flex justify-between items-center`}>
            <h3 className={`font-semibold ${textPrimary}`}>
              Employee Attendance - {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={bgSecondary}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Employee</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Department</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Check In</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Check Out</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Worked Hours</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium ${textSecondary} uppercase`}>Details</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderColor}`}>
                {employeesWithStatus.map(emp => (
                  <tr key={emp.user_id} className="hover:bg-[#27272a]/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full bg-[#6366f1] flex items-center justify-center text-white font-medium`}>
                          {emp.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className={`font-medium ${textPrimary}`}>{emp.name}</div>
                          <div className={`text-xs ${textSecondary}`}>{emp.designation || emp.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{emp.department || '-'}</td>
                    <td className="px-4 py-3">{getStatusBadge(emp.status)}</td>
                    <td className={`px-4 py-3 ${textPrimary}`}>{emp.checkIn || '-'}</td>
                    <td className={`px-4 py-3 ${textPrimary}`}>{emp.checkOut || '-'}</td>
                    <td className={`px-4 py-3 ${textPrimary}`}>{emp.workedHours ? `${emp.workedHours}h` : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadEmployeeDetails(emp)}
                        disabled={loading}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Employee Detail Modal */}
      {showDetailModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`${bgCard} w-full max-w-2xl max-h-[80vh] overflow-hidden`}>
            <CardContent className="p-0">
              <div className={`p-4 border-b ${borderColor} flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-[#6366f1] flex items-center justify-center text-white font-medium`}>
                    {selectedEmployee.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${textPrimary}`}>{selectedEmployee.name}</h3>
                    <p className={`text-sm ${textSecondary}`}>{selectedEmployee.designation || selectedEmployee.role} - {selectedEmployee.department}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowDetailModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <h4 className={`font-medium ${textPrimary} mb-3`}>Attendance History - {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
                {employeeRecords.length > 0 ? (
                  <div className="space-y-2">
                    {employeeRecords.map((rec, idx) => (
                      <div key={idx} className={`p-3 rounded-lg ${bgSecondary} flex justify-between items-center`}>
                        <div>
                          <div className={`font-medium ${textPrimary}`}>
                            {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </div>
                          <div className={`text-sm ${textSecondary}`}>
                            Check-in: {rec.clock_in_time || 'N/A'} | Check-out: {rec.clock_out_time || 'N/A'}
                          </div>
                        </div>
                        <div className="text-right">
                          {rec.leave_type ? (
                            <Badge className="bg-[#ef4444]/20 text-[#ef4444]">{rec.leave_type}</Badge>
                          ) : rec.clock_out_time ? (
                            <Badge className="bg-[#22c55e]/20 text-[#22c55e]">Present</Badge>
                          ) : rec.clock_in_time ? (
                            <Badge className="bg-[#3b82f6]/20 text-[#3b82f6]">Working</Badge>
                          ) : (
                            <Badge className="bg-[#f59e0b]/20 text-[#f59e0b]">No Record</Badge>
                          )}
                          {rec.total_work_hours && (
                            <div className={`text-sm ${textSecondary} mt-1`}>{rec.total_work_hours.toFixed(1)}h worked</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`text-center py-8 ${textSecondary}`}>
                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No attendance records found for this period</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============ Designations & Departments Combined Tab ============
function DesignationsDeptsTab({
  designations, departments, editingDesignation, setEditingDesignation,
  showDesignationModal, setShowDesignationModal, showDepartmentModal, setShowDepartmentModal,
  newDesignation, setNewDesignation, newDepartment, setNewDepartment,
  onCreateDesignation, onUpdateDesignation, onDeleteDesignation,
  onCreateDepartment, onDeleteDepartment,
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor
}) {
  const [activeSubTab, setActiveSubTab] = useState('designations');
  const [viewDesignation, setViewDesignation] = useState(null);

  const MODULES = [
    // Core Modules
    { value: 'calendar', label: 'Calendar' },
    { value: 'my_tasks', label: 'My Tasks' },
    { value: 'our_tasks', label: 'Our Tasks' },
    { value: 'my_profile', label: 'My Profile' },
    
    // Sales
    { value: 'sales', label: 'Sales' },
    { value: 'leads', label: 'Leads' },
    { value: 'bde_tasks', label: 'BDE Tasks' },
    
    // Operations
    { value: 'operations', label: 'Operations' },
    { value: 'tasks', label: 'Tasks' },
    { value: 'website_projects', label: 'Website Projects' },
    { value: 'seo_works', label: 'SEO Works' },
    { value: 'social_media', label: 'Social Media' },
    { value: 'creative_board', label: 'Creative Board' },
    { value: 'meta_ads', label: 'Meta Ads' },
    
    // Admin Modules
    { value: 'hr', label: 'HR' },
    { value: 'hr_admin', label: 'HR Admin' },
    { value: 'finance', label: 'Finance' },
    { value: 'settings', label: 'Settings' },
    { value: 'documentations', label: 'Documentations' },
    
    // Reports
    { value: 'reports', label: 'Reports' },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeSubTab === 'designations' ? 'default' : 'outline'}
          onClick={() => setActiveSubTab('designations')}
          className={activeSubTab === 'designations' ? 'bg-[#6366f1]' : ''}
        >
          <Briefcase className="h-4 w-4 mr-2" />
          Designations ({designations.length})
        </Button>
        <Button
          variant={activeSubTab === 'departments' ? 'default' : 'outline'}
          onClick={() => setActiveSubTab('departments')}
          className={activeSubTab === 'departments' ? 'bg-[#6366f1]' : ''}
        >
          <Building className="h-4 w-4 mr-2" />
          Departments ({departments.length})
        </Button>
      </div>

      {/* Designations Sub-Tab */}
      {activeSubTab === 'designations' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowDesignationModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
              <Plus className="h-4 w-4 mr-2" />
              Add Designation
            </Button>
          </div>
          
          {/* 3-Column Card Grid */}
          <div className="grid md:grid-cols-3 gap-4">
            {designations.length > 0 ? designations.map((desg) => (
              <Card key={desg.designation_id} className={`${bgCard} border ${borderColor} hover:border-[#6366f1] transition-colors cursor-pointer`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-semibold ${textPrimary}`}>{desg.title}</h3>
                    <Badge className="bg-[#10b981]/20 text-[#10b981] text-xs">
                      {desg.employee_count || 0}
                    </Badge>
                  </div>
                  <p className={`text-sm ${textSecondary} line-clamp-2 mb-3`}>
                    {desg.description || 'No description'}
                  </p>
                  {desg.module_access?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {desg.module_access.slice(0, 3).map(m => (
                        <Badge key={m} className="bg-[#6366f1]/20 text-[#6366f1] text-xs">{m}</Badge>
                      ))}
                      {desg.module_access.length > 3 && (
                        <Badge className={`${bgSecondary} ${textSecondary} text-xs`}>+{desg.module_access.length - 3}</Badge>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 justify-end pt-2 border-t border-[#27272a]">
                    <Button size="sm" variant="ghost" onClick={() => setViewDesignation(desg)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingDesignation(desg)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-[#ef4444]" onClick={() => onDeleteDesignation(desg.designation_id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className={`${bgCard} border ${borderColor} col-span-3`}>
                <CardContent className="p-8 text-center">
                  <Briefcase className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                  <p className={textSecondary}>No designations created yet</p>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* View Designation Modal */}
          {viewDesignation && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className={`${bgCard} w-full max-w-lg`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className={`text-xl font-semibold ${textPrimary}`}>{viewDesignation.title}</h3>
                      <Badge className="bg-[#10b981]/20 text-[#10b981] mt-1">
                        <Users className="h-3 w-3 mr-1" />
                        {viewDesignation.employee_count || 0} Employees
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setViewDesignation(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className={`text-xs ${textSecondary} uppercase`}>Description</label>
                      <p className={textPrimary}>{viewDesignation.description || 'No description'}</p>
                    </div>
                    
                    {viewDesignation.roles_responsibilities && (
                      <div>
                        <label className={`text-xs ${textSecondary} uppercase`}>Roles & Responsibilities</label>
                        <p className={`${textPrimary} whitespace-pre-wrap`}>{viewDesignation.roles_responsibilities}</p>
                      </div>
                    )}
                    
                    <div>
                      <label className={`text-xs ${textSecondary} uppercase`}>Module Access</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {viewDesignation.module_access?.length > 0 ? (
                          viewDesignation.module_access.map(m => (
                            <Badge key={m} className="bg-[#6366f1]/20 text-[#6366f1]">{m}</Badge>
                          ))
                        ) : (
                          <span className={textSecondary}>No modules assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 justify-end mt-6">
                    <Button variant="ghost" onClick={() => setViewDesignation(null)}>Close</Button>
                    <Button 
                      onClick={() => { setEditingDesignation(viewDesignation); setViewDesignation(null); }}
                      className="bg-[#6366f1] hover:bg-[#4f46e5]"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Edit Designation Modal */}
          {editingDesignation && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className={`${bgCard} w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>Edit Designation</h3>
                    <Button variant="ghost" size="sm" onClick={() => setEditingDesignation(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className={textPrimary}>Title *</Label>
                      <Input
                        value={editingDesignation.title}
                        onChange={(e) => setEditingDesignation(prev => ({ ...prev, title: e.target.value }))}
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Description</Label>
                      <Input
                        value={editingDesignation.description || ''}
                        onChange={(e) => setEditingDesignation(prev => ({ ...prev, description: e.target.value }))}
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Roles & Responsibilities</Label>
                      <textarea
                        value={editingDesignation.roles_responsibilities || ''}
                        onChange={(e) => setEditingDesignation(prev => ({ ...prev, roles_responsibilities: e.target.value }))}
                        rows={4}
                        className={`w-full px-3 py-2 rounded-md ${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Module Access</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {MODULES.map(m => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => {
                              const access = editingDesignation.module_access || [];
                              setEditingDesignation(prev => ({
                                ...prev,
                                module_access: access.includes(m.value)
                                  ? access.filter(x => x !== m.value)
                                  : [...access, m.value]
                              }));
                            }}
                            className={`px-3 py-1 rounded-full text-sm ${
                              (editingDesignation.module_access || []).includes(m.value)
                                ? 'bg-[#6366f1] text-white'
                                : `${bgSecondary} ${textSecondary}`
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-6">
                    <Button variant="ghost" onClick={() => setEditingDesignation(null)}>Cancel</Button>
                    <Button onClick={onUpdateDesignation} className="bg-[#22c55e] hover:bg-[#16a34a]">Save Changes</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Add Designation Modal */}
          {showDesignationModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <Card className={`${bgCard} w-full max-w-lg`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>Add New Designation</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowDesignationModal(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className={textPrimary}>Title *</Label>
                      <Input
                        value={newDesignation.title}
                        onChange={(e) => setNewDesignation({ ...newDesignation, title: e.target.value })}
                        placeholder="e.g., Project Manager"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Description</Label>
                      <Input
                        value={newDesignation.description}
                        onChange={(e) => setNewDesignation({ ...newDesignation, description: e.target.value })}
                        placeholder="Brief description"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Roles & Responsibilities</Label>
                      <textarea
                        value={newDesignation.roles_responsibilities}
                        onChange={(e) => setNewDesignation({ ...newDesignation, roles_responsibilities: e.target.value })}
                        placeholder="Define roles and responsibilities"
                        rows={3}
                        className={`w-full px-3 py-2 rounded-md ${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Module Access</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {MODULES.map(m => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => {
                              setNewDesignation(prev => ({
                                ...prev,
                                module_access: prev.module_access.includes(m.value)
                                  ? prev.module_access.filter(x => x !== m.value)
                                  : [...prev.module_access, m.value]
                              }));
                            }}
                            className={`px-3 py-1 rounded-full text-sm ${
                              newDesignation.module_access.includes(m.value)
                                ? 'bg-[#6366f1] text-white'
                                : `${bgSecondary} ${textSecondary}`
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="ghost" onClick={() => setShowDesignationModal(false)}>Cancel</Button>
                    <Button onClick={onCreateDesignation} className="bg-[#6366f1] hover:bg-[#4f46e5]">Create</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Departments Sub-Tab */}
      {activeSubTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowDepartmentModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {departments.length > 0 ? departments.map((dept) => (
              <Card key={dept.department_id} className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className={`font-semibold ${textPrimary}`}>{dept.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-[#10b981]/20 text-[#10b981]">
                          <Users className="h-3 w-3 mr-1" />
                          {dept.employee_count || 0} Members
                        </Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => onDeleteDepartment(dept.department_id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className={`${bgCard} border ${borderColor} col-span-full`}>
                <CardContent className="p-8 text-center">
                  <Building className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                  <p className={textSecondary}>No departments created yet</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Add Department Modal */}
          {showDepartmentModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <Card className={`${bgCard} w-full max-w-md`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>Add New Department</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowDepartmentModal(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className={textPrimary}>Department Name *</Label>
                      <Input
                        value={newDepartment.name}
                        onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                        placeholder="e.g., Engineering"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="ghost" onClick={() => setShowDepartmentModal(false)}>Cancel</Button>
                    <Button onClick={onCreateDepartment} className="bg-[#6366f1] hover:bg-[#4f46e5]">Create</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Enhanced Approvals Tab (3 Sub-tabs with Filters) ============
function EnhancedApprovalsTab({
  pendingApprovals, leaveRequests, leaveFilter, setLeaveFilter,
  wfhRequests, wfhFilter, setWfhFilter,
  onApproveAttendance, onApprovePermission, onApproveLeave, onRejectLeave,
  onApproveWfh, onRejectWfh,
  onViewTasks, onSendForVerification, onFinalApprove,
  formatDate, formatTime, bgCard, bgSecondary, textPrimary, textSecondary, borderColor
}) {
  const [activeSubTab, setActiveSubTab] = useState('attendance');
  const [dateFilter, setDateFilter] = useState('day');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // WFH Filters
  const [wfhEmployeeFilter, setWfhEmployeeFilter] = useState('all');
  const [wfhDateRange, setWfhDateRange] = useState({ start: '', end: '' });
  
  // View Details Modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedWfhRequest, setSelectedWfhRequest] = useState(null);
  
  // Approval modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [approvalType, setApprovalType] = useState(''); // attendance, permission, leave, wfh
  const [remarks, setRemarks] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [enableLOP, setEnableLOP] = useState(false);

  const attendanceApprovals = pendingApprovals?.attendance || [];
  const permissionApprovals = pendingApprovals?.permissions || [];
  const leaveApprovals = pendingApprovals?.leaves || [];
  const wfhApprovals = wfhRequests || [];

  // Open approve modal
  const openApproveModal = (item, type) => {
    setSelectedItem(item);
    setApprovalType(type);
    setRemarks('');
    setEnableLOP(false);
    setShowApproveModal(true);
  };

  // Open reject modal
  const openRejectModal = (item, type) => {
    setSelectedItem(item);
    setApprovalType(type);
    setRejectReason('');
    setShowRejectModal(true);
  };

  // Handle approve with remarks
  const handleApprove = () => {
    if (approvalType === 'attendance') {
      onApproveAttendance({ ...selectedItem, remarks, lop_deduction: enableLOP });
    } else if (approvalType === 'permission') {
      onApprovePermission({ ...selectedItem, remarks, lop_deduction: enableLOP });
    } else if (approvalType === 'leave') {
      onApproveLeave(selectedItem.request_id, remarks, enableLOP);
    } else if (approvalType === 'wfh') {
      onApproveWfh(selectedItem.wfh_id, remarks);
    }
    setShowApproveModal(false);
    toast.success('Approved successfully');
  };

  // Handle reject with reason
  const handleReject = () => {
    if (!rejectReason) {
      toast.error('Please enter a rejection reason');
      return;
    }
    if (approvalType === 'wfh') {
      onRejectWfh(selectedItem.wfh_id, rejectReason);
    } else {
      onRejectLeave(selectedItem.request_id, rejectReason);
    }
    setShowRejectModal(false);
    toast.success('Rejected');
  };

  // Filter WFH requests
  const filteredWfhRequests = wfhApprovals.filter(req => {
    let match = true;
    if (wfhEmployeeFilter !== 'all') {
      match = match && req.user_id === wfhEmployeeFilter;
    }
    if (wfhDateRange.start) {
      match = match && req.start_date >= wfhDateRange.start;
    }
    if (wfhDateRange.end) {
      match = match && req.end_date <= wfhDateRange.end;
    }
    return match;
  });

  // Get unique employees for filter
  const wfhEmployees = [...new Set(wfhApprovals.map(r => r.user_id))].map(id => {
    const req = wfhApprovals.find(r => r.user_id === id);
    return { id, name: req?.employee_name || 'Unknown' };
  });

  return (
    <div className="space-y-4">
      {/* Sub-tabs: Attendance | Leave | Permission | Remote */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() => setActiveSubTab('attendance')}
          className={`${activeSubTab === 'attendance' ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary}`}`}
        >
          <Clock className="h-4 w-4 mr-2" />
          Attendance ({attendanceApprovals.length})
        </Button>
        <Button
          onClick={() => setActiveSubTab('leave')}
          className={`${activeSubTab === 'leave' ? 'bg-[#22c55e] text-white' : `${bgSecondary} ${textSecondary}`}`}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Leave ({leaveApprovals.length + (leaveRequests?.length || 0)})
        </Button>
        <Button
          onClick={() => setActiveSubTab('permission')}
          className={`${activeSubTab === 'permission' ? 'bg-[#f59e0b] text-white' : `${bgSecondary} ${textSecondary}`}`}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Permission ({permissionApprovals.length})
        </Button>
        <Button
          onClick={() => setActiveSubTab('remote')}
          className={`${activeSubTab === 'remote' ? 'bg-[#8b5cf6] text-white' : `${bgSecondary} ${textSecondary}`}`}
        >
          <Home className="h-4 w-4 mr-2" />
          Remote ({wfhApprovals.length})
        </Button>
      </div>

      {/* Date Filters */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-2">
              {['day', 'range', 'month'].map(filter => (
                <Button
                  key={filter}
                  variant={dateFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter(filter)}
                  className={dateFilter === filter ? 'bg-[#6366f1] text-white' : ''}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>
            
            {dateFilter === 'day' && (
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`w-48 ${bgSecondary} ${borderColor}`}
              />
            )}
            
            {dateFilter === 'range' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className={`w-40 ${bgSecondary} ${borderColor}`}
                />
                <span className={textSecondary}>to</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className={`w-40 ${bgSecondary} ${borderColor}`}
                />
              </div>
            )}
            
            {dateFilter === 'month' && (
              <Input
                type="month"
                value={selectedDate.substring(0, 7)}
                onChange={(e) => setSelectedDate(e.target.value + '-01')}
                className={`w-48 ${bgSecondary} ${borderColor}`}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Attendance Approvals Tab */}
      {activeSubTab === 'attendance' && (
        <div className="space-y-3">
          {attendanceApprovals.length > 0 ? attendanceApprovals.map((item, idx) => (
            <Card key={idx} className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold">
                        {item.employee_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={`font-medium ${textPrimary}`}>{item.employee_name}</p>
                        <p className={`text-xs ${textSecondary}`}>{item.employee_email || '-'}</p>
                      </div>
                      <Badge className="bg-[#f59e0b]/20 text-[#f59e0b] ml-2">{item.type}</Badge>
                      {item.work_location && (
                        <Badge className={item.work_location === 'home' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}>
                          {item.work_location === 'home' ? 'Remote' : 'Office'}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
                      <div>
                        <span className={textSecondary}>Date: </span>
                        <span className={textPrimary}>{formatDate(item.date)}</span>
                      </div>
                      <div>
                        <span className={textSecondary}>Time: </span>
                        <span className={textPrimary}>{formatTime(item.time)}</span>
                      </div>
                      {item.check_in && (
                        <div>
                          <span className={textSecondary}>Check In: </span>
                          <span className={textPrimary}>{item.check_in}</span>
                        </div>
                      )}
                      {item.check_out && (
                        <div>
                          <span className={textSecondary}>Check Out: </span>
                          <span className={textPrimary}>{item.check_out}</span>
                        </div>
                      )}
                    </div>
                    
                    <p className={`text-sm ${textSecondary}`}>
                      <span className="font-medium">Reason:</span> {item.reason}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Button size="sm" onClick={() => openApproveModal(item, 'attendance')} className="bg-[#22c55e] hover:bg-[#16a34a]">
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openRejectModal(item, 'attendance')} className="text-[#ef4444] border-[#ef4444]">
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-8 text-center">
                <CheckCircle className={`h-12 w-12 mx-auto mb-3 text-[#22c55e]`} />
                <p className={textPrimary}>No pending attendance approvals</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Leave Approvals Tab */}
      {activeSubTab === 'leave' && (
        <div className="space-y-3">
          {/* Filter */}
          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'rejected'].map(f => (
              <Button
                key={f}
                variant={leaveFilter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLeaveFilter(f)}
                className={leaveFilter === f ? 'bg-[#6366f1] text-white' : ''}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>

          {(leaveApprovals.length > 0 || leaveRequests?.length > 0) ? (
            [...leaveApprovals, ...(leaveRequests || [])].map((item, idx) => (
              <Card key={idx} className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center text-white font-bold">
                          {item.employee_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-medium ${textPrimary}`}>{item.employee_name}</p>
                          <p className={`text-xs ${textSecondary}`}>{item.employee_email || '-'}</p>
                        </div>
                        <Badge className={`${
                          item.leave_type === 'casual' ? 'bg-blue-500/20 text-blue-400' :
                          item.leave_type === 'sick' ? 'bg-orange-500/20 text-orange-400' :
                          item.leave_type === 'wfh' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {item.leave_type?.toUpperCase()}
                        </Badge>
                        <Badge className={`${
                          item.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          item.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {item.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
                        <div>
                          <span className={textSecondary}>From: </span>
                          <span className={textPrimary}>{formatDate(item.from_date || item.start_date)}</span>
                        </div>
                        <div>
                          <span className={textSecondary}>To: </span>
                          <span className={textPrimary}>{formatDate(item.to_date || item.end_date)}</span>
                        </div>
                        <div>
                          <span className={textSecondary}>Days: </span>
                          <span className={`font-medium ${textPrimary}`}>{item.days || '-'}</span>
                        </div>
                        {item.half_day && (
                          <div>
                            <Badge className="bg-blue-500/20 text-blue-400">Half Day</Badge>
                          </div>
                        )}
                      </div>
                      
                      <p className={`text-sm ${textSecondary}`}>
                        <span className="font-medium">Reason:</span> {item.reason}
                      </p>
                      
                      {item.approved_by_name && item.status === 'approved' && (
                        <p className={`text-xs text-[#22c55e] mt-1`}>
                          Approved by: {item.approved_by_name} {item.approved_at && `on ${formatDate(item.approved_at.split('T')[0])}`}
                        </p>
                      )}
                      
                      {item.rejection_reason && item.status === 'rejected' && (
                        <p className={`text-xs text-[#ef4444] mt-1`}>
                          Rejected: {item.rejection_reason}
                        </p>
                      )}
                    </div>
                    {item.status === 'pending' && (
                      <div className="flex flex-col gap-2 ml-4">
                        <Button size="sm" onClick={() => openApproveModal(item, 'leave')} className="bg-[#22c55e] hover:bg-[#16a34a]">
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openRejectModal(item, 'leave')} className="text-[#ef4444] border-[#ef4444]">
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-8 text-center">
                <Calendar className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                <p className={textSecondary}>No leave requests found</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Permission Approvals Tab */}
      {activeSubTab === 'permission' && (
        <div className="space-y-3">
          {permissionApprovals.length > 0 ? permissionApprovals.map((item, idx) => (
            <Card key={idx} className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`font-medium ${textPrimary}`}>{item.employee_name}</p>
                      <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{item.hours}h Permission</Badge>
                    </div>
                    <p className={`text-sm ${textSecondary}`}>{item.reason}</p>
                    <p className={`text-xs ${textSecondary} mt-1`}>
                      {formatDate(item.date)} {item.from_time && `| ${item.from_time} - ${item.to_time}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => openApproveModal(item, 'permission')} className="bg-[#22c55e] hover:bg-[#16a34a]">
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openRejectModal(item, 'permission')} className="text-[#ef4444] border-[#ef4444]">
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-8 text-center">
                <Clock className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                <p className={textSecondary}>No pending permission requests</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Remote/WFH Approvals Tab */}
      {activeSubTab === 'remote' && (
        <div className="space-y-4">
          {/* WFH Filters */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className={textSecondary}>Status:</Label>
                  <Select value={wfhFilter} onValueChange={setWfhFilter}>
                    <SelectTrigger className={`w-36 ${bgSecondary} ${borderColor}`}>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Label className={textSecondary}>Employee:</Label>
                  <Select value={wfhEmployeeFilter} onValueChange={setWfhEmployeeFilter}>
                    <SelectTrigger className={`w-48 ${bgSecondary} ${borderColor}`}>
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {wfhEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Label className={textSecondary}>Date Range:</Label>
                  <Input
                    type="date"
                    value={wfhDateRange.start}
                    onChange={(e) => setWfhDateRange({ ...wfhDateRange, start: e.target.value })}
                    className={`w-40 ${bgSecondary} ${borderColor}`}
                    placeholder="Start"
                  />
                  <span className={textSecondary}>to</span>
                  <Input
                    type="date"
                    value={wfhDateRange.end}
                    onChange={(e) => setWfhDateRange({ ...wfhDateRange, end: e.target.value })}
                    className={`w-40 ${bgSecondary} ${borderColor}`}
                    placeholder="End"
                  />
                </div>
                
                {(wfhEmployeeFilter !== 'all' || wfhDateRange.start || wfhDateRange.end) && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setWfhEmployeeFilter('all');
                      setWfhDateRange({ start: '', end: '' });
                    }}
                    className="text-[#ef4444]"
                  >
                    <X className="h-4 w-4 mr-1" /> Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* WFH Requests List */}
          <div className="space-y-3">
            {filteredWfhRequests.length > 0 ? filteredWfhRequests.map((item, idx) => (
              <Card key={idx} className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className={`font-medium ${textPrimary}`}>{item.employee_name}</p>
                        <Badge className={
                          item.status === 'pending' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' :
                          item.status === 'approved' ? 'bg-[#22c55e]/20 text-[#22c55e]' :
                          'bg-[#ef4444]/20 text-[#ef4444]'
                        }>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Badge>
                        <Badge className="bg-[#8b5cf6]/20 text-[#8b5cf6]">
                          {item.days} {item.days > 1 ? 'Days' : 'Day'} WFH
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-2">
                        <div>
                          <span className={textSecondary}>From: </span>
                          <span className={textPrimary}>{formatDate(item.start_date)}</span>
                        </div>
                        <div>
                          <span className={textSecondary}>To: </span>
                          <span className={textPrimary}>{formatDate(item.end_date)}</span>
                        </div>
                        <div>
                          <span className={textSecondary}>Location: </span>
                          <span className={textPrimary}>{item.work_location === 'home' ? 'Home' : 'Other'}</span>
                        </div>
                        {item.contact_number && (
                          <div>
                            <span className={textSecondary}>Contact: </span>
                            <span className={textPrimary}>{item.contact_number}</span>
                          </div>
                        )}
                      </div>
                      
                      <p className={`text-sm ${textSecondary}`}>
                        <span className="font-medium">Reason:</span> {item.reason}
                      </p>
                      
                      {item.work_plan && (
                        <p className={`text-sm ${textSecondary} mt-1`}>
                          <span className="font-medium">Work Plan:</span> {item.work_plan}
                        </p>
                      )}
                      
                      {item.remarks && item.status === 'approved' && (
                        <p className={`text-sm text-[#22c55e] mt-1`}>
                          <span className="font-medium">Approved with remarks:</span> {item.remarks}
                        </p>
                      )}
                      
                      {item.rejection_reason && item.status === 'rejected' && (
                        <p className={`text-sm text-[#ef4444] mt-1`}>
                          <span className="font-medium">Rejection reason:</span> {item.rejection_reason}
                        </p>
                      )}
                      
                      <p className={`text-xs ${textSecondary} mt-2`}>
                        Requested: {formatDate(item.created_at?.split('T')[0])}
                        {item.approved_by_name && ` | Approved by: ${item.approved_by_name}`}
                        {item.rejected_by_name && ` | Rejected by: ${item.rejected_by_name}`}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-2 ml-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => { setSelectedWfhRequest(item); setShowDetailsModal(true); }}
                        className={`${textSecondary}`}
                      >
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                      
                      {item.status === 'pending' && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => openApproveModal(item, 'wfh')} 
                            className="bg-[#22c55e] hover:bg-[#16a34a]"
                          >
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => openRejectModal(item, 'wfh')} 
                            className="text-[#ef4444] border-[#ef4444]"
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardContent className="p-8 text-center">
                  <Home className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                  <p className={textSecondary}>No WFH requests found</p>
                  <p className={`text-sm ${textSecondary} mt-1`}>
                    {wfhFilter === 'pending' ? 'No pending requests to review' : 'Try adjusting the filters'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* WFH Details Modal */}
      {showDetailsModal && selectedWfhRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`${bgCard} w-full max-w-2xl max-h-[90vh] overflow-auto`}>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>WFH Request Details</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowDetailsModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                {/* Employee Info */}
                <div className={`p-4 rounded-lg ${bgSecondary}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-[#8b5cf6]/20 flex items-center justify-center">
                      <User className="h-6 w-6 text-[#8b5cf6]" />
                    </div>
                    <div>
                      <p className={`font-medium text-lg ${textPrimary}`}>{selectedWfhRequest.employee_name}</p>
                      <p className={`text-sm ${textSecondary}`}>{selectedWfhRequest.employee_email}</p>
                    </div>
                    <Badge className={
                      selectedWfhRequest.status === 'pending' ? 'bg-[#f59e0b]/20 text-[#f59e0b] ml-auto' :
                      selectedWfhRequest.status === 'approved' ? 'bg-[#22c55e]/20 text-[#22c55e] ml-auto' :
                      'bg-[#ef4444]/20 text-[#ef4444] ml-auto'
                    }>
                      {selectedWfhRequest.status.charAt(0).toUpperCase() + selectedWfhRequest.status.slice(1)}
                    </Badge>
                  </div>
                  
                  {selectedWfhRequest.department && (
                    <p className={`text-sm ${textSecondary}`}>
                      Department: <span className={textPrimary}>{selectedWfhRequest.department}</span>
                    </p>
                  )}
                  {selectedWfhRequest.designation && (
                    <p className={`text-sm ${textSecondary}`}>
                      Designation: <span className={textPrimary}>{selectedWfhRequest.designation}</span>
                    </p>
                  )}
                </div>
                
                {/* Request Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-1`}>Start Date</p>
                    <p className={`font-medium ${textPrimary}`}>{formatDate(selectedWfhRequest.start_date)}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-1`}>End Date</p>
                    <p className={`font-medium ${textPrimary}`}>{formatDate(selectedWfhRequest.end_date)}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-1`}>Total Days</p>
                    <p className={`font-medium ${textPrimary}`}>{selectedWfhRequest.days} {selectedWfhRequest.days > 1 ? 'Days' : 'Day'}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-1`}>Work Location</p>
                    <p className={`font-medium ${textPrimary}`}>{selectedWfhRequest.work_location === 'home' ? 'Home' : 'Other Location'}</p>
                  </div>
                </div>
                
                {selectedWfhRequest.contact_number && (
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-1`}>Contact Number</p>
                    <p className={`font-medium ${textPrimary}`}>{selectedWfhRequest.contact_number}</p>
                  </div>
                )}
                
                <div className={`p-3 rounded-lg ${bgSecondary}`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Reason</p>
                  <p className={textPrimary}>{selectedWfhRequest.reason}</p>
                </div>
                
                {selectedWfhRequest.work_plan && (
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-1`}>Work Plan</p>
                    <p className={textPrimary}>{selectedWfhRequest.work_plan}</p>
                  </div>
                )}
                
                {/* Approval/Rejection Info */}
                {selectedWfhRequest.status === 'approved' && (
                  <div className={`p-3 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20`}>
                    <p className="text-xs text-[#22c55e] mb-1">Approved</p>
                    <p className={textPrimary}>By: {selectedWfhRequest.approved_by_name}</p>
                    {selectedWfhRequest.remarks && (
                      <p className={`text-sm ${textSecondary} mt-1`}>Remarks: {selectedWfhRequest.remarks}</p>
                    )}
                  </div>
                )}
                
                {selectedWfhRequest.status === 'rejected' && (
                  <div className={`p-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20`}>
                    <p className="text-xs text-[#ef4444] mb-1">Rejected</p>
                    <p className={textPrimary}>By: {selectedWfhRequest.rejected_by_name}</p>
                    {selectedWfhRequest.rejection_reason && (
                      <p className={`text-sm ${textSecondary} mt-1`}>Reason: {selectedWfhRequest.rejection_reason}</p>
                    )}
                  </div>
                )}
                
                {/* Action Buttons */}
                {selectedWfhRequest.status === 'pending' && (
                  <div className="flex gap-2 justify-end pt-4 border-t border-gray-700">
                    <Button 
                      onClick={() => { setShowDetailsModal(false); openApproveModal(selectedWfhRequest, 'wfh'); }} 
                      className="bg-[#22c55e] hover:bg-[#16a34a]"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" /> Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => { setShowDetailsModal(false); openRejectModal(selectedWfhRequest, 'wfh'); }} 
                      className="text-[#ef4444] border-[#ef4444]"
                    >
                      <X className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Approve Modal with Remarks */}
      {showApproveModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`${bgCard} w-full max-w-md`}>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Approve Request</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowApproveModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className={`p-3 rounded-lg ${bgSecondary} mb-4`}>
                <p className={`font-medium ${textPrimary}`}>{selectedItem.employee_name}</p>
                <p className={`text-sm ${textSecondary}`}>
                  {approvalType === 'leave' ? `${selectedItem.leave_type} Leave` : 
                   approvalType === 'permission' ? `${selectedItem.hours}h Permission` :
                   selectedItem.type}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className={textPrimary}>Remarks (Optional)</Label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    placeholder="Add remarks for the employee..."
                    className={`w-full mt-1 px-3 py-2 rounded-md ${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="enableLOP"
                    checked={enableLOP}
                    onChange={(e) => setEnableLOP(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <Label htmlFor="enableLOP" className={`${textPrimary} cursor-pointer`}>
                    Enable LOP Deduction (Loss of Pay)
                  </Label>
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <Button variant="ghost" onClick={() => setShowApproveModal(false)}>Cancel</Button>
                <Button onClick={handleApprove} className="bg-[#22c55e] hover:bg-[#16a34a]">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reject Modal with Reason */}
      {showRejectModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`${bgCard} w-full max-w-md`}>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Reject Request</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowRejectModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className={`p-3 rounded-lg ${bgSecondary} mb-4`}>
                <p className={`font-medium ${textPrimary}`}>{selectedItem.employee_name}</p>
                <p className={`text-sm ${textSecondary}`}>
                  {approvalType === 'leave' ? `${selectedItem.leave_type} Leave` : 
                   approvalType === 'permission' ? `${selectedItem.hours}h Permission` :
                   selectedItem.type}
                </p>
              </div>

              <div>
                <Label className={textPrimary}>Rejection Reason *</Label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Enter reason for rejection..."
                  className={`w-full mt-1 px-3 py-2 rounded-md ${bgSecondary} border ${borderColor} ${textPrimary}`}
                  required
                />
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <Button variant="ghost" onClick={() => setShowRejectModal(false)}>Cancel</Button>
                <Button onClick={handleReject} className="bg-[#ef4444] hover:bg-[#dc2626]">
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============ Enhanced Calendar Tab with Work Settings ============
function EnhancedCalendarTab({
  calendar, hrSettings, month, year, setMonth, setYear,
  onUpdateCalendar, onUpdateSettings, onRefresh, loadHRSettings,
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor
}) {
  const [activeSubTab, setActiveSubTab] = useState('calendar');
  const [editingSettings, setEditingSettings] = useState(false);
  const [formData, setFormData] = useState({
    standard_login_time: hrSettings?.standard_login_time || '10:00',
    standard_logout_time: hrSettings?.standard_logout_time || '19:00',
    working_days: hrSettings?.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    standard_work_hours: hrSettings?.standard_work_hours || 8.25,
    lunch_minutes: hrSettings?.lunch_minutes || 45,
    total_office_hours: hrSettings?.total_office_hours || 9,
    grace_period_minutes: hrSettings?.grace_period_minutes || 15,
  });

  // Local state for calendar configuration
  const [holidays, setHolidays] = useState([]);
  const [approvedHolidays, setApprovedHolidays] = useState([]);
  const [specialWorkingDays, setSpecialWorkingDays] = useState([]); // Sundays that are marked as working days
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
  const [editingHoliday, setEditingHoliday] = useState(null);
  
  // Indian National Holidays - prefixed list
  const defaultIndianHolidays = [
    { date: '2025-01-26', name: 'Republic Day', type: 'national' },
    { date: '2025-03-14', name: 'Holi', type: 'national' },
    { date: '2025-04-14', name: 'Ambedkar Jayanti', type: 'national' },
    { date: '2025-04-18', name: 'Good Friday', type: 'national' },
    { date: '2025-05-01', name: 'May Day', type: 'national' },
    { date: '2025-08-15', name: 'Independence Day', type: 'national' },
    { date: '2025-08-27', name: 'Janmashtami', type: 'national' },
    { date: '2025-10-02', name: 'Gandhi Jayanti', type: 'national' },
    { date: '2025-10-20', name: 'Dussehra', type: 'national' },
    { date: '2025-11-01', name: 'Diwali', type: 'national' },
    { date: '2025-11-15', name: 'Guru Nanak Jayanti', type: 'national' },
    { date: '2025-12-25', name: 'Christmas', type: 'national' },
    { date: '2026-01-26', name: 'Republic Day', type: 'national' },
    { date: '2026-03-04', name: 'Holi', type: 'national' },
    { date: '2026-04-03', name: 'Good Friday', type: 'national' },
    { date: '2026-04-14', name: 'Ambedkar Jayanti', type: 'national' },
    { date: '2026-05-01', name: 'May Day', type: 'national' },
    { date: '2026-08-15', name: 'Independence Day', type: 'national' },
    { date: '2026-08-16', name: 'Janmashtami', type: 'national' },
    { date: '2026-10-02', name: 'Gandhi Jayanti', type: 'national' },
    { date: '2026-10-08', name: 'Dussehra', type: 'national' },
    { date: '2026-10-20', name: 'Diwali', type: 'national' },
    { date: '2026-11-04', name: 'Guru Nanak Jayanti', type: 'national' },
    { date: '2026-12-25', name: 'Christmas', type: 'national' },
  ];

  // Combine default Indian holidays with any added custom ones
  const [allHolidays, setAllHolidays] = useState([]);

  useEffect(() => {
    if (hrSettings) {
      setFormData({
        standard_login_time: hrSettings.standard_login_time || '10:00',
        standard_logout_time: hrSettings.standard_logout_time || '19:00',
        working_days: hrSettings.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        standard_work_hours: hrSettings.standard_work_hours || 8.25,
        lunch_minutes: hrSettings.lunch_minutes || 45,
        total_office_hours: hrSettings.total_office_hours || 9,
        grace_period_minutes: hrSettings.grace_period_minutes || 15,
      });
    }
  }, [hrSettings]);

  useEffect(() => {
    if (calendar) {
      // Load approved holidays from calendar
      const calHolidays = calendar.holidays || [];
      setHolidays(calHolidays);
      setApprovedHolidays(calHolidays.filter(h => h.approved));
      setSpecialWorkingDays(calendar.special_working_days || []);
    }
    
    // Initialize allHolidays with default Indian holidays for the selected year
    const yearHolidays = defaultIndianHolidays
      .filter(h => h.date.startsWith(String(year)))
      .map(h => ({
        ...h,
        approved: (calendar?.holidays || []).some(ch => ch.date === h.date && ch.approved)
      }));
    
    // Add any custom holidays from calendar that aren't in the default list
    const customHolidays = (calendar?.holidays || [])
      .filter(ch => !defaultIndianHolidays.some(dh => dh.date === ch.date))
      .filter(ch => ch.date.startsWith(String(year)));
    
    setAllHolidays([...yearHolidays, ...customHolidays]);
  }, [calendar, year]);

  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Generate calendar grid for the month
  const generateCalendarGrid = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    const grid = [];
    const today = new Date();
    
    // Add empty cells for days before the first day
    for (let i = 0; i < startDayOfWeek; i++) {
      grid.push({ date: null, day: null });
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      const isSunday = dayOfWeek === 0;
      const isToday = date.toDateString() === today.toDateString();
      
      // Check if it's an approved holiday
      const holiday = approvedHolidays.find(h => h.date === dateStr);
      
      // Check if Sunday is marked as a special working day
      const isSpecialWorkingDay = specialWorkingDays.includes(dateStr);
      
      // Sunday is a holiday unless it's a special working day
      const isSundayHoliday = isSunday && !isSpecialWorkingDay;
      
      grid.push({
        date: dateStr,
        day: day,
        isSunday,
        isToday,
        isHoliday: !!holiday || isSundayHoliday,
        holidayName: holiday?.name || (isSundayHoliday ? 'Sunday' : null),
        dayOfWeek,
        isSpecialWorkingDay
      });
    }
    
    return grid;
  };

  const calendarGrid = generateCalendarGrid();

  const handleSaveSettings = async () => {
    await onUpdateSettings(formData);
    setEditingSettings(false);
    loadHRSettings();
    toast.success('Work settings saved!');
  };

  // Approve a holiday - adds it to the calendar
  const handleApproveHoliday = (holiday) => {
    const updatedHoliday = { ...holiday, approved: true };
    const updatedAllHolidays = allHolidays.map(h => 
      h.date === holiday.date ? updatedHoliday : h
    );
    setAllHolidays(updatedAllHolidays);
    
    // Update approved holidays list
    const newApproved = [...approvedHolidays.filter(h => h.date !== holiday.date), updatedHoliday];
    setApprovedHolidays(newApproved);
    
    // Save to backend
    onUpdateCalendar({ 
      holidays: newApproved, 
      special_working_days: specialWorkingDays 
    });
    toast.success(`${holiday.name} approved and added to calendar!`);
  };

  // Edit a holiday
  const handleEditHoliday = (holiday) => {
    setEditingHoliday({ ...holiday });
  };

  // Save edited holiday
  const handleSaveEditHoliday = () => {
    if (!editingHoliday.name || !editingHoliday.date) return;
    
    const updatedAllHolidays = allHolidays.map(h => 
      h.date === editingHoliday.originalDate ? { ...editingHoliday, originalDate: undefined } : h
    );
    setAllHolidays(updatedAllHolidays);
    
    // Update in approved if it was approved
    if (editingHoliday.approved) {
      const newApproved = approvedHolidays.map(h => 
        h.date === editingHoliday.originalDate ? { ...editingHoliday, originalDate: undefined } : h
      );
      setApprovedHolidays(newApproved);
      onUpdateCalendar({ 
        holidays: newApproved, 
        special_working_days: specialWorkingDays 
      });
    }
    
    setEditingHoliday(null);
    toast.success('Holiday updated!');
  };

  // Add new custom holiday
  const handleAddCustomHoliday = () => {
    if (!newHoliday.date || !newHoliday.name) {
      toast.error('Please enter date and name');
      return;
    }
    
    const newH = { ...newHoliday, type: 'custom', approved: false };
    setAllHolidays([...allHolidays, newH]);
    setNewHoliday({ date: '', name: '' });
    toast.success('Holiday added! Click Approve to add it to the calendar.');
  };

  // Remove unapproved holiday from calendar
  const handleUnapproveHoliday = (holiday) => {
    const updatedAllHolidays = allHolidays.map(h => 
      h.date === holiday.date ? { ...h, approved: false } : h
    );
    setAllHolidays(updatedAllHolidays);
    
    const newApproved = approvedHolidays.filter(h => h.date !== holiday.date);
    setApprovedHolidays(newApproved);
    
    onUpdateCalendar({ 
      holidays: newApproved, 
      special_working_days: specialWorkingDays 
    });
    toast.success(`${holiday.name} removed from calendar`);
  };

  // Sunday popup state
  const [showSundayModal, setShowSundayModal] = useState(false);
  const [selectedSunday, setSelectedSunday] = useState(null);
  const [sundayRemarks, setSundayRemarks] = useState('');

  // Toggle a day as working day (for Sundays) - from modal
  const handleToggleWorkingDay = (dateStr, isSunday, action = 'toggle') => {
    if (!isSunday) return; // Only Sundays can be toggled
    
    let updated;
    if (action === 'working') {
      // Make it a working day
      updated = [...specialWorkingDays.filter(d => d !== dateStr), dateStr];
    } else if (action === 'holiday') {
      // Make it a holiday (remove from special working days)
      updated = specialWorkingDays.filter(d => d !== dateStr);
    } else {
      // Toggle behavior (fallback)
      if (specialWorkingDays.includes(dateStr)) {
        updated = specialWorkingDays.filter(d => d !== dateStr);
      } else {
        updated = [...specialWorkingDays, dateStr];
      }
    }
    setSpecialWorkingDays(updated);
    
    onUpdateCalendar({ 
      holidays: approvedHolidays, 
      special_working_days: updated 
    });
    
    setShowSundayModal(false);
    setSelectedSunday(null);
    setSundayRemarks('');
    toast.success(updated.includes(dateStr) ? 'Marked as working day' : 'Marked as holiday');
  };

  // Open Sunday modal
  const handleSundayClick = (day) => {
    if (day.isSunday) {
      setSelectedSunday(day);
      setSundayRemarks('');
      setShowSundayModal(true);
    }
  };

  // Calculate work hours display
  const formatWorkHours = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeSubTab === 'calendar' ? 'default' : 'outline'}
          onClick={() => setActiveSubTab('calendar')}
          className={activeSubTab === 'calendar' ? 'bg-[#6366f1]' : ''}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Calendar View
        </Button>
        <Button
          variant={activeSubTab === 'settings' ? 'default' : 'outline'}
          onClick={() => setActiveSubTab('settings')}
          className={activeSubTab === 'settings' ? 'bg-[#6366f1]' : ''}
        >
          <Settings className="h-4 w-4 mr-2" />
          Work Settings
        </Button>
        <Button
          variant={activeSubTab === 'holidays' ? 'default' : 'outline'}
          onClick={() => setActiveSubTab('holidays')}
          className={activeSubTab === 'holidays' ? 'bg-[#6366f1]' : ''}
        >
          <Globe className="h-4 w-4 mr-2" />
          Holidays
        </Button>
      </div>

      {/* Calendar View */}
      {activeSubTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className={`px-3 py-2 rounded-md ${bgSecondary} ${borderColor} ${textPrimary}`}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className={`w-24 ${bgSecondary} ${borderColor}`}
              min="2020"
              max="2030"
            />
            <Button onClick={onRefresh} variant="outline" className={borderColor}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <div className={`text-sm ${textSecondary} flex items-center gap-4`}>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#ef4444]/30"></span> Holiday</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#6366f1]/30"></span> Sunday (Holiday)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#22c55e]/30"></span> Working Sunday</span>
            </div>
          </div>

          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className={`text-center font-medium py-2 text-sm ${day === 'Sun' ? 'text-[#6366f1]' : textSecondary}`}>{day}</div>
                ))}
                {calendarGrid.map((day, idx) => (
                  <div
                    key={idx}
                    onClick={() => day.date && day.isSunday && handleSundayClick(day)}
                    data-testid={day.isSunday ? `sunday-cell-${day.date}` : undefined}
                    className={`p-2 min-h-[60px] rounded text-center transition-colors ${day.isSunday ? 'cursor-pointer' : ''} ${
                      !day.date ? '' :
                      day.isSpecialWorkingDay ? 'bg-[#22c55e]/20 hover:bg-[#22c55e]/30' :
                      day.isHoliday && day.holidayName !== 'Sunday' ? 'bg-[#ef4444]/20' :
                      day.isSunday ? 'bg-[#6366f1]/20 hover:bg-[#6366f1]/30' :
                      `${bgSecondary} hover:bg-[#6366f1]/10`
                    } ${day.isToday ? 'ring-2 ring-[#6366f1]' : ''}`}
                  >
                    {day.date && (
                      <>
                        <div className={`text-sm font-medium ${
                          day.isSpecialWorkingDay ? 'text-[#22c55e]' :
                          day.isHoliday ? 'text-[#ef4444]' : 
                          day.isSunday ? 'text-[#6366f1]' : textPrimary
                        }`}>{day.day}</div>
                        {day.isHoliday && day.holidayName && (
                          <div className={`text-[10px] truncate ${day.isSunday && !day.isSpecialWorkingDay ? 'text-[#6366f1]' : 'text-[#ef4444]'}`}>
                            {day.holidayName}
                          </div>
                        )}
                        {day.isSpecialWorkingDay && (
                          <div className="text-[10px] text-[#22c55e]">Working</div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className={`mt-4 p-3 rounded ${bgSecondary} text-sm ${textSecondary}`}>
                <strong>Tip:</strong> Click on any Sunday to configure it as a working day, team holiday, or add remarks.
              </div>
            </CardContent>
          </Card>

          {/* Sunday Configuration Modal */}
          {showSundayModal && selectedSunday && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className={`${bgCard} border ${borderColor} w-full max-w-md`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                    <Calendar className="h-5 w-5 text-[#6366f1]" />
                    Configure Sunday
                  </CardTitle>
                  <Button variant="ghost" onClick={() => setShowSundayModal(false)} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Date Display */}
                  <div className={`p-4 rounded-lg ${bgSecondary} text-center`}>
                    <p className={`text-2xl font-bold ${textPrimary}`}>
                      {new Date(selectedSunday.date).toLocaleDateString('en-IN', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </p>
                    <p className={`text-sm mt-1 ${textSecondary}`}>
                      Currently: {selectedSunday.isSpecialWorkingDay ? 'Working Day' : 'Holiday'}
                    </p>
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    <p className={`font-medium ${textPrimary}`}>Set this Sunday as:</p>
                    
                    <button
                      onClick={() => handleToggleWorkingDay(selectedSunday.date, true, 'working')}
                      className={`w-full p-4 rounded-lg border-2 flex items-center gap-3 transition-colors ${
                        selectedSunday.isSpecialWorkingDay 
                          ? 'border-[#22c55e] bg-[#22c55e]/10' 
                          : `border-[#3f3f46] ${bgSecondary} hover:border-[#22c55e]`
                      }`}
                      data-testid="set-working-day-btn"
                    >
                      <div className="h-10 w-10 rounded-full bg-[#22c55e]/20 flex items-center justify-center">
                        <Briefcase className="h-5 w-5 text-[#22c55e]" />
                      </div>
                      <div className="text-left">
                        <p className={`font-medium ${textPrimary}`}>Working Day</p>
                        <p className={`text-sm ${textSecondary}`}>Mark this Sunday as a working day</p>
                      </div>
                      {selectedSunday.isSpecialWorkingDay && (
                        <CheckCircle className="h-5 w-5 text-[#22c55e] ml-auto" />
                      )}
                    </button>

                    <button
                      onClick={() => handleToggleWorkingDay(selectedSunday.date, true, 'holiday')}
                      className={`w-full p-4 rounded-lg border-2 flex items-center gap-3 transition-colors ${
                        !selectedSunday.isSpecialWorkingDay 
                          ? 'border-[#6366f1] bg-[#6366f1]/10' 
                          : `border-[#3f3f46] ${bgSecondary} hover:border-[#6366f1]`
                      }`}
                      data-testid="set-holiday-btn"
                    >
                      <div className="h-10 w-10 rounded-full bg-[#6366f1]/20 flex items-center justify-center">
                        <Home className="h-5 w-5 text-[#6366f1]" />
                      </div>
                      <div className="text-left">
                        <p className={`font-medium ${textPrimary}`}>Holiday</p>
                        <p className={`text-sm ${textSecondary}`}>Keep this Sunday as a regular holiday</p>
                      </div>
                      {!selectedSunday.isSpecialWorkingDay && (
                        <CheckCircle className="h-5 w-5 text-[#6366f1] ml-auto" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        // Add as a team holiday with custom name
                        const customHoliday = {
                          date: selectedSunday.date,
                          name: 'Team Holiday',
                          type: 'team_holiday',
                          approved: true
                        };
                        const newApproved = [...approvedHolidays.filter(h => h.date !== selectedSunday.date), customHoliday];
                        setApprovedHolidays(newApproved);
                        onUpdateCalendar({ 
                          holidays: newApproved, 
                          special_working_days: specialWorkingDays.filter(d => d !== selectedSunday.date) 
                        });
                        setShowSundayModal(false);
                        toast.success('Marked as Team Holiday');
                      }}
                      className={`w-full p-4 rounded-lg border-2 flex items-center gap-3 transition-colors border-[#3f3f46] ${bgSecondary} hover:border-[#ef4444]`}
                      data-testid="set-team-holiday-btn"
                    >
                      <div className="h-10 w-10 rounded-full bg-[#ef4444]/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-[#ef4444]" />
                      </div>
                      <div className="text-left">
                        <p className={`font-medium ${textPrimary}`}>Team Holiday</p>
                        <p className={`text-sm ${textSecondary}`}>Mark as a special team holiday</p>
                      </div>
                    </button>
                  </div>

                  {/* Remarks */}
                  <div>
                    <Label className={textPrimary}>Remarks (Optional)</Label>
                    <textarea
                      value={sundayRemarks}
                      onChange={(e) => setSundayRemarks(e.target.value)}
                      placeholder="Add any notes or remarks..."
                      rows={2}
                      className={`w-full mt-1 px-3 py-2 rounded-md ${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Work Settings */}
      {activeSubTab === 'settings' && (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className={`text-lg font-semibold ${textPrimary}`}>Work Settings</h3>
              {!editingSettings && (
                <Button onClick={() => setEditingSettings(true)} className="bg-[#6366f1]">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Settings
                </Button>
              )}
            </div>

            {/* Work Hours Summary Card */}
            <Card className={`${bgSecondary} border ${borderColor}`}>
              <CardContent className="p-4">
                <h4 className={`font-medium ${textPrimary} mb-3`}>Work Hours Summary</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className={`text-2xl font-bold text-[#6366f1]`}>{formatWorkHours(formData.total_office_hours)}</div>
                    <div className={`text-sm ${textSecondary}`}>Total Office Hours</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold text-[#22c55e]`}>{formatWorkHours(formData.standard_work_hours)}</div>
                    <div className={`text-sm ${textSecondary}`}>Work Hours</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold text-[#f59e0b]`}>{formData.lunch_minutes}m</div>
                    <div className={`text-sm ${textSecondary}`}>Lunch Break</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label className={textPrimary}>Office Start Time</Label>
                <Input
                  type="time"
                  value={formData.standard_login_time}
                  onChange={(e) => setFormData({ ...formData, standard_login_time: e.target.value })}
                  disabled={!editingSettings}
                  className={`${bgSecondary} ${borderColor} ${textPrimary}`}
                />
              </div>
              <div>
                <Label className={textPrimary}>Office End Time</Label>
                <Input
                  type="time"
                  value={formData.standard_logout_time}
                  onChange={(e) => setFormData({ ...formData, standard_logout_time: e.target.value })}
                  disabled={!editingSettings}
                  className={`${bgSecondary} ${borderColor} ${textPrimary}`}
                />
              </div>
              <div>
                <Label className={textPrimary}>Total Office Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.total_office_hours}
                  onChange={(e) => {
                    const total = parseFloat(e.target.value);
                    const lunchHours = formData.lunch_minutes / 60;
                    setFormData({ 
                      ...formData, 
                      total_office_hours: total,
                      standard_work_hours: total - lunchHours
                    });
                  }}
                  disabled={!editingSettings}
                  className={`${bgSecondary} ${borderColor} ${textPrimary}`}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>Total time in office including lunch</p>
              </div>
              <div>
                <Label className={textPrimary}>Lunch Break (minutes)</Label>
                <Input
                  type="number"
                  value={formData.lunch_minutes}
                  onChange={(e) => {
                    const lunch = parseInt(e.target.value);
                    const lunchHours = lunch / 60;
                    setFormData({ 
                      ...formData, 
                      lunch_minutes: lunch,
                      standard_work_hours: formData.total_office_hours - lunchHours
                    });
                  }}
                  disabled={!editingSettings}
                  className={`${bgSecondary} ${borderColor} ${textPrimary}`}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>Lunch break duration</p>
              </div>
              <div>
                <Label className={textPrimary}>Effective Work Hours</Label>
                <Input
                  type="number"
                  step="0.25"
                  value={formData.standard_work_hours}
                  disabled={true}
                  className={`${bgSecondary} ${borderColor} ${textPrimary} opacity-60`}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>Auto-calculated: Total - Lunch</p>
              </div>
              <div>
                <Label className={textPrimary}>Grace Period (minutes)</Label>
                <Input
                  type="number"
                  value={formData.grace_period_minutes}
                  onChange={(e) => setFormData({ ...formData, grace_period_minutes: parseInt(e.target.value) })}
                  disabled={!editingSettings}
                  className={`${bgSecondary} ${borderColor} ${textPrimary}`}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>Late arrival tolerance</p>
              </div>
            </div>

            <div>
              <Label className={textPrimary}>Working Days</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {allDays.map(day => (
                  <button
                    key={day}
                    type="button"
                    disabled={!editingSettings}
                    onClick={() => {
                      if (editingSettings) {
                        setFormData(prev => ({
                          ...prev,
                          working_days: prev.working_days.includes(day)
                            ? prev.working_days.filter(d => d !== day)
                            : [...prev.working_days, day]
                        }));
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      formData.working_days.includes(day)
                        ? 'bg-[#22c55e] text-white'
                        : `${bgSecondary} ${textSecondary}`
                    } ${!editingSettings ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {editingSettings && (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditingSettings(false)}>Cancel</Button>
                <Button onClick={handleSaveSettings} className="bg-[#22c55e] hover:bg-[#16a34a]">
                  Save Changes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Holidays - with Edit & Approve */}
      {activeSubTab === 'holidays' && (
        <div className="space-y-4">
          {/* Month/Year Filter */}
          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className={`px-3 py-2 rounded-md ${bgSecondary} ${borderColor} ${textPrimary}`}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className={`w-24 ${bgSecondary} ${borderColor}`}
              min="2020"
              max="2030"
            />
          </div>

          {/* Add Custom Holiday */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <h4 className={`font-medium ${textPrimary} mb-3`}>Add Custom Holiday</h4>
              <div className="flex gap-3 flex-wrap">
                <Input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  className={`${bgSecondary} ${borderColor} w-40`}
                />
                <Input
                  placeholder="Holiday name"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  className={`${bgSecondary} ${borderColor} flex-1 min-w-[200px]`}
                />
                <Button onClick={handleAddCustomHoliday} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holiday
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Holidays List */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Holidays {year}</h3>
                <div className={`text-sm ${textSecondary}`}>
                  <span className="text-[#22c55e]">{allHolidays.filter(h => h.approved).length} Approved</span>
                  {' / '}
                  <span>{allHolidays.filter(h => {
                    // Filter by selected month
                    const holidayMonth = new Date(h.date).getMonth() + 1;
                    return holidayMonth === month;
                  }).length} This Month</span>
                </div>
              </div>
              
              <div className="space-y-3">
                {allHolidays.filter(h => {
                  // Filter by selected month and year
                  const holidayDate = new Date(h.date);
                  return holidayDate.getMonth() + 1 === month && holidayDate.getFullYear() === year;
                }).length > 0 ? allHolidays.filter(h => {
                  const holidayDate = new Date(h.date);
                  return holidayDate.getMonth() + 1 === month && holidayDate.getFullYear() === year;
                }).map((holiday, idx) => (
                  <div key={idx} className={`p-4 rounded-lg ${bgSecondary} ${holiday.approved ? 'border-l-4 border-[#22c55e]' : ''}`}>
                    {editingHoliday?.date === holiday.date ? (
                      // Edit Mode
                      <div className="flex items-center gap-3 flex-wrap">
                        <Input
                          type="date"
                          value={editingHoliday.date}
                          onChange={(e) => setEditingHoliday({ ...editingHoliday, date: e.target.value })}
                          className={`${bgCard} ${borderColor} w-40`}
                        />
                        <Input
                          value={editingHoliday.name}
                          onChange={(e) => setEditingHoliday({ ...editingHoliday, name: e.target.value })}
                          className={`${bgCard} ${borderColor} flex-1`}
                        />
                        <Button size="sm" onClick={handleSaveEditHoliday} className="bg-[#22c55e]">
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingHoliday(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${textPrimary}`}>{holiday.name}</span>
                            {holiday.type === 'custom' && (
                              <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs">Custom</Badge>
                            )}
                            {holiday.approved && (
                              <Badge className="bg-[#22c55e]/20 text-[#22c55e] text-xs">Approved</Badge>
                            )}
                          </div>
                          <div className={`text-sm ${textSecondary}`}>
                            {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-IN', { 
                              weekday: 'long', 
                              day: 'numeric', 
                              month: 'long' 
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleEditHoliday({ ...holiday, originalDate: holiday.date })}
                            className="h-8"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {holiday.approved ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleUnapproveHoliday(holiday)}
                              className="h-8 text-[#ef4444] border-[#ef4444]"
                            >
                              Remove
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => handleApproveHoliday(holiday)}
                              className="h-8 bg-[#22c55e] hover:bg-[#16a34a]"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className={`text-center py-8 ${textSecondary}`}>
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No holidays for {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year}</p>
                  </div>
                )}
              </div>
              
              <div className={`mt-4 p-3 rounded ${bgSecondary} text-sm ${textSecondary}`}>
                <strong>How it works:</strong> Edit holiday details if needed, then click "Approve" to add it to the Calendar View. Only approved holidays will be marked on the calendar.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


