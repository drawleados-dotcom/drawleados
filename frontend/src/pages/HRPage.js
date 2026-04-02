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
  CheckCircle, XCircle, AlertCircle, ChevronRight, Key
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function HRPage() {
  const { isDark } = useTheme();
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
  
  // Reviews state
  const [reviews, setReviews] = useState([]);

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
    } else if (activeTab === 'payslips') {
      loadPayslips();
    } else if (activeTab === 'reviews') {
      loadReviews();
    }
  }, [activeTab, loadTodayAttendance, loadAttendanceHistory, loadCalendarData, loadProfile, loadLeaveRequests, loadLeaveBalance, loadPayslips, loadReviews]);

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

  const tabs = [
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'payslips', label: 'Payslips', icon: FileText },
    { id: 'reviews', label: 'Reviews', icon: Award },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <Layout>
      <div className={`p-6 ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'} min-h-screen`} data-testid="hr-page">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-[#10b981] to-[#059669] bg-clip-text text-transparent">
              HR Portal
            </span>
          </h1>
          <p className={textSecondary}>Manage your attendance, leaves, payslips and more</p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => {
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

        {activeTab === 'calendar' && (
          <CalendarTab
            calendarData={calendarData}
            calendarMonth={calendarMonth}
            calendarYear={calendarYear}
            setCalendarMonth={setCalendarMonth}
            setCalendarYear={setCalendarYear}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            dateDetail={dateDetail}
            loadDateDetail={loadDateDetail}
            loadCalendarData={loadCalendarData}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
            isDark={isDark}
            navigate={navigate}
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

        {activeTab === 'payslips' && (
          <PayslipsTab 
            payslips={payslips}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
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
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  
  const attendance = todayAttendance?.attendance;
  const isClockedIn = attendance?.clock_in && !attendance?.clock_out;
  const isClockedOut = attendance?.clock_out;
  const notClockedIn = !attendance?.clock_in;
  const isOnLunch = attendance?.lunch_start && !attendance?.lunch_end;
  const lunchCompleted = attendance?.lunch_end;
  
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

  return (
    <div className="space-y-6">
      {/* Dashboard Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className={`${bgCard} border ${borderColor} p-3`}>
          <p className={`text-xs ${textSecondary}`}>Working Days</p>
          <p className="text-2xl font-bold text-[#10b981]">{attendanceSummary.total_working_days || 22}</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-3`}>
          <p className={`text-xs ${textSecondary}`}>Present</p>
          <p className="text-2xl font-bold text-[#6366f1]">{attendanceSummary.present || 0}</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-3`}>
          <p className={`text-xs ${textSecondary}`}>Absent</p>
          <p className="text-2xl font-bold text-[#ef4444]">{attendanceSummary.absent || 0}</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-3`}>
          <p className={`text-xs ${textSecondary}`}>Casual Leave</p>
          <p className="text-2xl font-bold text-[#f59e0b]">{attendanceSummary.casual_leave || 0}/12</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-3`}>
          <p className={`text-xs ${textSecondary}`}>Sick Leave</p>
          <p className="text-2xl font-bold text-[#ec4899]">{attendanceSummary.sick_leave || 0}/6</p>
        </Card>
        <Card className={`${bgCard} border ${borderColor} p-3`}>
          <p className={`text-xs ${textSecondary}`}>Extra Hours</p>
          <p className="text-2xl font-bold text-[#8b5cf6]">{attendanceSummary.extra_hours?.toFixed(1) || 0}</p>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button 
          onClick={() => setShowLeaveRequestModal(true)}
          className="bg-[#f59e0b] hover:bg-[#d97706] text-white"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Request Leave
        </Button>
        <Button 
          onClick={() => { setPermissionForm({...permissionForm, date: new Date().toISOString().split('T')[0]}); setShowPermissionModal(true); }}
          className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white"
        >
          <Clock className="h-4 w-4 mr-2" />
          Request Permission
        </Button>
      </div>

      {/* Today's Attendance Card */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={`${textPrimary} flex items-center gap-2`}>
            <Clock className="h-5 w-5 text-[#10b981]" />
            Today's Attendance
            {settings && <span className={`text-sm font-normal ${textSecondary}`}>(Standard: {settings.standard_login_time} - {settings.standard_logout_time})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
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
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Login</p>
              <p className={`text-lg font-semibold ${textPrimary}`}>
                {formatTime(attendance?.clock_in)}
              </p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Logout</p>
              <p className={`text-lg font-semibold ${textPrimary}`}>
                {formatTime(attendance?.clock_out)}
              </p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Lunch</p>
              <p className={`text-lg font-semibold ${textPrimary}`}>
                {attendance?.lunch_duration ? `${attendance.lunch_duration} min` : '-'}
              </p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Work Hours</p>
              <p className={`text-lg font-semibold ${textPrimary}`}>
                {attendance?.total_hours?.toFixed(2) || '-'}
              </p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Extra Hours</p>
              <p className={`text-lg font-semibold text-[#10b981]`}>
                {attendance?.extra_hours?.toFixed(2) || '-'}
              </p>
            </div>
          </div>

          {/* Clock In Buttons */}
          {notClockedIn && (
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={() => handleOpenLoginModal('office')}
                data-testid="clock-in-office"
                className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white py-6"
              >
                <Building className="mr-2 h-5 w-5" />
                Clock In - Office
              </Button>
              <Button
                onClick={() => handleOpenLoginModal('home')}
                data-testid="clock-in-wfh"
                className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white py-6"
              >
                <Home className="mr-2 h-5 w-5" />
                Clock In - Work from Home
              </Button>
            </div>
          )}

          {/* Lunch & Clock Out Buttons */}
          {isClockedIn && !isClockedOut && (
            <div className="flex flex-col sm:flex-row gap-4">
              {!isOnLunch && !lunchCompleted && (
                <Button
                  onClick={() => { setLunchStartTime(getCurrentTimeString()); setShowLunchModal(true); }}
                  className="flex-1 bg-[#f59e0b] hover:bg-[#d97706] text-white py-4"
                >
                  🍽️ Start Lunch Break
                </Button>
              )}
              {isOnLunch && (
                <Button
                  onClick={() => { setLunchEndTime(getCurrentTimeString()); handleEndLunch(); }}
                  className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-white py-4"
                >
                  ✓ End Lunch Break
                </Button>
              )}
              <Button
                onClick={handleOpenLogoutModal}
                data-testid="clock-out"
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white py-4"
              >
                <Square className="mr-2 h-5 w-5" />
                Clock Out
              </Button>
            </div>
          )}

          {/* Approval Status Warning */}
          {attendance?.approval_status && attendance.approval_status.includes('pending') && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              <span className={textSecondary}>
                {attendance.approval_status === 'pending_early_login' 
                  ? 'Early login - pending HR approval' 
                  : 'Early logout - pending HR approval'}
              </span>
            </div>
          )}

          {isClockedOut && (
            <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20 mt-4">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-green-400 font-medium">You've completed your day!</p>
              <p className={`text-sm ${textSecondary}`}>
                Total hours: {attendance?.total_hours?.toFixed(2) || 0} hrs | Extra: {attendance?.extra_hours?.toFixed(2) || 0} hrs
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Lunch Start Modal */}
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

      {/* Monthly Summary Card */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>This Month's Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
              <p className="text-2xl font-bold text-[#10b981]">{attendanceSummary.present || 0}</p>
              <p className={`text-xs ${textSecondary}`}>Days Present</p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
              <p className="text-2xl font-bold text-[#6366f1]">{attendanceSummary.total_hours?.toFixed(1) || 0}</p>
              <p className={`text-xs ${textSecondary}`}>Total Hours</p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
              <p className="text-2xl font-bold text-[#f59e0b]">{attendanceSummary.average_hours?.toFixed(1) || 0}</p>
              <p className={`text-xs ${textSecondary}`}>Avg Hours/Day</p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
              <p className="text-2xl font-bold text-[#8b5cf6]">{attendanceSummary.extra_hours?.toFixed(1) || 0}</p>
              <p className={`text-xs ${textSecondary}`}>Extra Hours</p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
              <p className="text-2xl font-bold text-[#ef4444]">{attendanceSummary.absent || 0}</p>
              <p className={`text-xs ${textSecondary}`}>Days Absent</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance History Table */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Date</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Day</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Login</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Logout</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Lunch</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Permission</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Work Hrs</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Extra Hrs</th>
                  <th className={`text-left p-3 ${textSecondary} text-sm font-medium`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((record, index) => {
                  const recordDate = new Date(record.date);
                  const dayName = recordDate.toLocaleDateString('en-US', { weekday: 'short' });
                  return (
                    <tr key={index} className={`border-b ${borderColor} hover:${bgSecondary}`}>
                      <td className={`p-3 ${textPrimary}`}>{formatDate(record.date)}</td>
                      <td className={`p-3 ${textSecondary}`}>{dayName}</td>
                      <td className={`p-3 ${textPrimary}`}>{formatTime(record.clock_in)}</td>
                      <td className={`p-3 ${textPrimary}`}>{formatTime(record.clock_out)}</td>
                      <td className={`p-3 ${textSecondary}`}>{record.lunch_duration ? `${record.lunch_duration} min` : '-'}</td>
                      <td className={`p-3 ${textSecondary}`}>{record.permission_hours ? `${record.permission_hours} hrs` : '-'}</td>
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
                  );
                })}
                {attendanceHistory.length === 0 && (
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
  return (
    <div className="space-y-6">
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

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>My Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leaveRequests.map((req) => (
              <div key={req.leave_id} className={`p-4 ${bgSecondary} rounded-lg flex items-center justify-between`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`${
                      req.leave_type === 'wfh' ? 'bg-purple-500/20 text-purple-400' :
                      req.leave_type === 'casual' ? 'bg-blue-500/20 text-blue-400' :
                      req.leave_type === 'sick' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {req.leave_type.toUpperCase()}
                    </Badge>
                    <Badge className={`${
                      req.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      req.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {req.status}
                    </Badge>
                  </div>
                  <p className={`text-sm ${textPrimary}`}>
                    {formatDate(req.start_date)} - {formatDate(req.end_date)}
                  </p>
                  <p className={`text-xs ${textSecondary} mt-1`}>{req.reason}</p>
                </div>
                {req.status === 'approved' && <CheckCircle className="h-5 w-5 text-green-400" />}
                {req.status === 'rejected' && <XCircle className="h-5 w-5 text-red-400" />}
                {req.status === 'pending' && <AlertCircle className="h-5 w-5 text-yellow-400" />}
              </div>
            ))}
            {leaveRequests.length === 0 && (
              <p className={`text-center py-8 ${textSecondary}`}>No leave requests found</p>
            )}
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}

function PayslipsTab({ payslips, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-6">
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          {payslips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {payslips.map((payslip) => (
                <div key={payslip.payslip_id} className={`p-4 ${bgSecondary} rounded-lg`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={`font-semibold ${textPrimary}`}>
                        {months[payslip.month - 1]} {payslip.year}
                      </p>
                      <Badge className={payslip.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                        {payslip.payment_status}
                      </Badge>
                    </div>
                    <FileText className="h-8 w-8 text-[#6366f1]" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className={textSecondary}>Gross</span>
                      <span className={textPrimary}>₹{payslip.gross_salary?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Deductions</span>
                      <span className="text-red-400">-₹{(payslip.pf_deduction + payslip.tax_deduction + payslip.other_deductions)?.toLocaleString()}</span>
                    </div>
                    <div className={`flex justify-between pt-2 border-t ${borderColor}`}>
                      <span className={`font-medium ${textPrimary}`}>Net Pay</span>
                      <span className="font-bold text-[#10b981]">₹{payslip.net_salary?.toLocaleString()}</span>
                    </div>
                  </div>
                  <Button className="w-full mt-4 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-[#3f3f46] mx-auto mb-4" />
              <p className={textSecondary}>No payslips available yet</p>
              <p className={`text-sm ${textSecondary}`}>Your payslips will appear here once generated</p>
            </div>
          )}
        </CardContent>
      </Card>
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
