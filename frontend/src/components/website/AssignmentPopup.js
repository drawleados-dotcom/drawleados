import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { 
  X, User, Calendar, ChevronLeft, ChevronRight, Clock, 
  FileText, Check, AlertCircle, ArrowRight
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * AssignmentPopup - Developer workload-aware assignment component
 * Shows developers, their calendar, and tasks for selected date
 */
export default function AssignmentPopup({
  isOpen,
  onClose,
  taskId,
  taskName,
  stage,
  currentAssignee,
  currentDueDate,
  teamMembers,
  onAssign,
  isDark,
  bgCard,
  bgSecondary,
  borderColor,
  textPrimary,
  textSecondary
}) {
  const [step, setStep] = useState(1); // 1 = select developer, 2 = select date
  const [selectedDev, setSelectedDev] = useState(null);
  const [selectedDate, setSelectedDate] = useState(currentDueDate || '');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [calendarData, setCalendarData] = useState({});
  const [dayTasks, setDayTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const token = localStorage.getItem('session_token');
  
  // Load developer's calendar data when selected
  const loadCalendarData = useCallback(async (devName) => {
    if (!devName) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/api/website-projects/developer-workload-calendar/${encodeURIComponent(devName)}?month=${calendarMonth}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCalendarData(res.data.calendar || {});
    } catch (error) {
      console.error('Error loading calendar:', error);
    } finally {
      setLoading(false);
    }
  }, [calendarMonth, token]);
  
  // Load tasks for a specific date
  const loadDayTasks = useCallback(async (devName, date) => {
    if (!devName || !date) return;
    try {
      const res = await axios.get(
        `${API}/api/website-projects/developer-workload/${encodeURIComponent(devName)}?date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const tasks = res.data.tasks_by_date?.[date] || [];
      setDayTasks(tasks);
    } catch (error) {
      console.error('Error loading day tasks:', error);
      setDayTasks([]);
    }
  }, [token]);
  
  // When developer is selected, load their calendar
  useEffect(() => {
    if (selectedDev && step === 2) {
      loadCalendarData(selectedDev.name);
    }
  }, [selectedDev, step, loadCalendarData]);
  
  // When date is selected, load tasks for that day
  useEffect(() => {
    if (selectedDev && selectedDate) {
      loadDayTasks(selectedDev.name, selectedDate);
    }
  }, [selectedDev, selectedDate, loadDayTasks]);
  
  // Generate calendar days
  const generateCalendarDays = () => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    const days = [];
    
    // Add empty slots for days before the 1st
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ day: null, date: null });
    }
    
    // Add actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = calendarData[dateStr] || { count: 0, tasks: [] };
      days.push({
        day: d,
        date: dateStr,
        count: dayData.count,
        tasks: dayData.tasks,
        isToday: dateStr === new Date().toISOString().split('T')[0],
        isSelected: dateStr === selectedDate
      });
    }
    
    return days;
  };
  
  // Change calendar month
  const changeMonth = (delta) => {
    const [year, month] = calendarMonth.split('-').map(Number);
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    setCalendarMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };
  
  // Handle final assignment
  const handleAssign = async () => {
    if (!selectedDev || !selectedDate) {
      toast.error('Please select a developer and date');
      return;
    }
    
    try {
      await axios.put(
        `${API}/api/website-projects/pages/${taskId}/assign-with-date`,
        { stage, assignee: selectedDev.name, due_date: selectedDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${stage} assigned to ${selectedDev.name} for ${selectedDate}`);
      onAssign && onAssign(selectedDev.name, selectedDate);
      onClose();
    } catch (error) {
      toast.error('Failed to assign');
    }
  };
  
  if (!isOpen) return null;
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const [calYear, calMonth] = calendarMonth.split('-').map(Number);
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`${bgCard} rounded-2xl w-full max-w-2xl border ${borderColor} shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
          <div>
            <h2 className={`text-lg font-bold ${textPrimary}`}>
              {step === 1 ? 'Select Developer' : 'Select Due Date'}
            </h2>
            <p className={`text-sm ${textSecondary}`}>
              {taskName} - {stage?.charAt(0).toUpperCase() + stage?.slice(1)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Step 1: Developer List */}
        {step === 1 && (
          <div className="p-4">
            <p className={`text-sm ${textSecondary} mb-4`}>Choose a developer to assign this task:</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
              {teamMembers.map(dev => (
                <button
                  key={dev.user_id || dev.name}
                  onClick={() => {
                    setSelectedDev(dev);
                    setStep(2);
                  }}
                  className={`p-4 rounded-xl border ${borderColor} ${bgSecondary} hover:border-[#6366f1] 
                    transition-all text-left group ${selectedDev?.name === dev.name ? 'ring-2 ring-[#6366f1]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#6366f1]/20 flex items-center justify-center shrink-0">
                      <span className="text-[#6366f1] font-semibold">
                        {dev.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium ${textPrimary} truncate`}>{dev.name}</p>
                      <p className={`text-xs ${textSecondary} truncate`}>{dev.designation || dev.role || 'Team Member'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs ${textSecondary}`}>View Calendar</span>
                    <ArrowRight className="h-4 w-4 text-[#6366f1] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Step 2: Calendar & Date Selection */}
        {step === 2 && selectedDev && (
          <div className="flex flex-col md:flex-row">
            {/* Calendar Side */}
            <div className="flex-1 p-4 border-r border-b md:border-b-0 ${borderColor}">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={() => changeMonth(-1)} className="h-8 w-8 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className={`font-semibold ${textPrimary}`}>
                  {monthNames[calMonth - 1]} {calYear}
                </span>
                <Button variant="ghost" size="sm" onClick={() => changeMonth(1)} className="h-8 w-8 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className={`text-center text-xs font-medium ${textSecondary} py-1`}>
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays().map((dayInfo, idx) => (
                  <button
                    key={idx}
                    onClick={() => dayInfo.date && setSelectedDate(dayInfo.date)}
                    disabled={!dayInfo.day}
                    className={`
                      aspect-square p-1 rounded-lg text-center relative transition-all
                      ${!dayInfo.day ? 'invisible' : ''}
                      ${dayInfo.isSelected ? 'bg-[#6366f1] text-white' : ''}
                      ${dayInfo.isToday && !dayInfo.isSelected ? `ring-2 ring-[#6366f1] ${bgSecondary}` : ''}
                      ${!dayInfo.isSelected && dayInfo.day ? `hover:${bgSecondary}` : ''}
                      ${dayInfo.count > 0 && !dayInfo.isSelected ? 'bg-orange-500/10' : ''}
                    `}
                  >
                    <span className={`text-sm ${dayInfo.isSelected ? 'text-white' : textPrimary}`}>
                      {dayInfo.day}
                    </span>
                    {dayInfo.count > 0 && (
                      <span className={`absolute bottom-0.5 right-0.5 text-[9px] font-bold 
                        ${dayInfo.isSelected ? 'text-white/80' : 'text-orange-500'}`}>
                        {dayInfo.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              
              {/* Loading indicator */}
              {loading && (
                <div className={`text-center py-4 ${textSecondary} text-sm`}>Loading...</div>
              )}
            </div>
            
            {/* Tasks Side */}
            <div className="w-full md:w-64 p-4 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-[#6366f1]/20 flex items-center justify-center">
                  <span className="text-[#6366f1] text-sm font-semibold">
                    {selectedDev.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className={`font-medium text-sm ${textPrimary}`}>{selectedDev.name}</p>
                  <p className={`text-xs ${textSecondary}`}>
                    {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select a date'}
                  </p>
                </div>
              </div>
              
              {/* Tasks for selected date */}
              <div className={`flex-1 ${bgSecondary} rounded-lg p-3 mb-4 max-h-48 overflow-y-auto`}>
                {selectedDate ? (
                  dayTasks.length > 0 ? (
                    <div className="space-y-2">
                      <p className={`text-xs font-semibold ${textSecondary} mb-2`}>
                        {dayTasks.length} task{dayTasks.length > 1 ? 's' : ''} on this day:
                      </p>
                      {dayTasks.map((task, idx) => (
                        <div key={idx} className={`p-2 rounded-lg ${bgCard} border ${borderColor}`}>
                          <div className="flex items-start gap-2">
                            <FileText className="h-3.5 w-3.5 text-[#6366f1] mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className={`text-xs font-medium ${textPrimary} truncate`}>{task.page_name}</p>
                              <p className={`text-[10px] ${textSecondary} truncate`}>{task.project_name}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {task.assigned_stages?.map((s, i) => (
                                  <Badge key={i} variant="outline" className="text-[9px] px-1 py-0">{s}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`text-center py-6 ${textSecondary}`}>
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No tasks on this day</p>
                      <p className="text-[10px] mt-1">Great for assignment!</p>
                    </div>
                  )
                ) : (
                  <div className={`text-center py-6 ${textSecondary}`}>
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Select a date to view workload</p>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="space-y-2">
                <Button 
                  className="w-full bg-[#6366f1] hover:bg-[#4f46e5]"
                  onClick={handleAssign}
                  disabled={!selectedDate}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Assign to {selectedDev.name?.split(' ')[0]}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setStep(1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to Developers
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Footer info */}
        {step === 2 && selectedDate && dayTasks.length >= 3 && (
          <div className={`px-4 py-2 border-t ${borderColor} flex items-center gap-2 ${bgSecondary}`}>
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <span className={`text-xs ${textSecondary}`}>
              This developer has {dayTasks.length} tasks on this date. Consider choosing another day.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
