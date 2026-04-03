import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import DrawleadAI from './DrawleadAI';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Clock, LogIn, LogOut, Coffee, Play, Building, Home, X, Calendar, ClipboardList } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Map routes to AI context types
const routeToContext = {
  '/leads': 'sales',
  '/operations': 'operations',
  '/marketing': 'marketing',
  '/finance': 'finance',
  '/hr': 'general',
  '/hr-admin': 'general',
  '/dashboard': 'general',
  '/reports': 'sales',
  '/services': 'general',
  '/settings': 'general',
  '/sop-works': 'operations',
  '/website-projects': 'operations',
  '/profile': 'general'
};

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const currentModule = routeToContext[location.pathname] || 'general';
  
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [showLunchOutModal, setShowLunchOutModal] = useState(false);
  const [showLunchInModal, setShowLunchInModal] = useState(false);
  
  // Form data for modals - now with separate hour, minute, period
  const [clockInData, setClockInData] = useState({ hour: 9, minute: 0, period: 'AM', workMode: 'office' });
  const [clockOutData, setClockOutData] = useState({ hour: 6, minute: 0, period: 'PM' });
  const [lunchOutData, setLunchOutData] = useState({ hour: 1, minute: 0, period: 'PM' });
  const [lunchInData, setLunchInData] = useState({ hour: 2, minute: 0, period: 'PM' });
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Get current time parts
  const getCurrentTimeParts = () => {
    const now = new Date();
    let hour = now.getHours();
    const minute = now.getMinutes();
    const period = hour >= 12 ? 'PM' : 'AM';
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    return { hour, minute, period };
  };

  // Format time parts to string for API
  const formatTimeForAPI = (hour, minute, period) => {
    const h = hour.toString().padStart(2, '0');
    const m = minute.toString().padStart(2, '0');
    return `${h}:${m} ${period}`;
  };

  // Get current date info
  const getCurrentDateInfo = () => {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      date: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      day: days[now.getDay()],
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  };

  const [currentDateTime, setCurrentDateTime] = useState(getCurrentDateInfo());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(getCurrentDateInfo());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load today's attendance
  const loadTodayAttendance = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/api/hr/attendance/today`, { headers });
      setTodayAttendance(res.data.attendance);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  }, [token]);

  useEffect(() => {
    loadTodayAttendance();
  }, [loadTodayAttendance]);

  // Initialize modal times when opening
  const openClockInModal = () => {
    const { hour, minute, period } = getCurrentTimeParts();
    setClockInData({ hour, minute, period, workMode: 'office' });
    setShowClockInModal(true);
  };

  const openClockOutModal = () => {
    const { hour, minute, period } = getCurrentTimeParts();
    setClockOutData({ hour, minute, period });
    setShowClockOutModal(true);
  };

  const openLunchOutModal = () => {
    const { hour, minute, period } = getCurrentTimeParts();
    setLunchOutData({ hour, minute, period });
    setShowLunchOutModal(true);
  };

  const openLunchInModal = () => {
    const { hour, minute, period } = getCurrentTimeParts();
    setLunchInData({ hour, minute, period });
    setShowLunchInModal(true);
  };

  // Handle Clock In
  const handleClockIn = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/hr/attendance/clock-in`, {
        time: formatTimeForAPI(clockInData.hour, clockInData.minute, clockInData.period),
        work_mode: clockInData.workMode
      }, { headers });
      toast.success('Clocked in successfully!');
      setShowClockInModal(false);
      loadTodayAttendance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clock in');
    }
    setLoading(false);
  };

  // Handle Clock Out
  const handleClockOut = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/api/hr/attendance/clock-out`, {
        time: formatTimeForAPI(clockOutData.hour, clockOutData.minute, clockOutData.period)
      }, { headers });
      toast.success('Clocked out successfully!');
      setShowClockOutModal(false);
      loadTodayAttendance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clock out');
    }
    setLoading(false);
  };

  // Handle Lunch Out (Start Lunch Break)
  const handleLunchOut = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/hr/attendance/lunch-start`, {
        time: formatTimeForAPI(lunchOutData.hour, lunchOutData.minute, lunchOutData.period)
      }, { headers });
      toast.success('Lunch break started!');
      setShowLunchOutModal(false);
      loadTodayAttendance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start lunch break');
    }
    setLoading(false);
  };

  // Handle Lunch In (End Lunch Break)
  const handleLunchIn = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/hr/attendance/lunch-end`, {
        time: formatTimeForAPI(lunchInData.hour, lunchInData.minute, lunchInData.period)
      }, { headers });
      toast.success('Back from lunch!');
      setShowLunchInModal(false);
      loadTodayAttendance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to end lunch break');
    }
    setLoading(false);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Parse time string to minutes since midnight
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    try {
      const cleaned = timeStr.trim().toUpperCase();
      let hours, minutes;
      
      if (cleaned.includes('AM') || cleaned.includes('PM')) {
        const isPM = cleaned.includes('PM');
        const timePart = cleaned.replace('AM', '').replace('PM', '').trim();
        [hours, minutes] = timePart.split(':').map(Number);
        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;
      } else {
        [hours, minutes] = cleaned.split(':').map(Number);
      }
      
      return hours * 60 + minutes;
    } catch {
      return null;
    }
  };

  // Calculate duration in hours and minutes
  const calculateDuration = (startTimeStr, endTimeStr) => {
    const startMinutes = parseTimeToMinutes(startTimeStr);
    const endMinutes = parseTimeToMinutes(endTimeStr);
    
    if (startMinutes === null || endMinutes === null) return null;
    
    let diffMinutes = endMinutes - startMinutes;
    if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight
    
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    
    return { hours, mins, totalMinutes: diffMinutes };
  };

  // Get formatted clock-in time from today's attendance
  const getClockInTime = () => {
    if (!todayAttendance?.clock_in) return null;
    const date = new Date(todayAttendance.clock_in);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  };

  // Get formatted lunch-out time from today's attendance
  const getLunchOutTime = () => {
    if (!todayAttendance?.lunch_out) return null;
    const date = new Date(todayAttendance.lunch_out);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  };

  // Calculate lunch duration for Lunch In modal
  const getLunchDuration = () => {
    const lunchOutTime = getLunchOutTime();
    if (!lunchOutTime) return null;
    const currentTime = formatTimeForAPI(lunchInData.hour, lunchInData.minute, lunchInData.period);
    return calculateDuration(lunchOutTime, currentTime);
  };

  // Calculate work duration for Clock Out modal (includes lunch deduction)
  const getWorkDuration = () => {
    const clockInTime = getClockInTime();
    if (!clockInTime) return null;
    
    const currentTime = formatTimeForAPI(clockOutData.hour, clockOutData.minute, clockOutData.period);
    const totalDuration = calculateDuration(clockInTime, currentTime);
    if (!totalDuration) return null;
    
    // Deduct lunch duration if lunch was taken
    let lunchMinutes = todayAttendance?.lunch_duration || 0;
    
    const workMinutes = totalDuration.totalMinutes - lunchMinutes;
    const hours = Math.floor(workMinutes / 60);
    const mins = Math.abs(workMinutes % 60);
    
    return { hours, mins, totalMinutes: workMinutes, lunchMinutes };
  };

  const isClockedIn = todayAttendance?.clock_in && !todayAttendance?.clock_out;
  const isClockedOut = todayAttendance?.clock_out;
  // Single lunch break check
  const isOnLunch = todayAttendance?.lunch_start && !todayAttendance?.lunch_end;
  const lunchCompleted = todayAttendance?.lunch_end;
  // Multiple sessions support
  const sessions = todayAttendance?.sessions || [];
  const totalSessionHours = sessions.reduce((sum, s) => sum + (s.hours || 0), 0);

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const bgInput = isDark ? 'bg-[#27272a]' : 'bg-gray-50';

  // Read-Only Time Display Component - Shows auto-captured time (no editing)
  const ReadOnlyTimeDisplay = ({ hour, minute, period, label }) => {
    return (
      <div>
        <Label className={`${textPrimary} mb-2 block`}>{label}</Label>
        <div className={`flex items-center justify-center gap-3 p-4 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
          {/* Hour */}
          <div className={`w-16 h-16 flex items-center justify-center rounded-lg ${isDark ? 'bg-[#3f3f46]' : 'bg-white'} shadow-sm`}>
            <span className={`text-3xl font-bold ${textPrimary}`} data-testid="time-hour-display">
              {hour.toString().padStart(2, '0')}
            </span>
          </div>

          <span className={`text-3xl font-bold ${textPrimary}`}>:</span>

          {/* Minute */}
          <div className={`w-16 h-16 flex items-center justify-center rounded-lg ${isDark ? 'bg-[#3f3f46]' : 'bg-white'} shadow-sm`}>
            <span className={`text-3xl font-bold ${textPrimary}`} data-testid="time-minute-display">
              {minute.toString().padStart(2, '0')}
            </span>
          </div>

          {/* AM/PM */}
          <div className={`px-4 h-16 flex items-center justify-center rounded-lg font-bold text-xl ${
            period === 'AM' 
              ? 'bg-[#6366f1] text-white' 
              : 'bg-[#f59e0b] text-white'
          }`} data-testid="time-period-display">
            {period}
          </div>
        </div>
        <p className={`text-xs mt-2 text-center ${textSecondary}`}>
          Time auto-captured • Cannot be edited
        </p>
      </div>
    );
  };

  // Attendance Modal Component
  const AttendanceModal = ({ isOpen, onClose, title, icon: Icon, iconColor, children, onSubmit, submitText, submitColor }) => {
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4 shadow-xl`}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className={`flex items-center gap-3 ${textPrimary}`}>
                <div className={`p-2 rounded-lg ${iconColor}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                {title}
              </CardTitle>
              <button onClick={onClose} className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${textSecondary}`}>
                <X className="h-5 w-5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date & Day Info */}
            <div className={`p-4 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'} flex items-center gap-4`}>
              <Calendar className={`h-10 w-10 ${textSecondary}`} />
              <div>
                <p className={`text-lg font-semibold ${textPrimary}`}>{currentDateTime.date}</p>
                <p className={`text-sm ${textSecondary}`}>{currentDateTime.day}</p>
              </div>
            </div>
            
            {children}
            
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={onClose} className={`flex-1 ${borderColor}`}>
                Cancel
              </Button>
              <Button onClick={onSubmit} disabled={loading} className={`flex-1 ${submitColor} text-white`}>
                {submitText}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Attendance & Theme Toggle */}
        <header className={`h-14 flex items-center justify-between px-6 border-b ${isDark ? 'bg-[#0c0a09] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          {/* Left: Attendance Info */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>
              <Clock className="h-4 w-4" />
              <span>In: <strong className={isDark ? 'text-[#fafafa]' : 'text-gray-900'}>{formatTime(todayAttendance?.clock_in)}</strong></span>
              <span className="mx-1">|</span>
              <span>Out: <strong className={isDark ? 'text-[#fafafa]' : 'text-gray-900'}>{formatTime(todayAttendance?.clock_out)}</strong></span>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Clock In Button - Only show if not clocked in */}
              {!todayAttendance?.clock_in && (
                <Button
                  size="sm"
                  onClick={openClockInModal}
                  className="h-8 px-3 text-xs bg-[#10b981] hover:bg-[#059669] text-white"
                >
                  <LogIn className="h-3 w-3 mr-1" />
                  Clock In
                </Button>
              )}
              
              {/* Allow Clock In again after Clock Out (multiple sessions) */}
              {isClockedOut && (
                <Button
                  size="sm"
                  onClick={openClockInModal}
                  className="h-8 px-3 text-xs bg-[#10b981] hover:bg-[#059669] text-white"
                >
                  <LogIn className="h-3 w-3 mr-1" />
                  Clock In Again
                </Button>
              )}
              
              {/* Lunch & Clock Out Buttons - Show if clocked in but not clocked out */}
              {isClockedIn && !isClockedOut && (
                <>
                  {/* Lunch Out button - only if lunch not started */}
                  {!isOnLunch && !lunchCompleted && (
                    <Button
                      size="sm"
                      onClick={openLunchOutModal}
                      className="h-8 px-3 text-xs bg-[#f59e0b] hover:bg-[#d97706] text-white"
                    >
                      <Coffee className="h-3 w-3 mr-1" />
                      Lunch Out
                    </Button>
                  )}
                  
                  {/* Lunch In button - show when on lunch */}
                  {isOnLunch && (
                    <Button
                      size="sm"
                      onClick={openLunchInModal}
                      className="h-8 px-3 text-xs bg-[#8b5cf6] hover:bg-[#7c3aed] text-white animate-pulse"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Lunch In
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    onClick={openClockOutModal}
                    className="h-8 px-3 text-xs bg-[#ef4444] hover:bg-[#dc2626] text-white"
                  >
                    <LogOut className="h-3 w-3 mr-1" />
                    Clock Out
                  </Button>
                </>
              )}
              
              {/* Show session count if multiple sessions */}
              {sessions.length > 0 && (
                <span className="text-xs text-[#6366f1]">({sessions.length} session{sessions.length > 1 ? 's' : ''})</span>
              )}
            </div>
          </div>
          
          {/* Right: Task Manager & Theme Toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              onClick={() => navigate('/bde-tasks')}
              className={`h-8 px-2 sm:px-3 text-xs whitespace-nowrap ${location.pathname === '/bde-tasks' ? 'bg-[#6366f1]' : isDark ? 'bg-[#27272a] hover:bg-[#3f3f46]' : 'bg-gray-100 hover:bg-gray-200'} ${isDark ? 'text-white' : 'text-gray-700'}`}
              data-testid="task-manager-btn"
            >
              <ClipboardList className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Task Manager</span>
            </Button>
            <ThemeToggle />
          </div>
        </header>
        
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">{children}</div>
        </div>
      </div>
      <DrawleadAI currentModule={currentModule} />

      {/* Clock In Modal */}
      <AttendanceModal
        isOpen={showClockInModal}
        onClose={() => setShowClockInModal(false)}
        title="Clock In"
        icon={LogIn}
        iconColor="bg-[#10b981]"
        onSubmit={handleClockIn}
        submitText="Clock In"
        submitColor="bg-[#10b981] hover:bg-[#059669]"
      >
        {/* Read-Only Time Display */}
        <ReadOnlyTimeDisplay
          hour={clockInData.hour}
          minute={clockInData.minute}
          period={clockInData.period}
          label="Clock In Time"
        />
        
        {/* Work Mode */}
        <div>
          <Label className={`${textPrimary} mb-2 block`}>Work Mode</Label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setClockInData(prev => ({ ...prev, workMode: 'office' }))}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                clockInData.workMode === 'office'
                  ? 'border-[#6366f1] bg-[#6366f1]/10'
                  : `border-[#3f3f46] ${isDark ? 'bg-[#27272a]' : 'bg-gray-50'}`
              }`}
            >
              <Building className={`h-5 w-5 ${clockInData.workMode === 'office' ? 'text-[#6366f1]' : textSecondary}`} />
              <span className={`font-medium ${clockInData.workMode === 'office' ? 'text-[#6366f1]' : textPrimary}`}>Office</span>
            </button>
            <button
              type="button"
              onClick={() => setClockInData(prev => ({ ...prev, workMode: 'remote' }))}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                clockInData.workMode === 'remote'
                  ? 'border-[#10b981] bg-[#10b981]/10'
                  : `border-[#3f3f46] ${isDark ? 'bg-[#27272a]' : 'bg-gray-50'}`
              }`}
            >
              <Home className={`h-5 w-5 ${clockInData.workMode === 'remote' ? 'text-[#10b981]' : textSecondary}`} />
              <span className={`font-medium ${clockInData.workMode === 'remote' ? 'text-[#10b981]' : textPrimary}`}>Remote</span>
            </button>
          </div>
        </div>
      </AttendanceModal>

      {/* Clock Out Modal */}
      <AttendanceModal
        isOpen={showClockOutModal}
        onClose={() => setShowClockOutModal(false)}
        title="Clock Out"
        icon={LogOut}
        iconColor="bg-[#ef4444]"
        onSubmit={handleClockOut}
        submitText="Clock Out"
        submitColor="bg-[#ef4444] hover:bg-[#dc2626]"
      >
        {/* Work Duration Display */}
        {(() => {
          const duration = getWorkDuration();
          return duration ? (
            <div className={`p-4 rounded-lg ${isDark ? 'bg-[#10b981]/10' : 'bg-emerald-50'} border ${isDark ? 'border-[#10b981]/30' : 'border-emerald-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? 'text-[#10b981]' : 'text-emerald-700'}`}>Total Work Hours:</span>
                <span className={`text-2xl font-bold ${isDark ? 'text-[#10b981]' : 'text-emerald-700'}`}>
                  {duration.hours}h {duration.mins}m
                </span>
              </div>
              <div className={`text-xs mt-2 space-y-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>
                <p>Clocked in at {formatTime(todayAttendance?.clock_in)}</p>
                {duration.lunchMinutes > 0 && (
                  <p>Lunch break: {Math.floor(duration.lunchMinutes / 60)}h {duration.lunchMinutes % 60}m deducted</p>
                )}
                {duration.totalMinutes < 540 && (
                  <p className="text-[#f59e0b]">⚠️ Less than 9 hours - may require approval</p>
                )}
              </div>
            </div>
          ) : null;
        })()}
        
        {/* Work Mode Display */}
        <div className={`p-3 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'} flex items-center gap-3`}>
          {todayAttendance?.work_mode === 'remote' ? (
            <Home className="h-5 w-5 text-[#10b981]" />
          ) : (
            <Building className="h-5 w-5 text-[#6366f1]" />
          )}
          <span className={textPrimary}>Work Mode: <strong className="capitalize">{todayAttendance?.work_mode || 'Office'}</strong></span>
        </div>
        
        {/* Read-Only Time Display */}
        <ReadOnlyTimeDisplay
          hour={clockOutData.hour}
          minute={clockOutData.minute}
          period={clockOutData.period}
          label="Clock Out Time"
        />
      </AttendanceModal>

      {/* Lunch Out Modal */}
      <AttendanceModal
        isOpen={showLunchOutModal}
        onClose={() => setShowLunchOutModal(false)}
        title="Start Lunch Break"
        icon={Coffee}
        iconColor="bg-[#f59e0b]"
        onSubmit={handleLunchOut}
        submitText="Start Lunch"
        submitColor="bg-[#f59e0b] hover:bg-[#d97706]"
      >
        {/* Work Mode Display */}
        <div className={`p-3 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'} flex items-center gap-3`}>
          {todayAttendance?.work_mode === 'remote' ? (
            <Home className="h-5 w-5 text-[#10b981]" />
          ) : (
            <Building className="h-5 w-5 text-[#6366f1]" />
          )}
          <span className={textPrimary}>Work Mode: <strong className="capitalize">{todayAttendance?.work_mode || 'Office'}</strong></span>
        </div>
        
        {/* Read-Only Time Display */}
        <ReadOnlyTimeDisplay
          hour={lunchOutData.hour}
          minute={lunchOutData.minute}
          period={lunchOutData.period}
          label="Lunch Start Time"
        />
      </AttendanceModal>

      {/* Lunch In Modal */}
      <AttendanceModal
        isOpen={showLunchInModal}
        onClose={() => setShowLunchInModal(false)}
        title="End Lunch Break"
        icon={Play}
        iconColor="bg-[#8b5cf6]"
        onSubmit={handleLunchIn}
        submitText="Resume Work"
        submitColor="bg-[#8b5cf6] hover:bg-[#7c3aed]"
      >
        {/* Lunch Duration Display */}
        {(() => {
          const duration = getLunchDuration();
          return duration ? (
            <div className={`p-4 rounded-lg ${isDark ? 'bg-[#f59e0b]/10' : 'bg-amber-50'} border ${isDark ? 'border-[#f59e0b]/30' : 'border-amber-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? 'text-[#f59e0b]' : 'text-amber-700'}`}>Lunch Duration:</span>
                <span className={`text-2xl font-bold ${isDark ? 'text-[#f59e0b]' : 'text-amber-700'}`}>
                  {duration.hours > 0 ? `${duration.hours}h ` : ''}{duration.mins}m
                </span>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>
                Lunch started at {formatTime(todayAttendance?.lunch_start)}
              </p>
            </div>
          ) : null;
        })()}
        
        {/* Work Mode Display */}
        <div className={`p-3 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'} flex items-center gap-3`}>
          {todayAttendance?.work_mode === 'remote' ? (
            <Home className="h-5 w-5 text-[#10b981]" />
          ) : (
            <Building className="h-5 w-5 text-[#6366f1]" />
          )}
          <span className={textPrimary}>Work Mode: <strong className="capitalize">{todayAttendance?.work_mode || 'Office'}</strong></span>
        </div>
        
        {/* Read-Only Time Display */}
        <ReadOnlyTimeDisplay
          hour={lunchInData.hour}
          minute={lunchInData.minute}
          period={lunchInData.period}
          label="Lunch End Time"
        />
      </AttendanceModal>
    </div>
  );
};

export default Layout;
