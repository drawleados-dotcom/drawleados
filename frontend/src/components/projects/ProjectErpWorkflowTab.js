import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, Pencil, X, Workflow as WorkflowIcon, ListChecks } from 'lucide-react';
import ErpLocationPicker from './ErpLocationPicker';

const todayIso = () => new Date().toISOString().slice(0, 10);

const API = process.env.REACT_APP_BACKEND_URL;

const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

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

/**
 * ERP project's "Workflow" tab — a project-scoped list of named workflows
 * that tasks can be tagged with (from the ERP Task modal, the Users tab's
 * task modal, or the plain My Tasks modal). This tab only manages the
 * workflow list itself; tagging happens where tasks are created/edited.
 */
export default function ProjectErpWorkflowTab({
  project,
  onProjectUpdated,
  canEdit,
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

  // { mode: 'add' | 'edit', id, name }
  const [workflowModal, setWorkflowModal] = useState(null);
  const [saving, setSaving] = useState(false);

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

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-12`}>S.No</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Workflow Name</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Created By</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Date</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Start Point</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>End Point</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Tasks</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((w, idx) => {
                  const count = tasksInWorkflow(w.id).length;
                  const creator = projectMembers.find(m => m.user_id === w.created_by);
                  return (
                    <tr key={w.id} className={`border-b ${borderColor}`} data-testid={`erp-workflow-row-${w.id}`}>
                      <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                      <td className={`p-3 text-sm font-medium ${textPrimary}`}>
                        {w.name || '—'}
                        {w.description && <p className={`text-xs font-normal ${textSecondary} mt-0.5`}>{w.description}</p>}
                      </td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{creator?.name || '—'}</td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{w.date || '—'}</td>
                      <td className={`p-3 text-xs ${textSecondary}`} data-testid={`erp-workflow-startpoint-${w.id}`}>{pointLabel(w.start_point)}</td>
                      <td className={`p-3 text-xs ${textSecondary}`} data-testid={`erp-workflow-endpoint-${w.id}`}>{pointLabel(w.end_point)}</td>
                      <td className={`p-3 text-xs ${textSecondary}`}>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${bgSecondary}`}>
                          <ListChecks className="h-3 w-3" /> {count}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1">
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
                  );
                })}
                {workflows.length === 0 && (
                  <tr>
                    <td colSpan={8} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No workflows yet. {canEdit && <span>Click <span className="font-medium">Create Workflow</span> to add one.</span>}
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
                    <SelectContent>
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
    </div>
  );
}
