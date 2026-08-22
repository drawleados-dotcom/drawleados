import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2, Pencil, X, Workflow as WorkflowIcon, ListChecks } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

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

  const openAddWorkflow = () => { if (canEdit) setWorkflowModal({ mode: 'add', name: '' }); };
  const openEditWorkflow = (w) => { if (canEdit) setWorkflowModal({ mode: 'edit', id: w.id, name: w.name }); };
  const closeWorkflowModal = () => setWorkflowModal(null);

  const saveWorkflowModal = async () => {
    if (!workflowModal.name.trim()) { toast.error('Workflow name is required'); return; }
    setSaving(true);
    const trimmed = workflowModal.name.trim();
    const next = workflowModal.mode === 'add'
      ? [...workflows, { id: newId('ewf'), name: trimmed }]
      : workflows.map(w => (w.id === workflowModal.id ? { ...w, name: trimmed } : w));
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
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Tasks</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((w, idx) => {
                  const count = tasksInWorkflow(w.id).length;
                  return (
                    <tr key={w.id} className={`border-b ${borderColor}`} data-testid={`erp-workflow-row-${w.id}`}>
                      <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                      <td className={`p-3 text-sm font-medium ${textPrimary}`}>{w.name || '—'}</td>
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
                    <td colSpan={4} className={`p-8 text-center text-xs ${textSecondary}`}>
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
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <WorkflowIcon className="h-4 w-4 text-[#6366f1]" />
                {workflowModal.mode === 'add' ? 'Create Workflow' : 'Rename Workflow'}
              </h3>
              <button onClick={closeWorkflowModal} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Workflow Name</p>
              <Input
                value={workflowModal.name}
                onChange={(e) => setWorkflowModal(m => ({ ...m, name: e.target.value }))}
                placeholder="e.g. Onboarding Flow"
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="erp-workflow-form-name"
                autoFocus
              />
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
