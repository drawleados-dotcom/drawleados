import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ListChecks, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export const PAGE_TASK_TYPE_OPTIONS = ['New Design', 'Corrections', 'Responsive', 'Testing', 'Feature', 'Redesign', 'Other'];

/**
 * Add popup for a task tagged to a website project's Page (and, optionally,
 * one of that page's Sections) — opened from the Pages tab's per-row Add
 * Task button, pre-filled with that page/section's id+name. Same auto-save
 * architecture as the ERP Users tab's ErpTaskModal (debounced PUT/POST as
 * you type, flushed on close) but with this domain's own field set instead
 * of ERP's location/workflow fields: Description and a fixed Task Type
 * list (stored in the existing free-text `category` field, which the Pages
 * tab's task list already displays — a custom "Other" type is just typed
 * straight into `category` too, so no separate field is needed for it).
 */
export default function PageTaskModal({
  project, projectMembers, currentUser, headers,
  pageId, pageName, sectionId, sectionName,
  onClose, onSaved,
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const [draft, setDraft] = useState({
    task_name: '',
    description: '',
    due_date: '',
    category: '',
    priority: 'medium',
    assigned_to: currentUser?.user_id || '',
  });
  // Task Type select shows one of the fixed options, or "Other" — the
  // custom text (when "Other" is picked) is what actually lands in
  // draft.category, so this is purely local UI state to drive the select.
  const [taskTypeChoice, setTaskTypeChoice] = useState('');
  const [otherText, setOtherText] = useState('');
  const [saving, setSaving] = useState(false);

  const [activeTaskId, setActiveTaskId] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const debounceRef = useRef(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);

  const buildPayload = () => ({
    task_name: draft.task_name.trim(),
    description: draft.description || '',
    due_date: draft.due_date || null,
    category: draft.category || '',
    priority: draft.priority,
    assigned_to: draft.assigned_to || currentUser?.user_id,
    department: 'website',
    project_id: project.project_id,
    project_name: project.name,
    website_page_id: pageId || null,
    website_page_name: pageName || null,
    page_section_id: sectionId || null,
    page_section_name: sectionName || null,
  });

  const doSave = async () => {
    if (!draft.task_name.trim()) return;
    if (savingRef.current) { pendingRef.current = true; return; }
    savingRef.current = true;
    setAutoSaveStatus('saving');
    try {
      if (activeTaskId) {
        await axios.put(`${API}/api/our-tasks/tasks/${activeTaskId}`, buildPayload(), { headers });
      } else {
        const res = await axios.post(`${API}/api/our-tasks/tasks`, { ...buildPayload(), type: 'general', status: 'pending' }, { headers });
        setActiveTaskId(res.data.task_id);
      }
      setAutoSaveStatus('saved');
      onSaved?.();
    } catch (e) {
      setAutoSaveStatus('idle');
      pendingRef.current = false;
      throw e;
    } finally {
      savingRef.current = false;
    }
    if (pendingRef.current) { pendingRef.current = false; await doSave(); }
  };

  const skipFirstRef = useRef(true);
  useEffect(() => {
    if (skipFirstRef.current) { skipFirstRef.current = false; return; }
    if (!draft.task_name.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSave().catch(() => toast.error('Failed to auto-save task'));
    }, 900);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const flushAndClose = () => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (draft.task_name.trim()) {
      doSave().catch(() => toast.error('Failed to save task'));
    }
    onClose?.();
  };

  const taskNameRef = useRef(null);
  useEffect(() => {
    const el = taskNameRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.task_name]);

  const submit = async () => {
    if (!draft.task_name.trim()) { toast.error('Task name is required'); return; }
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    setSaving(true);
    while (savingRef.current) { await new Promise(r => setTimeout(r, 150)); }
    const wasCreate = !activeTaskId;
    try {
      await doSave();
      toast.success(wasCreate ? 'Task added' : 'Task updated');
      onClose?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    // z-40, not z-[70]: the selects below portal to document.body at z-50 (ui/select.jsx).
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={flushAndClose}>
      <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
          <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
            <ListChecks className="h-4 w-4 text-[#6366f1]" /> Add Task
            {autoSaveStatus === 'saving' && <span className={`text-xs font-normal ${textSecondary}`}>· Saving…</span>}
            {autoSaveStatus === 'saved' && <span className="text-xs font-normal text-[#10b981]">· Saved</span>}
          </h3>
          <button onClick={flushAndClose} className={textSecondary} data-testid="page-quicktask-form-close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>
              {sectionName ? `${pageName} — ${sectionName}` : pageName}
            </p>
          </div>
          <div>
            <p className={`text-xs font-medium ${textSecondary} mb-1`}>Task Name</p>
            <Textarea
              ref={taskNameRef}
              value={draft.task_name}
              onChange={(e) => setDraft(d => ({ ...d, task_name: e.target.value }))}
              placeholder="e.g. Redesign hero section"
              rows={1}
              className={`${bgSecondary} border ${borderColor} ${textPrimary} min-h-[36px] py-2 resize-none overflow-hidden leading-normal`}
              data-testid="page-quicktask-form-name"
              autoFocus
            />
          </div>
          <div>
            <p className={`text-xs font-medium ${textSecondary} mb-1`}>Description</p>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="Details about what needs to be done…"
              rows={3}
              className={`${bgSecondary} border ${borderColor} ${textPrimary} resize-none`}
              data-testid="page-quicktask-form-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Priority</p>
              <Select
                value={draft.priority}
                onValueChange={(v) => setDraft(d => ({ ...d, priority: v }))}
              >
                <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="page-quicktask-form-priority">
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
              <p className={`text-xs font-medium ${textSecondary} mb-1`}>Deadline</p>
              <Input
                type="date"
                value={draft.due_date}
                onChange={(e) => setDraft(d => ({ ...d, due_date: e.target.value }))}
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="page-quicktask-form-deadline"
              />
            </div>
          </div>
          <div>
            <p className={`text-xs font-medium ${textSecondary} mb-1`}>Assign To</p>
            <Select
              value={draft.assigned_to || '_none'}
              onValueChange={(v) => setDraft(d => ({ ...d, assigned_to: v === '_none' ? '' : v }))}
            >
              <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="page-quicktask-form-assignee">
                <SelectValue placeholder="— Select —" />
              </SelectTrigger>
              <SelectContent>
                {(projectMembers || []).map(usr => <SelectItem key={usr.user_id} value={usr.user_id}>{usr.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className={`text-xs font-medium ${textSecondary} mb-1`}>Task Type</p>
            <Select
              value={taskTypeChoice || '_none'}
              onValueChange={(v) => {
                const choice = v === '_none' ? '' : v;
                setTaskTypeChoice(choice);
                setDraft(d => ({ ...d, category: choice === 'Other' ? otherText : choice }));
              }}
            >
              <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="page-quicktask-form-type">
                <SelectValue placeholder="— Select type —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Select type —</SelectItem>
                {PAGE_TASK_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {taskTypeChoice === 'Other' && (
              <Input
                value={otherText}
                onChange={(e) => { setOtherText(e.target.value); setDraft(d => ({ ...d, category: e.target.value })); }}
                placeholder="Describe the task type…"
                className={`mt-2 ${bgSecondary} border ${borderColor} ${textPrimary}`}
                data-testid="page-quicktask-form-type-other"
              />
            )}
          </div>
        </div>
        <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
          <Button type="button" variant="outline" onClick={flushAndClose}>Cancel</Button>
          <Button
            type="button"
            onClick={submit}
            disabled={saving}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="page-quicktask-form-save"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
