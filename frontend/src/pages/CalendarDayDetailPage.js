import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  ArrowLeft, Calendar, Clock, User, Briefcase, Timer,
  CheckCircle2, Circle, AlertCircle, Home, Building, Play, Pause, Square
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function CalendarDayDetailPage() {
  const { date } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dayData, setDayData] = useState(null);
  const [tasks, setTasks] = useState([]);
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#09090b]' : 'bg-gray-50';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const statusColors = {
    pending: 'bg-[#f59e0b]/20 text-[#f59e0b]',
    in_progress: 'bg-[#3b82f6]/20 text-[#3b82f6]',
    completed: 'bg-[#10b981]/20 text-[#10b981]',
    on_hold: 'bg-[#ef4444]/20 text-[#ef4444]'
  };

  const priorityColors = {
    high: 'bg-[#ef4444]/20 text-[#ef4444]',
    medium: 'bg-[#f59e0b]/20 text-[#f59e0b]',
    low: 'bg-[#10b981]/20 text-[#10b981]'
  };

  const loadDayData = useCallback(async () => {
    setLoading(true);
    try {
      // Load attendance detail for the date
      const attRes = await axios.get(`${API}/api/hr/attendance/date-detail/${date}`, { headers });
      setDayData(attRes.data);
      
      // Load tasks for this date
      const tasksRes = await axios.get(`${API}/api/bde/tasks/by-date/${date}`, { headers });
      setTasks(tasksRes.data.tasks || []);
    } catch (error) {
      console.error('Error loading day data:', error);
      toast.error('Failed to load day details');
    }
    setLoading(false);
  }, [date, token]);

  useEffect(() => {
    loadDayData();
  }, [loadDayData]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const dateObj = new Date(date);
  const isToday = new Date().toISOString().split('T')[0] === date;
  const isFuture = dateObj > new Date();
  const isPast = dateObj < new Date(new Date().setHours(0,0,0,0));

  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return (
    <Layout>
      <div className={`min-h-screen ${isDark ? 'bg-[#09090b]' : 'bg-gray-100'} p-6`}>
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => navigate('/hr')}
            className={`${borderColor}`}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Calendar
          </Button>
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>
              {formattedDate}
              {isToday && <Badge className="ml-3 bg-[#10b981]/20 text-[#10b981]">Today</Badge>}
              {isFuture && <Badge className="ml-3 bg-[#3b82f6]/20 text-[#3b82f6]">Upcoming</Badge>}
            </h1>
            <p className={`text-sm ${textSecondary}`}>
              {isFuture ? 'Upcoming tasks and schedule' : 'Attendance and task summary'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className={`text-center py-12 ${textSecondary}`}>Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Attendance Card - Only show for past/today dates */}
            {!isFuture && (
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardHeader className="pb-3">
                  <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                    <Clock className="h-5 w-5 text-[#6366f1]" />
                    Attendance Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dayData?.attendance ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className={`p-4 rounded-lg ${bgSecondary}`}>
                        <p className={`text-xs ${textSecondary} mb-1`}>Clock In</p>
                        <p className={`text-xl font-bold ${textPrimary}`}>
                          {formatTime(dayData.attendance.clock_in)}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg ${bgSecondary}`}>
                        <p className={`text-xs ${textSecondary} mb-1`}>Clock Out</p>
                        <p className={`text-xl font-bold ${textPrimary}`}>
                          {formatTime(dayData.attendance.clock_out) || 'Working...'}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg ${bgSecondary}`}>
                        <p className={`text-xs ${textSecondary} mb-1`}>Work Hours</p>
                        <p className={`text-xl font-bold ${textPrimary}`}>
                          {dayData.work_summary?.total_work_hours?.toFixed(1) || 0}h
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg ${bgSecondary}`}>
                        <p className={`text-xs ${textSecondary} mb-1`}>Work Mode</p>
                        <Badge className={dayData.attendance.work_mode === 'remote' 
                          ? 'bg-[#10b981]/20 text-[#10b981]' 
                          : 'bg-[#6366f1]/20 text-[#6366f1]'}>
                          {dayData.attendance.work_mode === 'remote' ? (
                            <><Home className="h-3 w-3 mr-1" /> WFH</>
                          ) : (
                            <><Building className="h-3 w-3 mr-1" /> Office</>
                          )}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className={`text-center py-8 ${textSecondary}`}>
                      <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No attendance record for this date</p>
                      {isPast && <p className="text-sm">This could be a leave or holiday</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tasks Card */}
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                    <Briefcase className="h-5 w-5 text-[#f59e0b]" />
                    {isFuture ? 'Upcoming Tasks' : 'Tasks Worked On'}
                  </CardTitle>
                  <Badge className={bgSecondary}>{tasks.length} Tasks</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className={`text-center py-8 ${textSecondary}`}>
                    <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>{isFuture ? 'No upcoming tasks scheduled' : 'No tasks worked on this day'}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map(task => (
                      <div 
                        key={task.task_id}
                        className={`p-4 rounded-lg ${bgSecondary} border ${borderColor} hover:border-[#6366f1] transition-colors`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className={`font-semibold ${textPrimary}`}>{task.task_name}</h3>
                            {task.description && (
                              <p className={`text-sm ${textSecondary} mt-1`}>{task.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Badge className={statusColors[task.status] || statusColors.pending}>
                              {task.status?.replace('_', ' ')}
                            </Badge>
                            <Badge className={priorityColors[task.priority] || priorityColors.medium}>
                              {task.priority}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className={textSecondary}>Type:</span>
                            <Badge variant="outline" className="ml-2">{task.type || 'General'}</Badge>
                          </div>
                          <div>
                            <span className={textSecondary}>Due:</span>
                            <span className={`ml-2 ${task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-[#ef4444]' : textPrimary}`}>
                              {task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN') : '-'}
                            </span>
                          </div>
                          <div>
                            <span className={textSecondary}>Created by:</span>
                            <span className={`ml-2 ${textPrimary}`}>{task.created_by_name || '-'}</span>
                          </div>
                          <div>
                            <span className={textSecondary}>Assigned to:</span>
                            <span className={`ml-2 ${textPrimary}`}>{task.assigned_to_name || '-'}</span>
                          </div>
                        </div>

                        {/* Time Tracking for this day */}
                        {task.day_seconds > 0 && (
                          <div className={`mt-3 pt-3 border-t border-dashed ${borderColor}`}>
                            <div className="flex items-center gap-2">
                              <Timer className="h-4 w-4 text-[#6366f1]" />
                              <span className={textSecondary}>Time spent on this day:</span>
                              <Badge className="bg-[#6366f1]/20 text-[#6366f1]">
                                {formatDuration(task.day_seconds)}
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* Timer status */}
                        {task.time_tracking?.status === 'running' && (
                          <div className="mt-3 flex items-center gap-2 text-[#10b981]">
                            <Play className="h-4 w-4 animate-pulse" />
                            <span className="text-sm">Timer running</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Day Summary Card */}
            {!isFuture && tasks.length > 0 && (
              <Card className={`${bgCard} border ${borderColor}`}>
                <CardHeader className="pb-3">
                  <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                    <AlertCircle className="h-5 w-5 text-[#10b981]" />
                    Day Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={`p-4 rounded-lg ${bgSecondary} text-center`}>
                      <p className={`text-3xl font-bold text-[#6366f1]`}>{tasks.length}</p>
                      <p className={`text-xs ${textSecondary}`}>Total Tasks</p>
                    </div>
                    <div className={`p-4 rounded-lg ${bgSecondary} text-center`}>
                      <p className={`text-3xl font-bold text-[#10b981]`}>
                        {tasks.filter(t => t.status === 'completed').length}
                      </p>
                      <p className={`text-xs ${textSecondary}`}>Completed</p>
                    </div>
                    <div className={`p-4 rounded-lg ${bgSecondary} text-center`}>
                      <p className={`text-3xl font-bold text-[#f59e0b]`}>
                        {tasks.filter(t => t.status === 'in_progress').length}
                      </p>
                      <p className={`text-xs ${textSecondary}`}>In Progress</p>
                    </div>
                    <div className={`p-4 rounded-lg ${bgSecondary} text-center`}>
                      <p className={`text-3xl font-bold text-[#3b82f6]`}>
                        {formatDuration(tasks.reduce((sum, t) => sum + (t.day_seconds || 0), 0))}
                      </p>
                      <p className={`text-xs ${textSecondary}`}>Total Time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
