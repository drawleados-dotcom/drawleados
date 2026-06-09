import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Plus, Calendar, Clock, User, CheckCircle2, Circle, 
  MoreHorizontal, Trash2, Edit2, X, AlertCircle, Briefcase,
  Play, Pause, Square, Timer, Eye, FileText, Tag, Users, Link, Filter, CalendarDays,
  Repeat
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import ApprovalsPage from './ApprovalsPage';

const API = process.env.REACT_APP_BACKEND_URL;

const priorityColors = {
  high: 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]',
  medium: 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]',
  low: 'bg-[#71717a]/20 text-[#71717a] border-[#71717a]'
};

const statusColors = {
  'pending': 'bg-[#71717a]/20 text-[#71717a]',
  'in_progress': 'bg-[#3b82f6]/20 text-[#3b82f6]',
  'completed': 'bg-[#10b981]/20 text-[#10b981]',
  'on_hold': 'bg-[#f59e0b]/20 text-[#f59e0b]'
};

export default function OurTasksPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('all');
  const [mainTab, setMainTab] = useState('assigned_to_me'); // assigned_to_me, assign_to_team
  const [viewingTask, setViewingTask] = useState(null);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [runningTimers, setRunningTimers] = useState({});
  const [editingTimeRow, setEditingTimeRow] = useState(null); // task_id currently in row-edit mode
  const [timeDrafts, setTimeDrafts] = useState({}); // {task_id: {start: 'HH:MM', end: 'HH:MM'}}
  const [showFilters, setShowFilters] = useState(true); // Show filters by default
  
  // Advanced filters
  const [filters, setFilters] = useState({
    dateFilter: 'all', // all, today, range - default to all
    dateFrom: '',
    dateTo: '',
    assignedTo: 'all', // all, myself, or user_id
    assignedBy: 'all', // all or user_id
    taskType: 'all', // all, general, meeting, follow_up, proposal, call
    status: 'all', // all, pending, in_progress, completed, on_hold
    singleDate: '' // for single date filter
  });
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const hoverBg = isDark ? 'hover:bg-[#3f3f46]' : 'hover:bg-gray-200';

  // Form state
  const [formData, setFormData] = useState({
    task_name: '',
    description: '',
    priority: 'medium',
    type: 'general',
    assigned_to: '',
    due_date: '',
    due_time: '',
    all_day: false,
    recurrence: 'none', // none, daily, weekly, monthly, yearly, weekdays, custom
    custom_recurrence: {
      repeat_every: 1,
      repeat_unit: 'week', // day, week, month, year
      repeat_on_days: [], // [0,1,2,3,4,5,6] for Sun-Sat
      ends: 'never', // never, on_date, after_occurrences
      end_date: '',
      occurrences: 13
    },
    status: 'pending',
    work_link: ''
  });
  
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);

  // Load tasks
  const loadTasks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/our-tasks/tasks`, { headers });
      setTasks(res.data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
    setLoading(false);
  }, []);

  // Load users for assignment
  const loadUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/users/basic`, { headers });
      setUsers(res.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, [loadTasks, loadUsers]);

  // Create task
  const handleCreateTask = async () => {
    if (!formData.task_name.trim()) {
      toast.error('Task name is required');
      return;
    }
    // Require due_date when recurrence is set
    if (formData.recurrence && formData.recurrence !== 'none' && !formData.due_date) {
      toast.error('Start date is required for recurring tasks');
      return;
    }
    try {
      await axios.post(`${API}/api/our-tasks/tasks`, formData, { headers });
      toast.success('Task created successfully');
      setShowCreateModal(false);
      resetForm();
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create task');
    }
  };

  // Update task
  const handleUpdateTask = async () => {
    if (!formData.task_name.trim()) {
      toast.error('Task name is required');
      return;
    }
    // Require due_date when recurrence is set
    if (formData.recurrence && formData.recurrence !== 'none' && !formData.due_date) {
      toast.error('Start date is required for recurring tasks');
      return;
    }
    try {
      await axios.put(`${API}/api/our-tasks/tasks/${editingTask.task_id}`, formData, { headers });
      toast.success('Task updated successfully');
      setEditingTask(null);
      resetForm();
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update task');
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await axios.delete(`${API}/api/our-tasks/tasks/${taskId}`, { headers });
      toast.success('Task deleted');
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete task');
    }
  };

  // Update task status
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await axios.patch(`${API}/api/our-tasks/tasks/${taskId}/status`, { status: newStatus }, { headers });
      toast.success('Status updated');
      loadTasks();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Time tracking actions
  const handleTimeTracking = async (taskId, action) => {
    try {
      const res = await axios.post(`${API}/api/our-tasks/tasks/${taskId}/time`, { action }, { headers });
      toast.success(res.data.message);
      loadTasks();
      
      // Update running timers
      if (action === 'start' || action === 'resume') {
        setRunningTimers(prev => ({ ...prev, [taskId]: Date.now() }));
      } else {
        setRunningTimers(prev => {
          const { [taskId]: removed, ...rest } = prev;
          return rest;
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action} timer`);
    }
  };

  // Format seconds to readable time
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Format ISO datetime to short time string (e.g. "10:30 AM")
  const formatTimeOnly = (iso) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      return '-';
    }
  };

  // Pick the most relevant start/end from a task's timer sessions
  // If a date is selected via the filter, restrict to sessions that started on that date.
  const getTaskStartEnd = (task) => {
    const sessions = task?.time_tracking?.sessions || [];
    if (sessions.length === 0) return { start: null, end: null, running: false };

    const targetDate = filters.dateFilter === 'single' && filters.singleDate ? filters.singleDate : null;
    const matchesDate = (iso) => {
      if (!targetDate) return true;
      if (!iso) return false;
      return iso.slice(0, 10) === targetDate;
    };

    const relevant = sessions.filter(s => matchesDate(s.start));
    const list = relevant.length > 0 ? relevant : sessions;

    const first = list[0];
    const last = list[list.length - 1];
    const running = !last.end;
    return { start: first.start, end: last.end, running };
  };

  // Extract HH:MM (24h) from an ISO timestamp for use in <input type="time">
  const toTimeInputValue = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch {
      return '';
    }
  };

  // Save inline time edit (single field) — kept for potential future use
  // Save BOTH start and end time for a row (triggered by row-level Save button)
  const handleSaveTimeRow = async (taskId) => {
    const draft = timeDrafts[taskId];
    if (!draft || (!draft.start && !draft.end)) {
      toast.error('Enter Start Time and End Time first');
      return;
    }
    try {
      const task = tasks.find(t => t.task_id === taskId);
      const { start, end } = getTaskStartEnd(task);
      const anchorIso = start || end;
      const payload = {};
      if (draft.start) payload.start_time = draft.start;
      if (draft.end) payload.end_time = draft.end;
      if (anchorIso) payload.date = anchorIso.slice(0, 10);
      else payload.date = new Date().toISOString().slice(0, 10);
      await axios.patch(`${API}/api/our-tasks/tasks/${taskId}/time-edit`, payload, { headers });
      toast.success('Time saved');
      setEditingTimeRow(null);
      setTimeDrafts(prev => {
        const { [taskId]: _, ...rest } = prev;
        return rest;
      });
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save time');
    }
  };

  // Get time tracking button based on status
  // For "Assign to Team" tab: only show status, no action buttons
  // Replace play/pause/finish controls with a simple Edit ↔ Save toggle.
  // Edit puts BOTH the Start Time and End Time cells of the row into edit mode.
  // Save commits the times and recomputes total duration on the backend.
  const getTimeTrackingButton = (task, isTeamView = false) => {
    const tracking = task.time_tracking || { status: 'not_started', total_seconds: 0 };
    const status = tracking.status;

    // Team view — read-only status pill, no edit
    if (isTeamView) {
      if (status === 'finished') {
        return (
          <Badge className="bg-[#10b981]/20 text-[#10b981]">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Done
          </Badge>
        );
      }
      if (status === 'running' || status === 'paused') {
        return (
          <Badge className="bg-[#3b82f6]/20 text-[#3b82f6]">
            <Timer className="h-3 w-3 mr-1" /> {formatDuration(tracking.total_seconds || 0)}
          </Badge>
        );
      }
      return (
        <Badge className="bg-[#71717a]/20 text-[#71717a]">
          <Circle className="h-3 w-3 mr-1" /> Not Started
        </Badge>
      );
    }

    const isEditingRow = editingTimeRow === task.task_id;

    if (isEditingRow) {
      return (
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() => handleSaveTimeRow(task.task_id)}
            className="bg-[#10b981] hover:bg-[#059669] text-white h-8 px-3"
            data-testid={`time-save-btn-${task.task_id}`}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingTimeRow(null);
              setTimeDrafts(prev => {
                const { [task.task_id]: _, ...rest } = prev;
                return rest;
              });
            }}
            className="h-8 px-3"
            data-testid={`time-cancel-btn-${task.task_id}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <Button
        size="sm"
        onClick={() => {
          const { start, end } = getTaskStartEnd(task);
          setTimeDrafts(prev => ({
            ...prev,
            [task.task_id]: {
              start: toTimeInputValue(start),
              end: toTimeInputValue(end),
            }
          }));
          setEditingTimeRow(task.task_id);
        }}
        className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-8 px-3"
        data-testid={`time-edit-btn-${task.task_id}`}
      >
        <Edit2 className="h-3 w-3 mr-1" /> Edit
      </Button>
    );
  };

  // Helper function to get recurrence label
  const getRecurrenceLabel = (task) => {
    const recurrence = task?.recurrence || 'none';
    if (recurrence === 'none') return 'One-time';
    if (recurrence === 'daily') return 'Daily';
    if (recurrence === 'weekly') return 'Weekly';
    if (recurrence === 'monthly') return 'Monthly';
    if (recurrence === 'yearly') return 'Yearly';
    if (recurrence === 'weekdays') return 'Weekdays (Mon-Fri)';
    if (recurrence === 'custom') {
      const customRec = task?.custom_recurrence || {};
      const repeatEvery = customRec.repeat_every || 1;
      const repeatUnit = customRec.repeat_unit || 'week';
      const repeatOnDays = customRec.repeat_on_days || [];
      
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      if (repeatOnDays.length > 0) {
        const daysStr = repeatOnDays.sort((a, b) => a - b).map(d => dayNames[d]).join(', ');
        if (repeatEvery === 1) {
          return `Every ${daysStr}`;
        }
        return `Every ${repeatEvery} ${repeatUnit}s on ${daysStr}`;
      }
      if (repeatEvery === 1) {
        return `Every ${repeatUnit}`;
      }
      return `Every ${repeatEvery} ${repeatUnit}s`;
    }
    return 'Unknown';
  };

  const resetForm = () => {
    setFormData({
      task_name: '',
      description: '',
      priority: 'medium',
      type: 'general',
      assigned_to: '',
      due_date: '',
      due_time: '',
      all_day: false,
      recurrence: 'none',
      custom_recurrence: {
        repeat_every: 1,
        repeat_unit: 'week',
        repeat_on_days: [],
        ends: 'never',
        end_date: '',
        occurrences: 13
      },
      status: 'pending',
      work_link: ''
    });
    setShowCustomRecurrence(false);
  };

  const openEditModal = (task) => {
    setFormData({
      task_name: task.task_name,
      description: task.description || '',
      priority: task.priority,
      type: task.type || 'general',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
      due_time: task.due_time || '',
      all_day: task.all_day || false,
      recurrence: task.recurrence || 'none',
      custom_recurrence: task.custom_recurrence || {
        repeat_every: 1,
        repeat_unit: 'week',
        repeat_on_days: [],
        ends: 'never',
        end_date: '',
        occurrences: 13
      },
      status: task.status,
      work_link: task.work_link || ''
    });
    setEditingTask(task);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Helper to get today's date string
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Filter tasks with advanced filters
  // Helper function to check if a recurring task occurs on a specific date
  const taskOccursOnDate = (task, checkDate) => {
    const recurrence = task.recurrence || 'none';
    if (recurrence === 'none' || !recurrence) {
      return task.due_date === checkDate;
    }
    
    const startDateStr = task.due_date;
    if (!startDateStr) return false;
    
    try {
      const startDate = new Date(startDateStr);
      const targetDate = new Date(checkDate);
      
      // Task hasn't started yet
      if (targetDate < startDate) return false;
      
      // Check end conditions for custom recurrence
      const customRec = task.custom_recurrence || {};
      const ends = customRec.ends || 'never';
      
      if (ends === 'on_date' && customRec.end_date) {
        const endDate = new Date(customRec.end_date);
        if (targetDate > endDate) return false;
      }
      
      const targetDayOfWeek = targetDate.getDay(); // 0=Sun, 6=Sat
      
      if (recurrence === 'daily') {
        return true;
      } else if (recurrence === 'weekly') {
        return startDate.getDay() === targetDate.getDay();
      } else if (recurrence === 'monthly') {
        return startDate.getDate() === targetDate.getDate();
      } else if (recurrence === 'yearly') {
        return startDate.getMonth() === targetDate.getMonth() && startDate.getDate() === targetDate.getDate();
      } else if (recurrence === 'weekdays') {
        return targetDayOfWeek >= 1 && targetDayOfWeek <= 5; // Mon-Fri
      } else if (recurrence === 'custom') {
        const repeatUnit = customRec.repeat_unit || 'week';
        const repeatEvery = customRec.repeat_every || 1;
        const repeatOnDays = customRec.repeat_on_days || [];
        
        if (repeatUnit === 'day') {
          const daysDiff = Math.floor((targetDate - startDate) / (1000 * 60 * 60 * 24));
          return daysDiff >= 0 && daysDiff % repeatEvery === 0;
        } else if (repeatUnit === 'week') {
          // Check if day of week matches
          if (repeatOnDays.length > 0) {
            if (!repeatOnDays.includes(targetDayOfWeek)) return false;
          }
          // Check week interval
          if (repeatEvery > 1) {
            const weeksDiff = Math.floor((targetDate - startDate) / (1000 * 60 * 60 * 24 * 7));
            return weeksDiff % repeatEvery === 0;
          }
          return true;
        } else if (repeatUnit === 'month') {
          const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 + (targetDate.getMonth() - startDate.getMonth());
          return monthsDiff >= 0 && monthsDiff % repeatEvery === 0 && startDate.getDate() === targetDate.getDate();
        } else if (repeatUnit === 'year') {
          const yearsDiff = targetDate.getFullYear() - startDate.getFullYear();
          return yearsDiff >= 0 && yearsDiff % repeatEvery === 0 && startDate.getMonth() === targetDate.getMonth() && startDate.getDate() === targetDate.getDate();
        }
      }
      
      return false;
    } catch (e) {
      return false;
    }
  };

  const filteredTasks = tasks.filter(task => {
    // Main Tab filter - Assigned to Me vs Assign to Team
    if (mainTab === 'assigned_to_me') {
      // Tasks assigned to me (by others) OR tasks I created for myself
      if (!(task.assigned_to === user?.user_id)) return false;
    } else if (mainTab === 'assign_to_team') {
      // Tasks I created and assigned to others (not myself)
      if (!(task.created_by === user?.user_id && task.assigned_to !== user?.user_id)) return false;
    }
    
    // Quick filter (tabs)
    if (filter === 'my' && !(task.created_by === user?.user_id || task.assigned_to === user?.user_id)) return false;
    if (filter !== 'all' && filter !== 'my' && task.status !== filter) return false;
    
    // Date filter
    if (filters.dateFilter === 'today') {
      const today = getTodayString();
      // Check both direct due_date match and recurring instances
      if (!taskOccursOnDate(task, today)) {
        const taskDate = task.due_date || task.created_at?.split('T')[0];
        if (taskDate !== today) return false;
      }
    } else if (filters.dateFilter === 'single' && filters.singleDate) {
      // Check both direct due_date match and recurring instances
      if (!taskOccursOnDate(task, filters.singleDate)) {
        const taskDate = task.due_date || task.created_at?.split('T')[0];
        if (taskDate !== filters.singleDate) return false;
      }
    } else if (filters.dateFilter === 'range' && (filters.dateFrom || filters.dateTo)) {
      const taskDate = task.due_date || task.created_at?.split('T')[0];
      if (filters.dateFrom && taskDate < filters.dateFrom) return false;
      if (filters.dateTo && taskDate > filters.dateTo) return false;
    }
    
    // Assigned To filter
    if (filters.assignedTo === 'myself' && task.assigned_to !== user?.user_id) return false;
    if (filters.assignedTo !== 'all' && filters.assignedTo !== 'myself' && task.assigned_to !== filters.assignedTo) return false;
    
    // Assigned By filter
    if (filters.assignedBy !== 'all' && task.assigned_by !== filters.assignedBy) return false;
    
    // Type filter
    if (filters.taskType !== 'all' && task.type !== filters.taskType) return false;
    
    // Status filter (from advanced filters)
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    
    return true;
  });

  // Reset filters
  const resetFilters = () => {
    setFilters({
      dateFilter: 'all',
      dateFrom: '',
      dateTo: '',
      singleDate: '',
      assignedTo: 'all',
      assignedBy: 'all',
      taskType: 'all',
      status: 'all'
    });
  };

  // Stats - based on main tab
  const assignedToMeTasks = tasks.filter(t => t.assigned_to === user?.user_id && t.created_by !== user?.user_id);
  const assignedToTeamTasks = tasks.filter(t => t.created_by === user?.user_id && t.assigned_to !== user?.user_id);
  const myOwnTasks = tasks.filter(t => t.created_by === user?.user_id && t.assigned_to === user?.user_id);
  
  const currentTabTasks = mainTab === 'assigned_to_me' 
    ? [...assignedToMeTasks, ...myOwnTasks.filter(t => t.assigned_to === user?.user_id)]
    : assignedToTeamTasks;
  
  const stats = {
    total: currentTabTasks.length,
    pending: currentTabTasks.filter(t => t.status === 'pending').length,
    in_progress: currentTabTasks.filter(t => t.status === 'in_progress').length,
    completed: currentTabTasks.filter(t => t.status === 'completed').length
  };

  // Compute total work seconds for the currently selected date filter.
  // - "single" date selected: sum session durations whose start matches that date
  // - "today": sum sessions started today
  // - "range": sum sessions started within [dateFrom, dateTo]
  // - "all": fall back to sum of total_seconds across filtered tasks
  const computeWorkSeconds = () => {
    const sessionDate = (iso) => (iso ? iso.slice(0, 10) : '');
    const today = new Date().toISOString().slice(0, 10);

    const inRange = (iso) => {
      const d = sessionDate(iso);
      if (!d) return false;
      if (filters.dateFilter === 'single') return d === filters.singleDate;
      if (filters.dateFilter === 'today') return d === today;
      if (filters.dateFilter === 'range') {
        if (filters.dateFrom && d < filters.dateFrom) return false;
        if (filters.dateTo && d > filters.dateTo) return false;
        return true;
      }
      return true; // all time
    };

    let totalSeconds = 0;
    filteredTasks.forEach(task => {
      const sessions = task?.time_tracking?.sessions || [];
      if (sessions.length === 0) {
        if (filters.dateFilter === 'all') {
          totalSeconds += task?.time_tracking?.total_seconds || 0;
        }
        return;
      }
      sessions.forEach(s => {
        if (!inRange(s.start)) return;
        if (s.duration_seconds) {
          totalSeconds += s.duration_seconds;
        } else if (s.start && !s.end) {
          // running session — count time up to now
          const startMs = new Date(s.start).getTime();
          if (!isNaN(startMs)) totalSeconds += Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        }
      });
    });
    return totalSeconds;
  };
  const totalWorkSeconds = computeWorkSeconds();
  const workTimeLabel = filters.dateFilter === 'single' && filters.singleDate
    ? `Work on ${filters.singleDate}`
    : filters.dateFilter === 'today'
      ? 'Work Today'
      : filters.dateFilter === 'range'
        ? 'Work in Range'
        : 'Total Work Time';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>Operations</h1>
            <p className={textSecondary}>Team-wide task management for all users</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="bg-[#6366f1] hover:bg-[#4f46e5]">
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </div>

        {/* Main Tabs - Assigned to Me / Assign to Team */}
        <div className="flex gap-4 border-b border-gray-700 pb-2">
          <button
            onClick={() => { setMainTab('assigned_to_me'); setFilter('all'); }}
            className={`px-4 py-2 font-medium transition-all ${
              mainTab === 'assigned_to_me' 
                ? 'text-[#6366f1] border-b-2 border-[#6366f1]' 
                : `${textSecondary} hover:text-[#6366f1]`
            }`}
          >
            <User className="h-4 w-4 inline mr-2" />
            My Tasks ({assignedToMeTasks.length + myOwnTasks.length})
          </button>
          <button
            onClick={() => { setMainTab('assign_to_team'); setFilter('all'); }}
            className={`px-4 py-2 font-medium transition-all ${
              mainTab === 'assign_to_team' 
                ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6]' 
                : `${textSecondary} hover:text-[#8b5cf6]`
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Assign to Team ({assignedToTeamTasks.length})
          </button>
          <button
            onClick={() => setMainTab('approvals')}
            data-testid="ops-tab-approvals"
            className={`px-4 py-2 font-medium transition-all ${
              mainTab === 'approvals'
                ? 'text-[#f59e0b] border-b-2 border-[#f59e0b]'
                : `${textSecondary} hover:text-[#f59e0b]`
            }`}
          >
            <CheckCircle2 className="h-4 w-4 inline mr-2" />
            Approvals
          </button>
        </div>

        {/* Approvals tab — embed the dedicated page */}
        {mainTab === 'approvals' && (
          <div data-testid="ops-approvals-panel">
            <ApprovalsPage embedded />
          </div>
        )}

        {mainTab !== 'approvals' && (
        <>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${textSecondary}`}>Total Tasks</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{stats.total}</p>
                </div>
                <Briefcase className="h-8 w-8 text-[#6366f1]" />
              </div>
            </CardContent>
          </Card>
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${textSecondary}`}>Pending</p>
                  <p className={`text-2xl font-bold text-[#71717a]`}>{stats.pending}</p>
                </div>
                <Circle className="h-8 w-8 text-[#71717a]" />
              </div>
            </CardContent>
          </Card>
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${textSecondary}`}>In Progress</p>
                  <p className={`text-2xl font-bold text-[#3b82f6]`}>{stats.in_progress}</p>
                </div>
                <Clock className="h-8 w-8 text-[#3b82f6]" />
              </div>
            </CardContent>
          </Card>
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${textSecondary}`}>Completed</p>
                  <p className={`text-2xl font-bold text-[#10b981]`}>{stats.completed}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-[#10b981]" />
              </div>
            </CardContent>
          </Card>
          <Card className={`${bgCard} border ${borderColor}`} data-testid="work-time-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${textSecondary}`}>{workTimeLabel}</p>
                  <p className={`text-2xl font-bold text-[#8b5cf6]`}>{formatDuration(totalWorkSeconds)}</p>
                </div>
                <Timer className="h-8 w-8 text-[#8b5cf6]" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs & Advanced Filters */}
        <div className="space-y-4">
          <div className="flex gap-2 justify-between items-center flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {['all', 'my', 'pending', 'in_progress', 'completed'].map(f => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-[#6366f1]' : ''}
                >
                  {f === 'all' ? 'All' : f === 'my' ? 'My Tasks' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-[#6366f1] text-white' : ''}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {/* Date Filter */}
                  <div>
                    <Label className={`text-xs ${textSecondary}`}>Date</Label>
                    <Select value={filters.dateFilter} onValueChange={(v) => setFilters({...filters, dateFilter: v})}>
                      <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="single">Single Date</SelectItem>
                        <SelectItem value="range">Date Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Single Date Picker */}
                  {filters.dateFilter === 'single' && (
                    <div>
                      <Label className={`text-xs ${textSecondary}`}>Select Date</Label>
                      <Input
                        type="date"
                        value={filters.singleDate || ''}
                        onChange={(e) => setFilters({...filters, singleDate: e.target.value})}
                        className={`h-9 ${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                  )}

                  {/* Date Range */}
                  {filters.dateFilter === 'range' && (
                    <>
                      <div>
                        <Label className={`text-xs ${textSecondary}`}>From</Label>
                        <Input
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                          className={`h-9 ${bgSecondary} border ${borderColor}`}
                        />
                      </div>
                      <div>
                        <Label className={`text-xs ${textSecondary}`}>To</Label>
                        <Input
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                          className={`h-9 ${bgSecondary} border ${borderColor}`}
                        />
                      </div>
                    </>
                  )}

                  {/* Assigned To */}
                  <div>
                    <Label className={`text-xs ${textSecondary}`}>Assigned To</Label>
                    <Select value={filters.assignedTo} onValueChange={(v) => setFilters({...filters, assignedTo: v})}>
                      <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="myself">Myself</SelectItem>
                        {users.map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assigned By */}
                  <div>
                    <Label className={`text-xs ${textSecondary}`}>Assigned By</Label>
                    <Select value={filters.assignedBy} onValueChange={(v) => setFilters({...filters, assignedBy: v})}>
                      <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="all">All</SelectItem>
                        {users.map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Task Type */}
                  <div>
                    <Label className={`text-xs ${textSecondary}`}>Type</Label>
                    <Select value={filters.taskType} onValueChange={(v) => setFilters({...filters, taskType: v})}>
                      <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="call">Call</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div>
                    <Label className={`text-xs ${textSecondary}`}>Status</Label>
                    <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                      <SelectTrigger className={`h-9 ${bgSecondary} border ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Reset Filters */}
                <div className="flex justify-end mt-4">
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Reset Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tasks Table */}
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={bgSecondary}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Task</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Status</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Created / Assigned</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Due Date</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Link</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Time</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Start Time</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>End Time</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Timer</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-200'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className={`px-4 py-8 text-center ${textSecondary}`}>Loading...</td>
                    </tr>
                  ) : filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={10} className={`px-4 py-8 text-center ${textSecondary}`}>
                        <Briefcase className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                        <p>No tasks found</p>
                        <p className="text-sm">
                          {filters.dateFilter === 'today' ? 'No tasks for today' : 
                           filters.dateFilter === 'single' && filters.singleDate ? `No tasks for ${filters.singleDate}` :
                           'Create a new task to get started'}
                        </p>
                      </td>
                    </tr>
                  ) : filteredTasks.map(task => (
                    <tr 
                      key={task.task_id} 
                      className={`${bgCard} hover:${bgSecondary} cursor-pointer transition-colors`}
                      onClick={() => { setViewingTask(task); setShowTaskDetailModal(true); }}
                    >
                      <td className={`px-4 py-3`}>
                        <div className={`font-medium ${textPrimary}`}>{task.task_name}</div>
                        {task.description && (
                          <div className={`text-xs ${textSecondary} truncate max-w-xs`}>{task.description}</div>
                        )}
                        <div className={`text-xs ${textSecondary} mt-1`}>
                          <Badge className="text-xs" variant="outline">{task.type || 'General'}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={statusColors[task.status] || statusColors.pending}>
                          {task.status?.replace('_', ' ') || 'Pending'}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 text-sm`}>
                        <div className="space-y-1">
                          {/* Show if created by them or assigned to them */}
                          {task.created_by === user?.user_id ? (
                            <div>
                              <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs mb-1">Created by you</Badge>
                              <p className={`text-xs ${textSecondary}`}>{formatDate(task.created_at)}</p>
                            </div>
                          ) : task.assigned_to === user?.user_id ? (
                            <div>
                              <Badge className="bg-[#10b981]/20 text-[#10b981] text-xs mb-1">Assigned to you</Badge>
                              <p className={`text-xs ${textSecondary}`}>by {task.assigned_by_name || task.created_by_name || 'Unknown'}</p>
                            </div>
                          ) : (
                            <div>
                              <p className={`${textPrimary}`}>{task.created_by_name || '-'}</p>
                              {task.assigned_to_name && (
                                <p className={`text-xs ${textSecondary}`}>→ {task.assigned_to_name}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-sm`}>
                        {task.due_date ? (
                          <div>
                            <span className={new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-[#ef4444]' : textPrimary}>
                              {formatDate(task.due_date)}
                            </span>
                            {task.due_time && (
                              <span className={`text-xs ${textSecondary} ml-1`}>at {task.due_time}</span>
                            )}
                            {/* Recurrence indicator */}
                            {task.recurrence && task.recurrence !== 'none' && (
                              <div className="flex items-center gap-1 mt-1">
                                <Repeat className="h-3 w-3 text-[#6366f1]" />
                                <span className="text-[10px] text-[#6366f1]">
                                  {task.recurrence_label || getRecurrenceLabel(task)}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className={textSecondary}>-</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {task.work_link ? (
                          <a 
                            href={task.work_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#3b82f6] hover:text-[#2563eb]"
                          >
                            <Link className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className={textSecondary}>-</span>
                        )}
                      </td>
                      <td className={`px-4 py-3`}>
                        <div className="flex items-center gap-2">
                          <Timer className={`h-4 w-4 ${task.time_tracking?.status === 'running' ? 'text-[#10b981] animate-pulse' : textSecondary}`} />
                          <span className={`text-sm font-medium ${textPrimary}`}>
                            {formatDuration(task.time_tracking?.total_seconds || 0)}
                          </span>
                        </div>
                        {task.time_tracking?.status === 'running' && (
                          <div className="text-xs text-[#10b981] mt-1">Running...</div>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm`} data-testid={`start-time-${task.task_id}`} onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const { start } = getTaskStartEnd(task);
                          const isEditingRow = editingTimeRow === task.task_id;
                          if (isEditingRow) {
                            return (
                              <input
                                type="time"
                                value={timeDrafts[task.task_id]?.start || ''}
                                onChange={(e) => setTimeDrafts(prev => ({
                                  ...prev,
                                  [task.task_id]: { ...(prev[task.task_id] || {}), start: e.target.value }
                                }))}
                                className={`w-24 px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                                data-testid={`start-time-input-${task.task_id}`}
                              />
                            );
                          }
                          return start ? (
                            <span className={textPrimary}>{formatTimeOnly(start)}</span>
                          ) : (
                            <span className={textSecondary}>—</span>
                          );
                        })()}
                      </td>
                      <td className={`px-4 py-3 text-sm`} data-testid={`end-time-${task.task_id}`} onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const { end, running } = getTaskStartEnd(task);
                          const isEditingRow = editingTimeRow === task.task_id;
                          if (isEditingRow) {
                            return (
                              <input
                                type="time"
                                value={timeDrafts[task.task_id]?.end || ''}
                                onChange={(e) => setTimeDrafts(prev => ({
                                  ...prev,
                                  [task.task_id]: { ...(prev[task.task_id] || {}), end: e.target.value }
                                }))}
                                className={`w-24 px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                                data-testid={`end-time-input-${task.task_id}`}
                              />
                            );
                          }
                          if (running) {
                            return <span className="text-[#10b981] text-xs font-medium">Running</span>;
                          }
                          return end ? (
                            <span className={textPrimary}>{formatTimeOnly(end)}</span>
                          ) : (
                            <span className={textSecondary}>—</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {getTimeTrackingButton(task, mainTab === 'assign_to_team')}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[#6366f1]"
                            onClick={(e) => { e.stopPropagation(); setViewingTask(task); setShowTaskDetailModal(true); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditModal(task); }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.task_id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </>
        )}

        {/* Create/Edit Task Modal */}
        {(showCreateModal || editingTask) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                    <Briefcase className="h-5 w-5 text-[#6366f1]" />
                    {editingTask ? 'Edit Task' : 'Create New Task'}
                  </CardTitle>
                  <button onClick={() => { setShowCreateModal(false); setEditingTask(null); resetForm(); }} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className={textPrimary}>Task Name *</Label>
                  <Input
                    value={formData.task_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, task_name: e.target.value }))}
                    placeholder="Enter task name"
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Task description"
                    rows={3}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Priority</Label>
                    <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={textPrimary}>Type</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="call">Call</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className={textPrimary}>Assign To</Label>
                    <Select value={formData.assigned_to} onValueChange={(v) => setFormData(prev => ({ ...prev, assigned_to: v }))}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        {users.map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={textPrimary}>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={bgCard}>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Google Calendar Style Date & Time */}
                <div className={`p-4 rounded-lg border ${borderColor} ${bgSecondary} space-y-4`}>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#6366f1]" />
                    <span className={`text-sm font-medium ${textPrimary}`}>Date & Time</span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Date Picker */}
                    <div className="flex-1 min-w-[140px]">
                      <Input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                        className={`${isDark ? 'bg-[#18181b]' : 'bg-white'} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    
                    {/* Time Picker - Hidden if All Day */}
                    {!formData.all_day && (
                      <div className="w-[110px]">
                        <Input
                          type="time"
                          value={formData.due_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, due_time: e.target.value }))}
                          className={`${isDark ? 'bg-[#18181b]' : 'bg-white'} border ${borderColor} ${textPrimary}`}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* All Day Checkbox */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="all_day"
                      checked={formData.all_day}
                      onChange={(e) => setFormData(prev => ({ ...prev, all_day: e.target.checked, due_time: '' }))}
                      className="h-4 w-4 rounded border-gray-300 text-[#6366f1] focus:ring-[#6366f1]"
                    />
                    <Label htmlFor="all_day" className={`text-sm ${textSecondary} cursor-pointer`}>All day</Label>
                  </div>

                  {/* Recurrence Dropdown */}
                  <div>
                    <div className="flex items-center gap-2">
                      <Select 
                        value={formData.recurrence} 
                        onValueChange={(v) => {
                          if (v === 'custom' || v === 'edit_custom') {
                            setShowCustomRecurrence(true);
                          } else {
                            setFormData(prev => ({ ...prev, recurrence: v }));
                          }
                        }}
                      >
                        <SelectTrigger className={`${isDark ? 'bg-[#18181b]' : 'bg-white'} border ${borderColor}`}>
                          <SelectValue placeholder="Does not repeat">
                            {formData.recurrence === 'custom' ? getRecurrenceLabel(formData) : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className={bgCard}>
                          <SelectItem value="none">Does not repeat</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">
                            Weekly on {formData.due_date ? new Date(formData.due_date).toLocaleDateString('en-US', { weekday: 'long' }) : 'selected day'}
                          </SelectItem>
                          <SelectItem value="monthly">
                            Monthly on the {formData.due_date ? new Date(formData.due_date).getDate() : 'selected date'}
                          </SelectItem>
                          <SelectItem value="yearly">
                            Annually on {formData.due_date ? new Date(formData.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'selected date'}
                          </SelectItem>
                          <SelectItem value="weekdays">Every weekday (Monday to Friday)</SelectItem>
                          <SelectItem value="custom">Custom...</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Edit Custom button when custom is selected */}
                      {formData.recurrence === 'custom' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCustomRecurrence(true)}
                          className={`${borderColor} text-[#6366f1]`}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                    
                    {/* Show current custom recurrence summary */}
                    {formData.recurrence === 'custom' && formData.custom_recurrence && (
                      <p className="text-xs text-[#6366f1] mt-1">
                        {getRecurrenceLabel(formData)}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label className={textPrimary}>Work Link (File/Project URL)</Label>
                  <Input
                    value={formData.work_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, work_link: e.target.value }))}
                    placeholder="https://docs.google.com/... or project URL"
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowCreateModal(false); setEditingTask(null); resetForm(); }} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={editingTask ? handleUpdateTask : handleCreateTask} className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5]">
                    {editingTask ? 'Update Task' : 'Create Task'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Custom Recurrence Modal */}
        {showCustomRecurrence && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={textPrimary}>Custom recurrence</CardTitle>
                  <button onClick={() => setShowCustomRecurrence(false)} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Repeat Every */}
                <div className="flex items-center gap-3">
                  <span className={textSecondary}>Repeat every</span>
                  <Input
                    type="number"
                    min="1"
                    value={formData.custom_recurrence.repeat_every}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      custom_recurrence: { ...prev.custom_recurrence, repeat_every: parseInt(e.target.value) || 1 }
                    }))}
                    className={`w-16 ${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                  <Select 
                    value={formData.custom_recurrence.repeat_unit}
                    onValueChange={(v) => setFormData(prev => ({
                      ...prev,
                      custom_recurrence: { ...prev.custom_recurrence, repeat_unit: v }
                    }))}
                  >
                    <SelectTrigger className={`w-24 ${bgSecondary} border ${borderColor}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={bgCard}>
                      <SelectItem value="day">day</SelectItem>
                      <SelectItem value="week">week</SelectItem>
                      <SelectItem value="month">month</SelectItem>
                      <SelectItem value="year">year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Repeat on (for weekly) */}
                {formData.custom_recurrence.repeat_unit === 'week' && (
                  <div>
                    <span className={`text-sm ${textSecondary}`}>Repeat on</span>
                    <div className="flex gap-2 mt-2">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            const days = formData.custom_recurrence.repeat_on_days.includes(idx)
                              ? formData.custom_recurrence.repeat_on_days.filter(d => d !== idx)
                              : [...formData.custom_recurrence.repeat_on_days, idx];
                            setFormData(prev => ({
                              ...prev,
                              custom_recurrence: { ...prev.custom_recurrence, repeat_on_days: days }
                            }));
                          }}
                          className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                            formData.custom_recurrence.repeat_on_days.includes(idx)
                              ? 'bg-[#6366f1] text-white'
                              : `${bgSecondary} ${textSecondary} ${hoverBg}`
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ends */}
                <div className="space-y-3">
                  <span className={`text-sm ${textSecondary}`}>Ends</span>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="ends"
                      checked={formData.custom_recurrence.ends === 'never'}
                      onChange={() => setFormData(prev => ({
                        ...prev,
                        custom_recurrence: { ...prev.custom_recurrence, ends: 'never' }
                      }))}
                      className="text-[#6366f1]"
                    />
                    <span className={textPrimary}>Never</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="ends"
                      checked={formData.custom_recurrence.ends === 'on_date'}
                      onChange={() => setFormData(prev => ({
                        ...prev,
                        custom_recurrence: { ...prev.custom_recurrence, ends: 'on_date' }
                      }))}
                      className="text-[#6366f1]"
                    />
                    <span className={textPrimary}>On</span>
                    <Input
                      type="date"
                      value={formData.custom_recurrence.end_date}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        custom_recurrence: { ...prev.custom_recurrence, end_date: e.target.value, ends: 'on_date' }
                      }))}
                      className={`w-40 ${bgSecondary} border ${borderColor} ${textPrimary}`}
                      disabled={formData.custom_recurrence.ends !== 'on_date'}
                    />
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="ends"
                      checked={formData.custom_recurrence.ends === 'after_occurrences'}
                      onChange={() => setFormData(prev => ({
                        ...prev,
                        custom_recurrence: { ...prev.custom_recurrence, ends: 'after_occurrences' }
                      }))}
                      className="text-[#6366f1]"
                    />
                    <span className={textPrimary}>After</span>
                    <Input
                      type="number"
                      min="1"
                      value={formData.custom_recurrence.occurrences}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        custom_recurrence: { ...prev.custom_recurrence, occurrences: parseInt(e.target.value) || 1, ends: 'after_occurrences' }
                      }))}
                      className={`w-16 ${bgSecondary} border ${borderColor} ${textPrimary}`}
                      disabled={formData.custom_recurrence.ends !== 'after_occurrences'}
                    />
                    <span className={textSecondary}>occurrences</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCustomRecurrence(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      setFormData(prev => ({ ...prev, recurrence: 'custom' }));
                      setShowCustomRecurrence(false);
                    }}
                    className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5]"
                  >
                    Done
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Task Detail Modal - Comprehensive View */}
        {showTaskDetailModal && viewingTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className={`${bgCard} border ${borderColor} w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
              <CardHeader className="sticky top-0 z-10" style={{ backgroundColor: isDark ? '#18181b' : 'white' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-[#6366f1]/20' : 'bg-indigo-100'}`}>
                      <FileText className="h-6 w-6 text-[#6366f1]" />
                    </div>
                    <div>
                      <CardTitle className={textPrimary}>{viewingTask.task_name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={statusColors[viewingTask.status] || statusColors.pending}>
                          {viewingTask.status?.replace('_', ' ') || 'Pending'}
                        </Badge>
                        <Badge className={priorityColors[viewingTask.priority]}>
                          {viewingTask.priority}
                        </Badge>
                        <Badge variant="outline">{viewingTask.type || 'General'}</Badge>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setShowTaskDetailModal(false); setViewingTask(null); }} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Description */}
                <div>
                  <h4 className={`text-sm font-medium ${textSecondary} mb-2 flex items-center gap-2`}>
                    <FileText className="h-4 w-4" /> Description
                  </h4>
                  <div className={`p-4 rounded-lg ${bgSecondary}`}>
                    <p className={`${textPrimary} whitespace-pre-wrap`}>
                      {viewingTask.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}>
                      <User className="h-3 w-3" /> Created By
                    </p>
                    <p className={`font-medium ${textPrimary}`}>{viewingTask.created_by_name || '-'}</p>
                    <p className={`text-xs ${textSecondary}`}>{formatDate(viewingTask.created_at)}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}>
                      <Users className="h-3 w-3" /> Assigned To
                    </p>
                    <p className={`font-medium ${textPrimary}`}>{viewingTask.assigned_to_name || 'Not assigned'}</p>
                    {viewingTask.assigned_by_name && (
                      <p className={`text-xs ${textSecondary}`}>by {viewingTask.assigned_by_name}</p>
                    )}
                  </div>
                  <div className={`p-4 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}>
                      <Calendar className="h-3 w-3" /> Due Date
                    </p>
                    <p className={`font-medium ${viewingTask.due_date && new Date(viewingTask.due_date) < new Date() && viewingTask.status !== 'completed' ? 'text-[#ef4444]' : textPrimary}`}>
                      {viewingTask.due_date ? formatDate(viewingTask.due_date) : 'No due date'}
                      {viewingTask.due_time && ` at ${viewingTask.due_time}`}
                    </p>
                    {/* Recurrence Info */}
                    {viewingTask.recurrence && viewingTask.recurrence !== 'none' && (
                      <div className="mt-2 flex items-center gap-2">
                        <Repeat className="h-3 w-3 text-[#6366f1]" />
                        <span className="text-xs text-[#6366f1]">
                          {viewingTask.recurrence_label || getRecurrenceLabel(viewingTask)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`p-4 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-1 flex items-center gap-1`}>
                      <Clock className="h-3 w-3" /> Last Updated
                    </p>
                    <p className={`font-medium ${textPrimary}`}>{formatDate(viewingTask.updated_at)}</p>
                  </div>
                </div>

                {/* Work Link */}
                {viewingTask.work_link && (
                  <div className={`p-4 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-2 flex items-center gap-1`}>
                      <Link className="h-3 w-3" /> Work Link
                    </p>
                    <a 
                      href={viewingTask.work_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#3b82f6] hover:text-[#2563eb] flex items-center gap-2 break-all"
                    >
                      <Link className="h-4 w-4 flex-shrink-0" />
                      {viewingTask.work_link}
                    </a>
                  </div>
                )}

                {/* Time Tracking Section */}
                <div>
                  <h4 className={`text-sm font-medium ${textSecondary} mb-2 flex items-center gap-2`}>
                    <Timer className="h-4 w-4" /> Time Tracking
                  </h4>
                  <div className={`p-4 rounded-lg ${bgSecondary}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className={`text-2xl font-bold ${textPrimary}`}>
                          {formatDuration(viewingTask.time_tracking?.total_seconds || 0)}
                        </p>
                        <p className={`text-xs ${textSecondary}`}>Total Time Spent</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {viewingTask.time_tracking?.status === 'running' && (
                          <Badge className="bg-[#10b981]/20 text-[#10b981] animate-pulse">
                            <Play className="h-3 w-3 mr-1" /> Running
                          </Badge>
                        )}
                        {viewingTask.time_tracking?.status === 'paused' && (
                          <Badge className="bg-[#f59e0b]/20 text-[#f59e0b]">
                            <Pause className="h-3 w-3 mr-1" /> Paused
                          </Badge>
                        )}
                        {viewingTask.time_tracking?.status === 'finished' && (
                          <Badge className="bg-[#10b981]/20 text-[#10b981]">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Finished
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Timer Controls */}
                    <div className="flex gap-2">
                      {getTimeTrackingButton(viewingTask)}
                    </div>

                    {/* Sessions List */}
                    {viewingTask.time_tracking?.sessions?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-dashed">
                        <p className={`text-xs font-medium ${textSecondary} mb-2`}>Work Sessions</p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {viewingTask.time_tracking.sessions.map((session, idx) => (
                            <div key={idx} className={`flex justify-between text-xs ${textSecondary} p-2 rounded ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
                              <span>
                                {new Date(session.start).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="font-medium text-[#6366f1]">
                                {formatDuration(session.duration_seconds)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => { setShowTaskDetailModal(false); setViewingTask(null); }} 
                    className="flex-1"
                  >
                    Close
                  </Button>
                  <Button 
                    onClick={() => { setShowTaskDetailModal(false); openEditModal(viewingTask); }} 
                    className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5]"
                  >
                    <Edit2 className="h-4 w-4 mr-2" /> Edit Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
