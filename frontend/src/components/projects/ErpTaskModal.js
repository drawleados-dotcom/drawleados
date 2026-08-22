import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ListChecks, X } from 'lucide-react';
import { buildErpPrompt } from '../../utils/erpPrompt';
import { ERP_TASK_TYPE_OPTIONS } from '../../utils/erpTaskTypes';
import ErpLocationPicker from './ErpLocationPicker';

const API = process.env.REACT_APP_BACKEND_URL;

const emptyLocation = {
  erp_user_id: '', erp_user_name: '',
  erp_page_id: '', erp_page_name: '',
  erp_sub_tab_id: '', erp_sub_tab_name: '',
  erp_ultra_sub_tab_id: '', erp_ultra_sub_tab_name: '',
  erp_ultra_tab_id: '', erp_ultra_tab_name: '',
};

/**
 * Add/Edit popup for a task tagged to a project's ERP Users hierarchy —
 * shared by the ERP Users tab (opened from a row's Add Task/Edit action,
 * pre-filled to that row's place in the tree) and the Project's own Tasks
 * tab (opened either blank or pre-filled from an existing ERP-tagged task,
 * letting it be edited/relocated without leaving that tab). `taskId` null
 * means add mode (POST); a task_id means edit mode (PUT) — changing the
 * Location picker on an existing task is how it gets moved to a different
 * user/page/sub-tab, replacing any separate "move" control.
 */
export default function ErpTaskModal({
  project, projectMembers, currentUser, headers,
  taskId = null,
  initialLocation = emptyLocation,
  initialDraft,
  onClose, onSaved,
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const [location, setLocation] = useState({ ...emptyLocation, ...initialLocation });
  const [draft, setDraft] = useState(initialDraft || {
    task_name: '',
    priority: 'medium',
    erp_task_type: '',
    assigned_to: currentUser?.user_id || '',
    due_date: new Date().toISOString().slice(0, 10),
    work_link: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!draft.task_name.trim()) { toast.error('Task name is required'); return; }
    setSaving(true);
    const payload = {
      task_name: draft.task_name.trim(),
      priority: draft.priority,
      assigned_to: draft.assigned_to || currentUser?.user_id,
      due_date: draft.due_date || null,
      work_link: draft.work_link || '',
      department: 'erp',
      project_id: project.project_id,
      project_name: project.name,
      ...location,
      erp_task_type: draft.erp_task_type || '',
    };
    try {
      if (taskId) {
        await axios.put(`${API}/api/our-tasks/tasks/${taskId}`, payload, { headers });
        toast.success('Task updated');
      } else {
        await axios.post(`${API}/api/our-tasks/tasks`, { ...payload, type: 'general', status: 'pending' }, { headers });
        toast.success('Task added');
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    // z-40, not z-[70]: the selects below portal to document.body at z-50 (ui/select.jsx).
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
          <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
            <ListChecks className="h-4 w-4 text-[#6366f1]" /> {taskId ? 'Edit Task' : 'Add Task'}
          </h3>
          <button onClick={onClose} className={textSecondary}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className={`text-xs font-medium ${textSecondary} mb-1`}>Task Name</p>
            <Input
              value={draft.task_name}
              onChange={(e) => setDraft(d => ({ ...d, task_name: e.target.value }))}
              placeholder="e.g. Fix validation on Save button"
              className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
              data-testid="erp-quicktask-form-name"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Priority</p>
              <Select
                value={draft.priority}
                onValueChange={(v) => setDraft(d => ({ ...d, priority: v }))}
              >
                <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-quicktask-form-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Type</p>
              <Select
                value={draft.erp_task_type || '_none'}
                onValueChange={(v) => setDraft(d => ({ ...d, erp_task_type: v === '_none' ? '' : v }))}
              >
                <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-quicktask-form-type">
                  <SelectValue placeholder="— Select type —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Select type —</SelectItem>
                  {ERP_TASK_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Assign To</p>
              <Select
                value={draft.assigned_to || '_none'}
                onValueChange={(v) => setDraft(d => ({ ...d, assigned_to: v === '_none' ? '' : v }))}
              >
                <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="erp-quicktask-form-assignee">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {(projectMembers || []).map(usr => <SelectItem key={usr.user_id} value={usr.user_id}>{usr.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Due Date</p>
              <Input
                type="date"
                value={draft.due_date}
                onChange={(e) => setDraft(d => ({ ...d, due_date: e.target.value }))}
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="erp-quicktask-form-due-date"
              />
            </div>
          </div>
          <div>
            <p className={`text-xs font-medium ${textSecondary} mb-1`}>Work Link</p>
            <Input
              value={draft.work_link}
              onChange={(e) => setDraft(d => ({ ...d, work_link: e.target.value }))}
              placeholder="https://…"
              className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
              data-testid="erp-quicktask-form-worklink"
            />
          </div>
          <div>
            <p className={`text-xs font-medium ${textSecondary} mb-2`}>Location {taskId && <span className={textSecondary}>— change these to move the task</span>}</p>
            <ErpLocationPicker
              project={project}
              value={location}
              onChange={setLocation}
              bgSecondary={bgSecondary}
              borderColor={borderColor}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              testPrefix="erp-quicktask-location"
            />
          </div>
          {/* Live breadcrumb — shows exactly where in the hierarchy this task is tagged */}
          <div className={`p-4 rounded-lg border ${borderColor} ${bgSecondary}`} data-testid="erp-quicktask-prompt">
            <p className={`text-xs font-medium ${textSecondary} mb-2`}>Prompt</p>
            <p className={`text-sm ${textPrimary} break-words`}>
              {buildErpPrompt({
                projectName: project?.name,
                userName: location.erp_user_name,
                pageName: location.erp_page_name,
                subTabName: location.erp_sub_tab_name,
                ultraSubTabName: location.erp_ultra_sub_tab_name,
                ultraTabName: location.erp_ultra_tab_name,
                taskName: draft.task_name,
              })}
            </p>
          </div>
        </div>
        <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            onClick={submit}
            disabled={saving}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="erp-quicktask-form-save"
          >
            {saving ? 'Saving…' : (taskId ? 'Save Changes' : 'Add Task')}
          </Button>
        </div>
      </div>
    </div>
  );
}
