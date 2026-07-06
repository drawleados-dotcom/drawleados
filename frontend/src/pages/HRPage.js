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
  CheckCircle, XCircle, AlertCircle, ChevronRight, Key, Play,
  LayoutGrid, List, X, Trophy, TrendingUp, Target, MessageSquare,
  Coffee
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import TwoFactorSettings from '../components/TwoFactorSettings';
import useAutoRefresh from '../hooks/useAutoRefresh';

const API = process.env.REACT_APP_BACKEND_URL;

export default function HRPage() {
  const { isDark } = useTheme();
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState('attendance');
  const [tabVisibility, setTabVisibility] = useState({
    attendance: true, profile: true, requests: true,
    payroll: true, reviews: true, security: true,
  });
  
  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const hoverBg = isDark ? 'hover:bg-[#3f3f46]' : 'hover:bg-gray-200';
  
  // Get token from localStorage
  const token = localStorage.getItem('session_token');
  const navigate = useNavigate();
  
  // Attendance state
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [workHoursToday, setWorkHoursToday] = useState('-');
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
  
  // Reviews state
  const [reviews, setReviews] = useState([]);
  
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
    // Also fetch work hours from operations tasks for today
    try {
      const today = new Date().toISOString().slice(0, 10);
      const wh = await axios.get(`${API}/api/our-tasks/work-hours/${today}`, { headers });
      setWorkHoursToday(wh.data?.formatted || '0h 0m');
    } catch (e) {
      // silent — endpoint may not exist on older envs
      setWorkHoursToday('-');
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

  // Background polling + tab-focus refresh — only re-fetches data for the active tab
  useAutoRefresh(() => {
    if (activeTab === 'attendance') { loadTodayAttendance(); loadAttendanceHistory(); }
    else if (activeTab === 'calendar') { loadCalendarData(); }
    else if (activeTab === 'profile') { loadProfile(); }
    else if (activeTab === 'leave') { loadLeaveRequests(); loadLeaveBalance(); }
    else if (activeTab === 'permission') { loadPermissionRequests(); }
    else if (activeTab === 'remote') { loadWfhRequests(); }
    else if (activeTab === 'payroll') { loadPayslips(); }
    else if (activeTab === 'reviews') { loadReviews(); }
  });

  // Load My Profile tab visibility config (set by HR Admin)
  useEffect(() => {
    const loadVisibility = async () => {
      try {
        const res = await axios.get(`${API}/api/hr/admin/my-profile-config`, { headers: { Authorization: `Bearer ${token}` } });
        const tabs = res.data?.tabs;
        if (tabs && typeof tabs === 'object') {
          setTabVisibility(prev => ({ ...prev, ...tabs }));
        }
      } catch (error) {
        // Non-fatal — keep all tabs visible if config fails to load
        console.error('Failed to load My Profile tab config:', error);
      }
    };
    loadVisibility();
  }, [token]);

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

  // Main tabs
  const mainTabs = [
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'requests', label: 'Requests', icon: Send },
    { id: 'payroll', label: 'Payroll', icon: FileText },
    { id: 'reviews', label: 'Reviews', icon: Award },
    { id: 'security', label: 'Security', icon: Shield },
  ].filter(t => tabVisibility[t.id] !== false);

  // If the currently active tab gets hidden, switch to the first visible one
  useEffect(() => {
    if (tabVisibility[activeTab] === false) {
      const firstVisible = ['attendance','profile','requests','payroll','reviews','security'].find(id => tabVisibility[id] !== false);
      if (firstVisible) setActiveTab(firstVisible);
    }
  }, [tabVisibility, activeTab]);

  // Request sub-tabs with counts
  const requestSubTabs = [
    { id: 'req-attendance', label: 'Attendance', icon: Clock, count: tabCounts.attendance },
    { id: 'req-leave', label: 'Leave', icon: Calendar, count: tabCounts.leave },
    { id: 'req-permission', label: 'Permission', icon: Clock, count: tabCounts.permission },
    { id: 'req-remote', label: 'Remote', icon: Home, count: tabCounts.remote },
  ];

  // State for request sub-tab
  const [activeRequestSubTab, setActiveRequestSubTab] = useState('req-leave');

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

        {/* Main Tabs Row */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`hr-tab-${tab.id}`}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? tab.id === 'profile'
                      ? 'bg-yellow-500 text-white shadow-lg'
                      : 'bg-blue-600 text-white shadow-lg'
                    : `${bgCard} ${textSecondary} ${hoverBg} border ${borderColor}`
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
            workHoursToday={workHoursToday}
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

        {/* Requests Tab with Sub-tabs */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            {/* Sub-tabs: Attendance | Leave | Permission | Remote */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {requestSubTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.id}
                    onClick={() => setActiveRequestSubTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      activeRequestSubTab === tab.id
                        ? 'bg-[#10b981] text-white'
                        : `${bgSecondary} ${textSecondary} ${hoverBg}`
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        activeRequestSubTab === tab.id ? 'bg-white/20' : 'bg-[#f59e0b]/20 text-[#f59e0b]'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                    {tab.count === 0 && (
                      <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                        activeRequestSubTab === tab.id ? 'bg-white/20' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Attendance Requests Sub-Tab */}
            {activeRequestSubTab === 'req-attendance' && (
              <RequestsAttendanceTab
                attendanceHistory={attendanceHistory}
                formatDate={formatDate}
                formatTime={formatTime}
                bgCard={bgCard}
                bgSecondary={bgSecondary}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                borderColor={borderColor}
              />
            )}

            {/* Leave Requests Sub-Tab */}
            {activeRequestSubTab === 'req-leave' && (
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
                hoverBg={hoverBg}
                isDark={isDark}
              />
            )}

            {/* Permission Requests Sub-Tab */}
            {activeRequestSubTab === 'req-permission' && (
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

            {/* Remote/WFH Requests Sub-Tab */}
            {activeRequestSubTab === 'req-remote' && (
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
          </div>
        )}

        {activeTab === 'payroll' && (
          <PayrollTab 
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
            currentUser={authUser}
            hoverBg={hoverBg}
            isDark={isDark}
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
            hoverBg={hoverBg}
            isDark={isDark}
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

function AttendanceTab({ todayAttendance, attendanceHistory, attendanceSummary, workHoursToday, onClockIn, onClockOut, formatTime, formatDate, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
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
  // Break state (multiple breaks per day). Falls back to legacy lunch fields.
  const breaksList = Array.isArray(attendance?.breaks) ? attendance.breaks : [];
  const isOnBreak = breaksList.some((b) => b.end_time == null) ||
    (!breaksList.length && attendance?.lunch_start && !attendance?.lunch_end);
  const totalBreakMinutes = breaksList.length > 0
    ? breaksList.reduce((sum, b) => sum + (Number(b.duration_minutes) || 0), 0)
    : (attendance?.lunch_duration || 0);
  const breakCount = breaksList.length;
  const [showBreakSummary, setShowBreakSummary] = useState(false);
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

  // ===== COMPREHENSIVE HOURS TRACKING =====
  const STANDARD_WORK_HOURS = 8;
  const totalWorkingDays = monthlyStats?.total_working_days || 22;
  const presentDays = monthlyStats?.present || filteredHistory.length;
  
  // Expected working hours for the month = Total Working Days × 8 hours
  const expectedMonthlyHours = totalWorkingDays * STANDARD_WORK_HOURS;
  
  // Total worked hours (sum of all work hours)
  const totalWorkedHours = filteredHistory.reduce((sum, r) => sum + (r.total_hours || 0), 0);
  
  // Extra hours (hours beyond 8 per day)
  const extraHours = filteredHistory.reduce((sum, r) => {
    const hours = r.total_hours || 0;
    if (hours > STANDARD_WORK_HOURS) {
      return sum + (hours - STANDARD_WORK_HOURS);
    }
    return sum;
  }, 0);
  
  // Permission hours taken (will be passed from parent or fetched)
  const permissionHours = monthlyStats?.permission_hours || 0;
  
  // Final balance: Total worked - Expected + Extra - Permission
  const finalBalance = totalWorkedHours - expectedMonthlyHours;
  const isPositiveBalance = finalBalance >= 0;

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

  // Format minutes → "Xh Ym" (e.g., 90 → "1h 30m", 45 → "45m")
  const formatMinutes = (mins) => {
    const total = Number(mins);
    if (!total || total <= 0) return '0m';
    const h = Math.floor(total / 60);
    const m = Math.round(total % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  // Calculate lunch difference
  const getLunchDiff = (lunchDuration) => {
    if (!lunchDuration) return null;
    const diff = lunchDuration - standardLunchMinutes;
    if (diff > 0) return { text: `+${formatMinutes(diff)} extra`, color: 'text-red-400' };
    if (diff < 0) return { text: `${formatMinutes(Math.abs(diff))} before`, color: 'text-green-400' };
    return { text: 'On time', color: 'text-gray-400' };
  };

  return (
    <div className="space-y-6">
      {/* 1. Today's Attendance Summary (No buttons) */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className={`${textPrimary} flex flex-wrap items-center gap-3`}>
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#10b981]" />
                Today's Attendance
              </span>
              {settings && <span className={`text-sm font-normal ${textSecondary}`}>(Standard: {settings.standard_login_time} - {settings.standard_logout_time})</span>}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2" data-testid="attendance-header-tags">
              <Badge className={`${
                isClockedOut ? 'bg-green-500/20 text-green-400' :
                isOnBreak ? 'bg-yellow-500/20 text-yellow-400' :
                isClockedIn ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              } px-3 py-1 text-sm pointer-events-none`} data-testid="attendance-status-tag">
                {isClockedOut ? 'Day Complete' : isOnBreak ? 'On Break' : isClockedIn ? 'Working' : 'Not Started'}
              </Badge>
              <Badge className={`${bgSecondary} ${textPrimary} border ${borderColor} px-3 py-1 text-sm flex items-center gap-1 pointer-events-none`} data-testid="attendance-work-mode-tag">
                {attendance?.work_mode === 'home' || attendance?.work_location === 'home' ? (
                  <>
                    <Home className="h-3.5 w-3.5 text-[#10b981]" />
                    <span>Remote</span>
                  </>
                ) : (
                  <>
                    <Building className="h-3.5 w-3.5 text-[#6366f1]" />
                    <span>Office</span>
                  </>
                )}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Login</p>
              <p className={`text-2xl font-semibold ${textPrimary}`}>{formatTime(attendance?.clock_in)}</p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Logout</p>
              <p className={`text-2xl font-semibold ${textPrimary}`}>{formatTime(attendance?.clock_out)}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowBreakSummary(true)}
              className={`p-4 ${bgSecondary} rounded-lg text-left transition hover:ring-2 hover:ring-[#f59e0b]`}
              data-testid="break-card"
            >
              <p className={`text-xs ${textSecondary} mb-1 flex items-center justify-between`}>
                <span>Break</span>
                {breakCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] text-[10px] font-semibold" data-testid="break-count-badge">
                    {breakCount}×
                  </span>
                )}
              </p>
              <p className={`text-2xl font-semibold ${textPrimary}`} data-testid="break-total-display">
                {totalBreakMinutes > 0
                  ? (totalBreakMinutes >= 60
                      ? `${Math.floor(totalBreakMinutes / 60)}h ${totalBreakMinutes % 60}m`
                      : `${totalBreakMinutes}m`)
                  : '-'}
              </p>
            </button>
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Sessions</p>
              <p className={`text-2xl font-semibold ${textPrimary}`}>{sessions.length > 0 ? sessions.length : (attendance?.clock_in ? 1 : 0)}</p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Login Hour</p>
              <p className={`text-2xl font-semibold text-[#10b981]`}>{attendance?.total_hours?.toFixed(2) || '-'}</p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Work Hours</p>
              <p className={`text-2xl font-semibold text-[#6366f1]`} data-testid="work-hours-today">{workHoursToday || '-'}</p>
              <p className={`text-[10px] ${textSecondary}`}>tracked from tasks</p>
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
          <p className="text-2xl font-bold text-[#10b981]">{totalWorkingDays}</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-4`}>
          <p className={`text-xs ${textSecondary} mb-1`}>Present Days</p>
          <p className="text-2xl font-bold text-[#6366f1]">{presentDays}</p>
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
          <p className="text-2xl font-bold text-[#8b5cf6]">{extraHours.toFixed(1)}</p>
        </Card>
      </div>

      {/* 3b. Hours Summary - NEW */}
      <Card className={`${bgCard} border-2 border-[#6366f1]`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-[#6366f1]" />
            <h3 className={`font-semibold ${textPrimary}`}>Monthly Hours Summary - {monthNames[selectedMonth - 1]} {selectedYear}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className={`p-3 ${bgSecondary} rounded-lg text-center`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Expected Hours</p>
              <p className="text-xl font-bold text-[#6366f1]">{expectedMonthlyHours.toFixed(1)}</p>
              <p className={`text-xs ${textSecondary}`}>({totalWorkingDays} days × 8h)</p>
            </div>
            <div className={`p-3 ${bgSecondary} rounded-lg text-center`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Total Worked</p>
              <p className="text-xl font-bold text-[#10b981]">{totalWorkedHours.toFixed(1)}</p>
              <p className={`text-xs ${textSecondary}`}>Actual hours</p>
            </div>
            <div className={`p-3 ${bgSecondary} rounded-lg text-center`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Extra Hours</p>
              <p className="text-xl font-bold text-[#8b5cf6]">+{extraHours.toFixed(1)}</p>
              <p className={`text-xs ${textSecondary}`}>Overtime</p>
            </div>
            <div className={`p-3 ${bgSecondary} rounded-lg text-center`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Permission</p>
              <p className="text-xl font-bold text-[#f59e0b]">-{permissionHours.toFixed(1)}</p>
              <p className={`text-xs ${textSecondary}`}>Hours taken</p>
            </div>
            <div className={`p-3 ${bgSecondary} rounded-lg text-center`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Net Worked</p>
              <p className="text-xl font-bold text-[#10b981]">{(totalWorkedHours - permissionHours).toFixed(1)}</p>
              <p className={`text-xs ${textSecondary}`}>Effective</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${isPositiveBalance ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Balance</p>
              <p className={`text-xl font-bold ${isPositiveBalance ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                {isPositiveBalance ? '+' : ''}{finalBalance.toFixed(1)}
              </p>
              <p className={`text-xs ${textSecondary}`}>{isPositiveBalance ? 'Ahead' : 'Behind'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`} data-testid="th-history-total-login">Total Login Hour</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`} data-testid="th-history-balance">Balance Hour</th>
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

                  // Total Login Hour = clock_out - clock_in (gross, includes breaks)
                  let totalLoginHrs = null;
                  if (record.clock_in && record.clock_out) {
                    const ms = new Date(record.clock_out) - new Date(record.clock_in);
                    if (ms > 0) totalLoginHrs = ms / 3600000;
                  } else if (record.total_hours != null) {
                    totalLoginHrs = Number(record.total_hours);
                  }

                  // Balance Hour = total login - standard work hours (default 8h)
                  const standardWorkHours = Number(settings?.standard_work_hours) || 8;
                  const balanceHrs = totalLoginHrs != null ? (totalLoginHrs - standardWorkHours) : null;
                  
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
                      <td className={`p-3 ${textPrimary} font-medium`} data-testid={`history-total-login-${index}`}>
                        {totalLoginHrs != null ? `${totalLoginHrs.toFixed(2)}h` : '-'}
                      </td>
                      <td className={`p-3 font-medium`} data-testid={`history-balance-${index}`}>
                        {balanceHrs != null ? (
                          <span className={balanceHrs >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}>
                            {balanceHrs >= 0 ? '+' : ''}{balanceHrs.toFixed(2)}h
                          </span>
                        ) : '-'}
                      </td>
                      <td className={`p-3`}>
                        {record.lunch_duration ? (
                          <div>
                            <span className={textPrimary}>{formatMinutes(record.lunch_duration)}</span>
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
                    <td colSpan={11} className={`p-8 text-center ${textSecondary}`}>
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
                    <span className="text-xl font-bold text-[#f59e0b]">{formatMinutes(selectedDayRecord.lunch_duration || 0)}</span>
                    <span className={textSecondary}> / {formatMinutes(standardLunchMinutes)}</span>
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

      {/* Break Summary Popup */}
      {showBreakSummary && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowBreakSummary(false)}
          data-testid="break-summary-modal"
        >
          <Card
            className={`w-full max-w-lg ${bgCard} border ${borderColor}`}
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className={`${textPrimary} flex items-center gap-2`}>
                <Coffee className="h-5 w-5 text-[#f59e0b]" />
                Today's Breaks
              </CardTitle>
              <button
                onClick={() => setShowBreakSummary(false)}
                className={`${textSecondary} hover:${textPrimary}`}
                data-testid="break-summary-close"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Totals header */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-4 ${bgSecondary} rounded-lg`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Total Time</p>
                  <p className={`text-2xl font-semibold text-[#f59e0b]`} data-testid="break-summary-total">
                    {totalBreakMinutes > 0
                      ? (totalBreakMinutes >= 60
                          ? `${Math.floor(totalBreakMinutes / 60)}h ${totalBreakMinutes % 60}m`
                          : `${totalBreakMinutes}m`)
                      : '0m'}
                  </p>
                </div>
                <div className={`p-4 ${bgSecondary} rounded-lg`}>
                  <p className={`text-xs ${textSecondary} mb-1`}>Total Breaks</p>
                  <p className={`text-2xl font-semibold ${textPrimary}`} data-testid="break-summary-count">{breakCount}</p>
                </div>
              </div>

              {/* Per-break list */}
              <div className="space-y-2">
                {breaksList.length === 0 ? (
                  <p className={`text-sm ${textSecondary} text-center py-4`}>No breaks taken today.</p>
                ) : (
                  breaksList.map((b, idx) => {
                    const labelMap = { lunch: 'Lunch', breakfast: 'Breakfast', tea: 'Tea Break', other: 'Other' };
                    const colorMap = {
                      lunch: 'bg-orange-500/20 text-orange-400',
                      breakfast: 'bg-amber-500/20 text-amber-400',
                      tea: 'bg-emerald-500/20 text-emerald-400',
                      other: 'bg-purple-500/20 text-purple-400',
                    };
                    const cat = b.category || 'other';
                    const dur = Number(b.duration_minutes) || 0;
                    const durLabel = b.end_time
                      ? (dur >= 60 ? `${Math.floor(dur / 60)}h ${dur % 60}m` : `${dur}m`)
                      : 'In progress';
                    return (
                      <div
                        key={b.break_id || idx}
                        className={`p-3 ${bgSecondary} rounded-lg flex items-center justify-between gap-3`}
                        data-testid={`break-item-${idx}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Badge className={`${colorMap[cat] || colorMap.other} pointer-events-none`}>
                            {labelMap[cat] || cat}
                          </Badge>
                          <div className="min-w-0">
                            <p className={`text-sm ${textPrimary} truncate`}>
                              {formatTime(b.start_time)} — {b.end_time ? formatTime(b.end_time) : '...'}
                            </p>
                            {b.reason && (
                              <p className={`text-xs ${textSecondary} truncate`}>{b.reason}</p>
                            )}
                          </div>
                        </div>
                        <span className={`text-sm font-semibold ${textPrimary} flex-shrink-0`} data-testid={`break-item-${idx}-duration`}>
                          {durLabel}
                        </span>
                      </div>
                    );
                  })
                )}
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

function LeaveTab({ leaveRequests, leaveBalance, showModal, setShowModal, leaveForm, setLeaveForm, onSubmit, formatDate, bgCard, bgSecondary, textPrimary, textSecondary, borderColor, hoverBg, isDark }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = [2024, 2025, 2026, 2027];

  // Filter leave requests by selected month/year
  const filteredRequests = leaveRequests.filter(r => {
    const reqDate = new Date(r.start_date || r.from_date);
    return reqDate.getMonth() + 1 === selectedMonth && reqDate.getFullYear() === selectedYear;
  });

  // MONTHLY QUOTA SYSTEM: 1 Casual + 1 Sick per month, then LOP
  // Calculate monthly usage based on approved/pending leaves in selected month
  const casualUsedThisMonth = filteredRequests.filter(r => 
    r.leave_type?.toLowerCase() === 'casual' && (r.status === 'approved' || r.status === 'pending')
  ).length;
  const sickUsedThisMonth = filteredRequests.filter(r => 
    r.leave_type?.toLowerCase() === 'sick' && (r.status === 'approved' || r.status === 'pending')
  ).length;
  const lopThisMonth = filteredRequests.filter(r => 
    r.leave_type?.toLowerCase() === 'lop'
  ).length;
  
  // Monthly limits: 1 casual, 1 sick per month
  const MONTHLY_CASUAL_LIMIT = 1;
  const MONTHLY_SICK_LIMIT = 1;
  
  const casualRemaining = MONTHLY_CASUAL_LIMIT - casualUsedThisMonth;
  const sickRemaining = MONTHLY_SICK_LIMIT - sickUsedThisMonth;

  // Check if leave type is exhausted for this month
  const isCasualExhausted = casualRemaining <= 0;
  const isSickExhausted = sickRemaining <= 0;

  // Calculate days between dates
  const calculateDays = (from, to) => {
    if (!from || !to) return 0;
    const start = new Date(from);
    const end = new Date(to);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // Get day name
  const getDayName = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return 'bg-[#22c55e]/20 text-[#22c55e]';
      case 'rejected': return 'bg-[#ef4444]/20 text-[#ef4444]';
      case 'pending': return 'bg-[#f59e0b]/20 text-[#f59e0b]';
      default: return 'bg-[#6366f1]/20 text-[#6366f1]';
    }
  };

  // Get leave type badge
  const getLeaveTypeBadge = (type) => {
    switch (type?.toLowerCase()) {
      case 'casual': return 'bg-[#6366f1]/20 text-[#6366f1]';
      case 'sick': return 'bg-[#f59e0b]/20 text-[#f59e0b]';
      case 'lop': return 'bg-[#ef4444]/20 text-[#ef4444]';
      default: return 'bg-[#10b981]/20 text-[#10b981]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Month/Year Filter + Request Button */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
            data-testid="leave-month-filter"
          >
            {months.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
            data-testid="leave-year-filter"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <Button 
          onClick={() => setShowModal(true)}
          className="bg-[#10b981] hover:bg-[#059669] text-white"
          data-testid="request-leave-btn"
        >
          <Send className="mr-2 h-4 w-4" />
          Request Leave
        </Button>
      </div>

      {/* Monthly Leave Balance Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`${bgCard} border ${borderColor} ${isCasualExhausted ? 'opacity-50' : ''}`} data-testid="casual-leave-card">
          <CardContent className="p-4 text-center">
            <p className={`text-xs ${textSecondary} mb-1`}>Casual Leave</p>
            <p className="text-2xl font-bold text-[#6366f1]">
              {casualUsedThisMonth}<span className={`text-sm ${textSecondary}`}>/{MONTHLY_CASUAL_LIMIT}</span>
            </p>
            <p className={`text-xs ${textSecondary} mt-1`}>{months[selectedMonth - 1]} {selectedYear}</p>
            {isCasualExhausted && <Badge className="mt-2 bg-red-500/20 text-red-400 text-xs">Limit Reached</Badge>}
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor} ${isSickExhausted ? 'opacity-50' : ''}`} data-testid="sick-leave-card">
          <CardContent className="p-4 text-center">
            <p className={`text-xs ${textSecondary} mb-1`}>Sick Leave</p>
            <p className="text-2xl font-bold text-[#f59e0b]">
              {sickUsedThisMonth}<span className={`text-sm ${textSecondary}`}>/{MONTHLY_SICK_LIMIT}</span>
            </p>
            <p className={`text-xs ${textSecondary} mt-1`}>{months[selectedMonth - 1]} {selectedYear}</p>
            {isSickExhausted && <Badge className="mt-2 bg-red-500/20 text-red-400 text-xs">Limit Reached</Badge>}
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`} data-testid="lop-leave-card">
          <CardContent className="p-4 text-center">
            <p className={`text-xs ${textSecondary} mb-1`}>LOP</p>
            <p className="text-2xl font-bold text-[#ef4444]">{lopThisMonth}</p>
            <p className={`text-xs ${textSecondary} mt-1`}>Deducted</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`} data-testid="total-leave-card">
          <CardContent className="p-4 text-center">
            <p className={`text-xs ${textSecondary} mb-1`}>Total Leaves</p>
            <p className="text-2xl font-bold text-[#10b981]">{filteredRequests.length}</p>
            <p className={`text-xs ${textSecondary} mt-1`}>This Month</p>
          </CardContent>
        </Card>
      </div>

      {/* Leave Requests Table */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Leave Requests - {months[selectedMonth - 1]} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Leave Type</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Date</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Day</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Days</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Reason</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req, index) => (
                  <tr 
                    key={req.leave_id || index} 
                    className={`border-b ${borderColor} hover:${bgSecondary} cursor-pointer`}
                    onClick={() => { setSelectedRequest(req); setShowDetailModal(true); }}
                  >
                    <td className="p-3">
                      <Badge className={getLeaveTypeBadge(req.leave_type)}>
                        {req.leave_type?.toUpperCase() || 'LEAVE'}
                      </Badge>
                    </td>
                    <td className={`p-3 ${textPrimary}`}>
                      {formatDate(req.start_date || req.from_date)}
                      {req.end_date && req.end_date !== req.start_date && (
                        <span> - {formatDate(req.end_date || req.to_date)}</span>
                      )}
                    </td>
                    <td className={`p-3 ${textSecondary}`}>
                      {getDayName(req.start_date || req.from_date)}
                    </td>
                    <td className={`p-3 ${textPrimary} font-medium`}>
                      {req.days || calculateDays(req.start_date || req.from_date, req.end_date || req.to_date)}
                    </td>
                    <td className={`p-3 ${textSecondary} max-w-[200px] truncate`} title={req.reason}>
                      {req.reason}
                    </td>
                    <td className="p-3">
                      <Badge className={getStatusBadge(req.status)}>{req.status}</Badge>
                    </td>
                  </tr>
                ))}
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center ${textSecondary}`}>
                      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No leave requests found for {months[selectedMonth - 1]} {selectedYear}</p>
                      <Button 
                        onClick={() => setShowModal(true)}
                        className="mt-4 bg-[#10b981] hover:bg-[#059669]"
                      >
                        Request Leave
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Leave Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`${bgCard} border ${borderColor} w-full max-w-md`}>
            <CardHeader>
              <CardTitle className={textPrimary}>Request Leave - {months[selectedMonth - 1]} {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                {/* Monthly Leave Quota Info */}
                <div className={`p-3 ${bgSecondary} rounded-lg text-sm ${textSecondary}`}>
                  <p className="font-medium mb-1">Monthly Quota:</p>
                  <p>• Casual: {casualUsedThisMonth}/{MONTHLY_CASUAL_LIMIT} used</p>
                  <p>• Sick: {sickUsedThisMonth}/{MONTHLY_SICK_LIMIT} used</p>
                  <p className="mt-1 text-xs italic">If both exhausted, LOP will be deducted</p>
                </div>

                {/* Leave Type Selection - Cascading Logic */}
                <div>
                  <Label className={textPrimary}>Leave Type</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {/* Casual - Primary option */}
                    <button
                      type="button"
                      onClick={() => !isCasualExhausted && setLeaveForm({...leaveForm, leave_type: 'casual'})}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        leaveForm.leave_type === 'casual'
                          ? 'bg-[#6366f1] border-[#6366f1] text-white'
                          : isCasualExhausted
                          ? `${bgSecondary} ${borderColor} opacity-40 cursor-not-allowed line-through`
                          : `${bgSecondary} ${borderColor} ${textPrimary} hover:border-[#6366f1]`
                      }`}
                      disabled={isCasualExhausted}
                      data-testid="leave-type-casual"
                    >
                      <p className="font-medium">Casual</p>
                      <p className="text-xs opacity-70">{casualRemaining}/{MONTHLY_CASUAL_LIMIT}</p>
                    </button>
                    {/* Sick - Secondary option (use after casual exhausted) */}
                    <button
                      type="button"
                      onClick={() => !isSickExhausted && setLeaveForm({...leaveForm, leave_type: 'sick'})}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        leaveForm.leave_type === 'sick'
                          ? 'bg-[#f59e0b] border-[#f59e0b] text-white'
                          : isSickExhausted
                          ? `${bgSecondary} ${borderColor} opacity-40 cursor-not-allowed line-through`
                          : `${bgSecondary} ${borderColor} ${textPrimary} hover:border-[#f59e0b]`
                      }`}
                      disabled={isSickExhausted}
                      data-testid="leave-type-sick"
                    >
                      <p className="font-medium">Sick</p>
                      <p className="text-xs opacity-70">{sickRemaining}/{MONTHLY_SICK_LIMIT}</p>
                    </button>
                    {/* LOP - Last resort (always available) */}
                    <button
                      type="button"
                      onClick={() => setLeaveForm({...leaveForm, leave_type: 'lop'})}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        leaveForm.leave_type === 'lop'
                          ? 'bg-[#ef4444] border-[#ef4444] text-white'
                          : `${bgSecondary} ${borderColor} ${textPrimary} hover:border-[#ef4444]`
                      }`}
                      data-testid="leave-type-lop"
                    >
                      <p className="font-medium">LOP</p>
                      <p className="text-xs opacity-70">Deducted</p>
                    </button>
                  </div>
                  {/* Cascading logic hint */}
                  {isCasualExhausted && !isSickExhausted && (
                    <p className="text-xs text-[#f59e0b] mt-2">Casual limit reached. Use Sick leave.</p>
                  )}
                  {isCasualExhausted && isSickExhausted && (
                    <p className="text-xs text-[#ef4444] mt-2">Both Casual & Sick exhausted. LOP will be deducted.</p>
                  )}
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>From Date</Label>
                    <Input
                      type="date"
                      value={leaveForm.start_date || ''}
                      onChange={(e) => setLeaveForm({...leaveForm, start_date: e.target.value})}
                      required
                      className={`mt-1 ${bgSecondary} ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>To Date</Label>
                    <Input
                      type="date"
                      value={leaveForm.end_date || ''}
                      onChange={(e) => setLeaveForm({...leaveForm, end_date: e.target.value})}
                      required
                      className={`mt-1 ${bgSecondary} ${borderColor} ${textPrimary}`}
                    />
                  </div>
                </div>

                {/* Days Calculation */}
                {leaveForm.start_date && leaveForm.end_date && (
                  <div className={`p-3 ${bgSecondary} rounded-lg text-center`}>
                    <span className={textSecondary}>Total Days: </span>
                    <span className={`font-bold ${textPrimary}`}>
                      {calculateDays(leaveForm.start_date, leaveForm.end_date)}
                    </span>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <Label className={textPrimary}>Reason</Label>
                  <textarea
                    value={leaveForm.reason || ''}
                    onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})}
                    required
                    rows={3}
                    className={`w-full mt-1 p-3 ${bgSecondary} border ${borderColor} rounded-lg ${textPrimary}`}
                    placeholder="Enter reason for leave..."
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className={`flex-1 ${bgSecondary} ${hoverBg} ${textPrimary}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white"
                  >
                    Request Leave
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leave Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`${bgCard} border ${borderColor} w-full max-w-md`}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className={textPrimary}>Leave Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowDetailModal(false)}>
                <XCircle className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`p-4 ${bgSecondary} rounded-lg space-y-3`}>
                <div className="flex items-center gap-2">
                  <Badge className={getLeaveTypeBadge(selectedRequest.leave_type)}>
                    {selectedRequest.leave_type?.toUpperCase()}
                  </Badge>
                  <Badge className={getStatusBadge(selectedRequest.status)}>
                    {selectedRequest.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className={textSecondary}>Date:</span>
                  <span className={textPrimary}>
                    {formatDate(selectedRequest.start_date || selectedRequest.from_date)}
                    {selectedRequest.end_date && selectedRequest.end_date !== selectedRequest.start_date && (
                      <span> - {formatDate(selectedRequest.end_date)}</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={textSecondary}>Days:</span>
                  <span className={textPrimary}>{selectedRequest.days || calculateDays(selectedRequest.start_date, selectedRequest.end_date)}</span>
                </div>
                <div>
                  <span className={textSecondary}>Reason:</span>
                  <p className={`${textPrimary} mt-1`}>{selectedRequest.reason}</p>
                </div>
                {selectedRequest.hr_remarks && (
                  <div>
                    <span className={textSecondary}>HR Remarks:</span>
                    <p className={`${textPrimary} mt-1`}>{selectedRequest.hr_remarks}</p>
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

function PayrollTab({ bgCard, bgSecondary, textPrimary, textSecondary, borderColor, currentUser, hoverBg, isDark }) {
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
      <div className={`flex gap-2 border-b ${borderColor} pb-2`}>
        {subTabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            variant={activeSubTab === tab.id ? 'default' : 'ghost'}
            className={activeSubTab === tab.id 
              ? 'bg-[#10b981] text-white' 
              : `${textSecondary} ${hoverBg}`
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

function ReviewsTab({ reviews, bgCard, bgSecondary, textPrimary, textSecondary, borderColor, hoverBg, isDark }) {
  // Filter mode: monthly, quarterly, yearly
  const [filterMode, setFilterMode] = useState('monthly');
  const [viewMode, setViewMode] = useState('card'); // card or list
  
  // Date filter states
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((currentDate.getMonth() + 1) / 3)); // Q1-Q4
  
  // Review detail modal
  const [selectedReview, setSelectedReview] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = [2024, 2025, 2026, 2027];
  const quarters = [
    { id: 1, name: 'Q1', months: 'Jan - Mar', monthRange: [1, 2, 3] },
    { id: 2, name: 'Q2', months: 'Apr - Jun', monthRange: [4, 5, 6] },
    { id: 3, name: 'Q3', months: 'Jul - Sep', monthRange: [7, 8, 9] },
    { id: 4, name: 'Q4', months: 'Oct - Dec', monthRange: [10, 11, 12] }
  ];

  // Reviewer role colors
  const roleColors = {
    'CEO': { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: '👑' },
    'Operations': { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '⚙️' },
    'HR': { bg: 'bg-green-500/20', text: 'text-green-400', icon: '👥' },
    'Project Manager': { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: '📋' },
    'default': { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: '📝' }
  };

  // Filter reviews based on mode and selected filters
  const filteredReviews = reviews.filter(review => {
    const reviewDate = new Date(review.created_at || review.review_date || `${review.year}-01-01`);
    const reviewMonth = reviewDate.getMonth() + 1;
    const reviewYear = review.year || reviewDate.getFullYear();

    if (filterMode === 'monthly') {
      // For monthly filter, check if review has a month or was created in that month
      if (review.review_month) {
        return review.review_month === selectedMonth && reviewYear === selectedYear;
      }
      return reviewMonth === selectedMonth && reviewYear === selectedYear;
    } else if (filterMode === 'quarterly') {
      const quarterData = quarters.find(q => q.id === selectedQuarter);
      if (review.quarter) {
        const reviewQuarter = parseInt(review.quarter.replace('Q', ''));
        return reviewQuarter === selectedQuarter && reviewYear === selectedYear;
      }
      return quarterData?.monthRange.includes(reviewMonth) && reviewYear === selectedYear;
    } else {
      // Yearly
      return reviewYear === selectedYear;
    }
  });

  // Get reviewer role info
  const getRoleInfo = (role) => {
    return roleColors[role] || roleColors['default'];
  };

  // Open review detail popup
  const handleViewDetails = (review) => {
    setSelectedReview(review);
    setShowDetailModal(true);
  };

  // Render star rating
  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={`text-lg ${star <= rating ? 'text-yellow-400' : 'text-[#3f3f46]'}`}>
            ★
          </span>
        ))}
        <span className={`ml-2 text-sm font-medium ${textPrimary}`}>{rating}/5</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filter Mode Tabs: Monthly | Quarterly | Yearly */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className={`flex rounded-lg ${bgSecondary} p-1`}>
          {['monthly', 'quarterly', 'yearly'].map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${
                filterMode === mode
                  ? 'bg-[#6366f1] text-white'
                  : `${textSecondary} ${hoverBg || 'hover:bg-gray-200'}`
              }`}
              data-testid={`review-filter-${mode}`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div className={`flex rounded-lg ${bgSecondary} p-1`}>
          <button
            onClick={() => setViewMode('card')}
            className={`px-3 py-2 rounded-md transition-all ${
              viewMode === 'card' ? 'bg-[#10b981] text-white' : `${textSecondary} ${hoverBg || 'hover:bg-gray-200'}`
            }`}
            data-testid="review-view-card"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 rounded-md transition-all ${
              viewMode === 'list' ? 'bg-[#10b981] text-white' : `${textSecondary} ${hoverBg || 'hover:bg-gray-200'}`
            }`}
            data-testid="review-view-list"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Date Filters based on Mode */}
      <div className="flex items-center gap-3 flex-wrap">
        {filterMode === 'monthly' && (
          <>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
              data-testid="review-month-filter"
            >
              {months.map((m, idx) => (
                <option key={idx} value={idx + 1}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
              data-testid="review-year-filter"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </>
        )}

        {filterMode === 'quarterly' && (
          <>
            <div className={`flex rounded-lg ${bgSecondary} p-1`}>
              {quarters.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuarter(q.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    selectedQuarter === q.id
                      ? 'bg-[#8b5cf6] text-white'
                      : `${textSecondary} ${hoverBg || 'hover:bg-gray-200'}`
                  }`}
                  data-testid={`review-quarter-${q.name}`}
                >
                  {q.name}
                  <span className={`text-xs ml-1 ${selectedQuarter === q.id ? 'text-white/70' : textSecondary}`}>
                    ({q.months})
                  </span>
                </button>
              ))}
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
              data-testid="review-year-filter-quarterly"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </>
        )}

        {filterMode === 'yearly' && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
            data-testid="review-year-filter-yearly"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}

        <div className={`ml-auto px-3 py-2 ${bgSecondary} rounded-lg`}>
          <span className={textSecondary}>Found: </span>
          <span className={`font-bold ${textPrimary}`}>{filteredReviews.length}</span>
          <span className={textSecondary}> reviews</span>
        </div>
      </div>

      {/* Reviews Content */}
      {filteredReviews.length > 0 ? (
        viewMode === 'card' ? (
          /* Card View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReviews.map((review) => {
              const roleInfo = getRoleInfo(review.reviewer_role || 'default');
              return (
                <Card 
                  key={review.review_id} 
                  className={`${bgCard} border ${borderColor} cursor-pointer hover:border-[#6366f1] transition-all`}
                  onClick={() => handleViewDetails(review)}
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-10 w-10 rounded-lg ${roleInfo.bg} flex items-center justify-center text-xl`}>
                          {roleInfo.icon}
                        </div>
                        <div>
                          <p className={`font-semibold ${textPrimary}`}>{review.reviewer_name}</p>
                          <Badge className={`${roleInfo.bg} ${roleInfo.text} text-xs`}>
                            {review.reviewer_role || 'Reviewer'}
                          </Badge>
                        </div>
                      </div>
                      <Badge className={`${
                        review.status === 'acknowledged' ? 'bg-green-500/20 text-green-400' :
                        review.status === 'submitted' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {review.status || 'pending'}
                      </Badge>
                    </div>

                    {/* Period */}
                    <div className={`mb-3 p-2 ${bgSecondary} rounded`}>
                      <p className={`text-xs ${textSecondary}`}>Review Period</p>
                      <p className={`font-medium ${textPrimary}`}>
                        {review.quarter ? `${review.quarter} ${review.year}` : 
                         review.review_month ? `${months[review.review_month - 1]} ${review.year}` :
                         review.year}
                      </p>
                    </div>

                    {/* Rating */}
                    {review.overall_rating > 0 && (
                      <div className="mb-3">
                        {renderStars(review.overall_rating)}
                      </div>
                    )}

                    {/* Summary */}
                    {review.summary && (
                      <p className={`text-sm ${textSecondary} line-clamp-2 mb-3`}>
                        {review.summary}
                      </p>
                    )}

                    {/* View Details Button */}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-[#6366f1] hover:bg-[#6366f1]/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(review);
                      }}
                    >
                      View Full Review <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* List View */
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${borderColor}`}>
                      <th className={`text-left p-4 ${textSecondary} text-sm font-medium`}>Reviewer</th>
                      <th className={`text-left p-4 ${textSecondary} text-sm font-medium`}>Role</th>
                      <th className={`text-left p-4 ${textSecondary} text-sm font-medium`}>Period</th>
                      <th className={`text-left p-4 ${textSecondary} text-sm font-medium`}>Rating</th>
                      <th className={`text-left p-4 ${textSecondary} text-sm font-medium`}>Status</th>
                      <th className={`text-left p-4 ${textSecondary} text-sm font-medium`}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReviews.map((review) => {
                      const roleInfo = getRoleInfo(review.reviewer_role || 'default');
                      return (
                        <tr 
                          key={review.review_id} 
                          className={`border-b ${borderColor} ${isDark ? 'hover:bg-[#27272a]/50' : 'hover:bg-gray-50'} cursor-pointer`}
                          onClick={() => handleViewDetails(review)}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className={`h-8 w-8 rounded-lg ${roleInfo.bg} flex items-center justify-center`}>
                                {roleInfo.icon}
                              </div>
                              <span className={`font-medium ${textPrimary}`}>{review.reviewer_name}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={`${roleInfo.bg} ${roleInfo.text}`}>
                              {review.reviewer_role || 'Reviewer'}
                            </Badge>
                          </td>
                          <td className={`p-4 ${textPrimary}`}>
                            {review.quarter ? `${review.quarter} ${review.year}` : 
                             review.review_month ? `${months[review.review_month - 1]} ${review.year}` :
                             review.year}
                          </td>
                          <td className="p-4">
                            {review.overall_rating > 0 ? (
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span key={star} className={`text-sm ${star <= review.overall_rating ? 'text-yellow-400' : 'text-[#3f3f46]'}`}>
                                    ★
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={textSecondary}>-</span>
                            )}
                          </td>
                          <td className="p-4">
                            <Badge className={`${
                              review.status === 'acknowledged' ? 'bg-green-500/20 text-green-400' :
                              review.status === 'submitted' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {review.status || 'pending'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[#6366f1]"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(review);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        /* Empty State */
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="py-12 text-center">
            <Award className="h-12 w-12 text-[#3f3f46] mx-auto mb-4" />
            <p className={`text-lg font-medium ${textPrimary} mb-2`}>No reviews found</p>
            <p className={`text-sm ${textSecondary}`}>
              {filterMode === 'monthly' && `No reviews for ${months[selectedMonth - 1]} ${selectedYear}`}
              {filterMode === 'quarterly' && `No reviews for Q${selectedQuarter} ${selectedYear}`}
              {filterMode === 'yearly' && `No reviews for ${selectedYear}`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Review Detail Modal */}
      {showDetailModal && selectedReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`${bgCard} border ${borderColor} w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <CardHeader className="sticky top-0 z-10 bg-inherit border-b border-[#27272a]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-lg ${getRoleInfo(selectedReview.reviewer_role).bg} flex items-center justify-center text-2xl`}>
                    {getRoleInfo(selectedReview.reviewer_role).icon}
                  </div>
                  <div>
                    <CardTitle className={textPrimary}>Performance Review</CardTitle>
                    <p className={`text-sm ${textSecondary}`}>
                      {selectedReview.quarter ? `${selectedReview.quarter} ${selectedReview.year}` : 
                       selectedReview.review_month ? `${months[selectedReview.review_month - 1]} ${selectedReview.year}` :
                       selectedReview.year}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowDetailModal(false)}
                  className={`${textSecondary} hover:${textPrimary}`}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Reviewer Info */}
              <div className={`p-4 ${bgSecondary} rounded-lg`}>
                <p className={`text-xs ${textSecondary} mb-2`}>Reviewed By</p>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full ${getRoleInfo(selectedReview.reviewer_role).bg} flex items-center justify-center`}>
                    {selectedReview.reviewer_name?.charAt(0) || 'R'}
                  </div>
                  <div>
                    <p className={`font-medium ${textPrimary}`}>{selectedReview.reviewer_name}</p>
                    <Badge className={`${getRoleInfo(selectedReview.reviewer_role).bg} ${getRoleInfo(selectedReview.reviewer_role).text}`}>
                      {selectedReview.reviewer_role || 'Reviewer'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Overall Rating */}
              {selectedReview.overall_rating > 0 && (
                <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
                  <p className={`text-xs ${textSecondary} mb-2`}>Overall Rating</p>
                  <div className="flex items-center justify-center gap-1 text-3xl">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={star <= selectedReview.overall_rating ? 'text-yellow-400' : 'text-[#3f3f46]'}>
                        ★
                      </span>
                    ))}
                  </div>
                  <p className={`text-lg font-bold ${textPrimary} mt-1`}>{selectedReview.overall_rating}/5</p>
                </div>
              )}

              {/* Category Ratings */}
              {selectedReview.ratings && (
                <div className="space-y-3">
                  <p className={`text-sm font-medium ${textPrimary}`}>Category Ratings</p>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(selectedReview.ratings).map(([category, rating]) => (
                      <div key={category} className={`p-3 ${bgSecondary} rounded-lg`}>
                        <p className={`text-xs ${textSecondary} capitalize`}>{category.replace(/_/g, ' ')}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span key={star} className={`text-sm ${star <= rating ? 'text-yellow-400' : 'text-[#3f3f46]'}`}>
                              ★
                            </span>
                          ))}
                          <span className={`ml-2 text-sm ${textPrimary}`}>{rating}/5</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Achievements */}
              {selectedReview.achievements && (
                <div>
                  <p className={`text-sm font-medium ${textPrimary} mb-2 flex items-center gap-2`}>
                    <Trophy className="h-4 w-4 text-yellow-400" /> Achievements
                  </p>
                  <div className={`p-4 ${bgSecondary} rounded-lg`}>
                    <p className={`${textPrimary}`}>{selectedReview.achievements}</p>
                  </div>
                </div>
              )}

              {/* Areas of Improvement */}
              {selectedReview.areas_of_improvement && (
                <div>
                  <p className={`text-sm font-medium ${textPrimary} mb-2 flex items-center gap-2`}>
                    <TrendingUp className="h-4 w-4 text-blue-400" /> Areas of Improvement
                  </p>
                  <div className={`p-4 ${bgSecondary} rounded-lg`}>
                    <p className={`${textPrimary}`}>{selectedReview.areas_of_improvement}</p>
                  </div>
                </div>
              )}

              {/* Goals */}
              {selectedReview.goals && (
                <div>
                  <p className={`text-sm font-medium ${textPrimary} mb-2 flex items-center gap-2`}>
                    <Target className="h-4 w-4 text-green-400" /> Goals for Next Period
                  </p>
                  <div className={`p-4 ${bgSecondary} rounded-lg`}>
                    <p className={`${textPrimary}`}>{selectedReview.goals}</p>
                  </div>
                </div>
              )}

              {/* Comments */}
              {selectedReview.comments && (
                <div>
                  <p className={`text-sm font-medium ${textPrimary} mb-2 flex items-center gap-2`}>
                    <MessageSquare className="h-4 w-4 text-purple-400" /> Additional Comments
                  </p>
                  <div className={`p-4 ${bgSecondary} rounded-lg`}>
                    <p className={`${textPrimary}`}>{selectedReview.comments}</p>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className={`flex items-center justify-between p-4 ${bgSecondary} rounded-lg`}>
                <div>
                  <p className={`text-xs ${textSecondary}`}>Status</p>
                  <Badge className={`mt-1 ${
                    selectedReview.status === 'acknowledged' ? 'bg-green-500/20 text-green-400' :
                    selectedReview.status === 'submitted' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {selectedReview.status || 'Pending'}
                  </Badge>
                </div>
                {selectedReview.status !== 'acknowledged' && (
                  <Button className="bg-[#10b981] hover:bg-[#059669] text-white">
                    <CheckCircle className="h-4 w-4 mr-2" /> Acknowledge Review
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
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
      {/* Two-Factor Authentication */}
      <TwoFactorSettings />

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

  // Month/Year filter state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = [2024, 2025, 2026, 2027];

  // Filter permission requests by selected month/year
  const filteredRequests = permissionRequests.filter(r => {
    const reqDate = new Date(r.date);
    return reqDate.getMonth() + 1 === selectedMonth && reqDate.getFullYear() === selectedYear;
  });

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

  const pendingCount = filteredRequests.filter(r => r.status === 'pending').length;
  const approvedCount = filteredRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = filteredRequests.filter(r => r.status === 'rejected').length;
  
  // Calculate total hours taken (approved permissions only)
  const totalHoursTaken = filteredRequests
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + (parseFloat(r.hours) || 1), 0);

  return (
    <div className="space-y-6">
      {/* Header with Filter and Request Button */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
            data-testid="permission-month-filter"
          >
            {months.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
            data-testid="permission-year-filter"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white" data-testid="request-permission-btn">
          <Send className="h-4 w-4 mr-2" />
          Request Permission
        </Button>
      </div>

      {/* Stats Cards - includes Total Hours Taken */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card className={`${bgCard} border-2 border-[#8b5cf6]`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#8b5cf6]">{totalHoursTaken.toFixed(1)}</p>
            <p className={`text-sm ${textSecondary}`}>Total Hours Taken</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>My Permission Requests - {months[selectedMonth - 1]} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length > 0 ? (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
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
              <p className={textSecondary}>No permission requests found for {months[selectedMonth - 1]} {selectedYear}</p>
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

  // Month/Year filter state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = [2024, 2025, 2026, 2027];

  // Filter WFH requests by selected month/year
  const filteredRequests = wfhRequests.filter(r => {
    const reqDate = new Date(r.date);
    return reqDate.getMonth() + 1 === selectedMonth && reqDate.getFullYear() === selectedYear;
  });

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

  const pendingCount = filteredRequests.filter(r => r.status === 'pending').length;
  const approvedCount = filteredRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = filteredRequests.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Header with Filter and Request Button */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
            data-testid="remote-month-filter"
          >
            {months.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
            data-testid="remote-year-filter"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-[#10b981] hover:bg-[#059669] text-white" data-testid="request-wfh-btn">
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
          <CardTitle className={textPrimary}>My WFH Requests - {months[selectedMonth - 1]} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length > 0 ? (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
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
              <p className={textSecondary}>No work from home requests found for {months[selectedMonth - 1]} {selectedYear}</p>
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

// ============ Requests Attendance Tab (Login/Early Login/Late Logout) ============
function RequestsAttendanceTab({ attendanceHistory, formatDate, formatTime, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  // Month/Year filter state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = [2024, 2025, 2026, 2027];

  // Filter attendance by selected month/year
  const filteredHistory = attendanceHistory.filter(r => {
    const recordDate = new Date(r.date);
    return recordDate.getMonth() + 1 === selectedMonth && recordDate.getFullYear() === selectedYear;
  });

  // Filter records based on filtered history
  const pendingRecords = filteredHistory.filter(r => 
    r.approval_status && r.approval_status.includes('pending')
  );
  
  const earlyLoginRecords = filteredHistory.filter(r => 
    r.approval_status === 'pending_early_login' || r.early_login_reason
  );
  
  const lateLoginRecords = filteredHistory.filter(r => 
    r.late_login_reason || r.approval_status === 'pending_late_login' || 
    (r.clock_in && new Date(`2000-01-01 ${r.clock_in}`) > new Date('2000-01-01 09:15'))
  );
  
  const lateLogoutRecords = filteredHistory.filter(r => 
    r.late_logout_reason || (r.clock_out && new Date(`2000-01-01 ${r.clock_out}`) > new Date('2000-01-01 18:30'))
  );
  
  const earlyLogoutRecords = filteredHistory.filter(r => 
    r.approval_status === 'pending_early_logout' || r.early_logout_reason
  );

  // Calculate Extra Hours worked (hours beyond 8 hours standard)
  const STANDARD_WORK_HOURS = 8;
  const extraHoursWorked = filteredHistory.reduce((sum, r) => {
    const totalHours = r.total_hours || 0;
    if (totalHours > STANDARD_WORK_HOURS) {
      return sum + (totalHours - STANDARD_WORK_HOURS);
    }
    return sum;
  }, 0);

  // Calculate Total Worked Hours
  const totalWorkedHours = filteredHistory.reduce((sum, r) => sum + (r.total_hours || 0), 0);

  return (
    <div className="space-y-6">
      {/* Month/Year Filter */}
      <div className="flex items-center gap-3">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
          data-testid="attendance-req-month-filter"
        >
          {months.map((m, idx) => (
            <option key={idx} value={idx + 1}>{m}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className={`px-3 py-2 ${bgSecondary} ${textPrimary} border ${borderColor} rounded-lg`}
          data-testid="attendance-req-year-filter"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards - includes Extra Hours */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#f59e0b]">{pendingRecords.length}</p>
            <p className={`text-sm ${textSecondary}`}>Pending Approval</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#6366f1]">{earlyLoginRecords.length}</p>
            <p className={`text-sm ${textSecondary}`}>Early Logins</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#f97316]">{lateLoginRecords.length}</p>
            <p className={`text-sm ${textSecondary}`}>Late Logins</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#10b981]">{lateLogoutRecords.length}</p>
            <p className={`text-sm ${textSecondary}`}>Late Logouts</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#ef4444]">{earlyLogoutRecords.length}</p>
            <p className={`text-sm ${textSecondary}`}>Early Logouts</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border-2 border-[#8b5cf6]`}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#8b5cf6]">{extraHoursWorked.toFixed(1)}</p>
            <p className={`text-sm ${textSecondary}`}>Extra Hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records with Reasons */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Attendance Approvals & Reasons - {months[selectedMonth - 1]} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Date</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Login</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Logout</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Work Hrs</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Status</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Type</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((record, index) => {
                  // Determine the type and reason
                  let type = 'Normal';
                  let typeColor = 'bg-gray-500/20 text-gray-400';
                  let reason = record.notes || '-';
                  
                  if (record.approval_status === 'pending_early_login' || record.early_login_reason) {
                    type = 'Early Login';
                    typeColor = 'bg-[#6366f1]/20 text-[#6366f1]';
                    reason = record.early_login_reason || 'Early login recorded';
                  } else if (record.late_login_reason || record.approval_status === 'pending_late_login') {
                    type = 'Late Login';
                    typeColor = 'bg-[#f97316]/20 text-[#f97316]';
                    reason = record.late_login_reason || 'Late login recorded';
                  } else if (record.approval_status === 'pending_early_logout' || record.early_logout_reason) {
                    type = 'Early Logout';
                    typeColor = 'bg-[#ef4444]/20 text-[#ef4444]';
                    reason = record.early_logout_reason || 'Early logout recorded';
                  } else if (record.late_logout_reason) {
                    type = 'Late Logout';
                    typeColor = 'bg-[#10b981]/20 text-[#10b981]';
                    reason = record.late_logout_reason;
                  }
                  
                  return (
                    <tr key={index} className={`border-b ${borderColor} hover:${bgSecondary}`}>
                      <td className={`p-3 ${textPrimary} font-medium`}>{formatDate(record.date)}</td>
                      <td className={`p-3 ${textPrimary}`}>{formatTime(record.clock_in) || '-'}</td>
                      <td className={`p-3 ${textPrimary}`}>{formatTime(record.clock_out) || '-'}</td>
                      <td className={`p-3 font-medium text-[#10b981]`}>{record.total_hours?.toFixed(2) || '-'}</td>
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
                      <td className="p-3">
                        <Badge className={typeColor}>{type}</Badge>
                      </td>
                      <td className={`p-3 ${textSecondary} text-sm max-w-[200px] truncate`} title={reason}>
                        {reason}
                      </td>
                    </tr>
                  );
                })}
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`p-8 text-center ${textSecondary}`}>
                      No attendance records found for {months[selectedMonth - 1]} {selectedYear}
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