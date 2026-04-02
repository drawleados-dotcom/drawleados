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
  Home, Building, Edit, Search, UserPlus, X,
  AlertCircle, TrendingUp, Eye, EyeOff, FileText,
  Briefcase, CreditCard, FolderOpen, Shield, Mail, Key
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
  { value: 'finance', label: 'Finance', icon: CreditCard },
  { value: 'settings', label: 'Settings', icon: Shield },
  { value: 'reports', label: 'Reports', icon: FileText },
];

export default function HRAdminPage() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const token = localStorage.getItem('session_token');
  
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
    }
  }, [activeTab, loadStats, loadEmployees, loadLeaveRequests, loadAttendanceOverview]);

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

  const handleCreateEmployee = async (employeeData) => {
    try {
      await axios.post(`${API}/api/hr/admin/create-employee`, employeeData, { headers });
      toast.success('Employee created successfully! Login credentials sent.');
      setShowAddModal(false);
      loadEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create employee');
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
    { id: 'requests', label: 'Leave Requests', icon: Calendar },
    { id: 'attendance', label: 'Attendance', icon: Clock },
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
function AddEmployeeModal({ onClose, onSave, isDark, bgCard, bgInput, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    // Basic Details
    full_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    blood_group: '',
    // Account Details
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    pan_number: '',
    aadhar_number: '',
    // Employment Details
    employee_id: '',
    designation: '',
    department: '',
    employment_type: 'full-time',
    joining_date: '',
    reporting_manager: '',
    work_location: 'office',
    // Documents
    resume_link: '',
    id_proof_link: '',
    address_proof_link: '',
    education_docs_link: '',
    offer_letter_link: '',
    // Role & Access
    role: 'employee',
    module_access: [],
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

  const toggleModule = (module) => {
    setFormData(prev => ({
      ...prev,
      module_access: prev.module_access.includes(module)
        ? prev.module_access.filter(m => m !== module)
        : [...prev.module_access, module]
    }));
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
    if (!formData.full_name || !formData.email || !formData.password) {
      toast.error('Name, Email and Password are required');
      return;
    }
    onSave(formData);
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
                    <Label className={textSecondary}>Bank Name</Label>
                    <Input
                      value={formData.bank_name}
                      onChange={(e) => handleChange('bank_name', e.target.value)}
                      placeholder="e.g., HDFC Bank"
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
                  <Label className={textPrimary}>Designation</Label>
                  <Input
                    value={formData.designation}
                    onChange={(e) => handleChange('designation', e.target.value)}
                    placeholder="e.g., Senior Developer"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Department</Label>
                  <Select value={formData.department} onValueChange={(v) => handleChange('department', v)}>
                    <SelectTrigger className={`${bgInput} border ${borderColor}`}>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent className={`${bgCard} border ${borderColor}`}>
                      <SelectItem value="Engineering">Engineering</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Design">Design</SelectItem>
                      <SelectItem value="Content">Content</SelectItem>
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
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <p className={`text-sm ${textSecondary} mb-4`}>
                Add Google Drive links for employee documents
              </p>
              <div className="space-y-4">
                <div>
                  <Label className={textPrimary}>Resume / CV</Label>
                  <Input
                    value={formData.resume_link}
                    onChange={(e) => handleChange('resume_link', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>ID Proof (Aadhar/Passport)</Label>
                  <Input
                    value={formData.id_proof_link}
                    onChange={(e) => handleChange('id_proof_link', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Address Proof</Label>
                  <Input
                    value={formData.address_proof_link}
                    onChange={(e) => handleChange('address_proof_link', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Education Documents</Label>
                  <Input
                    value={formData.education_docs_link}
                    onChange={(e) => handleChange('education_docs_link', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Offer Letter</Label>
                  <Input
                    value={formData.offer_letter_link}
                    onChange={(e) => handleChange('offer_letter_link', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Role & Access Tab */}
          {activeTab === 'access' && (
            <div className="space-y-6">
              {/* Role Selection */}
              <div>
                <Label className={`${textPrimary} mb-3 block`}>Select Role *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => handleChange('role', role.value)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        formData.role === role.value
                          ? 'border-[#6366f1] bg-[#6366f1]/10'
                          : `border-[#3f3f46] ${bgSecondary} hover:border-[#6366f1]/50`
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: role.color }}
                        />
                        <span className={`text-sm font-medium ${textPrimary}`}>{role.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Module Access */}
              <div>
                <Label className={`${textPrimary} mb-3 block`}>Module Access</Label>
                <div className="grid grid-cols-3 gap-3">
                  {MODULES.map((module) => {
                    const Icon = module.icon;
                    const isChecked = formData.module_access.includes(module.value);
                    return (
                      <div
                        key={module.value}
                        onClick={() => toggleModule(module.value)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? 'border-[#22c55e] bg-[#22c55e]/10'
                            : `border-[#3f3f46] ${bgSecondary} hover:border-[#22c55e]/50`
                        }`}
                      >
                        <Checkbox checked={isChecked} />
                        <Icon className={`h-4 w-4 ${isChecked ? 'text-[#22c55e]' : textSecondary}`} />
                        <span className={`text-sm ${textPrimary}`}>{module.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Login Credentials */}
              <div className={`p-4 ${bgSecondary} rounded-lg`}>
                <h4 className={`font-medium ${textPrimary} mb-3 flex items-center gap-2`}>
                  <Key className="h-4 w-4" />
                  Login Credentials
                </h4>
                <div className="grid grid-cols-2 gap-4">
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
                  These credentials will be shared with the employee for board access.
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
