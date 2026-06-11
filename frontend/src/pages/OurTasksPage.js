import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  MoreHorizontal, Trash2, Edit2, X, AlertCircle, Briefcase, Building2,
  Play, Pause, Square, Timer, Eye, FileText, Tag, Users, Link, Filter, CalendarDays,
  Repeat, Video, ListChecks, ShieldCheck, Crown
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import ApprovalsPage from './ApprovalsPage';
import ProjectsPanel from '../components/ProjectsPanel';
import DepartmentsPanel from '../components/DepartmentsPanel';
import MeetingsPanel from '../components/MeetingsPanel';
import useAutoRefresh from '../hooks/useAutoRefresh';
import OperationsSummaryCards from '../components/operations/OperationsSummaryCards';
import OperationsTabsBar from '../components/operations/OperationsTabsBar';

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

export default function OurTasksPage({ inModal = false, defaultTab = 'assigned_to_me' }) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('all');
  const [mainTab, setMainTab] = useState(defaultTab); // assigned_to_me, assign_to_team, projects, departments, approvals, meetings
  // View/Edit toggle for Projects tab — visible only to super_admin
  const [projectsViewMode, setProjectsViewMode] = useState('view'); // 'view' | 'edit'
  // Operations Summary cards (Feb 2026) — driven by /api/our-tasks/summary/{date}
  const [summaryDate, setSummaryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState({
    worked_hours: { formatted: '0h 0m' },
    total_to_do: 0,
    pending: 0,
    awaiting_ops: 0,
    awaiting_ceo: 0,
  });
  const [meetingsSubActive, setMeetingsSubActive] = useState(false); // when true → render Meetings panel inside My Tasks / Assign-to-Team
  const [viewingTask, setViewingTask] = useState(null);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [runningTimers, setRunningTimers] = useState({});
  const [editingTimeRow, setEditingTimeRow] = useState(null); // task_id currently in row-edit mode (legacy, no longer used for inline)
  const [timeDrafts, setTimeDrafts] = useState({}); // {task_id: {start: 'HH:MM', end: 'HH:MM'}} (legacy)
  const [editTimeModal, setEditTimeModal] = useState(null); // { task, sH, sM, sP, eH, eM, eP }
  // Approval request popup
  const [approvalTask, setApprovalTask] = useState(null); // task currently being submitted for approval
  const [approvalDraft, setApprovalDraft] = useState({ approver_role: '', note: '', work_link: '' });
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
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
    singleDate: '', // for single date filter
    department: 'all', // all or dept_key
    project: 'all', // all or project_id
    category: 'all' // all or category name (depends on selected department)
  });
  
  const token = localStorage.getItem('session_token');
  // CRITICAL: useMemo so the `headers` object identity is stable across renders.
  // Without this, every child component (ProjectsPanel, DepartmentsPanel) receives
  // a new `headers` prop on every render → their loadXyz useCallback identity
  // changes → their useEffect fires constantly → "Loading…" blinks every frame.
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const hoverBg = isDark ? 'hover:bg-[#3f3f46]' : 'hover:bg-gray-200';

  // Form state
  const [submitting, setSubmitting] = useState(false); // prevents double-create
  const [formData, setFormData] = useState({
    task_name: '',
    description: '',
    priority: 'medium',
    type: '',          // empty → forces user to pick (required)
    assigned_to: '',
    due_date: new Date().toISOString().slice(0, 10),
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
    work_link: '',
    department: '',
    project_id: '',
    project_name: '',
    category: '',
  });

  const [projectsForTask, setProjectsForTask] = useState([]);
  const [deptCategoriesForTask, setDeptCategoriesForTask] = useState([]);
  
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

  // Load counts for tab badges
  const [projectsCount, setProjectsCount] = useState(0);
  const [departmentsCount, setDepartmentsCount] = useState(0);
  const [approvalsCount, setApprovalsCount] = useState(0);
  const [meetingsCount, setMeetingsCount] = useState(0);
  // Current user's designation config (for Assign-to-Team monitoring scope)
  const [myDesignation, setMyDesignation] = useState(null);
  // Today's break intervals (used to block task time edits that overlap a break)
  const [todayBreaks, setTodayBreaks] = useState([]);
  const [breakConflictModal, setBreakConflictModal] = useState(null);

  // Fetch today's breaks once on mount so we can validate task time entries
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/hr/attendance/today`, { headers });
        if (!active) return;
        const att = res.data?.attendance || {};
        setTodayBreaks(Array.isArray(att.breaks) ? att.breaks : []);
      } catch {
        // Silently ignore — break validation is a best-effort UX guard.
      }
    })();
    return () => { active = false; };
  }, []);

  // Convert HH:MM string + YYYY-MM-DD date into a Date object (local time)
  const combineDateTime = (dateStr, hhmm) => {
    if (!dateStr || !hhmm) return null;
    const [h, m] = String(hhmm).split(':').map((v) => parseInt(v, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const d = new Date(dateStr + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d;
  };

  const formatBreakLabel = (cat) => {
    const map = { lunch: 'Lunch', breakfast: 'Breakfast', tea: 'Tea Break', other: 'Other' };
    return map[cat] || (cat || 'Break');
  };

  // Return the first break that overlaps [taskStart, taskEnd]. Null if no conflict.
  const findBreakConflict = (dateStr, startHHMM, endHHMM) => {
    if (!startHHMM || !endHHMM || !dateStr) return null;
    const today = new Date().toISOString().slice(0, 10);
    if (dateStr !== today) return null; // only enforce on today's date
    const taskStart = combineDateTime(dateStr, startHHMM);
    const taskEnd = combineDateTime(dateStr, endHHMM);
    if (!taskStart || !taskEnd || taskStart >= taskEnd) return null;
    for (const b of todayBreaks) {
      if (!b.start_time) continue;
      const bStart = new Date(b.start_time);
      const bEnd = b.end_time ? new Date(b.end_time) : new Date();
      // Standard half-open interval overlap check.
      if (taskStart < bEnd && taskEnd > bStart) {
        return { breakInfo: b, bStart, bEnd };
      }
    }
    return null;
  };

  const loadProjectsAndCategories = useCallback(async () => {
    try {
      const [pRes, dRes, aRes, desRes, mRes] = await Promise.all([
        axios.get(`${API}/api/projects`, { headers }),
        axios.get(`${API}/api/department-categories`, { headers }),
        axios.get(`${API}/api/our-tasks/approvals/pending`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/designations/`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/meetings/my-meetings`, { headers }).catch(() => ({ data: [] })),
      ]);
      setProjectsForTask(pRes.data || []);
      setDeptCategoriesForTask(dRes.data || []);
      setProjectsCount((pRes.data || []).length);
      setDepartmentsCount((dRes.data || []).length);
      setApprovalsCount((aRes.data || []).length);
      setMeetingsCount((mRes.data || []).length);
      // Find my designation
      const userDesg = (user?.designation || '').toLowerCase().trim();
      const found = (desRes.data || []).find(
        d => (d.title || '').toLowerCase().trim() === userDesg
      );
      setMyDesignation(found || null);
    } catch (error) {
      console.error('Error loading projects/categories:', error);
    }
  }, [user?.designation]);

  // Filter dept categories visible to the current user based on their designation's
  // operations_departments. If the designation explicitly defines operations_departments,
  // we always honor that list (even for Operation Head). Super Admin / Admin without
  // a designation config see ALL departments.
  const visibleDeptCategories = useMemo(() => {
    // Normalize aliases between designation config and dept_key (e.g., meta_ads ↔ meta)
    const aliasMap = { meta_ads: 'meta', meta: 'meta_ads' };
    const normalize = (s) => String(s || '').toLowerCase().trim();
    const allowedRaw = (myDesignation?.operations_departments || []).map(normalize);
    const allowed = new Set();
    allowedRaw.forEach(k => {
      allowed.add(k);
      if (aliasMap[k]) allowed.add(aliasMap[k]);
    });
    if (allowed.size > 0) {
      return deptCategoriesForTask.filter(d => allowed.has(normalize(d.dept_key)));
    }
    // No designation-level restriction → fall back to role check
    const role = (user?.role || '').toLowerCase();
    if (role === 'super_admin' || role === 'admin') return deptCategoriesForTask;
    return deptCategoriesForTask;
  }, [deptCategoriesForTask, myDesignation, user?.role]);

  useEffect(() => {
    loadTasks();
    loadUsers();
    loadProjectsAndCategories();
  }, [loadTasks, loadUsers, loadProjectsAndCategories]);

  // Auto-refresh: every 15s + immediate on tab focus / visibility change.
  // Pause polling while the create/edit modal is open to avoid clobbering user input.
  useAutoRefresh(
    [loadTasks, loadUsers, loadProjectsAndCategories],
    { enabled: !showCreateModal && !editingTask && !editTimeModal && !approvalTask }
  );

  // Operations Summary loader (drives the 5 cards above the tabs)
  const loadSummary = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/our-tasks/summary/${summaryDate}`, { headers });
      setSummary(res.data || {});
    } catch (_) { /* silent */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryDate, headers]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useAutoRefresh(loadSummary, { enabled: !showCreateModal && !editingTask });

  // Create task
  const handleCreateTask = async () => {
    if (submitting) return; // ignore double-clicks
    if (!formData.task_name.trim()) {
      toast.error('Task name is required');
      return;
    }
    // Enforce department BEFORE other field checks when assigning to team (clearer UX)
    if (mainTab === 'assign_to_team' && !formData.department) {
      toast.error('Please select a Department before creating a team task');
      return;
    }
    if (!formData.type) {
      toast.error('Please pick a Type for this task');
      return;
    }
    // Require due_date when recurrence is set
    if (formData.recurrence && formData.recurrence !== 'none' && !formData.due_date) {
      toast.error('Start date is required for recurring tasks');
      return;
    }
    setSubmitting(true);
    try {
      // In My Tasks tab, force assignee to current user (Assign To dropdown is hidden).
      const payload = { ...formData };
      if (mainTab === 'assigned_to_me' && !payload.assigned_to) {
        payload.assigned_to = user?.user_id;
      }
      await axios.post(`${API}/api/our-tasks/tasks`, payload, { headers });
      toast.success('Task created successfully');
      setShowCreateModal(false);
      resetForm();
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  // Update task
  const handleUpdateTask = async () => {
    if (submitting) return;
    if (!formData.task_name.trim()) {
      toast.error('Task name is required');
      return;
    }
    if (!formData.type) {
      toast.error('Please pick a Type for this task');
      return;
    }
    // Require due_date when recurrence is set
    if (formData.recurrence && formData.recurrence !== 'none' && !formData.due_date) {
      toast.error('Start date is required for recurring tasks');
      return;
    }
    setSubmitting(true);
    try {
      await axios.put(`${API}/api/our-tasks/tasks/${editingTask.task_id}`, formData, { headers });
      toast.success('Task updated successfully');
      setEditingTask(null);
      resetForm();
      loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update task');
    } finally {
      setSubmitting(false);
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

  // Split a 24h "HH:MM" string into { hour12, minute, period }.
  const splitHM = (hhmm) => {
    if (!hhmm) return { h: 9, m: 0, p: 'AM' };
    const [hStr, mStr] = String(hhmm).split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10) || 0;
    const p = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return { h, m, p };
  };

  // Join { h (12h), m, p } back to a 24h "HH:MM" string.
  const joinHM = ({ h, m, p }) => {
    let hh = parseInt(h, 10);
    if (Number.isNaN(hh)) hh = 0;
    const mm = parseInt(m, 10) || 0;
    if (p === 'PM' && hh !== 12) hh += 12;
    if (p === 'AM' && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const openEditTimeModal = (task) => {
    const { start, end } = getTaskStartEnd(task);
    const sParts = splitHM(toTimeInputValue(start));
    const eParts = splitHM(toTimeInputValue(end));
    setEditTimeModal({
      task,
      sH: sParts.h, sM: sParts.m, sP: sParts.p,
      eH: eParts.h, eM: eParts.m, eP: eParts.p,
    });
  };

  // Save inline time edit (single field) — kept for potential future use
  // Save BOTH start and end time for a row (triggered by row-level Save button)
  const handleSaveTimeRow = async (taskId, explicitDraft = null) => {
    const draft = explicitDraft || timeDrafts[taskId];
    if (!draft || (!draft.start && !draft.end)) {
      toast.error('Enter Start Time and End Time first');
      return;
    }
    try {
      const task = tasks.find(t => t.task_id === taskId);
      const { start, end } = getTaskStartEnd(task);
      const anchorIso = start || end;
      const payload = {};
      const baseDate = anchorIso ? anchorIso.slice(0, 10) : new Date().toISOString().slice(0, 10);
      payload.date = baseDate;

      // Convert HH:MM (local time) → ISO UTC string so backend stores the correct instant.
      // (Backend previously parsed plain "HH:MM" as UTC, shifting times by the local offset.)
      const localHmToIso = (hhmm) => {
        if (!hhmm) return null;
        const [h, m] = String(hhmm).split(':').map((v) => parseInt(v, 10));
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        const d = new Date(`${baseDate}T00:00:00`);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
      };

      if (draft.start) payload.start_time = localHmToIso(draft.start);
      if (draft.end) payload.end_time = localHmToIso(draft.end);

      // Block save if the task interval overlaps a recorded break on the same date.
      if (draft.start && draft.end) {
        const conflict = findBreakConflict(payload.date, draft.start, draft.end);
        if (conflict) {
          setBreakConflictModal({
            taskId,
            taskStart: draft.start,
            taskEnd: draft.end,
            ...conflict,
          });
          return;
        }
      }

      await axios.patch(`${API}/api/our-tasks/tasks/${taskId}/time-edit`, payload, { headers });
      toast.success('Time saved');
      setEditingTimeRow(null);
      setEditTimeModal(null);
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

    const isApproved = task.approval_request?.status === 'approved';

    return (
      <Button
        size="sm"
        onClick={() => openEditTimeModal(task)}
        disabled={isApproved}
        className={
          isApproved
            ? 'bg-[#3f3f46] text-[#a1a1aa] h-8 px-3 cursor-not-allowed'
            : 'bg-[#6366f1] hover:bg-[#4f46e5] text-white h-8 px-3'
        }
        data-testid={`time-edit-btn-${task.task_id}`}
        title={isApproved ? 'Locked — approved by Operations' : 'Edit Start & End time'}
      >
        <Edit2 className="h-3 w-3 mr-1" />
        {isApproved ? 'Locked' : 'Edit'}
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
      type: '',
      assigned_to: '',
      due_date: new Date().toISOString().slice(0, 10),
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
      work_link: '',
      department: '',
      project_id: '',
      project_name: '',
      category: '',
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
      // I can see this team task if any of:
      //  - I'm Super Admin / Admin / Operation Head → see ALL tasks (full org visibility)
      //  - I created it and assigned to someone else
      //  - The task's department is in my designation's allowed Operations departments
      const role = (user?.role || '').toLowerCase();
      const desg = (user?.designation || '').toLowerCase().trim();
      const isPrivileged = role === 'super_admin' || role === 'admin' || desg === 'operation head';
      if (isPrivileged) {
        // Show everything in Assign to Team for privileged users — no exclusions
      } else {
        const myDepts = (myDesignation?.operations_departments || []);
        const createdByMe = task.created_by === user?.user_id && task.assigned_to !== user?.user_id;
        const inMyDept = task.department && myDepts.includes(task.department) && task.assigned_to !== user?.user_id;
        if (!(createdByMe || inMyDept)) return false;
      }
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
    
    // Department filter
    if (filters.department !== 'all' && task.department !== filters.department) return false;
    
    // Project filter
    if (filters.project !== 'all' && task.project_id !== filters.project) return false;
    
    // Category filter (per-department categories from Operations → Departments)
    if (filters.category !== 'all' && task.category !== filters.category) return false;
    
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
      status: 'all',
      department: 'all',
      project: 'all',
      category: 'all'
    });
  };

  // Stats - based on main tab
  const assignedToMeTasks = tasks.filter(t => t.assigned_to === user?.user_id && t.created_by !== user?.user_id);
  const _role = (user?.role || '').toLowerCase();
  const _desg = (user?.designation || '').toLowerCase().trim();
  const _isPrivileged = _role === 'super_admin' || _role === 'admin' || _desg === 'operation head';
  const _myDepts = (myDesignation?.operations_departments || []);
  const assignedToTeamTasks = tasks.filter(t => {
    if (_isPrivileged) return true; // super admin / admin / op head: see ALL tasks
    if (t.assigned_to === user?.user_id) return false; // exclude my own
    if (t.created_by === user?.user_id) return true; // tasks I created
    if (t.department && _myDepts.includes(t.department)) return true; // dept monitoring
    return false;
  });
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

  // When inside the Operations Modal, skip the global Layout wrapper.
  const content = (
      <div className="space-y-6">
        {/* Header (hidden when inside Operations Modal) */}
        {!inModal && (
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1">
              <span className="bg-gradient-to-r from-[#10b981] to-[#059669] bg-clip-text text-transparent">
                Hi, {user?.name || 'User'}
              </span>
            </h1>
            <p className={textSecondary}>Team-wide task management for all users</p>
          </div>
        </div>
        )}

        {/* Operations Summary Cards — Feb 2026
            5 metrics: Worked Hours • To-Do • Pending • Awaiting Ops • Awaiting CEO */}
        <OperationsSummaryCards
          summary={summary}
          summaryDate={summaryDate}
          onDateChange={setSummaryDate}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          borderColor={borderColor}
        />

        {/* Main Tabs — pill style matching My Profile */}
        <OperationsTabsBar
          user={user}
          mainTab={mainTab}
          setMainTab={setMainTab}
          setMeetingsSubActive={setMeetingsSubActive}
          setFilter={setFilter}
          setFilters={setFilters}
          counts={{
            myTasks: assignedToMeTasks.length + myOwnTasks.length,
            assignToTeam: assignedToTeamTasks.length,
            projects: projectsCount,
            departments: departmentsCount,
            approvals: approvalsCount,
            meetings: meetingsCount,
          }}
          bgCard={bgCard}
          textSecondary={textSecondary}
          hoverBg={hoverBg}
          borderColor={borderColor}
        />

        {/* Approvals tab — embed the dedicated page */}
        {mainTab === 'approvals' && (
          <div data-testid="ops-approvals-panel">
            <ApprovalsPage embedded />
          </div>
        )}

        {/* Projects tab */}
        {mainTab === 'projects' && (() => {
          const role = (user?.role || '').toLowerCase();
          const isPrivileged = role === 'super_admin' || role === 'admin';
          const cfg = user?.designation_config || {};
          // Permission resolution: privileged users use the in-app toggle;
          // regular users follow their designation's operations_projects setting.
          const designationGrantsEdit = (cfg.operations_projects || 'none') === 'edit';
          const designationGrantsView = (cfg.operations_projects || 'none') === 'view';
          const showToggle = isPrivileged || designationGrantsEdit; // only edit-grantees can toggle
          const effectiveViewOnly = isPrivileged
            ? (projectsViewMode === 'view')
            : designationGrantsView; // edit-grantees default to live edit (no forced view)
          return (
            <>
              {/* View / Edit toggle — privileged users + designations granted Edit */}
              {showToggle && (
                <div className={`flex items-center justify-end gap-2 mb-3`} data-testid="projects-view-edit-toggle">
                  <span className={`text-xs ${textSecondary}`}>Mode:</span>
                  <div className={`inline-flex rounded-lg border ${borderColor} ${bgCard} p-1`}>
                    <button
                      onClick={() => setProjectsViewMode('view')}
                      data-testid="projects-mode-view"
                      className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                        projectsViewMode === 'view'
                          ? 'bg-[#6366f1] text-white shadow'
                          : `${textSecondary} hover:bg-[#6366f1]/10`
                      }`}
                    >
                      View only
                    </button>
                    <button
                      onClick={() => setProjectsViewMode('edit')}
                      data-testid="projects-mode-edit"
                      className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                        projectsViewMode === 'edit'
                          ? 'bg-[#10b981] text-white shadow'
                          : `${textSecondary} hover:bg-[#10b981]/10`
                      }`}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
              <ProjectsPanel
                isDark={isDark}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                bgCard={bgCard}
                bgSecondary={bgSecondary}
                borderColor={borderColor}
                headers={headers}
                currentUser={user}
                onTaskCreated={loadTasks}
                viewOnly={effectiveViewOnly}
              />
            </>
          );
        })()}

        {/* Departments tab */}
        {mainTab === 'departments' && (
          <DepartmentsPanel
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            borderColor={borderColor}
            headers={headers}
          />
        )}

        {/* Meetings tab */}
        {mainTab === 'meetings' && (
          <MeetingsPanel
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            borderColor={borderColor}
            headers={headers}
            users={users}
          />
        )}

        {mainTab !== 'approvals' && mainTab !== 'projects' && mainTab !== 'departments' && mainTab !== 'meetings' && (
        <>
        {/* Compact Filter Toolbar */}
        <div className={`${bgCard} border ${borderColor} rounded-xl p-3`}>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date filter */}
            <Select value={filters.dateFilter} onValueChange={(v) => setFilters({...filters, dateFilter: v})}>
              <SelectTrigger className={`h-9 w-[140px] ${bgSecondary} border ${borderColor}`} data-testid="filter-date">
                <Calendar className="h-3.5 w-3.5 mr-1 opacity-60" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={bgCard}>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="single">Single Date</SelectItem>
                <SelectItem value="range">Date Range</SelectItem>
              </SelectContent>
            </Select>

            {filters.dateFilter === 'single' && (
              <Input
                type="date"
                value={filters.singleDate || ''}
                onChange={(e) => setFilters({...filters, singleDate: e.target.value})}
                className={`h-9 w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="filter-single-date"
              />
            )}
            {filters.dateFilter === 'range' && (
              <>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                  className={`h-9 w-[150px] ${bgSecondary} border ${borderColor}`}
                  data-testid="filter-date-from"
                />
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                  className={`h-9 w-[150px] ${bgSecondary} border ${borderColor}`}
                  data-testid="filter-date-to"
                />
              </>
            )}

            {/* Department filter is now rendered as sub-tabs below the toolbar */}

            {/* Project filter */}
            <Select value={filters.project} onValueChange={(v) => setFilters({...filters, project: v})}>
              <SelectTrigger className={`h-9 w-[160px] ${bgSecondary} border ${borderColor}`} data-testid="filter-project">
                <Briefcase className="h-3.5 w-3.5 mr-1 opacity-60" />
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent className={bgCard}>
                <SelectItem value="all">All Projects</SelectItem>
                {projectsForTask
                  .filter(p => filters.department === 'all' || (p.departments || []).includes(filters.department))
                  .map(p => (
                    <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Team filter — only on Assign to Team tab; shows people the current user has assigned tasks to */}
            {mainTab === 'assign_to_team' && (() => {
              const teamMemberIds = Array.from(new Set(
                assignedToTeamTasks.map(t => t.assigned_to).filter(Boolean)
              ));
              const teamMembers = teamMemberIds
                .map(id => {
                  const u = users.find(x => x.user_id === id);
                  return u ? { user_id: id, name: u.name } : { user_id: id, name: id };
                })
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
              return (
                <Select value={filters.assignedTo} onValueChange={(v) => setFilters({...filters, assignedTo: v})}>
                  <SelectTrigger className={`h-9 w-[160px] ${bgSecondary} border ${borderColor}`} data-testid="filter-team">
                    <Users className="h-3.5 w-3.5 mr-1 opacity-60" />
                    <SelectValue placeholder="All Team" />
                  </SelectTrigger>
                  <SelectContent className={bgCard}>
                    <SelectItem value="all">All Team</SelectItem>
                    {teamMembers.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            })()}

            {/* Category filter — categories of the selected department (from Operations → Departments) */}
            {(() => {
              const deptObj = deptCategoriesForTask.find(d => d.dept_key === filters.department);
              const cats = deptObj?.categories || [];
              const disabled = filters.department === 'all';
              return (
                <Select
                  value={filters.category}
                  onValueChange={(v) => setFilters({...filters, category: v})}
                  disabled={disabled}
                >
                  <SelectTrigger
                    className={`h-9 w-[160px] ${bgSecondary} border ${borderColor} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    data-testid="filter-category"
                  >
                    <Tag className="h-3.5 w-3.5 mr-1 opacity-60" />
                    <SelectValue placeholder={disabled ? 'Pick dept first' : 'All Categories'} />
                  </SelectTrigger>
                  <SelectContent className={bgCard}>
                    <SelectItem value="all">All Categories</SelectItem>
                    {cats.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            })()}

            {/* Status */}
            <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
              <SelectTrigger className={`h-9 w-[130px] ${bgSecondary} border ${borderColor}`} data-testid="filter-status">
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

            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs" data-testid="reset-filters">
              Reset
            </Button>

            <div className="ml-auto">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#6366f1] hover:bg-[#4f46e5] h-9"
                data-testid="create-task-btn"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create Task
              </Button>
            </div>
          </div>
        </div>

        {/* Department Sub-Tabs with red pending count badges */}
        {(() => {
          const sourceTasks = mainTab === 'assigned_to_me'
            ? [...assignedToMeTasks, ...myOwnTasks]
            : assignedToTeamTasks;
          const pendingByDept = {};
          let totalPending = 0;
          sourceTasks.forEach(t => {
            if ((t.status || 'pending') !== 'pending') return;
            totalPending += 1;
            const d = t.department || '_unassigned';
            pendingByDept[d] = (pendingByDept[d] || 0) + 1;
          });

          return (
            <div className="flex flex-wrap items-center gap-2" data-testid="dept-subtabs">
              <button
                onClick={() => { setMeetingsSubActive(false); setFilters({...filters, department: 'all', project: 'all', category: 'all'}); }}
                data-testid="dept-subtab-all"
                className={`relative px-4 py-2 rounded-xl text-sm transition-all border ${
                  filters.department === 'all' && !meetingsSubActive
                    ? 'bg-[#6366f1] text-white border-transparent shadow-sm'
                    : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#6366f1]/40`
                }`}
              >
                All Depts
                {totalPending > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-[#ef4444] text-white text-[10px] font-bold px-1 ring-2 ring-[#0a0a0a] dark:ring-[#0a0a0a]">
                    {totalPending}
                  </span>
                )}
              </button>
              {visibleDeptCategories.map(d => {
                const count = pendingByDept[d.dept_key] || 0;
                const isActive = filters.department === d.dept_key && !meetingsSubActive;
                return (
                  <button
                    key={d.dept_key}
                    onClick={() => { setMeetingsSubActive(false); setFilters({...filters, department: d.dept_key, project: 'all', category: 'all'}); }}
                    data-testid={`dept-subtab-${d.dept_key}`}
                    className={`relative px-4 py-2 rounded-xl text-sm transition-all border ${
                      isActive
                        ? 'bg-[#6366f1] text-white border-transparent shadow-sm'
                        : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#6366f1]/40`
                    }`}
                  >
                    {d.label}
                    {count > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-[#ef4444] text-white text-[10px] font-bold px-1 ring-2 ring-[#0a0a0a]"
                        data-testid={`dept-pending-${d.dept_key}`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Meetings sub-tab — distinct colored pill */}
              <button
                onClick={() => setMeetingsSubActive(true)}
                data-testid="dept-subtab-meetings"
                className={`relative px-4 py-2 rounded-xl text-sm transition-all border-2 ${
                  meetingsSubActive
                    ? 'bg-[#ec4899] text-white border-transparent shadow-sm'
                    : `${bgCard} text-[#ec4899] border-[#ec4899]/40 hover:bg-[#ec4899]/10`
                }`}
              >
                <Video className="h-3.5 w-3.5 inline -mt-0.5 mr-1" />
                Meetings
                {meetingsCount > 0 && !meetingsSubActive && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#ec4899] text-white text-[10px] font-bold px-1">
                    {meetingsCount}
                  </span>
                )}
              </button>
            </div>
          );
        })()}

        {/* Render Meetings panel when the Meetings sub-tab is selected */}
        {meetingsSubActive ? (
          <Card className={`${bgCard} border ${borderColor}`}>
            <CardContent className="p-4" data-testid="dept-meetings-panel">
              <MeetingsPanel
                isDark={isDark}
                bgCard={bgCard}
                bgSecondary={bgSecondary}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                borderColor={borderColor}
                headers={headers}
                users={users}
              />
            </CardContent>
          </Card>
        ) : (
        /* Tasks Table */
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={bgSecondary}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Task</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Status</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Category</th>
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
                      <td colSpan={11} className={`px-4 py-8 text-center ${textSecondary}`}>Loading...</td>
                    </tr>
                  ) : filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={11} className={`px-4 py-8 text-center ${textSecondary}`}>
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
                        <div className={`text-xs ${textSecondary} mt-1 flex flex-wrap gap-1`}>
                          <Badge className="text-xs" variant="outline">{task.type || 'General'}</Badge>
                          {task.project_name && (
                            <Badge className="text-xs bg-[#6366f1]/20 text-[#6366f1]" data-testid={`project-badge-${task.task_id}`}>
                              <Briefcase className="h-3 w-3 mr-1" />{task.project_name}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={statusColors[task.status] || statusColors.pending}>
                          {task.status?.replace('_', ' ') || 'Pending'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm" data-testid={`category-cell-${task.task_id}`}>
                        {task.category ? (
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs w-fit">{task.category}</Badge>
                            {task.department && (
                              <span className={`text-xs ${textSecondary}`}>{task.department}</span>
                            )}
                          </div>
                        ) : (
                          <span className={textSecondary}>—</span>
                        )}
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
                          {(() => {
                            const isSuperAdmin = (user?.role || '').toLowerCase() === 'super_admin';
                            const isCreator = task.created_by === user?.user_id;
                            const isAssignee = task.assigned_to === user?.user_id;
                            // Pencil-edit: full edit allowed for creator / super_admin only.
                            // Assignees who are NOT creators can only edit timing (separate Edit button in TIMER column).
                            const canFullEdit = isSuperAdmin || isCreator;
                            // Delete: only super_admin OR the assignee can delete (per user requirement).
                            const canDelete = isSuperAdmin || isAssignee;
                            return (
                              <>
                                {canFullEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
                                    data-testid={`task-edit-${task.task_id}`}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[#ef4444]"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.task_id); }}
                                    data-testid={`task-delete-${task.task_id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                          {mainTab === 'assigned_to_me' && (
                            <Button
                              size="sm"
                              className={
                                task.approval_request?.status === 'pending'
                                  ? 'bg-[#f59e0b] hover:bg-[#d97706] text-white h-8 px-3'
                                  : task.approval_request?.status === 'approved'
                                    ? 'bg-[#10b981] hover:bg-[#059669] text-white h-8 px-3'
                                    : task.approval_request?.status === 'rejected'
                                      ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white h-8 px-3'
                                      : 'bg-[#6366f1] hover:bg-[#4f46e5] text-white h-8 px-3'
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                setApprovalTask(task);
                                setApprovalDraft({
                                  approver_role: task.approval_request?.approver_role || '',
                                  note: '',
                                  // Auto-fetch the existing work link from the task / previous request
                                  work_link: task.approval_request?.work_link || task.work_link || '',
                                });
                              }}
                              data-testid={`approve-btn-${task.task_id}`}
                              title={task.approval_request?.status ? `Approval ${task.approval_request.status}` : 'Send for approval'}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {task.approval_request?.status === 'pending' ? 'Pending'
                                : task.approval_request?.status === 'approved' ? 'Approved'
                                : task.approval_request?.status === 'rejected' ? 'Rejected'
                                : 'Approve'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        )}
        </>
        )}

        {/* Create/Edit Task Modal */}
        {(showCreateModal || editingTask) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className={`${bgCard} border ${borderColor} w-full max-w-4xl max-h-[90vh] overflow-y-auto`}>
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
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ─── Column 1 — Task details (till Status) ─── */}
                  <div className="space-y-4" data-testid="create-task-col-1">
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
                        rows={4}
                        className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
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
                        <Label className={textPrimary}>Type <span className="text-red-500">*</span></Label>
                        <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
                          <SelectTrigger className={`${bgSecondary} border ${borderColor}`} data-testid="create-task-type">
                            <SelectValue placeholder="Select type…" />
                          </SelectTrigger>
                          <SelectContent className={bgCard}>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="learning">Learning</SelectItem>
                            <SelectItem value="discussion">Discussion</SelectItem>
                            <SelectItem value="meeting">Meeting</SelectItem>
                            <SelectItem value="team_meeting">Team Meeting</SelectItem>
                            <SelectItem value="client_meeting">Client Meeting</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Assign To — hidden when creating from My Tasks (assignee = current user) */}
                    {!(mainTab === 'assigned_to_me' && !editingTask) && (
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
                    )}
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

                  {/* ─── Column 2 — Schedule + Categorization ─── */}
                  <div className="space-y-4" data-testid="create-task-col-2">
                    {/* Date & Time block */}
                    <div className={`p-4 rounded-lg border ${borderColor} ${bgSecondary} space-y-3`}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#6366f1]" />
                        <span className={`text-sm font-medium ${textPrimary}`}>Date & Time</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex-1 min-w-[120px]">
                          <Input
                            type="date"
                            value={formData.due_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                            className={`${isDark ? 'bg-[#18181b]' : 'bg-white'} border ${borderColor} ${textPrimary}`}
                          />
                        </div>
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
                      {/* Recurrence */}
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
                        {formData.recurrence === 'custom' && formData.custom_recurrence && (
                          <p className="text-xs text-[#6366f1] mt-1">{getRecurrenceLabel(formData)}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className={textPrimary}>Department</Label>
                      <Select
                        value={formData.department || 'none'}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, department: v === 'none' ? '' : v, project_id: '', project_name: '', category: '' }))}
                      >
                        <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="create-task-department">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {visibleDeptCategories.map(d => (
                            <SelectItem key={d.dept_key} value={d.dept_key}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className={textPrimary}>Project</Label>
                        <Select
                          value={formData.project_id || 'none'}
                          onValueChange={(v) => {
                            if (v === 'none') {
                              setFormData(prev => ({ ...prev, project_id: '', project_name: '' }));
                            } else {
                              const proj = projectsForTask.find(p => p.project_id === v);
                              const projDepts = proj?.departments || [];
                              setFormData(prev => {
                                // Auto-sync department to the project's first dept if the current
                                // dept isn't one of the project's depts — keeps the Category list correct.
                                const nextDept = (projDepts.includes(prev.department))
                                  ? prev.department
                                  : (projDepts[0] || prev.department);
                                return {
                                  ...prev,
                                  project_id: v,
                                  project_name: proj?.name || '',
                                  department: nextDept,
                                  category: nextDept === prev.department ? prev.category : '',
                                };
                              });
                            }
                          }}
                          disabled={!formData.department}
                        >
                          <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="create-task-project">
                            <SelectValue placeholder={formData.department ? 'Select project' : 'Pick dept first'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            {(() => {
                              const myProjects = projectsForTask.filter((p) => {
                                if (formData.department && !(p.departments || []).includes(formData.department)) {
                                  return false;
                                }
                                const members = Array.isArray(p.members) ? p.members : [];
                                return members.includes(user?.user_id) || p.created_by === user?.user_id;
                              });
                              if (myProjects.length === 0) {
                                return (
                                  <div className={`px-3 py-2 text-xs ${textSecondary}`}>
                                    No projects assigned to you{formData.department ? ` in this department` : ''}.
                                  </div>
                                );
                              }
                              return myProjects.map((p) => (
                                <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className={textPrimary}>Category</Label>
                        <Select
                          value={formData.category || 'none'}
                          onValueChange={(v) => setFormData(prev => ({ ...prev, category: v === 'none' ? '' : v }))}
                          disabled={!formData.department}
                        >
                          <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="create-task-category">
                            <SelectValue placeholder={formData.department ? 'Select category' : 'Pick dept first'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            {(deptCategoriesForTask.find(d => d.dept_key === formData.department)?.categories || []).map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                  </div>
                </div>

                {/* Footer buttons — full width */}
                <div className="flex gap-3 pt-5 mt-2 border-t border-[#27272a]">
                  <Button variant="outline" onClick={() => { setShowCreateModal(false); setEditingTask(null); resetForm(); }} className="flex-1" disabled={submitting}>
                    Cancel
                  </Button>
                  <Button
                    onClick={editingTask ? handleUpdateTask : handleCreateTask}
                    disabled={submitting}
                    className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="create-task-submit"
                  >
                    {submitting ? 'Saving…' : (editingTask ? 'Update Task' : 'Create Task')}
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

        {/* Approval Request Popup */}
        {approvalTask && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={() => !approvalSubmitting && setApprovalTask(null)}>
            <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4`} onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                    <CheckCircle2 className="h-5 w-5 text-[#6366f1]" />
                    Send for Approval
                  </CardTitle>
                  <button onClick={() => !approvalSubmitting && setApprovalTask(null)} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className={`text-sm ${textSecondary}`}>Task: <span className={textPrimary}>{approvalTask.task_name}</span></p>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Approver role — restricted to PM / Operations / Marketing Head */}
                <div>
                  <Label className={`${textPrimary} mb-2 block`}>Approve By</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { value: 'pm', label: 'PM', color: 'bg-purple-500' },
                      { value: 'operations', label: 'Operations', color: 'bg-blue-500' },
                      { value: 'marketing_head', label: 'Marketing Head', color: 'bg-pink-500' },
                      { value: 'hr', label: 'HR', color: 'bg-rose-500' },
                    ].map(opt => {
                      const selected = approvalDraft.approver_role === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setApprovalDraft(prev => ({ ...prev, approver_role: opt.value }))}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            selected ? `${opt.color} text-white` : `${bgSecondary} ${textSecondary} hover:opacity-80`
                          }`}
                          data-testid={`approval-role-${opt.value}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Work Link (mandatory) */}
                <div>
                  <Label className={`${textPrimary} mb-2 block`}>
                    Work Link <span className="text-[#ef4444]">*</span>
                    {approvalTask.work_link && (
                      <span className={`ml-2 text-xs font-normal ${textSecondary}`}>(auto-fetched from task)</span>
                    )}
                  </Label>
                  <input
                    type="url"
                    value={approvalDraft.work_link}
                    onChange={(e) => setApprovalDraft(prev => ({ ...prev, work_link: e.target.value }))}
                    placeholder="https://figma.com/... or drive.google.com/..."
                    className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                    data-testid="approval-work-link"
                  />
                </div>

                {/* Department selection removed — approval goes only to the selected approver role */}

                {/* Note */}
                <div>
                  <Label className={`${textPrimary} mb-2 block`}>Note <span className={`text-xs font-normal ${textSecondary}`}>(optional)</span></Label>
                  <textarea
                    value={approvalDraft.note}
                    onChange={(e) => setApprovalDraft(prev => ({ ...prev, note: e.target.value }))}
                    rows={3}
                    placeholder="Any context for the approver…"
                    className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                    data-testid="approval-note"
                  />
                </div>
              </CardContent>
              <div className="flex justify-end gap-2 px-6 pb-6">
                <Button variant="ghost" onClick={() => setApprovalTask(null)} disabled={approvalSubmitting}>Cancel</Button>
                <Button
                  onClick={async () => {
                    if (!approvalDraft.approver_role) {
                      toast.error('Please select an approver');
                      return;
                    }
                    if (!approvalDraft.work_link || !approvalDraft.work_link.trim()) {
                      toast.error('Work link is required');
                      return;
                    }
                    setApprovalSubmitting(true);
                    try {
                      await axios.post(
                        `${API}/api/our-tasks/tasks/${approvalTask.task_id}/request-approval`,
                        { ...approvalDraft, work_link: approvalDraft.work_link.trim() },
                        { headers }
                      );
                      toast.success('Approval request sent');
                      setApprovalTask(null);
                      setApprovalDraft({ approver_role: '', note: '', work_link: '' });
                      loadTasks();
                    } catch (error) {
                      toast.error(error.response?.data?.detail || 'Failed to send for approval');
                    } finally {
                      setApprovalSubmitting(false);
                    }
                  }}
                  disabled={approvalSubmitting}
                  className="bg-[#10b981] hover:bg-[#059669] text-white"
                  data-testid="approval-submit-btn"
                >
                  {approvalSubmitting ? 'Sending…' : 'Send for Approval'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Edit Time mini popup — clean Hours / Minutes / AM-PM inputs */}
        {editTimeModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setEditTimeModal(null)}
            data-testid="edit-time-modal"
          >
            <div
              className="w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-[#27272a] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#fafafa]">Edit Task Time</h3>
                  <p className="text-xs text-[#a1a1aa] mt-0.5 truncate max-w-[300px]">
                    {editTimeModal.task?.task_name}
                  </p>
                </div>
                <button
                  onClick={() => setEditTimeModal(null)}
                  className="text-[#a1a1aa] hover:text-[#fafafa]"
                  data-testid="edit-time-close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Start Time */}
                <div>
                  <Label className="text-xs text-[#a1a1aa] uppercase tracking-wide">Start Time</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={editTimeModal.sH}
                      onChange={(e) => setEditTimeModal((m) => ({ ...m, sH: e.target.value }))}
                      className="w-20 text-center text-2xl font-normal text-[#fafafa] bg-[#27272a] border border-[#3f3f46] rounded-lg py-2"
                      data-testid="edit-time-start-hour"
                    />
                    <span className="text-2xl text-[#a1a1aa]">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={String(editTimeModal.sM).padStart(2, '0')}
                      onChange={(e) => setEditTimeModal((m) => ({ ...m, sM: e.target.value }))}
                      className="w-20 text-center text-2xl font-normal text-[#fafafa] bg-[#27272a] border border-[#3f3f46] rounded-lg py-2"
                      data-testid="edit-time-start-min"
                    />
                    <div className="ml-2 flex gap-1">
                      {['AM', 'PM'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEditTimeModal((m) => ({ ...m, sP: p }))}
                          className={`px-3 py-2 text-sm rounded-lg border ${
                            editTimeModal.sP === p
                              ? 'bg-[#6366f1] border-[#6366f1] text-white'
                              : 'bg-[#27272a] border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa]'
                          }`}
                          data-testid={`edit-time-start-${p.toLowerCase()}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* End Time */}
                <div>
                  <Label className="text-xs text-[#a1a1aa] uppercase tracking-wide">End Time</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={editTimeModal.eH}
                      onChange={(e) => setEditTimeModal((m) => ({ ...m, eH: e.target.value }))}
                      className="w-20 text-center text-2xl font-normal text-[#fafafa] bg-[#27272a] border border-[#3f3f46] rounded-lg py-2"
                      data-testid="edit-time-end-hour"
                    />
                    <span className="text-2xl text-[#a1a1aa]">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={String(editTimeModal.eM).padStart(2, '0')}
                      onChange={(e) => setEditTimeModal((m) => ({ ...m, eM: e.target.value }))}
                      className="w-20 text-center text-2xl font-normal text-[#fafafa] bg-[#27272a] border border-[#3f3f46] rounded-lg py-2"
                      data-testid="edit-time-end-min"
                    />
                    <div className="ml-2 flex gap-1">
                      {['AM', 'PM'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEditTimeModal((m) => ({ ...m, eP: p }))}
                          className={`px-3 py-2 text-sm rounded-lg border ${
                            editTimeModal.eP === p
                              ? 'bg-[#6366f1] border-[#6366f1] text-white'
                              : 'bg-[#27272a] border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa]'
                          }`}
                          data-testid={`edit-time-end-${p.toLowerCase()}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#71717a]">
                  Tip: you can edit these times any number of times — they lock only after Operations approves the task.
                </p>
              </div>

              <div className="p-4 border-t border-[#27272a] flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditTimeModal(null)}
                  className="border-[#3f3f46] text-[#fafafa]"
                  data-testid="edit-time-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const draft = {
                      start: joinHM({ h: editTimeModal.sH, m: editTimeModal.sM, p: editTimeModal.sP }),
                      end: joinHM({ h: editTimeModal.eH, m: editTimeModal.eM, p: editTimeModal.eP }),
                    };
                    handleSaveTimeRow(editTimeModal.task.task_id, draft);
                  }}
                  className="bg-[#10b981] hover:bg-[#059669] text-white"
                  data-testid="edit-time-save"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Break-time conflict warning popup */}
        {breakConflictModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setBreakConflictModal(null)}
            data-testid="break-conflict-modal"
          >
            <div
              className="w-full max-w-md bg-[#18181b] border border-[#f59e0b] rounded-xl shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-[#27272a]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#f59e0b]/20 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-[#f59e0b]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#fafafa]">Time conflicts with a break</h3>
                    <p className="text-xs text-[#a1a1aa]">Tasks can&apos;t be logged during a recorded break.</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-[#27272a] flex items-center justify-between">
                  <span className="text-[#a1a1aa]">Your task time</span>
                  <span className="text-[#fafafa] font-mono">
                    {breakConflictModal.taskStart} – {breakConflictModal.taskEnd}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-center justify-between">
                  <span className="text-[#f59e0b] font-semibold">{formatBreakLabel(breakConflictModal.breakInfo?.category)} break</span>
                  <span className="text-[#fafafa] font-mono">
                    {formatTimeOnly(breakConflictModal.bStart.toISOString())} – {breakConflictModal.bEnd ? formatTimeOnly(breakConflictModal.bEnd.toISOString()) : 'now'}
                  </span>
                </div>
                <p className="text-xs text-[#a1a1aa]">
                  Pick a different window before <strong className="text-[#fafafa]">{formatTimeOnly(breakConflictModal.bStart.toISOString())}</strong> or after <strong className="text-[#fafafa]">{breakConflictModal.bEnd ? formatTimeOnly(breakConflictModal.bEnd.toISOString()) : 'now'}</strong>.
                </p>
              </div>
              <div className="p-4 border-t border-[#27272a] flex justify-end">
                <Button
                  onClick={() => setBreakConflictModal(null)}
                  className="bg-[#f59e0b] hover:bg-[#d97706] text-white"
                  data-testid="break-conflict-ok"
                >
                  Got it
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  return inModal ? content : <Layout>{content}</Layout>;
}
