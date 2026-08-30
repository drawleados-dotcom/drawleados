import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, Pencil, X, Workflow as WorkflowIcon, ChevronDown, ChevronUp, ChevronRight, Search, Flag, CheckCircle2, Pin } from 'lucide-react';
import ErpLocationPicker from './ErpLocationPicker';
import { ErpTaskCountBadge } from './ErpTaskList';
import ErpTaskModal from './ErpTaskModal';

const todayIso = () => new Date().toISOString().slice(0, 10);

const API = process.env.REACT_APP_BACKEND_URL;

const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

// Pinned workflows always float to the top of the list — capped so
// pinning doesn't just become a second unsorted list.
const MAX_PINNED_WORKFLOWS = 5;

const emptyPoint = {
  erp_user_id: '', erp_user_name: '',
  erp_page_id: '', erp_page_name: '',
  erp_sub_tab_id: '', erp_sub_tab_name: '',
  erp_ultra_sub_tab_id: '', erp_ultra_sub_tab_name: '',
  erp_ultra_tab_id: '', erp_ultra_tab_name: '',
  erp_ultra_tab_pro_id: '', erp_ultra_tab_pro_name: '',
};

// Short breadcrumb of whichever levels a Start/End point was tagged down
// to — same fields ErpLocationPicker writes, just rendered flat for the
// table column instead of as live dropdowns.
const pointLabel = (p) => {
  if (!p) return '—';
  const parts = [p.erp_user_name, p.erp_page_name, p.erp_sub_tab_name, p.erp_ultra_sub_tab_name, p.erp_ultra_tab_name, p.erp_ultra_tab_pro_name].filter(Boolean);
  return parts.length ? parts.join(' > ') : '—';
};

// Read-only task rows shown when a level's task-count badge is expanded —
// same fields as the internal task list elsewhere, minus Edit/Delete: this
// tab is for browsing what's tagged where, not managing individual tasks.
function TaskMiniList({ tasks, assigneeName, textPrimary, textSecondary, borderColor, bgCard, testPrefix }) {
  if (tasks.length === 0) {
    return <p className={`p-3 text-xs ${textSecondary}`}>No tasks tagged here yet.</p>;
  }
  return (
    <div className={`overflow-x-auto rounded-md border ${borderColor} ${bgCard}`}>
      <table className="w-full">
        <thead>
          <tr className={`border-b ${borderColor}`}>
            <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Task</th>
            <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Assigned To</th>
            <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Priority</th>
            <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.task_id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`${testPrefix}-${t.task_id}`}>
              <td className={`px-3 py-2 text-sm ${textPrimary}`}>{t.task_name}</td>
              <td className={`px-3 py-2 text-xs ${textSecondary}`}>{assigneeName(t.assigned_to)}</td>
              <td className={`px-3 py-2 text-xs ${textSecondary} capitalize`}>{t.priority || 'medium'}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${textSecondary} border ${borderColor}`}>
                  {(t.status || 'pending').replace('_', ' ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const summaryCard = (label, value, bgCard, borderColor, textSecondary, textPrimary, testId) => (
  <div className={`${bgCard} border ${borderColor} rounded-lg p-3`} data-testid={testId}>
    <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>{label}</p>
    <p className={`text-2xl font-bold mt-0.5 ${textPrimary}`}>{value}</p>
  </div>
);

/**
 * ERP project's "Workflow" tab — a project-scoped Workflow -> Sub Workflow
 * -> Sub Sub Workflow hierarchy tasks can be tagged with (from the ERP Task
 * modal, the Users tab's task modal, or the plain My Tasks modal). Mirrors
 * the ERP Users tab's own UI pattern: stat cards, a cascading filter row,
 * and a nested expandable table with a task-count badge at every level.
 */
export default function ProjectErpWorkflowTab({
  project,
  onProjectUpdated,
  onTasksChanged,
  canEdit,
  currentUser,
  isDark,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
  projectMembers = [],
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  const workflows = project?.erp_workflow || [];
  const tasks = project?.tasks || [];
  const tasksInWorkflow = (workflowId) => tasks.filter(t => t.workflow_id === workflowId);
  const tasksInSubWorkflow = (subWorkflowId) => tasks.filter(t => t.sub_workflow_id === subWorkflowId);
  const tasksInSubSubWorkflow = (subSubWorkflowId) => tasks.filter(t => t.sub_sub_workflow_id === subSubWorkflowId);
  const assigneeName = (uid) => projectMembers.find((m) => m.user_id === uid)?.name || uid || '—';

  const totalSubWorkflows = workflows.reduce((sum, w) => sum + (w.sub_workflows || []).length, 0);
  const totalSubSubWorkflows = workflows.reduce((sum, w) => sum + (w.sub_workflows || []).reduce((s2, sw) => s2 + (sw.sub_sub_workflows || []).length, 0), 0);
  const totalTaggedTasks = tasks.filter(t => t.workflow_id).length;

  // { mode: 'add' | 'edit', id, name }
  const [workflowModal, setWorkflowModal] = useState(null);
  const [saving, setSaving] = useState(false);

  // Sub Workflows / Sub Sub Workflows — nested under a workflow row, expand
  // to manage. Single expanded-id per level (like the ERP Users tab):
  // only one branch is ever open at a time, so no need to scope by parent.
  const [expandedWorkflowId, setExpandedWorkflowId] = useState(null);
  const [expandedSubWorkflowId, setExpandedSubWorkflowId] = useState(null);
  // { mode: 'add' | 'edit', workflowId, id, name }
  const [subWorkflowModal, setSubWorkflowModal] = useState(null);
  // { mode: 'add' | 'edit', workflowId, subWorkflowId, id, name }
  const [subSubWorkflowModal, setSubSubWorkflowModal] = useState(null);

  // Task-count badges — independent of the children-expand toggles above,
  // same as the ERP Users tab's Page/Sub Tab task badges.
  const [expandedWorkflowTasksId, setExpandedWorkflowTasksId] = useState(null);
  const [expandedSubWorkflowTasksId, setExpandedSubWorkflowTasksId] = useState(null);
  const [expandedSubSubWorkflowTasksId, setExpandedSubSubWorkflowTasksId] = useState(null);

  // Add Task, opened from any level's AddTaskButton below — pre-fills that
  // level's workflow/sub-workflow/sub-sub-workflow id+name (and every
  // ancestor's) into the shared ErpTaskModal, same pattern as the ERP Users
  // tab's own openAddTask. Not gated by canEdit — logging a task is a much
  // lower-risk action than editing the workflow structure itself.
  const [taskModal, setTaskModal] = useState(null);

  const openAddTask = (ctx) => {
    setTaskModal({
      task_name: '',
      priority: 'medium',
      erp_task_type: '',
      assigned_to: currentUser?.user_id || '',
      due_date: todayIso(),
      work_link: '',
      workflow_id: ctx.workflowId || '',
      workflow_name: ctx.workflowName || '',
      sub_workflow_id: ctx.subWorkflowId || '',
      sub_workflow_name: ctx.subWorkflowName || '',
      sub_sub_workflow_id: ctx.subSubWorkflowId || '',
      sub_sub_workflow_name: ctx.subSubWorkflowName || '',
      reference_image: '',
      voice_note: '',
    });
  };
  const closeTaskModal = () => setTaskModal(null);

  const AddTaskButton = ({ onClick, testId }) => (
    <button
      type="button"
      onClick={onClick}
      className="p-1 text-[#6366f1] hover:opacity-80"
      title="Add Task"
      data-testid={testId}
    >
      <Plus className="h-4 w-4" />
    </button>
  );

  // Cascading filter row, same shape as the Users tab's Department/User/
  // Page/... row — picking a level narrows the table to just that node
  // (and its ancestors) and auto-expands down to it.
  const [workflowSearch, setWorkflowSearch] = useState('');
  const [filterWorkflowId, setFilterWorkflowId] = useState('all');
  const [filterSubWorkflowId, setFilterSubWorkflowId] = useState('all');
  const [filterSubSubWorkflowId, setFilterSubSubWorkflowId] = useState('all');

  const persistWorkflow = async (next) => {
    try {
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { erp_workflow: next },
        { headers },
      );
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  const openAddWorkflow = () => {
    if (!canEdit) return;
    setWorkflowModal({
      mode: 'add', name: '', description: '', created_by: '', date: todayIso(),
      start_point: { ...emptyPoint }, end_point: { ...emptyPoint },
    });
  };
  const openEditWorkflow = (w) => {
    if (!canEdit) return;
    setWorkflowModal({
      mode: 'edit', id: w.id, name: w.name,
      description: w.description || '', created_by: w.created_by || '', date: w.date || todayIso(),
      start_point: { ...emptyPoint, ...(w.start_point || {}) },
      end_point: { ...emptyPoint, ...(w.end_point || {}) },
    });
  };
  const closeWorkflowModal = () => setWorkflowModal(null);

  const saveWorkflowModal = async () => {
    if (!workflowModal.name.trim()) { toast.error('Workflow name is required'); return; }
    setSaving(true);
    const trimmed = workflowModal.name.trim();
    const fields = {
      name: trimmed,
      description: workflowModal.description.trim(),
      created_by: workflowModal.created_by || '',
      date: workflowModal.date || todayIso(),
      start_point: workflowModal.start_point,
      end_point: workflowModal.end_point,
    };
    const next = workflowModal.mode === 'add'
      ? [...workflows, { id: newId('ewf'), ...fields }]
      : workflows.map(w => (w.id === workflowModal.id ? { ...w, ...fields } : w));
    const ok = await persistWorkflow(next);
    setSaving(false);
    if (ok) {
      toast.success(workflowModal.mode === 'add' ? 'Workflow added' : 'Workflow updated');
      closeWorkflowModal();
    }
  };

  const deleteWorkflow = async (workflowId) => {
    if (!canEdit) return;
    if (tasksInWorkflow(workflowId).length > 0) {
      toast.error('Cannot delete: tasks are tagged with this workflow. Untag them first.');
      return;
    }
    if (!window.confirm('Remove this workflow?')) return;
    const next = workflows.filter(w => w.id !== workflowId);
    const ok = await persistWorkflow(next);
    if (ok) toast.success('Workflow removed');
  };

  // Pinned workflows are stable-sorted to the front so their relative
  // order (among themselves, and among the unpinned rest) is preserved —
  // moveWorkflow only ever swaps within one of these two tiers so a pinned
  // row can never end up interleaved with unpinned ones.
  const sortedWorkflows = [...workflows].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const tierOf = (w) => sortedWorkflows.filter((x) => !!x.pinned === !!w.pinned);

  const moveWorkflow = async (workflowId, direction) => {
    if (!canEdit) return;
    const w = workflows.find((x) => x.id === workflowId);
    if (!w) return;
    const tier = tierOf(w);
    const idx = tier.findIndex((x) => x.id === workflowId);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= tier.length) return;
    const newTier = [...tier];
    [newTier[idx], newTier[targetIdx]] = [newTier[targetIdx], newTier[idx]];
    const otherTier = sortedWorkflows.filter((x) => !!x.pinned !== !!w.pinned);
    const next = w.pinned ? [...newTier, ...otherTier] : [...otherTier, ...newTier];
    await persistWorkflow(next);
  };

  const togglePinWorkflow = async (workflowId) => {
    if (!canEdit) return;
    const w = workflows.find((x) => x.id === workflowId);
    if (!w) return;
    if (!w.pinned && workflows.filter((x) => x.pinned).length >= MAX_PINNED_WORKFLOWS) {
      toast.error(`You can pin up to ${MAX_PINNED_WORKFLOWS} workflows — unpin one first.`);
      return;
    }
    const next = workflows.map((x) => (x.id === workflowId ? { ...x, pinned: !x.pinned } : x));
    const ok = await persistWorkflow(next);
    if (ok) toast.success(w.pinned ? 'Workflow unpinned' : 'Workflow pinned to top');
  };

  const openAddSubWorkflow = (workflowId) => {
    if (!canEdit) return;
    setSubWorkflowModal({ mode: 'add', workflowId, name: '' });
  };
  const openEditSubWorkflow = (workflowId, sw) => {
    if (!canEdit) return;
    setSubWorkflowModal({ mode: 'edit', workflowId, id: sw.id, name: sw.name });
  };
  const closeSubWorkflowModal = () => setSubWorkflowModal(null);

  const saveSubWorkflowModal = async () => {
    if (!subWorkflowModal.name.trim()) { toast.error('Sub workflow name is required'); return; }
    setSaving(true);
    const trimmed = subWorkflowModal.name.trim();
    const next = workflows.map((w) => {
      if (w.id !== subWorkflowModal.workflowId) return w;
      const subs = w.sub_workflows || [];
      const nextSubs = subWorkflowModal.mode === 'add'
        ? [...subs, { id: newId('esw'), name: trimmed }]
        : subs.map((sw) => (sw.id === subWorkflowModal.id ? { ...sw, name: trimmed } : sw));
      return { ...w, sub_workflows: nextSubs };
    });
    const ok = await persistWorkflow(next);
    setSaving(false);
    if (ok) {
      toast.success(subWorkflowModal.mode === 'add' ? 'Sub workflow added' : 'Sub workflow updated');
      closeSubWorkflowModal();
    }
  };

  const deleteSubWorkflow = async (workflowId, subWorkflowId) => {
    if (!canEdit) return;
    if (tasksInSubWorkflow(subWorkflowId).length > 0) {
      toast.error('Cannot delete: tasks are tagged with this sub workflow. Untag them first.');
      return;
    }
    if (!window.confirm('Remove this sub workflow?')) return;
    const next = workflows.map((w) => (
      w.id === workflowId ? { ...w, sub_workflows: (w.sub_workflows || []).filter((sw) => sw.id !== subWorkflowId) } : w
    ));
    const ok = await persistWorkflow(next);
    if (ok) toast.success('Sub workflow removed');
  };

  const openAddSubSubWorkflow = (workflowId, subWorkflowId) => {
    if (!canEdit) return;
    setSubSubWorkflowModal({ mode: 'add', workflowId, subWorkflowId, name: '' });
  };
  const openEditSubSubWorkflow = (workflowId, subWorkflowId, ssw) => {
    if (!canEdit) return;
    setSubSubWorkflowModal({ mode: 'edit', workflowId, subWorkflowId, id: ssw.id, name: ssw.name });
  };
  const closeSubSubWorkflowModal = () => setSubSubWorkflowModal(null);

  const saveSubSubWorkflowModal = async () => {
    if (!subSubWorkflowModal.name.trim()) { toast.error('Sub sub workflow name is required'); return; }
    setSaving(true);
    const trimmed = subSubWorkflowModal.name.trim();
    const next = workflows.map((w) => {
      if (w.id !== subSubWorkflowModal.workflowId) return w;
      const subs = (w.sub_workflows || []).map((sw) => {
        if (sw.id !== subSubWorkflowModal.subWorkflowId) return sw;
        const subSubs = sw.sub_sub_workflows || [];
        const nextSubSubs = subSubWorkflowModal.mode === 'add'
          ? [...subSubs, { id: newId('essw'), name: trimmed }]
          : subSubs.map((ssw) => (ssw.id === subSubWorkflowModal.id ? { ...ssw, name: trimmed } : ssw));
        return { ...sw, sub_sub_workflows: nextSubSubs };
      });
      return { ...w, sub_workflows: subs };
    });
    const ok = await persistWorkflow(next);
    setSaving(false);
    if (ok) {
      toast.success(subSubWorkflowModal.mode === 'add' ? 'Sub sub workflow added' : 'Sub sub workflow updated');
      closeSubSubWorkflowModal();
    }
  };

  const deleteSubSubWorkflow = async (workflowId, subWorkflowId, subSubWorkflowId) => {
    if (!canEdit) return;
    if (tasksInSubSubWorkflow(subSubWorkflowId).length > 0) {
      toast.error('Cannot delete: tasks are tagged with this sub sub workflow. Untag them first.');
      return;
    }
    if (!window.confirm('Remove this sub sub workflow?')) return;
    const next = workflows.map((w) => (
      w.id !== workflowId ? w : {
        ...w,
        sub_workflows: (w.sub_workflows || []).map((sw) => (
          sw.id !== subWorkflowId ? sw : { ...sw, sub_sub_workflows: (sw.sub_sub_workflows || []).filter((ssw) => ssw.id !== subSubWorkflowId) }
        )),
      }
    ));
    const ok = await persistWorkflow(next);
    if (ok) toast.success('Sub sub workflow removed');
  };

  // --- Cascading filter — narrows the table to one workflow (and, within
  // it, one sub workflow / sub sub workflow) and auto-expands down to it,
  // same UX as picking a level in the Users tab's filter row. ---
  const filterWorkflow = workflows.find((w) => w.id === filterWorkflowId);
  const filterSubWorkflows = filterWorkflow?.sub_workflows || [];
  const filterSubWorkflow = filterSubWorkflows.find((sw) => sw.id === filterSubWorkflowId);
  const filterSubSubWorkflows = filterSubWorkflow?.sub_sub_workflows || [];

  const handleFilterWorkflowChange = (v) => {
    setFilterWorkflowId(v);
    setFilterSubWorkflowId('all');
    setFilterSubSubWorkflowId('all');
    setExpandedWorkflowId(v === 'all' ? null : v);
    setExpandedSubWorkflowId(null);
  };
  const handleFilterSubWorkflowChange = (v) => {
    setFilterSubWorkflowId(v);
    setFilterSubSubWorkflowId('all');
    setExpandedSubWorkflowId(v === 'all' ? null : v);
  };

  const visibleWorkflows = sortedWorkflows
    .filter((w) => filterWorkflowId === 'all' || w.id === filterWorkflowId)
    .filter((w) => !workflowSearch.trim() || (w.name || '').toLowerCase().includes(workflowSearch.trim().toLowerCase()));

  return (
    <div className="space-y-3" data-testid="project-erp-workflow-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <WorkflowIcon className="h-5 w-5 text-[#6366f1]" /> Workflow
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            Named workflows tasks can be tagged with, from any task's create/edit form.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            onClick={openAddWorkflow}
            size="sm"
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="erp-workflow-add-btn"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Create Workflow
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCard('Workflows', workflows.length, bgCard, borderColor, textSecondary, textPrimary, 'erp-workflow-summary-workflows')}
        {summaryCard('Sub Workflows', totalSubWorkflows, bgCard, borderColor, textSecondary, textPrimary, 'erp-workflow-summary-subworkflows')}
        {summaryCard('Sub Sub Workflows', totalSubSubWorkflows, bgCard, borderColor, textSecondary, textPrimary, 'erp-workflow-summary-subsubworkflows')}
        {summaryCard('Tasks', totalTaggedTasks, bgCard, borderColor, textSecondary, textPrimary, 'erp-workflow-summary-tasks')}
      </div>

      {/* Cascading filter row — Workflow -> Sub Workflow -> Sub Sub Workflow,
          same pattern as the Users tab's Department/User/Page/... row. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${textSecondary}`} />
          <Input
            value={workflowSearch}
            onChange={(e) => setWorkflowSearch(e.target.value)}
            placeholder="Search workflows…"
            className={`pl-8 h-9 ${bgSecondary} border ${borderColor} ${textPrimary}`}
            data-testid="erp-workflow-search"
          />
        </div>
        <Select value={filterWorkflowId} onValueChange={handleFilterWorkflowChange}>
          <SelectTrigger className={`w-[180px] h-9 ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-workflow-filter-workflow">
            <SelectValue placeholder="All Workflows" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workflows</SelectItem>
            {workflows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {filterSubWorkflows.length > 0 && (
          <Select value={filterSubWorkflowId} onValueChange={handleFilterSubWorkflowChange}>
            <SelectTrigger className={`w-[180px] h-9 ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-workflow-filter-subworkflow">
              <SelectValue placeholder="All Sub Workflows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sub Workflows</SelectItem>
              {filterSubWorkflows.map((sw) => <SelectItem key={sw.id} value={sw.id}>{sw.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {filterSubSubWorkflows.length > 0 && (
          <Select value={filterSubSubWorkflowId} onValueChange={setFilterSubSubWorkflowId}>
            <SelectTrigger className={`w-[180px] h-9 ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-workflow-filter-subsubworkflow">
              <SelectValue placeholder="All Sub Sub Workflows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sub Sub Workflows</SelectItem>
              {filterSubSubWorkflows.map((ssw) => <SelectItem key={ssw.id} value={ssw.id}>{ssw.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-16`}>S.No</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Workflow Name</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Created By</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Date</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Start Point</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>End Point</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Tasks</th>
                  {/* Sticky: 3 action icons (Pin/Edit/Delete) plus the new
                      reorder arrows in S.No made this table wide enough that
                      Actions could scroll out of view on narrower windows —
                      pin it to the visible edge instead of letting it hide. */}
                  <th className={`sticky right-0 ${bgCard} text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleWorkflows.map((w, idx) => {
                  const count = tasksInWorkflow(w.id).length;
                  const creator = projectMembers.find(m => m.user_id === w.created_by);
                  const subWorkflows = w.sub_workflows || [];
                  const isExpanded = expandedWorkflowId === w.id;
                  const isTasksExpanded = expandedWorkflowTasksId === w.id;
                  const tier = tierOf(w);
                  const tierIdx = tier.findIndex((x) => x.id === w.id);
                  const canMoveUp = tierIdx > 0;
                  const canMoveDown = tierIdx < tier.length - 1;
                  return (
                    <React.Fragment key={w.id}>
                      <tr className={`border-b ${borderColor}`} data-testid={`erp-workflow-row-${w.id}`}>
                        <td className={`p-3 text-left text-xs ${textSecondary}`}>
                          <div className="flex items-center gap-1.5">
                            {canEdit && (
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => moveWorkflow(w.id, -1)}
                                  disabled={!canMoveUp}
                                  className={`${textSecondary} hover:opacity-70 disabled:opacity-20 disabled:cursor-not-allowed leading-none`}
                                  title="Move up"
                                  data-testid={`erp-workflow-moveup-${w.id}`}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveWorkflow(w.id, 1)}
                                  disabled={!canMoveDown}
                                  className={`${textSecondary} hover:opacity-70 disabled:opacity-20 disabled:cursor-not-allowed leading-none`}
                                  title="Move down"
                                  data-testid={`erp-workflow-movedown-${w.id}`}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                            <span>{idx + 1}</span>
                          </div>
                        </td>
                        <td className={`p-3 text-left text-sm font-medium ${textPrimary}`}>
                          <button
                            type="button"
                            onClick={() => setExpandedWorkflowId(isExpanded ? null : w.id)}
                            className="inline-flex items-center gap-1.5 hover:opacity-80"
                            data-testid={`erp-workflow-toggle-${w.id}`}
                          >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            {w.name || '—'}
                            {w.pinned && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded px-1 py-0.5">
                                <Pin className="h-2.5 w-2.5" /> Pinned
                              </span>
                            )}
                          </button>
                          {w.description && <p className={`text-xs font-normal ${textSecondary} mt-0.5 pl-5`}>{w.description}</p>}
                        </td>
                        <td className={`p-3 text-left text-xs ${textSecondary}`}>{creator?.name || '—'}</td>
                        <td className={`p-3 text-left text-xs ${textSecondary}`}>{w.date || '—'}</td>
                        <td className="p-3 text-left" data-testid={`erp-workflow-startpoint-${w.id}`}>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                            <Flag className="h-3 w-3" /> {pointLabel(w.start_point)}
                          </span>
                        </td>
                        <td className="p-3 text-left" data-testid={`erp-workflow-endpoint-${w.id}`}>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-rose-500/30 bg-rose-500/10 text-rose-600">
                            <CheckCircle2 className="h-3 w-3" /> {pointLabel(w.end_point)}
                          </span>
                        </td>
                        <td className="p-3 text-left">
                          <div className="inline-flex items-center gap-1">
                            <ErpTaskCountBadge
                              count={count}
                              active={isTasksExpanded}
                              onClick={() => setExpandedWorkflowTasksId(isTasksExpanded ? null : w.id)}
                              textSecondary={textSecondary}
                              testId={`erp-workflow-tasks-toggle-${w.id}`}
                            />
                            <AddTaskButton
                              onClick={() => openAddTask({ workflowId: w.id, workflowName: w.name })}
                              testId={`erp-workflow-addtask-${w.id}`}
                            />
                          </div>
                        </td>
                        <td className={`sticky right-0 ${bgCard} p-3 text-right`}>
                          <div className="inline-flex gap-1">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => togglePinWorkflow(w.id)}
                                className={`p-1 hover:opacity-80 ${w.pinned ? 'text-amber-500' : textSecondary}`}
                                title={w.pinned ? 'Unpin' : `Pin to top (max ${MAX_PINNED_WORKFLOWS})`}
                                data-testid={`erp-workflow-pin-${w.id}`}
                              >
                                <Pin className={`h-4 w-4 ${w.pinned ? 'fill-amber-500' : ''}`} />
                              </button>
                            )}
                            {canEdit && (
                              <button type="button" onClick={() => openEditWorkflow(w)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Rename" data-testid={`erp-workflow-edit-${w.id}`}>
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => deleteWorkflow(w.id)}
                                disabled={count > 0}
                                className={`p-1 ${count > 0 ? 'text-red-500/30 cursor-not-allowed' : 'text-red-500 hover:text-red-400'}`}
                                title={count > 0 ? 'Cannot delete: tasks are tagged with this workflow' : 'Delete'}
                                data-testid={`erp-workflow-delete-${w.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isTasksExpanded && (
                        <tr className={`border-b ${borderColor}`} data-testid={`erp-workflow-tasks-row-${w.id}`}>
                          <td colSpan={8} className="p-3">
                            <TaskMiniList
                              tasks={tasksInWorkflow(w.id)}
                              assigneeName={assigneeName}
                              textPrimary={textPrimary}
                              textSecondary={textSecondary}
                              borderColor={borderColor}
                              bgCard={bgCard}
                              testPrefix="erp-workflow-task-row"
                            />
                          </td>
                        </tr>
                      )}

                      {isExpanded && (
                        <tr className={`border-b ${borderColor} ${bgSecondary}`} data-testid={`erp-workflow-subworkflows-row-${w.id}`}>
                          <td colSpan={8} className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className={`text-xs font-semibold uppercase tracking-wide ${textSecondary}`}>Sub Workflows</p>
                              {canEdit && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => openAddSubWorkflow(w.id)}
                                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-7 text-xs"
                                  data-testid={`erp-subworkflow-add-btn-${w.id}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Add Sub Workflow
                                </Button>
                              )}
                            </div>
                            {subWorkflows.length === 0 ? (
                              <p className={`text-xs ${textSecondary}`}>No sub workflows yet.</p>
                            ) : (
                              <div className={`rounded-md border ${borderColor} ${bgCard}`}>
                                {subWorkflows
                                  .filter((sw) => filterSubWorkflowId === 'all' || sw.id === filterSubWorkflowId)
                                  .map((sw) => {
                                    const swCount = tasksInSubWorkflow(sw.id).length;
                                    const subSubWorkflows = sw.sub_sub_workflows || [];
                                    const isSwExpanded = expandedSubWorkflowId === sw.id;
                                    const isSwTasksExpanded = expandedSubWorkflowTasksId === sw.id;
                                    return (
                                      <div key={sw.id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`erp-subworkflow-row-${sw.id}`}>
                                        <div className="flex items-center justify-between px-3 py-2">
                                          <button
                                            type="button"
                                            onClick={() => setExpandedSubWorkflowId(isSwExpanded ? null : sw.id)}
                                            className={`inline-flex items-center gap-1.5 text-sm ${textPrimary} hover:opacity-80`}
                                            data-testid={`erp-subworkflow-toggle-${sw.id}`}
                                          >
                                            {isSwExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                            {sw.name}
                                          </button>
                                          <div className="flex items-center gap-1">
                                            <ErpTaskCountBadge
                                              count={swCount}
                                              active={isSwTasksExpanded}
                                              onClick={() => setExpandedSubWorkflowTasksId(isSwTasksExpanded ? null : sw.id)}
                                              textSecondary={textSecondary}
                                              testId={`erp-subworkflow-tasks-toggle-${sw.id}`}
                                            />
                                            <AddTaskButton
                                              onClick={() => openAddTask({ workflowId: w.id, workflowName: w.name, subWorkflowId: sw.id, subWorkflowName: sw.name })}
                                              testId={`erp-subworkflow-addtask-${sw.id}`}
                                            />
                                            {canEdit && (
                                              <button type="button" onClick={() => openEditSubWorkflow(w.id, sw)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Rename" data-testid={`erp-subworkflow-edit-${sw.id}`}>
                                                <Pencil className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                            {canEdit && (
                                              <button
                                                type="button"
                                                onClick={() => deleteSubWorkflow(w.id, sw.id)}
                                                disabled={swCount > 0}
                                                className={`p-1 ${swCount > 0 ? 'text-red-500/30 cursor-not-allowed' : 'text-red-500 hover:text-red-400'}`}
                                                title={swCount > 0 ? 'Cannot delete: tasks are tagged with this sub workflow' : 'Delete'}
                                                data-testid={`erp-subworkflow-delete-${sw.id}`}
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {isSwTasksExpanded && (
                                          <div className="px-3 pb-3">
                                            <TaskMiniList
                                              tasks={tasksInSubWorkflow(sw.id)}
                                              assigneeName={assigneeName}
                                              textPrimary={textPrimary}
                                              textSecondary={textSecondary}
                                              borderColor={borderColor}
                                              bgCard={bgCard}
                                              testPrefix="erp-subworkflow-task-row"
                                            />
                                          </div>
                                        )}

                                        {isSwExpanded && (
                                          <div className={`pl-6 pr-3 pb-3 ${bgSecondary}`}>
                                            <div className="flex items-center justify-between mb-2 pt-2">
                                              <p className={`text-[11px] font-semibold uppercase tracking-wide ${textSecondary}`}>Sub Sub Workflows</p>
                                              {canEdit && (
                                                <Button
                                                  type="button"
                                                  size="sm"
                                                  onClick={() => openAddSubSubWorkflow(w.id, sw.id)}
                                                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-6 text-[11px] px-2"
                                                  data-testid={`erp-subsubworkflow-add-btn-${sw.id}`}
                                                >
                                                  <Plus className="h-3 w-3 mr-1" /> Add Sub Sub Workflow
                                                </Button>
                                              )}
                                            </div>
                                            {subSubWorkflows.length === 0 ? (
                                              <p className={`text-xs ${textSecondary}`}>No sub sub workflows yet.</p>
                                            ) : (
                                              <div className={`rounded-md border ${borderColor} ${bgCard}`}>
                                                {subSubWorkflows
                                                  .filter((ssw) => filterSubSubWorkflowId === 'all' || ssw.id === filterSubSubWorkflowId)
                                                  .map((ssw) => {
                                                    const sswCount = tasksInSubSubWorkflow(ssw.id).length;
                                                    const isSswTasksExpanded = expandedSubSubWorkflowTasksId === ssw.id;
                                                    return (
                                                      <div key={ssw.id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`erp-subsubworkflow-row-${ssw.id}`}>
                                                        <div className="flex items-center justify-between px-3 py-1.5">
                                                          <span className={`text-xs ${textPrimary}`}>{ssw.name}</span>
                                                          <div className="flex items-center gap-1">
                                                            <ErpTaskCountBadge
                                                              count={sswCount}
                                                              active={isSswTasksExpanded}
                                                              onClick={() => setExpandedSubSubWorkflowTasksId(isSswTasksExpanded ? null : ssw.id)}
                                                              textSecondary={textSecondary}
                                                              testId={`erp-subsubworkflow-tasks-toggle-${ssw.id}`}
                                                            />
                                                            <AddTaskButton
                                                              onClick={() => openAddTask({ workflowId: w.id, workflowName: w.name, subWorkflowId: sw.id, subWorkflowName: sw.name, subSubWorkflowId: ssw.id, subSubWorkflowName: ssw.name })}
                                                              testId={`erp-subsubworkflow-addtask-${ssw.id}`}
                                                            />
                                                            {canEdit && (
                                                              <button type="button" onClick={() => openEditSubSubWorkflow(w.id, sw.id, ssw)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Rename" data-testid={`erp-subsubworkflow-edit-${ssw.id}`}>
                                                                <Pencil className="h-3 w-3" />
                                                              </button>
                                                            )}
                                                            {canEdit && (
                                                              <button
                                                                type="button"
                                                                onClick={() => deleteSubSubWorkflow(w.id, sw.id, ssw.id)}
                                                                disabled={sswCount > 0}
                                                                className={`p-1 ${sswCount > 0 ? 'text-red-500/30 cursor-not-allowed' : 'text-red-500 hover:text-red-400'}`}
                                                                title={sswCount > 0 ? 'Cannot delete: tasks are tagged with this sub sub workflow' : 'Delete'}
                                                                data-testid={`erp-subsubworkflow-delete-${ssw.id}`}
                                                              >
                                                                <Trash2 className="h-3 w-3" />
                                                              </button>
                                                            )}
                                                          </div>
                                                        </div>
                                                        {isSswTasksExpanded && (
                                                          <div className="px-3 pb-2">
                                                            <TaskMiniList
                                                              tasks={tasksInSubSubWorkflow(ssw.id)}
                                                              assigneeName={assigneeName}
                                                              textPrimary={textPrimary}
                                                              textSecondary={textSecondary}
                                                              borderColor={borderColor}
                                                              bgCard={bgCard}
                                                              testPrefix="erp-subsubworkflow-task-row"
                                                            />
                                                          </div>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {visibleWorkflows.length === 0 && (
                  <tr>
                    <td colSpan={8} className={`p-8 text-center text-xs ${textSecondary}`}>
                      {workflows.length === 0
                        ? <>No workflows yet. {canEdit && <span>Click <span className="font-medium">Create Workflow</span> to add one.</span>}</>
                        : 'No workflows match the current filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Rename Workflow popup */}
      {workflowModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeWorkflowModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <WorkflowIcon className="h-4 w-4 text-[#6366f1]" />
                {workflowModal.mode === 'add' ? 'Create Workflow' : 'Rename Workflow'}
              </h3>
              <button onClick={closeWorkflowModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Workflow Name</p>
                <Input
                  value={workflowModal.name}
                  onChange={(e) => setWorkflowModal(m => ({ ...m, name: e.target.value }))}
                  placeholder="e.g. Onboarding Flow"
                  className={`h-12 text-base ${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="erp-workflow-form-name"
                  autoFocus
                />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Description</p>
                <Textarea
                  value={workflowModal.description}
                  onChange={(e) => setWorkflowModal(m => ({ ...m, description: e.target.value }))}
                  placeholder="What this workflow is for…"
                  rows={3}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary} resize-none`}
                  data-testid="erp-workflow-form-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>Created By</p>
                  <Select
                    value={workflowModal.created_by || '_none'}
                    onValueChange={(v) => setWorkflowModal(m => ({ ...m, created_by: v === '_none' ? '' : v }))}
                  >
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-workflow-form-created-by">
                      <SelectValue placeholder="— Select —" />
                    </SelectTrigger>
                    {/* z-[80]: this modal's backdrop is z-[70], above the
                        Select's default z-50 portal — without this the
                        dropdown opened but rendered invisibly behind it. */}
                    <SelectContent className="z-[80]">
                      <SelectItem value="_none">— Select —</SelectItem>
                      {projectMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className={`text-xs font-medium ${textSecondary} mb-1`}>Date</p>
                  <Input
                    type="date"
                    value={workflowModal.date}
                    onChange={(e) => setWorkflowModal(m => ({ ...m, date: e.target.value }))}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                    data-testid="erp-workflow-form-date"
                  />
                </div>
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-2`}>Start Point</p>
                <ErpLocationPicker
                  project={project}
                  value={workflowModal.start_point}
                  onChange={(loc) => setWorkflowModal(m => ({ ...m, start_point: loc }))}
                  bgSecondary={bgSecondary}
                  borderColor={borderColor}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  testPrefix="erp-workflow-startpoint"
                />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-2`}>End Point</p>
                <ErpLocationPicker
                  project={project}
                  value={workflowModal.end_point}
                  onChange={(loc) => setWorkflowModal(m => ({ ...m, end_point: loc }))}
                  bgSecondary={bgSecondary}
                  borderColor={borderColor}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  testPrefix="erp-workflow-endpoint"
                />
              </div>
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={closeWorkflowModal}>Cancel</Button>
              <Button
                type="button"
                onClick={saveWorkflowModal}
                disabled={saving}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="erp-workflow-form-save"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Rename Sub Workflow popup */}
      {subWorkflowModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeSubWorkflowModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <WorkflowIcon className="h-4 w-4 text-[#6366f1]" />
                {subWorkflowModal.mode === 'add' ? 'Add Sub Workflow' : 'Rename Sub Workflow'}
              </h3>
              <button onClick={closeSubWorkflowModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Sub Workflow Name</p>
              <Input
                value={subWorkflowModal.name}
                onChange={(e) => setSubWorkflowModal(m => ({ ...m, name: e.target.value }))}
                placeholder="e.g. Consultation"
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="erp-subworkflow-form-name"
                autoFocus
              />
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={closeSubWorkflowModal}>Cancel</Button>
              <Button
                type="button"
                onClick={saveSubWorkflowModal}
                disabled={saving}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="erp-subworkflow-form-save"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Rename Sub Sub Workflow popup */}
      {subSubWorkflowModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeSubSubWorkflowModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <WorkflowIcon className="h-4 w-4 text-[#6366f1]" />
                {subSubWorkflowModal.mode === 'add' ? 'Add Sub Sub Workflow' : 'Rename Sub Sub Workflow'}
              </h3>
              <button onClick={closeSubSubWorkflowModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Sub Sub Workflow Name</p>
              <Input
                value={subSubWorkflowModal.name}
                onChange={(e) => setSubSubWorkflowModal(m => ({ ...m, name: e.target.value }))}
                placeholder="e.g. Follow-up Call"
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="erp-subsubworkflow-form-name"
                autoFocus
              />
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={closeSubSubWorkflowModal}>Cancel</Button>
              <Button
                type="button"
                onClick={saveSubSubWorkflowModal}
                disabled={saving}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="erp-subsubworkflow-form-save"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {taskModal && (
        <ErpTaskModal
          project={project}
          projectMembers={projectMembers}
          currentUser={currentUser}
          headers={headers}
          taskId={null}
          initialDraft={taskModal}
          onClose={closeTaskModal}
          onSaved={onTasksChanged}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />
      )}
    </div>
  );
}
