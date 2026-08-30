import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Briefcase, X, Calendar, Users, ListChecks, Check, ExternalLink, FileText, FileSpreadsheet, FolderOpen, Pencil, Trash2, Video, Wallet, Building2, TrendingDown, Globe, Target, BarChart3, Layers, Megaphone, KeyRound, Link2, History, NotebookPen, Info, MoreHorizontal, ListTodo, Clock, CheckCircle2, ShieldQuestion, Eye, Timer, Play, Pause, GripVertical, Pin, PinOff, Workflow, Copy } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import PaymentScheduleTab from './projects/PaymentScheduleTab';
import ProjectExpenseTab from './projects/ProjectExpenseTab';
import ProjectContentCalendarTab from './projects/ProjectContentCalendarTab';
import ClientPortalModal from './projects/ClientPortalModal';
import ProjectErpOthersTab from './projects/ProjectErpOthersTab';
import ProjectSeoScopeTab from './projects/ProjectSeoScopeTab';
import ProjectBacklinksTab from './projects/ProjectBacklinksTab';
import ProjectDeliveryHistoryTab from './projects/ProjectDeliveryHistoryTab';
import ProjectPagesTab from './projects/ProjectPagesTab';
import ProjectOthersTab from './projects/ProjectOthersTab';
import ProjectErpUsersTab from './projects/ProjectErpUsersTab';
import ProjectErpDepartmentsTab from './projects/ProjectErpDepartmentsTab';
import ProjectErpWorkflowTab from './projects/ProjectErpWorkflowTab';
import ErpLocationPicker from './projects/ErpLocationPicker';
import ErpTaskModal from './projects/ErpTaskModal';
import ProjectScopesTab from './projects/ProjectScopesTab';
import ProjectCampaignsTab from './projects/ProjectCampaignsTab';
import ProjectMetaReportsTab from './projects/ProjectMetaReportsTab';
import ProjectDailyNotesTab from './projects/ProjectDailyNotesTab';
import ProjectsNotesHistoryPanel from './projects/ProjectsNotesHistoryPanel';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { SearchableSelect } from './ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import MeetingModal from './MeetingModal';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { ERP_TASK_TYPE_OPTIONS } from '../utils/erpTaskTypes';
import { buildErpPrompt } from '../utils/erpPrompt';

const API = process.env.REACT_APP_BACKEND_URL;

const DEPARTMENTS = [
  { value: 'website', label: 'Website' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'meta', label: 'Meta Ads' },
  { value: 'seo', label: 'SEO' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'business_dev', label: 'Business Dev' },
  { value: 'erp', label: 'ERP' },
];

const emptyTaskDraft = {
  task_name: '', description: '', assigned_to: '', due_date: '', priority: 'medium', work_link: '', department: '', category: '',
  erp_user_id: '', erp_user_name: '', erp_page_id: '', erp_page_name: '',
  erp_sub_tab_id: '', erp_sub_tab_name: '',
  erp_ultra_sub_tab_id: '', erp_ultra_sub_tab_name: '',
  erp_ultra_tab_id: '', erp_ultra_tab_name: '',
  erp_task_type: '',
};

export default function ProjectsPanel({
  isDark, textPrimary, textSecondary, bgCard, bgSecondary, borderColor, headers, onTaskCreated, currentUser,
  viewOnly = false, contentCalendarViewOnly,
  // View/Edit mode toggle — owned by the parent (OurTasksPage), just rendered
  // here too so it's reachable from inside a project's header without
  // scrolling back up to the top of the Projects tab.
  showModeToggle = false, projectsViewMode, setProjectsViewMode,
}) {
  // Permission: the parent (OurTasksPage) already resolves this correctly — privileged
  // roles via their own View/Edit toggle, everyone else via their designation's
  // operations_projects config — and passes it down as `viewOnly`. Previously this
  // panel ALSO re-checked designation with a hardcoded exact-string match
  // (desg === 'operation head'), which silently blocked anyone whose actual
  // designation title didn't match that literal string (e.g. "Head of Operations").
  const role = (currentUser?.role || '').toLowerCase();
  const canManageProjects = !viewOnly;
  const isAdminRole = role === 'super_admin' || role === 'admin';
  // A task's Edit/Delete in the Tasks tab is only for whoever it's assigned
  // to, or an admin/super_admin — narrower than canManageProjects, which
  // just gates "not in view-only mode". ERP-tagged tasks (erp_user_id set)
  // edit via the same shared ErpTaskModal the ERP Users tab uses, so they're
  // no longer excluded here.
  const canEditProjectTask = (task) => isAdminRole || task.assigned_to === currentUser?.user_id;
  // Content Calendar ignores admins'/super admins' own View/Edit self-toggle (that
  // toggle is a personal "look, don't touch" convenience, not a real restriction on
  // them) — falls back to the general viewOnly rule if the parent didn't pass one.
  const canManageContentCalendar = !(contentCalendarViewOnly ?? viewOnly);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null); // project being viewed
  const [projectDetailCollapsed, setProjectDetailCollapsed] = useState(true);
  const [showClientPortalModal, setShowClientPortalModal] = useState(false);
  const [editingWeblink, setEditingWeblink] = useState(false);
  const [weblinkDraft, setWeblinkDraft] = useState('');
  const [editingProposalLink, setEditingProposalLink] = useState(false);
  const [proposalLinkDraft, setProposalLinkDraft] = useState('');
  const [showResetDeliveryModal, setShowResetDeliveryModal] = useState(false);
  const [resetDeliveryDraft, setResetDeliveryDraft] = useState({ new_due_date: '', reason: '' });
  const [savingResetDelivery, setSavingResetDelivery] = useState(false);
  // Handover — OTP-gated, Popup 1 picks the date and emails an OTP to every
  // Super Admin, Popup 2 (opened by re-clicking the same button) is where
  // the OTP is manually entered to actually flip status to "Hand Over".
  const [showHandoverRequestModal, setShowHandoverRequestModal] = useState(false);
  const [showHandoverVerifyModal, setShowHandoverVerifyModal] = useState(false);
  const [handoverDateDraft, setHandoverDateDraft] = useState('');
  const [handoverOtpDraft, setHandoverOtpDraft] = useState('');
  const [handoverRemarksDraft, setHandoverRemarksDraft] = useState('');
  const [savingHandover, setSavingHandover] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  // viewOnlyTask holds the task currently shown in the read-only preview
  // popup (task details + time-tracking timeline). Editing an ERP-hierarchy
  // task (erp_user_id set) opens erpTaskModal — the shared ErpTaskModal,
  // seeded with that task's existing location/draft — instead of the plain
  // taskDraft form below, which only knows department/category tasks.
  const [viewOnlyTask, setViewOnlyTask] = useState(null);
  const [erpTaskModal, setErpTaskModal] = useState(null); // { taskId, location, draft } | null
  // Brief "Copied!" feedback on the viewOnlyTask preview's copy-prompt button.
  const [promptCopied, setPromptCopied] = useState(false);
  // Manual timer controls + time-edit form inside the viewOnlyTask preview.
  const [savingTime, setSavingTime] = useState(false);
  const [timeEditOpen, setTimeEditOpen] = useState(false);
  const [timeEditDraft, setTimeEditDraft] = useState({ date: '', start_time: '', end_time: '' });
  const [deptFilter, setDeptFilter] = useState('all');
  // Technology / Marketing grouping — a top-level scope above the department
  // pills, sourced from each department's `group` field (set in Operations >
  // Departments). Narrows which department pills show as "sub tabs" below it.
  const [projectGroupFilter, setProjectGroupFilter] = useState('all');

  const [projectDraft, setProjectDraft] = useState({ name: '', client_id: '', description: '', start_date: '', due_date: '', project_type: 'onetime', departments: [], members: [] });
  const [clients, setClients] = useState([]);
  const [taskDraft, setTaskDraft] = useState(emptyTaskDraft);
  const [deptCategories, setDeptCategories] = useState([]); // [{dept_key, label, categories: [...]}]
  const [deptStatuses, setDeptStatuses] = useState([]); // [{dept_key, label, statuses: [...]}]
  const [statusFilter, setStatusFilter] = useState('all'); // Project List View status sub-tab (only meaningful when deptFilter !== 'all')
  const [taskStatusFilter, setTaskStatusFilter] = useState('all'); // all | todo | progress | approval | completed
  // Team management for selected project
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamDraft, setTeamDraft] = useState([]);
  const [teamSaving, setTeamSaving] = useState(false);
  // Documents (Sheets / Docs / Drive) modal
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showDeptsModal, setShowDeptsModal] = useState(false);
  const [deptsDraft, setDeptsDraft] = useState([]);
  const [deptsSaving, setDeptsSaving] = useState(false);
  const [projectInnerTab, setProjectInnerTab] = useState('tasks'); // 'tasks' | 'payment'
  // Notes History — the date-wise feed of every project's Daily Notes for the
  // department tab currently selected. Replaces the project table while open.
  const [showNotesHistory, setShowNotesHistory] = useState(false);
  const [docsTab, setDocsTab] = useState('sheets'); // 'sheets' | 'docs' | 'drive'
  const [editingDocId, setEditingDocId] = useState(null);
  const [docDraft, setDocDraft] = useState({ name: '', link: '' });
  // Meetings
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [projectMeetings, setProjectMeetings] = useState([]);
  const [showMeetingsList, setShowMeetingsList] = useState(false);
  // Delete project — Super Admin only, requires re-entering their password
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [deleteProjectPassword, setDeleteProjectPassword] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);
  // The project targeted for deletion — set from either the detail page's
  // own Delete button (selectedProject) or a row's Delete icon in the list
  // view (no navigation into the project required for the latter).
  const [deleteTargetProject, setDeleteTargetProject] = useState(null);
  // Task filters inside project detail
  const [taskMemberFilter, setTaskMemberFilter] = useState('all');
  const [taskDateFilter, setTaskDateFilter] = useState('all'); // all, today, single, range
  const [taskSingleDate, setTaskSingleDate] = useState('');
  const [taskDateFrom, setTaskDateFrom] = useState('');
  const [taskDateTo, setTaskDateTo] = useState('');
  // ERP hierarchy filters for the Tasks tab list — mirrors the ERP Users
  // tab's cascading filter bar, but filters the flat task list directly by
  // whichever erp_* ids each task carries (no tree to reveal here).
  const [taskErpDeptFilter, setTaskErpDeptFilter] = useState('all');
  const [taskErpUserFilter, setTaskErpUserFilter] = useState('all');
  const [taskErpPageFilter, setTaskErpPageFilter] = useState('all');
  const [taskErpSubTabFilter, setTaskErpSubTabFilter] = useState('all');
  const [taskErpUltraSubTabFilter, setTaskErpUltraSubTabFilter] = useState('all');
  const [taskErpUltraTabFilter, setTaskErpUltraTabFilter] = useState('all');
  const [taskErpTypeFilter, setTaskErpTypeFilter] = useState('all');
  const [taskWorkflowFilter, setTaskWorkflowFilter] = useState('all');

  // Remember which project + inner tab was open so a hard refresh restores it
  // instead of dropping back to the bare project list.
  const LAST_VIEW_KEY = 'dl_operations_last_project_view';
  useEffect(() => {
    try {
      if (selectedProject?.project_id) {
        localStorage.setItem(LAST_VIEW_KEY, JSON.stringify({ project_id: selectedProject.project_id, projectInnerTab, deptFilter }));
      } else {
        localStorage.removeItem(LAST_VIEW_KEY);
      }
    } catch { /* ignore storage errors */ }
  }, [selectedProject?.project_id, projectInnerTab, deptFilter]);

  useEffect(() => {
    let raw;
    try { raw = localStorage.getItem(LAST_VIEW_KEY); } catch { raw = null; }
    if (!raw) return;
    let saved;
    try { saved = JSON.parse(raw); } catch { return; }
    if (!saved?.project_id) return;
    axios.get(`${API}/api/projects/${saved.project_id}`, { headers })
      .then((res) => {
        setSelectedProject(res.data);
        setProjectInnerTab(saved.projectInnerTab || 'tasks');
        setDeptFilter(saved.deptFilter || 'all');
      })
      .catch(() => {
        try { localStorage.removeItem(LAST_VIEW_KEY); } catch { /* ignore */ }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProjects = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await axios.get(`${API}/api/projects`, { headers });
      setProjects(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [headers]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/users/basic`, { headers });
      setUsers(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, [headers]);

  const loadDeptCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/department-categories`, { headers });
      setDeptCategories(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, [headers]);

  const loadDeptStatuses = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/department-statuses`, { headers });
      setDeptStatuses(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, [headers]);

  const loadClients = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/finance/clients?include_summary=false`, { headers });
      setClients(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, [headers]);

  useEffect(() => {
    // Show spinner ONLY on first mount. Auto-refresh ticks update silently
    // so the list doesn't flicker every 15 seconds.
    loadProjects(true);
    loadUsers();
    loadDeptCategories();
    loadDeptStatuses();
    loadClients();
  }, [loadProjects, loadUsers, loadDeptCategories, loadDeptStatuses, loadClients]);

  // Keep the open project detail view in sync with the latest `projects` list.
  // The list endpoint (`GET /api/projects`) does NOT include the `tasks` array —
  // only `GET /api/projects/{id}` does. Previously this hook overwrote
  // `selectedProject` with the bare list row, which wiped out `tasks` on every
  // auto-refresh tick (the "tasks disappear after hard refresh" bug).
  //
  // We now MERGE list-level metadata (departments, members, task_count, etc.)
  // into the existing detail object and preserve `tasks`. When the underlying
  // task_count changes (e.g. someone added/removed a task) we refetch the
  // detail endpoint so the tasks array stays accurate.
  useEffect(() => {
    if (!selectedProject?.project_id) return;
    const fresh = projects.find(p => p.project_id === selectedProject.project_id);
    if (!fresh) return;
    const taskCountChanged = (fresh.task_count ?? 0) !== (selectedProject.task_count ?? (selectedProject.tasks?.length ?? 0));
    if (taskCountChanged) {
      // Task count drifted — pull full detail (includes `tasks`).
      axios.get(`${API}/api/projects/${selectedProject.project_id}`, { headers })
        .then(r => setSelectedProject(prev => prev?.project_id === r.data.project_id ? r.data : prev))
        .catch(() => {/* keep current state */});
      return;
    }
    // Same task count — merge list fields but keep the loaded `tasks` array.
    setSelectedProject(prev => {
      if (!prev) return prev;
      const existingTasks = prev.tasks;
      const merged = { ...prev, ...fresh };
      if (existingTasks !== undefined) merged.tasks = existingTasks;
      return merged;
    });
  }, [projects]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background polling + focus refresh — pauses while a create/edit modal is open
  useAutoRefresh(
    [loadProjects, loadUsers, loadDeptCategories],
    { enabled: !showCreateProject && !showAddTask && !showTeamModal && !showMeetingModal }
  );

  const handleCreateProject = async () => {
    if (!projectDraft.name.trim()) { toast.error('Project name is required'); return; }
    if (!projectDraft.client_id) { toast.error('Please select a client (Finance → Clients)'); return; }
    try {
      await axios.post(`${API}/api/projects`, projectDraft, { headers });
      toast.success('Project created');
      setProjectDraft({ name: '', client_id: '', description: '', start_date: '', due_date: '', project_type: 'onetime', departments: [], members: [] });
      setShowCreateProject(false);
      loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create project');
    }
  };

  const refreshSelectedProject = async () => {
    if (!selectedProject) return;
    try {
      const res = await axios.get(`${API}/api/projects/${selectedProject.project_id}`, { headers });
      setSelectedProject(res.data);
    } catch { /* ignore */ }
  };

  // Load meetings for selected project
  useEffect(() => {
    if (!selectedProject?.project_id) { setProjectMeetings([]); return; }
    axios.get(`${API}/api/meetings/`, { headers })
      .then(r => setProjectMeetings((r.data || []).filter(m => m.project_id === selectedProject.project_id)))
      .catch(() => setProjectMeetings([]));
  }, [selectedProject?.project_id, showMeetingModal]);  // eslint-disable-line react-hooks/exhaustive-deps

  const openTeamModal = () => {
    setTeamDraft([...(selectedProject?.members || [])]);
    setShowTeamModal(true);
  };

  const handleSaveTeam = async () => {
    if (!selectedProject) return;
    setTeamSaving(true);
    try {
      await axios.patch(
        `${API}/api/projects/${selectedProject.project_id}`,
        { members: teamDraft },
        { headers }
      );
      toast.success('Team updated');
      setShowTeamModal(false);
      refreshSelectedProject();
      loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update team');
    } finally {
      setTeamSaving(false);
    }
  };

  const openDeptsModal = () => {
    setDeptsDraft([...(selectedProject?.departments || [])]);
    setShowDeptsModal(true);
  };

  const handleSaveDepartments = async () => {
    if (!selectedProject) return;
    setDeptsSaving(true);
    try {
      await axios.patch(
        `${API}/api/projects/${selectedProject.project_id}`,
        { departments: deptsDraft },
        { headers }
      );
      toast.success('Departments updated');
      setShowDeptsModal(false);
      refreshSelectedProject();
      loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update departments');
    } finally {
      setDeptsSaving(false);
    }
  };

  // Union of custom statuses across every department a project is linked to
  // (a project can span multiple departments — see `departments` field).
  // Falls back to including the project's current status even if it's no
  // longer defined on any linked department, so the dropdown never hides
  // the value that's actually set.
  const statusOptionsFor = (project) => {
    const deptKeys = project?.departments || [];
    const options = [];
    deptStatuses
      .filter(d => deptKeys.includes(d.dept_key))
      .forEach(d => (d.statuses || []).forEach(s => { if (!options.includes(s)) options.push(s); }));
    const current = project?.status;
    if (current && !options.includes(current)) options.unshift(current);
    if (options.length === 0 && !current) options.push('active');
    return options;
  };

  const updateProjectField = async (field, value) => {
    if (!selectedProject) return;
    try {
      await axios.patch(
        `${API}/api/projects/${selectedProject.project_id}`,
        { [field]: value || null },
        { headers }
      );
      setSelectedProject(prev => prev ? { ...prev, [field]: value || null } : prev);
      loadProjects();
      toast.success('Project updated');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update project');
    }
  };

  // A bare domain (e.g. "www.drawlead.com") in an <a href> resolves as a
  // RELATIVE path against the current origin instead of navigating out —
  // always force a protocol so the link actually leaves the app.
  const normalizeUrl = (url) => {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  // Reset the Weblink edit state whenever a different project is opened.
  useEffect(() => {
    setEditingWeblink(false);
    setWeblinkDraft('');
    setShowHandoverRequestModal(false);
    setShowHandoverVerifyModal(false);
    setHandoverDateDraft('');
    setHandoverOtpDraft('');
    setHandoverRemarksDraft('');
  }, [selectedProject?.project_id]);

  const isOverdue = (dueIso) => {
    if (!dueIso) return false;
    const due = new Date(dueIso);
    due.setHours(23, 59, 59, 999);
    return due < new Date();
  };

  const openResetDeliveryModal = () => {
    setResetDeliveryDraft({ new_due_date: '', reason: '' });
    setShowResetDeliveryModal(true);
  };

  // Sets a fresh due_date and appends a row to delivery_date_history —
  // recorded date, the CURRENT logged-in user (never manually chosen,
  // regardless of their role), the new delivery date, and the reason.
  const submitResetDeliveryDate = async () => {
    if (!resetDeliveryDraft.new_due_date) { toast.error('Please pick a new delivery date'); return; }
    if (!resetDeliveryDraft.reason.trim()) { toast.error('Please enter a reason'); return; }
    setSavingResetDelivery(true);
    try {
      const historyEntry = {
        id: `ddh_${Math.random().toString(36).slice(2, 10)}`,
        recorded_at: new Date().toISOString(),
        set_by: currentUser?.user_id || null,
        set_by_name: currentUser?.name || 'Unknown',
        new_due_date: resetDeliveryDraft.new_due_date,
        reason: resetDeliveryDraft.reason.trim(),
      };
      const nextHistory = [...(selectedProject.delivery_date_history || []), historyEntry];
      const res = await axios.patch(
        `${API}/api/projects/${selectedProject.project_id}`,
        { due_date: resetDeliveryDraft.new_due_date, delivery_date_history: nextHistory },
        { headers },
      );
      setSelectedProject(res.data);
      loadProjects();
      toast.success('Delivery date reset');
      setShowResetDeliveryModal(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to reset delivery date');
    } finally {
      setSavingResetDelivery(false);
    }
  };

  // Re-clicking the Handover button reads current status: no pending
  // request → date-picker popup; already "otp_requested" → skip straight
  // to the OTP-entry popup instead of re-requesting.
  const openHandoverModal = () => {
    if (selectedProject?.handover?.status === 'otp_requested') {
      setHandoverOtpDraft('');
      setHandoverRemarksDraft('');
      setShowHandoverVerifyModal(true);
    } else {
      setHandoverDateDraft('');
      setShowHandoverRequestModal(true);
    }
  };

  const submitHandoverRequestOtp = async () => {
    if (!handoverDateDraft) { toast.error('Please pick a handover date'); return; }
    setSavingHandover(true);
    try {
      const res = await axios.post(
        `${API}/api/projects/${selectedProject.project_id}/handover/request-otp`,
        { handover_date: handoverDateDraft },
        { headers },
      );
      setSelectedProject(res.data);
      loadProjects();
      // Backend reports the actual send result per recipient — surface it
      // rather than assuming success, since a "mocked"/"error" result means
      // the OTP never actually reached anyone's inbox.
      const results = res.data.handover_notify_results || [];
      const failed = results.filter(r => r.status !== 'success');
      if (results.length === 0) {
        toast.success('Handover requested');
      } else if (failed.length === results.length) {
        const reason = failed[0]?.message || failed[0]?.status || 'unknown reason';
        toast.error(`Email did not send: ${reason}`, { duration: 10000 });
      } else if (failed.length > 0) {
        toast.warning(`OTP sent, but failed for ${failed.map(f => f.email).join(', ')}: ${failed[0]?.message || failed[0]?.status}`, { duration: 10000 });
      } else {
        toast.success(`OTP sent to: ${results.map(r => r.email).join(', ')}`);
      }
      setShowHandoverRequestModal(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to request OTP');
    } finally {
      setSavingHandover(false);
    }
  };

  const submitHandoverVerifyOtp = async () => {
    if (!handoverOtpDraft.trim()) { toast.error('Please enter the OTP'); return; }
    setSavingHandover(true);
    try {
      const res = await axios.post(
        `${API}/api/projects/${selectedProject.project_id}/handover/verify-otp`,
        { otp: handoverOtpDraft.trim(), remarks: handoverRemarksDraft },
        { headers },
      );
      setSelectedProject(res.data);
      loadProjects();
      toast.success('Project handed over');
      setShowHandoverVerifyModal(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to verify OTP');
    } finally {
      setSavingHandover(false);
    }
  };

  // Like updateProjectField, but for a row in the list view (not necessarily
  // the currently open project detail).
  const updateProjectRowStatus = async (project, value) => {
    try {
      await axios.patch(`${API}/api/projects/${project.project_id}`, { status: value }, { headers });
      setProjects(prev => prev.map(x => x.project_id === project.project_id ? { ...x, status: value } : x));
      if (selectedProject?.project_id === project.project_id) {
        setSelectedProject(prev => prev ? { ...prev, status: value } : prev);
      }
      toast.success('Project updated');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update project');
    }
  };

  // Pinned projects always sort first (by their own order rank), then
  // everything else follows in manual order. Applied after any optimistic
  // local mutation (drag, pin toggle) so `projects` stays canonically
  // ordered and the row list only ever needs to .filter(), never .sort().
  const pinnedThenOrderSort = (a, b) => {
    const ap = a.is_pinned ? 0 : 1;
    const bp = b.is_pinned ? 0 : 1;
    return ap !== bp ? ap - bp : (a.order ?? 0) - (b.order ?? 0);
  };

  const pinnedProjectCount = projects.filter(p => p.is_pinned).length;

  const togglePinProject = async (project) => {
    if (!canManageProjects) return;
    try {
      const res = await axios.put(`${API}/api/projects/${project.project_id}/pin`, {}, { headers });
      setProjects(prev => prev.map(x => x.project_id === project.project_id ? { ...x, ...res.data } : x).sort(pinnedThenOrderSort));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update pin');
    }
  };

  // Plain HTML5 drag events rather than a DnD library — no new dependency
  // needed, and it drops straight onto the existing rows. Indices are found
  // in the full `projects` array (not the filtered/rendered subset) since a
  // department/status filter can hide rows — same reasoning as the
  // ERP Users tab's id-keyed reorder (ProjectErpUsersTab.js).
  const reorderArray = (arr, fromIndex, toIndex) => {
    const next = [...arr];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const persistProjectOrder = async (reordered) => {
    let pinnedSeq = 0;
    let unpinnedSeq = 0;
    const withOrder = reordered.map(p => ({ ...p, order: p.is_pinned ? pinnedSeq++ : unpinnedSeq++ }));
    setProjects(withOrder);
    try {
      await axios.put(`${API}/api/projects/reorder`, {
        projects: withOrder.map(p => ({ project_id: p.project_id, order: p.order })),
      }, { headers });
    } catch (e) {
      toast.error('Failed to save order');
      loadProjects();
    }
  };

  const [dragProjectId, setDragProjectId] = useState(null);
  const moveProject = (fromId, toId) => {
    if (!canManageProjects || fromId === toId) return;
    const fromIndex = projects.findIndex(p => p.project_id === fromId);
    const toIndex = projects.findIndex(p => p.project_id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    // Dragging across the pinned/unpinned boundary is a no-op — the pin
    // button is what moves a project between those two groups.
    if (!!projects[fromIndex].is_pinned !== !!projects[toIndex].is_pinned) return;
    persistProjectOrder(reorderArray(projects, fromIndex, toIndex));
  };
  const projectDragProps = (projectId) => (!canManageProjects ? {} : {
    draggable: true,
    onDragStart: (e) => { setDragProjectId(projectId); e.dataTransfer.effectAllowed = 'move'; },
    onDragOver: (e) => { if (dragProjectId && dragProjectId !== projectId) e.preventDefault(); },
    onDrop: (e) => {
      e.preventDefault();
      if (dragProjectId && dragProjectId !== projectId) moveProject(dragProjectId, projectId);
      setDragProjectId(null);
    },
    onDragEnd: () => setDragProjectId(null),
  });

  // Super Admin only — deleting a project requires re-entering their
  // password (verified server-side against the account's stored hash).
  const confirmDeleteProject = async () => {
    if (!deleteTargetProject || !deleteProjectPassword) return;
    setDeletingProject(true);
    try {
      await axios.delete(`${API}/api/projects/${deleteTargetProject.project_id}`, {
        data: { password: deleteProjectPassword },
        headers,
      });
      toast.success('Project deleted');
      setShowDeleteProjectModal(false);
      setDeleteProjectPassword('');
      // Only navigate back to the list if we were viewing the project that
      // just got deleted (list-row deletes leave selectedProject untouched).
      if (selectedProject?.project_id === deleteTargetProject.project_id) {
        setSelectedProject(null);
      }
      setDeleteTargetProject(null);
      loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete project');
    } finally {
      setDeletingProject(false);
    }
  };

  // Persist the full documents array on the project
  const saveDocuments = async (newDocs) => {
    if (!selectedProject) return;
    try {
      await axios.patch(
        `${API}/api/projects/${selectedProject.project_id}`,
        { documents: newDocs },
        { headers }
      );
      setSelectedProject(prev => prev ? { ...prev, documents: newDocs } : prev);
      loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save document');
      throw e;
    }
  };

  const handleSaveDoc = async () => {
    if (!docDraft.name.trim()) { toast.error('Name is required'); return; }
    if (!docDraft.link.trim()) { toast.error('Link is required'); return; }
    const existing = selectedProject?.documents || [];
    let nextDocs;
    if (editingDocId) {
      nextDocs = existing.map(d =>
        d.doc_id === editingDocId
          ? { ...d, name: docDraft.name.trim(), link: docDraft.link.trim() }
          : d
      );
    } else {
      const newDoc = {
        doc_id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kind: docsTab, // 'sheets' | 'docs' | 'drive'
        name: docDraft.name.trim(),
        link: docDraft.link.trim(),
        added_by: currentUser?.user_id || null,
        added_by_name: currentUser?.name || null,
        added_at: new Date().toISOString(),
      };
      nextDocs = [...existing, newDoc];
    }
    try {
      await saveDocuments(nextDocs);
      toast.success(editingDocId ? 'Document updated' : 'Document added');
      setDocDraft({ name: '', link: '' });
      setEditingDocId(null);
    } catch { /* toast already shown */ }
  };

  const handleEditDoc = (doc) => {
    setEditingDocId(doc.doc_id);
    setDocDraft({ name: doc.name || '', link: doc.link || '' });
    setDocsTab(doc.kind || 'sheets');
  };

  const handleDeleteDoc = async (docId) => {
    const existing = selectedProject?.documents || [];
    const nextDocs = existing.filter(d => d.doc_id !== docId);
    try {
      await saveDocuments(nextDocs);
      toast.success('Document removed');
      if (editingDocId === docId) {
        setEditingDocId(null);
        setDocDraft({ name: '', link: '' });
      }
    } catch { /* toast already shown */ }
  };

  const handleAddTask = async () => {
    if (!selectedProject) return;
    if (!taskDraft.task_name.trim()) { toast.error('Task name is required'); return; }
    if (!taskDraft.assigned_to) { toast.error('Please assign to a user'); return; }
    if (taskDraft.department && !taskDraft.category) { toast.error('Please select a Category'); return; }
    try {
      if (editingTaskId) {
        await axios.put(`${API}/api/our-tasks/tasks/${editingTaskId}`, taskDraft, { headers });
        toast.success('Task updated');
      } else {
        await axios.post(`${API}/api/projects/${selectedProject.project_id}/tasks`, taskDraft, { headers });
        toast.success('Task added — appears in assignee\'s My Tasks');
      }
      setTaskDraft(emptyTaskDraft);
      setShowAddTask(false);
      setEditingTaskId(null);
      refreshSelectedProject();
      loadProjects();
      if (onTaskCreated) onTaskCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save task');
    }
  };

  // Starts a fresh Add Task without closing the modal — lets someone add
  // several tasks back to back from the same popup.
  const handleAddAnotherTask = () => {
    setEditingTaskId(null);
    setTaskDraft(prev => ({ ...emptyTaskDraft, department: prev.department, category: '' }));
  };

  const handleEditTask = (task) => {
    // ERP-tagged tasks (erp_user_id set) edit through the same shared
    // ErpTaskModal the ERP Users tab uses, seeded with this task's existing
    // location — everything else uses the plain department/category form.
    if (task.erp_user_id) {
      setErpTaskModal({
        taskId: task.task_id,
        location: {
          erp_user_id: task.erp_user_id, erp_user_name: task.erp_user_name,
          erp_page_id: task.erp_page_id, erp_page_name: task.erp_page_name,
          erp_sub_tab_id: task.erp_sub_tab_id, erp_sub_tab_name: task.erp_sub_tab_name,
          erp_ultra_sub_tab_id: task.erp_ultra_sub_tab_id, erp_ultra_sub_tab_name: task.erp_ultra_sub_tab_name,
          erp_ultra_tab_id: task.erp_ultra_tab_id, erp_ultra_tab_name: task.erp_ultra_tab_name,
        },
        draft: {
          task_name: task.task_name || '',
          priority: task.priority || 'medium',
          erp_task_type: task.erp_task_type || '',
          assigned_to: task.assigned_to || '',
          due_date: task.due_date ? task.due_date.split('T')[0] : '',
          work_link: task.work_link || '',
          reference_image: task.reference_image || '',
          voice_note: task.voice_note || '',
        },
      });
      return;
    }
    setEditingTaskId(task.task_id);
    setTaskDraft({
      task_name: task.task_name || '',
      description: task.description || '',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      priority: task.priority || 'medium',
      work_link: task.work_link || '',
      department: task.department || '',
      category: task.category || '',
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
    });
    setShowAddTask(true);
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/api/our-tasks/tasks/${taskId}`, { headers });
      toast.success('Task deleted');
      refreshSelectedProject();
      loadProjects();
      if (onTaskCreated) onTaskCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete task');
    }
  };

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : '—');
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Copies the ERP prompt text and (if present) the task's reference image
  // together as one clipboard write, so pasting into a chat/AI tool drops
  // both in at once instead of needing two separate copy actions.
  const handleCopyPromptAndImage = async (task) => {
    const promptText = buildErpPrompt({
      projectName: selectedProject.name,
      userName: task.erp_user_name,
      pageName: task.erp_page_name,
      subTabName: task.erp_sub_tab_name,
      ultraSubTabName: task.erp_ultra_sub_tab_name,
      ultraTabName: task.erp_ultra_tab_name,
      taskName: task.task_name,
    });
    try {
      const items = { 'text/plain': new Blob([promptText], { type: 'text/plain' }) };
      if (task.reference_image) {
        const imgBlob = await (await fetch(task.reference_image)).blob();
        items[imgBlob.type || 'image/png'] = imgBlob;
      }
      await navigator.clipboard.write([new ClipboardItem(items)]);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1500);
      toast.success(task.reference_image ? 'Prompt + image copied' : 'Prompt copied');
    } catch {
      // Some browsers can't clipboard-write an image alongside text — fall
      // back to at least copying the prompt text.
      try {
        await navigator.clipboard.writeText(promptText);
        setPromptCopied(true);
        setTimeout(() => setPromptCopied(false), 1500);
        toast.success('Prompt copied (this browser can\'t copy the image with it)');
      } catch {
        toast.error('Failed to copy');
      }
    }
  };

  // Timer start/pause/resume/finish for the task currently open in the
  // viewOnlyTask preview. Both endpoints return the updated task, so the
  // preview updates immediately without a full project reload (though we
  // still refresh in the background to keep the task list's own state in sync).
  const runTimeAction = async (action) => {
    if (!viewOnlyTask) return;
    setSavingTime(true);
    try {
      const res = await axios.post(`${API}/api/our-tasks/tasks/${viewOnlyTask.task_id}/time`, { action }, { headers });
      setViewOnlyTask(res.data);
      refreshSelectedProject();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update timer');
    } finally {
      setSavingTime(false);
    }
  };

  const openTimeEdit = () => {
    const sessions = viewOnlyTask?.time_tracking?.sessions || [];
    const first = sessions[0];
    const last = sessions[sessions.length - 1];
    const toHHMM = (iso) => (iso ? new Date(iso).toISOString().slice(11, 16) : '');
    setTimeEditDraft({
      date: first?.start ? first.start.slice(0, 10) : new Date().toISOString().slice(0, 10),
      start_time: toHHMM(first?.start),
      end_time: toHHMM(last?.end),
    });
    setTimeEditOpen(true);
  };

  const submitTimeEdit = async () => {
    if (!timeEditDraft.start_time && !timeEditDraft.end_time) {
      toast.error('Enter a start or end time');
      return;
    }
    setSavingTime(true);
    try {
      const res = await axios.patch(`${API}/api/our-tasks/tasks/${viewOnlyTask.task_id}/time-edit`, {
        date: timeEditDraft.date || undefined,
        start_time: timeEditDraft.start_time || undefined,
        end_time: timeEditDraft.end_time || undefined,
      }, { headers });
      setViewOnlyTask(res.data);
      refreshSelectedProject();
      setTimeEditOpen(false);
      toast.success('Time updated');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update time');
    } finally {
      setSavingTime(false);
    }
  };

  // SEO Scope tab "Add Task" — defaults Department to SEO and Category to
  // whichever sub-tab (Research / On Page SEO / Off Page SEO) is active.
  const openAddTaskForSeoScope = (category) => {
    const defaultCategory = category || deptCategories.find(d => d.dept_key === 'seo')?.categories?.[0] || '';
    setEditingTaskId(null);
    setTaskDraft({ ...emptyTaskDraft, department: 'seo', category: defaultCategory });
    setShowAddTask(true);
  };

  // Days remaining (+N) or overdue (-N) against a due date, for the "Due
  // Balance" column — compares calendar days only (ignores time-of-day).
  const dueBalanceInfo = (dueIso) => {
    if (!dueIso) return null;
    const due = new Date(dueIso);
    if (isNaN(due)) return null;
    const today = new Date();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days = Math.round((dueDay - todayDay) / (1000 * 60 * 60 * 24));
    if (days === 0) return { label: 'Due today', color: '#f59e0b' };
    if (days > 0) return { label: `+${days}d`, color: '#10b981' };
    return { label: `${days}d overdue`, color: '#ef4444' };
  };

  // Department + Status navigation — shared between the list view and the
  // project detail view so it stays visible ("fixed") no matter which one
  // is showing. Clicking a tab from inside a project detail also exits back
  // to the (filtered) list, since that's what picking a different
  // department/status scope means.
  // Picking a department defaults its status filter to "Developing" when
  // that department's own status vocabulary has one, else "all".
  const defaultStatusForDept = (deptKey) => {
    const statuses = deptStatuses.find(d => d.dept_key === deptKey)?.statuses || [];
    return statuses.includes('Developing') ? 'Developing' : 'all';
  };
  // Technology / Marketing grouping — sourced from each department's own
  // `group` field (deptCategories, set via Operations > Departments), not
  // hardcoded here. A department with no group set won't appear under
  // either scope, only under "All".
  const deptGroupOf = (deptKey) => deptCategories.find(d => d.dept_key === deptKey)?.group || '';
  const scopedDepartments = projectGroupFilter === 'all'
    ? DEPARTMENTS
    : DEPARTMENTS.filter(d => deptGroupOf(d.value) === projectGroupFilter);
  const navTabsBar = (
    <div data-testid="project-nav-tabs">
      {/* Technology / Marketing scope — narrows the department pills below */}
      <div className="flex flex-wrap gap-2 mb-3">
        {[{ value: 'all', label: 'All' }, { value: 'technology', label: 'Technology' }, { value: 'marketing', label: 'Marketing' }].map(g => (
          <button
            key={g.value}
            onClick={() => {
              setProjectGroupFilter(g.value);
              if (g.value !== 'all' && deptFilter !== 'all' && deptGroupOf(deptFilter) !== g.value) {
                setDeptFilter('all');
                setStatusFilter('all');
              }
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              projectGroupFilter === g.value ? 'bg-[#111827] text-white' : `${bgSecondary} ${textSecondary} hover:bg-[#111827]/10`
            }`}
            data-testid={`project-group-filter-${g.value}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Department filter tabs with counts — sub-tabs of the group above */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { setSelectedProject(null); setDeptFilter('all'); setStatusFilter('all'); }}
          className={`px-3 py-1.5 rounded-full text-sm transition-all ${
            deptFilter === 'all' ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary} hover:bg-[#6366f1]/20`
          }`}
          data-testid="dept-filter-all"
        >
          All ({projects.length})
        </button>
        {scopedDepartments.map(d => {
          const count = projects.filter(p => (p.departments || []).includes(d.value)).length;
          if (count === 0) return null;
          return (
            <button
              key={d.value}
              onClick={() => { setSelectedProject(null); setDeptFilter(d.value); setStatusFilter(defaultStatusForDept(d.value)); }}
              className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                deptFilter === d.value ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary} hover:bg-[#6366f1]/20`
              }`}
              data-testid={`dept-filter-${d.value}`}
            >
              {d.label} ({count})
            </button>
          );
        })}

        {/* Notes History — sits at the end of the department row and opens the
            date-wise feed of Daily Notes for whichever department is selected. */}
        <button
          onClick={() => { setSelectedProject(null); setShowNotesHistory(v => !v); }}
          className={`px-3 py-1.5 rounded-full text-sm transition-all inline-flex items-center gap-1.5 ${
            showNotesHistory ? 'bg-[#10b981] text-white' : `${bgSecondary} ${textSecondary} hover:bg-[#10b981]/20`
          }`}
          data-testid="notes-history-btn"
        >
          <History className="h-3.5 w-3.5" />
          Notes History
        </button>
      </div>

      {/* Status sub-tabs — only meaningful once a specific department is
          selected, since status vocabularies are defined per department
          (Operations → Departments → {Dept} → Status tab). */}
      {deptFilter !== 'all' && !showNotesHistory && (() => {
        const deptProjects = projects.filter(p => (p.departments || []).includes(deptFilter));
        const statuses = deptStatuses.find(d => d.dept_key === deptFilter)?.statuses || [];
        if (statuses.length === 0) return null;
        return (
          <div className="flex justify-end mb-4" data-testid="project-status-subtabs">
            <select
              value={statusFilter}
              onChange={(e) => { setSelectedProject(null); setStatusFilter(e.target.value); }}
              className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
              data-testid="status-filter-select"
            >
              <option value="all">All Status ({deptProjects.length})</option>
              {statuses.map(s => {
                const count = deptProjects.filter(p => (p.status || 'active') === s).length;
                return <option key={s} value={s}>{s} ({count})</option>;
              })}
            </select>
          </div>
        );
      })()}
    </div>
  );

  // ---------- Project Detail View ----------
  if (selectedProject) {
    const projectTasks = selectedProject.tasks || [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // Member + date filters, shared by both the status summary cards below
    // (each card's own count is computed without the status filter itself,
    // so every bucket stays visible to jump between) and the task list.
    const matchesMemberAndDate = (t) => {
      if (taskMemberFilter !== 'all' && t.assigned_to !== taskMemberFilter) return false;
      const td = (t.due_date || t.created_at || '').slice(0, 10);
      if (taskDateFilter === 'today') return td === todayStr;
      if (taskDateFilter === 'tomorrow') return td === tomorrowStr;
      if (taskDateFilter === 'yesterday') return td === yesterdayStr;
      if (taskDateFilter === 'single') return taskSingleDate ? td === taskSingleDate : true;
      if (taskDateFilter === 'range') {
        if (taskDateFrom && td < taskDateFrom) return false;
        if (taskDateTo && td > taskDateTo) return false;
        return true;
      }
      return true;
    };
    // Todo = created/assigned but not started. Progress = timer started
    // (running or paused) — this is where manual time entry/editing
    // happens. Approval = has an open approval_request regardless of its
    // own status. Completed = finished OR its approval was approved —
    // either is enough on its own, so a task never falls through every
    // bucket just because it skipped the approval flow. An approved task
    // is Completed FIRST — it must not also still count as Todo/Progress/
    // Approval just because its own `status` field never got flipped to
    // 'completed' (that used to double-count it into two buckets at once).
    const isTaskCompleted = (t) => t.status === 'completed' || t.approval_request?.status === 'approved';
    const matchesTaskStatus = (t) => {
      if (taskStatusFilter === 'all') return true;
      if (taskStatusFilter === 'completed') return isTaskCompleted(t);
      if (isTaskCompleted(t)) return false;
      if (taskStatusFilter === 'todo') return (t.status || 'pending') === 'pending';
      if (taskStatusFilter === 'progress') return t.status === 'in_progress';
      if (taskStatusFilter === 'approval') return t.approval_request?.status === 'pending';
      return true;
    };
    // ERP hierarchy filters — a task carries its erp_* ids directly, so this
    // is a plain match rather than a tree walk. Department has no field of
    // its own on the task; it's resolved via the tagged erp_user's own
    // department_id.
    const erpUsersForFilter = selectedProject.erp_users || [];
    const matchesErpFilters = (t) => {
      if (taskErpDeptFilter !== 'all') {
        const eu = erpUsersForFilter.find(u => u.id === t.erp_user_id);
        if (eu?.department_id !== taskErpDeptFilter) return false;
      }
      if (taskErpUserFilter !== 'all' && t.erp_user_id !== taskErpUserFilter) return false;
      if (taskErpPageFilter !== 'all' && t.erp_page_id !== taskErpPageFilter) return false;
      if (taskErpSubTabFilter !== 'all' && t.erp_sub_tab_id !== taskErpSubTabFilter) return false;
      if (taskErpUltraSubTabFilter !== 'all' && t.erp_ultra_sub_tab_id !== taskErpUltraSubTabFilter) return false;
      if (taskErpUltraTabFilter !== 'all' && t.erp_ultra_tab_id !== taskErpUltraTabFilter) return false;
      if (taskErpTypeFilter !== 'all' && t.erp_task_type !== taskErpTypeFilter) return false;
      if (taskWorkflowFilter !== 'all' && t.workflow_id !== taskWorkflowFilter) return false;
      return true;
    };
    const matchesScopeFilters = (t) => matchesMemberAndDate(t) && matchesErpFilters(t);
    const statusScopedTasks = projectTasks.filter(matchesScopeFilters);
    const allTasksCount = statusScopedTasks.length;
    const completedTasksCount = statusScopedTasks.filter(isTaskCompleted).length;
    const notCompletedTasks = statusScopedTasks.filter(t => !isTaskCompleted(t));
    const todoTasksCount = notCompletedTasks.filter(t => (t.status || 'pending') === 'pending').length;
    const progressTasksCount = notCompletedTasks.filter(t => t.status === 'in_progress').length;
    const approvalTasksCount = notCompletedTasks.filter(t => t.approval_request?.status === 'pending').length;

    const filteredTasks = projectTasks.filter(t => matchesScopeFilters(t) && matchesTaskStatus(t));

    // Cascading option lists for the ERP filter selects below.
    const erpFilterVisibleUsers = taskErpDeptFilter === 'all'
      ? erpUsersForFilter
      : erpUsersForFilter.filter(u => u.department_id === taskErpDeptFilter);
    const erpFilterSelectedUser = erpUsersForFilter.find(u => u.id === taskErpUserFilter);
    const erpFilterPages = erpFilterSelectedUser?.pages || [];
    const erpFilterSelectedPage = erpFilterPages.find(p => p.id === taskErpPageFilter);
    const erpFilterSubTabs = erpFilterSelectedPage?.sub_tabs || [];
    const erpFilterSelectedSubTab = erpFilterSubTabs.find(s => s.id === taskErpSubTabFilter);
    const erpFilterUltraSubTabs = erpFilterSelectedSubTab?.ultra_sub_tabs || [];
    const erpFilterSelectedUltraSubTab = erpFilterUltraSubTabs.find(u => u.id === taskErpUltraSubTabFilter);
    const erpFilterUltraTabs = erpFilterSelectedUltraSubTab?.ultra_tabs || [];
    const hasErpDept = (selectedProject.departments || []).includes('erp');
    const erpFiltersActive = taskErpDeptFilter !== 'all' || taskErpUserFilter !== 'all' || taskErpPageFilter !== 'all'
      || taskErpSubTabFilter !== 'all' || taskErpUltraSubTabFilter !== 'all' || taskErpUltraTabFilter !== 'all' || taskErpTypeFilter !== 'all'
      || taskWorkflowFilter !== 'all';
    const resetErpTaskFilters = () => {
      setTaskErpDeptFilter('all'); setTaskErpUserFilter('all'); setTaskErpPageFilter('all');
      setTaskErpSubTabFilter('all'); setTaskErpUltraSubTabFilter('all'); setTaskErpUltraTabFilter('all');
      setTaskErpTypeFilter('all'); setTaskWorkflowFilter('all');
    };
    // Todo count shown next to each ERP filter option's label (e.g.
    // "Dashboard (10)") — scoped by the same member/date filters as the
    // task list itself, plus whichever ancestor level(s) are already fixed.
    const erpOptionTodoCount = (fields) => projectTasks.filter((t) => {
      if (!matchesMemberAndDate(t)) return false;
      if ((t.status || 'pending') !== 'pending') return false;
      return Object.entries(fields).every(([k, v]) => t[k] === v);
    }).length;
    const erpDeptTodoCount = (deptId) => projectTasks.filter((t) => {
      if (!matchesMemberAndDate(t)) return false;
      if ((t.status || 'pending') !== 'pending') return false;
      return erpUsersForFilter.find((u) => u.id === t.erp_user_id)?.department_id === deptId;
    }).length;
    const workflowTodoCount = (workflowId) => projectTasks.filter((t) => {
      if (!matchesMemberAndDate(t)) return false;
      if ((t.status || 'pending') !== 'pending') return false;
      return t.workflow_id === workflowId;
    }).length;
    // Busiest-first — re-sorts on every Team Member / Date change since
    // workflowTodoCount is scoped by those same filters. "All Workflows"
    // stays pinned first regardless.
    const workflowOptionsSorted = [...(selectedProject.erp_workflow || [])]
      .map((w) => ({ ...w, _todoCount: workflowTodoCount(w.id) }))
      .sort((a, b) => b._todoCount - a._todoCount);

    const taskSummaryCard = (label, value, Icon, colorClass, active, onClick) => (
      <button
        type="button"
        onClick={onClick}
        className={`${bgCard} border ${active ? 'border-[#6366f1] ring-1 ring-[#6366f1]' : borderColor} rounded-lg p-3 text-left transition-colors hover:border-[#6366f1]/60`}
        data-testid={`project-task-summary-${label.toLowerCase()}`}
      >
        <div className="flex items-center justify-between">
          <p className={`text-xs ${textSecondary}`}>{label}</p>
          <Icon className={`h-4 w-4 ${colorClass}`} />
        </div>
        <p className={`text-2xl font-bold mt-1 ${textPrimary}`}>{value}</p>
      </button>
    );

    // Members of the project (resolved against user list)
    const projectMembers = (selectedProject.members || [])
      .map(uid => users.find(u => u.user_id === uid) || { user_id: uid, name: uid });

    return (
      <div className="space-y-4" data-testid="project-detail-view">
        {navTabsBar}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-[200px]">
            <button onClick={() => setSelectedProject(null)} className={`text-sm ${textSecondary} hover:underline mb-1`}>
              ← Back to Projects
            </button>
            <h2 className={`text-2xl font-bold ${textPrimary}`}>{selectedProject.name}</h2>
            <p className={textSecondary}>{selectedProject.description}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {showModeToggle && (
              <div className={`inline-flex items-center gap-1.5 rounded-lg border ${borderColor} ${bgCard} p-1 mr-1`} data-testid="project-detail-mode-toggle">
                <button
                  onClick={() => setProjectsViewMode('view')}
                  data-testid="project-detail-mode-view"
                  className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                    projectsViewMode === 'view'
                      ? 'bg-[#6366f1] text-white shadow'
                      : `${textSecondary} hover:bg-[#6366f1]/10`
                  }`}
                >
                  View only
                </button>
                <button
                  onClick={() => setProjectsViewMode('edit')}
                  data-testid="project-detail-mode-edit"
                  className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                    projectsViewMode === 'edit'
                      ? 'bg-[#10b981] text-white shadow'
                      : `${textSecondary} hover:bg-[#10b981]/10`
                  }`}
                >
                  Edit
                </button>
              </div>
            )}
            <Button
              onClick={openTeamModal}
              variant="outline"
              className={`gap-2 ${!canManageProjects ? 'hidden' : ''}`}
              data-testid="project-team-btn"
            >
              <Users className="h-4 w-4" /> Team ({selectedProject.members?.length || 0})
            </Button>
            <Button
              onClick={() => setProjectDetailCollapsed(v => !v)}
              variant="outline"
              className="gap-2"
              data-testid="project-detail-collapse-toggle"
            >
              <Info className="h-4 w-4" /> Project Details
            </Button>
            <Button
              onClick={() => setShowMeetingModal(true)}
              className="gap-2 bg-[#10b981] hover:bg-[#059669] text-white"
              data-testid="project-schedule-meeting-btn"
            >
              <Video className="h-4 w-4" /> Schedule Meeting
            </Button>
            <Button onClick={() => setShowAddTask(true)} className={`bg-[#6366f1] hover:bg-[#4f46e5] text-white ${!canManageProjects ? 'hidden' : ''}`}>
              <Plus className="h-4 w-4 mr-1" /> Add Task
            </Button>
            {/* Everything below is used far less often than the buttons above —
                grouped into one popover instead of five separate buttons so
                this row doesn't overflow and squeeze the project title. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-1.5 px-2.5" data-testid="project-more-actions-btn">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={`${bgCard} border ${borderColor}`}>
                <DropdownMenuItem onClick={() => { setShowDocsModal(true); setEditingDocId(null); setDocDraft({ name: '', link: '' }); }} className={textPrimary} data-testid="project-docs-btn">
                  <FileText className="h-4 w-4" /> Documents ({(selectedProject.documents || []).length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowMeetingsList(true)} className={textPrimary} data-testid="project-meetings-list-btn">
                  <Video className="h-4 w-4" /> Meetings ({projectMeetings.length})
                </DropdownMenuItem>
                {canManageProjects && ['erp', 'website'].some((d) => (selectedProject.departments || []).includes(d)) && (
                  <DropdownMenuItem onClick={() => setShowClientPortalModal(true)} className={textPrimary} data-testid="project-client-portal-btn">
                    <KeyRound className="h-4 w-4" /> Client Portal
                  </DropdownMenuItem>
                )}
                {canManageProjects && selectedProject.status !== 'Hand Over' && (
                  <DropdownMenuItem
                    onClick={openHandoverModal}
                    className={selectedProject?.handover?.status === 'otp_requested' ? 'text-amber-500' : textPrimary}
                    data-testid="project-handover-btn"
                  >
                    <KeyRound className="h-4 w-4" /> {selectedProject?.handover?.status === 'otp_requested' ? 'OTP Requested' : 'Handover'}
                  </DropdownMenuItem>
                )}
                {role === 'super_admin' && (
                  <>
                    <DropdownMenuSeparator className={borderColor} />
                    <DropdownMenuItem
                      onClick={() => { setDeleteTargetProject(selectedProject); setDeleteProjectPassword(''); setShowDeleteProjectModal(true); }}
                      className="text-red-500 focus:text-red-500"
                      data-testid="project-delete-btn"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {!projectDetailCollapsed && (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-6 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <Calendar className={`h-4 w-4 ${textSecondary}`} />
                <span className={textSecondary}>Start:</span>
                {canManageProjects ? (
                  <input
                    type="date"
                    value={(selectedProject.start_date || '').slice(0, 10)}
                    onChange={(e) => updateProjectField('start_date', e.target.value)}
                    className={`px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                    data-testid="project-edit-start-date"
                  />
                ) : (
                  <span className={textPrimary}>{fmtDate(selectedProject.start_date)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className={`h-4 w-4 ${textSecondary}`} />
                <span className={textSecondary}>Due:</span>
                {canManageProjects ? (
                  <input
                    type="date"
                    value={(selectedProject.due_date || '').slice(0, 10)}
                    onChange={(e) => updateProjectField('due_date', e.target.value)}
                    className={`px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                    data-testid="project-edit-due-date"
                  />
                ) : (
                  <span className={textPrimary}>{fmtDate(selectedProject.due_date)}</span>
                )}
                {canManageProjects && isOverdue(selectedProject.due_date) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openResetDeliveryModal}
                    className="h-7 px-2 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                    data-testid="project-reset-delivery-btn"
                  >
                    Reset Delivery Date
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2"><ListChecks className={`h-4 w-4 ${textSecondary}`} /><span className={textPrimary}>{selectedProject.tasks?.length || 0} tasks</span></div>
              {canManageProjects ? (
                <select
                  value={selectedProject.status || 'active'}
                  onChange={(e) => updateProjectField('status', e.target.value)}
                  className={`px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                  data-testid="project-edit-status-select"
                >
                  {statusOptionsFor(selectedProject).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <Badge className="bg-[#10b981]/20 text-[#10b981]">{selectedProject.status || 'active'}</Badge>
              )}
              {canManageProjects ? (
                <select
                  value={selectedProject.project_type || ''}
                  onChange={(e) => updateProjectField('project_type', e.target.value)}
                  className={`px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                  data-testid="project-edit-type-select"
                >
                  <option value="">Type: —</option>
                  <option value="onetime">Onetime</option>
                  <option value="monthly">Monthly</option>
                </select>
              ) : selectedProject.project_type ? (
                <Badge className="bg-[#8b5cf6]/20 text-[#8b5cf6] capitalize">{selectedProject.project_type}</Badge>
              ) : null}
            </div>

            {/* Client — required link to Finance → Clients */}
            <div className="flex items-center gap-2 flex-wrap pt-1" data-testid="project-client-row">
              <Building2 className={`h-4 w-4 ${textSecondary}`} />
              <span className={`text-sm ${textSecondary}`}>Client:</span>
              {canManageProjects ? (
                <select
                  value={selectedProject.client_id || ''}
                  onChange={(e) => updateProjectField('client_id', e.target.value)}
                  className={`px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                  data-testid="project-edit-client-select"
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.client_id} value={c.client_id}>
                      {c.display_name}{c.company_name ? ` — ${c.company_name}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={`text-sm font-medium ${textPrimary}`}>
                  {selectedProject.client_name || (clients.find(c => c.client_id === selectedProject.client_id)?.display_name) || '—'}
                </span>
              )}
            </div>

            {/* Weblink — Website-department projects only. Read-only by
                default; Edit reveals the input + Save/Cancel, so the domain
                only changes on an explicit action. */}
            {(selectedProject.departments || []).includes('website') && (
              <div className="flex items-center gap-2 flex-wrap pt-1" data-testid="project-weblink-row">
                <Globe className={`h-4 w-4 ${textSecondary}`} />
                <span className={`text-sm ${textSecondary}`}>Weblink:</span>
                {editingWeblink ? (
                  <>
                    <input
                      type="text"
                      value={weblinkDraft}
                      onChange={(e) => setWeblinkDraft(e.target.value)}
                      placeholder="https://example.com"
                      autoFocus
                      className={`px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm flex-1 min-w-[220px]`}
                      data-testid="project-edit-website-link"
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        await updateProjectField('website_link', normalizeUrl(weblinkDraft));
                        setEditingWeblink(false);
                      }}
                      className="h-7 px-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                      data-testid="project-weblink-save"
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingWeblink(false)} className="h-7 px-2">
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    {selectedProject.website_link ? (
                      <a
                        href={normalizeUrl(selectedProject.website_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#6366f1] hover:underline"
                      >
                        {selectedProject.website_link}
                      </a>
                    ) : (
                      <span className={`text-sm ${textSecondary}`}>—</span>
                    )}
                    {canManageProjects && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setWeblinkDraft(selectedProject.website_link || ''); setEditingWeblink(true); }}
                        className="h-7 px-2"
                        data-testid="project-weblink-edit-btn"
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Handover — universal, shows once a request has been made.
                Pending: who requested + for what date, awaiting the Super
                Admin's OTP. Completed: the final handover date + remarks. */}
            {selectedProject.handover && (
              <div className="flex items-center gap-2 flex-wrap pt-1" data-testid="project-handover-row">
                <KeyRound className={`h-4 w-4 ${textSecondary}`} />
                <span className={`text-sm ${textSecondary}`}>Handover:</span>
                {selectedProject.handover.status === 'completed' ? (
                  <>
                    <Badge className="bg-[#10b981]/20 text-[#10b981]">Handed Over</Badge>
                    <span className={`text-sm ${textPrimary}`}>{fmtDate(selectedProject.handover.handover_date)}</span>
                    {selectedProject.handover.remarks && (
                      <span className={`text-xs ${textSecondary}`}>— {selectedProject.handover.remarks}</span>
                    )}
                  </>
                ) : selectedProject.handover.status === 'otp_requested' ? (
                  <span className="text-xs text-amber-500">
                    OTP requested by {selectedProject.handover.requested_by_name || 'Unknown'} for {fmtDate(selectedProject.handover.requested_date)} — awaiting Super Admin OTP
                  </span>
                ) : null}
              </div>
            )}

            {/* Departments — chips with inline edit */}
            <div className="flex items-start gap-2 flex-wrap pt-1" data-testid="project-departments-row">
              <span className={`text-sm ${textSecondary} pt-0.5`}>Departments:</span>
              {(selectedProject.departments || []).length === 0 ? (
                <span className={`text-sm ${textSecondary} italic`}>None linked</span>
              ) : (
                (selectedProject.departments || []).map((dKey) => {
                  const dept = deptCategories.find(d => d.dept_key === dKey);
                  return (
                    <Badge
                      key={dKey}
                      className="bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30 pointer-events-none text-xs"
                    >
                      {dept?.label || dKey}
                    </Badge>
                  );
                })
              )}
              {canManageProjects && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openDeptsModal}
                  className={`${borderColor} h-7 px-2 ml-1`}
                  data-testid="project-edit-departments-btn"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  {(selectedProject.departments || []).length === 0 ? 'Add' : 'Edit'}
                </Button>
              )}
            </div>

            {/* Proposal Link — same read-only-until-Edit pattern as Weblink above */}
            <div className="flex items-center gap-2 flex-wrap pt-1" data-testid="project-proposal-link-row">
              <Link2 className={`h-4 w-4 ${textSecondary}`} />
              <span className={`text-sm ${textSecondary}`}>Proposal Link:</span>
              {editingProposalLink ? (
                <>
                  <input
                    type="text"
                    value={proposalLinkDraft}
                    onChange={(e) => setProposalLinkDraft(e.target.value)}
                    placeholder="https://..."
                    autoFocus
                    className={`px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm flex-1 min-w-[220px]`}
                    data-testid="project-edit-proposal-link"
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      await updateProjectField('proposal_link', normalizeUrl(proposalLinkDraft));
                      setEditingProposalLink(false);
                    }}
                    className="h-7 px-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                    data-testid="project-proposal-link-save"
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingProposalLink(false)} className="h-7 px-2">
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  {selectedProject.proposal_link ? (
                    <a
                      href={normalizeUrl(selectedProject.proposal_link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#6366f1] hover:underline"
                    >
                      {selectedProject.proposal_link}
                    </a>
                  ) : (
                    <span className={`text-sm ${textSecondary}`}>—</span>
                  )}
                  {canManageProjects && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setProposalLinkDraft(selectedProject.proposal_link || ''); setEditingProposalLink(true); }}
                      className="h-7 px-2"
                      data-testid="project-proposal-link-edit-btn"
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Summary cards — counts AND worked hours respect the task Date +
                Team Member filters below. Total tasks, Completed, Pending and
                an aggregated Hours Worked across every assignee on the visible
                tasks (e.g. P1 35min + P2 60min → 1h 35m). */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {(() => {
                const totalCount = filteredTasks.length;
                const doneCount = filteredTasks.filter(t => t.status === 'completed').length;
                const pendingCount = filteredTasks.filter(t => {
                  const s = (t.status || 'pending').toLowerCase();
                  return s === 'pending' || s === 'in_progress';
                }).length;
                const totalSec = filteredTasks.reduce(
                  (acc, t) => acc + Number(t?.time_tracking?.total_seconds || 0),
                  0,
                );
                const hh = Math.floor(totalSec / 3600);
                const mm = Math.floor((totalSec % 3600) / 60);
                const hoursLabel = `${hh}h ${mm}m`;
                const cards = [
                  { label: 'Total Tasks', value: totalCount, color: 'text-[#71717a]', accent: 'bg-[#71717a]/15', testid: 'project-summary-total' },
                  { label: 'Completed', value: doneCount, color: 'text-[#10b981]', accent: 'bg-[#10b981]/15', testid: 'project-summary-completed' },
                  { label: 'Pending', value: pendingCount, color: 'text-[#3b82f6]', accent: 'bg-[#3b82f6]/15', testid: 'project-summary-pending' },
                  { label: 'Hours Worked', value: hoursLabel, color: 'text-[#6366f1]', accent: 'bg-[#6366f1]/15', testid: 'project-summary-hours' },
                ];
                return cards.map(c => (
                  <div
                    key={c.label}
                    className={`rounded-lg border ${borderColor} ${bgSecondary} p-3 flex items-center justify-between`}
                    data-testid={c.testid}
                  >
                    <div>
                      <p className={`text-xs ${textSecondary}`}>{c.label}</p>
                      <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                    </div>
                    <div className={`w-8 h-8 rounded-full ${c.accent} flex items-center justify-center`}>
                      <ListChecks className={`h-4 w-4 ${c.color}`} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Inner tabs: Tasks · Payment Schedule */}
        {(() => {
          const role = (currentUser?.role || '').toLowerCase();
          const isPriv = role === 'super_admin' || role === 'admin';
          const psVisibility = currentUser?.designation_config?.operations_payment_schedule || 'visible';
          const showPaymentSchedule = isPriv || psVisibility !== 'hidden';
          // Users tab only renders for ERP-department projects
          const isErpProject = (selectedProject?.departments || []).includes('erp');
          // Pages tab only renders for Website-department projects
          const isWebsiteProject = (selectedProject?.departments || []).includes('website');
          // Scopes/Reports/Additional tabs only render for Meta Ads-department projects
          const isMetaAdsProject = (selectedProject?.departments || []).includes('meta');
          // Content Calendar tab only renders for Social Media-department projects
          const isSocialMediaProject = (selectedProject?.departments || []).includes('social_media');
          // Scope tab only renders for SEO-department projects
          const isSeoProject = (selectedProject?.departments || []).includes('seo');
          const innerTabs = [
            // Tasks leads every project type — the department-specific tabs
            // (ERP Users/Departments/Others, Website Pages/Others) follow it.
            { id: 'tasks', label: 'Tasks', icon: ListChecks },
            ...(isErpProject ? [{ id: 'erp_users', label: 'Users', icon: Users }] : []),
            ...(isErpProject ? [{ id: 'erp_departments', label: 'Departments', icon: Building2 }] : []),
            ...(isErpProject ? [{ id: 'erp_workflow', label: 'Workflow', icon: Workflow }] : []),
            ...(isErpProject ? [{ id: 'erp_others', label: 'Others', icon: FolderOpen }] : []),
            ...(isWebsiteProject ? [{ id: 'pages', label: 'Pages', icon: Globe }] : []),
            ...(isWebsiteProject ? [{ id: 'others', label: 'Others', icon: FolderOpen }] : []),
            // Daily Notes — universal, every project regardless of department.
            { id: 'daily_notes', label: 'Daily Notes', icon: NotebookPen },
            ...(showPaymentSchedule ? [{ id: 'payment', label: 'Payment Schedule', icon: Wallet }] : []),
            ...(showPaymentSchedule ? [{ id: 'expense', label: 'Expense', icon: TrendingDown }] : []),
            ...(isSocialMediaProject ? [{ id: 'content_calendar', label: 'Content Calendar', icon: Calendar }] : []),
            ...(isSeoProject ? [{ id: 'seo_scope', label: 'Scope', icon: Target }] : []),
            ...(isSeoProject ? [{ id: 'backlinks', label: 'Backlinks', icon: Link2 }] : []),
            ...(isMetaAdsProject ? [{ id: 'scopes', label: 'Scopes', icon: Target }] : []),
            ...(isMetaAdsProject || isSeoProject ? [{ id: 'campaigns', label: 'Campaigns', icon: Megaphone }] : []),
            ...(isMetaAdsProject || isSeoProject ? [{ id: 'reports', label: 'Reports', icon: BarChart3 }] : []),
            ...(isMetaAdsProject ? [{ id: 'additional', label: 'Additional', icon: Layers }] : []),
            // Delivery Date History — universal, every project regardless of department.
            { id: 'delivery_history', label: 'Delivery History', icon: History },
          ];
          // If user was on Payment but it's now hidden, switch them to Tasks
          if (!showPaymentSchedule && projectInnerTab === 'payment') {
            setTimeout(() => setProjectInnerTab('tasks'), 0);
          }
          return (
            <div className="flex gap-2 flex-wrap" data-testid="project-inner-tabs">
              {innerTabs.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setProjectInnerTab(t.id)}
                    data-testid={`project-inner-tab-${t.id}`}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition border ${
                      projectInnerTab === t.id
                        ? 'bg-[#6366f1] border-[#6366f1] text-white'
                        : isDark
                          ? 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] hover:bg-[#3f3f46]'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          );
        })()}

        {projectInnerTab === 'payment' && (() => {
          // Defensive re-check: never render Payment Schedule when hidden by designation
          const role = (currentUser?.role || '').toLowerCase();
          const isPriv = role === 'super_admin' || role === 'admin';
          const psVisibility = currentUser?.designation_config?.operations_payment_schedule || 'visible';
          if (!isPriv && psVisibility === 'hidden') return null;
          return (
            <PaymentScheduleTab
              project={selectedProject}
              onProjectUpdated={(p) => { setSelectedProject(p); loadProjects(); }}
              isSuperAdmin={(currentUser?.role || '').toLowerCase() === 'super_admin'}
              isDark={isDark}
              bgCard={bgCard}
              bgSecondary={bgSecondary}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
            />
          );
        })()}

        {projectInnerTab === 'expense' && (() => {
          // Mirror Payment Schedule's visibility gate — Expense is the sibling tab.
          const role = (currentUser?.role || '').toLowerCase();
          const isPriv = role === 'super_admin' || role === 'admin';
          const psVisibility = currentUser?.designation_config?.operations_payment_schedule || 'visible';
          if (!isPriv && psVisibility === 'hidden') return null;
          return (
            <ProjectExpenseTab
              project={selectedProject}
              onProjectUpdated={(p) => { setSelectedProject(p); loadProjects(); }}
              isSuperAdmin={(currentUser?.role || '').toLowerCase() === 'super_admin'}
              isDark={isDark}
              bgCard={bgCard}
              bgSecondary={bgSecondary}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
            />
          );
        })()}

        {projectInnerTab === 'content_calendar' && (
          <ProjectContentCalendarTab
            project={selectedProject}
            onProjectUpdated={(p) => { setSelectedProject(p); loadProjects(); }}
            onTaskCreated={onTaskCreated}
            canEdit={canManageContentCalendar}
            users={users}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'pages' && (
          <ProjectPagesTab
            project={selectedProject}
            onProjectUpdated={(p) => { setSelectedProject(p); loadProjects(); }}
            canEdit={canManageProjects}
            users={users}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'others' && (
          <ProjectOthersTab
            project={selectedProject}
            users={users}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'erp_users' && (
          <ProjectErpUsersTab
            project={selectedProject}
            onProjectUpdated={(p) => { setSelectedProject(p); loadProjects(); }}
            onTasksChanged={() => { refreshSelectedProject(); loadProjects(); }}
            canEdit={canManageProjects}
            currentUser={currentUser}
            users={users}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'erp_departments' && (
          <ProjectErpDepartmentsTab
            project={selectedProject}
            onProjectUpdated={(p) => { setSelectedProject(p); loadProjects(); }}
            canEdit={canManageProjects}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
            users={users}
          />
        )}

        {projectInnerTab === 'erp_workflow' && (
          <ProjectErpWorkflowTab
            project={selectedProject}
            onProjectUpdated={(p) => { setSelectedProject(p); loadProjects(); }}
            canEdit={canManageProjects}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
            projectMembers={projectMembers}
          />
        )}

        {projectInnerTab === 'erp_others' && (
          <ProjectErpOthersTab
            project={selectedProject}
            users={users}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'seo_scope' && (
          <ProjectSeoScopeTab
            tasks={selectedProject.tasks || []}
            categories={deptCategories.find(d => d.dept_key === 'seo')?.categories || []}
            users={users}
            canManageProjects={canManageProjects}
            onAddTask={openAddTaskForSeoScope}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'backlinks' && (
          <ProjectBacklinksTab
            project={selectedProject}
            onProjectUpdated={(p) => { setSelectedProject(p); loadProjects(); }}
            onTaskCreated={onTaskCreated}
            canEdit={canManageProjects}
            users={users}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'scopes' && (
          <ProjectScopesTab
            project={selectedProject}
            tasks={selectedProject.tasks || []}
            users={users}
            canManageProjects={canManageProjects}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onTasksChanged={() => { refreshSelectedProject(); loadProjects(); }}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'campaigns' && (
          <ProjectCampaignsTab
            project={selectedProject}
            onProjectUpdated={(p) => { setSelectedProject(p); loadProjects(); }}
            canEdit={canManageProjects}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'reports' && (
          <ProjectMetaReportsTab
            project={selectedProject}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'additional' && (
          <div className={`${bgCard} border ${borderColor} rounded-2xl p-12 text-center`} data-testid="additional-tab">
            <p className={textSecondary}>Nothing here yet.</p>
          </div>
        )}

        {projectInnerTab === 'daily_notes' && (
          <ProjectDailyNotesTab
            project={selectedProject}
            users={users}
            currentUser={currentUser}
            canEdit={canManageProjects}
            departmentOptions={DEPARTMENTS.filter(d => (selectedProject.departments || []).includes(d.value))}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'delivery_history' && (
          <ProjectDeliveryHistoryTab
            project={selectedProject}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {projectInnerTab === 'tasks' && (
        <div className="space-y-2">
          <h3 className={`text-base font-semibold ${textPrimary}`}>Tasks</h3>

          {/* Sticky on scroll — stays pinned below the tab row while only the
              task list beneath it scrolls. Needs its own opaque background
              (matching the page, not the card) so scrolled-under task cards
              don't show through. */}
          <div className={`sticky top-0 z-20 pb-2 ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>
          {/* Status summary cards — each a toggle filter, computed without its
              own filter dimension (so every bucket stays visible to jump
              between) but with the Team Member + Date filters below applied. */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-2" data-testid="project-task-summary-cards">
            {taskSummaryCard('All', allTasksCount, ListChecks, 'text-[#6366f1]', taskStatusFilter === 'all', () => setTaskStatusFilter('all'))}
            {taskSummaryCard('Todo', todoTasksCount, ListTodo, 'text-amber-400', taskStatusFilter === 'todo', () => setTaskStatusFilter(taskStatusFilter === 'todo' ? 'all' : 'todo'))}
            {taskSummaryCard('Progress', progressTasksCount, Clock, 'text-yellow-400', taskStatusFilter === 'progress', () => setTaskStatusFilter(taskStatusFilter === 'progress' ? 'all' : 'progress'))}
            {taskSummaryCard('Approval', approvalTasksCount, ShieldQuestion, 'text-orange-400', taskStatusFilter === 'approval', () => setTaskStatusFilter(taskStatusFilter === 'approval' ? 'all' : 'approval'))}
            {taskSummaryCard('Completed', completedTasksCount, CheckCircle2, 'text-emerald-400', taskStatusFilter === 'completed', () => setTaskStatusFilter(taskStatusFilter === 'completed' ? 'all' : 'completed'))}
          </div>

          {/* Task filters: Team Member + Date */}
          <div className="flex flex-wrap items-center gap-2 mb-2" data-testid="project-task-filters">
            <select
              value={taskMemberFilter}
              onChange={(e) => setTaskMemberFilter(e.target.value)}
              className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
              data-testid="project-filter-member"
            >
              <option value="all">All Team Members</option>
              {projectMembers.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.name}</option>
              ))}
            </select>

            <select
              value={taskDateFilter}
              onChange={(e) => setTaskDateFilter(e.target.value)}
              className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
              data-testid="project-filter-date"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="yesterday">Yesterday</option>
              <option value="single">Single Date</option>
              <option value="range">Date Range</option>
            </select>

            {hasErpDept && (
              <SearchableSelect
                value={taskWorkflowFilter}
                onChange={setTaskWorkflowFilter}
                options={[{ value: 'all', label: 'All Workflows' }, ...workflowOptionsSorted.map(w => ({ value: w.id, label: `${w.name} (${w._todoCount})` }))]}
                searchPlaceholder="Search workflows..."
                className={`h-9 flex-1 min-w-[220px] max-w-[480px] px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm ml-auto`}
                data-testid="project-filter-erp-workflow"
              />
            )}

            {taskDateFilter === 'single' && (
              <Input
                type="date"
                value={taskSingleDate}
                onChange={(e) => setTaskSingleDate(e.target.value)}
                className={`h-9 w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="project-filter-single-date"
              />
            )}
            {taskDateFilter === 'range' && (
              <>
                <Input
                  type="date"
                  value={taskDateFrom}
                  onChange={(e) => setTaskDateFrom(e.target.value)}
                  className={`h-9 w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="project-filter-date-from"
                />
                <Input
                  type="date"
                  value={taskDateTo}
                  onChange={(e) => setTaskDateTo(e.target.value)}
                  className={`h-9 w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="project-filter-date-to"
                />
              </>
            )}

            {(taskMemberFilter !== 'all' || taskDateFilter !== 'all' || taskStatusFilter !== 'all' || erpFiltersActive) && (
              <button
                onClick={() => {
                  setTaskMemberFilter('all');
                  setTaskDateFilter('all');
                  setTaskSingleDate('');
                  setTaskDateFrom('');
                  setTaskDateTo('');
                  setTaskStatusFilter('all');
                  resetErpTaskFilters();
                }}
                className={`text-xs ${textSecondary} hover:underline`}
                data-testid="project-filter-reset"
              >
                Reset
              </button>
            )}
          </div>

          {/* ERP hierarchy + Task Type filters — only when the project has
              an `erp` department to tag tasks against. */}
          {hasErpDept && (
            <div className="flex flex-wrap items-center gap-2 mb-2" data-testid="project-task-erp-filters">
              <select
                value={taskErpTypeFilter}
                onChange={(e) => setTaskErpTypeFilter(e.target.value)}
                className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                data-testid="project-filter-erp-task-type"
              >
                <option value="all">All Task Types</option>
                {ERP_TASK_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Select
                value={taskErpDeptFilter}
                onValueChange={(v) => {
                  setTaskErpDeptFilter(v);
                  setTaskErpUserFilter('all'); setTaskErpPageFilter('all');
                  setTaskErpSubTabFilter('all'); setTaskErpUltraSubTabFilter('all'); setTaskErpUltraTabFilter('all');
                }}
              >
                <SelectTrigger className={`h-9 w-[170px] ${bgSecondary} border ${borderColor} ${textPrimary} text-sm`} data-testid="project-filter-erp-department">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent className={bgCard}>
                  <SelectItem value="all">All Departments</SelectItem>
                  {(selectedProject.erp_departments || []).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name} ({erpDeptTodoCount(d.id)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={taskErpUserFilter}
                onValueChange={(v) => {
                  setTaskErpUserFilter(v);
                  setTaskErpPageFilter('all'); setTaskErpSubTabFilter('all'); setTaskErpUltraSubTabFilter('all'); setTaskErpUltraTabFilter('all');
                }}
              >
                <SelectTrigger className={`h-9 w-[170px] ${bgSecondary} border ${borderColor} ${textPrimary} text-sm`} data-testid="project-filter-erp-user">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent className={bgCard}>
                  <SelectItem value="all">All Users</SelectItem>
                  {erpFilterVisibleUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.user_name} ({erpOptionTodoCount({ erp_user_id: u.id })})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={taskErpPageFilter}
                onValueChange={(v) => {
                  setTaskErpPageFilter(v);
                  setTaskErpSubTabFilter('all'); setTaskErpUltraSubTabFilter('all'); setTaskErpUltraTabFilter('all');
                }}
                disabled={erpFilterPages.length === 0}
              >
                <SelectTrigger className={`h-9 w-[170px] ${bgSecondary} border ${borderColor} ${textPrimary} text-sm disabled:opacity-50`} data-testid="project-filter-erp-page">
                  <SelectValue placeholder="All Pages" />
                </SelectTrigger>
                <SelectContent className={bgCard}>
                  <SelectItem value="all">All Pages</SelectItem>
                  {erpFilterPages.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.page_name} ({erpOptionTodoCount({ erp_user_id: taskErpUserFilter, erp_page_id: p.id })})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={taskErpSubTabFilter}
                onValueChange={(v) => {
                  setTaskErpSubTabFilter(v);
                  setTaskErpUltraSubTabFilter('all'); setTaskErpUltraTabFilter('all');
                }}
                disabled={erpFilterSubTabs.length === 0}
              >
                <SelectTrigger className={`h-9 w-[170px] ${bgSecondary} border ${borderColor} ${textPrimary} text-sm disabled:opacity-50`} data-testid="project-filter-erp-subtab">
                  <SelectValue placeholder="All Sub Tabs" />
                </SelectTrigger>
                <SelectContent className={bgCard}>
                  <SelectItem value="all">All Sub Tabs</SelectItem>
                  {erpFilterSubTabs.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({erpOptionTodoCount({ erp_user_id: taskErpUserFilter, erp_page_id: taskErpPageFilter, erp_sub_tab_id: s.id })})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={taskErpUltraSubTabFilter}
                onValueChange={(v) => {
                  setTaskErpUltraSubTabFilter(v);
                  setTaskErpUltraTabFilter('all');
                }}
                disabled={erpFilterUltraSubTabs.length === 0}
              >
                <SelectTrigger className={`h-9 w-[170px] ${bgSecondary} border ${borderColor} ${textPrimary} text-sm disabled:opacity-50`} data-testid="project-filter-erp-ultra-subtab">
                  <SelectValue placeholder="All Ultra Sub Tab" />
                </SelectTrigger>
                <SelectContent className={bgCard}>
                  <SelectItem value="all">All Ultra Sub Tab</SelectItem>
                  {erpFilterUltraSubTabs.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({erpOptionTodoCount({ erp_user_id: taskErpUserFilter, erp_page_id: taskErpPageFilter, erp_sub_tab_id: taskErpSubTabFilter, erp_ultra_sub_tab_id: u.id })})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={taskErpUltraTabFilter} onValueChange={setTaskErpUltraTabFilter} disabled={erpFilterUltraTabs.length === 0}>
                <SelectTrigger className={`h-9 w-[170px] ${bgSecondary} border ${borderColor} ${textPrimary} text-sm disabled:opacity-50`} data-testid="project-filter-erp-ultra-tab">
                  <SelectValue placeholder="All Ultra Tab" />
                </SelectTrigger>
                <SelectContent className={bgCard}>
                  <SelectItem value="all">All Ultra Tab</SelectItem>
                  {erpFilterUltraTabs.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({erpOptionTodoCount({ erp_user_id: taskErpUserFilter, erp_page_id: taskErpPageFilter, erp_sub_tab_id: taskErpSubTabFilter, erp_ultra_sub_tab_id: taskErpUltraSubTabFilter, erp_ultra_tab_id: u.id })})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          </div>

          {filteredTasks.length === 0 ? (
            <p className={`text-sm ${textSecondary}`}>
              {projectTasks.length === 0 ? 'No tasks yet. Click "Add Task" to create one.' : 'No tasks match the current filters.'}
            </p>
          ) : (
            // High first, then Medium, then Low — a stable sort so tasks
            // sharing a priority keep their existing relative order.
            [...filteredTasks].sort((a, b) => {
              const rank = { high: 0, medium: 1, low: 2 };
              return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
            }).map(task => {
              const user = users.find(u => u.user_id === task.assigned_to);
              const erpBreadcrumb = [task.erp_user_name, task.erp_page_name, task.erp_sub_tab_name, task.erp_ultra_sub_tab_name, task.erp_ultra_tab_name].filter(Boolean).join(' > ');
              const priorityColor = task.priority === 'high' ? '#ef4444' : task.priority === 'low' ? '#10b981' : '#f59e0b';
              return (
                <Card
                  key={task.task_id}
                  className={`${bgCard} border ${borderColor}`}
                  style={{ borderRightWidth: '4px', borderRightColor: priorityColor }}
                  data-testid={`project-task-${task.task_id}`}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${textPrimary}`}>{task.task_name}</span>
                        <Badge className={
                          isTaskCompleted(task) ? 'bg-[#10b981]/20 text-[#10b981]' :
                          task.status === 'in_progress' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' :
                          'bg-[#71717a]/20 text-[#71717a]'
                        }>
                          {/* An approved-but-not-flipped task shows Completed here too —
                              otherwise the badge contradicts the bucket it's counted under. */}
                          {isTaskCompleted(task) ? 'completed' : (task.status?.replace('_', ' ') || 'pending')}
                        </Badge>
                        <Badge className={
                          task.priority === 'high' ? 'bg-[#ef4444]/20 text-[#ef4444] text-xs' :
                          task.priority === 'low' ? 'bg-[#10b981]/20 text-[#10b981] text-xs' :
                          'bg-[#f59e0b]/20 text-[#f59e0b] text-xs'
                        }>{task.priority || 'medium'}</Badge>
                        {task.category && (
                          <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs">{task.category}</Badge>
                        )}
                        {task.erp_task_type && (
                          <Badge className="bg-violet-500/20 text-violet-400 text-xs">{task.erp_task_type}</Badge>
                        )}
                        {task.workflow_id && task.workflow_name && (
                          <Badge className="bg-[#ec4899]/20 text-[#ec4899] text-xs font-medium" data-testid={`task-workflow-badge-${task.task_id}`}>
                            {task.workflow_name}
                          </Badge>
                        )}
                        {task.created_via === 'client_portal' && (
                          <Badge
                            className="bg-[#14b8a6]/20 text-[#14b8a6] text-xs font-medium"
                            title="Reported by the client through the Client Portal"
                            data-testid={`task-client-portal-badge-${task.task_id}`}
                          >
                            Client Portal
                          </Badge>
                        )}
                      </div>
                      <p className={`text-xs ${textSecondary} mt-1`}>
                        Assigned to <span className={textPrimary}>{user?.name || task.assigned_to}</span>
                        {task.due_date && <> · Due {fmtDate(task.due_date)}</>}
                      </p>
                      {erpBreadcrumb && (
                        <p className={`text-xs ${textSecondary} mt-1 flex items-center gap-1`}>
                          <Users className="h-3 w-3" /> {erpBreadcrumb}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {task.work_link && (
                        <a href={task.work_link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] text-sm hover:underline flex items-center gap-1 px-2" data-testid={`project-task-link-${task.task_id}`}>
                          <ExternalLink className="h-3 w-3" /> Link
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewOnlyTask(task)}
                        className={`h-8 w-8 p-0 ${textSecondary} hover:bg-[#6366f1]/10`}
                        data-testid={`project-task-view-${task.task_id}`}
                        title="View task"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManageProjects && canEditProjectTask(task) && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditTask(task)}
                            className="h-8 w-8 p-0 text-[#3b82f6] hover:bg-[#3b82f6]/10"
                            data-testid={`project-task-edit-${task.task_id}`}
                            title="Edit task"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTask(task.task_id)}
                            className="h-8 w-8 p-0 text-[#ef4444] hover:bg-[#ef4444]/10"
                            data-testid={`project-task-delete-${task.task_id}`}
                            title="Delete task"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
        )}

        {/* Team Management Modal */}
        {showTeamModal && (
          <div
            className="fixed inset-0 bg-black/60 overflow-y-auto z-[70]"
            onClick={() => setShowTeamModal(false)}
            data-testid="project-team-modal"
          >
          <div className="min-h-full flex items-center justify-center py-8">
            <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4`} onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>Manage Team</h3>
                    <p className={`text-xs ${textSecondary}`}>Add or remove members from {selectedProject.name}</p>
                  </div>
                  <button onClick={() => setShowTeamModal(false)} className={textSecondary}><X className="h-5 w-5" /></button>
                </div>
                <div className={`max-h-72 overflow-y-auto border ${borderColor} rounded-lg p-2 space-y-1`}>
                  {users.length === 0 ? (
                    <p className={`text-sm ${textSecondary} p-2`}>No users available.</p>
                  ) : users.map(u => {
                    const checked = teamDraft.includes(u.user_id);
                    return (
                      <label
                        key={u.user_id}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-[#6366f1]/10`}
                        data-testid={`project-team-member-${u.user_id}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setTeamDraft(prev =>
                            checked ? prev.filter(x => x !== u.user_id) : [...prev, u.user_id]
                          )}
                          className="h-4 w-4 accent-[#6366f1]"
                        />
                        <span className={`text-sm ${textPrimary} flex-1`}>{u.name}</span>
                        <span className={`text-xs ${textSecondary}`}>{u.email}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className={`text-xs ${textSecondary}`}>{teamDraft.length} member{teamDraft.length !== 1 ? 's' : ''} selected</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setShowTeamModal(false)}>Cancel</Button>
                    <Button
                      onClick={handleSaveTeam}
                      disabled={teamSaving}
                      className="bg-[#10b981] hover:bg-[#059669] text-white"
                      data-testid="project-team-save"
                    >
                      <Check className="h-3 w-3 mr-1" /> {teamSaving ? 'Saving…' : 'Save Team'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          </div>
        )}

        {/* Documents Modal — Sheets / Docs / Drive */}
        {showDocsModal && (() => {
          const allDocs = selectedProject?.documents || [];
          const tabsConfig = [
            { id: 'sheets', label: 'Sheets', icon: FileSpreadsheet, color: 'text-[#10b981]' },
            { id: 'docs', label: 'Docs', icon: FileText, color: 'text-[#3b82f6]' },
            { id: 'drive', label: 'Drive', icon: FolderOpen, color: 'text-[#f59e0b]' },
          ];
          const docsForTab = allDocs.filter(d => (d.kind || 'sheets') === docsTab);
          const tabPlural = { sheets: 'Sheets', docs: 'Docs', drive: 'Files' }[docsTab];

          return (
            <div
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4"
              onClick={() => { setShowDocsModal(false); setEditingDocId(null); setDocDraft({ name: '', link: '' }); }}
              data-testid="project-docs-modal"
            >
              <Card className={`${bgCard} border ${borderColor} w-full max-w-3xl`} onClick={(e) => e.stopPropagation()}>
                <CardContent className="p-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {tabsConfig.map(t => {
                          const c = allDocs.filter(d => (d.kind || 'sheets') === t.id).length;
                          const isActive = docsTab === t.id;
                          return (
                            <span
                              key={t.id}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                                isActive ? 'bg-[#6366f1]/15 text-[#6366f1]' : `${bgSecondary} ${textSecondary}`
                              }`}
                            >
                              {c} {t.label}
                            </span>
                          );
                        })}
                      </div>
                      <h3 className={`text-lg font-semibold ${textPrimary}`}>Project Documents</h3>
                      <p className={`text-xs ${textSecondary}`}>Attach Google Sheets / Docs / Drive links for {selectedProject.name}</p>
                    </div>
                    <button
                      onClick={() => { setShowDocsModal(false); setEditingDocId(null); setDocDraft({ name: '', link: '' }); }}
                      className={textSecondary}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 border-b border-transparent">
                    {tabsConfig.map(t => {
                      const Icon = t.icon;
                      const isActive = docsTab === t.id;
                      const c = allDocs.filter(d => (d.kind || 'sheets') === t.id).length;
                      return (
                        <button
                          key={t.id}
                          onClick={() => { setDocsTab(t.id); setEditingDocId(null); setDocDraft({ name: '', link: '' }); }}
                          data-testid={`docs-tab-${t.id}`}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                            isActive
                              ? `bg-[#6366f1] text-white`
                              : `${bgSecondary} ${textSecondary} hover:bg-[#6366f1]/10`
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${isActive ? 'text-white' : t.color}`} />
                          {t.label} ({c})
                        </button>
                      );
                    })}
                  </div>

                  {/* Add / Edit row */}
                  <div className={`p-3 rounded-lg border ${borderColor} ${bgSecondary}`}>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
                      <Input
                        value={docDraft.name}
                        onChange={(e) => setDocDraft(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={`${tabPlural.slice(0, -1)} name`}
                        className={`${bgCard} ${textPrimary}`}
                        data-testid="doc-input-name"
                      />
                      <Input
                        value={docDraft.link}
                        onChange={(e) => setDocDraft(prev => ({ ...prev, link: e.target.value }))}
                        placeholder="https://..."
                        className={`${bgCard} ${textPrimary}`}
                        data-testid="doc-input-link"
                      />
                      <div className="flex gap-2">
                        {editingDocId && (
                          <Button
                            variant="ghost"
                            onClick={() => { setEditingDocId(null); setDocDraft({ name: '', link: '' }); }}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          onClick={handleSaveDoc}
                          className="bg-[#10b981] hover:bg-[#059669] text-white"
                          data-testid="doc-save-btn"
                        >
                          {editingDocId ? 'Update' : 'Add'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* List table */}
                  <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
                    <div className={`grid grid-cols-[60px_1fr_2fr_180px_120px] gap-3 px-4 py-2 text-xs font-medium uppercase ${bgSecondary} ${textSecondary}`}>
                      <div>S.No</div>
                      <div>{tabPlural.slice(0, -1)} Name</div>
                      <div>Link</div>
                      <div>Added By</div>
                      <div className="text-right">Actions</div>
                    </div>
                    {docsForTab.length === 0 ? (
                      <div className={`px-4 py-10 text-center text-sm ${textSecondary}`}>
                        No {tabPlural.toLowerCase()} added yet
                      </div>
                    ) : docsForTab.map((d, idx) => (
                      <div
                        key={d.doc_id}
                        className={`grid grid-cols-[60px_1fr_2fr_180px_120px] gap-3 px-4 py-3 items-center border-t ${borderColor}`}
                        data-testid={`doc-row-${d.doc_id}`}
                      >
                        <div className={`text-sm ${textSecondary}`}>{idx + 1}</div>
                        <div className={`text-sm font-medium ${textPrimary} truncate`}>{d.name}</div>
                        <a
                          href={d.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#6366f1] hover:underline truncate flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3 flex-none" /> {d.link}
                        </a>
                        <div className={`text-xs ${textSecondary} truncate`}>{d.added_by_name || '—'}</div>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEditDoc(d)}
                            className={`p-1.5 rounded hover:bg-[#6366f1]/10 ${textSecondary}`}
                            data-testid={`doc-edit-${d.doc_id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(d.doc_id)}
                            className="p-1.5 rounded hover:bg-[#ef4444]/10 text-[#ef4444]"
                            data-testid={`doc-delete-${d.doc_id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {/* Schedule Meeting Modal */}
        <MeetingModal
          open={showMeetingModal}
          onClose={() => setShowMeetingModal(false)}
          onCreated={() => { /* meetings re-fetched by effect */ }}
          projectId={selectedProject.project_id}
          allowCategoryToggle
          users={users}
          headers={headers}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          borderColor={borderColor}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />

        {/* Departments edit modal */}
        {showDeptsModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setShowDeptsModal(false)}>
            <Card className={`${bgCard} border ${borderColor} w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>Link Departments — {selectedProject.name}</h3>
                  <button onClick={() => setShowDeptsModal(false)} className={textSecondary} data-testid="project-depts-close">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className={`text-xs ${textSecondary}`}>
                  Pick the departments this project belongs to. Tasks created against this project will only show categories from the picked departments.
                </p>
                {deptCategories.length === 0 ? (
                  <p className={`text-sm ${textSecondary}`}>No departments configured yet. Create them in Settings.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {deptCategories.map((d) => {
                      const checked = deptsDraft.includes(d.dept_key);
                      return (
                        <label
                          key={d.dept_key}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                            checked
                              ? 'bg-[#6366f1]/10 border-[#6366f1]'
                              : `${bgSecondary} ${borderColor} hover:bg-[#3f3f46]/30`
                          }`}
                          data-testid={`project-depts-option-${d.dept_key}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setDeptsDraft((prev) => e.target.checked
                                ? [...prev, d.dept_key]
                                : prev.filter(k => k !== d.dept_key));
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-[#6366f1] focus:ring-[#6366f1]"
                          />
                          <span className={`text-sm ${textPrimary}`}>{d.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2 pt-2 border-t border-[#27272a]">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeptsModal(false)}
                    className={`flex-1 ${borderColor}`}
                    disabled={deptsSaving}
                    data-testid="project-depts-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveDepartments}
                    disabled={deptsSaving}
                    className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white disabled:opacity-50"
                    data-testid="project-depts-save"
                  >
                    {deptsSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Meetings list popup (status-aware: upcoming / completed) */}
        {showMeetingsList && (() => {
          const today = new Date().toISOString().slice(0, 10);
          const isCompleted = (m) => (m.status || '').toLowerCase() === 'completed';
          // Upcoming bucket = anything not yet completed (incl. overdue). Completed = explicit status.
          const upcoming = projectMeetings.filter((m) => !isCompleted(m)).sort((a, b) => `${a.date}${a.start_time || ''}`.localeCompare(`${b.date}${b.start_time || ''}`));
          const completed = projectMeetings.filter(isCompleted).sort((a, b) => `${b.date}${b.start_time || ''}`.localeCompare(`${a.date}${a.start_time || ''}`));
          const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—';
          const MList = ({ list, label, emptyHint }) => (
            <div>
              <p className={`text-xs uppercase font-semibold ${textSecondary} mb-2`}>{label} ({list.length})</p>
              {list.length === 0 ? (
                <p className={`text-sm ${textSecondary} mb-3`}>{emptyHint}</p>
              ) : list.map(m => {
                const completed = isCompleted(m);
                const overdue = !completed && (m.date || '') < today;
                return (
                  <div
                    key={m.meeting_id}
                    className={`p-3 rounded-lg border ${borderColor} ${bgSecondary} mb-2 flex items-center justify-between gap-3`}
                    data-testid={`proj-mtg-${m.meeting_id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${textPrimary} truncate`}>{m.title}</span>
                        <Badge className={
                          (m.category || 'team') === 'client'
                            ? 'bg-[#f59e0b]/20 text-[#f59e0b] text-xs pointer-events-none'
                            : 'bg-[#3b82f6]/20 text-[#3b82f6] text-xs pointer-events-none'
                        }>{(m.category || 'team') === 'client' ? 'Client' : 'Team'}</Badge>
                        {m.linked_task_id && (
                          <Badge className="bg-indigo-500/20 text-indigo-400 text-[10px] pointer-events-none">via Task</Badge>
                        )}
                        <Badge className={`text-[10px] pointer-events-none ${
                          completed ? 'bg-emerald-500/20 text-emerald-400' :
                          overdue ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {completed ? 'Completed' : overdue ? 'Overdue' : 'Upcoming'}
                        </Badge>
                      </div>
                      <p className={`text-xs ${textSecondary} mt-1`}>{fmtDate(m.date)} · {m.start_time || '—'} · {(m.attendees || []).length} attendees</p>
                    </div>
                    {m.meeting_link && (
                      <a
                        href={m.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#6366f1] text-sm hover:underline flex items-center gap-1 flex-none"
                      >
                        <ExternalLink className="h-3 w-3" /> Join
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          );
          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setShowMeetingsList(false)}>
              <Card className={`${bgCard} border ${borderColor} w-full max-w-2xl max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>Project Meetings — {selectedProject.name}</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => { setShowMeetingsList(false); setShowMeetingModal(true); }}
                        className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                        data-testid="project-meetings-popup-schedule"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Schedule Meeting
                      </Button>
                      <button onClick={() => setShowMeetingsList(false)} className={textSecondary}><X className="h-5 w-5" /></button>
                    </div>
                  </div>
                  <p className={`text-xs ${textSecondary}`}>
                    Tip: tasks with Type = Meeting + this project are bridged here automatically.
                  </p>
                  <MList list={upcoming} label="Upcoming" emptyHint="No upcoming meetings." />
                  <MList list={completed} label="Completed" emptyHint="No completed meetings yet." />
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {/* Add / Edit Task Modal */}
        {showAddTask && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={() => { setShowAddTask(false); setEditingTaskId(null); }}>
            <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4`} onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>{editingTaskId ? 'Edit Task' : 'Add Task'} — {selectedProject.name}</h3>
                  <div className="flex items-center gap-1">
                    {editingTaskId && (
                      <Button size="sm" variant="outline" onClick={handleAddAnotherTask} data-testid="project-task-add-another">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add New Task
                      </Button>
                    )}
                    <button onClick={() => { setShowAddTask(false); setEditingTaskId(null); }} className={textSecondary}><X className="h-5 w-5" /></button>
                  </div>
                </div>
                <div><Label className={textPrimary}>Task Name *</Label><Input value={taskDraft.task_name} onChange={(e) => setTaskDraft({ ...taskDraft, task_name: e.target.value })} placeholder="Task name" data-testid="project-task-name" /></div>
                <div><Label className={textPrimary}>Description</Label><Input value={taskDraft.description} onChange={(e) => setTaskDraft({ ...taskDraft, description: e.target.value })} placeholder="Optional description" /></div>
                <div>
                  <Label className={textPrimary}>Assign To *</Label>
                  <select
                    value={taskDraft.assigned_to}
                    onChange={(e) => setTaskDraft({ ...taskDraft, assigned_to: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary}`}
                    data-testid="project-task-assignee"
                  >
                    <option value="">— Select user —</option>
                    {projectMembers.map(u => <option key={u.user_id} value={u.user_id}>{u.name}{u.email ? ` (${u.email})` : ''}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className={textPrimary}>Due Date</Label><Input type="date" value={taskDraft.due_date} onChange={(e) => setTaskDraft({ ...taskDraft, due_date: e.target.value })} /></div>
                  <div>
                    <Label className={textPrimary}>Priority</Label>
                    <select value={taskDraft.priority} onChange={(e) => setTaskDraft({ ...taskDraft, priority: e.target.value })} className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary}`}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div><Label className={textPrimary}>Work Link</Label><Input value={taskDraft.work_link} onChange={(e) => setTaskDraft({ ...taskDraft, work_link: e.target.value })} placeholder="https://..." /></div>

                {/* Department + Category — restricted to project's departments */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className={textPrimary}>Department *</Label>
                    <select
                      value={taskDraft.department}
                      onChange={(e) => {
                        const dept = e.target.value;
                        const defaultCategory = deptCategories.find(d => d.dept_key === dept)?.categories?.[0] || '';
                        setTaskDraft({ ...taskDraft, department: dept, category: defaultCategory });
                      }}
                      className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary}`}
                      data-testid="project-task-department"
                    >
                      <option value="">— Select dept —</option>
                      {(selectedProject.departments || []).map(dKey => {
                        const dept = deptCategories.find(d => d.dept_key === dKey);
                        return <option key={dKey} value={dKey}>{dept?.label || dKey}</option>;
                      })}
                      {(selectedProject.departments || []).length === 0 && deptCategories.map(d => (
                        <option key={d.dept_key} value={d.dept_key}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className={textPrimary}>
                      Category {taskDraft.department && <span className="text-red-500">*</span>}
                    </Label>
                    <select
                      value={taskDraft.category}
                      onChange={(e) => setTaskDraft({ ...taskDraft, category: e.target.value })}
                      disabled={!taskDraft.department}
                      className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} disabled:opacity-50`}
                      data-testid="project-task-category"
                    >
                      <option value="">— Select category —</option>
                      {(deptCategories.find(d => d.dept_key === taskDraft.department)?.categories || []).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* ERP tagging — only when the project has the `erp`
                    department. Cascading picker down to whichever level in
                    the project's ERP Users hierarchy this task belongs to. */}
                {(selectedProject?.departments || []).includes('erp') && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#6366f1]" />
                      <p className={`text-sm font-semibold ${textPrimary}`}>ERP Tagging</p>
                    </div>
                    <ErpLocationPicker
                      project={selectedProject}
                      value={taskDraft}
                      onChange={(next) => setTaskDraft({ ...taskDraft, ...next })}
                      bgSecondary={bgSecondary}
                      borderColor={borderColor}
                      textPrimary={textPrimary}
                      textSecondary={textSecondary}
                      testPrefix="task-erp"
                    />
                    <div>
                      <Label className={`text-xs ${textSecondary}`}>Type</Label>
                      <select
                        value={taskDraft.erp_task_type || ''}
                        onChange={(e) => setTaskDraft({ ...taskDraft, erp_task_type: e.target.value })}
                        className={`w-full h-9 px-2 rounded-md text-sm border ${borderColor} ${bgSecondary} ${textPrimary}`}
                        data-testid="task-erp-type"
                      >
                        <option value="">— select type —</option>
                        {ERP_TASK_TYPE_OPTIONS.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <p className={`text-[10px] ${textSecondary} italic`}>
                      Missing a user or page? Open the <span className="text-[#a78bfa]">Users</span> tab to add them.
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => { setShowAddTask(false); setEditingTaskId(null); }}>Cancel</Button>
                  <Button onClick={handleAddTask} className="bg-[#10b981] hover:bg-[#059669] text-white" data-testid="project-task-save">
                    <Check className="h-3 w-3 mr-1" /> {editingTaskId ? 'Update Task' : 'Add Task'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View popup — details + time-tracking timeline for everyone. Edit
            (via the button below) is limited to whoever the task is
            assigned to, or an admin/super_admin (see canEditProjectTask).
            ERP-tagged tasks open the shared ErpTaskModal; anything else
            uses the plain department/category edit form. */}
        {viewOnlyTask && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={() => setViewOnlyTask(null)}>
            <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4`} onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
                    {viewOnlyTask.task_name}
                    {viewOnlyTask.created_via === 'client_portal' && (
                      <Badge
                        className="bg-[#14b8a6]/20 text-[#14b8a6] text-xs font-medium"
                        title="Reported by the client through the Client Portal"
                        data-testid="view-task-client-portal-badge"
                      >
                        Client Portal
                      </Badge>
                    )}
                  </h3>
                  <button onClick={() => setViewOnlyTask(null)} className={textSecondary}><X className="h-5 w-5" /></button>
                </div>
                {viewOnlyTask.description && <p className={`text-sm ${textPrimary}`}>{viewOnlyTask.description}</p>}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className={`text-xs ${textSecondary}`}>Assigned To</p><p className={textPrimary}>{users.find(u => u.user_id === viewOnlyTask.assigned_to)?.name || viewOnlyTask.assigned_to || '—'}</p></div>
                  <div><p className={`text-xs ${textSecondary}`}>Due Date</p><p className={textPrimary}>{fmtDate(viewOnlyTask.due_date)}</p></div>
                  <div><p className={`text-xs ${textSecondary}`}>Priority</p><p className={`capitalize ${textPrimary}`}>{viewOnlyTask.priority || 'medium'}</p></div>
                  <div><p className={`text-xs ${textSecondary}`}>Status</p><p className={`capitalize ${textPrimary}`}>{(viewOnlyTask.status || 'pending').replace('_', ' ')}</p></div>
                  {viewOnlyTask.erp_task_type && (
                    <div><p className={`text-xs ${textSecondary}`}>Type</p><p className={textPrimary}>{viewOnlyTask.erp_task_type}</p></div>
                  )}
                  <div><p className={`text-xs ${textSecondary}`}>Created By</p><p className={textPrimary}>{users.find(u => u.user_id === viewOnlyTask.created_by)?.name || '—'}</p></div>
                </div>
                {viewOnlyTask.work_link && (
                  <a href={viewOnlyTask.work_link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] text-sm hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" /> {viewOnlyTask.work_link}
                  </a>
                )}
                {viewOnlyTask.erp_user_id && (
                  <div className={`p-3 rounded-lg ${bgSecondary}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>ERP Location</p>
                      <button
                        type="button"
                        onClick={() => handleCopyPromptAndImage(viewOnlyTask)}
                        className="text-xs text-[#6366f1] hover:underline flex items-center gap-1"
                        title="Copy prompt and reference image"
                        data-testid="view-task-copy-prompt"
                      >
                        {promptCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {promptCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className={`text-sm ${textPrimary} break-words`}>
                      {buildErpPrompt({
                        projectName: selectedProject.name,
                        userName: viewOnlyTask.erp_user_name,
                        pageName: viewOnlyTask.erp_page_name,
                        subTabName: viewOnlyTask.erp_sub_tab_name,
                        ultraSubTabName: viewOnlyTask.erp_ultra_sub_tab_name,
                        ultraTabName: viewOnlyTask.erp_ultra_tab_name,
                        taskName: viewOnlyTask.task_name,
                      })}
                    </p>
                    {viewOnlyTask.reference_image && (
                      <img
                        src={viewOnlyTask.reference_image}
                        alt="Reference"
                        className={`max-h-48 rounded-md border ${borderColor} mt-2`}
                        data-testid="view-task-reference-image"
                      />
                    )}
                    {viewOnlyTask.voice_note && (
                      <audio
                        controls
                        src={viewOnlyTask.voice_note}
                        className="w-full h-9 mt-2"
                        data-testid="view-task-voice-note"
                      />
                    )}
                  </div>
                )}
                {/* Time Tracking — total time spent, live timer status, a
                    session-by-session timeline, and (for whoever can edit
                    this task) Start/Pause/Resume/Finish controls plus a
                    manual start/end time editor. Each session is one
                    start→pause/finish segment; pause count is approximated
                    as closed segments minus one if the timer finished (the
                    backend doesn't tag which action closed each session).
                    Locked once finished or approved — the backend rejects
                    time-edit at that point, so the editor hides instead of
                    letting someone hit a submit error. */}
                {(() => {
                  const tracking = viewOnlyTask.time_tracking || {};
                  const sessions = tracking.sessions || [];
                  const canTrack = canManageProjects && canEditProjectTask(viewOnlyTask);
                  if (!sessions.length && !tracking.total_seconds && !canTrack) return null;
                  const closedCount = sessions.filter(s => s.end).length;
                  const pauseCount = Math.max(0, closedCount - (tracking.status === 'finished' ? 1 : 0));
                  const locked = tracking.status === 'finished' || viewOnlyTask.approval_request?.status === 'approved';
                  return (
                    <div className={`p-3 rounded-lg ${bgSecondary}`} data-testid="project-task-time-tracking">
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-[11px] uppercase tracking-wide ${textSecondary} flex items-center gap-1`}>
                          <Timer className="h-3 w-3" /> Time Tracking
                        </p>
                        {tracking.status === 'running' && (
                          <Badge className="bg-emerald-500/20 text-emerald-500 animate-pulse"><Play className="h-3 w-3 mr-1" /> Running</Badge>
                        )}
                        {tracking.status === 'paused' && (
                          <Badge className="bg-amber-500/20 text-amber-500"><Pause className="h-3 w-3 mr-1" /> Paused</Badge>
                        )}
                        {tracking.status === 'finished' && (
                          <Badge className="bg-emerald-500/20 text-emerald-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Finished</Badge>
                        )}
                      </div>
                      <p className={`text-2xl font-bold ${textPrimary}`}>{formatDuration(tracking.total_seconds || 0)}</p>
                      <p className={`text-xs ${textSecondary} mb-2`}>
                        Total time spent
                        {sessions.length > 0 && ` · ${sessions.length} session${sessions.length === 1 ? '' : 's'}`}
                        {pauseCount > 0 && ` · paused ${pauseCount}×`}
                      </p>
                      {canTrack && !locked && (
                        <div className="flex flex-wrap items-center gap-2 mb-2" data-testid="project-task-timer-controls">
                          {(!tracking.status || tracking.status === 'not_started') && (
                            <Button size="sm" disabled={savingTime} onClick={() => runTimeAction('start')} className="bg-emerald-500 hover:bg-emerald-600 text-white h-8">
                              <Play className="h-3.5 w-3.5 mr-1" /> Start
                            </Button>
                          )}
                          {tracking.status === 'running' && (
                            <>
                              <Button size="sm" disabled={savingTime} onClick={() => runTimeAction('pause')} className="bg-amber-500 hover:bg-amber-600 text-white h-8">
                                <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                              </Button>
                              <Button size="sm" variant="outline" disabled={savingTime} onClick={() => runTimeAction('finish')} className="h-8">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Finish
                              </Button>
                            </>
                          )}
                          {tracking.status === 'paused' && (
                            <>
                              <Button size="sm" disabled={savingTime} onClick={() => runTimeAction('resume')} className="bg-emerald-500 hover:bg-emerald-600 text-white h-8">
                                <Play className="h-3.5 w-3.5 mr-1" /> Resume
                              </Button>
                              <Button size="sm" variant="outline" disabled={savingTime} onClick={() => runTimeAction('finish')} className="h-8">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Finish
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" disabled={savingTime} onClick={() => (timeEditOpen ? setTimeEditOpen(false) : openTimeEdit())} className="h-8 text-xs">
                            <Pencil className="h-3 w-3 mr-1" /> {timeEditOpen ? 'Cancel edit' : 'Edit time'}
                          </Button>
                        </div>
                      )}
                      {locked && canTrack && (
                        <p className={`text-[11px] ${textSecondary} mb-2`}>Time is locked — finished or already approved.</p>
                      )}
                      {timeEditOpen && (
                        <div className={`p-2.5 rounded-md mb-2 border border-dashed ${borderColor} space-y-2`} data-testid="project-task-time-edit-form">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className={`text-[10px] ${textSecondary}`}>Date</Label>
                              <Input type="date" value={timeEditDraft.date} onChange={(e) => setTimeEditDraft(d => ({ ...d, date: e.target.value }))} className="h-8 text-xs" />
                            </div>
                            <div>
                              <Label className={`text-[10px] ${textSecondary}`}>Start</Label>
                              <Input type="time" value={timeEditDraft.start_time} onChange={(e) => setTimeEditDraft(d => ({ ...d, start_time: e.target.value }))} className="h-8 text-xs" />
                            </div>
                            <div>
                              <Label className={`text-[10px] ${textSecondary}`}>End</Label>
                              <Input type="time" value={timeEditDraft.end_time} onChange={(e) => setTimeEditDraft(d => ({ ...d, end_time: e.target.value }))} className="h-8 text-xs" />
                            </div>
                          </div>
                          <Button size="sm" disabled={savingTime} onClick={submitTimeEdit} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-8 w-full">
                            Save time
                          </Button>
                        </div>
                      )}
                      {sessions.length > 0 && (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pt-2 border-t border-dashed">
                          {sessions.map((session, idx) => (
                            <div key={idx} className={`flex items-center justify-between text-xs ${textSecondary} px-2 py-1.5 rounded ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
                              <span>
                                {new Date(session.start).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                {session.end ? ` → ${new Date(session.end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ' → running'}
                              </span>
                              <span className="font-medium text-[#6366f1]">{formatDuration(session.duration_seconds || 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* History — every lifecycle event (created, each start/pause/
                    resume/finish, sent for approval, decided) merged into one
                    chronological, horizontally-scrollable timeline, with the
                    gap between consecutive events shown on the connector. */}
                {(() => {
                  const t = viewOnlyTask;
                  const nameFor = (uid) => (uid ? (users.find(u => u.user_id === uid)?.name || uid) : null);
                  const events = [];
                  if (t.created_at) {
                    events.push({ key: 'created', label: 'Created', time: t.created_at, by: t.created_by_name || nameFor(t.created_by), Icon: Plus, color: 'text-[#6366f1]' });
                  }
                  const sessions = t.time_tracking?.sessions || [];
                  sessions.forEach((s, idx) => {
                    if (s.start) {
                      events.push({ key: `start-${idx}`, label: idx === 0 ? 'Started' : 'Resumed', time: s.start, by: nameFor(s.user_id), Icon: Play, color: 'text-emerald-500' });
                    }
                    if (s.end) {
                      const isFinished = idx === sessions.length - 1 && t.time_tracking?.status === 'finished';
                      events.push({ key: `end-${idx}`, label: isFinished ? 'Finished' : 'Paused', time: s.end, by: nameFor(s.user_id), Icon: isFinished ? CheckCircle2 : Pause, color: isFinished ? 'text-emerald-500' : 'text-amber-500' });
                    }
                  });
                  const ar = t.approval_request;
                  if (ar?.requested_at) {
                    events.push({ key: 'approval-requested', label: `Sent for approval (${ar.approver_role || '—'})`, time: ar.requested_at, by: ar.requested_by_name || nameFor(ar.requested_by), Icon: ShieldQuestion, color: 'text-orange-500' });
                  }
                  if (ar?.decided_at) {
                    const approved = ar.status === 'approved';
                    events.push({ key: 'approval-decided', label: approved ? 'Approved' : ar.status === 'rejected' ? 'Rejected' : 'Decided', time: ar.decided_at, by: nameFor(ar.decided_by), Icon: approved ? CheckCircle2 : X, color: approved ? 'text-emerald-500' : 'text-red-500' });
                  }
                  events.sort((a, b) => new Date(a.time) - new Date(b.time));
                  if (events.length === 0) return null;
                  return (
                    <div data-testid="project-task-history">
                      <p className={`text-[11px] uppercase tracking-wide ${textSecondary} mb-2`}>History</p>
                      <div className="overflow-x-auto pb-1">
                        <div className="flex items-start min-w-max">
                          {events.map((ev, idx) => (
                            <React.Fragment key={ev.key}>
                              {idx > 0 && (
                                <div className="flex flex-col items-center justify-center px-1.5 pt-3.5 min-w-[52px]">
                                  <div className={`h-0.5 w-full ${isDark ? 'bg-[#3f3f46]' : 'bg-gray-300'}`} />
                                  <span className={`text-[9px] ${textSecondary} mt-1 whitespace-nowrap`}>
                                    {formatDuration(Math.max(0, Math.round((new Date(ev.time) - new Date(events[idx - 1].time)) / 1000)))}
                                  </span>
                                </div>
                              )}
                              <div className="flex flex-col items-center text-center w-24 flex-shrink-0">
                                <div className={`h-7 w-7 rounded-full flex items-center justify-center ${bgSecondary} border ${borderColor}`}>
                                  <ev.Icon className={`h-3.5 w-3.5 ${ev.color}`} />
                                </div>
                                <p className={`text-[10px] font-medium mt-1 ${textPrimary} leading-tight`}>{ev.label}</p>
                                <p className={`text-[9px] ${textSecondary}`}>
                                  {new Date(ev.time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                                {ev.by && <p className={`text-[9px] ${textSecondary} truncate w-full`} title={ev.by}>{ev.by}</p>}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex justify-end gap-2 pt-2">
                  {canManageProjects && canEditProjectTask(viewOnlyTask) && (
                    <Button variant="outline" onClick={() => { const t = viewOnlyTask; setViewOnlyTask(null); handleEditTask(t); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setViewOnlyTask(null)}>Close</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ERP-tagged task edit — the same shared modal ProjectErpUsersTab
            uses, seeded with this task's existing location/draft. */}
        {erpTaskModal && (
          <ErpTaskModal
            project={selectedProject}
            projectMembers={projectMembers}
            currentUser={currentUser}
            headers={headers}
            taskId={erpTaskModal.taskId}
            initialLocation={erpTaskModal.location}
            initialDraft={erpTaskModal.draft}
            onClose={() => setErpTaskModal(null)}
            onSaved={() => { refreshSelectedProject(); loadProjects(); }}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {/* Client Portal — ERP/Website projects, create/reset a client login + share message */}
        {showClientPortalModal && (
          <ClientPortalModal
            project={selectedProject}
            onClose={() => setShowClientPortalModal(false)}
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}

        {/* Reset Delivery Date — shows once the due date has passed. User is
            always the current logged-in person, never manually chosen. */}
        {showResetDeliveryModal && selectedProject && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4"
            onClick={() => !savingResetDelivery && setShowResetDeliveryModal(false)}
          >
            <Card className={`${bgCard} border ${borderColor} w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>Reset Delivery Date</h3>
                  <button onClick={() => !savingResetDelivery && setShowResetDeliveryModal(false)} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className={`text-sm ${textSecondary}`}>
                  Current delivery date <span className={`font-medium ${textPrimary}`}>{fmtDate(selectedProject.due_date)}</span> has passed.
                </p>
                <div>
                  <Label className={textPrimary}>New Delivery Date</Label>
                  <input
                    type="date"
                    value={resetDeliveryDraft.new_due_date}
                    onChange={(e) => setResetDeliveryDraft(d => ({ ...d, new_due_date: e.target.value }))}
                    className={`w-full px-2 py-2 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                    data-testid="reset-delivery-new-date"
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Set By</Label>
                  <p className={`text-sm ${textPrimary} px-2 py-2 rounded border ${borderColor} ${bgSecondary}`}>{currentUser?.name || 'You'}</p>
                </div>
                <div>
                  <Label className={textPrimary}>Reason</Label>
                  <textarea
                    value={resetDeliveryDraft.reason}
                    onChange={(e) => setResetDeliveryDraft(d => ({ ...d, reason: e.target.value }))}
                    rows={3}
                    placeholder="Why is the delivery date changing?"
                    className={`w-full px-2 py-2 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                    data-testid="reset-delivery-reason"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowResetDeliveryModal(false)} disabled={savingResetDelivery}>Cancel</Button>
                  <Button
                    onClick={submitResetDeliveryDate}
                    disabled={savingResetDelivery}
                    className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                    data-testid="reset-delivery-submit"
                  >
                    {savingResetDelivery ? 'Saving…' : 'Record & Update'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Handover — Popup 1: pick the handover date, which emails an OTP
            to every Super Admin. */}
        {showHandoverRequestModal && selectedProject && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4"
            onClick={() => !savingHandover && setShowHandoverRequestModal(false)}
          >
            <Card className={`${bgCard} border ${borderColor} w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>Handover Project</h3>
                  <button onClick={() => !savingHandover && setShowHandoverRequestModal(false)} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className={`text-sm ${textSecondary}`}>
                  Pick the handover date. An OTP will be emailed to the Super Admin to approve this handover.
                </p>
                <div>
                  <Label className={textPrimary}>Handover Date</Label>
                  <input
                    type="date"
                    value={handoverDateDraft}
                    onChange={(e) => setHandoverDateDraft(e.target.value)}
                    className={`w-full px-2 py-2 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                    data-testid="handover-date-input"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowHandoverRequestModal(false)} disabled={savingHandover}>Cancel</Button>
                  <Button
                    onClick={submitHandoverRequestOtp}
                    disabled={savingHandover}
                    className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                    data-testid="handover-request-otp-submit"
                  >
                    {savingHandover ? 'Sending…' : 'Request OTP'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Handover — Popup 2: enter the OTP the Super Admin received, plus
            remarks, to actually complete the handover. */}
        {showHandoverVerifyModal && selectedProject && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4"
            onClick={() => !savingHandover && setShowHandoverVerifyModal(false)}
          >
            <Card className={`${bgCard} border ${borderColor} w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>Confirm Handover</h3>
                  <button onClick={() => !savingHandover && setShowHandoverVerifyModal(false)} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className={`text-sm ${textSecondary}`}>
                  Enter the OTP sent to the Super Admin for handover on{' '}
                  <span className={`font-medium ${textPrimary}`}>{fmtDate(selectedProject?.handover?.requested_date)}</span>.
                </p>
                <div>
                  <Label className={textPrimary}>OTP</Label>
                  <Input
                    type="text"
                    autoFocus
                    value={handoverOtpDraft}
                    onChange={(e) => setHandoverOtpDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitHandoverVerifyOtp(); } }}
                    placeholder="6-digit OTP"
                    data-testid="handover-otp-input"
                  />
                </div>
                <div>
                  <Label className={textPrimary}>Remarks</Label>
                  <textarea
                    value={handoverRemarksDraft}
                    onChange={(e) => setHandoverRemarksDraft(e.target.value)}
                    rows={3}
                    placeholder="Any remarks about this handover"
                    className={`w-full px-2 py-2 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                    data-testid="handover-remarks-input"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowHandoverVerifyModal(false)} disabled={savingHandover}>Cancel</Button>
                  <Button
                    onClick={submitHandoverVerifyOtp}
                    disabled={savingHandover || !handoverOtpDraft.trim()}
                    className="bg-[#10b981] hover:bg-[#059669] text-white"
                    data-testid="handover-verify-otp-submit"
                  >
                    {savingHandover ? 'Confirming…' : 'Confirm Handover'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delete Project — Super Admin only, re-enter password to confirm */}
        {showDeleteProjectModal && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]"
            onClick={() => !deletingProject && setShowDeleteProjectModal(false)}
          >
            <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4`} onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-red-500 flex items-center gap-2">
                    <Trash2 className="h-5 w-5" /> Delete Project
                  </h3>
                  <button onClick={() => !deletingProject && setShowDeleteProjectModal(false)} className={textSecondary}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className={`text-sm ${textSecondary}`}>
                  This will permanently delete <b className={textPrimary}>{deleteTargetProject?.name}</b>. Tasks linked to it
                  will be detached, not deleted. Enter your password to confirm.
                </p>
                <div>
                  <Label className={textPrimary}>Password</Label>
                  <Input
                    type="password"
                    autoFocus
                    value={deleteProjectPassword}
                    onChange={(e) => setDeleteProjectPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmDeleteProject(); } }}
                    placeholder="Your account password"
                    data-testid="delete-project-password"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setShowDeleteProjectModal(false)} disabled={deletingProject}>Cancel</Button>
                  <Button
                    onClick={confirmDeleteProject}
                    disabled={deletingProject || !deleteProjectPassword}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    data-testid="delete-project-confirm"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> {deletingProject ? 'Deleting…' : 'Delete Project'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ---------- Project List View ----------
  return (
    <div className="space-y-4" data-testid="projects-panel">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${textPrimary}`}>Projects</h2>
        {canManageProjects && (
          <Button onClick={() => setShowCreateProject(true)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="create-project-btn">
            <Plus className="h-4 w-4 mr-1" /> Create Project
          </Button>
        )}
      </div>

      {loading ? (
        <p className={textSecondary}>Loading...</p>
      ) : projects.length === 0 ? (
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-12 text-center">
            <Briefcase className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
            <p className={textPrimary}>No projects yet</p>
            <p className={`text-sm ${textSecondary}`}>Create your first project to organise tasks</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {navTabsBar}

          {showNotesHistory ? (
            <ProjectsNotesHistoryPanel
              department={deptFilter === 'all' ? '' : deptFilter}
              departmentLabel={deptFilter === 'all' ? 'all' : (DEPARTMENTS.find(d => d.value === deptFilter)?.label || deptFilter)}
              onClose={() => setShowNotesHistory(false)}
              headers={headers}
              bgCard={bgCard}
              bgSecondary={bgSecondary}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
            />
          ) : (
          <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`} data-testid="projects-list">
            <table className="w-full text-sm table-fixed">
              <thead className={`${bgSecondary} ${textSecondary} text-xs uppercase`}>
                <tr>
                  <th className="text-left px-2 py-3 w-[5%]" aria-label="Reorder / Pin" />
                  <th className="text-left px-4 py-3 w-[15%]">Project</th>
                  <th className="text-left px-4 py-3 w-[8%]">Departments</th>
                  <th className="text-left px-4 py-3 w-[9%]">Client</th>
                  <th className="text-left px-4 py-3 w-[9%]">Status</th>
                  <th className="text-left px-4 py-3 w-[6%]">Type</th>
                  <th className="text-left px-4 py-3 w-[7%]">Start Date</th>
                  <th className="text-left px-4 py-3 w-[7%]">Due Date</th>
                  <th className="text-left px-4 py-3 w-[6%]">Due Balance</th>
                  {deptFilter === 'website' && <th className="text-left px-4 py-3 w-[5%]">Weblink</th>}
                  {statusFilter === 'Hand Over' && <th className="text-left px-4 py-3 w-[7%]">Handover Date</th>}
                  {statusFilter === 'Hand Over' && <th className="text-left px-4 py-3 w-[8%]">Remarks</th>}
                  <th className="text-left px-4 py-3 w-[5%]">Tasks</th>
                  <th className="text-left px-4 py-3 w-[12%]">Progress</th>
                  <th className="text-left px-4 py-3 w-[5%]">Members</th>
                  {role === 'super_admin' && <th className="text-right px-4 py-3 w-[5%]">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {projects
                  .filter(p => deptFilter === 'all' || (p.departments || []).includes(deptFilter))
                  .filter(p => statusFilter === 'all' || (p.status || 'active') === statusFilter)
                  .map(p => (
                  <tr
                    key={p.project_id}
                    className={`border-t ${borderColor} cursor-pointer hover:bg-[#6366f1]/5 transition-colors ${p.is_pinned ? 'bg-amber-500/5' : ''}`}
                    onClick={async () => {
                      // Optimistic UI — show the project shell immediately, then hydrate with tasks.
                      // Website projects land on Pages, their own primary tab; everything
                      // else — including ERP — lands on Tasks.
                      const deps = p.departments || [];
                      setProjectInnerTab(deps.includes('website') ? 'pages' : 'tasks');
                      setSelectedProject(p);
                      try {
                        const res = await axios.get(`${API}/api/projects/${p.project_id}`, { headers });
                        setSelectedProject(res.data);
                      } catch { /* ignore — keep optimistic copy */ }
                    }}
                    data-testid={`project-row-${p.project_id}`}
                  >
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()} {...projectDragProps(p.project_id)}>
                      <div className="flex items-center gap-1">
                        {canManageProjects && (
                          <GripVertical className={`h-4 w-4 ${textSecondary} cursor-grab shrink-0`} />
                        )}
                        <button
                          type="button"
                          onClick={() => togglePinProject(p)}
                          disabled={!canManageProjects || (!p.is_pinned && pinnedProjectCount >= 5)}
                          title={p.is_pinned ? 'Unpin project' : (pinnedProjectCount >= 5 ? 'Maximum 5 projects can be pinned' : 'Pin project')}
                          className={`p-1 rounded ${p.is_pinned ? 'text-amber-500' : `${textSecondary} ${pinnedProjectCount >= 5 ? 'opacity-40 cursor-not-allowed' : 'hover:text-amber-500'}`}`}
                          data-testid={`project-row-pin-${p.project_id}`}
                        >
                          {p.is_pinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className={`font-medium ${textPrimary} truncate`}>{p.name}</p>
                      <p className={`text-xs ${textSecondary} truncate`}>{p.description || 'No description'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(p.departments || []).map(dv => {
                          const d = DEPARTMENTS.find(x => x.value === dv);
                          return d ? (
                            <Badge key={dv} className="bg-[#6366f1]/20 text-[#6366f1] text-xs">{d.label}</Badge>
                          ) : null;
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                        {(p.client_name || p.client_id) && <Building2 className="h-3 w-3 flex-shrink-0" />}
                        <span className="truncate max-w-[140px]" data-testid={`project-row-client-${p.project_id}`}>
                          {p.client_name || (clients.find(c => c.client_id === p.client_id)?.display_name) || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {canManageProjects ? (
                        <select
                          value={p.status || 'active'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateProjectRowStatus(p, e.target.value)}
                          className={`px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary} text-xs`}
                          data-testid={`project-row-status-select-${p.project_id}`}
                        >
                          {statusOptionsFor(p).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge className="bg-[#10b981]/20 text-[#10b981]">{p.status || 'active'}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.project_type ? (
                        <Badge className="bg-[#8b5cf6]/20 text-[#8b5cf6] text-xs capitalize">{p.project_type}</Badge>
                      ) : (
                        <span className={`text-xs ${textSecondary}`}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                        <Calendar className="h-3 w-3" />{fmtDate(p.start_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                        <Calendar className="h-3 w-3" />{fmtDate(p.due_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const info = dueBalanceInfo(p.due_date);
                        return info ? (
                          <span className="text-xs font-medium" style={{ color: info.color }}>{info.label}</span>
                        ) : (
                          <span className={`text-xs ${textSecondary}`}>—</span>
                        );
                      })()}
                    </td>
                    {deptFilter === 'website' && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {p.website_link ? (
                          <a
                            href={normalizeUrl(p.website_link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#6366f1] hover:underline"
                            data-testid={`project-row-weblink-${p.project_id}`}
                          >
                            Visit
                          </a>
                        ) : (
                          <span className={`text-xs ${textSecondary}`}>—</span>
                        )}
                      </td>
                    )}
                    {statusFilter === 'Hand Over' && (
                      <td className="px-4 py-3">
                        <span className={`text-xs ${textSecondary}`}>{fmtDate(p.handover?.handover_date)}</span>
                      </td>
                    )}
                    {statusFilter === 'Hand Over' && (
                      <td className="px-4 py-3 max-w-[220px]">
                        <span className={`text-xs ${textSecondary} truncate block`}>{p.handover?.remarks || '—'}</span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                        <ListChecks className="h-3 w-3" />{p.task_count || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 overflow-hidden">
                      {(() => {
                        const total = p.task_count || 0;
                        const approved = p.approved_task_count || 0;
                        const pending = p.pending_approval_task_count || 0;
                        const approvedPct = total ? (approved / total) * 100 : 0;
                        const pendingPct = total ? (pending / total) * 100 : 0;
                        return (
                          <div className="flex flex-col gap-1">
                            <div className={`w-full h-2 rounded-full overflow-hidden flex ${bgSecondary}`}>
                              <div className="h-full bg-[#10b981]" style={{ width: `${approvedPct}%` }} />
                              <div className="h-full bg-[#f59e0b]" style={{ width: `${pendingPct}%` }} />
                            </div>
                            <span className={`text-[11px] ${textSecondary}`}>
                              {total === 0 ? 'No tasks' : `${approved}/${total} approved${pending ? ` · ${pending} pending` : ''}`}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                        <Users className="h-3 w-3" />{p.members?.length || 0}
                      </span>
                    </td>
                    {role === 'super_admin' && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => { setDeleteTargetProject(p); setDeleteProjectPassword(''); setShowDeleteProjectModal(true); }}
                          className="p-1 text-red-500 hover:text-red-400"
                          title="Delete project"
                          data-testid={`project-row-delete-${p.project_id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {projects
              .filter(p => deptFilter === 'all' || (p.departments || []).includes(deptFilter))
              .filter(p => statusFilter === 'all' || (p.status || 'active') === statusFilter)
              .length === 0 && (
              <div className={`p-8 text-center text-sm ${textSecondary}`}>No projects found</div>
            )}
          </div>
          )}
        </>
      )}

      {/* Delete Project (from the list row) — Super Admin only, re-enter
          password to confirm. Separate instance from the one inside the
          project detail view, since this branch renders when no project
          is open (selectedProject is null). */}
      {showDeleteProjectModal && deleteTargetProject && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]"
          onClick={() => !deletingProject && setShowDeleteProjectModal(false)}
        >
          <Card className={`${bgCard} border ${borderColor} w-full max-w-md mx-4`} onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-red-500 flex items-center gap-2">
                  <Trash2 className="h-5 w-5" /> Delete Project
                </h3>
                <button onClick={() => !deletingProject && setShowDeleteProjectModal(false)} className={textSecondary}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className={`text-sm ${textSecondary}`}>
                This will permanently delete <b className={textPrimary}>{deleteTargetProject.name}</b>. Tasks linked to it
                will be detached, not deleted. Enter your password to confirm.
              </p>
              <div>
                <Label className={textPrimary}>Password</Label>
                <Input
                  type="password"
                  autoFocus
                  value={deleteProjectPassword}
                  onChange={(e) => setDeleteProjectPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmDeleteProject(); } }}
                  placeholder="Your account password"
                  data-testid="delete-project-password-list"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowDeleteProjectModal(false)} disabled={deletingProject}>Cancel</Button>
                <Button
                  onClick={confirmDeleteProject}
                  disabled={deletingProject || !deleteProjectPassword}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  data-testid="delete-project-confirm-list"
                >
                  <Trash2 className="h-3 w-3 mr-1" /> {deletingProject ? 'Deleting…' : 'Delete Project'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 bg-black/60 overflow-y-auto z-[70]" onClick={() => setShowCreateProject(false)}>
        <div className="min-h-full flex items-center justify-center py-8">
          <Card className={`${bgCard} border ${borderColor} w-full max-w-lg mx-4`} onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Create Project</h3>
                <button onClick={() => setShowCreateProject(false)} className={textSecondary}><X className="h-5 w-5" /></button>
              </div>
              <div><Label className={textPrimary}>Project Name *</Label><Input value={projectDraft.name} onChange={(e) => setProjectDraft({ ...projectDraft, name: e.target.value })} placeholder="e.g. Website Revamp" data-testid="project-name-input" /></div>

              {/* Client (mandatory) — sourced from Finance → Clients */}
              <div>
                <Label className={textPrimary}>Client *</Label>
                <select
                  value={projectDraft.client_id}
                  onChange={(e) => setProjectDraft({ ...projectDraft, client_id: e.target.value })}
                  className={`w-full px-3 py-2 rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40`}
                  data-testid="project-client-select"
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.client_id} value={c.client_id}>
                      {c.display_name}{c.company_name ? ` — ${c.company_name}` : ''}
                    </option>
                  ))}
                </select>
                {clients.length === 0 && (
                  <p className={`text-xs ${textSecondary} mt-1`}>
                    No clients yet — add one under Finance → Clients first.
                  </p>
                )}
              </div>

              <div><Label className={textPrimary}>Description</Label><Input value={projectDraft.description} onChange={(e) => setProjectDraft({ ...projectDraft, description: e.target.value })} placeholder="What is this project about?" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Start Date</Label>
                  <Input type="date" value={projectDraft.start_date} onChange={(e) => setProjectDraft({ ...projectDraft, start_date: e.target.value })} data-testid="project-start-date" />
                </div>
                <div>
                  <Label className={textPrimary}>Due Date</Label>
                  <Input type="date" value={projectDraft.due_date} onChange={(e) => setProjectDraft({ ...projectDraft, due_date: e.target.value })} />
                </div>
              </div>

              {/* Project Type */}
              <div>
                <Label className={textPrimary}>Project Type</Label>
                <div className="flex gap-2 mt-1">
                  {[{ value: 'onetime', label: 'Onetime' }, { value: 'monthly', label: 'Monthly' }].map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setProjectDraft({ ...projectDraft, project_type: t.value })}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                        projectDraft.project_type === t.value
                          ? 'bg-[#6366f1] border-[#6366f1] text-white'
                          : `${borderColor} ${bgSecondary} ${textSecondary}`
                      }`}
                      data-testid={`project-type-${t.value}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Departments */}
              <div>
                <Label className={textPrimary}>Departments</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DEPARTMENTS.map(d => {
                    const selected = projectDraft.departments.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setProjectDraft(prev => ({
                          ...prev,
                          departments: selected
                            ? prev.departments.filter(x => x !== d.value)
                            : [...prev.departments, d.value],
                        }))}
                        className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                          selected ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary} hover:bg-[#6366f1]/20`
                        }`}
                        data-testid={`project-dept-${d.value}`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Team Members */}
              <div>
                <Label className={textPrimary}>Team Members</Label>
                <p className={`text-xs ${textSecondary} mb-2`}>Only selected members (and admins) will see this project.</p>
                <div className={`max-h-48 overflow-y-auto border ${borderColor} rounded-lg p-2 space-y-1`}>
                  {users.map(u => {
                    const checked = projectDraft.members.includes(u.user_id);
                    return (
                      <label
                        key={u.user_id}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer ${bgSecondary}/40 hover:bg-[#6366f1]/10`}
                        data-testid={`project-member-${u.user_id}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setProjectDraft(prev => ({
                            ...prev,
                            members: checked ? prev.members.filter(x => x !== u.user_id) : [...prev.members, u.user_id],
                          }))}
                          className="h-4 w-4 accent-[#6366f1]"
                        />
                        <span className={`text-sm ${textPrimary}`}>{u.name}</span>
                        <span className={`text-xs ${textSecondary}`}>{u.email}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowCreateProject(false)}>Cancel</Button>
                <Button onClick={handleCreateProject} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="project-save-btn">
                  <Check className="h-3 w-3 mr-1" /> Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      )}
    </div>
  );
}
