import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { SearchableSelect } from '../ui/searchable-select';
import { ListChecks, X, Mic, Pause, Play, Square, Trash2 } from 'lucide-react';
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
  erp_ultra_tab_pro_id: '', erp_ultra_tab_pro_name: '',
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
    workflow_id: '',
    workflow_name: '',
    reference_image: '',
    voice_note: '',
  });
  const [saving, setSaving] = useState(false);

  // Auto-save — once Task Name has any text, this is already a real task:
  // edits (and Location/Priority/etc. changes) are debounce-saved in the
  // background, and closing the popup any way (X, backdrop, Cancel) flushes
  // whatever's pending instead of discarding it. `activeTaskId` starts as
  // the `taskId` prop in Edit mode, or null in Add mode until the first
  // auto-save creates the task and fills it in.
  const [activeTaskId, setActiveTaskId] = useState(taskId);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const debounceRef = useRef(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const skipFirstRef = useRef(true); // don't auto-save just from opening in Edit mode

  const buildPayload = () => ({
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
    workflow_id: draft.workflow_id || null,
    workflow_name: draft.workflow_name || null,
    reference_image: draft.reference_image || '',
    voice_note: draft.voice_note || '',
  });

  // Shared save core for both the debounce and an explicit Save click — the
  // synchronous savingRef check (before any await) means two overlapping
  // calls can never both POST and create a duplicate task; an overlapping
  // call just marks pendingRef and the trailing retry (or the next debounce
  // tick) picks up whatever changed since.
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

  useEffect(() => {
    if (skipFirstRef.current) { skipFirstRef.current = false; return; }
    if (!draft.task_name.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSave().catch(() => toast.error('Failed to auto-save task'));
    }, 900);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, location]);

  // X / backdrop / Cancel — flush whatever's pending (best-effort, doesn't
  // block the close) instead of losing it.
  const flushAndClose = () => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (draft.task_name.trim()) {
      doSave().catch(() => toast.error('Failed to save task'));
    }
    onClose?.();
  };

  // Task Name auto-grows with its content instead of scrolling sideways —
  // Enter/Shift+Enter both just insert a newline, same as any textarea.
  const taskNameRef = useRef(null);
  useEffect(() => {
    const el = taskNameRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.task_name]);

  // Voice Note recorder — Start/Pause/Resume/Stop, same data-URI storage
  // pattern as Reference Image above (no upload endpoint to send it to).
  const [recState, setRecState] = useState('idle'); // 'idle' | 'recording' | 'paused'
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => setDraft(d => ({ ...d, voice_note: reader.result }));
        reader.readAsDataURL(blob);
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecState('recording');
    } catch (e) {
      toast.error('Could not access the microphone');
    }
  };
  const pauseRecording = () => { mediaRecorderRef.current?.pause(); setRecState('paused'); };
  const resumeRecording = () => { mediaRecorderRef.current?.resume(); setRecState('recording'); };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); setRecState('idle'); };
  const deleteVoiceNote = () => setDraft(d => ({ ...d, voice_note: '' }));

  // If the modal closes (Cancel, backdrop, Escape) mid-recording, release
  // the mic instead of leaving it "on" in the background.
  useEffect(() => () => { mediaStreamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  // Paste-a-screenshot support for the Reference Image field below — reads
  // whatever image is on the clipboard (e.g. a Cmd+Shift+4 screenshot) and
  // inlines it as a data URI, matching the only image-storage pattern this
  // codebase already has (Settings > Company Profile's logo/signature
  // uploaders) since there's no file-upload endpoint to send it to instead.
  const handleImagePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Image is too large (max 5MB)');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => setDraft(d => ({ ...d, reference_image: reader.result }));
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const submit = async () => {
    if (!draft.task_name.trim()) { toast.error('Task name is required'); return; }
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    setSaving(true);
    // Let any in-flight auto-save finish first so this doesn't race it into
    // creating a second task.
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
            <ListChecks className="h-4 w-4 text-[#6366f1]" /> {taskId ? 'Edit Task' : 'Add Task'}
            {autoSaveStatus === 'saving' && <span className={`text-xs font-normal ${textSecondary}`}>· Saving…</span>}
            {autoSaveStatus === 'saved' && <span className="text-xs font-normal text-[#10b981]">· Saved</span>}
          </h3>
          <button onClick={flushAndClose} className={textSecondary} data-testid="erp-quicktask-form-close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className={`text-xs font-medium ${textSecondary} mb-1`}>Task Name</p>
            <Textarea
              ref={taskNameRef}
              value={draft.task_name}
              onChange={(e) => setDraft(d => ({ ...d, task_name: e.target.value }))}
              placeholder="e.g. Fix validation on Save button"
              rows={1}
              className={`${bgSecondary} border ${borderColor} ${textPrimary} min-h-[36px] py-2 resize-none overflow-hidden leading-normal`}
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
          <div>
            <p className={`text-xs font-medium ${textSecondary} mb-1`}>Workflow</p>
            <SearchableSelect
              value={draft.workflow_id}
              onChange={(id) => {
                const w = (project?.erp_workflow || []).find(x => x.id === id);
                setDraft(d => ({ ...d, workflow_id: id, workflow_name: w?.name || '' }));
              }}
              options={(project?.erp_workflow || []).map(w => ({ value: w.id, label: w.name }))}
              placeholder="— No workflow —"
              searchPlaceholder="Search workflows..."
              emptyText="No workflows yet — add one from the Workflow tab"
              className={`w-full h-9 px-3 rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
              data-testid="erp-quicktask-form-workflow"
            />
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
            <p className={`text-xs font-medium ${textSecondary} mb-1`}>Reference Image</p>
            {draft.reference_image ? (
              <div className="relative inline-block">
                <img
                  src={draft.reference_image}
                  alt="Reference"
                  className={`max-h-40 rounded-md border ${borderColor}`}
                  data-testid="erp-quicktask-form-refimage-preview"
                />
                <button
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, reference_image: '' }))}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                  data-testid="erp-quicktask-form-refimage-remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div
                onPaste={handleImagePaste}
                tabIndex={0}
                className={`flex items-center justify-center h-20 rounded-md border border-dashed ${borderColor} ${bgSecondary} ${textSecondary} text-xs text-center px-3 cursor-text focus:outline-none focus:ring-1 focus:ring-[#6366f1]`}
                data-testid="erp-quicktask-form-refimage-dropzone"
              >
                Click here, then paste a screenshot (Ctrl+V / Cmd+V)
              </div>
            )}
          </div>
          <div>
            <p className={`text-xs font-medium ${textSecondary} mb-1`}>Voice Note</p>
            {draft.voice_note ? (
              <div className="flex items-center gap-2">
                <audio controls src={draft.voice_note} className="h-9 flex-1" data-testid="erp-quicktask-form-voicenote-player" />
                <button
                  type="button"
                  onClick={deleteVoiceNote}
                  className="p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white shrink-0"
                  title="Delete voice note"
                  data-testid="erp-quicktask-form-voicenote-remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className={`flex items-center gap-2 h-11 px-3 rounded-md border border-dashed ${borderColor} ${bgSecondary}`}>
                {recState === 'idle' && (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:underline"
                    data-testid="erp-quicktask-form-voicenote-record"
                  >
                    <Mic className="h-4 w-4" /> Record a voice note
                  </button>
                )}
                {recState !== 'idle' && (
                  <>
                    <span className={`inline-flex items-center gap-1.5 text-xs ${textSecondary}`}>
                      <span className={`h-2 w-2 rounded-full bg-red-500 ${recState === 'recording' ? 'animate-pulse' : ''}`} />
                      {recState === 'recording' ? 'Recording…' : 'Paused'}
                    </span>
                    <div className="flex-1" />
                    {recState === 'recording' ? (
                      <button type="button" onClick={pauseRecording} className={`p-1.5 rounded-full ${bgCard} border ${borderColor} ${textPrimary}`} title="Pause" data-testid="erp-quicktask-form-voicenote-pause">
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button type="button" onClick={resumeRecording} className={`p-1.5 rounded-full ${bgCard} border ${borderColor} ${textPrimary}`} title="Resume" data-testid="erp-quicktask-form-voicenote-resume">
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={stopRecording} className="p-1.5 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white" title="Stop & Save" data-testid="erp-quicktask-form-voicenote-stop">
                      <Square className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
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
                ultraTabProName: location.erp_ultra_tab_pro_name,
                taskName: draft.task_name,
              })}
            </p>
          </div>
        </div>
        <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
          <Button type="button" variant="outline" onClick={flushAndClose} data-testid="erp-quicktask-form-cancel">
            {draft.task_name.trim() ? 'Close' : 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={saving}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="erp-quicktask-form-save"
          >
            {saving ? 'Saving…' : (activeTaskId ? 'Save Changes' : 'Add Task')}
          </Button>
        </div>
      </div>
    </div>
  );
}
