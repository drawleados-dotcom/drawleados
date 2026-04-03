import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  User, Clock, Calendar, FileText, Award, Download, 
  Home, Building, Square, Send, Shield, Lock, Eye, EyeOff,
  CheckCircle, XCircle, AlertCircle, ChevronRight, Key, Play
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function HRPage() {
  const { isDark } = useTheme();
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState('attendance');
  
  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  
  // Get token from localStorage
  const token = localStorage.getItem('session_token');
  const navigate = useNavigate();
  
  // Attendance state
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  
  // Profile state
  const [profile, setProfile] = useState(null);
  
  // Leave state
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'casual',
    start_date: '',
    end_date: '',
    reason: ''
  });
  
  // Payslips state
  const [payslips, setPayslips] = useState([]);
  
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [wfhRequests, setWfhRequests] = useState([]);
  
  // Counts for tabs
  const [tabCounts, setTabCounts] = useState({
    attendance: 0,
    leave: 0,
    permission: 0,
    remote: 0
  });

  // Calendar state
  const [calendarData, setCalendarData] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateDetail, setDateDetail] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const headers = { Authorization: `Bearer ${token}` };

  const loadTodayAttendance = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/attendance/today`, { headers });
      setTodayAttendance(res.data);
    } catch (error) {
      console.error('Error loading today attendance:', error);
    }
  }, [token]);

  const loadAttendanceHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/attendance/history`, { headers });
      setAttendanceHistory(res.data.records || []);
      setAttendanceSummary(res.data.summary || {});
    } catch (error) {
      console.error('Error loading attendance history:', error);
    }
  }, [token]);

  const loadProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/profile`, { headers });
      setProfile(res.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [token]);

  const loadLeaveRequests = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/leave/my-requests`, { headers });
      setLeaveRequests(res.data);
    } catch (error) {
      console.error('Error loading leave requests:', error);
    }
  }, [token]);

  const loadLeaveBalance = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/leave/balance`, { headers });
      setLeaveBalance(res.data);
    } catch (error) {
      console.error('Error loading leave balance:', error);
    }
  }, [token]);

  const loadPayslips = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/payslips`, { headers });
      setPayslips(res.data);
    } catch (error) {
      console.error('Error loading payslips:', error);
    }
  }, [token]);

  const loadReviews = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/reviews`, { headers });
      setReviews(res.data);
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  }, [token]);

  const loadPermissionRequests = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/permissions/my-requests`, { headers });
      setPermissionRequests(res.data || []);
    } catch (error) {
      console.error('Error loading permission requests:', error);
    }
  }, [token]);

  const loadWfhRequests = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/wfh/my-requests`, { headers });
      setWfhRequests(res.data || []);
    } catch (error) {
      console.error('Error loading WFH requests:', error);
    }
  }, [token]);

  // Load calendar data
  const loadCalendarData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/attendance/calendar/${calendarYear}/${calendarMonth}`, { headers });
      setCalendarData(res.data);
    } catch (error) {
      console.error('Error loading calendar:', error);
    }
  }, [token, calendarYear, calendarMonth]);

  // Load date detail when a date is selected
  const loadDateDetail = useCallback(async (date) => {
    try {
      const res = await axios.get(`${API}/api/hr/attendance/date-detail/${date}`, { headers });
      setDateDetail(res.data);
    } catch (error) {
      console.error('Error loading date detail:', error);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadTodayAttendance();
      loadAttendanceHistory();
    } else if (activeTab === 'calendar') {
      loadCalendarData();
    } else if (activeTab === 'profile') {
      loadProfile();
    } else if (activeTab === 'leave') {
      loadLeaveRequests();
      loadLeaveBalance();
    } else if (activeTab === 'permission') {
      loadPermissionRequests();
    } else if (activeTab === 'remote') {
      loadWfhRequests();
    } else if (activeTab === 'payroll') {
      loadPayslips();
    } else if (activeTab === 'reviews') {
      loadReviews();
    }
  }, [activeTab, loadTodayAttendance, loadAttendanceHistory, loadCalendarData, loadProfile, loadLeaveRequests, loadLeaveBalance, loadPermissionRequests, loadWfhRequests, loadPayslips, loadReviews]);

  // Load tab counts on mount
  useEffect(() => {
    const loadCounts = async () => {
      try {
        // Count attendance records with pending approval
        const attendanceRes = await axios.get(`${API}/api/hr/attendance/history`, { headers });
        const pendingAttendance = (attendanceRes.data.records || []).filter(r => 
          r.approval_status && r.approval_status.includes('pending')
        ).length;
        
        // Count pending leave requests
        const leaveRes = await axios.get(`${API}/api/hr/leave/my-requests`, { headers });
        const pendingLeaves = (leaveRes.data || []).filter(l => l.status === 'pending').length;
        
        // Count pending permission requests
        const permRes = await axios.get(`${API}/api/hr/permissions/my-requests`, { headers });
        const pendingPerms = (permRes.data || []).filter(p => p.status === 'pending').length;
        
        // Count pending WFH requests
        const wfhRes = await axios.get(`${API}/api/hr/wfh/my-requests`, { headers });
        const pendingWfh = (wfhRes.data || []).filter(w => w.status === 'pending').length;
        
        setTabCounts({
          attendance: pendingAttendance,
          leave: pendingLeaves,
          permission: pendingPerms,
          remote: pendingWfh
        });
      } catch (error) {
        console.error('Error loading tab counts:', error);
      }
    };
    loadCounts();
  }, [token]);

  const handleClockIn = async (location) => {
    try {
      await axios.post(`${API}/api/hr/attendance/clock-in`, 
        { work_location: location }, 
        { headers }
      );
      toast.success(`Clocked in - ${location === 'home' ? 'Work from Home' : 'Work from Office'}`);
      loadTodayAttendance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clock in');
    }
  };

  const handleClockOut = async (manualLogoutTime) => {
    try {
      await axios.post(`${API}/api/hr/attendance/clock-out`, 
        { notes: '', manual_logout_time: manualLogoutTime || null }, 
        { headers }
      );
      toast.success('Clocked out successfully');
      loadTodayAttendance();
      loadAttendanceHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clock out');
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/hr/leave/request`, leaveForm, { headers });
      toast.success('Leave request submitted');
      setShowLeaveModal(false);
      setLeaveForm({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
      loadLeaveRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit leave request');
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

  // Primary tabs with counts (Attendance, Leave, Permission, Remote)
  const primaryTabs = [
    { id: 'attendance', label: 'Attendance', icon: Clock, count: tabCounts.attendance },
    { id: 'leave', label: 'Leave', icon: Calendar, count: tabCounts.leave },
    { id: 'permission', label: 'Permission', icon: Clock, count: tabCounts.permission },
    { id: 'remote', label: 'Remote', icon: Home, count: tabCounts.remote },
  ];

  // Secondary tabs (Profile, Payroll, Reviews, Security)
  const secondaryTabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'payroll', label: 'Payroll', icon: FileText },
    { id: 'reviews', label: 'Reviews', icon: Award },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <Layout>
      <div className={`p-6 ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'} min-h-screen`} data-testid="hr-page">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-[#10b981] to-[#059669] bg-clip-text text-transparent">
              Hi, {authUser?.name || 'User'}
            </span>
          </h1>
          <p className={textSecondary}>Manage your attendance, leaves, payslips and more</p>
        </div>

        {/* Primary Tabs - Attendance, Leave, Permission, Remote */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`hr-tab-${tab.id}`}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#6366f1] text-white shadow-lg'
                    : `${bgCard} ${textSecondary} hover:bg-[#3f3f46] border ${borderColor}`
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-[#f59e0b]/20 text-[#f59e0b]'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.count === 0 && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>

        {/* Secondary Tabs - Profile, Payroll, Reviews, Security */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {secondaryTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`hr-tab-${tab.id}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#10b981] text-white'
                    : `${bgSecondary} ${textSecondary} hover:bg-[#3f3f46]`
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {activeTab === 'attendance' && (
          <AttendanceTab
            todayAttendance={todayAttendance}
            attendanceHistory={attendanceHistory}
            attendanceSummary={attendanceSummary}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            formatTime={formatTime}
            formatDate={formatDate}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab 
            profile={profile}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'leave' && (
          <LeaveTab
            leaveRequests={leaveRequests}
            leaveBalance={leaveBalance}
            showModal={showLeaveModal}
            setShowModal={setShowLeaveModal}
            leaveForm={leaveForm}
            setLeaveForm={setLeaveForm}
            onSubmit={handleLeaveSubmit}
            formatDate={formatDate}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'permission' && (
          <PermissionTab
            permissionRequests={permissionRequests}
            onRefresh={loadPermissionRequests}
            formatDate={formatDate}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'remote' && (
          <RemoteTab
            wfhRequests={wfhRequests}
            onRefresh={loadWfhRequests}
            formatDate={formatDate}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'payroll' && (
          <PayrollTab 
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
            currentUser={authUser}
          />
        )}

        {activeTab === 'reviews' && (
          <ReviewsTab 
            reviews={reviews}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {activeTab === 'security' && (
          <SecurityTab 
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

function AttendanceTab({ todayAttendance, attendanceHistory, attendanceSummary, onClockIn, onClockOut, formatTime, formatDate, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLunchModal, setShowLunchModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showLeaveRequestModal, setShowLeaveRequestModal] = useState(false);
  const [logoutTime, setLogoutTime] = useState('');
  const [loginTime, setLoginTime] = useState('');
  const [lunchStartTime, setLunchStartTime] = useState('');
  const [lunchEndTime, setLunchEndTime] = useState('');
  const [workLocation, setWorkLocation] = useState('office');
  const [permissionForm, setPermissionForm] = useState({ date: '', hours_requested: 2, reason: '' });
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
  const [settings, setSettings] = useState(null);
  
  // Monthly filter state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Generate years for dropdown (current year - 2 to current year)
  const availableYears = [currentDate.getFullYear() - 2, currentDate.getFullYear() - 1, currentDate.getFullYear()];
  
  // Load monthly statistics when month/year changes
  useEffect(() => {
    const loadMonthlyStats = async () => {
      setIsLoadingStats(true);
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/api/hr/attendance/history?month=${selectedMonth}&year=${selectedYear}`, 
          { headers }
        );
        setFilteredHistory(res.data.records || []);
        setMonthlyStats(res.data.summary || {});
        setLeaveBalance(res.data.leave_balance || {});
      } catch (error) {
        console.error('Error loading monthly stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };
    loadMonthlyStats();
  }, [selectedMonth, selectedYear]);
  
  const attendance = todayAttendance?.attendance;
  const isClockedIn = attendance?.clock_in && !attendance?.clock_out;
  const isClockedOut = attendance?.clock_out;
  const notClockedIn = !attendance?.clock_in;
  // Single lunch break
  const isOnLunch = attendance?.lunch_start && !attendance?.lunch_end;
  const lunchCompleted = attendance?.lunch_end;
  // Multiple sessions support
  const sessions = attendance?.sessions || [];
  
  useEffect(() => {
    if (todayAttendance?.settings) {
      setSettings(todayAttendance.settings);
    }
  }, [todayAttendance]);
  
  const getCurrentTimeString = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const handleOpenLoginModal = (location) => {
    setWorkLocation(location);
    setLoginTime(getCurrentTimeString());
    setShowLoginModal(true);
  };

  const handleConfirmLogin = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/hr/attendance/clock-in`, 
        { work_location: workLocation, login_time: loginTime }, 
        { headers }
      );
      toast.success(`Clocked in at ${loginTime} - ${workLocation === 'home' ? 'Work from Home' : 'Office'}`);
      setShowLoginModal(false);
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clock in');
    }
  };

  const handleOpenLogoutModal = () => {
    setLogoutTime(getCurrentTimeString());
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/hr/attendance/clock-out`, 
        { notes: '', logout_time: logoutTime }, 
        { headers }
      );
      toast.success('Clocked out successfully');
      setShowLogoutModal(false);
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clock out');
    }
  };

  const handleStartLunch = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/hr/attendance/lunch-start`, 
        { lunch_start_time: lunchStartTime || null }, 
        { headers }
      );
      toast.success('Lunch break started');
      setShowLunchModal(false);
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start lunch');
    }
  };

  const handleEndLunch = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/hr/attendance/lunch-end`, 
        { lunch_end_time: lunchEndTime || null }, 
        { headers }
      );
      toast.success('Lunch break ended');
      setShowLunchModal(false);
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to end lunch');
    }
  };

  const handlePermissionRequest = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/hr/permission/request`, permissionForm, { headers });
      toast.success('Permission request submitted');
      setShowPermissionModal(false);
      setPermissionForm({ date: '', hours_requested: 2, reason: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    }
  };

  const handleLeaveRequest = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/hr/leave/request`, leaveForm, { headers });
      toast.success('Leave request submitted');
      setShowLeaveRequestModal(false);
      setLeaveForm({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    }
  };

  // Get monthly leave allocation from API (admin-configurable, defaults to 2 each)
  const monthlyCasualTotal = monthlyStats?.monthly_casual_allocation || 2;
  const monthlySickTotal = monthlyStats?.monthly_sick_allocation || 2;
  const casualUsed = monthlyStats?.casual_leave || 0;
  const sickUsed = monthlyStats?.sick_leave || 0;

  // State for day detail popup
  const [selectedDayRecord, setSelectedDayRecord] = useState(null);
  const [showDayDetailModal, setShowDayDetailModal] = useState(false);
  
  // Standard lunch duration (in minutes)
  const standardLunchMinutes = 45;

  // Open day detail popup
  const handleDayClick = (record) => {
    setSelectedDayRecord(record);
    setShowDayDetailModal(true);
  };

  // Calculate lunch difference
  const getLunchDiff = (lunchDuration) => {
    if (!lunchDuration) return null;
    const diff = lunchDuration - standardLunchMinutes;
    if (diff > 0) return { text: `+${diff} min extra`, color: 'text-red-400' };
    if (diff < 0) return { text: `${Math.abs(diff)} min before`, color: 'text-green-400' };
    return { text: 'On time', color: 'text-gray-400' };
  };

  return (
    <div className="space-y-6">
      {/* 1. Today's Attendance Summary (No buttons) */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader className="pb-2">
          <CardTitle className={`${textPrimary} flex items-center gap-2`}>
            <Clock className="h-5 w-5 text-[#10b981]" />
            Today's Attendance
            {settings && <span className={`text-sm font-normal ${textSecondary}`}>(Standard: {settings.standard_login_time} - {settings.standard_logout_time})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <div className={`p-3 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Status</p>
              <Badge className={`${
                isClockedOut ? 'bg-green-500/20 text-green-400' :
                isOnLunch ? 'bg-yellow-500/20 text-yellow-400' :
                isClockedIn ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {isClockedOut ? 'Day Complete' : isOnLunch ? 'On Lunch' : isClockedIn ? 'Working' : 'Not Started'}
              </Badge>
            </div>
            <div className={`p-3 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Work Mode</p>
              <div className="flex items-center gap-1">
                {attendance?.work_mode === 'home' || attendance?.work_location === 'home' ? (
                  <>
                    <Home className="h-4 w-4 text-[#10b981]" />
                    <span className={`text-sm font-semibold ${textPrimary}`}>Remote</span>
                  </>
                ) : (
                  <>
                    <Building className="h-4 w-4 text-[#6366f1]" />
                    <span className={`text-sm font-semibold ${textPrimary}`}>Office</span>
                  </>
                )}
              </div>
            </div>
            <div className={`p-3 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Login</p>
              <p className={`text-lg font-semibold ${textPrimary}`}>{formatTime(attendance?.clock_in)}</p>
            </div>
            <div className={`p-3 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Logout</p>
              <p className={`text-lg font-semibold ${textPrimary}`}>{formatTime(attendance?.clock_out)}</p>
            </div>
            <div className={`p-3 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Lunch</p>
              <p className={`text-lg font-semibold ${textPrimary}`}>{attendance?.lunch_duration ? `${attendance.lunch_duration} min` : '-'}</p>
            </div>
            <div className={`p-3 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Sessions</p>
              <p className={`text-lg font-semibold ${textPrimary}`}>{sessions.length > 0 ? sessions.length : (attendance?.clock_in ? 1 : 0)}</p>
            </div>
            <div className={`p-3 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Work Hours</p>
              <p className={`text-lg font-semibold text-[#10b981]`}>{attendance?.total_hours?.toFixed(2) || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Filter by Month/Year */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#10b981]" />
              <span className={`font-medium ${textPrimary}`}>Filter:</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className={`p-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-[#10b981]`}
                data-testid="attendance-month-filter"
              >
                {monthNames.map((month, idx) => (
                  <option key={idx} value={idx + 1}>{month}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className={`p-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-[#10b981]`}
                data-testid="attendance-year-filter"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            {isLoadingStats && (
              <span className={`text-sm ${textSecondary}`}>Loading...</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Month Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="monthly-stats-cards">
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary} mb-1`}>Total Working Days</p>
          <p className="text-2xl font-bold text-[#10b981]">{monthlyStats?.total_working_days || 22}</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary} mb-1`}>Presentable Days</p>
          <p className="text-2xl font-bold text-[#6366f1]">{monthlyStats?.present || 0}</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary} mb-1`}>Total Absent</p>
          <p className="text-2xl font-bold text-[#ef4444]">{monthlyStats?.absent || 0}</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary} mb-1`}>Casual Leave</p>
          <p className="text-2xl font-bold text-[#f59e0b]">
            {casualUsed}<span className={`text-base font-normal ${textSecondary}`}>/{monthlyCasualTotal}</span>
          </p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary} mb-1`}>Sick Leave</p>
          <p className="text-2xl font-bold text-[#ec4899]">
            {sickUsed}<span className={`text-base font-normal ${textSecondary}`}>/{monthlySickTotal}</span>
          </p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary} mb-1`}>Extra Hours</p>
          <p className="text-2xl font-bold text-[#8b5cf6]">{monthlyStats?.extra_hours?.toFixed(1) || 0}</p>
        </Card>
      </div>

      {/* 4. Attendance History Table */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Attendance History - {monthNames[selectedMonth - 1]} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Date</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Day</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Sessions</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Login</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Logout</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Lunch</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Work Hrs</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Status</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((record, index) => {
                  const recordDate = new Date(record.date);
                  const dayName = recordDate.toLocaleDateString('en-US', { weekday: 'short' });
                  const sessionsCount = record.sessions?.length || (record.clock_in ? 1 : 0);
                  const lunchDiff = getLunchDiff(record.lunch_duration);
                  
                  // Determine reason text based on approval status
                  let reasonText = record.notes || record.reason || '';
                  let reasonColor = textSecondary;
                  if (record.approval_status === 'pending_early_login') {
                    reasonText = record.early_login_reason || 'Early Login';
                    reasonColor = 'text-[#f59e0b]';
                  } else if (record.approval_status === 'pending_early_logout') {
                    reasonText = record.early_logout_reason || 'Early Logout';
                    reasonColor = 'text-[#ef4444]';
                  } else if (record.late_login_reason) {
                    reasonText = `Late: ${record.late_login_reason}`;
                    reasonColor = 'text-[#f59e0b]';
                  }
                  
                  return (
                    <tr 
                      key={index} 
                      className={`border-b ${borderColor} hover:${bgSecondary} cursor-pointer transition-colors`}
                      onClick={() => handleDayClick(record)}
                    >
                      <td className={`p-3 ${textPrimary} font-medium`}>{formatDate(record.date)}</td>
                      <td className={`p-3 ${textSecondary}`}>{dayName}</td>
                      <td className={`p-3`}>
                        <span className="bg-[#6366f1]/20 text-[#6366f1] px-2 py-1 rounded text-sm">{sessionsCount}</span>
                      </td>
                      <td className={`p-3 ${textPrimary}`}>{formatTime(record.clock_in)}</td>
                      <td className={`p-3 ${textPrimary}`}>{formatTime(record.clock_out)}</td>
                      <td className={`p-3`}>
                        {record.lunch_duration ? (
                          <div>
                            <span className={textPrimary}>{record.lunch_duration} min</span>
                            {lunchDiff && <span className={`text-xs ml-1 ${lunchDiff.color}`}>({lunchDiff.text})</span>}
                          </div>
                        ) : '-'}
                      </td>
                      <td className={`p-3 font-medium text-[#10b981]`}>{record.total_hours?.toFixed(2) || '-'}</td>
                      <td className="p-3">
                        <Badge className={`${
                          record.approval_status === 'approved' || record.approval_status === 'auto' 
                            ? 'bg-green-500/20 text-green-400' 
                            : record.approval_status?.includes('pending')
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {record.approval_status === 'auto' ? 'OK' : 
                           record.approval_status === 'pending_early_login' ? 'Early Login' :
                           record.approval_status === 'pending_early_logout' ? 'Early Logout' :
                           record.approval_status || 'N/A'}
                        </Badge>
                      </td>
                      <td className={`p-3 ${reasonColor} text-sm max-w-[200px] truncate`} title={reasonText}>
                        {reasonText || '-'}
                      </td>
                    </tr>
                  );
                })}
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={9} className={`p-8 text-center ${textSecondary}`}>
                      No attendance records found for {monthNames[selectedMonth - 1]} {selectedYear}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Day Detail Popup */}
      {showDayDetailModal && selectedDayRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDayDetailModal(false)}>
          <Card className={`w-full max-w-lg ${bgCard} border ${borderColor}`} onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className={`${textPrimary} flex items-center justify-between`}>
                <span>Attendance Summary - {formatDate(selectedDayRecord.date)}</span>
                <Button variant="ghost" size="sm" onClick={() => setShowDayDetailModal(false)} className={textSecondary}>
                  <XCircle className="h-5 w-5" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sessions Info */}
              <div className={`p-4 ${bgSecondary} rounded-lg`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={textSecondary}>Total Sessions</span>
                  <span className="text-2xl font-bold text-[#6366f1]">
                    {selectedDayRecord.sessions?.length || (selectedDayRecord.clock_in ? 1 : 0)}
                  </span>
                </div>
                {selectedDayRecord.sessions?.map((session, idx) => (
                  <div key={idx} className={`flex justify-between text-sm py-1 border-t ${borderColor}`}>
                    <span className={textSecondary}>Session {idx + 1}</span>
                    <span className={textPrimary}>
                      {formatTime(session.clock_in)} - {formatTime(session.clock_out)} ({session.hours?.toFixed(2)} hrs)
                    </span>
                  </div>
                ))}
              </div>

              {/* Work Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Total Work Hours</p>
                  <p className="text-2xl font-bold text-[#10b981]">{selectedDayRecord.total_hours?.toFixed(2) || 0}</p>
                </div>
                <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Extra Hours</p>
                  <p className="text-2xl font-bold text-[#8b5cf6]">{selectedDayRecord.extra_hours?.toFixed(2) || 0}</p>
                </div>
              </div>

              {/* Lunch Break Info */}
              <div className={`p-4 ${bgSecondary} rounded-lg`}>
                <p className={`text-xs ${textSecondary} mb-2`}>Lunch Break</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xl font-bold text-[#f59e0b]">{selectedDayRecord.lunch_duration || 0} min</span>
                    <span className={textSecondary}> / {standardLunchMinutes} min</span>
                  </div>
                  {(() => {
                    const diff = getLunchDiff(selectedDayRecord.lunch_duration);
                    if (diff) {
                      return (
                        <span className={`font-medium ${diff.color}`}>
                          {diff.text}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className={`text-sm mt-2 ${textSecondary}`}>
                  {formatTime(selectedDayRecord.lunch_start)} - {formatTime(selectedDayRecord.lunch_end)}
                </div>
              </div>

              {/* Work Mode */}
              <div className={`p-4 ${bgSecondary} rounded-lg flex items-center justify-between`}>
                <span className={textSecondary}>Work Mode</span>
                <div className="flex items-center gap-2">
                  {selectedDayRecord.work_mode === 'home' || selectedDayRecord.work_location === 'home' ? (
                    <>
                      <Home className="h-5 w-5 text-[#10b981]" />
                      <span className={`font-semibold ${textPrimary}`}>Remote</span>
                    </>
                  ) : (
                    <>
                      <Building className="h-5 w-5 text-[#6366f1]" />
                      <span className={`font-semibold ${textPrimary}`}>Office</span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Login Time Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={`${textPrimary} flex items-center gap-2`}>
                <Clock className="h-5 w-5 text-[#10b981]" />
                Clock In - {workLocation === 'home' ? 'Work from Home' : 'Office'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className={textSecondary}>Login Time</Label>
                <Input
                  type="time"
                  value={loginTime}
                  onChange={(e) => setLoginTime(e.target.value)}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>Enter your actual login time</p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={() => setShowLoginModal(false)} variant="outline" className={`flex-1 border ${borderColor}`}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmLogin} className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white">
                  Confirm Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logout Time Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="logout-modal">
          <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={`${textPrimary} flex items-center gap-2`}>
                <Clock className="h-5 w-5 text-[#ef4444]" />
                Clock Out
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className={`text-sm ${textSecondary} mb-2`}>Clock In Time</p>
                <p className="text-lg font-semibold text-[#10b981]">
                  {formatTime(attendance?.clock_in)}
                </p>
              </div>
              <div>
                <Label className={textSecondary}>Logout Time</Label>
                <Input
                  type="time"
                  value={logoutTime}
                  onChange={(e) => setLogoutTime(e.target.value)}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                  data-testid="logout-time-input"
                />
                <p className={`text-xs ${textSecondary} mt-1`}>Enter your actual logout time</p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowLogoutModal(false)}
                  variant="outline"
                  className={`flex-1 border ${borderColor} ${textSecondary}`}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmLogout}
                  className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white"
                  data-testid="confirm-logout"
                >
                  Confirm Logout
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lunch Break Modal */}
      {showLunchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={`${textPrimary}`}>🍽️ Lunch Break</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className={textSecondary}>Lunch Start Time</Label>
                <Input
                  type="time"
                  value={lunchStartTime}
                  onChange={(e) => setLunchStartTime(e.target.value)}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={() => setShowLunchModal(false)} variant="outline" className={`flex-1 border ${borderColor}`}>
                  Cancel
                </Button>
                <Button onClick={handleStartLunch} className="flex-1 bg-[#f59e0b] hover:bg-[#d97706] text-white">
                  Start Lunch
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Permission Request Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={textPrimary}>Request Permission</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePermissionRequest} className="space-y-4">
                <div>
                  <Label className={textSecondary}>Date</Label>
                  <Input
                    type="date"
                    value={permissionForm.date}
                    onChange={(e) => setPermissionForm({...permissionForm, date: e.target.value})}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    required
                  />
                </div>
                <div>
                  <Label className={textSecondary}>Hours Requested</Label>
                  <Input
                    type="number"
                    min="0.5"
                    max="4"
                    step="0.5"
                    value={permissionForm.hours_requested}
                    onChange={(e) => setPermissionForm({...permissionForm, hours_requested: parseFloat(e.target.value)})}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    required
                  />
                </div>
                <div>
                  <Label className={textSecondary}>Reason</Label>
                  <Input
                    value={permissionForm.reason}
                    onChange={(e) => setPermissionForm({...permissionForm, reason: e.target.value})}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    placeholder="Reason for permission"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" onClick={() => setShowPermissionModal(false)} variant="outline" className={`flex-1 border ${borderColor}`}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white">
                    Submit Request
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={textPrimary}>Request Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLeaveRequest} className="space-y-4">
                <div>
                  <Label className={textSecondary}>Leave Type</Label>
                  <select
                    value={leaveForm.leave_type}
                    onChange={(e) => setLeaveForm({...leaveForm, leave_type: e.target.value})}
                    className={`w-full p-2 rounded ${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    required
                  >
                    <option value="casual">Casual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="earned">Earned Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className={textSecondary}>Start Date</Label>
                    <Input
                      type="date"
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({...leaveForm, start_date: e.target.value})}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                      required
                    />
                  </div>
                  <div>
                    <Label className={textSecondary}>End Date</Label>
                    <Input
                      type="date"
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({...leaveForm, end_date: e.target.value})}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label className={textSecondary}>Reason</Label>
                  <Input
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary} mt-1`}
                    placeholder="Reason for leave"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" onClick={() => setShowLeaveRequestModal(false)} variant="outline" className={`flex-1 border ${borderColor}`}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-[#f59e0b] hover:bg-[#d97706] text-white">
                    Submit Request
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Calendar Tab Component
function CalendarTab({ 
  calendarData, calendarMonth, calendarYear, setCalendarMonth, setCalendarYear,
  selectedDate, setSelectedDate, dateDetail, loadDateDetail, loadCalendarData,
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor, isDark, navigate
}) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Generate calendar days
  const generateCalendarDays = () => {
    const firstDay = new Date(calendarYear, calendarMonth - 1, 1);
    const lastDay = new Date(calendarYear, calendarMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    
    // Empty cells for days before the month starts
    for (let i = 0; i < startingDay; i++) {
      days.push({ day: null, date: null });
    }
    
    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayData = calendarData?.calendar_data?.[dateStr];
      days.push({
        day: i,
        date: dateStr,
        data: dayData
      });
    }
    
    return days;
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const handleDateClick = (dateStr) => {
    // Navigate to full page detail view
    navigate(`/calendar/${dateStr}`);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getDayStatusColor = (dayData) => {
    if (!dayData) return '';
    if (dayData.status === 'present') {
      if (dayData.work_mode === 'remote') return 'bg-[#10b981]/20 border-[#10b981]';
      return 'bg-[#6366f1]/20 border-[#6366f1]';
    }
    if (dayData.status === 'leave') return 'bg-[#f59e0b]/20 border-[#f59e0b]';
    if (dayData.status === 'absent') return 'bg-[#ef4444]/20 border-[#ef4444]';
    return '';
  };

  const days = generateCalendarDays();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Button variant="ghost" onClick={handlePrevMonth}>&lt;</Button>
              <CardTitle className={textPrimary}>
                {monthNames[calendarMonth - 1]} {calendarYear}
              </CardTitle>
              <Button variant="ghost" onClick={handleNextMonth}>&gt;</Button>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className={`text-center text-xs font-medium ${textSecondary} py-2`}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((dayObj, idx) => (
                  <div key={idx} className="aspect-square">
                    {dayObj.day ? (
                      <button
                        onClick={() => handleDateClick(dayObj.date)}
                        className={`w-full h-full rounded-lg border-2 transition-all flex flex-col items-center justify-center
                          ${selectedDate === dayObj.date ? 'ring-2 ring-[#6366f1]' : ''}
                          ${getDayStatusColor(dayObj.data) || (isDark ? 'border-[#27272a] hover:border-[#3f3f46]' : 'border-gray-200 hover:border-gray-300')}
                        `}
                      >
                        <span className={`text-sm font-medium ${textPrimary}`}>{dayObj.day}</span>
                        {dayObj.data?.total_hours > 0 && (
                          <span className="text-xs text-[#6366f1]">{dayObj.data.total_hours.toFixed(1)}h</span>
                        )}
                      </button>
                    ) : (
                      <div className={`w-full h-full ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'} rounded-lg`}></div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-dashed">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#6366f1]/20 border-2 border-[#6366f1]"></div>
                  <span className={`text-xs ${textSecondary}`}>Office</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#10b981]/20 border-2 border-[#10b981]"></div>
                  <span className={`text-xs ${textSecondary}`}>WFH</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#f59e0b]/20 border-2 border-[#f59e0b]"></div>
                  <span className={`text-xs ${textSecondary}`}>Leave</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary & Date Detail */}
        <div className="space-y-4">
          {/* Monthly Summary */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-lg ${textPrimary}`}>Monthly Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className={textSecondary}>Days Present</span>
                <span className={`font-medium ${textPrimary}`}>{calendarData?.summary?.total_present || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className={textSecondary}>Total Hours</span>
                <span className={`font-medium ${textPrimary}`}>{calendarData?.summary?.total_hours?.toFixed(1) || 0}h</span>
              </div>
              <div className="flex justify-between">
                <span className={textSecondary}>Avg Hours/Day</span>
                <span className={`font-medium ${textPrimary}`}>{calendarData?.summary?.avg_hours_per_day?.toFixed(1) || 0}h</span>
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Detail */}
          {selectedDate && dateDetail && (
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-lg ${textPrimary}`}>
                  {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dateDetail.attendance ? (
                  <>
                    {/* Time Summary */}
                    <div className={`p-3 rounded-lg ${bgSecondary}`}>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className={textSecondary}>Login:</span>
                          <span className={`ml-2 font-medium ${textPrimary}`}>{formatTime(dateDetail.attendance.clock_in)}</span>
                        </div>
                        <div>
                          <span className={textSecondary}>Logout:</span>
                          <span className={`ml-2 font-medium ${textPrimary}`}>{formatTime(dateDetail.attendance.clock_out)}</span>
                        </div>
                        <div>
                          <span className={textSecondary}>Work Hours:</span>
                          <span className={`ml-2 font-medium ${textPrimary}`}>{dateDetail.work_summary.total_work_hours?.toFixed(1) || 0}h</span>
                        </div>
                        <div>
                          <span className={textSecondary}>Mode:</span>
                          <Badge className={`ml-2 ${dateDetail.attendance.work_mode === 'remote' ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#6366f1]/20 text-[#6366f1]'}`}>
                            {dateDetail.attendance.work_mode === 'remote' ? 'WFH' : 'Office'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Tasks Worked On */}
                    {dateDetail.tasks?.length > 0 && (
                      <div>
                        <h4 className={`text-sm font-medium ${textPrimary} mb-2`}>Tasks Completed</h4>
                        <div className="space-y-2">
                          {dateDetail.tasks.map(task => (
                            <div key={task.task_id} className={`p-2 rounded-lg ${bgSecondary} flex justify-between items-center`}>
                              <div>
                                <p className={`text-sm font-medium ${textPrimary}`}>{task.task_name}</p>
                                <p className={`text-xs ${textSecondary}`}>{task.type}</p>
                              </div>
                              <Badge className="bg-[#3b82f6]/20 text-[#3b82f6]">
                                {task.day_time_formatted}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dateDetail.tasks?.length === 0 && (
                      <p className={`text-sm ${textSecondary} text-center py-2`}>No tasks tracked this day</p>
                    )}
                  </>
                ) : (
                  <p className={`text-sm ${textSecondary} text-center py-4`}>No attendance record for this date</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ profile, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  if (!profile) {
    return <div className={`text-center py-8 ${textSecondary}`}>Loading profile...</div>;
  }

  const ProfileSection = ({ title, children }) => (
    <Card className={`${bgCard} border ${borderColor} mb-4`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-lg ${textPrimary}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  const ProfileField = ({ label, value }) => (
    <div className="py-2">
      <p className={`text-xs ${textSecondary} mb-1`}>{label}</p>
      <p className={textPrimary}>{value || '-'}</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ProfileSection title="Personal Information">
        <div className={`flex items-center gap-4 mb-4 pb-4 border-b ${borderColor}`}>
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center text-white text-2xl font-bold">
            {profile.full_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className={`text-xl font-semibold ${textPrimary}`}>{profile.full_name}</h3>
            <p className={textSecondary}>{profile.designation}</p>
            <Badge className="mt-1 bg-[#10b981]/20 text-[#10b981]">{profile.employee_id}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ProfileField label="Email" value={profile.email} />
          <ProfileField label="Phone" value={profile.phone} />
          <ProfileField label="Date of Birth" value={profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : '-'} />
          <ProfileField label="Gender" value={profile.gender} />
          <ProfileField label="Blood Group" value={profile.blood_group} />
        </div>
      </ProfileSection>

      <ProfileSection title="Employment Details">
        <div className="grid grid-cols-2 gap-4">
          <ProfileField label="Employee ID" value={profile.employee_id} />
          <ProfileField label="Designation" value={profile.designation} />
          <ProfileField label="Department" value={profile.department} />
          <ProfileField label="Employment Type" value={profile.employment_type} />
          <ProfileField label="Joining Date" value={profile.joining_date ? new Date(profile.joining_date).toLocaleDateString() : '-'} />
          <ProfileField label="Reporting Manager" value={profile.reporting_manager} />
        </div>
      </ProfileSection>

      <ProfileSection title="Address">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <ProfileField label="Address" value={profile.address} />
          </div>
          <ProfileField label="City" value={profile.city} />
          <ProfileField label="State" value={profile.state} />
          <ProfileField label="Pincode" value={profile.pincode} />
        </div>
      </ProfileSection>

      <ProfileSection title="Emergency Contact">
        <div className="grid grid-cols-2 gap-4">
          <ProfileField label="Contact Name" value={profile.emergency_contact_name} />
          <ProfileField label="Contact Phone" value={profile.emergency_contact_phone} />
          <ProfileField label="Relationship" value={profile.emergency_contact_relation} />
        </div>
      </ProfileSection>

      <ProfileSection title="Bank Details">
        <div className="grid grid-cols-2 gap-4">
          <ProfileField label="Bank Name" value={profile.bank_name} />
          <ProfileField label="Account Number" value={profile.account_number ? '****' + profile.account_number.slice(-4) : '-'} />
          <ProfileField label="IFSC Code" value={profile.ifsc_code} />
          <ProfileField label="PAN Number" value={profile.pan_number ? '****' + profile.pan_number.slice(-4) : '-'} />
        </div>
      </ProfileSection>
    </div>
  );
}

function LeaveTab({ leaveRequests, leaveBalance, showModal, setShowModal, leaveForm, setLeaveForm, onSubmit, formatDate, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [activeSubTab, setActiveSubTab] = useState('leave');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionForm, setPermissionForm] = useState({
    date: '',
    hours: 1,
    reason: '',
    from_time: '',
    to_time: ''
  });

  const token = localStorage.getItem('session_token');
  const API = process.env.REACT_APP_BACKEND_URL;

  // Load permission requests
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const res = await axios.get(`${API}/api/hr/permissions/my-requests`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPermissionRequests(res.data || []);
      } catch (err) {
        console.error('Error loading permissions:', err);
      }
    };
    if (activeSubTab === 'permission') {
      loadPermissions();
    }
  }, [activeSubTab, token]);

  // Submit permission request
  const handlePermissionSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/hr/permissions/request`, permissionForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Permission request submitted');
      setShowPermissionModal(false);
      setPermissionForm({ date: '', hours: 1, reason: '', from_time: '', to_time: '' });
      // Reload permissions
      const res = await axios.get(`${API}/api/hr/permissions/my-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPermissionRequests(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit permission request');
    }
  };

  // Get status badge color
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return 'bg-[#22c55e]/20 text-[#22c55e]';
      case 'rejected': return 'bg-[#ef4444]/20 text-[#ef4444]';
      case 'pending_verification': return 'bg-[#f59e0b]/20 text-[#f59e0b]';
      default: return 'bg-[#6366f1]/20 text-[#6366f1]';
    }
  };

  // Timeline component for leave detail
  const LeaveTimeline = ({ request }) => {
    const steps = [
      { 
        label: 'Request Submitted', 
        date: request.created_at,
        status: 'completed',
        icon: Send
      },
      { 
        label: 'HR Review', 
        date: request.hr_reviewed_at,
        status: request.status === 'pending' ? 'current' : 
                request.status === 'approved' || request.status === 'rejected' ? 'completed' : 'pending',
        icon: User
      },
      { 
        label: request.status === 'approved' ? 'Approved' : 
               request.status === 'rejected' ? 'Rejected' : 'Awaiting Decision',
        date: request.status !== 'pending' ? request.updated_at : null,
        status: request.status === 'approved' ? 'approved' : 
                request.status === 'rejected' ? 'rejected' : 'pending',
        icon: request.status === 'approved' ? CheckCircle : 
              request.status === 'rejected' ? XCircle : AlertCircle
      }
    ];

    return (
      <div className="relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={idx} className="flex gap-4 pb-6 last:pb-0">
              {/* Line */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step.status === 'completed' ? 'bg-[#22c55e]' :
                  step.status === 'approved' ? 'bg-[#22c55e]' :
                  step.status === 'rejected' ? 'bg-[#ef4444]' :
                  step.status === 'current' ? 'bg-[#6366f1]' :
                  `${bgSecondary}`
                }`}>
                  <Icon className={`h-4 w-4 ${
                    step.status === 'completed' || step.status === 'approved' || step.status === 'rejected' || step.status === 'current'
                      ? 'text-white' : textSecondary
                  }`} />
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-0.5 flex-1 mt-2 ${
                    step.status === 'completed' || step.status === 'approved' 
                      ? 'bg-[#22c55e]' 
                      : step.status === 'rejected' ? 'bg-[#ef4444]' : bgSecondary
                  }`} />
                )}
              </div>
              {/* Content */}
              <div className="flex-1 pt-1">
                <p className={`font-medium ${textPrimary}`}>{step.label}</p>
                {step.date && (
                  <p className={`text-sm ${textSecondary}`}>
                    {new Date(step.date).toLocaleDateString('en-IN', { 
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs: Request Leave | Request Permission */}
      <div className="flex gap-2 mb-4">
        <Button
          onClick={() => setActiveSubTab('leave')}
          className={`px-6 py-3 rounded-lg transition-all ${
            activeSubTab === 'leave'
              ? 'bg-[#10b981] text-white'
              : `${bgSecondary} ${textSecondary} hover:bg-[#3f3f46]`
          }`}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Request Leave
        </Button>
        <Button
          onClick={() => setActiveSubTab('permission')}
          className={`px-6 py-3 rounded-lg transition-all ${
            activeSubTab === 'permission'
              ? 'bg-[#8b5cf6] text-white'
              : `${bgSecondary} ${textSecondary} hover:bg-[#3f3f46]`
          }`}
        >
          <Clock className="h-4 w-4 mr-2" />
          Request Permission
        </Button>
      </div>

      {/* Request Leave Sub-Tab */}
      {activeSubTab === 'leave' && (
        <div className="space-y-6">
          {/* Leave Balance Dashboard */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className={textPrimary}>Leave Balance ({new Date().getFullYear()})</CardTitle>
              <Button 
                onClick={() => setShowModal(true)}
                className="bg-[#10b981] hover:bg-[#059669] text-white"
                data-testid="request-leave-btn"
              >
                <Send className="mr-2 h-4 w-4" />
                Request Leave
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 ${bgSecondary} rounded-lg`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Casual Leave</p>
                  <p className="text-2xl font-bold text-[#6366f1]">
                    {(leaveBalance?.casual_leave || 12) - (leaveBalance?.casual_used || 0)}
                    <span className={`text-sm ${textSecondary}`}>/{leaveBalance?.casual_leave || 12}</span>
                  </p>
                </div>
                <div className={`p-4 ${bgSecondary} rounded-lg`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Sick Leave</p>
                  <p className="text-2xl font-bold text-[#f59e0b]">
                    {(leaveBalance?.sick_leave || 6) - (leaveBalance?.sick_used || 0)}
                    <span className={`text-sm ${textSecondary}`}>/{leaveBalance?.sick_leave || 6}</span>
                  </p>
                </div>
                <div className={`p-4 ${bgSecondary} rounded-lg`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Earned Leave</p>
                  <p className="text-2xl font-bold text-[#10b981]">
                    {(leaveBalance?.earned_leave || 15) - (leaveBalance?.earned_used || 0)}
                    <span className={`text-sm ${textSecondary}`}>/{leaveBalance?.earned_leave || 15}</span>
                  </p>
                </div>
                <div className={`p-4 ${bgSecondary} rounded-lg`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>WFH Requests</p>
                  <p className="text-2xl font-bold text-[#8b5cf6]">∞</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leave Status Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-[#6366f1]">
                  {leaveRequests.filter(r => r.status === 'pending').length}
                </div>
                <div className={`text-sm ${textSecondary}`}>Pending</div>
              </CardContent>
            </Card>
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-[#22c55e]">
                  {leaveRequests.filter(r => r.status === 'approved').length}
                </div>
                <div className={`text-sm ${textSecondary}`}>Approved</div>
              </CardContent>
            </Card>
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-[#ef4444]">
                  {leaveRequests.filter(r => r.status === 'rejected').length}
                </div>
                <div className={`text-sm ${textSecondary}`}>Rejected</div>
              </CardContent>
            </Card>
          </div>

          {/* Leave Requests List */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={textPrimary}>My Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaveRequests.map((req) => (
                  <div 
                    key={req.leave_id || req.request_id} 
                    onClick={() => { setSelectedRequest(req); setShowDetailModal(true); }}
                    className={`p-4 ${bgSecondary} rounded-lg flex items-center justify-between cursor-pointer hover:bg-[#3f3f46] transition-colors`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${
                          req.leave_type === 'wfh' ? 'bg-purple-500/20 text-purple-400' :
                          req.leave_type === 'casual' ? 'bg-blue-500/20 text-blue-400' :
                          req.leave_type === 'sick' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {req.leave_type?.toUpperCase() || 'LEAVE'}
                        </Badge>
                        <Badge className={getStatusBadge(req.status)}>
                          {req.status}
                        </Badge>
                      </div>
                      <p className={`text-sm ${textPrimary}`}>
                        {formatDate(req.start_date || req.from_date)} - {formatDate(req.end_date || req.to_date)}
                      </p>
                      <p className={`text-xs ${textSecondary} mt-1`}>{req.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status === 'approved' && <CheckCircle className="h-5 w-5 text-green-400" />}
                      {req.status === 'rejected' && <XCircle className="h-5 w-5 text-red-400" />}
                      {req.status === 'pending' && <AlertCircle className="h-5 w-5 text-yellow-400" />}
                      <ChevronRight className={`h-5 w-5 ${textSecondary}`} />
                    </div>
                  </div>
                ))}
                {leaveRequests.length === 0 && (
                  <div className={`text-center py-12 ${textSecondary}`}>
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No leave requests found</p>
                    <Button 
                      onClick={() => setShowModal(true)}
                      className="mt-4 bg-[#10b981] hover:bg-[#059669]"
                    >
                      Request Your First Leave
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Permission Sub-Tab */}
      {activeSubTab === 'permission' && (
        <div className="space-y-6">
          {/* Permission Dashboard Header */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className={textPrimary}>Permission Requests</CardTitle>
              <Button 
                onClick={() => setShowPermissionModal(true)}
                className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white"
              >
                <Clock className="mr-2 h-4 w-4" />
                Request Permission
              </Button>
            </CardHeader>
            <CardContent>
              <p className={`text-sm ${textSecondary}`}>
                Request permission for late arrival, early leave, or short breaks during work hours.
              </p>
            </CardContent>
          </Card>

          {/* Permission Status Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-[#8b5cf6]">
                  {permissionRequests.filter(r => r.status === 'pending').length}
                </div>
                <div className={`text-sm ${textSecondary}`}>Pending</div>
              </CardContent>
            </Card>
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-[#22c55e]">
                  {permissionRequests.filter(r => r.status === 'approved').length}
                </div>
                <div className={`text-sm ${textSecondary}`}>Approved</div>
              </CardContent>
            </Card>
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-[#ef4444]">
                  {permissionRequests.filter(r => r.status === 'rejected').length}
                </div>
                <div className={`text-sm ${textSecondary}`}>Rejected</div>
              </CardContent>
            </Card>
          </div>

          {/* Permission Requests List */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={textPrimary}>My Permission Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {permissionRequests.map((req, idx) => (
                  <div 
                    key={req.permission_id || idx}
                    className={`p-4 ${bgSecondary} rounded-lg flex items-center justify-between`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-[#8b5cf6]/20 text-[#8b5cf6]">
                          {req.hours || 1}h Permission
                        </Badge>
                        <Badge className={getStatusBadge(req.status)}>
                          {req.status}
                        </Badge>
                      </div>
                      <p className={`text-sm ${textPrimary}`}>
                        {formatDate(req.date)} {req.from_time && `| ${req.from_time} - ${req.to_time}`}
                      </p>
                      <p className={`text-xs ${textSecondary} mt-1`}>{req.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status === 'approved' && <CheckCircle className="h-5 w-5 text-green-400" />}
                      {req.status === 'rejected' && <XCircle className="h-5 w-5 text-red-400" />}
                      {req.status === 'pending' && <AlertCircle className="h-5 w-5 text-yellow-400" />}
                    </div>
                  </div>
                ))}
                {permissionRequests.length === 0 && (
                  <div className={`text-center py-12 ${textSecondary}`}>
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No permission requests found</p>
                    <Button 
                      onClick={() => setShowPermissionModal(true)}
                      className="mt-4 bg-[#8b5cf6] hover:bg-[#7c3aed]"
                    >
                      Request Your First Permission
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leave Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4`}>
            <CardHeader>
              <CardTitle className={textPrimary}>Request Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <Label className={textPrimary}>Leave Type</Label>
                  <select
                    value={leaveForm.leave_type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                    className={`w-full mt-1 p-2 ${bgSecondary} border ${borderColor} rounded-lg ${textPrimary}`}
                  >
                    <option value="casual">Casual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="earned">Earned Leave</option>
                    <option value="wfh">Work from Home</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Start Date</Label>
                    <Input
                      type="date"
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      required
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>End Date</Label>
                    <Input
                      type="date"
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                      required
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                </div>
                <div>
                  <Label className={textPrimary}>Reason</Label>
                  <textarea
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    required
                    rows={3}
                    className={`w-full mt-1 p-2 ${bgSecondary} border ${borderColor} rounded-lg ${textPrimary}`}
                    placeholder="Enter reason for leave..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className={`flex-1 ${bgSecondary} hover:bg-[#3f3f46] ${textPrimary}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white"
                  >
                    Submit Request
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Permission Request Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4`}>
            <CardHeader>
              <CardTitle className={textPrimary}>Request Permission</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePermissionSubmit} className="space-y-4">
                <div>
                  <Label className={textPrimary}>Date</Label>
                  <Input
                    type="date"
                    value={permissionForm.date}
                    onChange={(e) => setPermissionForm({ ...permissionForm, date: e.target.value })}
                    required
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>From Time</Label>
                    <Input
                      type="time"
                      value={permissionForm.from_time}
                      onChange={(e) => setPermissionForm({ ...permissionForm, from_time: e.target.value })}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>To Time</Label>
                    <Input
                      type="time"
                      value={permissionForm.to_time}
                      onChange={(e) => setPermissionForm({ ...permissionForm, to_time: e.target.value })}
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                </div>
                <div>
                  <Label className={textPrimary}>Hours</Label>
                  <Input
                    type="number"
                    min="0.5"
                    max="4"
                    step="0.5"
                    value={permissionForm.hours}
                    onChange={(e) => setPermissionForm({ ...permissionForm, hours: parseFloat(e.target.value) })}
                    required
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Reason</Label>
                  <textarea
                    value={permissionForm.reason}
                    onChange={(e) => setPermissionForm({ ...permissionForm, reason: e.target.value })}
                    required
                    rows={3}
                    className={`w-full mt-1 p-2 ${bgSecondary} border ${borderColor} rounded-lg ${textPrimary}`}
                    placeholder="Enter reason for permission..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => setShowPermissionModal(false)}
                    className={`flex-1 ${bgSecondary} hover:bg-[#3f3f46] ${textPrimary}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                  >
                    Submit Request
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leave Detail Modal with Timeline */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`${bgCard} border ${borderColor} w-full max-w-lg`}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className={textPrimary}>Leave Request Details</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDetailModal(false)}
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Request Summary */}
              <div className={`p-4 ${bgSecondary} rounded-lg`}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={`${
                    selectedRequest.leave_type === 'wfh' ? 'bg-purple-500/20 text-purple-400' :
                    selectedRequest.leave_type === 'casual' ? 'bg-blue-500/20 text-blue-400' :
                    selectedRequest.leave_type === 'sick' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {selectedRequest.leave_type?.toUpperCase() || 'LEAVE'}
                  </Badge>
                  <Badge className={getStatusBadge(selectedRequest.status)}>
                    {selectedRequest.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={textSecondary}>Duration:</span>
                    <span className={textPrimary}>
                      {formatDate(selectedRequest.start_date || selectedRequest.from_date)} - {formatDate(selectedRequest.end_date || selectedRequest.to_date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Days:</span>
                    <span className={textPrimary}>{selectedRequest.days || 1} day(s)</span>
                  </div>
                  <div>
                    <span className={textSecondary}>Reason:</span>
                    <p className={`${textPrimary} mt-1`}>{selectedRequest.reason}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className={`font-medium ${textPrimary} mb-4`}>Request Timeline</h4>
                <LeaveTimeline request={selectedRequest} />
              </div>

              {/* HR Remarks (if any) */}
              {selectedRequest.hr_remarks && (
                <div className={`p-4 ${bgSecondary} rounded-lg`}>
                  <h4 className={`font-medium ${textPrimary} mb-2`}>HR Remarks</h4>
                  <p className={textSecondary}>{selectedRequest.hr_remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function PayrollTab({ bgCard, bgSecondary, textPrimary, textSecondary, borderColor, currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('current');
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [currentSalary, setCurrentSalary] = useState(0);
  const [payrollDetails, setPayrollDetails] = useState(null);
  const [hikeReasons, setHikeReasons] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(false);
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = [2023, 2024, 2025, 2026, 2027];
  
  // Load salary history
  const loadSalaryHistory = async () => {
    if (!currentUser?.user_id) return;
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/payroll/salary-history/${currentUser.user_id}`,
        { headers }
      );
      setSalaryHistory(res.data.salary_history || []);
      setCurrentSalary(res.data.current_salary || 0);
    } catch (error) {
      console.error('Error loading salary history:', error);
    }
  };
  
  // Load payroll details for selected month/year
  const loadPayrollDetails = async () => {
    if (!currentUser?.user_id) return;
    setIsLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/payroll/details/${currentUser.user_id}?month=${selectedMonth}&year=${selectedYear}`,
        { headers }
      );
      setPayrollDetails(res.data);
    } catch (error) {
      console.error('Error loading payroll details:', error);
    }
    setIsLoading(false);
  };
  
  // Load hike reasons
  const loadHikeReasons = async () => {
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/payroll/hike-reasons`,
        { headers }
      );
      setHikeReasons(res.data || []);
    } catch (error) {
      console.error('Error loading hike reasons:', error);
    }
  };
  
  useEffect(() => {
    if (currentUser?.user_id) {
      loadSalaryHistory();
      loadHikeReasons();
    }
  }, [currentUser?.user_id]);
  
  useEffect(() => {
    if (currentUser?.user_id) {
      loadPayrollDetails();
    }
  }, [selectedMonth, selectedYear, currentUser?.user_id]);
  
  // Calculate months at each salary level
  const calculateSalaryDuration = (index) => {
    if (index === 0) {
      // Current salary - from effective date to now
      const effectiveDate = new Date(salaryHistory[0]?.effective_from);
      const now = new Date();
      const diffMonths = (now.getFullYear() - effectiveDate.getFullYear()) * 12 + (now.getMonth() - effectiveDate.getMonth());
      return `${diffMonths} months (current)`;
    } else {
      // Previous salary - from its effective date to next salary's effective date
      const startDate = new Date(salaryHistory[index]?.effective_from);
      const endDate = new Date(salaryHistory[index - 1]?.effective_from);
      const diffMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
      return `${diffMonths} months`;
    }
  };
  
  // Get reason label
  const getReasonLabel = (reasonId) => {
    const reason = hikeReasons.find(r => r.id === reasonId);
    return reason ? reason.label : reasonId;
  };
  
  // Get reason color
  const getReasonColor = (reasonId) => {
    const colors = {
      'initial': 'bg-gray-500/20 text-gray-400',
      'performance': 'bg-[#10b981]/20 text-[#10b981]',
      'confirmation': 'bg-[#6366f1]/20 text-[#6366f1]',
      'annual_increase': 'bg-[#f59e0b]/20 text-[#f59e0b]',
      '6_month_review': 'bg-[#8b5cf6]/20 text-[#8b5cf6]',
      '3_month_review': 'bg-[#ec4899]/20 text-[#ec4899]',
      'promotion': 'bg-[#14b8a6]/20 text-[#14b8a6]',
      'market_adjustment': 'bg-[#3b82f6]/20 text-[#3b82f6]'
    };
    return colors[reasonId] || 'bg-gray-500/20 text-gray-400';
  };

  const subTabs = [
    { id: 'current', label: 'Current Payroll' },
    { id: 'history', label: 'Salary History' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-[#27272a] pb-2">
        {subTabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            variant={activeSubTab === tab.id ? 'default' : 'ghost'}
            className={activeSubTab === tab.id 
              ? 'bg-[#10b981] text-white' 
              : `${textSecondary} hover:bg-[#27272a]`
            }
            size="sm"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Current Payroll Tab */}
      {activeSubTab === 'current' && (
        <div className="space-y-6">
          {/* Current Salary Card */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${textSecondary}`}>Current Monthly Salary</p>
                  <p className="text-4xl font-bold text-[#10b981]">₹{currentSalary.toLocaleString()}</p>
                </div>
                <div className="h-16 w-16 rounded-full bg-[#10b981]/20 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-[#10b981]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Month/Year Filter */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-[#6366f1]" />
                  <span className={`font-medium ${textPrimary}`}>View Payroll for:</span>
                </div>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className={`p-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary}`}
                >
                  {months.map((month, idx) => (
                    <option key={idx} value={idx + 1}>{month}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className={`p-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary}`}
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                {isLoading && <span className={textSecondary}>Loading...</span>}
              </div>
            </CardContent>
          </Card>

          {/* Payroll Details */}
          {payrollDetails && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Attendance Summary Card */}
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardHeader>
                  <CardTitle className={`${textPrimary} text-lg`}>Attendance Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className={textSecondary}>Total Working Days</span>
                    <span className={textPrimary}>{payrollDetails.attendance_summary?.total_working_days || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Holidays</span>
                    <span className={textPrimary}>{payrollDetails.attendance_summary?.total_holidays || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Days Present</span>
                    <span className="text-[#10b981] font-medium">{payrollDetails.attendance_summary?.days_present || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Casual Leave</span>
                    <span className="text-[#6366f1]">{payrollDetails.attendance_summary?.casual_leaves || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Sick Leave</span>
                    <span className="text-[#f59e0b]">{payrollDetails.attendance_summary?.sick_leaves || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Absent (LOP)</span>
                    <span className="text-red-400">{payrollDetails.attendance_summary?.absent_days || 0}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Salary Breakdown Card */}
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardHeader>
                  <CardTitle className={`${textPrimary} text-lg`}>Salary Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className={textSecondary}>Base Salary</span>
                    <span className={textPrimary}>₹{payrollDetails.base_salary?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Per Day Salary</span>
                    <span className={textPrimary}>₹{payrollDetails.salary_breakdown?.per_day_salary?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Days Paid (Present + Paid Leave)</span>
                    <span className={textPrimary}>{payrollDetails.salary_breakdown?.days_paid || 0}</span>
                  </div>
                  <div className={`flex justify-between pt-3 border-t ${borderColor}`}>
                    <span className={`font-medium ${textPrimary}`}>Earned Salary</span>
                    <span className="font-bold text-[#10b981]">₹{payrollDetails.salary_breakdown?.earned_salary?.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Deductions */}
          {payrollDetails && (
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader>
                <CardTitle className={`${textPrimary} text-lg`}>Deductions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary}`}>PF (12%)</p>
                    <p className="text-lg font-semibold text-red-400">-₹{payrollDetails.deductions?.pf?.toLocaleString()}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary}`}>Professional Tax</p>
                    <p className="text-lg font-semibold text-red-400">-₹{payrollDetails.deductions?.professional_tax?.toLocaleString()}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary}`}>LOP Deduction</p>
                    <p className="text-lg font-semibold text-red-400">-₹{payrollDetails.deductions?.lop_deduction?.toLocaleString() || 0}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary}`}>Total Deductions</p>
                    <p className="text-lg font-semibold text-red-400">-₹{payrollDetails.total_deductions?.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Net Salary */}
          {payrollDetails && (
            <Card className={`${bgCard} border ${borderColor} border-[#10b981]`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${textSecondary}`}>Net Salary for {months[selectedMonth - 1]} {selectedYear}</p>
                    <p className="text-3xl font-bold text-[#10b981]">₹{payrollDetails.net_salary?.toLocaleString()}</p>
                  </div>
                  <Button className="bg-[#6366f1] hover:bg-[#4f46e5] text-white">
                    <Download className="mr-2 h-4 w-4" />
                    Download Payslip
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Salary History Tab */}
      {activeSubTab === 'history' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className={`${bgCard} border ${borderColor} p-4`}>
              <p className={`text-xs ${textSecondary}`}>Current Salary</p>
              <p className="text-2xl font-bold text-[#10b981]">₹{currentSalary.toLocaleString()}</p>
            </Card>
            <Card className={`${bgCard} border ${borderColor} p-4`}>
              <p className={`text-xs ${textSecondary}`}>Total Hikes</p>
              <p className="text-2xl font-bold text-[#6366f1]">{Math.max(0, salaryHistory.length - 1)}</p>
            </Card>
            <Card className={`${bgCard} border ${borderColor} p-4`}>
              <p className={`text-xs ${textSecondary}`}>Initial Salary</p>
              <p className="text-2xl font-bold text-[#f59e0b]">
                ₹{salaryHistory.length > 0 ? salaryHistory[salaryHistory.length - 1]?.amount?.toLocaleString() : 0}
              </p>
            </Card>
            <Card className={`${bgCard} border ${borderColor} p-4`}>
              <p className={`text-xs ${textSecondary}`}>Total Growth</p>
              <p className="text-2xl font-bold text-[#8b5cf6]">
                {salaryHistory.length > 1 
                  ? `+${Math.round(((currentSalary - salaryHistory[salaryHistory.length - 1]?.amount) / salaryHistory[salaryHistory.length - 1]?.amount) * 100)}%`
                  : '0%'}
              </p>
            </Card>
          </div>

          {/* Salary History Table */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={textPrimary}>Salary History</CardTitle>
            </CardHeader>
            <CardContent>
              {salaryHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${borderColor}`}>
                        <th className={`text-left p-3 ${textSecondary} text-sm`}>#</th>
                        <th className={`text-left p-3 ${textSecondary} text-sm`}>Effective From</th>
                        <th className={`text-left p-3 ${textSecondary} text-sm`}>Amount</th>
                        <th className={`text-left p-3 ${textSecondary} text-sm`}>Duration</th>
                        <th className={`text-left p-3 ${textSecondary} text-sm`}>Reason</th>
                        <th className={`text-left p-3 ${textSecondary} text-sm`}>Hike</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryHistory.map((record, index) => {
                        const prevSalary = index < salaryHistory.length - 1 ? salaryHistory[index + 1]?.amount : 0;
                        const hikeAmount = prevSalary > 0 ? record.amount - prevSalary : 0;
                        const hikePercent = prevSalary > 0 ? ((hikeAmount / prevSalary) * 100).toFixed(1) : 0;
                        
                        return (
                          <tr key={record.record_id} className={`border-b ${borderColor}`}>
                            <td className={`p-3 ${textSecondary}`}>{salaryHistory.length - index}</td>
                            <td className={`p-3 ${textPrimary}`}>
                              {new Date(record.effective_from).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                            </td>
                            <td className={`p-3 font-semibold text-[#10b981]`}>₹{record.amount?.toLocaleString()}</td>
                            <td className={`p-3 ${textSecondary}`}>{calculateSalaryDuration(index)}</td>
                            <td className="p-3">
                              <Badge className={getReasonColor(record.reason)}>
                                {getReasonLabel(record.reason)}
                              </Badge>
                            </td>
                            <td className={`p-3`}>
                              {hikeAmount > 0 ? (
                                <span className="text-[#10b981]">+₹{hikeAmount.toLocaleString()} ({hikePercent}%)</span>
                              ) : (
                                <span className={textSecondary}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-[#3f3f46] mx-auto mb-4" />
                  <p className={textSecondary}>No salary history available</p>
                  <p className={`text-sm ${textSecondary}`}>Your salary history will appear here once added</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hike Conditions Legend */}
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={`${textPrimary} text-lg`}>Hike Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {hikeReasons.map((reason) => (
                  <div key={reason.id} className="flex items-center gap-2">
                    <Badge className={getReasonColor(reason.id)}>{reason.label}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ReviewsTab({ reviews, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const quarters = {
    'Q1': 'Jan - Mar',
    'Q2': 'Apr - Jun',
    'Q3': 'Jul - Sep',
    'Q4': 'Oct - Dec'
  };

  return (
    <div className="space-y-6">
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Performance Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.review_id} className={`p-4 ${bgSecondary} rounded-lg`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                        <Award className="h-5 w-5 text-[#6366f1]" />
                      </div>
                      <div>
                        <p className={`font-semibold ${textPrimary}`}>{review.quarter} {review.year}</p>
                        <p className={`text-xs ${textSecondary}`}>{quarters[review.quarter]}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={`${
                        review.status === 'acknowledged' ? 'bg-green-500/20 text-green-400' :
                        review.status === 'submitted' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {review.status}
                      </Badge>
                      {review.overall_rating > 0 && (
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span key={star} className={star <= review.overall_rating ? 'text-yellow-400' : 'text-[#3f3f46]'}>
                              ★
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {review.achievements && (
                    <div className="mb-2">
                      <p className={`text-xs ${textSecondary} mb-1`}>Achievements</p>
                      <p className={`text-sm ${textPrimary}`}>{review.achievements}</p>
                    </div>
                  )}
                  
                  {review.areas_of_improvement && (
                    <div className="mb-2">
                      <p className={`text-xs ${textSecondary} mb-1`}>Areas of Improvement</p>
                      <p className={`text-sm ${textPrimary}`}>{review.areas_of_improvement}</p>
                    </div>
                  )}
                  
                  <div className={`flex justify-between items-center mt-3 pt-3 border-t ${borderColor}`}>
                    <p className={`text-xs ${textSecondary}`}>Reviewed by: {review.reviewer_name}</p>
                    <Button variant="ghost" size="sm" className="text-[#6366f1]">
                      View Details <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Award className="h-12 w-12 text-[#3f3f46] mx-auto mb-4" />
              <p className={textSecondary}>No performance reviews yet</p>
              <p className={`text-sm ${textSecondary}`}>Your quarterly reviews will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// Security Tab - Password Change with OTP
function SecurityTab({ bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const { user } = useAuth();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStep, setPasswordStep] = useState('request'); // request, verify, change
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const resetPasswordFlow = () => {
    setPasswordStep('request');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleRequestOTP = async () => {
    try {
      const res = await axios.post(`${API}/api/auth/request-otp`, {}, { headers });
      setPasswordStep('verify');
      toast.success(res.data.message || 'OTP sent to your registered email!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    setPasswordStep('change');
    toast.success('Now enter your new password.');
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await axios.post(`${API}/api/auth/verify-otp-change-password`, { 
        otp,
        new_password: newPassword,
        confirm_password: confirmPassword
      }, { headers });
      toast.success('Password changed successfully!');
      setShowPasswordModal(false);
      resetPasswordFlow();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    }
  };

  return (
    <div className="space-y-6">
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
            <Lock className="h-5 w-5 text-[#ef4444]" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`mb-4 ${textSecondary}`}>
            Secure your account by changing your password. We'll send a verification OTP to your registered email.
          </p>
          <Button 
            onClick={() => setShowPasswordModal(true)}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
          >
            <Key className="h-4 w-4 mr-2" />
            Change Password
          </Button>

          {/* Password Requirements */}
          <div className={`mt-6 p-4 rounded-lg ${bgSecondary}`}>
            <h4 className={`font-medium mb-2 ${textPrimary}`}>Password Requirements</h4>
            <ul className={`text-sm space-y-1 ${textSecondary}`}>
              <li>• Minimum 6 characters</li>
              <li>• OTP will be sent to your registered email</li>
              <li>• OTP is valid for 10 minutes</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {passwordStep === 'request' && (
                <>
                  <p className={textSecondary}>
                    We'll send a 6-digit OTP to your registered email: <strong>{user?.email}</strong>
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowPasswordModal(false)} className={borderColor}>
                      Cancel
                    </Button>
                    <Button onClick={handleRequestOTP} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white">
                      Send OTP
                    </Button>
                  </div>
                </>
              )}

              {passwordStep === 'verify' && (
                <>
                  <div className="flex items-center gap-2 text-[#10b981]">
                    <CheckCircle className="h-5 w-5" />
                    <span>OTP sent to {user?.email}</span>
                  </div>
                  <div>
                    <Label className={textPrimary}>Enter 6-digit OTP</Label>
                    <Input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className={`mt-1 text-center text-2xl tracking-widest ${bgSecondary} ${textPrimary}`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setPasswordStep('request')} className={borderColor}>
                      Back
                    </Button>
                    <Button onClick={handleVerifyOTP} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white">
                      Verify OTP
                    </Button>
                  </div>
                </>
              )}

              {passwordStep === 'change' && (
                <>
                  <div>
                    <Label className={textPrimary}>New Password</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className={`${bgSecondary} ${textPrimary} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSecondary}`}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className={textPrimary}>Confirm Password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className={`mt-1 ${bgSecondary} ${textPrimary}`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setPasswordStep('verify')} className={borderColor}>
                      Back
                    </Button>
                    <Button onClick={handleChangePassword} className="bg-[#10b981] hover:bg-[#059669] text-white">
                      Change Password
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}



// ============ Permission Tab Component ============
function PermissionTab({ permissionRequests, onRefresh, formatDate, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: 1,
    from_time: '',
    to_time: '',
    reason: ''
  });
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/hr/permissions/request`, form, { headers });
      toast.success('Permission request submitted successfully');
      setShowModal(false);
      setForm({ date: new Date().toISOString().split('T')[0], hours: 1, from_time: '', to_time: '', reason: '' });
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit permission request');
    }
  };

  const pendingCount = permissionRequests.filter(r => r.status === 'pending').length;
  const approvedCount = permissionRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = permissionRequests.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Header with Request Button */}
      <div className="flex justify-between items-center">
        <h2 className={`text-xl font-bold ${textPrimary}`}>Permission Requests</h2>
        <Button onClick={() => setShowModal(true)} className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white">
          <Send className="h-4 w-4 mr-2" />
          Request Permission
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#f59e0b]">{pendingCount}</p>
            <p className={`text-sm ${textSecondary}`}>Pending</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#10b981]">{approvedCount}</p>
            <p className={`text-sm ${textSecondary}`}>Approved</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#ef4444]">{rejectedCount}</p>
            <p className={`text-sm ${textSecondary}`}>Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>My Permission Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {permissionRequests.length > 0 ? (
            <div className="space-y-3">
              {permissionRequests.map((req) => (
                <div key={req.permission_id} className={`p-4 ${bgSecondary} rounded-lg`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{formatDate(req.date)}</p>
                      <p className={`text-sm ${textSecondary}`}>
                        {req.from_time || 'N/A'} - {req.to_time || 'N/A'} ({req.hours || 1} hrs)
                      </p>
                      <p className={`text-sm ${textSecondary} mt-1`}>{req.reason}</p>
                    </div>
                    <Badge className={`${
                      req.status === 'approved' ? 'bg-[#10b981]/20 text-[#10b981]' :
                      req.status === 'rejected' ? 'bg-[#ef4444]/20 text-[#ef4444]' :
                      'bg-[#f59e0b]/20 text-[#f59e0b]'
                    }`}>
                      {req.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-[#3f3f46] mx-auto mb-3" />
              <p className={textSecondary}>No permission requests found</p>
              <Button onClick={() => setShowModal(true)} className="mt-4 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white">
                Request Your First Permission
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={textPrimary}>Request Permission</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className={textPrimary}>Date</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({...form, date: e.target.value})}
                    className={`mt-1 ${bgSecondary} ${textPrimary}`}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>From Time</Label>
                    <Input
                      type="time"
                      value={form.from_time}
                      onChange={(e) => setForm({...form, from_time: e.target.value})}
                      className={`mt-1 ${bgSecondary} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>To Time</Label>
                    <Input
                      type="time"
                      value={form.to_time}
                      onChange={(e) => setForm({...form, to_time: e.target.value})}
                      className={`mt-1 ${bgSecondary} ${textPrimary}`}
                    />
                  </div>
                </div>
                <div>
                  <Label className={textPrimary}>Hours Requested</Label>
                  <Input
                    type="number"
                    min="0.5"
                    max="8"
                    step="0.5"
                    value={form.hours}
                    onChange={(e) => setForm({...form, hours: parseFloat(e.target.value)})}
                    className={`mt-1 ${bgSecondary} ${textPrimary}`}
                    required
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Reason</Label>
                  <Input
                    value={form.reason}
                    onChange={(e) => setForm({...form, reason: e.target.value})}
                    placeholder="Enter reason for permission"
                    className={`mt-1 ${bgSecondary} ${textPrimary}`}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowModal(false)} className={`flex-1 ${borderColor}`}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white">
                    Submit Request
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============ Remote (WFH) Tab Component ============
function RemoteTab({ wfhRequests, onRefresh, formatDate, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    reason: ''
  });
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/hr/wfh/request`, form, { headers });
      toast.success('Work from home request submitted successfully');
      setShowModal(false);
      setForm({ date: new Date().toISOString().split('T')[0], reason: '' });
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit WFH request');
    }
  };

  const pendingCount = wfhRequests.filter(r => r.status === 'pending').length;
  const approvedCount = wfhRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = wfhRequests.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Header with Request Button */}
      <div className="flex justify-between items-center">
        <h2 className={`text-xl font-bold ${textPrimary}`}>Work from Home Requests</h2>
        <Button onClick={() => setShowModal(true)} className="bg-[#10b981] hover:bg-[#059669] text-white">
          <Home className="h-4 w-4 mr-2" />
          Request WFH
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#f59e0b]">{pendingCount}</p>
            <p className={`text-sm ${textSecondary}`}>Pending</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#10b981]">{approvedCount}</p>
            <p className={`text-sm ${textSecondary}`}>Approved</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#ef4444]">{rejectedCount}</p>
            <p className={`text-sm ${textSecondary}`}>Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>My WFH Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {wfhRequests.length > 0 ? (
            <div className="space-y-3">
              {wfhRequests.map((req) => (
                <div key={req.wfh_id} className={`p-4 ${bgSecondary} rounded-lg`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{formatDate(req.date)}</p>
                      <p className={`text-sm ${textSecondary} mt-1`}>{req.reason}</p>
                      {req.admin_remarks && (
                        <p className={`text-xs ${textSecondary} mt-2 italic`}>
                          Admin: {req.admin_remarks}
                        </p>
                      )}
                    </div>
                    <Badge className={`${
                      req.status === 'approved' ? 'bg-[#10b981]/20 text-[#10b981]' :
                      req.status === 'rejected' ? 'bg-[#ef4444]/20 text-[#ef4444]' :
                      'bg-[#f59e0b]/20 text-[#f59e0b]'
                    }`}>
                      {req.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Home className="h-12 w-12 text-[#3f3f46] mx-auto mb-3" />
              <p className={textSecondary}>No work from home requests found</p>
              <Button onClick={() => setShowModal(true)} className="mt-4 bg-[#10b981] hover:bg-[#059669] text-white">
                Request Your First WFH
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={textPrimary}>Request Work from Home</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className={textPrimary}>Date</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({...form, date: e.target.value})}
                    className={`mt-1 ${bgSecondary} ${textPrimary}`}
                    required
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Reason</Label>
                  <Input
                    value={form.reason}
                    onChange={(e) => setForm({...form, reason: e.target.value})}
                    placeholder="Enter reason for WFH request"
                    className={`mt-1 ${bgSecondary} ${textPrimary}`}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowModal(false)} className={`flex-1 ${borderColor}`}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white">
                    Submit Request
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}