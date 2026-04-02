import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X,
  Clock, Briefcase, Users, MapPin, ExternalLink, Link2, Check,
  AlertCircle, Home, Building, Palmtree, Stethoscope, Coffee
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function CalendarPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDark } = useTheme();
  const { user } = useAuth();
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarData, setCalendarData] = useState({});
  const [companyCalendar, setCompanyCalendar] = useState(null);
  const [monthlyLeaveBalance, setMonthlyLeaveBalance] = useState(null);
  
  // Google Calendar state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleEvents, setGoogleEvents] = useState([]);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  
  // Day detail state
  const [dayDetail, setDayDetail] = useState(null);
  const [dayTasks, setDayTasks] = useState([]);
  const [dayMeetings, setDayMeetings] = useState([]);
  
  // Holiday management (HR Admin)
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '', type: 'public' });
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'hr_manager';

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#09090b]' : 'bg-gray-50';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  // Check URL params for Google Calendar connection status
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    
    if (connected === 'true') {
      toast.success('Google Calendar connected successfully!');
      window.history.replaceState({}, '', '/calendar');
    } else if (error) {
      toast.error(`Failed to connect Google Calendar: ${error}`);
      window.history.replaceState({}, '', '/calendar');
    }
  }, [searchParams]);

  // Load Google Calendar connection status
  const loadGoogleStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/oauth/calendar/status`, { headers });
      setGoogleConnected(res.data.connected);
      setGoogleEmail(res.data.google_email || '');
    } catch (error) {
      console.error('Error checking Google Calendar status:', error);
    }
  }, [token]);

  // Load company calendar (holidays, working days)
  const loadCompanyCalendar = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/admin/calendar/${currentYear}/${currentMonth}`, { headers });
      setCompanyCalendar(res.data);
    } catch (error) {
      console.error('Error loading company calendar:', error);
    }
  }, [currentYear, currentMonth, token]);

  // Load attendance calendar data
  const loadCalendarData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/attendance/calendar/${currentYear}/${currentMonth}`, { headers });
      setCalendarData(res.data.calendar_data || {});
    } catch (error) {
      console.error('Error loading calendar data:', error);
    }
  }, [currentYear, currentMonth, token]);

  // Load monthly leave balance
  const loadMonthlyLeaveBalance = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/hr/leave/monthly-balance?month=${currentMonth}&year=${currentYear}`, { headers });
      setMonthlyLeaveBalance(res.data);
    } catch (error) {
      console.error('Error loading monthly leave balance:', error);
    }
  }, [currentYear, currentMonth, token]);

  // Load Google Calendar events for the month
  const loadGoogleEvents = useCallback(async () => {
    if (!googleConnected) return;
    
    setLoadingGoogle(true);
    try {
      const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${lastDay}`;
      
      const res = await axios.get(`${API}/api/oauth/calendar/events?start_date=${startDate}&end_date=${endDate}`, { headers });
      setGoogleEvents(res.data.events || []);
    } catch (error) {
      console.error('Error loading Google events:', error);
    }
    setLoadingGoogle(false);
  }, [googleConnected, currentYear, currentMonth, token]);

  // Initial load
  useEffect(() => {
    loadGoogleStatus();
  }, [loadGoogleStatus]);

  // Load data when month changes
  useEffect(() => {
    loadCompanyCalendar();
    loadCalendarData();
    loadMonthlyLeaveBalance();
    loadGoogleEvents();
  }, [loadCompanyCalendar, loadCalendarData, loadMonthlyLeaveBalance, loadGoogleEvents]);

  // Load day detail when a date is selected
  const loadDayDetail = async (dateStr) => {
    try {
      // Load attendance detail
      const attRes = await axios.get(`${API}/api/hr/attendance/date-detail/${dateStr}`, { headers });
      setDayDetail(attRes.data);
      
      // Load tasks for this date
      const tasksRes = await axios.get(`${API}/api/bde/tasks/by-date/${dateStr}`, { headers });
      setDayTasks(tasksRes.data.tasks || []);
      
      // Load Google Calendar events for this date
      if (googleConnected) {
        const eventsRes = await axios.get(`${API}/api/oauth/calendar/events/date/${dateStr}`, { headers });
        setDayMeetings(eventsRes.data.events || []);
      }
    } catch (error) {
      console.error('Error loading day detail:', error);
    }
  };

  // Handle date selection
  const handleDateClick = (dateStr) => {
    setSelectedDate(dateStr);
    loadDayDetail(dateStr);
  };

  // Navigate to full day detail page
  const handleViewFullDetail = () => {
    if (selectedDate) {
      navigate(`/calendar/${selectedDate}`);
    }
  };

  // Connect Google Calendar
  const handleConnectGoogle = async () => {
    try {
      const res = await axios.get(`${API}/api/oauth/calendar/connect`, { headers });
      if (res.data.authorization_url) {
        window.location.href = res.data.authorization_url;
      }
    } catch (error) {
      toast.error('Failed to initiate Google Calendar connection');
    }
  };

  // Disconnect Google Calendar
  const handleDisconnectGoogle = async () => {
    try {
      await axios.post(`${API}/api/oauth/calendar/disconnect`, {}, { headers });
      setGoogleConnected(false);
      setGoogleEmail('');
      setGoogleEvents([]);
      toast.success('Google Calendar disconnected');
    } catch (error) {
      toast.error('Failed to disconnect Google Calendar');
    }
  };

  // Add holiday (HR Admin)
  const handleAddHoliday = async (e) => {
    e.preventDefault();
    try {
      const currentHolidays = companyCalendar?.holidays || [];
      const newHolidays = [...currentHolidays, { 
        date: holidayForm.date, 
        name: holidayForm.name,
        type: holidayForm.type 
      }];
      
      await axios.put(`${API}/api/hr/admin/calendar/${currentYear}/${currentMonth}`, {
        holidays: newHolidays,
        working_days: companyCalendar?.working_days || 22
      }, { headers });
      
      toast.success('Holiday added');
      setShowHolidayModal(false);
      setHolidayForm({ date: '', name: '', type: 'public' });
      loadCompanyCalendar();
    } catch (error) {
      toast.error('Failed to add holiday');
    }
  };

  // Remove holiday (HR Admin)
  const handleRemoveHoliday = async (dateToRemove) => {
    try {
      const newHolidays = (companyCalendar?.holidays || []).filter(h => h.date !== dateToRemove);
      await axios.put(`${API}/api/hr/admin/calendar/${currentYear}/${currentMonth}`, {
        holidays: newHolidays,
        working_days: companyCalendar?.working_days || 22
      }, { headers });
      
      toast.success('Holiday removed');
      loadCompanyCalendar();
    } catch (error) {
      toast.error('Failed to remove holiday');
    }
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    const holidays = companyCalendar?.holidays || [];
    const specialWorkingDays = companyCalendar?.special_working_days || [];
    const leaves = monthlyLeaveBalance?.leaves_this_month || [];
    
    // Empty cells for days before the month starts
    for (let i = 0; i < startingDay; i++) {
      days.push({ day: null, date: null });
    }
    
    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayOfWeek = new Date(currentYear, currentMonth - 1, i).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isSpecialWorking = specialWorkingDays.includes(dateStr);
      const holiday = holidays.find(h => h.date === dateStr);
      const attendance = calendarData[dateStr];
      const leave = leaves.find(l => {
        const start = l.start_date?.split('T')[0];
        const end = l.end_date?.split('T')[0];
        return dateStr >= start && dateStr <= end;
      });
      
      // Count Google events for this day
      const dayEvents = googleEvents.filter(e => {
        const eventDate = (e.start || '').split('T')[0];
        return eventDate === dateStr;
      });
      
      days.push({
        day: i,
        date: dateStr,
        isWeekend,
        isSpecialWorking,
        holiday,
        attendance,
        leave,
        eventsCount: dayEvents.length
      });
    }
    
    return days;
  };

  // Get day cell styling
  const getDayCellStyle = (dayObj) => {
    if (!dayObj.day) return '';
    
    const baseStyle = 'w-full h-full min-h-[80px] p-1 rounded-lg border-2 transition-all cursor-pointer flex flex-col';
    
    if (dayObj.holiday) {
      return `${baseStyle} bg-[#ef4444]/10 border-[#ef4444]/50 hover:border-[#ef4444]`;
    }
    if (dayObj.leave) {
      const leaveType = dayObj.leave.leave_type;
      if (leaveType === 'casual') return `${baseStyle} bg-[#f59e0b]/10 border-[#f59e0b]/50 hover:border-[#f59e0b]`;
      if (leaveType === 'sick') return `${baseStyle} bg-[#ec4899]/10 border-[#ec4899]/50 hover:border-[#ec4899]`;
      return `${baseStyle} bg-[#8b5cf6]/10 border-[#8b5cf6]/50 hover:border-[#8b5cf6]`;
    }
    if (dayObj.attendance) {
      if (dayObj.attendance.work_mode === 'remote') {
        return `${baseStyle} bg-[#10b981]/10 border-[#10b981]/50 hover:border-[#10b981]`;
      }
      return `${baseStyle} bg-[#6366f1]/10 border-[#6366f1]/50 hover:border-[#6366f1]`;
    }
    if (dayObj.isWeekend && !dayObj.isSpecialWorking) {
      return `${baseStyle} ${isDark ? 'bg-[#27272a]/50 border-[#27272a]' : 'bg-gray-100 border-gray-200'} opacity-60`;
    }
    
    return `${baseStyle} ${isDark ? 'border-[#27272a] hover:border-[#3f3f46]' : 'border-gray-200 hover:border-gray-300'}`;
  };

  const days = generateCalendarDays();
  const today = new Date().toISOString().split('T')[0];

  return (
    <Layout>
      <div className={`min-h-screen ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'} p-6`} data-testid="calendar-page">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                Calendar
              </span>
            </h1>
            <p className={textSecondary}>View attendance, tasks, meetings, and leaves</p>
          </div>
          
          {/* Google Calendar Connection */}
          <div className="flex items-center gap-3">
            {googleConnected ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-[#10b981]/20 text-[#10b981] flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {googleEmail}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDisconnectGoogle}
                  className={borderColor}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleConnectGoogle}
                className="bg-[#4285f4] hover:bg-[#3367d6] text-white"
                data-testid="connect-google-calendar"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Connect Google Calendar
              </Button>
            )}
            
            {isAdmin && (
              <Button
                onClick={() => setShowHolidayModal(true)}
                className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Holiday
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Calendar */}
          <div className="lg:col-span-3">
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (currentMonth === 1) {
                        setCurrentMonth(12);
                        setCurrentYear(currentYear - 1);
                      } else {
                        setCurrentMonth(currentMonth - 1);
                      }
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <CardTitle className={textPrimary}>
                    {monthNames[currentMonth - 1]} {currentYear}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (currentMonth === 12) {
                        setCurrentMonth(1);
                        setCurrentYear(currentYear + 1);
                      } else {
                        setCurrentMonth(currentMonth + 1);
                      }
                    }}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
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
                          className={`${getDayCellStyle(dayObj)} ${selectedDate === dayObj.date ? 'ring-2 ring-[#6366f1]' : ''}`}
                          data-testid={`calendar-day-${dayObj.date}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${dayObj.date === today ? 'bg-[#6366f1] text-white rounded-full w-6 h-6 flex items-center justify-center' : textPrimary}`}>
                              {dayObj.day}
                            </span>
                            {dayObj.eventsCount > 0 && (
                              <Badge className="bg-[#4285f4]/20 text-[#4285f4] text-xs px-1">
                                {dayObj.eventsCount}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Status indicators */}
                          <div className="flex-1 flex flex-col justify-end gap-0.5 mt-1">
                            {dayObj.holiday && (
                              <span className="text-[10px] text-[#ef4444] truncate">{dayObj.holiday.name}</span>
                            )}
                            {dayObj.leave && (
                              <Badge className={`text-[10px] px-1 py-0 ${
                                dayObj.leave.leave_type === 'casual' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' :
                                dayObj.leave.leave_type === 'sick' ? 'bg-[#ec4899]/20 text-[#ec4899]' :
                                'bg-[#8b5cf6]/20 text-[#8b5cf6]'
                              }`}>
                                {dayObj.leave.leave_type}
                              </Badge>
                            )}
                            {dayObj.attendance && !dayObj.leave && (
                              <div className="flex items-center gap-1">
                                {dayObj.attendance.work_mode === 'remote' ? (
                                  <Home className="h-3 w-3 text-[#10b981]" />
                                ) : (
                                  <Building className="h-3 w-3 text-[#6366f1]" />
                                )}
                                <span className="text-[10px] text-[#10b981]">
                                  {dayObj.attendance.total_hours?.toFixed(1)}h
                                </span>
                              </div>
                            )}
                          </div>
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
                    <div className="w-4 h-4 rounded bg-[#ef4444]/20 border-2 border-[#ef4444]"></div>
                    <span className={`text-xs ${textSecondary}`}>Holiday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#f59e0b]/20 border-2 border-[#f59e0b]"></div>
                    <span className={`text-xs ${textSecondary}`}>Casual Leave</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#ec4899]/20 border-2 border-[#ec4899]"></div>
                    <span className={`text-xs ${textSecondary}`}>Sick Leave</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#4285f4]/20 text-[#4285f4] text-xs">3</Badge>
                    <span className={`text-xs ${textSecondary}`}>Google Events</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Monthly Leave Balance */}
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm ${textPrimary}`}>
                  Monthly Leave Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palmtree className="h-4 w-4 text-[#f59e0b]" />
                    <span className={`text-sm ${textSecondary}`}>Casual</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`font-bold ${textPrimary}`}>
                      {monthlyLeaveBalance?.remaining?.casual ?? 2}
                    </span>
                    <span className={`text-xs ${textSecondary}`}>/ 2</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-[#ec4899]" />
                    <span className={`text-sm ${textSecondary}`}>Sick</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`font-bold ${textPrimary}`}>
                      {monthlyLeaveBalance?.remaining?.sick ?? 2}
                    </span>
                    <span className={`text-xs ${textSecondary}`}>/ 2</span>
                  </div>
                </div>
                <p className={`text-xs ${textSecondary} pt-2 border-t ${borderColor}`}>
                  Resets every month
                </p>
              </CardContent>
            </Card>

            {/* Holidays This Month */}
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm ${textPrimary}`}>
                  Holidays This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(companyCalendar?.holidays || []).length === 0 ? (
                  <p className={`text-sm ${textSecondary}`}>No holidays</p>
                ) : (
                  <div className="space-y-2">
                    {companyCalendar.holidays.map((h, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-medium ${textPrimary}`}>{h.name}</p>
                          <p className={`text-xs ${textSecondary}`}>{h.date}</p>
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveHoliday(h.date)}
                            className="h-6 w-6 p-0 text-[#ef4444]"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected Day Detail */}
            {selectedDate && (
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm ${textPrimary}`}>
                      {new Date(selectedDate).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short'
                      })}
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={handleViewFullDetail}
                      className="h-7 text-xs bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                    >
                      View Full
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Attendance */}
                  {dayDetail?.attendance && (
                    <div className={`p-2 rounded-lg ${bgSecondary}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-3 w-3 text-[#6366f1]" />
                        <span className={`text-xs font-medium ${textPrimary}`}>Attendance</span>
                      </div>
                      <div className={`text-xs ${textSecondary}`}>
                        {dayDetail.attendance.clock_in && (
                          <span>In: {new Date(dayDetail.attendance.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                        {dayDetail.attendance.clock_out && (
                          <span> | Out: {new Date(dayDetail.attendance.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Tasks */}
                  {dayTasks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-3 w-3 text-[#f59e0b]" />
                        <span className={`text-xs font-medium ${textPrimary}`}>Tasks ({dayTasks.length})</span>
                      </div>
                      <div className="space-y-1">
                        {dayTasks.slice(0, 3).map(task => (
                          <div key={task.task_id} className={`p-2 rounded ${bgSecondary}`}>
                            <p className={`text-xs ${textPrimary} truncate`}>{task.task_name}</p>
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <p className={`text-xs ${textSecondary}`}>+{dayTasks.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Meetings */}
                  {dayMeetings.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-3 w-3 text-[#4285f4]" />
                        <span className={`text-xs font-medium ${textPrimary}`}>Meetings ({dayMeetings.length})</span>
                      </div>
                      <div className="space-y-1">
                        {dayMeetings.slice(0, 3).map(meeting => (
                          <div key={meeting.event_id} className={`p-2 rounded ${bgSecondary}`}>
                            <p className={`text-xs ${textPrimary} truncate`}>{meeting.title}</p>
                            {meeting.start && (
                              <p className={`text-[10px] ${textSecondary}`}>
                                {meeting.is_all_day ? 'All day' : new Date(meeting.start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        ))}
                        {dayMeetings.length > 3 && (
                          <p className={`text-xs ${textSecondary}`}>+{dayMeetings.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {!dayDetail?.attendance && dayTasks.length === 0 && dayMeetings.length === 0 && (
                    <p className={`text-xs ${textSecondary} text-center py-4`}>No data for this day</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Add Holiday Modal */}
        {showHolidayModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={textPrimary}>Add Holiday</CardTitle>
                  <Button variant="ghost" onClick={() => setShowHolidayModal(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddHoliday} className="space-y-4">
                  <div>
                    <Label className={textPrimary}>Holiday Name</Label>
                    <Input
                      value={holidayForm.name}
                      onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                      placeholder="e.g., Republic Day"
                      required
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Date</Label>
                    <Input
                      type="date"
                      value={holidayForm.date}
                      onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                      required
                      className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Type</Label>
                    <select
                      value={holidayForm.type}
                      onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                      className={`w-full p-2 rounded ${bgSecondary} border ${borderColor} ${textPrimary}`}
                    >
                      <option value="public">Public Holiday</option>
                      <option value="optional">Optional Holiday</option>
                      <option value="company">Company Holiday</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowHolidayModal(false)}
                      className={`flex-1 ${borderColor}`}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white"
                    >
                      Add Holiday
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
