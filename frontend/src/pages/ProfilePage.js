import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { 
  User, Mail, Phone, Building, Calendar, Clock, Shield, 
  Key, Eye, EyeOff, CheckCircle, AlertCircle, Lock, Send
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ProfilePage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [profile, setProfile] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [activeTab, setActiveTab] = useState('details');
  
  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStep, setPasswordStep] = useState('request'); // request, verify, change
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Theme classes
  const bgMain = isDark ? 'bg-[#0c0a09]' : 'bg-gray-50';
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const loadProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/profile/my`, { headers });
      setProfile(res.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, []);

  const loadAttendanceSummary = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/attendance/history`, { headers });
      setAttendanceSummary(res.data.summary || {});
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadAttendanceSummary();
  }, [loadProfile, loadAttendanceSummary]);

  const handleRequestOTP = async () => {
    try {
      const res = await axios.post(`${API}/api/auth/password-reset/request-otp`, {}, { headers });
      setOtpSent(true);
      setOtpToken(res.data.reset_token || '');
      setPasswordStep('verify');
      toast.success('OTP sent to your registered email!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    try {
      await axios.post(`${API}/api/auth/password-reset/verify-otp`, { 
        otp, 
        reset_token: otpToken 
      }, { headers });
      setPasswordStep('change');
      toast.success('OTP verified! Enter your new password.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    }
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
      await axios.post(`${API}/api/auth/password-reset/change`, { 
        otp,
        reset_token: otpToken,
        new_password: newPassword 
      }, { headers });
      toast.success('Password changed successfully!');
      setShowPasswordModal(false);
      resetPasswordFlow();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    }
  };

  const resetPasswordFlow = () => {
    setPasswordStep('request');
    setOtpSent(false);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpToken('');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      'super_admin': 'bg-red-500/20 text-red-400',
      'admin': 'bg-purple-500/20 text-purple-400',
      'hr_manager': 'bg-pink-500/20 text-pink-400',
      'project_manager': 'bg-blue-500/20 text-blue-400',
      'seo_specialist': 'bg-green-500/20 text-green-400',
      'website_developer': 'bg-cyan-500/20 text-cyan-400',
      'content_writer': 'bg-yellow-500/20 text-yellow-400',
      'graphic_designer': 'bg-orange-500/20 text-orange-400',
    };
    return colors[role] || 'bg-gray-500/20 text-gray-400';
  };

  const tabs = [
    { id: 'details', label: 'My Details', icon: User },
    { id: 'attendance', label: 'Attendance Summary', icon: Clock },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className={`min-h-screen ${bgMain} p-6`}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>My Profile</h1>
            <p className={textSecondary}>View your details and manage your account</p>
          </div>
        </div>

        {/* Profile Card */}
        <Card className={`${bgCard} border ${borderColor} mb-6`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white text-3xl font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className={`text-xl font-bold ${textPrimary}`}>{user?.name || profile?.name}</h2>
                <p className={textSecondary}>{user?.email || profile?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getRoleBadgeColor(user?.role)}>
                    {user?.role?.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                  {profile?.department && (
                    <Badge className="bg-[#6366f1]/20 text-[#6366f1]">
                      {profile.department}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-[#6366f1] text-white'
                  : `${bgSecondary} ${textSecondary} hover:bg-[#6366f1]/20`
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={textPrimary}>Personal & Employment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Info */}
                <div className="space-y-4">
                  <h3 className={`font-semibold ${textPrimary} border-b ${borderColor} pb-2`}>Personal Information</h3>
                  
                  <div className="flex items-center gap-3">
                    <User className={`h-5 w-5 ${textSecondary}`} />
                    <div>
                      <p className={`text-xs ${textSecondary}`}>Full Name</p>
                      <p className={textPrimary}>{profile?.name || user?.name || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Mail className={`h-5 w-5 ${textSecondary}`} />
                    <div>
                      <p className={`text-xs ${textSecondary}`}>Email</p>
                      <p className={textPrimary}>{profile?.email || user?.email || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Phone className={`h-5 w-5 ${textSecondary}`} />
                    <div>
                      <p className={`text-xs ${textSecondary}`}>Phone</p>
                      <p className={textPrimary}>{profile?.phone || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Employment Info */}
                <div className="space-y-4">
                  <h3 className={`font-semibold ${textPrimary} border-b ${borderColor} pb-2`}>Employment Details</h3>
                  
                  <div className="flex items-center gap-3">
                    <Building className={`h-5 w-5 ${textSecondary}`} />
                    <div>
                      <p className={`text-xs ${textSecondary}`}>Department</p>
                      <p className={textPrimary}>{profile?.department || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Shield className={`h-5 w-5 ${textSecondary}`} />
                    <div>
                      <p className={`text-xs ${textSecondary}`}>Designation</p>
                      <p className={textPrimary}>{profile?.designation || user?.role?.replace(/_/g, ' ') || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className={`h-5 w-5 ${textSecondary}`} />
                    <div>
                      <p className={`text-xs ${textSecondary}`}>Joining Date</p>
                      <p className={textPrimary}>{formatDate(profile?.joining_date)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'attendance' && (
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={textPrimary}>This Month's Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
                  <p className="text-2xl font-bold text-[#10b981]">{attendanceSummary.present || 0}</p>
                  <p className={`text-xs ${textSecondary}`}>Days Present</p>
                </div>
                <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
                  <p className="text-2xl font-bold text-[#ef4444]">{attendanceSummary.absent || 0}</p>
                  <p className={`text-xs ${textSecondary}`}>Days Absent</p>
                </div>
                <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
                  <p className="text-2xl font-bold text-[#6366f1]">{attendanceSummary.total_hours?.toFixed(1) || 0}</p>
                  <p className={`text-xs ${textSecondary}`}>Total Hours</p>
                </div>
                <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
                  <p className="text-2xl font-bold text-[#8b5cf6]">{attendanceSummary.extra_hours?.toFixed(1) || 0}</p>
                  <p className={`text-xs ${textSecondary}`}>Extra Hours</p>
                </div>
                <div className={`p-4 ${bgSecondary} rounded-lg text-center`}>
                  <p className="text-2xl font-bold text-[#f59e0b]">{attendanceSummary.average_hours?.toFixed(1) || 0}</p>
                  <p className={`text-xs ${textSecondary}`}>Avg Hours/Day</p>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <Button
                  onClick={() => window.location.href = '/hr?tab=attendance'}
                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                >
                  View Full Attendance History
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'security' && (
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardHeader>
              <CardTitle className={textPrimary}>Security Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`p-6 ${bgSecondary} rounded-lg`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-[#6366f1]/20 flex items-center justify-center">
                      <Key className="h-6 w-6 text-[#6366f1]" />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${textPrimary}`}>Change Password</h3>
                      <p className={`text-sm ${textSecondary}`}>Update your password via email OTP verification</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowPasswordModal(true)}
                    className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                </div>
              </div>

              <div className={`mt-4 p-4 border ${borderColor} rounded-lg`}>
                <h4 className={`font-medium ${textPrimary} mb-2`}>Password Requirements:</h4>
                <ul className={`text-sm ${textSecondary} space-y-1`}>
                  <li>• Minimum 6 characters</li>
                  <li>• OTP will be sent to your registered email</li>
                  <li>• OTP is valid for 10 minutes</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`w-full max-w-md ${bgCard} border ${borderColor}`}>
              <CardHeader>
                <CardTitle className={`${textPrimary} flex items-center gap-2`}>
                  <Lock className="h-5 w-5 text-[#6366f1]" />
                  Change Password
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Step 1: Request OTP */}
                {passwordStep === 'request' && (
                  <>
                    <p className={textSecondary}>
                      We'll send a 6-digit OTP to your registered email: 
                      <strong className={textPrimary}> {user?.email}</strong>
                    </p>
                    <div className="flex gap-3 pt-4">
                      <Button 
                        onClick={() => { setShowPasswordModal(false); resetPasswordFlow(); }} 
                        className={`flex-1 ${bgSecondary} ${textPrimary}`}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleRequestOTP} 
                        className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send OTP
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 2: Verify OTP */}
                {passwordStep === 'verify' && (
                  <>
                    <div className="text-center mb-4">
                      <CheckCircle className="h-12 w-12 text-[#10b981] mx-auto mb-2" />
                      <p className={textSecondary}>OTP sent to {user?.email}</p>
                    </div>
                    <div>
                      <Label className={textSecondary}>Enter 6-digit OTP</Label>
                      <Input
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary} text-center text-2xl tracking-widest`}
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button 
                        onClick={() => { setPasswordStep('request'); setOtp(''); }} 
                        className={`flex-1 ${bgSecondary} ${textPrimary}`}
                      >
                        Back
                      </Button>
                      <Button 
                        onClick={handleVerifyOTP} 
                        className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white"
                        disabled={otp.length !== 6}
                      >
                        Verify OTP
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 3: Change Password */}
                {passwordStep === 'change' && (
                  <>
                    <div className="text-center mb-4">
                      <CheckCircle className="h-12 w-12 text-[#10b981] mx-auto mb-2" />
                      <p className="text-[#10b981] font-medium">OTP Verified!</p>
                    </div>
                    <div>
                      <Label className={textSecondary}>New Password</Label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className={`${bgSecondary} border ${borderColor} ${textPrimary} pr-10`}
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
                      <Label className={textSecondary}>Confirm Password</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-red-400 text-sm flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Passwords do not match
                      </p>
                    )}
                    <div className="flex gap-3 pt-4">
                      <Button 
                        onClick={() => { setShowPasswordModal(false); resetPasswordFlow(); }} 
                        className={`flex-1 ${bgSecondary} ${textPrimary}`}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleChangePassword} 
                        className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                        disabled={newPassword.length < 6 || newPassword !== confirmPassword}
                      >
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
    </div>
  );
}
