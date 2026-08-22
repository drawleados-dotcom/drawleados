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
import { SearchableSelect } from '../components/ui/searchable-select';
import {
  Plus, Calendar, Clock, User, CheckCircle2, Circle, 
  MoreHorizontal, Trash2, Edit2, X, AlertCircle, Briefcase, Building2,
  Play, Pause, Square, Timer, Eye, FileText, Tag, Users, Link, Filter, CalendarDays,
  Repeat, Video, ListChecks, ShieldCheck, Crown, Check, History, BarChart3
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
import { buildErpPrompt } from '../utils/erpPrompt';
import { ERP_TASK_TYPE_OPTIONS } from '../utils/erpTaskTypes';

const API = process.env.REACT_APP_BACKEND_URL;

const priorityColors = {
  high: 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]',
  medium: 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]',
  low: 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]'
};

// Solid color per priority — red/amber/green — shown as the row's left-edge
// bar and the priority badge text. The row itself stays a plain light/dark
// background; only this accent carries the tier signal.
const priorityDotColors = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981'
};

// Distinct color per sub-department (Sales, Marketing, HR, ...) so rows are
// visually scannable at a glance. Picked deterministically from a fixed
// palette by name/id, so any custom sub-department someone adds later still
// gets a stable, distinct color without needing to hardcode every label.
const SUB_DEPT_PALETTE = [
  { bg: 'bg-[#3b82f6]/20', text: 'text-[#3b82f6]' }, // blue
  { bg: 'bg-[#10b981]/20', text: 'text-[#10b981]' }, // green
  { bg: 'bg-[#f59e0b]/20', text: 'text-[#f59e0b]' }, // amber
  { bg: 'bg-[#8b5cf6]/20', text: 'text-[#8b5cf6]' }, // purple
  { bg: 'bg-[#ec4899]/20', text: 'text-[#ec4899]' }, // pink
  { bg: 'bg-[#06b6d4]/20', text: 'text-[#06b6d4]' }, // cyan
  { bg: 'bg-[#ef4444]/20', text: 'text-[#ef4444]' }, // red
];
const subDeptColor = (key) => {
  const s = String(key || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return SUB_DEPT_PALETTE[hash % SUB_DEPT_PALETTE.length];
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
  // Remembers the last main tab across a hard refresh (localStorage) so a refresh
  // while on Operations/Projects doesn't drop the user back to My Tasks. Never
  // overrides an explicit defaultTab (e.g. the Approvals deep link modal).
  const [mainTab, setMainTab] = useState(() => {
    if (inModal || defaultTab !== 'assigned_to_me') return defaultTab;
    try {
      return localStorage.getItem('dl_our_tasks_main_tab') || defaultTab;
    } catch {
      return defaultTab;
    }
  }); // assigned_to_me, assign_to_team, projects, departments, approvals, meetings

  useEffect(() => {
    if (inModal) return;
    try { localStorage.setItem('dl_our_tasks_main_tab', mainTab); } catch { /* ignore storage errors */ }
  }, [mainTab, inModal]);
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
  // Super-Admin-only "Operation" umbrella pill — when active, the dept sub-tabs
  // bar nests every non-Management department as a second row (see visibleDeptCategoriesForBar).
  const [opGroupActive, setOpGroupActive] = useState(false);
  // Technology / Marketing scope within the Operation umbrella — narrows
  // which of those departments show as pills below it. Sourced from each
  // department's own `group` field (set in Operations > Departments).
  const [opGroupFilter, setOpGroupFilter] = useState('all');
  const [viewingTask, setViewingTask] = useState(null);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [runningTimers, setRunningTimers] = useState({});
  // Tasks whose status changed via an action taken in THIS view (e.g. Start
  // Timer flips pending → in_progress). Without this, a task acted on while
  // a status filter (like "Pending") is active would vanish from the list
  // mid-interaction, making the button look broken. Cleared whenever the
  // status filter itself changes.
  const [statusFilterBypassIds, setStatusFilterBypassIds] = useState(() => new Set());
  const [editingTimeRow, setEditingTimeRow] = useState(null); // task_id currently in row-edit mode (legacy, no longer used for inline)
  const [timeDrafts, setTimeDrafts] = useState({}); // {task_id: {start: 'HH:MM', end: 'HH:MM'}} (legacy)
  const [editTimeModal, setEditTimeModal] = useState(null); // { task, sH, sM, sP, eH, eM, eP }
  // Completion summary — clicking Complete first shows the task's worked/break
  // timeline for a last look, then hands off to Send for Approval. Completing
  // isn't self-serve: it goes through an approver.
  const [completeSummaryTask, setCompleteSummaryTask] = useState(null);
  // Approval request popup
  const [approvalTask, setApprovalTask] = useState(null); // task currently being submitted for approval
  const [approvalDraft, setApprovalDraft] = useState({ approver_role: '', note: '', work_link: '' });
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  // Meta Ads daily "Submit Report" popup — task currently being reported on
  const [reportTask, setReportTask] = useState(null);
  const [reportProject, setReportProject] = useState(null); // freshly-fetched project (for its campaigns list)
  const [reportDate, setReportDate] = useState('');
  const [reportRows, setReportRows] = useState([]);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [showFilters, setShowFilters] = useState(true); // Show filters by default
  
  // Advanced filters
  const [filters, setFilters] = useState({
    dateFilter: 'all', // all, today, range - default to all
    dateFrom: '',
    dateTo: '',
    assignedTo: 'all', // all, myself, or user_id
    assignedBy: 'all', // all or user_id
    taskType: 'all', // all, general, meeting, follow_up, proposal, call
    status: 'pending', // all, pending, in_progress, completed, on_hold — defaults to Pending for both My Tasks and Assign to Team, so the list opens on what still needs doing
    singleDate: '', // for single date filter
    department: 'all', // all or dept_key
    subDepartment: 'all', // all or sub_department id (only meaningful once a specific department is selected)
    project: 'all', // all or project_id
    category: 'all', // all or category name (depends on selected department)
    priority: 'all' // all, high, medium, low
  });
  
  const token = localStorage.getItem('session_token');
  // CRITICAL: useMemo so the `headers` object identity is stable across renders.
  // Without this, every child component (ProjectsPanel, DepartmentsPanel) receives
  // a new `headers` prop on every render → their loadXyz useCallback identity
  // changes → their useEffect fires constantly → "Loading…" blinks every frame.
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const normalizedDesignation = (user?.designation || '').toLowerCase().trim();
  const isHeadOfOperations = normalizedDesignation === 'operation head' ||
                             normalizedDesignation === 'head of operations' ||
                             (normalizedDesignation.includes('head') && normalizedDesignation.includes('operation'));

  // Head of Operations lands on Projects (their first/primary tab) instead of
  // My Tasks. Only fires once when the user first loads on the untouched
  // default tab — doesn't fight a later manual switch to My Tasks, and never
  // overrides an explicit defaultTab (e.g. the Approvals deep link modal).
  useEffect(() => {
    if (defaultTab !== 'assigned_to_me') return;
    if (!user) return;
    if (isHeadOfOperations && mainTab === 'assigned_to_me') {
      setMainTab('projects');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, isHeadOfOperations]);

  // Super Admin lands on the Management department by default (instead of
  // the unfiltered "all" view spanning Management + Operation) so their most
  // relevant task set is front and center right after a page load/refresh —
  // fires once per login, doesn't fight a later manual switch to Operation.
  useEffect(() => {
    if (!user) return;
    const role = (user.role || '').toLowerCase();
    if (role === 'super_admin') {
      setFilters(prev => (prev.department === 'all' ? { ...prev, department: 'management' } : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id]);

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
    priority: '',
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
    website_page_id: '',
    website_page_name: '',
    erp_user_id: '',
    erp_user_name: '',
    erp_page_id: '',
    erp_page_name: '',
    erp_sub_tab_id: '',
    erp_sub_tab_name: '',
    erp_ultra_sub_tab_id: '',
    erp_ultra_sub_tab_name: '',
    erp_ultra_tab_id: '',
    erp_ultra_tab_name: '',
    erp_task_type: '',
    sub_department_id: '',
    sub_department_name: '',
    workflow_id: '',
    workflow_name: '',
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
  const [allDesignations, setAllDesignations] = useState([]);
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
      const pendingApprovals = aRes.data || [];
      setApprovalsCount(
        isHeadOfOperations
          ? pendingApprovals.filter(t => (t.approval_request?.approver_role || '').toLowerCase() === 'operations').length
          : pendingApprovals.length
      );
      setMeetingsCount((mRes.data || []).length);
      setAllDesignations(desRes.data || []);
      // Find my designation
      const userDesg = (user?.designation || '').toLowerCase().trim();
      const found = (desRes.data || []).find(
        d => (d.title || '').toLowerCase().trim() === userDesg
      );
      setMyDesignation(found || null);
    } catch (error) {
      console.error('Error loading projects/categories:', error);
    }
  }, [user?.designation, isHeadOfOperations]);

  // Filter dept categories visible to the current user based on their designation's
  // operations_departments. Super Admin / Admin always see ALL departments (including
  // newly-added custom ones like "Management") — a designation-level allow-list only
  // restricts non-admin staff, and never overrides the admin roles' full access even
  // when that designation config predates a newly created department.
  const visibleDeptCategories = useMemo(() => {
    const role = (user?.role || '').toLowerCase();
    if (role === 'super_admin' || role === 'admin') return deptCategoriesForTask;
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
    // No designation-level restriction → everyone sees all departments
    return deptCategoriesForTask;
  }, [deptCategoriesForTask, myDesignation, user?.role]);

  // Dept pills actually rendered in the sub-tabs bar. In Assign to Team,
  // Management is a super-admin-only concern — everyone else browsing the
  // team's tasks doesn't need it cluttering the filter bar.
  const visibleDeptCategoriesForBar = useMemo(() => {
    const role = (user?.role || '').toLowerCase();
    if (mainTab === 'assign_to_team' && role !== 'super_admin') {
      return visibleDeptCategories.filter(d => d.dept_key !== 'management');
    }
    return visibleDeptCategories;
  }, [visibleDeptCategories, mainTab, user?.role]);

  // Reset the Operation umbrella grouping whenever the main tab changes so
  // it never bleeds stale state between My Tasks / Assign to Team.
  useEffect(() => {
    setOpGroupActive(false);
    setOpGroupFilter('all');
  }, [mainTab]);

  const usersById = useMemo(() => {
    const map = {};
    (users || []).forEach(u => { map[u.user_id] = u; });
    return map;
  }, [users]);

  const designationByTitle = useMemo(() => {
    const map = {};
    (allDesignations || []).forEach(d => { map[(d.title || '').toLowerCase().trim()] = d; });
    return map;
  }, [allDesignations]);

  // Sub-departments (under Management) the CURRENT user's own designation
  // grants them — null means unrestricted (super_admin/admin, or a
  // designation with no sub-dept allow-list configured yet).
  const allowedManagementSubDepts = useMemo(() => {
    const role = (user?.role || '').toLowerCase();
    if (role === 'super_admin' || role === 'admin') return null;
    const allowed = myDesignation?.operations_management_subdepts || [];
    return allowed.length > 0 ? new Set(allowed) : null;
  }, [user?.role, myDesignation]);

  // Sub-departments actually selectable for a given department — filters
  // Management's full sub-department list down to what this user is allowed.
  const getSelectableSubDepts = useCallback((deptKey) => {
    const all = deptCategoriesForTask.find(d => d.dept_key === deptKey)?.sub_departments || [];
    if (deptKey !== 'management' || !allowedManagementSubDepts) return all;
    return all.filter(sd => allowedManagementSubDepts.has(sd.id));
  }, [deptCategoriesForTask, allowedManagementSubDepts]);

  // Does the given user's OWN designation grant them this Management
  // sub-department? Used to filter who a Management/sub-dept task can be
  // assigned to — mirrors the same allow-list rule applied to the viewer above.
  const userHasManagementSubDept = useCallback((userId, subDeptId) => {
    if (!subDeptId) return true;
    const u = usersById[userId];
    if (!u) return true;
    const role = (u.role || '').toLowerCase();
    if (role === 'super_admin' || role === 'admin') return true;
    const desg = designationByTitle[(u.designation || '').toLowerCase().trim()];
    const mgmtDepts = (desg?.operations_departments || []).map(x => String(x).toLowerCase());
    if (!mgmtDepts.includes('management')) return false;
    const allowedSub = desg?.operations_management_subdepts || [];
    if (allowedSub.length === 0) return true;
    return allowedSub.includes(subDeptId);
  }, [usersById, designationByTitle]);

  // Project-scoped tasks created by the Super Admin are routed to managers/
  // leads (Assign to Team access) rather than the assignee's own My Tasks —
  // doesn't apply to the creator viewing their own created tasks.
  const isHiddenProjectTaskForAssignee = useCallback((task) => {
    if (task.assigned_to !== user?.user_id || task.created_by === user?.user_id) return false;
    if (!task.project_id) return false;
    const creatorRole = (usersById[task.created_by]?.role || '').toLowerCase();
    if (creatorRole !== 'super_admin') return false;
    const myRole = (user?.role || '').toLowerCase();
    const myPrivileged = myRole === 'super_admin' || myRole === 'admin';
    const myCfg = user?.designation_config || {};
    const hasAssignToTeamAccess = myPrivileged || !!myCfg.operations_assign_to_team;
    return !hasAssignToTeamAccess;
  }, [user?.user_id, user?.role, user?.designation_config, usersById]);

  useEffect(() => {
    loadTasks();
    loadUsers();
    loadProjectsAndCategories();
  }, [loadTasks, loadUsers, loadProjectsAndCategories]);

  // Auto-refresh: every 15s + immediate on tab focus / visibility change.
  // Pause polling while the create/edit modal is open to avoid clobbering user input.
  useAutoRefresh(
    [loadTasks, loadUsers, loadProjectsAndCategories],
    { enabled: !showCreateModal && !editingTask && !editTimeModal && !approvalTask && !completeSummaryTask }
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

  // Tab-scoped summary computed from the already-loaded tasks, so the cards
  // always reflect the active main tab (My Tasks vs Assign to Team) and the
  // selected date.
  const tabScopedSummary = useMemo(() => {
    const isMine = (t) => t.assigned_to === user?.user_id || t.created_by === user?.user_id;
    let pool;
    if (mainTab === 'assigned_to_me') {
      pool = tasks.filter(isMine);
    } else if (mainTab === 'assign_to_team') {
      const role = (user?.role || '').toLowerCase().trim();
      const desg = (user?.designation || '').toLowerCase().trim();
      const isPrivileged = role === 'super_admin' || role === 'admin' || desg.includes('operation');
      if (isPrivileged) pool = tasks;
      else {
        const myDepts = myDesignation?.operations_departments || [];
        pool = tasks.filter(t =>
          (t.created_by === user?.user_id && t.assigned_to !== user?.user_id) ||
          (t.department && myDepts.includes(t.department) && t.assigned_to !== user?.user_id)
        );
      }
    } else {
      pool = tasks;
    }

    // Filter by selected summaryDate (compare local YYYY-MM-DD on planned_date/created_at)
    const onDate = pool.filter(t => {
      const d = (t.planned_date || t.created_at || '').toString().slice(0, 10);
      return d === summaryDate;
    });

    const wsec = onDate.reduce((s, t) => s + Number(t?.time_tracking?.total_seconds || 0), 0);
    const fmtH = (sec) => `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`;

    return {
      worked_hours: { formatted: fmtH(wsec) },
      total_to_do: pool.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
      pending: pool.filter(t => t.status === 'pending').length,
      awaiting_ops: pool.filter(t => t.approval_request?.status === 'pending_ops' || t.approval_request?.queue === 'operations').length,
      awaiting_ceo: pool.filter(t => t.approval_request?.status === 'pending_ceo' || t.approval_request?.queue === 'ceo').length,
    };
  }, [tasks, mainTab, user, myDesignation, summaryDate]);

  // Create task
  const handleCreateTask = async () => {
    if (submitting) return; // ignore double-clicks
    if (!formData.task_name.trim()) {
      toast.error('Task name is required');
      return;
    }
    if (!formData.priority) {
      toast.error('Please pick a Priority for this task');
      return;
    }
    // Department is mandatory for every task — My Tasks and Assign to Team
    // alike — so every task is always traceable to a department. Meetings
    // (team/client) are the exception: they aren't project work and don't
    // belong to any single department. Project is optional — some teams
    // (e.g. SEO) don't have projects to attach a task to.
    if (!MEETING_FAMILY_FE.has((formData.type || '').toLowerCase())) {
      if (!formData.department) {
        toast.error('Please select a Department');
        return;
      }
    }
    if (!formData.type) {
      toast.error('Please pick a Type for this task');
      return;
    }
    // Category is mandatory once a department is picked — but only when that
    // department actually has categories configured (e.g. Management has
    // none, so it shouldn't be blocked on an empty dropdown).
    if (
      formData.department && formData.department !== 'all' && !formData.category &&
      (deptCategoriesForTask.find(d => d.dept_key === formData.department)?.categories || []).length > 0
    ) {
      toast.error('Please select a Category');
      return;
    }
    // Website tasks must be tagged to a Page (or explicitly "Others") once a
    // project is picked, so every page's work is actually traceable to it.
    if (formData.department === 'website' && formData.project_id && !formData.website_page_id) {
      toast.error('Please select a Page');
      return;
    }
    // ERP tasks must be tagged to a User + Page once a project is picked.
    if (formData.department === 'erp' && formData.project_id) {
      if (!formData.erp_user_id) { toast.error('Please select a User'); return; }
      if (!formData.erp_page_id) { toast.error('Please select a Page'); return; }
    }
    // Departments with Sub Departments configured (e.g. Management) must be
    // tagged to one — department-scoped, so this doesn't wait on a project.
    if (getSelectableSubDepts(formData.department).length > 0 && !formData.sub_department_id) {
      toast.error('Please select a Sub Department');
      return;
    }
    // Require due_date when recurrence is set
    if (formData.recurrence && formData.recurrence !== 'none' && !formData.due_date) {
      toast.error('Start date is required for recurring tasks');
      return;
    }
    setSubmitting(true);
    try {
      // Outside the Assign-to-Team tab, the Assign To dropdown is hidden — always
      // default the assignee to the current user.
      const payload = { ...formData };
      if (mainTab !== 'assign_to_team') {
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
    if (!formData.priority) {
      toast.error('Please pick a Priority for this task');
      return;
    }
    if (!MEETING_FAMILY_FE.has((formData.type || '').toLowerCase())) {
      if (!formData.department) {
        toast.error('Please select a Department');
        return;
      }
    }
    if (!formData.type) {
      toast.error('Please pick a Type for this task');
      return;
    }
    if (
      formData.department && formData.department !== 'all' && !formData.category &&
      (deptCategoriesForTask.find(d => d.dept_key === formData.department)?.categories || []).length > 0
    ) {
      toast.error('Please select a Category');
      return;
    }
    if (formData.department === 'website' && formData.project_id && !formData.website_page_id) {
      toast.error('Please select a Page');
      return;
    }
    if (formData.department === 'erp' && formData.project_id) {
      if (!formData.erp_user_id) { toast.error('Please select a User'); return; }
      if (!formData.erp_page_id) { toast.error('Please select a Page'); return; }
    }
    if (getSelectableSubDepts(formData.department).length > 0 && !formData.sub_department_id) {
      toast.error('Please select a Sub Department');
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

  // Daily "Submit Report" popup — only tasks tagged Category = "Report", on
  // departments that track a Campaigns list to report against (Meta Ads,
  // SEO).
  const isReportCategory = (cat) => (cat || '').trim().toLowerCase() === 'report';
  const REPORT_ENABLED_DEPARTMENTS = ['meta', 'seo'];
  const REPORT_DEPARTMENT_LABEL = { meta: 'Meta Ads', seo: 'SEO' };

  const newReportRow = () => ({
    row_id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    campaign_id: '',
    campaign_name: '',
    total_leads: '',
    cost_per_lead: '',
    total_spend: '',
    quality: 'good',
    convert: '',
    remarks: '',
  });

  const openReportModal = async (task) => {
    setReportTask(task);
    setReportProject(null);
    setReportDate(task.due_date ? task.due_date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setReportRows([newReportRow()]);
    // Campaigns are managed on the project's own Campaigns tab, so fetch
    // that project fresh here rather than relying on the possibly-stale
    // cached project list from the My Tasks / Assign to Team page.
    if (task.project_id) {
      try {
        const res = await axios.get(`${API}/api/projects/${task.project_id}?_=${Date.now()}`, { headers });
        setReportProject(res.data);
      } catch (error) {
        toast.error('Failed to load campaigns for this project');
      }
    }
  };
  const closeReportModal = () => {
    setReportTask(null);
    setReportProject(null);
    setReportRows([]);
  };
  const addReportRow = () => setReportRows(rows => [...rows, newReportRow()]);
  const removeReportRow = (rowId) => setReportRows(rows => rows.filter(r => r.row_id !== rowId));
  const updateReportRow = (rowId, patch) => setReportRows(rows => rows.map(r => (r.row_id === rowId ? { ...r, ...patch } : r)));

  const handleSubmitReport = async () => {
    if (!reportDate) { toast.error('Date is required'); return; }
    const validRows = reportRows.filter(r => r.campaign_id);
    if (validRows.length === 0) { toast.error('Please select at least one campaign'); return; }
    setSubmittingReport(true);
    try {
      await axios.post(`${API}/api/meta-reports`, {
        project_id: reportTask.project_id,
        task_id: reportTask.task_id,
        date: reportDate,
        entries: validRows.map(r => ({
          campaign_id: r.campaign_id,
          campaign_name: r.campaign_name,
          total_leads: Number(r.total_leads) || 0,
          cost_per_lead: Number(r.cost_per_lead) || 0,
          total_spend: Number(r.total_spend) || 0,
          quality: r.quality,
          convert: Number(r.convert) || 0,
          remarks: r.remarks,
        })),
      }, { headers });
      toast.success('Report submitted');
      closeReportModal();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };

  // Update task status
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await axios.patch(`${API}/api/our-tasks/tasks/${taskId}/status`, { status: newStatus }, { headers });
      toast.success('Status updated');
      setStatusFilterBypassIds(prev => new Set(prev).add(taskId));
      loadTasks();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Time tracking actions
  const handleTimeTracking = async (taskId, action) => {
    try {
      await axios.post(`${API}/api/our-tasks/tasks/${taskId}/time`, { action }, { headers });
      toast.success(`Timer ${action === 'start' ? 'started' : action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'finished'}`);
      setStatusFilterBypassIds(prev => new Set(prev).add(taskId));
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

  // Once a task has been sent for approval it stops being the assignee's to
  // change: Complete disappears (it's already on its way to an approver) and
  // the pencil-edit is disabled, so the work can't be rewritten out from under
  // the approver looking at it. A *rejected* request is deliberately NOT
  // locked — that's the case where the assignee has to fix it and resend.
  const isAwaitingOrApproved = (task) => {
    const s = task?.approval_request?.status;
    return s === 'pending' || s === 'approved';
  };

  // Reconstruct a task's work/break timeline from its timer sessions. A break
  // isn't stored anywhere: it's simply the gap between one session ending and
  // the next one starting, which is exactly what pausing the timer leaves
  // behind. A session with no `end` is still running, so it's measured to now.
  const buildTimeHistory = (task) => {
    const sessions = (task?.time_tracking?.sessions || [])
      .filter(s => s?.start)
      .slice()
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    const entries = [];
    let workedSeconds = 0;
    let breakSeconds = 0;

    sessions.forEach((s, i) => {
      const running = !s.end;
      const seconds = running
        ? Math.max(0, Math.round((Date.now() - new Date(s.start).getTime()) / 1000))
        : Number(s.duration_seconds || 0);
      workedSeconds += seconds;
      entries.push({ kind: 'work', start: s.start, end: s.end, seconds, running });

      const next = sessions[i + 1];
      if (s.end && next?.start) {
        const gap = Math.max(0, Math.round((new Date(next.start) - new Date(s.end)) / 1000));
        if (gap > 0) {
          breakSeconds += gap;
          entries.push({ kind: 'break', start: s.end, end: next.start, seconds: gap });
        }
      }
    });

    const last = sessions[sessions.length - 1];
    return {
      entries,
      workedSeconds,
      breakSeconds,
      start: sessions[0]?.start || null,
      end: last && last.end ? last.end : null,
      running: !!(last && !last.end),
      breakCount: entries.filter(e => e.kind === 'break').length,
    };
  };

  // Absolute clock time for the completion summary — date + time, IST.
  const fmtStamp = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return '—'; }
  };

  const fmtClock = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  };

  // People paste whole bug reports in as the task title, which blows the row
  // height out and pushes everything else off screen. The table shows the
  // first 10 words; the full text is still in the tooltip and the detail popup.
  const truncateWords = (text, limit = 10) => {
    const words = String(text || '').trim().split(/\s+/);
    if (words.length <= limit) return String(text || '');
    return words.slice(0, limit).join(' ') + '...';
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

  // HTML min/max on type="number" only affects the spinner arrows, not free typing —
  // clamp here so values like "8989" can't be typed into the minute field.
  const clampHour = (raw) => {
    if (raw === '') return '';
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return '';
    return String(Math.min(12, Math.max(1, n)));
  };
  const clampMinute = (raw) => {
    if (raw === '') return '';
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return '';
    return String(Math.min(59, Math.max(0, n)));
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
    if (isApproved) {
      return (
        <Badge className="bg-[#3f3f46] text-[#a1a1aa] h-8 px-3 flex items-center" title="Locked — approved by Operations">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Locked
        </Badge>
      );
    }

    // Live timer controls + manual Edit (both available side-by-side)
    const editBtn = (
      <Button
        size="sm"
        variant="outline"
        onClick={() => openEditTimeModal(task)}
        className={`h-8 px-2 ${borderColor} ${textSecondary} hover:${textPrimary}`}
        data-testid={`time-edit-btn-${task.task_id}`}
        title="Manually enter Start & End time"
      >
        <Edit2 className="h-3 w-3" />
      </Button>
    );

    if (status === 'finished') {
      // Once started and stopped, the recorded time is locked — no more manual edits.
      return (
        <Badge className="bg-[#10b981]/20 text-[#10b981]">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Done {formatDuration(tracking.total_seconds || 0)}
        </Badge>
      );
    }

    if (status === 'running') {
      return (
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() => handleTimeTracking(task.task_id, 'pause')}
            className="bg-[#f59e0b] hover:bg-[#d97706] text-white h-8 px-2"
            data-testid={`time-pause-btn-${task.task_id}`}
            title="Pause"
          >
            <Pause className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            onClick={() => handleTimeTracking(task.task_id, 'finish')}
            className="bg-[#10b981] hover:bg-[#059669] text-white h-8 px-2"
            data-testid={`time-finish-btn-${task.task_id}`}
            title="Finish"
          >
            <Square className="h-3 w-3" />
          </Button>
          {editBtn}
        </div>
      );
    }

    if (status === 'paused') {
      return (
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() => handleTimeTracking(task.task_id, 'resume')}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white h-8 px-2"
            data-testid={`time-resume-btn-${task.task_id}`}
            title="Resume"
          >
            <Play className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            onClick={() => handleTimeTracking(task.task_id, 'finish')}
            className="bg-[#10b981] hover:bg-[#059669] text-white h-8 px-2"
            data-testid={`time-finish-btn-${task.task_id}`}
            title="Finish"
          >
            <Square className="h-3 w-3" />
          </Button>
          {editBtn}
        </div>
      );
    }

    // not_started — show Start + Edit (manual)
    return (
      <div className="flex gap-1">
        <Button
          size="sm"
          onClick={() => handleTimeTracking(task.task_id, 'start')}
          className="bg-[#10b981] hover:bg-[#059669] text-white h-8 px-2"
          data-testid={`time-start-btn-${task.task_id}`}
          title="Start timer"
        >
          <Play className="h-3 w-3" />
        </Button>
        {editBtn}
      </div>
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
      priority: '',
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
      website_page_id: '',
      website_page_name: '',
      erp_user_id: '',
      erp_user_name: '',
      erp_page_id: '',
      erp_page_name: '',
      erp_sub_tab_id: '',
      erp_sub_tab_name: '',
      erp_ultra_sub_tab_id: '',
      erp_ultra_sub_tab_name: '',
      erp_ultra_tab_id: '',
      erp_ultra_tab_name: '',
      erp_task_type: '',
      sub_department_id: '',
      sub_department_name: '',
      workflow_id: '',
      workflow_name: '',
    });
    setShowCustomRecurrence(false);
  };

  const openEditModal = (task) => {
    setFormData({
      task_name: task.task_name,
      description: task.description || '',
      priority: task.priority || '',
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
      work_link: task.work_link || '',
      department: task.department || '',
      project_id: task.project_id || '',
      project_name: task.project_name || '',
      category: task.category || '',
      website_page_id: task.website_page_id || '',
      website_page_name: task.website_page_name || '',
      erp_user_id: task.erp_user_id || '',
      erp_user_name: task.erp_user_name || '',
      erp_page_id: task.erp_page_id || '',
      erp_page_name: task.erp_page_name || '',
      erp_sub_tab_id: task.erp_sub_tab_id || '',
      erp_sub_tab_name: task.erp_sub_tab_name || '',
      erp_ultra_sub_tab_id: task.erp_ultra_sub_tab_id || '',
      erp_ultra_sub_tab_name: task.erp_ultra_sub_tab_name || '',
      erp_ultra_tab_id: task.erp_ultra_tab_id || '',
      erp_ultra_tab_name: task.erp_ultra_tab_name || '',
      erp_task_type: task.erp_task_type || '',
      sub_department_id: task.sub_department_id || '',
      sub_department_name: task.sub_department_name || '',
      workflow_id: task.workflow_id || '',
      workflow_name: task.workflow_name || '',
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

  // Sort tasks by start_time. Default: ascending so manually-entered timings
  // appear chronologically (08:00, 14:30, 19:30) instead of in insertion order.
  // MUST be declared BEFORE filteredTasks/displayTasks because displayTasks
  // references `sortMode`.
  const [sortMode, setSortMode] = useState('asc'); // 'asc' | 'desc' | 'none'
  // Timeline (audit log) popup — Super Admin only.
  const [timelineTask, setTimelineTask] = useState(null);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const openTimelineModal = async (task) => {
    setTimelineTask(task);
    setTimelineEvents([]);
    setTimelineLoading(true);
    try {
      const r = await axios.get(
        `${API}/api/our-tasks/tasks/${task.task_id}/timeline`,
        { headers },
      );
      setTimelineEvents(r.data?.events || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load timeline');
    } finally {
      setTimelineLoading(false);
    }
  };


  // Single source of truth for task filtering. `tabCtx` lets us reuse the
  // predicate to compute counts for OTHER tabs without flipping `mainTab`
  // state (used by the tab badges — see myTabCount / teamTabCount below).
  const taskPasses = useCallback((task, tabCtx = mainTab) => {
    // Management-department tasks are Super Admin-only territory for general
    // browsing — an assignee/creator still sees their own, everyone else
    // (dept monitoring, team-wide views) does not.
    if (task.department === 'management') {
      const isSuperAdminViewer = (user?.role || '').toLowerCase() === 'super_admin';
      const isOwnTask = task.assigned_to === user?.user_id || task.created_by === user?.user_id;
      if (!isSuperAdminViewer && !isOwnTask) return false;
    }
    // Main Tab filter - Assigned to Me vs Assign to Team
    if (tabCtx === 'assigned_to_me') {
      // My Tasks = tasks assigned to me OR created by me (fix: was missing created_by)
      const isMine = task.assigned_to === user?.user_id || task.created_by === user?.user_id;
      if (!isMine) return false;
      if (isHiddenProjectTaskForAssignee(task)) return false;
    } else if (tabCtx === 'assign_to_team') {
      // Super Admin / Admin / Operation Head → see EVERY task in the org
      const role = (user?.role || '').toLowerCase().trim();
      const desg = (user?.designation || '').toLowerCase().trim();
      const isPrivileged = role === 'super_admin' || role === 'admin' ||
                           desg === 'operation head' || desg.includes('operation');
      if (!isPrivileged) {
        const myDepts = (myDesignation?.operations_departments || []);
        const createdByMe = task.created_by === user?.user_id && task.assigned_to !== user?.user_id;
        const inMyDept = task.department && (task.department === 'all' || myDepts.includes(task.department)) && task.assigned_to !== user?.user_id;
        if (!(createdByMe || inMyDept)) return false;
      }
    }

    // Quick filter (tabs)
    if (filter === 'my' && !(task.created_by === user?.user_id || task.assigned_to === user?.user_id)) return false;
    if (filter !== 'all' && filter !== 'my' && task.status !== filter) return false;

    // Date filter
    if (filters.dateFilter === 'today') {
      const today = getTodayString();
      if (!taskOccursOnDate(task, today)) {
        const taskDate = task.due_date || task.created_at?.split('T')[0];
        if (taskDate !== today) return false;
      }
    } else if (filters.dateFilter === 'single' && filters.singleDate) {
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

    // Department filter — a task marked "all" (Select All) belongs to every
    // department's view, so it always passes a specific-department filter.
    if (filters.department !== 'all' && task.department !== filters.department && task.department !== 'all') return false;

    // Sub Department filter — only meaningful once a specific department is
    // selected (the sub-tabs bar only shows it in that state).
    if (filters.subDepartment !== 'all' && task.sub_department_id !== filters.subDepartment) return false;

    // Project filter
    if (filters.project !== 'all' && task.project_id !== filters.project) return false;

    // Category filter (per-department categories from Operations → Departments)
    if (filters.category !== 'all' && task.category !== filters.category) return false;

    // Type filter
    if (filters.taskType !== 'all' && task.type !== filters.taskType) return false;

    // Status filter (from advanced filters) — a task acted on in this session
    // (e.g. Start Timer) stays visible even if its new status no longer
    // matches the filter, so the row doesn't vanish mid-interaction.
    if (filters.status !== 'all' && task.status !== filters.status && !statusFilterBypassIds.has(task.task_id)) return false;

    // Priority filter
    if (filters.priority !== 'all' && (task.priority || 'medium') !== filters.priority) return false;

    return true;
  }, [mainTab, filter, filters, user, myDesignation, isHiddenProjectTaskForAssignee, statusFilterBypassIds]);

  const filteredTasks = tasks.filter(t => taskPasses(t));

  // Cross-tab counts — keep "My Tasks" and "Assign to Team" badges in sync
  // with the active filter bar (date / project / department / status / etc).
  // Without this the badges showed all-time totals and never moved when the
  // user changed the date or any filter chip.
  const myTabCount = useMemo(
    () => tasks.filter(t => taskPasses(t, 'assigned_to_me')).length,
    [tasks, taskPasses]
  );
  const teamTabCount = useMemo(
    () => tasks.filter(t => taskPasses(t, 'assign_to_team')).length,
    [tasks, taskPasses]
  );

  // Collapse duplicate Meeting/Team-Meeting/Client-Meeting tasks (one row per
  // assignee) into a single grouped row in the "Assign to Team" view. Each
  // collapsed row carries `_group_members` describing all assignees and
  // `_group_size` for the UI badge. Outside the assign_to_team tab we render
  // the raw list (My Tasks must still show only the user's own row).
  const MEETING_FAMILY_FE = new Set(['meeting', 'team_meeting', 'client_meeting']);
  // Priority rank for sorting — urgent (high) first, then medium, then low.
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  const displayTasks = (() => {
    let out;
    if (mainTab !== 'assign_to_team') {
      out = filteredTasks;
    } else {
      const groups = new Map();
      out = [];
      for (const t of filteredTasks) {
        const type = (t.type || '').toLowerCase();
        if (!MEETING_FAMILY_FE.has(type)) {
          out.push(t);
          continue;
        }
        // Group key: stored meeting_group_id if set, else heuristic.
        const key = t.meeting_group_id
          || `mtg::${t.task_name || ''}::${t.due_date || ''}::${t.due_time || ''}::${t.created_by || ''}`;
        if (!groups.has(key)) {
          const member = {
            task_id: t.task_id,
            assigned_to: t.assigned_to,
            assigned_to_name: t.assigned_to_name || '—',
            status: t.status || 'pending',
          };
          const lead = { ...t, _group_members: [member], _group_size: 1, _group_key: key };
          groups.set(key, lead);
          out.push(lead);
        } else {
          const lead = groups.get(key);
          lead._group_members.push({
            task_id: t.task_id,
            assigned_to: t.assigned_to,
            assigned_to_name: t.assigned_to_name || '—',
            status: t.status || 'pending',
          });
          lead._group_size = lead._group_members.length;
        }
      }
    }
    // Row order is always: incomplete tasks before completed ones → priority
    // (urgent → medium → low, as whole tiers — every High sits above every
    // Medium, which sits above every Low) → due date (earliest first, no due
    // date last) → start time as a final tie-break (direction follows the
    // Start ↑/↓ toggle; ties beyond that keep original order for stability).
    const isDone = (t) => (t.status === 'completed' ? 1 : 0);
    const toMin = (t) => {
      const s = (t.start_time || '').trim();
      if (!s) return Number.POSITIVE_INFINITY;
      const m = s.match(/^(\d{1,2}):(\d{2})/);
      if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      // ISO fallback
      const dt = new Date(s);
      if (!isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();
      return Number.POSITIVE_INFINITY;
    };
    const toDueTime = (t) => {
      const d = (t.due_date || '').trim();
      if (!d) return Number.POSITIVE_INFINITY;
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? Number.POSITIVE_INFINITY : dt.getTime();
    };
    const sorted = [...out].map((t, i) => ({ t, i }));
    sorted.sort((a, b) => {
      const adone = isDone(a.t);
      const bdone = isDone(b.t);
      if (adone !== bdone) return adone - bdone;
      const ap = PRIORITY_RANK[a.t.priority] ?? 1;
      const bp = PRIORITY_RANK[b.t.priority] ?? 1;
      if (ap !== bp) return ap - bp;
      const ad = toDueTime(a.t);
      const bd = toDueTime(b.t);
      if (ad !== bd) return ad - bd;
      if (sortMode === 'none') return a.i - b.i;
      const am = toMin(a.t);
      const bm = toMin(b.t);
      if (am === bm) return a.i - b.i; // stable
      return sortMode === 'asc' ? am - bm : bm - am;
    });
    return sorted.map((x) => x.t);
  })();

  // Summary cards derived from the SAME filtered pool that drives the table.
  // This way, picking a department / person / project / category / status in
  // the filter bar automatically rolls the numbers up in the five summary cards
  // (Worked Hours · To-Do · Pending · Awaiting Ops · Awaiting CEO).
  const filterScopedSummary = (() => {
    const wsec = filteredTasks.reduce((s, t) => s + Number(t?.time_tracking?.total_seconds || 0), 0);
    const fmtH = (sec) => `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`;
    return {
      worked_hours: { formatted: fmtH(wsec) },
      total_to_do: filteredTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
      pending: filteredTasks.filter(t => t.status === 'pending').length,
      awaiting_ops: filteredTasks.filter(t => t.approval_request?.status === 'pending_ops' || t.approval_request?.queue === 'operations').length,
      awaiting_ceo: filteredTasks.filter(t => t.approval_request?.status === 'pending_ceo' || t.approval_request?.queue === 'ceo').length,
      completed: filteredTasks.filter(t => t.status === 'completed').length,
    };
  })();


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
      status: 'pending',
      department: 'all',
      subDepartment: 'all',
      project: 'all',
      category: 'all',
      priority: 'all'
    });
  };

  // Stats - based on main tab
  const assignedToMeTasks = tasks.filter(t => t.assigned_to === user?.user_id && t.created_by !== user?.user_id && !isHiddenProjectTaskForAssignee(t));
  const _role = (user?.role || '').toLowerCase();
  const _desg = (user?.designation || '').toLowerCase().trim();
  const _isPrivileged = _role === 'super_admin' || _role === 'admin' || _desg === 'operation head';
  const _myDepts = (myDesignation?.operations_departments || []);
  const assignedToTeamTasks = tasks.filter(t => {
    // Management tasks are Super Admin-only territory for general browsing —
    // even admin / op head don't see someone else's Management task here.
    if (t.department === 'management' && _role !== 'super_admin' && t.created_by !== user?.user_id) return false;
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
      <div className="space-y-4">
        {/* Main Tabs — pill style matching My Profile */}
        <OperationsTabsBar
          user={user}
          mainTab={mainTab}
          setMainTab={setMainTab}
          setMeetingsSubActive={setMeetingsSubActive}
          setFilter={setFilter}
          setFilters={setFilters}
          counts={{
            myTasks: myTabCount,
            assignToTeam: teamTabCount,
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
          // Content Calendar stays editable for admins/super admins regardless of their
          // own View/Edit self-toggle (it's a convenience toggle for them, not a real
          // restriction — the backend already trusts their PATCH either way). Regular
          // staff still follow their designation's operations_projects setting.
          const contentCalendarViewOnly = isPrivileged ? false : designationGrantsView;
          return (
            <>
              {/* The View/Edit toggle used to render here (full-width row,
                  right-aligned, mostly empty space to its left). It now
                  renders inside ProjectsPanel's own project header instead —
                  see showModeToggle/projectsViewMode/setProjectsViewMode
                  below — so there's no redundant near-empty row up here. */}
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
                contentCalendarViewOnly={contentCalendarViewOnly}
                showModeToggle={showToggle}
                projectsViewMode={projectsViewMode}
                setProjectsViewMode={setProjectsViewMode}
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

        {/* Sticky header block — summary cards, filter toolbar and the
            department pills stay pinned while only the task list scrolls
            beneath them. Layout's `.flex-1.overflow-y-auto` wrapper is the
            scroll container, so top-0 lands just under the app header. The
            opaque background is the page's own, so rows can't show through
            as they pass behind. */}
        {mainTab !== 'approvals' && mainTab !== 'projects' && mainTab !== 'departments' && mainTab !== 'meetings' && (
        <div className={`sticky top-0 z-30 space-y-4 pb-3 ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`} data-testid="tasks-sticky-header">
        {/* Operations Summary Cards — Feb 2026
            5 metrics: Worked Hours • To-Do • Pending • Awaiting Ops • Awaiting CEO.
            Now driven by `filterScopedSummary` so the numbers always reflect
            the active filter bar (date, project, person, department, category,
            status) — see useMemo above. Only relevant for the task-list tabs
            (My Tasks / Assign to Team); Projects/Departments/Approvals/Meetings
            have their own summaries. */}
        {(mainTab === 'assigned_to_me' || mainTab === 'assign_to_team') && (
        <OperationsSummaryCards
          summary={filterScopedSummary}
          isSuperAdmin={(user?.role || '').toLowerCase() === 'super_admin'}
          summaryDate={summaryDate}
          onDateChange={(d) => {
            // Keep the legacy summary date in sync AND push the same date into
            // the table date filter so the cards and the table stay aligned.
            setSummaryDate(d);
            setFilters(prev => ({ ...prev, dateFilter: 'single', singleDate: d }));
          }}
          activeFilter={filter}
          onCardClick={(key) => {
            // 'todo'  -> show all (open + in progress + others)
            // 'pending' -> show only pending
            // 'ops' / 'ceo' / 'worked' -> reset to all (visual highlight only)
            if (key === 'pending') setFilter('pending');
            else setFilter('all');
          }}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          borderColor={borderColor}
        />
        )}

        {mainTab !== 'approvals' && mainTab !== 'projects' && mainTab !== 'departments' && mainTab !== 'meetings' && (
        <>
        {/* Compact Filter Toolbar — one row, no wrap. On a narrow viewport the
            row scrolls horizontally instead of breaking Create Task (or the
            Sort select) onto their own dangling line. */}
        <div className={`${bgCard} border ${borderColor} rounded-xl p-3 overflow-x-auto`}>
          <div className="flex items-center gap-2 flex-nowrap w-max">
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

            {/* Department filter — lists ONLY the departments this user's
                designation actually covers (the same set the sub-tab pills
                below render), so nobody can filter by a department whose
                tasks they'd never be shown. Shares `filters.department` with
                those pills, so picking one here highlights the matching pill
                and vice versa. */}
            <Select
              value={filters.department}
              onValueChange={(v) => {
                setOpGroupActive(false);
                setOpGroupFilter('all');
                setMeetingsSubActive(false);
                setFilters({ ...filters, department: v, subDepartment: 'all', category: 'all', project: 'all' });
              }}
            >
              <SelectTrigger className={`h-9 w-[160px] ${bgSecondary} border ${borderColor}`} data-testid="filter-department">
                <Building2 className="h-3.5 w-3.5 mr-1 opacity-60" />
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent className={bgCard}>
                <SelectItem value="all">All Departments</SelectItem>
                {visibleDeptCategoriesForBar.map(d => (
                  <SelectItem key={d.dept_key} value={d.dept_key}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Project filter */}
            <Select value={filters.project} onValueChange={(v) => setFilters({...filters, project: v})}>
              <SelectTrigger className={`h-9 w-[160px] ${bgSecondary} border ${borderColor}`} data-testid="filter-project">
                <Briefcase className="h-3.5 w-3.5 mr-1 opacity-60" />
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent className={`${bgCard} min-w-[320px]`}>
                <SelectItem value="all">All Projects</SelectItem>
                {projectsForTask
                  .filter(p => filters.department === 'all' || (p.departments || []).includes(filters.department))
                  .map(p => {
                    const deptKeys = p.departments || [];
                    return (
                      <SelectItem key={p.project_id} value={p.project_id}>
                        <div className="flex items-center justify-between gap-3 w-full">
                          <span className="truncate">{p.name}</span>
                          {deptKeys.length > 0 && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {deptKeys.slice(0, 3).map(dk => {
                                const lbl = deptCategoriesForTask.find(d => d.dept_key === dk)?.label || dk;
                                return (
                                  <span
                                    key={dk}
                                    className="text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-[#6366f1]/15 text-[#6366f1] whitespace-nowrap"
                                    data-testid={`project-dept-tag-${p.project_id}-${dk}`}
                                  >
                                    {lbl}
                                  </span>
                                );
                              })}
                              {deptKeys.length > 3 && (
                                <span className="text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-[#6366f1]/10 text-[#6366f1]">
                                  +{deptKeys.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
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
            <Select value={filters.status} onValueChange={(v) => { setFilters({...filters, status: v}); setStatusFilterBypassIds(new Set()); }}>
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

            {/* Priority */}
            <Select value={filters.priority} onValueChange={(v) => setFilters({...filters, priority: v})}>
              <SelectTrigger className={`h-9 w-[130px] ${bgSecondary} border ${borderColor}`} data-testid="filter-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={bgCard}>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">🔴 Urgent</SelectItem>
                <SelectItem value="medium">🟡 Medium</SelectItem>
                <SelectItem value="low">🟢 Low</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs" data-testid="reset-filters">
              Reset
            </Button>

            {/* Sort by Start Time — chronologically orders manually-entered timings */}
            <Select value={sortMode} onValueChange={setSortMode}>
              <SelectTrigger className={`h-9 w-[140px] ${bgSecondary} border-0 text-xs`} data-testid="sort-mode-select">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Start ↑ (early)</SelectItem>
                <SelectItem value="desc">Start ↓ (late)</SelectItem>
                <SelectItem value="none">No sort</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Department Sub-Tabs with red pending count badges */}
        {(() => {
          const sourceTasks = mainTab === 'assigned_to_me'
            ? [...assignedToMeTasks, ...myOwnTasks]
            : assignedToTeamTasks;
          const pendingByDept = {};
          sourceTasks.forEach(t => {
            if ((t.status || 'pending') !== 'pending') return;
            const d = t.department || '_unassigned';
            pendingByDept[d] = (pendingByDept[d] || 0) + 1;
          });

          const role = (user?.role || '').toLowerCase();
          const isSuperAdmin = role === 'super_admin';
          const managementDept = visibleDeptCategoriesForBar.find(d => d.dept_key === 'management');
          const operationDepts = visibleDeptCategoriesForBar.filter(d => d.dept_key !== 'management');
          // Super Admin sees "Management" and "Operation" as two umbrella pills
          // instead of a flat department row — Operation nests every other
          // department as a second-row pill (see the block right below).
          const useOpGrouping = isSuperAdmin && !!managementDept;
          const managementCount = (pendingByDept['management'] || 0) + (pendingByDept['all'] || 0);
          const operationCount = operationDepts.reduce((sum, d) => sum + (pendingByDept[d.dept_key] || 0), 0) + (pendingByDept['all'] || 0);

          return (
            <div className="flex flex-wrap items-center gap-2" data-testid="dept-subtabs">
              {useOpGrouping ? (
                <>
                  <button
                    onClick={() => { setOpGroupActive(false); setOpGroupFilter('all'); setMeetingsSubActive(false); setFilters({...filters, department: 'management', subDepartment: 'all', project: 'all', category: 'all'}); }}
                    data-testid="dept-subtab-management"
                    className={`relative px-4 py-2 rounded-xl text-sm transition-all border ${
                      filters.department === 'management' && !meetingsSubActive && !opGroupActive
                        ? 'bg-[#6366f1] text-white border-transparent shadow-sm'
                        : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#6366f1]/40`
                    }`}
                  >
                    {managementDept.label}
                    {managementCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-[#ef4444] text-white text-[10px] font-bold px-1 ring-2 ring-[#0a0a0a]">
                        {managementCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { setOpGroupActive(true); setMeetingsSubActive(false); setFilters({...filters, department: 'all', subDepartment: 'all', project: 'all', category: 'all'}); }}
                    data-testid="dept-subtab-operation"
                    className={`relative px-4 py-2 rounded-xl text-sm transition-all border ${
                      opGroupActive && !meetingsSubActive
                        ? 'bg-[#6366f1] text-white border-transparent shadow-sm'
                        : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#6366f1]/40`
                    }`}
                  >
                    Operation
                    {operationCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-[#ef4444] text-white text-[10px] font-bold px-1 ring-2 ring-[#0a0a0a]">
                        {operationCount}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                visibleDeptCategoriesForBar.map(d => {
                  // A task marked "all" (Select All) counts toward every department's badge too.
                  const count = (pendingByDept[d.dept_key] || 0) + (pendingByDept['all'] || 0);
                  const isActive = filters.department === d.dept_key && !meetingsSubActive;
                  return (
                    <button
                      key={d.dept_key}
                      onClick={() => { setMeetingsSubActive(false); setFilters({...filters, department: d.dept_key, subDepartment: 'all', project: 'all', category: 'all'}); }}
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
                })
              )}

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

              {/* Create Task — sits right after Meetings so it's always
                  visible with the department pills instead of trailing off
                  the end of the (horizontally-scrolling) filter toolbar. */}
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl h-9 px-4"
                data-testid="create-task-btn"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create Task
              </Button>
            </div>
          );
        })()}

        {/* Operation umbrella — Super Admin only. A Technology/Marketing scope
            row (sourced from each department's own `group` field, set in
            Operations > Departments) narrows which non-Management department
            shows as a pill in the row beneath it. */}
        {opGroupActive && !meetingsSubActive && (() => {
          const operationDepts = visibleDeptCategoriesForBar.filter(d => d.dept_key !== 'management');
          const scopedOperationDepts = opGroupFilter === 'all'
            ? operationDepts
            : operationDepts.filter(d => d.group === opGroupFilter);
          const sourceTasks = mainTab === 'assigned_to_me'
            ? [...assignedToMeTasks, ...myOwnTasks]
            : assignedToTeamTasks;
          const pendingByDept = {};
          sourceTasks.forEach(t => {
            if ((t.status || 'pending') !== 'pending') return;
            const d = t.department || '_unassigned';
            pendingByDept[d] = (pendingByDept[d] || 0) + 1;
          });
          const groupCount = (groupValue) => operationDepts
            .filter(d => groupValue === 'all' || d.group === groupValue)
            .reduce((sum, d) => sum + (pendingByDept[d.dept_key] || 0), 0) + (pendingByDept['all'] || 0);

          return (
            <>
              <div className="flex flex-wrap items-center gap-2 pl-4" data-testid="opgroup-scope-tabs">
                {[{ value: 'all', label: 'All' }, { value: 'technology', label: 'Technology' }, { value: 'marketing', label: 'Marketing' }].map(g => {
                  const count = groupCount(g.value);
                  return (
                    <button
                      key={g.value}
                      onClick={() => setOpGroupFilter(g.value)}
                      data-testid={`opgroup-scope-${g.value}`}
                      className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        opGroupFilter === g.value
                          ? 'bg-[#111827] text-white border-transparent shadow-sm'
                          : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#111827]/40`
                      }`}
                    >
                      {g.label}
                      {count > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-[#ef4444] text-white text-[9px] font-bold px-1">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl h-9 px-4 ml-auto"
                  data-testid="opgroup-create-task-btn"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Task
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-4" data-testid="opgroup-subtabs">
                <button
                  onClick={() => setFilters({...filters, department: 'all', subDepartment: 'all'})}
                  data-testid="opgroup-subtab-all"
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                    filters.department === 'all'
                      ? 'bg-[#8b5cf6] text-white border-transparent shadow-sm'
                      : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#8b5cf6]/40`
                  }`}
                >
                  All Operation
                </button>
                {scopedOperationDepts.map(d => {
                  const count = (pendingByDept[d.dept_key] || 0) + (pendingByDept['all'] || 0);
                  const isActive = filters.department === d.dept_key;
                  return (
                    <button
                      key={d.dept_key}
                      onClick={() => setFilters({...filters, department: d.dept_key, subDepartment: 'all'})}
                      data-testid={`opgroup-subtab-${d.dept_key}`}
                      className={`relative px-3 py-1.5 rounded-lg text-xs transition-all border ${
                        isActive
                          ? 'bg-[#8b5cf6] text-white border-transparent shadow-sm'
                          : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#8b5cf6]/40`
                      }`}
                    >
                      {d.label}
                      {count > 0 && (
                        <span
                          className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#ef4444] text-white text-[10px] font-bold px-1"
                          data-testid={`opgroup-pending-${d.dept_key}`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* Sub Department Sub-Tabs — nested under a specific department that
            has them configured (e.g. Management), so clicking Management
            then a sub-department pill filters the list to just that one. */}
        {!meetingsSubActive && !opGroupActive && filters.department !== 'all' && (() => {
          const activeDept = visibleDeptCategoriesForBar.find(d => d.dept_key === filters.department);
          const subDepts = getSelectableSubDepts(filters.department);
          if (!activeDept || subDepts.length === 0) return null;

          const sourceTasks = mainTab === 'assigned_to_me'
            ? [...assignedToMeTasks, ...myOwnTasks]
            : assignedToTeamTasks;
          const pendingBySubDept = {};
          sourceTasks.forEach(t => {
            if ((t.status || 'pending') !== 'pending') return;
            if (t.department !== filters.department) return;
            const sd = t.sub_department_id || '_unassigned';
            pendingBySubDept[sd] = (pendingBySubDept[sd] || 0) + 1;
          });

          return (
            <div className="flex flex-wrap items-center gap-2 pl-4" data-testid="subdept-subtabs">
              <button
                onClick={() => setFilters({...filters, subDepartment: 'all'})}
                data-testid="subdept-subtab-all"
                className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                  filters.subDepartment === 'all'
                    ? 'bg-[#8b5cf6] text-white border-transparent shadow-sm'
                    : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#8b5cf6]/40`
                }`}
              >
                All {activeDept.label}
              </button>
              {subDepts.map(sd => {
                const count = pendingBySubDept[sd.id] || 0;
                const isActive = filters.subDepartment === sd.id;
                return (
                  <button
                    key={sd.id}
                    onClick={() => setFilters({...filters, subDepartment: sd.id})}
                    data-testid={`subdept-subtab-${sd.id}`}
                    className={`relative px-3 py-1.5 rounded-lg text-xs transition-all border ${
                      isActive
                        ? 'bg-[#8b5cf6] text-white border-transparent shadow-sm'
                        : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#8b5cf6]/40`
                    }`}
                  >
                    {sd.label}
                    {count > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-[#ef4444] text-white text-[9px] font-bold px-1">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })()}

        </>
        )}
        </div>
        )}

        {mainTab !== 'approvals' && mainTab !== 'projects' && mainTab !== 'departments' && mainTab !== 'meetings' && (
        <>
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
              <table className="w-full table-fixed">
                <thead className={bgSecondary}>
                  <tr>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${textSecondary} uppercase whitespace-nowrap w-[22%]`}>Task</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${textSecondary} uppercase whitespace-nowrap w-[6%]`}>Status</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${textSecondary} uppercase whitespace-nowrap w-[7%]`}>Category</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${textSecondary} uppercase whitespace-nowrap w-[11%]`}>Created / Assigned</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${textSecondary} uppercase whitespace-nowrap w-[8%]`}>Due Date</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${textSecondary} uppercase whitespace-nowrap w-[3%]`}>Link</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${textSecondary} uppercase whitespace-nowrap w-[6%]`}>Time</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${textSecondary} uppercase whitespace-nowrap w-[6%]`}>Start Time</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${textSecondary} uppercase whitespace-nowrap w-[6%]`}>End Time</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${textSecondary} uppercase whitespace-nowrap w-[8%]`}>Timer</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${textSecondary} uppercase whitespace-nowrap w-[17%]`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-200'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className={`px-2 py-8 text-center ${textSecondary}`}>Loading...</td>
                    </tr>
                  ) : displayTasks.length === 0 ? (
                    <tr>
                      <td colSpan={11} className={`px-2 py-8 text-center ${textSecondary}`}>
                        <Briefcase className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                        <p>No tasks found</p>
                        <p className="text-sm">
                          {filters.dateFilter === 'today' ? 'No tasks for today' : 
                           filters.dateFilter === 'single' && filters.singleDate ? `No tasks for ${filters.singleDate}` :
                           'Create a new task to get started'}
                        </p>
                      </td>
                    </tr>
                  ) : displayTasks.map(task => (
                    <tr
                      key={task.task_id}
                      className={`cursor-pointer transition-all border-l-4 ${isDark ? 'hover:brightness-125' : 'hover:brightness-95'}`}
                      style={{
                        backgroundColor: isDark ? '#18181b' : '#ffffff',
                        borderLeftColor: priorityDotColors[task.priority] || priorityDotColors.medium,
                      }}
                      data-testid={`task-row-${task.task_id}`}
                      onClick={() => { setViewingTask(task); setShowTaskDetailModal(true); }}
                    >
                      <td className={`px-2 py-3`}>
                        <div className={`font-medium ${textPrimary} flex items-start gap-1.5`}>
                          <Badge
                            className={`text-[10px] px-1.5 py-0 h-4 shrink-0 mt-0.5 ${priorityColors[task.priority] || priorityColors.medium}`}
                            title={`Priority: ${task.priority === 'high' ? 'High' : task.priority === 'low' ? 'Low' : 'Medium'}`}
                            data-testid={`priority-badge-${task.task_id}`}
                          >
                            {task.priority === 'high' ? 'High' : task.priority === 'low' ? 'Low' : 'Med'}
                          </Badge>
                          <span className="line-clamp-2" title={task.task_name}>
                            {truncateWords(task.task_name, 10)}
                          </span>
                        </div>
                        {task.description && (
                          <div className={`text-xs ${textSecondary} truncate`} title={task.description}>{task.description}</div>
                        )}
                        <div className={`text-xs ${textSecondary} mt-1 flex flex-wrap gap-1`}>
                          <Badge className="text-xs" variant="outline">{task.type || 'General'}</Badge>
                          {task.sub_department_name && (() => {
                            const c = subDeptColor(task.sub_department_id || task.sub_department_name);
                            return (
                              <Badge className={`text-xs ${c.bg} ${c.text}`} data-testid={`subdept-badge-${task.task_id}`}>
                                <Tag className="h-3 w-3 mr-1" />{task.sub_department_name}
                              </Badge>
                            );
                          })()}
                          {task.project_name && (
                            <Badge className="text-xs bg-[#6366f1]/20 text-[#6366f1]" data-testid={`project-badge-${task.task_id}`}>
                              <Briefcase className="h-3 w-3 mr-1" />{task.project_name}
                            </Badge>
                          )}
                          {task.workflow_id && task.workflow_name && (
                            <Badge className="text-xs bg-[#ec4899]/20 text-[#ec4899] font-medium" data-testid={`task-workflow-badge-${task.task_id}`}>
                              {task.workflow_name}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <Badge className={statusColors[task.status] || statusColors.pending}>
                          {task.status?.replace('_', ' ') || 'Pending'}
                        </Badge>
                      </td>
                      <td className="px-2 py-3 text-sm" data-testid={`category-cell-${task.task_id}`}>
                        {task.category ? (
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs w-fit">{task.category}</Badge>
                            {task.department && (
                              <span className={`text-xs ${textSecondary}`}>{task.department === 'all' ? 'All Departments' : task.department}</span>
                            )}
                          </div>
                        ) : (
                          <span className={textSecondary}>—</span>
                        )}
                      </td>
                      <td className={`px-2 py-3 text-sm`}>
                        <div className="space-y-1">
                          {/* Meeting group: collapsed row shows all assignees with a count badge.
                              View popup (eye icon) lets the user approve all in one shot. */}
                          {task._group_size > 1 ? (
                            <div className="flex flex-col gap-1">
                              <Badge className="bg-blue-500/20 text-blue-400 text-[10px] w-fit" data-testid={`meeting-group-badge-${task.task_id}`}>
                                {task._group_size} members
                              </Badge>
                              <p className={`text-xs ${textPrimary} leading-tight`}>
                                {task._group_members.slice(0, 3).map(m => m.assigned_to_name || '—').join(', ')}
                                {task._group_size > 3 && (
                                  <span className={textSecondary}> +{task._group_size - 3} more</span>
                                )}
                              </p>
                              <p className={`text-[10px] ${textSecondary}`}>by {task.created_by_name || '—'}</p>
                            </div>
                          ) : task.created_by === user?.user_id ? (
                            <div className="flex flex-col items-start gap-1">
                              <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs whitespace-nowrap w-fit">Created by you</Badge>
                              <p className={`text-xs ${textSecondary} whitespace-nowrap`}>{formatDate(task.created_at)}</p>
                            </div>
                          ) : task.assigned_to === user?.user_id ? (
                            <div className="flex flex-col items-start gap-1">
                              <Badge className="bg-[#10b981]/20 text-[#10b981] text-xs whitespace-nowrap w-fit">Assigned to you</Badge>
                              <p className={`text-xs ${textSecondary} truncate max-w-full`} title={task.assigned_by_name || task.created_by_name || 'Unknown'}>by {task.assigned_by_name || task.created_by_name || 'Unknown'}</p>
                            </div>
                          ) : (
                            <div>
                              <p className={`${textPrimary} truncate`} title={task.created_by_name || '-'}>{task.created_by_name || '-'}</p>
                              {task.assigned_to_name && (
                                <p className={`text-xs ${textSecondary} truncate`} title={task.assigned_to_name}>→ {task.assigned_to_name}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`px-2 py-3 text-sm`}>
                        {task.due_date ? (
                          <div>
                            <span className={`whitespace-nowrap ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-[#ef4444]' : textPrimary}`}>
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
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
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
                      <td className={`px-2 py-3`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <Timer className={`h-3.5 w-3.5 flex-shrink-0 ${task.time_tracking?.status === 'running' ? 'text-[#10b981] animate-pulse' : textSecondary}`} />
                          <span className={`text-xs font-medium ${textPrimary}`}>
                            {formatDuration(task.time_tracking?.total_seconds || 0)}
                          </span>
                        </div>
                        {task.time_tracking?.status === 'running' && (
                          <div className="text-xs text-[#10b981] mt-1">Running...</div>
                        )}
                      </td>
                      <td className={`px-2 py-3 text-sm whitespace-nowrap`} data-testid={`start-time-${task.task_id}`} onClick={(e) => e.stopPropagation()}>
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
                      <td className={`px-2 py-3 text-sm whitespace-nowrap`} data-testid={`end-time-${task.task_id}`} onClick={(e) => e.stopPropagation()}>
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
                      <td className="px-2 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {getTimeTrackingButton(task, mainTab === 'assign_to_team')}
                      </td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 flex-nowrap">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[#6366f1]"
                            onClick={(e) => { e.stopPropagation(); setViewingTask(task); setShowTaskDetailModal(true); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {/* Super-Admin-only Timeline icon — opens the audit log popup */}
                          {(user?.role || '').toLowerCase() === 'super_admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-500"
                              onClick={(e) => { e.stopPropagation(); openTimelineModal(task); }}
                              title="View timeline"
                              data-testid={`task-timeline-${task.task_id}`}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          )}
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
                                {canFullEdit && (() => {
                                  const locked = isAwaitingOrApproved(task);
                                  return (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={locked}
                                      className={locked ? 'opacity-40 cursor-not-allowed' : ''}
                                      onClick={(e) => { e.stopPropagation(); if (!locked) openEditModal(task); }}
                                      data-testid={`task-edit-${task.task_id}`}
                                      title={locked
                                        ? (task.approval_request?.status === 'approved'
                                            ? 'Approved — this task can no longer be edited'
                                            : 'Sent for approval — editing is locked until it is reviewed')
                                        : 'Edit task'}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  );
                                })()}
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
                          {mainTab === 'assigned_to_me' && task.status !== 'completed' && !isAwaitingOrApproved(task) && (
                            <Button
                              size="sm"
                              className="bg-[#10b981] hover:bg-[#059669] text-white h-8 px-3"
                              onClick={(e) => { e.stopPropagation(); setCompleteSummaryTask(task); }}
                              data-testid={`complete-btn-${task.task_id}`}
                              title="Review this task's time, then send it for approval"
                            >
                              <Check className="h-3 w-3 mr-1" /> Complete
                            </Button>
                          )}
                          {/* Approval state — read-only. Sending for approval now
                              happens through Complete → the time summary → Send to
                              Approve, so there's no separate Approve button here;
                              this is just the resulting state. */}
                          {mainTab === 'assigned_to_me' && task.approval_request?.status && (
                            <Badge
                              className={
                                task.approval_request.status === 'pending'
                                  ? 'bg-[#f59e0b]/20 text-[#f59e0b] h-8 px-3 flex items-center'
                                  : task.approval_request.status === 'approved'
                                    ? 'bg-[#10b981]/20 text-[#10b981] h-8 px-3 flex items-center'
                                    : 'bg-[#ef4444]/20 text-[#ef4444] h-8 px-3 flex items-center'
                              }
                              data-testid={`approval-state-${task.task_id}`}
                              title={
                                task.approval_request.status === 'pending'
                                  ? 'Waiting on an approver'
                                  : task.approval_request.status === 'approved'
                                    ? 'Approved'
                                    : 'Rejected — fix it and send again from Complete'
                              }
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {task.approval_request.status === 'pending' ? 'Pending'
                                : task.approval_request.status === 'approved' ? 'Approved'
                                : 'Rejected'}
                            </Badge>
                          )}
                          {REPORT_ENABLED_DEPARTMENTS.includes(task.department) && isReportCategory(task.category) && task.assigned_to === user?.user_id && (
                            <Button
                              size="sm"
                              className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white h-8 px-3"
                              onClick={(e) => { e.stopPropagation(); openReportModal(task); }}
                              data-testid={`submit-report-btn-${task.task_id}`}
                              title="Submit today's campaign report"
                            >
                              <BarChart3 className="h-3 w-3 mr-1" /> Submit Report
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
                        <Label className={textPrimary}>Priority <span className="text-red-500">*</span></Label>
                        <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
                          <SelectTrigger className={`${bgSecondary} border ${borderColor}`} data-testid="create-task-priority">
                            <SelectValue placeholder="Select priority…" />
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
                    {/* Assign To — shown ONLY in the "Assign to Team" tab.
                        In My Tasks (and other tabs), the assignee is always the current user. */}
                    {mainTab === 'assign_to_team' && (
                      <div>
                        <Label className={textPrimary}>Assign To</Label>
                        <Select value={formData.assigned_to} onValueChange={(v) => setFormData(prev => ({ ...prev, assigned_to: v }))}>
                          <SelectTrigger className={`${bgSecondary} border ${borderColor}`}>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent className={bgCard}>
                            {users
                              .filter(u => formData.department !== 'management' || !formData.sub_department_id || userHasManagementSubDept(u.user_id, formData.sub_department_id))
                              .map(u => (
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
                      <Label className={textPrimary}>
                        Department {!MEETING_FAMILY_FE.has((formData.type || '').toLowerCase()) && <span className="text-red-500">*</span>}
                      </Label>
                      <Select
                        value={formData.department || 'none'}
                        onValueChange={(v) => {
                          const dept = v === 'none' ? '' : v;
                          const deptEntry = deptCategoriesForTask.find(d => d.dept_key === dept);
                          const defaultCategory = deptEntry?.categories?.[0] || '';
                          const defaultSubDept = getSelectableSubDepts(dept)[0];
                          setFormData(prev => ({
                            ...prev, department: dept, project_id: '', project_name: '', category: defaultCategory,
                            website_page_id: '', website_page_name: '', erp_user_id: '', erp_user_name: '', erp_page_id: '', erp_page_name: '', erp_task_type: '',
                            sub_department_id: defaultSubDept?.id || '', sub_department_name: defaultSubDept?.label || '',
                          }));
                        }}
                      >
                        <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="create-task-department">
                          <SelectValue placeholder={MEETING_FAMILY_FE.has((formData.type || '').toLowerCase()) ? 'Select department (optional)' : 'Select department'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          <SelectItem value="all">Select All (All Departments)</SelectItem>
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
                              setFormData(prev => ({ ...prev, project_id: '', project_name: '', website_page_id: '', website_page_name: '', erp_user_id: '', erp_user_name: '', erp_page_id: '', erp_page_name: '', erp_task_type: '', workflow_id: '', workflow_name: '' }));
                            } else {
                              const proj = projectsForTask.find(p => p.project_id === v);
                              const projDepts = proj?.departments || [];
                              setFormData(prev => {
                                // Auto-sync department to the project's first dept if the current
                                // dept isn't one of the project's depts — keeps the Category list correct.
                                const nextDept = (projDepts.includes(prev.department))
                                  ? prev.department
                                  : (projDepts[0] || prev.department);
                                const deptEntry = deptCategoriesForTask.find(d => d.dept_key === nextDept);
                                const defaultCategory = deptEntry?.categories?.[0] || '';
                                const defaultSubDept = getSelectableSubDepts(nextDept)[0];
                                const deptUnchanged = nextDept === prev.department;
                                return {
                                  ...prev,
                                  project_id: v,
                                  project_name: proj?.name || '',
                                  department: nextDept,
                                  category: deptUnchanged ? (prev.category || defaultCategory) : defaultCategory,
                                  website_page_id: '',
                                  website_page_name: '',
                                  erp_user_id: '',
                                  erp_user_name: '',
                                  erp_page_id: '',
                                  erp_page_name: '',
                                  erp_task_type: '',
                                  sub_department_id: deptUnchanged ? (prev.sub_department_id || defaultSubDept?.id || '') : (defaultSubDept?.id || ''),
                                  sub_department_name: deptUnchanged ? (prev.sub_department_name || defaultSubDept?.label || '') : (defaultSubDept?.label || ''),
                                  workflow_id: '',
                                  workflow_name: '',
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
                                if (formData.department && formData.department !== 'all' && !(p.departments || []).includes(formData.department)) {
                                  return false;
                                }
                                const members = Array.isArray(p.members) ? p.members : [];
                                return members.includes(user?.user_id) || p.created_by === user?.user_id;
                              });
                              if (myProjects.length === 0) {
                                return (
                                  <div className={`px-3 py-2 text-xs ${textSecondary}`}>
                                    No projects assigned to you{formData.department && formData.department !== 'all' ? ` in this department` : ''}.
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
                        <Label className={textPrimary}>
                          Category {formData.department && formData.department !== 'all' && <span className="text-red-500">*</span>}
                        </Label>
                        <Select
                          value={formData.category || 'none'}
                          onValueChange={(v) => setFormData(prev => ({ ...prev, category: v === 'none' ? '' : v }))}
                          disabled={!formData.department || formData.department === 'all'}
                        >
                          <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="create-task-category">
                            <SelectValue placeholder={formData.department === 'all' ? 'N/A for All Departments' : (formData.department ? 'Select category' : 'Pick dept first')} />
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

                    {formData.project_id && (
                      <div>
                        <Label className={textPrimary}>Workflow</Label>
                        <SearchableSelect
                          value={formData.workflow_id}
                          onChange={(id) => {
                            const proj = projectsForTask.find(p => p.project_id === formData.project_id);
                            const w = (proj?.erp_workflow || []).find(x => x.id === id);
                            setFormData(prev => ({ ...prev, workflow_id: id, workflow_name: w?.name || '' }));
                          }}
                          options={(projectsForTask.find(p => p.project_id === formData.project_id)?.erp_workflow || []).map(w => ({ value: w.id, label: w.name }))}
                          placeholder="— No workflow —"
                          searchPlaceholder="Search workflows..."
                          emptyText="No workflows yet for this project"
                          className={`w-full h-9 px-3 rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                          data-testid="create-task-workflow"
                        />
                      </div>
                    )}

                    {getSelectableSubDepts(formData.department).length > 0 && (
                      <div>
                        <Label className={textPrimary}>Sub Department <span className="text-red-500">*</span></Label>
                        <Select
                          value={formData.sub_department_id || 'none'}
                          onValueChange={(v) => {
                            if (v === 'none') {
                              setFormData(prev => ({ ...prev, sub_department_id: '', sub_department_name: '' }));
                            } else {
                              const sd = getSelectableSubDepts(formData.department).find(x => x.id === v);
                              setFormData(prev => ({ ...prev, sub_department_id: v, sub_department_name: sd?.label || '' }));
                            }
                          }}
                        >
                          <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="create-task-sub-department">
                            <SelectValue placeholder="Select sub department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            {getSelectableSubDepts(formData.department).map(sd => (
                              <SelectItem key={sd.id} value={sd.id}>{sd.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {formData.department === 'website' && formData.project_id && (
                      <div>
                        <Label className={textPrimary}>Page <span className="text-red-500">*</span></Label>
                        <Select
                          value={formData.website_page_id || 'none'}
                          onValueChange={(v) => {
                            if (v === 'none') {
                              setFormData(prev => ({ ...prev, website_page_id: '', website_page_name: '' }));
                            } else if (v === 'others') {
                              setFormData(prev => ({ ...prev, website_page_id: 'others', website_page_name: 'Others' }));
                            } else {
                              const proj = projectsForTask.find(p => p.project_id === formData.project_id);
                              const pg = (proj?.pages || []).find(p => p.id === v);
                              setFormData(prev => ({ ...prev, website_page_id: v, website_page_name: pg?.page_name || '' }));
                            }
                          }}
                        >
                          <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="create-task-page">
                            <SelectValue placeholder="Select page" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            {(projectsForTask.find(p => p.project_id === formData.project_id)?.pages || []).map(pg => (
                              <SelectItem key={pg.id} value={pg.id}>{pg.page_name}</SelectItem>
                            ))}
                            <SelectItem value="others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {formData.department === 'erp' && formData.project_id && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className={textPrimary}>User <span className="text-red-500">*</span></Label>
                          <Select
                            value={formData.erp_user_id || 'none'}
                            onValueChange={(v) => {
                              if (v === 'none') {
                                setFormData(prev => ({ ...prev, erp_user_id: '', erp_user_name: '', erp_page_id: '', erp_page_name: '' }));
                              } else {
                                const proj = projectsForTask.find(p => p.project_id === formData.project_id);
                                const eu = (proj?.erp_users || []).find(u => u.id === v);
                                setFormData(prev => ({ ...prev, erp_user_id: v, erp_user_name: eu?.user_name || '', erp_page_id: '', erp_page_name: '' }));
                              }
                            }}
                          >
                            <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="create-task-erp-user">
                              <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {(projectsForTask.find(p => p.project_id === formData.project_id)?.erp_users || []).map(eu => (
                                <SelectItem key={eu.id} value={eu.id}>{eu.user_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className={textPrimary}>Page <span className="text-red-500">*</span></Label>
                          <Select
                            value={formData.erp_page_id || 'none'}
                            onValueChange={(v) => {
                              if (v === 'none') {
                                setFormData(prev => ({ ...prev, erp_page_id: '', erp_page_name: '' }));
                              } else if (v === 'others') {
                                setFormData(prev => ({ ...prev, erp_page_id: 'others', erp_page_name: 'Others' }));
                              } else {
                                const proj = projectsForTask.find(p => p.project_id === formData.project_id);
                                const eu = (proj?.erp_users || []).find(u => u.id === formData.erp_user_id);
                                const pg = (eu?.pages || []).find(p => p.id === v);
                                setFormData(prev => ({ ...prev, erp_page_id: v, erp_page_name: pg?.page_name || '' }));
                              }
                            }}
                            disabled={!formData.erp_user_id}
                          >
                            <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="create-task-erp-page">
                              <SelectValue placeholder={formData.erp_user_id ? 'Select page' : 'Pick user first'} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {((projectsForTask.find(p => p.project_id === formData.project_id)?.erp_users || []).find(u => u.id === formData.erp_user_id)?.pages || []).map(pg => (
                                <SelectItem key={pg.id} value={pg.id}>{pg.page_name}</SelectItem>
                              ))}
                              <SelectItem value="others">Others</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className={textPrimary}>Type</Label>
                          <Select
                            value={formData.erp_task_type || 'none'}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, erp_task_type: v === 'none' ? '' : v }))}
                          >
                            <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="create-task-erp-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {ERP_TASK_TYPE_OPTIONS.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

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

                {/* ERP "Prompt" breadcrumb — full width, bottom of the popup */}
                {formData.department === 'erp' && (() => {
                  const promptText = buildErpPrompt({
                    projectName: formData.project_name,
                    userName: formData.erp_user_name,
                    pageName: formData.erp_page_name,
                    subTabName: formData.erp_sub_tab_name,
                    ultraSubTabName: formData.erp_ultra_sub_tab_name,
                    ultraTabName: formData.erp_ultra_tab_name,
                    taskName: formData.task_name,
                  });
                  return (
                    <div className={`mt-4 p-4 rounded-lg border ${borderColor} ${bgSecondary}`} data-testid="erp-task-prompt">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <Label className={textPrimary}>Prompt</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(promptText);
                            toast.success('Prompt copied to clipboard');
                          }}
                          data-testid="erp-task-prompt-copy"
                        >
                          Copy
                        </Button>
                      </div>
                      <p className={`text-sm ${textPrimary} break-words`}>{promptText}</p>
                    </div>
                  );
                })()}

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

        {/* Timeline modal — visible to Super Admin only. Shows the full audit
            log of a task: creation, edits, approval submit / decide, etc. */}
        {timelineTask && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4"
            onClick={() => setTimelineTask(null)}
            data-testid="task-timeline-modal"
          >
            <Card
              className={`${bgCard} border ${borderColor} w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col`}
              onClick={(e) => e.stopPropagation()}
            >
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                      <History className="h-5 w-5 text-amber-500" /> Task Timeline
                    </h3>
                    <p className={`text-xs ${textSecondary} mt-0.5 line-clamp-1`}>{timelineTask.task_name}</p>
                  </div>
                  <button
                    onClick={() => setTimelineTask(null)}
                    className={textSecondary}
                    data-testid="timeline-close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 -mx-1 px-1">
                  {timelineLoading ? (
                    <p className={`text-xs italic ${textSecondary} text-center py-10`}>Loading timeline…</p>
                  ) : timelineEvents.length === 0 ? (
                    <p className={`text-xs italic ${textSecondary} text-center py-10`}>No events recorded yet.</p>
                  ) : (
                    <ol className="relative border-l-2 border-amber-500/30 ml-3 space-y-3 py-1">
                      {timelineEvents.map((ev, idx) => {
                        const at = ev.at ? new Date(ev.at) : null;
                        const atStr = at && !isNaN(at.getTime())
                          ? at.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                          : (ev.at || '—');
                        const kindColor =
                          ev.kind === 'created' ? 'bg-emerald-500'
                          : ev.kind === 'updated' ? 'bg-blue-500'
                          : ev.kind === 'approval_requested' ? 'bg-amber-500'
                          : ev.kind === 'approval_decided' ? 'bg-purple-500'
                          : 'bg-gray-400';
                        return (
                          <li key={idx} className="ml-4 relative" data-testid={`timeline-event-${idx}`}>
                            <span className={`absolute -left-[22px] top-1 w-3 h-3 rounded-full ${kindColor} ring-2 ring-amber-500/30`} />
                            <div className={`p-3 rounded-lg border ${borderColor} ${bgSecondary}`}>
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <p className={`text-xs font-semibold ${textPrimary}`}>{ev.summary || ev.kind}</p>
                                <p className={`text-[10px] ${textSecondary}`}>{atStr}</p>
                              </div>
                              <p className={`text-[11px] ${textSecondary} mt-0.5`}>
                                <span className="font-medium">{ev.by_name || ev.by || '—'}</span>
                                {ev.kind && <span className="ml-2 opacity-60">· {ev.kind.replace(/_/g, ' ')}</span>}
                              </p>
                              {ev.details && Object.keys(ev.details).length > 0 && (
                                <div className={`mt-1.5 text-[10px] ${textSecondary} space-y-0.5`}>
                                  {Object.entries(ev.details).filter(([, v]) => v !== null && v !== '' && v !== undefined).map(([k, v]) => (
                                    <p key={k}><span className="opacity-70">{k.replace(/_/g, ' ')}:</span> <span className={textPrimary}>{String(v)}</span></p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t flex justify-end" style={{ borderColor: 'rgba(120,120,120,0.2)' }}>
                  <Button variant="outline" onClick={() => setTimelineTask(null)}>Close</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}


        {showTaskDetailModal && viewingTask && (          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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

                {/* ERP Task Type */}
                {viewingTask.department === 'erp' && viewingTask.erp_task_type && (
                  <div className={`p-4 rounded-lg ${bgSecondary}`}>
                    <p className={`text-xs ${textSecondary} mb-1`}>Type</p>
                    <p className={`font-medium ${textPrimary}`}>{viewingTask.erp_task_type}</p>
                  </div>
                )}

                {/* ERP "Prompt" breadcrumb */}
                {viewingTask.department === 'erp' && (() => {
                  const promptText = buildErpPrompt({
                    projectName: viewingTask.project_name,
                    userName: viewingTask.erp_user_name,
                    pageName: viewingTask.erp_page_name,
                    subTabName: viewingTask.erp_sub_tab_name,
                    ultraSubTabName: viewingTask.erp_ultra_sub_tab_name,
                    ultraTabName: viewingTask.erp_ultra_tab_name,
                    taskName: viewingTask.task_name,
                  });
                  return (
                    <div className={`p-4 rounded-lg ${bgSecondary}`} data-testid="erp-task-prompt-view">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className={`text-xs ${textSecondary} flex items-center gap-1`}>Prompt</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(promptText);
                            toast.success('Prompt copied to clipboard');
                          }}
                          data-testid="erp-task-prompt-view-copy"
                        >
                          Copy
                        </Button>
                      </div>
                      <p className={`text-sm ${textPrimary} break-words`}>{promptText}</p>
                    </div>
                  );
                })()}

                {/* Meeting Group Members — shown when this is a collapsed
                    meeting row (multiple assignees). Each member shows their
                    own status. "Approve All" cascades operations-approval. */}
                {viewingTask._group_size > 1 && (
                  <div className={`p-4 rounded-lg ${bgSecondary}`} data-testid="meeting-group-members">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className={`text-xs ${textSecondary} flex items-center gap-1`}>
                        <Users className="h-3 w-3" /> Members ({viewingTask._group_size})
                      </p>
                      <Button
                        size="sm"
                        className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 h-7 text-xs"
                        data-testid="meeting-group-approve-all"
                        onClick={async () => {
                          try {
                            const r = await axios.post(
                              `${API}/api/our-tasks/tasks/${viewingTask.task_id}/group-status`,
                              { status: 'completed' },
                              { headers },
                            );
                            toast.success(`Marked ${r.data?.updated || 0} member tasks complete`);
                            setShowTaskDetailModal(false);
                            setViewingTask(null);
                            loadTasks();
                          } catch (e) {
                            toast.error(e.response?.data?.detail || 'Failed to cascade');
                          }
                        }}
                      >
                        <Check className="h-3 w-3 mr-1" /> Approve All
                      </Button>
                    </div>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {(viewingTask._group_members || []).map((m) => (
                        <div
                          key={m.task_id}
                          className={`flex items-center justify-between px-3 py-2 rounded ${bgCard} border ${borderColor}`}
                          data-testid={`meeting-group-member-${m.task_id}`}
                        >
                          <p className={`text-sm ${textPrimary}`}>{m.assigned_to_name || '—'}</p>
                          <Badge className={`text-[10px] ${statusColors[m.status] || statusColors.pending}`}>
                            {(m.status || 'pending').replace('_', ' ')}
                          </Badge>
                        </div>
                      ))}
                    </div>
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

        {/* Meta Ads daily "Submit Report" popup */}
        {/* z-40, not z-[70]: the Campaign/Quality <Select> dropdowns inside
            portal to document.body at z-50 (see ui/select.jsx) — z-[70] here
            would render this modal's backdrop ON TOP of those open dropdown
            lists, making every option invisible/unclickable. */}
        {reportTask && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={() => !submittingReport && closeReportModal()}>
            <Card className={`${bgCard} border ${borderColor} w-full max-w-3xl max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
                    <BarChart3 className="h-5 w-5 text-[#8b5cf6]" />
                    Submit Report
                  </CardTitle>
                  <button onClick={() => !submittingReport && closeReportModal()} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className={`text-sm ${textSecondary}`}>Task: <span className={textPrimary}>{reportTask.task_name}</span></p>
                <p className={`text-sm ${textSecondary}`}>
                  Project: <span className={textPrimary}>{reportProject?.name || reportTask.project_name || '—'}</span>
                  {' · '}Department: <span className={textPrimary}>{REPORT_DEPARTMENT_LABEL[reportTask.department] || reportTask.department}</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="max-w-xs">
                  <Label className={textPrimary}>Date</Label>
                  <Input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="report-date"
                  />
                </div>

                <div className="space-y-3">
                  {(() => {
                    const campaignOptions = reportProject?.campaigns || [];
                    return reportRows.map((row, idx) => (
                      <div key={row.row_id} className={`border ${borderColor} rounded-lg p-4 space-y-3`} data-testid={`report-row-${row.row_id}`}>
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary}`}>Campaign {idx + 1}</p>
                          {reportRows.length > 1 && (
                            <button type="button" onClick={() => removeReportRow(row.row_id)} className="text-[#ef4444]" data-testid={`report-row-remove-${row.row_id}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div>
                          <Label className={textPrimary}>Campaign</Label>
                          <Select
                            value={row.campaign_id || 'none'}
                            onValueChange={(v) => {
                              if (v === 'none') { updateReportRow(row.row_id, { campaign_id: '', campaign_name: '' }); return; }
                              const c = campaignOptions.find(c => c.id === v);
                              updateReportRow(row.row_id, { campaign_id: v, campaign_name: c?.name || '' });
                            }}
                          >
                            <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`report-row-campaign-${row.row_id}`}>
                              <SelectValue placeholder={campaignOptions.length ? 'Select campaign' : 'No campaigns yet — add one in the Campaigns tab'} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {campaignOptions.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!reportProject && (
                            <p className="text-xs text-amber-500 mt-1">Loading campaigns…</p>
                          )}
                          {reportProject && campaignOptions.length === 0 && (
                            <p className="text-xs text-amber-500 mt-1">
                              No campaigns saved on project "{reportProject.name}" (ID: {reportProject.project_id}). Add one on that project's Campaigns tab, then reopen Submit Report.
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div>
                            <Label className={textPrimary}>Total Leads</Label>
                            <Input type="number" value={row.total_leads} onChange={(e) => updateReportRow(row.row_id, { total_leads: e.target.value })} className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`report-row-leads-${row.row_id}`} />
                          </div>
                          <div>
                            <Label className={textPrimary}>Cost per Lead</Label>
                            <Input type="number" value={row.cost_per_lead} onChange={(e) => updateReportRow(row.row_id, { cost_per_lead: e.target.value })} className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`report-row-cpl-${row.row_id}`} />
                          </div>
                          <div>
                            <Label className={textPrimary}>Total Spend</Label>
                            <Input type="number" value={row.total_spend} onChange={(e) => updateReportRow(row.row_id, { total_spend: e.target.value })} className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`report-row-spend-${row.row_id}`} />
                          </div>
                          <div>
                            <Label className={textPrimary}>Quality</Label>
                            <Select value={row.quality} onValueChange={(v) => updateReportRow(row.row_id, { quality: v })}>
                              <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`report-row-quality-${row.row_id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="good">Good</SelectItem>
                                <SelectItem value="average">Average</SelectItem>
                                <SelectItem value="poor">Poor</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className={textPrimary}>Convert</Label>
                            <Input type="number" value={row.convert} onChange={(e) => updateReportRow(row.row_id, { convert: e.target.value })} className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`report-row-convert-${row.row_id}`} />
                          </div>
                          <div>
                            <Label className={textPrimary}>Remarks</Label>
                            <Input value={row.remarks} onChange={(e) => updateReportRow(row.row_id, { remarks: e.target.value })} className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`report-row-remarks-${row.row_id}`} />
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <Button type="button" variant="outline" onClick={addReportRow} className={borderColor} data-testid="report-add-row">
                  <Plus className="h-4 w-4 mr-1" /> Add Campaign
                </Button>
              </CardContent>
              <div className="flex justify-end gap-2 px-6 pb-6">
                <Button variant="ghost" onClick={closeReportModal} disabled={submittingReport}>Cancel</Button>
                <Button
                  onClick={handleSubmitReport}
                  disabled={submittingReport}
                  className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white"
                  data-testid="report-submit-btn"
                >
                  {submittingReport ? 'Submitting…' : 'Submit Report'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Completion summary — opened by the Complete button. Shows where the
            task's time actually went (project, start → end, every work stretch
            and every break), then hands off to Send for Approval, seeded the
            same way the row's own Approve button seeds it. */}
        {completeSummaryTask && (() => {
          const t = completeSummaryTask;
          const h = buildTimeHistory(t);
          const spanSeconds = h.start
            ? Math.max(0, Math.round(((h.end ? new Date(h.end) : new Date()) - new Date(h.start)) / 1000))
            : 0;
          return (
            <div
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
              onClick={() => setCompleteSummaryTask(null)}
              data-testid="complete-summary-modal"
            >
              <div
                className={`w-full max-w-lg ${bgCard} border ${borderColor} rounded-xl shadow-xl max-h-[90vh] flex flex-col`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`p-5 border-b ${borderColor} flex items-start justify-between gap-3`}>
                  <div className="min-w-0">
                    <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>
                      {t.project_name || 'No project'}
                    </p>
                    <h3 className={`text-base font-semibold ${textPrimary} break-words`} data-testid="complete-summary-task-name">
                      {t.task_name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setCompleteSummaryTask(null)}
                    className={textSecondary}
                    data-testid="complete-summary-close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto">
                  {/* Start → End */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-lg border ${borderColor} ${bgSecondary} p-3`}>
                      <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Started</p>
                      <p className={`text-sm ${textPrimary}`} data-testid="complete-summary-start">{fmtStamp(h.start)}</p>
                    </div>
                    <div className={`rounded-lg border ${borderColor} ${bgSecondary} p-3`}>
                      <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Ended</p>
                      <p className={`text-sm ${textPrimary}`} data-testid="complete-summary-end">
                        {h.running ? 'Still running' : fmtStamp(h.end)}
                      </p>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className={`rounded-lg border ${borderColor} ${bgSecondary} p-3`}>
                      <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Worked</p>
                      <p className="text-lg font-bold text-[#10b981]" data-testid="complete-summary-worked">
                        {formatDuration(h.workedSeconds)}
                      </p>
                    </div>
                    <div className={`rounded-lg border ${borderColor} ${bgSecondary} p-3`}>
                      <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Break</p>
                      <p className="text-lg font-bold text-[#f59e0b]" data-testid="complete-summary-break">
                        {formatDuration(h.breakSeconds)}
                      </p>
                    </div>
                    <div className={`rounded-lg border ${borderColor} ${bgSecondary} p-3`}>
                      <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Total Span</p>
                      <p className={`text-lg font-bold ${textPrimary}`} data-testid="complete-summary-span">
                        {formatDuration(spanSeconds)}
                      </p>
                    </div>
                  </div>

                  {/* Work / break history */}
                  <div>
                    <p className={`text-xs font-medium ${textSecondary} mb-2`}>
                      Time History
                      {h.breakCount > 0 && (
                        <span className="ml-1">· {h.breakCount} break{h.breakCount === 1 ? '' : 's'}</span>
                      )}
                    </p>
                    {h.entries.length === 0 ? (
                      <div className={`rounded-lg border ${borderColor} ${bgSecondary} p-4 text-center`}>
                        <p className={`text-xs ${textSecondary}`}>
                          The timer was never started on this task, so there is no time history to show.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto" data-testid="complete-summary-history">
                        {h.entries.map((e, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between gap-3 rounded-lg border ${borderColor} ${bgSecondary} px-3 py-2`}
                            data-testid={`complete-summary-entry-${idx}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {e.kind === 'work' ? (
                                <Play className="h-3.5 w-3.5 text-[#10b981] flex-shrink-0" />
                              ) : (
                                <Pause className="h-3.5 w-3.5 text-[#f59e0b] flex-shrink-0" />
                              )}
                              <span className={`text-xs ${textPrimary}`}>
                                {e.kind === 'work' ? 'Worked' : 'Break'}
                              </span>
                              <span className={`text-xs ${textSecondary} truncate`}>
                                {fmtClock(e.start)} → {e.running ? 'now' : fmtClock(e.end)}
                              </span>
                            </div>
                            <span className={`text-xs font-medium flex-shrink-0 ${e.kind === 'work' ? 'text-[#10b981]' : 'text-[#f59e0b]'}`}>
                              {formatDuration(e.seconds)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={`p-5 border-t ${borderColor} flex justify-end gap-2`}>
                  <Button
                    variant="outline"
                    onClick={() => setCompleteSummaryTask(null)}
                    data-testid="complete-summary-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                    onClick={() => {
                      // Hand straight over to the approval popup, seeded exactly
                      // as the row's Approve button seeds it (existing approver
                      // and work link carried across), then drop this one so the
                      // two modals never stack.
                      setCompleteSummaryTask(null);
                      setApprovalTask(t);
                      setApprovalDraft({
                        approver_role: t.approval_request?.approver_role || '',
                        note: '',
                        work_link: t.approval_request?.work_link || t.work_link || '',
                      });
                    }}
                    data-testid="complete-summary-send-approval"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Send to Approve
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

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
                      onChange={(e) => setEditTimeModal((m) => ({ ...m, sH: clampHour(e.target.value) }))}
                      className="w-20 text-center text-2xl font-normal text-[#fafafa] bg-[#27272a] border border-[#3f3f46] rounded-lg py-2"
                      data-testid="edit-time-start-hour"
                    />
                    <span className="text-2xl text-[#a1a1aa]">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={String(editTimeModal.sM).padStart(2, '0')}
                      onChange={(e) => setEditTimeModal((m) => ({ ...m, sM: clampMinute(e.target.value) }))}
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
                      onChange={(e) => setEditTimeModal((m) => ({ ...m, eH: clampHour(e.target.value) }))}
                      className="w-20 text-center text-2xl font-normal text-[#fafafa] bg-[#27272a] border border-[#3f3f46] rounded-lg py-2"
                      data-testid="edit-time-end-hour"
                    />
                    <span className="text-2xl text-[#a1a1aa]">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={String(editTimeModal.eM).padStart(2, '0')}
                      onChange={(e) => setEditTimeModal((m) => ({ ...m, eM: clampMinute(e.target.value) }))}
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
