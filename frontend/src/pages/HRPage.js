import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  User, Clock, Calendar, FileText, Award, Download, 
  MapPin, Home, Building, Play, Square, Send,
  CheckCircle, XCircle, AlertCircle, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function HRPage() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('attendance');
  const [loading, setLoading] = useState(false);
  
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

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'attendance') {
        await Promise.all([loadTodayAttendance(), loadAttendanceHistory()]);
      } else if (activeTab === 'profile') {
        await loadProfile();
      } else if (activeTab === 'leave') {
        await Promise.all([loadLeaveRequests(), loadLeaveBalance()]);
      } else if (activeTab === 'payslips') {
        await loadPayslips();
      } else if (activeTab === 'reviews') {
        await loadReviews();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const loadTodayAttendance = async () => {
    try {
      const res = await axios.get(`${API}/api/hr/attendance/today`, { headers });
      setTodayAttendance(res.data);
    } catch (error) {
      console.error('Error loading today attendance:', error);
    }
  };

  const loadAttendanceHistory = async () => {
    try {
      const res = await axios.get(`${API}/api/hr/attendance/history`, { headers });
      setAttendanceHistory(res.data.records || []);
      setAttendanceSummary(res.data.summary || {});
    } catch (error) {
      console.error('Error loading attendance history:', error);
    }
  };

  const loadProfile = async () => {
    try {
      const res = await axios.get(`${API}/api/hr/profile`, { headers });
      setProfile(res.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadLeaveRequests = async () => {
    try {
      const res = await axios.get(`${API}/api/hr/leave/my-requests`, { headers });
      setLeaveRequests(res.data);
    } catch (error) {
      console.error('Error loading leave requests:', error);
    }
  };

  const loadLeaveBalance = async () => {
    try {
      const res = await axios.get(`${API}/api/hr/leave/balance`, { headers });
      setLeaveBalance(res.data);
    } catch (error) {
      console.error('Error loading leave balance:', error);
    }
  };

  const loadPayslips = async () => {
    try {
      const res = await axios.get(`${API}/api/hr/payslips`, { headers });
      setPayslips(res.data);
    } catch (error) {
      console.error('Error loading payslips:', error);
    }
  };

  const loadReviews = async () => {
    try {
      const res = await axios.get(`${API}/api/hr/reviews`, { headers });
      setReviews(res.data);
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

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

  const handleClockOut = async () => {
    try {
      await axios.post(`${API}/api/hr/attendance/clock-out`, 
        { notes: '' }, 
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
      <div className="p-6" data-testid="hr-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-[#10b981] to-[#059669] bg-clip-text text-transparent">
              HR Portal
            </span>
          </h1>
          <p className="text-[#a1a1aa]">Manage your attendance, leaves, payslips and more</p>
        </div>

        {/* Tabs */}
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
                    : 'bg-[#27272a] text-[#a1a1aa] hover:bg-[#3f3f46]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'attendance' && (
          <AttendanceTab
            todayAttendance={todayAttendance}
            attendanceHistory={attendanceHistory}
            attendanceSummary={attendanceSummary}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            formatTime={formatTime}
            formatDate={formatDate}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab profile={profile} />
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
          />
        )}

        {activeTab === 'payslips' && (
          <PayslipsTab payslips={payslips} />
        )}

        {activeTab === 'reviews' && (
          <ReviewsTab reviews={reviews} />
        )}
      </div>
    </Layout>
  );
}

// ============== ATTENDANCE TAB ==============
function AttendanceTab({ todayAttendance, attendanceHistory, attendanceSummary, onClockIn, onClockOut, formatTime, formatDate }) {
  const isClockedIn = todayAttendance?.clock_in && !todayAttendance?.clock_out;
  const isClockedOut = todayAttendance?.clock_out;
  const notClockedIn = !todayAttendance?.clock_in;

  return (
    <div className="space-y-6">
      {/* Today's Status Card */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <CardTitle className="text-[#fafafa] flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#10b981]" />
            Today's Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-[#27272a] rounded-lg">
              <p className="text-xs text-[#a1a1aa] mb-1">Status</p>
              <Badge className={`${
                isClockedOut ? 'bg-green-500/20 text-green-400' :
                isClockedIn ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {isClockedOut ? 'Day Complete' : isClockedIn ? 'Working' : 'Not Started'}
              </Badge>
            </div>
            <div className="p-4 bg-[#27272a] rounded-lg">
              <p className="text-xs text-[#a1a1aa] mb-1">Clock In</p>
              <p className="text-lg font-semibold text-[#fafafa]">
                {formatTime(todayAttendance?.clock_in)}
              </p>
            </div>
            <div className="p-4 bg-[#27272a] rounded-lg">
              <p className="text-xs text-[#a1a1aa] mb-1">Clock Out</p>
              <p className="text-lg font-semibold text-[#fafafa]">
                {formatTime(todayAttendance?.clock_out)}
              </p>
            </div>
            <div className="p-4 bg-[#27272a] rounded-lg">
              <p className="text-xs text-[#a1a1aa] mb-1">Location</p>
              <div className="flex items-center gap-2">
                {todayAttendance?.work_location === 'home' ? (
                  <><Home className="h-4 w-4 text-[#10b981]" /> <span className="text-[#fafafa]">WFH</span></>
                ) : todayAttendance?.work_location === 'office' ? (
                  <><Building className="h-4 w-4 text-[#6366f1]" /> <span className="text-[#fafafa]">Office</span></>
                ) : (
                  <span className="text-[#a1a1aa]">-</span>
                )}
              </div>
            </div>
          </div>

          {/* Clock In/Out Actions */}
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
              onClick={onClockOut}
              data-testid="clock-out"
              className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white py-6"
            >
              <Square className="mr-2 h-5 w-5" />
              Clock Out
            </Button>
          )}

          {isClockedOut && (
            <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-green-400 font-medium">You've completed your day!</p>
              <p className="text-sm text-[#a1a1aa]">
                Total hours: {todayAttendance?.total_hours?.toFixed(2) || 0} hrs
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <CardTitle className="text-[#fafafa]">This Month's Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-[#27272a] rounded-lg text-center">
              <p className="text-2xl font-bold text-[#10b981]">{attendanceSummary.total_days || 0}</p>
              <p className="text-xs text-[#a1a1aa]">Days Present</p>
            </div>
            <div className="p-4 bg-[#27272a] rounded-lg text-center">
              <p className="text-2xl font-bold text-[#6366f1]">{attendanceSummary.total_hours?.toFixed(1) || 0}</p>
              <p className="text-xs text-[#a1a1aa]">Total Hours</p>
            </div>
            <div className="p-4 bg-[#27272a] rounded-lg text-center">
              <p className="text-2xl font-bold text-[#f59e0b]">{attendanceSummary.average_hours?.toFixed(1) || 0}</p>
              <p className="text-xs text-[#a1a1aa]">Avg Hours/Day</p>
            </div>
            <div className="p-4 bg-[#27272a] rounded-lg text-center">
              <p className="text-2xl font-bold text-[#8b5cf6]">{attendanceSummary.wfo_days || 0}</p>
              <p className="text-xs text-[#a1a1aa]">Office Days</p>
            </div>
            <div className="p-4 bg-[#27272a] rounded-lg text-center">
              <p className="text-2xl font-bold text-[#ec4899]">{attendanceSummary.wfh_days || 0}</p>
              <p className="text-xs text-[#a1a1aa]">WFH Days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance History */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <CardTitle className="text-[#fafafa]">Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272a]">
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#a1a1aa]">DATE</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#a1a1aa]">CLOCK IN</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#a1a1aa]">CLOCK OUT</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#a1a1aa]">HOURS</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#a1a1aa]">LOCATION</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((record, idx) => (
                  <tr key={idx} className="border-b border-[#27272a]/50">
                    <td className="py-3 px-4 text-sm text-[#fafafa]">{formatDate(record.date)}</td>
                    <td className="py-3 px-4 text-sm text-[#fafafa]">{formatTime(record.clock_in)}</td>
                    <td className="py-3 px-4 text-sm text-[#fafafa]">{formatTime(record.clock_out)}</td>
                    <td className="py-3 px-4 text-sm text-[#fafafa]">{record.total_hours?.toFixed(2) || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge className={record.work_location === 'home' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}>
                        {record.work_location === 'home' ? 'WFH' : 'Office'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {attendanceHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#a1a1aa]">
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

// ============== PROFILE TAB ==============
function ProfileTab({ profile }) {
  if (!profile) {
    return <div className="text-center py-8 text-[#a1a1aa]">Loading profile...</div>;
  }

  const Section = ({ title, children }) => (
    <Card className="bg-[#18181b] border-[#27272a] mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[#fafafa]">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  const Field = ({ label, value }) => (
    <div className="py-2">
      <p className="text-xs text-[#a1a1aa] mb-1">{label}</p>
      <p className="text-[#fafafa]">{value || '-'}</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Personal Info */}
      <Section title="Personal Information">
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[#27272a]">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center text-white text-2xl font-bold">
            {profile.full_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-xl font-semibold text-[#fafafa]">{profile.full_name}</h3>
            <p className="text-[#a1a1aa]">{profile.designation}</p>
            <Badge className="mt-1 bg-[#10b981]/20 text-[#10b981]">{profile.employee_id}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" value={profile.email} />
          <Field label="Phone" value={profile.phone} />
          <Field label="Date of Birth" value={profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : '-'} />
          <Field label="Gender" value={profile.gender} />
          <Field label="Blood Group" value={profile.blood_group} />
        </div>
      </Section>

      {/* Employment Info */}
      <Section title="Employment Details">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Employee ID" value={profile.employee_id} />
          <Field label="Designation" value={profile.designation} />
          <Field label="Department" value={profile.department} />
          <Field label="Employment Type" value={profile.employment_type} />
          <Field label="Joining Date" value={profile.joining_date ? new Date(profile.joining_date).toLocaleDateString() : '-'} />
          <Field label="Reporting Manager" value={profile.reporting_manager} />
        </div>
      </Section>

      {/* Address */}
      <Section title="Address">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Address" value={profile.address} />
          </div>
          <Field label="City" value={profile.city} />
          <Field label="State" value={profile.state} />
          <Field label="Pincode" value={profile.pincode} />
        </div>
      </Section>

      {/* Emergency Contact */}
      <Section title="Emergency Contact">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact Name" value={profile.emergency_contact_name} />
          <Field label="Contact Phone" value={profile.emergency_contact_phone} />
          <Field label="Relationship" value={profile.emergency_contact_relation} />
        </div>
      </Section>

      {/* Bank Details */}
      <Section title="Bank Details">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bank Name" value={profile.bank_name} />
          <Field label="Account Number" value={profile.account_number ? '****' + profile.account_number.slice(-4) : '-'} />
          <Field label="IFSC Code" value={profile.ifsc_code} />
          <Field label="PAN Number" value={profile.pan_number ? '****' + profile.pan_number.slice(-4) : '-'} />
        </div>
      </Section>
    </div>
  );
}

// ============== LEAVE TAB ==============
function LeaveTab({ leaveRequests, leaveBalance, showModal, setShowModal, leaveForm, setLeaveForm, onSubmit, formatDate }) {
  return (
    <div className="space-y-6">
      {/* Leave Balance */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-[#fafafa]">Leave Balance ({new Date().getFullYear()})</CardTitle>
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
            <div className="p-4 bg-[#27272a] rounded-lg">
              <p className="text-xs text-[#a1a1aa] mb-1">Casual Leave</p>
              <p className="text-2xl font-bold text-[#6366f1]">
                {(leaveBalance?.casual_leave || 12) - (leaveBalance?.casual_used || 0)}
                <span className="text-sm text-[#a1a1aa]">/{leaveBalance?.casual_leave || 12}</span>
              </p>
            </div>
            <div className="p-4 bg-[#27272a] rounded-lg">
              <p className="text-xs text-[#a1a1aa] mb-1">Sick Leave</p>
              <p className="text-2xl font-bold text-[#f59e0b]">
                {(leaveBalance?.sick_leave || 6) - (leaveBalance?.sick_used || 0)}
                <span className="text-sm text-[#a1a1aa]">/{leaveBalance?.sick_leave || 6}</span>
              </p>
            </div>
            <div className="p-4 bg-[#27272a] rounded-lg">
              <p className="text-xs text-[#a1a1aa] mb-1">Earned Leave</p>
              <p className="text-2xl font-bold text-[#10b981]">
                {(leaveBalance?.earned_leave || 15) - (leaveBalance?.earned_used || 0)}
                <span className="text-sm text-[#a1a1aa]">/{leaveBalance?.earned_leave || 15}</span>
              </p>
            </div>
            <div className="p-4 bg-[#27272a] rounded-lg">
              <p className="text-xs text-[#a1a1aa] mb-1">WFH Requests</p>
              <p className="text-2xl font-bold text-[#8b5cf6]">∞</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <CardTitle className="text-[#fafafa]">My Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leaveRequests.map((req) => (
              <div key={req.leave_id} className="p-4 bg-[#27272a] rounded-lg flex items-center justify-between">
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
                  <p className="text-sm text-[#fafafa]">
                    {formatDate(req.start_date)} - {formatDate(req.end_date)}
                  </p>
                  <p className="text-xs text-[#a1a1aa] mt-1">{req.reason}</p>
                </div>
                {req.status === 'approved' && <CheckCircle className="h-5 w-5 text-green-400" />}
                {req.status === 'rejected' && <XCircle className="h-5 w-5 text-red-400" />}
                {req.status === 'pending' && <AlertCircle className="h-5 w-5 text-yellow-400" />}
              </div>
            ))}
            {leaveRequests.length === 0 && (
              <p className="text-center py-8 text-[#a1a1aa]">No leave requests found</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leave Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-[#18181b] border-[#27272a] w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-[#fafafa]">Request Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <Label className="text-[#fafafa]">Leave Type</Label>
                  <select
                    value={leaveForm.leave_type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                    className="w-full mt-1 p-2 bg-[#27272a] border border-[#3f3f46] rounded-lg text-[#fafafa]"
                  >
                    <option value="casual">Casual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="earned">Earned Leave</option>
                    <option value="wfh">Work from Home</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[#fafafa]">Start Date</Label>
                    <Input
                      type="date"
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      required
                      className="bg-[#27272a] border-[#3f3f46] text-[#fafafa]"
                    />
                  </div>
                  <div>
                    <Label className="text-[#fafafa]">End Date</Label>
                    <Input
                      type="date"
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                      required
                      className="bg-[#27272a] border-[#3f3f46] text-[#fafafa]"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[#fafafa]">Reason</Label>
                  <textarea
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    required
                    rows={3}
                    className="w-full mt-1 p-2 bg-[#27272a] border border-[#3f3f46] rounded-lg text-[#fafafa]"
                    placeholder="Enter reason for leave..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]"
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

// ============== PAYSLIPS TAB ==============
function PayslipsTab({ payslips }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-6">
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <CardTitle className="text-[#fafafa]">Payslips</CardTitle>
        </CardHeader>
        <CardContent>
          {payslips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {payslips.map((payslip) => (
                <div key={payslip.payslip_id} className="p-4 bg-[#27272a] rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-[#fafafa]">
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
                      <span className="text-[#a1a1aa]">Gross</span>
                      <span className="text-[#fafafa]">₹{payslip.gross_salary?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#a1a1aa]">Deductions</span>
                      <span className="text-red-400">-₹{(payslip.pf_deduction + payslip.tax_deduction + payslip.other_deductions)?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[#3f3f46]">
                      <span className="font-medium text-[#fafafa]">Net Pay</span>
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
              <p className="text-[#a1a1aa]">No payslips available yet</p>
              <p className="text-sm text-[#71717a]">Your payslips will appear here once generated</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============== REVIEWS TAB ==============
function ReviewsTab({ reviews }) {
  const quarters = {
    'Q1': 'Jan - Mar',
    'Q2': 'Apr - Jun',
    'Q3': 'Jul - Sep',
    'Q4': 'Oct - Dec'
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <CardTitle className="text-[#fafafa]">Performance Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.review_id} className="p-4 bg-[#27272a] rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                        <Award className="h-5 w-5 text-[#6366f1]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#fafafa]">{review.quarter} {review.year}</p>
                        <p className="text-xs text-[#a1a1aa]">{quarters[review.quarter]}</p>
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
                      <p className="text-xs text-[#a1a1aa] mb-1">Achievements</p>
                      <p className="text-sm text-[#fafafa]">{review.achievements}</p>
                    </div>
                  )}
                  
                  {review.areas_of_improvement && (
                    <div className="mb-2">
                      <p className="text-xs text-[#a1a1aa] mb-1">Areas of Improvement</p>
                      <p className="text-sm text-[#fafafa]">{review.areas_of_improvement}</p>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#3f3f46]">
                    <p className="text-xs text-[#a1a1aa]">Reviewed by: {review.reviewer_name}</p>
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
              <p className="text-[#a1a1aa]">No performance reviews yet</p>
              <p className="text-sm text-[#71717a]">Your quarterly reviews will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
