import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Briefcase, X, Calendar, Users, ListChecks, Check, ExternalLink, FileText, FileSpreadsheet, FolderOpen, Pencil, Trash2, Video, Wallet, Building2, TrendingDown, Globe, Target, BarChart3, Layers, Megaphone, ChevronDown, ChevronRight, KeyRound } from 'lucide-react';
import PaymentScheduleTab from './projects/PaymentScheduleTab';
import ProjectExpenseTab from './projects/ProjectExpenseTab';
import ProjectContentCalendarTab from './projects/ProjectContentCalendarTab';
import ClientPortalModal from './projects/ClientPortalModal';
import ProjectErpOthersTab from './projects/ProjectErpOthersTab';
import ProjectSeoScopeTab from './projects/ProjectSeoScopeTab';
import ProjectPagesTab from './projects/ProjectPagesTab';
import ProjectOthersTab from './projects/ProjectOthersTab';
import ProjectErpUsersTab from './projects/ProjectErpUsersTab';
import ProjectScopesTab from './projects/ProjectScopesTab';
import ProjectCampaignsTab from './projects/ProjectCampaignsTab';
import ProjectMetaReportsTab from './projects/ProjectMetaReportsTab';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import MeetingModal from './MeetingModal';
import useAutoRefresh from '../hooks/useAutoRefresh';

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

export default function ProjectsPanel({
  isDark, textPrimary, textSecondary, bgCard, bgSecondary, borderColor, headers, onTaskCreated, currentUser,
  viewOnly = false,
}) {
  // Permission: the parent (OurTasksPage) already resolves this correctly — privileged
  // roles via their own View/Edit toggle, everyone else via their designation's
  // operations_projects config — and passes it down as `viewOnly`. Previously this
  // panel ALSO re-checked designation with a hardcoded exact-string match
  // (desg === 'operation head'), which silently blocked anyone whose actual
  // designation title didn't match that literal string (e.g. "Head of Operations").
  const role = (currentUser?.role || '').toLowerCase();
  const canManageProjects = !viewOnly;
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null); // project being viewed
  const [projectDetailCollapsed, setProjectDetailCollapsed] = useState(false);
  const [showClientPortalModal, setShowClientPortalModal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [deptFilter, setDeptFilter] = useState('all');

  const [projectDraft, setProjectDraft] = useState({ name: '', client_id: '', description: '', start_date: '', due_date: '', project_type: 'onetime', departments: [], members: [] });
  const [clients, setClients] = useState([]);
  const [taskDraft, setTaskDraft] = useState({ task_name: '', description: '', assigned_to: '', due_date: '', priority: 'medium', work_link: '', department: '', category: '', erp_user_id: '', erp_user_name: '', erp_page_id: '', erp_page_name: '' });
  const [deptCategories, setDeptCategories] = useState([]); // [{dept_key, label, categories: [...]}]
  const [deptStatuses, setDeptStatuses] = useState([]); // [{dept_key, label, statuses: [...]}]
  const [statusFilter, setStatusFilter] = useState('all'); // Project List View status sub-tab (only meaningful when deptFilter !== 'all')
  const [activeCategoryTab, setActiveCategoryTab] = useState('all');
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
  // Task filters inside project detail
  const [taskMemberFilter, setTaskMemberFilter] = useState('all');
  const [taskDateFilter, setTaskDateFilter] = useState('all'); // all, today, single, range
  const [taskSingleDate, setTaskSingleDate] = useState('');
  const [taskDateFrom, setTaskDateFrom] = useState('');
  const [taskDateTo, setTaskDateTo] = useState('');

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

  // Super Admin only — deleting a project requires re-entering their
  // password (verified server-side against the account's stored hash).
  const confirmDeleteProject = async () => {
    if (!selectedProject || !deleteProjectPassword) return;
    setDeletingProject(true);
    try {
      await axios.delete(`${API}/api/projects/${selectedProject.project_id}`, {
        data: { password: deleteProjectPassword },
        headers,
      });
      toast.success('Project deleted');
      setShowDeleteProjectModal(false);
      setDeleteProjectPassword('');
      setSelectedProject(null);
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
      setTaskDraft({ task_name: '', description: '', assigned_to: '', due_date: '', priority: 'medium', work_link: '', department: '', category: '', erp_user_id: '', erp_user_name: '', erp_page_id: '', erp_page_name: '' });
      setShowAddTask(false);
      setEditingTaskId(null);
      refreshSelectedProject();
      loadProjects();
      if (onTaskCreated) onTaskCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save task');
    }
  };

  const handleEditTask = (task) => {
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

  // Scopes tab "Add Task" — defaults Department to this project's Meta Ads
  // department (Project itself is implicit: we're already inside it).
  const openAddTaskForScopes = () => {
    const defaultCategory = deptCategories.find(d => d.dept_key === 'meta')?.categories?.[0] || '';
    setEditingTaskId(null);
    setTaskDraft({ task_name: '', description: '', assigned_to: '', due_date: '', priority: 'medium', work_link: '', department: 'meta', category: defaultCategory, erp_user_id: '', erp_user_name: '', erp_page_id: '', erp_page_name: '' });
    setShowAddTask(true);
  };

  // SEO Scope tab "Add Task" — defaults Department to SEO and Category to
  // whichever sub-tab (Research / On Page SEO / Off Page SEO) is active.
  const openAddTaskForSeoScope = (category) => {
    const defaultCategory = category || deptCategories.find(d => d.dept_key === 'seo')?.categories?.[0] || '';
    setEditingTaskId(null);
    setTaskDraft({ task_name: '', description: '', assigned_to: '', due_date: '', priority: 'medium', work_link: '', department: 'seo', category: defaultCategory, erp_user_id: '', erp_user_name: '', erp_page_id: '', erp_page_name: '' });
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
  const navTabsBar = (
    <div data-testid="project-nav-tabs">
      {/* Department filter tabs with counts */}
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
        {DEPARTMENTS.map(d => {
          const count = projects.filter(p => (p.departments || []).includes(d.value)).length;
          if (count === 0) return null;
          return (
            <button
              key={d.value}
              onClick={() => { setSelectedProject(null); setDeptFilter(d.value); setStatusFilter('all'); }}
              className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                deptFilter === d.value ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary} hover:bg-[#6366f1]/20`
              }`}
              data-testid={`dept-filter-${d.value}`}
            >
              {d.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Status sub-tabs — only meaningful once a specific department is
          selected, since status vocabularies are defined per department
          (Operations → Departments → {Dept} → Status tab). */}
      {deptFilter !== 'all' && (() => {
        const deptProjects = projects.filter(p => (p.departments || []).includes(deptFilter));
        const statuses = deptStatuses.find(d => d.dept_key === deptFilter)?.statuses || [];
        if (statuses.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-2 mb-4" data-testid="project-status-subtabs">
            <button
              onClick={() => { setSelectedProject(null); setStatusFilter('all'); }}
              className={`px-3 py-1 rounded-full text-xs transition-all ${
                statusFilter === 'all' ? 'bg-[#10b981] text-white' : `${bgSecondary} ${textSecondary} hover:bg-[#10b981]/20`
              }`}
              data-testid="status-filter-all"
            >
              All Status ({deptProjects.length})
            </button>
            {statuses.map(s => {
              const count = deptProjects.filter(p => (p.status || 'active') === s).length;
              return (
                <button
                  key={s}
                  onClick={() => { setSelectedProject(null); setStatusFilter(s); }}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    statusFilter === s ? 'bg-[#10b981] text-white' : `${bgSecondary} ${textSecondary} hover:bg-[#10b981]/20`
                  }`}
                  data-testid={`status-filter-${s.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {s} ({count})
                </button>
              );
            })}
          </div>
        );
      })()}
    </div>
  );

  // ---------- Project Detail View ----------
  if (selectedProject) {
    // Build category sub-tabs from project's selected departments
    const projectDepts = selectedProject.departments || [];
    const categoryTabs = projectDepts.flatMap(deptKey => {
      const dept = deptCategories.find(d => d.dept_key === deptKey);
      if (!dept) return [];
      return (dept.categories || []).map(cat => ({
        id: `${deptKey}::${cat}`,
        deptKey,
        deptLabel: dept.label,
        category: cat,
      }));
    });
    const projectTasks = selectedProject.tasks || [];
    // Apply member + date filters on top of category sub-tab filter
    const todayStr = new Date().toISOString().slice(0, 10);
    const filteredTasks = projectTasks
      .filter(t => activeCategoryTab === 'all' || `${t.department}::${t.category}` === activeCategoryTab)
      .filter(t => taskMemberFilter === 'all' || t.assigned_to === taskMemberFilter)
      .filter(t => {
        const td = (t.due_date || t.created_at || '').slice(0, 10);
        if (taskDateFilter === 'today') return td === todayStr;
        if (taskDateFilter === 'single') return taskSingleDate ? td === taskSingleDate : true;
        if (taskDateFilter === 'range') {
          if (taskDateFrom && td < taskDateFrom) return false;
          if (taskDateTo && td > taskDateTo) return false;
          return true;
        }
        return true;
      });

    const countFor = (tab) => projectTasks.filter(t => `${t.department}::${t.category}` === tab.id).length;

    // Members of the project (resolved against user list)
    const projectMembers = (selectedProject.members || [])
      .map(uid => users.find(u => u.user_id === uid) || { user_id: uid, name: uid });

    return (
      <div className="space-y-4" data-testid="project-detail-view">
        {navTabsBar}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => setSelectedProject(null)} className={`text-sm ${textSecondary} hover:underline mb-1`}>
              ← Back to Projects
            </button>
            <h2 className={`text-2xl font-bold ${textPrimary}`}>{selectedProject.name}</h2>
            <p className={textSecondary}>{selectedProject.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={openTeamModal}
              variant="outline"
              className={`gap-2 ${!canManageProjects ? 'hidden' : ''}`}
              data-testid="project-team-btn"
            >
              <Users className="h-4 w-4" /> Team ({selectedProject.members?.length || 0})
            </Button>
            <Button
              onClick={() => { setShowDocsModal(true); setEditingDocId(null); setDocDraft({ name: '', link: '' }); }}
              variant="outline"
              className="gap-2"
              data-testid="project-docs-btn"
            >
              <FileText className="h-4 w-4" /> Documents ({(selectedProject.documents || []).length})
            </Button>
            <Button
              onClick={() => setShowMeetingsList(true)}
              variant="outline"
              className="gap-2"
              data-testid="project-meetings-list-btn"
            >
              <Video className="h-4 w-4" /> Meetings ({projectMeetings.length})
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
            {canManageProjects && (selectedProject.departments || []).includes('erp') && (
              <Button
                onClick={() => setShowClientPortalModal(true)}
                variant="outline"
                className="gap-2"
                data-testid="project-client-portal-btn"
              >
                <KeyRound className="h-4 w-4" /> Client Portal
              </Button>
            )}
            {role === 'super_admin' && (
              <Button
                onClick={() => { setDeleteProjectPassword(''); setShowDeleteProjectModal(true); }}
                variant="outline"
                className="gap-2 border-red-500/40 text-red-500 hover:bg-red-500/10"
                data-testid="project-delete-btn"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        </div>

        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4 space-y-3">
            <button
              type="button"
              onClick={() => setProjectDetailCollapsed(v => !v)}
              className={`flex items-center gap-2 text-sm font-medium ${textPrimary} hover:opacity-80`}
              data-testid="project-detail-collapse-toggle"
            >
              {projectDetailCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Project Details
            </button>
            {!projectDetailCollapsed && (
            <>
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
            </>
            )}
          </CardContent>
        </Card>

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
            { id: 'tasks', label: 'Tasks', icon: ListChecks },
            ...(showPaymentSchedule ? [{ id: 'payment', label: 'Payment Schedule', icon: Wallet }] : []),
            ...(showPaymentSchedule ? [{ id: 'expense', label: 'Expense', icon: TrendingDown }] : []),
            ...(isSocialMediaProject ? [{ id: 'content_calendar', label: 'Content Calendar', icon: Calendar }] : []),
            ...(isWebsiteProject ? [{ id: 'pages', label: 'Pages', icon: Globe }] : []),
            ...(isWebsiteProject ? [{ id: 'others', label: 'Others', icon: FolderOpen }] : []),
            ...(isErpProject ? [{ id: 'erp_users', label: 'Users', icon: Users }] : []),
            ...(isErpProject ? [{ id: 'erp_others', label: 'Others', icon: FolderOpen }] : []),
            ...(isSeoProject ? [{ id: 'seo_scope', label: 'Scope', icon: Target }] : []),
            ...(isMetaAdsProject ? [{ id: 'scopes', label: 'Scopes', icon: Target }] : []),
            ...(isMetaAdsProject ? [{ id: 'campaigns', label: 'Campaigns', icon: Megaphone }] : []),
            ...(isMetaAdsProject ? [{ id: 'reports', label: 'Reports', icon: BarChart3 }] : []),
            ...(isMetaAdsProject ? [{ id: 'additional', label: 'Additional', icon: Layers }] : []),
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

        {projectInnerTab === 'scopes' && (
          <ProjectScopesTab
            tasks={selectedProject.tasks || []}
            users={users}
            canManageProjects={canManageProjects}
            onAddTask={openAddTaskForScopes}
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

        {projectInnerTab === 'tasks' && (
        <div className="space-y-2">
          <h3 className={`text-base font-semibold ${textPrimary}`}>Tasks</h3>

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
              <option value="single">Single Date</option>
              <option value="range">Date Range</option>
            </select>

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

            {(taskMemberFilter !== 'all' || taskDateFilter !== 'all') && (
              <button
                onClick={() => {
                  setTaskMemberFilter('all');
                  setTaskDateFilter('all');
                  setTaskSingleDate('');
                  setTaskDateFrom('');
                  setTaskDateTo('');
                }}
                className={`text-xs ${textSecondary} hover:underline`}
                data-testid="project-filter-reset"
              >
                Reset
              </button>
            )}
          </div>

          {/* Category sub-tabs */}
          {categoryTabs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2" data-testid="project-category-tabs">
              <button
                onClick={() => setActiveCategoryTab('all')}
                className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                  activeCategoryTab === 'all' ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary} hover:bg-[#6366f1]/20`
                }`}
                data-testid="project-cat-tab-all"
              >
                All ({projectTasks.length})
              </button>
              {categoryTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategoryTab(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                    activeCategoryTab === tab.id ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textSecondary} hover:bg-[#6366f1]/20`
                  }`}
                  data-testid={`project-cat-tab-${tab.deptKey}-${tab.category.toLowerCase().replace(/\s+/g, '-')}`}
                  title={`${tab.deptLabel} · ${tab.category}`}
                >
                  {tab.category} ({countFor(tab)})
                </button>
              ))}
            </div>
          )}

          {filteredTasks.length === 0 ? (
            <p className={`text-sm ${textSecondary}`}>
              {activeCategoryTab === 'all' ? 'No tasks yet. Click "Add Task" to create one.' : 'No tasks in this category.'}
            </p>
          ) : (
            filteredTasks.map(task => {
              const user = users.find(u => u.user_id === task.assigned_to);
              return (
                <Card key={task.task_id} className={`${bgCard} border ${borderColor}`} data-testid={`project-task-${task.task_id}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${textPrimary}`}>{task.task_name}</span>
                        <Badge className={
                          task.status === 'completed' ? 'bg-[#10b981]/20 text-[#10b981]' :
                          task.status === 'in_progress' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' :
                          'bg-[#71717a]/20 text-[#71717a]'
                        }>{task.status?.replace('_', ' ') || 'pending'}</Badge>
                        {task.category && (
                          <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs">{task.category}</Badge>
                        )}
                      </div>
                      <p className={`text-xs ${textSecondary} mt-1`}>
                        Assigned to <span className={textPrimary}>{user?.name || task.assigned_to}</span>
                        {task.due_date && <> · Due {fmtDate(task.due_date)}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {task.work_link && (
                        <a href={task.work_link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] text-sm hover:underline flex items-center gap-1 px-2" data-testid={`project-task-link-${task.task_id}`}>
                          <ExternalLink className="h-3 w-3" /> Link
                        </a>
                      )}
                      {canManageProjects && (
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
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>{editingTaskId ? 'Edit Task' : 'Add Task'} — {selectedProject.name}</h3>
                  <button onClick={() => { setShowAddTask(false); setEditingTaskId(null); }} className={textSecondary}><X className="h-5 w-5" /></button>
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
                    {users.map(u => <option key={u.user_id} value={u.user_id}>{u.name} ({u.email})</option>)}
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
                {/* ERP User → Page tagging — only when the project has the
                    `erp` department. Pick one of the project's Users (from
                    the Users tab), then one of that user's Pages. */}
                {(selectedProject?.departments || []).includes('erp') && (
                  <div className={`mt-2 border ${borderColor} rounded-lg p-3 space-y-2`} data-testid="task-erp-section">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#6366f1]" />
                      <p className={`text-sm font-semibold ${textPrimary}`}>ERP Tagging</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label className={`text-xs ${textSecondary}`}>User</Label>
                        <select
                          value={taskDraft.erp_user_id}
                          onChange={(e) => {
                            const eu = (selectedProject?.erp_users || []).find(u => u.id === e.target.value);
                            setTaskDraft({ ...taskDraft, erp_user_id: e.target.value, erp_user_name: eu?.user_name || '', erp_page_id: '', erp_page_name: '' });
                          }}
                          className={`w-full h-9 px-2 rounded-md text-sm border ${borderColor} ${bgSecondary} ${textPrimary}`}
                          data-testid="task-erp-user"
                        >
                          <option value="">— select user —</option>
                          {(selectedProject?.erp_users || []).map(eu => (
                            <option key={eu.id} value={eu.id}>{eu.user_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className={`text-xs ${textSecondary}`}>Page</Label>
                        <select
                          value={taskDraft.erp_page_id}
                          onChange={(e) => {
                            if (e.target.value === 'others') {
                              setTaskDraft({ ...taskDraft, erp_page_id: 'others', erp_page_name: 'Others' });
                              return;
                            }
                            const eu = (selectedProject?.erp_users || []).find(u => u.id === taskDraft.erp_user_id);
                            const pg = (eu?.pages || []).find(p => p.id === e.target.value);
                            setTaskDraft({ ...taskDraft, erp_page_id: e.target.value, erp_page_name: pg?.page_name || '' });
                          }}
                          disabled={!taskDraft.erp_user_id}
                          className={`w-full h-9 px-2 rounded-md text-sm border ${borderColor} ${bgSecondary} ${textPrimary} disabled:opacity-50`}
                          data-testid="task-erp-page"
                        >
                          <option value="">— select page —</option>
                          {((selectedProject?.erp_users || []).find(u => u.id === taskDraft.erp_user_id)?.pages || []).map(pg => (
                            <option key={pg.id} value={pg.id}>{pg.page_name}</option>
                          ))}
                          <option value="others">Others</option>
                        </select>
                      </div>
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

        {/* Client Portal — ERP projects only, create/reset a client login + share message */}
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
                  This will permanently delete <b className={textPrimary}>{selectedProject.name}</b>. Tasks linked to it
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

          <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`} data-testid="projects-list">
            <table className="w-full text-sm">
              <thead className={`${bgSecondary} ${textSecondary} text-xs uppercase`}>
                <tr>
                  <th className="text-left px-4 py-3">Project</th>
                  <th className="text-left px-4 py-3">Departments</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Start Date</th>
                  <th className="text-left px-4 py-3">Due Date</th>
                  <th className="text-left px-4 py-3">Due Balance</th>
                  <th className="text-left px-4 py-3">Tasks</th>
                  <th className="text-left px-4 py-3">Members</th>
                </tr>
              </thead>
              <tbody>
                {projects
                  .filter(p => deptFilter === 'all' || (p.departments || []).includes(deptFilter))
                  .filter(p => statusFilter === 'all' || (p.status || 'active') === statusFilter)
                  .map(p => (
                  <tr
                    key={p.project_id}
                    className={`border-t ${borderColor} cursor-pointer hover:bg-[#6366f1]/5 transition-colors`}
                    onClick={async () => {
                      // Optimistic UI — show the project shell immediately, then hydrate with tasks.
                      setSelectedProject(p);
                      try {
                        const res = await axios.get(`${API}/api/projects/${p.project_id}`, { headers });
                        setSelectedProject(res.data);
                      } catch { /* ignore — keep optimistic copy */ }
                    }}
                    data-testid={`project-row-${p.project_id}`}
                  >
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
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                        <ListChecks className="h-3 w-3" />{p.task_count || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs ${textSecondary}`}>
                        <Users className="h-3 w-3" />{p.members?.length || 0}
                      </span>
                    </td>
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
        </>
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
