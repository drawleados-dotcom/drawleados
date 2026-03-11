import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  User, Clock, Calendar, FileText, Award, Download, 
  Home, Building, Square, Send,
  CheckCircle, XCircle, AlertCircle, ChevronRight
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

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadTodayAttendance();
      loadAttendanceHistory();
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
  }, [activeTab, loadTodayAttendance, loadAttendanceHistory, loadProfile, loadLeaveRequests, loadLeaveBalance, loadPayslips, loadReviews]);

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
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'payslips', label: 'Payslips', icon: FileText },
    { id: 'reviews', label: 'Reviews', icon: Award },
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
      </div>
    </Layout>
  );
}

function AttendanceTab({ todayAttendance, attendanceHistory, attendanceSummary, onClockIn, onClockOut, formatTime, formatDate, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutTime, setLogoutTime] = useState('');
  
  const isClockedIn = todayAttendance?.clock_in && !todayAttendance?.clock_out;
  const isClockedOut = todayAttendance?.clock_out;
  const notClockedIn = !todayAttendance?.clock_in;
  
  const getCurrentTimeString = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const handleOpenLogoutModal = () => {
    setLogoutTime(getCurrentTimeString());
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    onClockOut(logoutTime);
    setShowLogoutModal(false);
    setLogoutTime('');
  };

  return (
    <div className="space-y-6">
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={`${textPrimary} flex items-center gap-2`}>
            <Clock className="h-5 w-5 text-[#10b981]" />
            Today&apos;s Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Status</p>
              <Badge className={`${
                isClockedOut ? 'bg-green-500/20 text-green-400' :
                isClockedIn ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {isClockedOut ? 'Day Complete' : isClockedIn ? 'Working' : 'Not Started'}
              </Badge>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Clock In</p>
              <p className={`text-lg font-semibold ${textPrimary}`}>
                {formatTime(todayAttendance?.clock_in)}
              </p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Clock Out</p>
              <p className={`text-lg font-semibold ${textPrimary}`}>
                {formatTime(todayAttendance?.clock_out)}
              </p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg`}>
              <p className={`text-xs ${textSecondary} mb-1`}>Location</p>
              <div className="flex items-center gap-2">
                {todayAttendance?.work_location === 'home' ? (
                  <><Home className="h-4 w-4 text-[#10b981]" /> <span className={textPrimary}>WFH</span></>
                ) : todayAttendance?.work_location === 'office' ? (
                  <><Building className="h-4 w-4 text-[#6366f1]" /> <span className={textPrimary}>Office</span></>
                ) : (
                  <span className={textSecondary}>-</span>
                )}
              </div>
            </div>
          </div>

          {notClockedIn && (
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={() => onClockIn('office')}
                data-testid="clock-in-office"
                className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white py-6"
              >
                <Building className="mr-2 h-5 w-5" />
                Clock In - Office
              </Button>
              <Button
                onClick={() => onClockIn('home')}
                data-testid="clock-in-wfh"
                className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white py-6"
              >
                <Home className="mr-2 h-5 w-5" />
                Clock In - Work from Home
              </Button>
            </div>
          )}

          {isClockedIn && (
            <Button
              onClick={handleOpenLogoutModal}
              data-testid="clock-out"
              className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white py-6"
            >
              <Square className="mr-2 h-5 w-5" />
              Clock Out
            </Button>
          )}

          {/* Manual Logout Time Modal */}
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
                      {formatTime(todayAttendance?.clock_in)}
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

          {isClockedOut && (
            <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-green-400 font-medium">You&apos;ve completed your day!</p>
              <p className={`text-sm ${textSecondary}`}>
                Total hours: {todayAttendance?.total_hours?.toFixed(2) || 0} hrs
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>This Month&apos;s Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
              <p className="text-2xl font-bold text-[#10b981]">{attendanceSummary.total_days || 0}</p>
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
              <p className="text-2xl font-bold text-[#8b5cf6]">{attendanceSummary.wfo_days || 0}</p>
              <p className={`text-xs ${textSecondary}`}>Office Days</p>
            </div>
            <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
              <p className="text-2xl font-bold text-[#ec4899]">{attendanceSummary.wfh_days || 0}</p>
              <p className={`text-xs ${textSecondary}`}>WFH Days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={textPrimary}>Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textSecondary}`}>DATE</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textSecondary}`}>CLOCK IN</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textSecondary}`}>CLOCK OUT</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textSecondary}`}>HOURS</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textSecondary}`}>LOCATION</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((record, idx) => (
                  <tr key={idx} className={`border-b ${borderColor}/50`}>
                    <td className={`py-3 px-4 text-sm ${textPrimary}`}>{formatDate(record.date)}</td>
                    <td className={`py-3 px-4 text-sm ${textPrimary}`}>{formatTime(record.clock_in)}</td>
                    <td className={`py-3 px-4 text-sm ${textPrimary}`}>{formatTime(record.clock_out)}</td>
                    <td className={`py-3 px-4 text-sm ${textPrimary}`}>{record.total_hours?.toFixed(2) || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge className={record.work_location === 'home' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}>
                        {record.work_location === 'home' ? 'WFH' : 'Office'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {attendanceHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className={`py-8 text-center ${textSecondary}`}>
                      No attendance records found
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
