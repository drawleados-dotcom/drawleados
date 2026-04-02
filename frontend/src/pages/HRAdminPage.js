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
  Home, Building, Edit, Search, UserPlus, X, Trash2,
  AlertCircle, TrendingUp, Eye, EyeOff, FileText, Plus,
  Briefcase, CreditCard, FolderOpen, Shield, Mail, Key, Link, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

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
  { value: 'leads', label: 'Leads', icon: Users },
  { value: 'operations', label: 'Operations', icon: Briefcase },
  { value: 'hr', label: 'HR', icon: Users },
  { value: 'hr_admin', label: 'HR Admin', icon: Shield },
  { value: 'finance', label: 'Finance', icon: CreditCard },
  { value: 'settings', label: 'Settings', icon: Shield },
  { value: 'reports', label: 'Reports', icon: FileText },
];

export default function HRAdminPage() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
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
  
  // All attendance state
  const [allAttendance, setAllAttendance] = useState([]);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth() + 1);
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());
  
  // Calendar/Holidays state
  const [calendar, setCalendar] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  
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

  const loadPayslips = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API}/api/hr/admin/payslips?month=${payslipMonth}&year=${payslipYear}`, 
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

  useEffect(() => {
    // Always load designations and departments for Add Employee form
    loadDesignations();
    loadDepartments();
  }, [loadDesignations, loadDepartments]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadStats();
      loadAttendanceOverview();
    } else if (activeTab === 'employees') {
      loadEmployees();
    } else if (activeTab === 'requests') {
      loadLeaveRequests();
    } else if (activeTab === 'attendance') {
      loadAttendanceOverview();
    } else if (activeTab === 'approvals') {
      loadPendingApprovals();
    } else if (activeTab === 'all-attendance') {
      loadAllAttendance();
      loadEmployees();
    } else if (activeTab === 'calendar') {
      loadCalendar();
    } else if (activeTab === 'payslips') {
      loadPayslips();
      loadEmployees();
    } else if (activeTab === 'settings') {
      loadHRSettings();
    } else if (activeTab === 'designations') {
      loadDesignations();
    } else if (activeTab === 'departments') {
      loadDepartments();
    }
  }, [activeTab, loadStats, loadEmployees, loadLeaveRequests, loadAttendanceOverview, loadPendingApprovals, loadAllAttendance, loadCalendar, loadPayslips, loadHRSettings]);

  useEffect(() => {
    if (activeTab === 'requests') {
      loadLeaveRequests();
    }
  }, [leaveFilter, loadLeaveRequests, activeTab]);

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

  const handleGeneratePayslip = async (userId) => {
    try {
      const res = await axios.post(
        `${API}/api/hr/admin/payslip/generate`,
        { user_id: userId, month: payslipMonth, year: payslipYear },
        { headers }
      );
      toast.success('Payslip generated successfully');
      loadPayslips();
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
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'designations', label: 'Designations', icon: Briefcase },
    { id: 'departments', label: 'Departments', icon: Building },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle },
    { id: 'requests', label: 'Leave Requests', icon: Calendar },
    { id: 'all-attendance', label: 'All Attendance', icon: Clock },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'payslips', label: 'Payslips', icon: FileText },
    { id: 'settings', label: 'Work Settings', icon: Clock },
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
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#6366f1] text-white'
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
        {activeTab === 'dashboard' && (
          <DashboardTab 
            stats={stats} 
            attendanceOverview={attendanceOverview} 
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeesTab
            employees={filteredEmployees}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onEdit={(emp) => { setSelectedEmployee(emp); setShowEditModal(true); }}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'requests' && (
          <LeaveRequestsTab
            requests={leaveRequests}
            filter={leaveFilter}
            setFilter={setLeaveFilter}
            onApprove={handleApprove}
            onReject={handleReject}
            formatDate={formatDate}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceTab
            overview={attendanceOverview}
            formatTime={formatTime}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'approvals' && (
          <ApprovalsTab
            pendingApprovals={pendingApprovals}
            onApproveAttendance={handleApproveAttendance}
            onApprovePermission={handleApprovePermission}
            onApproveLeave={handleApprove}
            onRejectLeave={handleReject}
            formatDate={formatDate}
            formatTime={formatTime}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'all-attendance' && (
          <AllAttendanceTab
            records={allAttendance}
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
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarTab
            calendar={calendar}
            month={calendarMonth}
            year={calendarYear}
            setMonth={setCalendarMonth}
            setYear={setCalendarYear}
            onUpdate={handleUpdateCalendar}
            onRefresh={loadCalendar}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'payslips' && (
          <PayslipsTab
            payslips={payslips}
            employees={employees}
            month={payslipMonth}
            year={payslipYear}
            setMonth={setPayslipMonth}
            setYear={setPayslipYear}
            onGenerate={handleGeneratePayslip}
            onAction={handlePayslipAction}
            onRefresh={loadPayslips}
            formatDate={formatDate}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {/* Designations Tab */}
        {activeTab === 'designations' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className={`text-xl font-semibold ${textPrimary}`}>Designations</h2>
              <Button onClick={() => setShowDesignationModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                <Plus className="h-4 w-4 mr-2" />
                Add Designation
              </Button>
            </div>
            
            {/* Designations List */}
            <div className="grid gap-4">
              {designations.length > 0 ? designations.map((desg) => (
                <Card key={desg.designation_id} className={`${bgCard} border ${borderColor}`}>
                  <CardContent className="p-4">
                    {editingDesignation?.designation_id === desg.designation_id ? (
                      // Edit Mode
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
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
                              value={editingDesignation.description}
                              onChange={(e) => setEditingDesignation(prev => ({ ...prev, description: e.target.value }))}
                              className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className={textPrimary}>Roles & Responsibilities</Label>
                          <textarea
                            value={editingDesignation.roles_responsibilities}
                            onChange={(e) => setEditingDesignation(prev => ({ ...prev, roles_responsibilities: e.target.value }))}
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
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" onClick={() => setEditingDesignation(null)}>Cancel</Button>
                          <Button onClick={handleUpdateDesignation} className="bg-[#10b981] hover:bg-[#059669]">Save</Button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className={`text-lg font-semibold ${textPrimary}`}>{desg.title}</h3>
                          {desg.description && <p className={`text-sm ${textSecondary} mt-1`}>{desg.description}</p>}
                          {desg.roles_responsibilities && (
                            <div className="mt-2">
                              <span className={`text-xs ${textSecondary}`}>Responsibilities:</span>
                              <p className={`text-sm ${textPrimary} whitespace-pre-wrap`}>{desg.roles_responsibilities}</p>
                            </div>
                          )}
                          {desg.module_access?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {desg.module_access.map(m => (
                                <Badge key={m} className="bg-[#6366f1]/20 text-[#6366f1]">{m}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingDesignation(desg)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => handleDeleteDesignation(desg.designation_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )) : (
                <Card className={`${bgCard} border ${borderColor}`}>
                  <CardContent className="p-8 text-center">
                    <Briefcase className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                    <p className={textSecondary}>No designations created yet</p>
                    <p className={`text-sm ${textSecondary}`}>Add designations to define employee roles and access</p>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Add Designation Modal */}
            {showDesignationModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4`}>
                  <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                      <Briefcase className="h-5 w-5 text-[#6366f1]" />
                      Add New Designation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className={textPrimary}>Designation Title *</Label>
                      <Input
                        value={newDesignation.title}
                        onChange={(e) => setNewDesignation(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., Senior Developer"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Description</Label>
                      <Input
                        value={newDesignation.description}
                        onChange={(e) => setNewDesignation(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description of the role"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Roles & Responsibilities</Label>
                      <textarea
                        value={newDesignation.roles_responsibilities}
                        onChange={(e) => setNewDesignation(prev => ({ ...prev, roles_responsibilities: e.target.value }))}
                        placeholder="List the key responsibilities..."
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
                    <div className="flex gap-2 justify-end pt-4">
                      <Button variant="ghost" onClick={() => setShowDesignationModal(false)}>Cancel</Button>
                      <Button onClick={handleCreateDesignation} className="bg-[#6366f1] hover:bg-[#4f46e5]">Create Designation</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Departments Tab */}
        {activeTab === 'departments' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className={`text-xl font-semibold ${textPrimary}`}>Departments</h2>
              <Button onClick={() => setShowDepartmentModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
                <Plus className="h-4 w-4 mr-2" />
                Add Department
              </Button>
            </div>
            
            {/* Departments List */}
            <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
              <table className="w-full">
                <thead className={bgSecondary}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>S.No</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Department Name</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Description</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3f3f46]">
                  {departments.length > 0 ? departments.map((dept, index) => (
                    <tr key={dept.department_id} className={bgCard}>
                      <td className={`px-4 py-3 text-sm ${textPrimary}`}>{index + 1}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${textPrimary}`}>{dept.name}</td>
                      <td className={`px-4 py-3 text-sm ${textSecondary}`}>{dept.description || '-'}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => handleDeleteDepartment(dept.department_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className={`px-4 py-8 text-center ${textSecondary}`}>
                        <Building className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                        <p>No departments created yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Add Department Modal */}
            {showDepartmentModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4`}>
                  <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                      <Building className="h-5 w-5 text-[#6366f1]" />
                      Add New Department
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className={textPrimary}>Department Name *</Label>
                      <Input
                        value={newDepartment.name}
                        onChange={(e) => setNewDepartment(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Engineering"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div>
                      <Label className={textPrimary}>Description</Label>
                      <Input
                        value={newDepartment.description}
                        onChange={(e) => setNewDepartment(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-4">
                      <Button variant="ghost" onClick={() => setShowDepartmentModal(false)}>Cancel</Button>
                      <Button onClick={handleCreateDepartment} className="bg-[#6366f1] hover:bg-[#4f46e5]">Create Department</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Work Settings Tab */}
        {activeTab === 'settings' && (
          <WorkSettingsTab
            settings={hrSettings}
            onUpdate={handleUpdateHRSettings}
            onRefresh={loadHRSettings}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
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
function EmployeesTab({ employees, searchQuery, setSearchQuery, onEdit, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  return (
    <div className="space-y-6">
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

      {/* Employee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((emp) => (
          <Card key={emp.user_id} className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-lg font-bold">
                    {emp.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className={`font-semibold ${textPrimary}`}>{emp.name}</p>
                    <p className={`text-xs ${textSecondary}`}>{emp.email}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onEdit(emp)}
                  className={`${bgSecondary} hover:bg-[#3f3f46]`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={textSecondary}>Role</span>
                  <Badge className="bg-[#6366f1]/20 text-[#6366f1]">{emp.role}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className={textSecondary}>Department</span>
                  <span className={textPrimary}>{emp.profile?.department || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={textSecondary}>Designation</span>
                  <span className={textPrimary}>{emp.profile?.designation || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={textSecondary}>Today</span>
                  {emp.today_attendance ? (
                    <Badge className={emp.today_attendance.work_location === 'home' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}>
                      {emp.today_attendance.work_location === 'home' ? 'WFH' : 'Office'}
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-500/20 text-gray-400">Absent</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============== LEAVE REQUESTS TAB ==============
function LeaveRequestsTab({ requests, filter, setFilter, onApprove, onReject, formatDate, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex gap-2">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <Button
            key={f}
            onClick={() => setFilter(f)}
            className={`${
              filter === f
                ? 'bg-[#6366f1] text-white'
                : `${bgSecondary} ${textSecondary} hover:bg-[#3f3f46]`
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {requests.map((req) => (
          <Card key={req.leave_id} className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
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
                      <Badge className={`${
                        req.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        req.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {req.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {req.status === 'pending' && (
                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={() => onApprove(req.leave_id)}
                      className="bg-[#10b981] hover:bg-[#059669] text-white"
                    >
                      <CheckCircle className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => onReject(req.leave_id)}
                      className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {requests.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-[#3f3f46] mx-auto mb-4" />
            <p className={textSecondary}>No {filter !== 'all' ? filter : ''} leave requests</p>
          </div>
        )}
      </div>
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
  const [formData, setFormData] = useState({
    full_name: employee.profile?.full_name || employee.name || '',
    email: employee.profile?.email || employee.email || '',
    phone: employee.profile?.phone || '',
    designation: employee.profile?.designation || '',
    department: employee.profile?.department || '',
    employment_type: employee.profile?.employment_type || 'full-time',
    joining_date: employee.profile?.joining_date ? employee.profile.joining_date.split('T')[0] : '',
    reporting_manager: employee.profile?.reporting_manager || '',
    address: employee.profile?.address || '',
    city: employee.profile?.city || '',
    state: employee.profile?.state || '',
    pincode: employee.profile?.pincode || '',
    bank_name: employee.profile?.bank_name || '',
    account_number: employee.profile?.account_number || '',
    ifsc_code: employee.profile?.ifsc_code || '',
    pan_number: employee.profile?.pan_number || '',
    emergency_contact_name: employee.profile?.emergency_contact_name || '',
    emergency_contact_phone: employee.profile?.emergency_contact_phone || '',
    emergency_contact_relation: employee.profile?.emergency_contact_relation || '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className={`${bgCard} border ${borderColor} w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className={textPrimary}>Edit Employee Profile</CardTitle>
          <Button variant="ghost" onClick={onClose} className={textSecondary}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Info */}
            <div>
              <h3 className={`text-sm font-medium ${textSecondary} mb-3`}>Personal Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={textPrimary}>Full Name</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Email</Label>
                  <Input
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
              </div>
            </div>

            {/* Employment Info */}
            <div>
              <h3 className={`text-sm font-medium ${textSecondary} mb-3`}>Employment Details</h3>
              <div className="grid grid-cols-2 gap-4">
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
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={onClose}
                className={`flex-1 ${bgSecondary} hover:bg-[#3f3f46] ${textPrimary}`}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
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
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    if (calendar) {
      setHolidays(calendar.holidays || []);
      setWorkingDays(calendar.working_days || 22);
    }
  }, [calendar]);

  const handleAddHoliday = () => {
    if (newHoliday.date && newHoliday.name) {
      setHolidays([...holidays, newHoliday]);
      setNewHoliday({ date: '', name: '' });
    }
  };

  const handleRemoveHoliday = (index) => {
    setHolidays(holidays.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onUpdate({ holidays, working_days: workingDays });
  };

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-4">
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
                  onChange={(e) => setWorkingDays(parseInt(e.target.value))}
                  className={`w-32 ${bgSecondary} border ${borderColor} ${textPrimary}`}
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
              {/* Add Holiday */}
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
              
              {/* Holiday List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {holidays.map((h, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-2 ${bgSecondary} rounded`}>
                    <div>
                      <span className={textPrimary}>{h.name}</span>
                      <span className={`ml-2 text-sm ${textSecondary}`}>({h.date})</span>
                    </div>
                    <Button variant="ghost" onClick={() => handleRemoveHoliday(idx)} className="text-red-400 hover:text-red-300">
                      <XCircle className="h-4 w-4" />
                    </Button>
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

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-8">
          Save Calendar
        </Button>
      </div>
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
