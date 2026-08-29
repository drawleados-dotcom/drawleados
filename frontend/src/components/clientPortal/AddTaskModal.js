import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { X, Clock, ListChecks, Mic, Pause, Play, Square, Trash2 } from 'lucide-react';
import { SearchableSelect } from '../ui/searchable-select';

const API = process.env.REACT_APP_BACKEND_URL;

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', active: 'bg-gray-600 text-white border-gray-600', idle: 'bg-white text-gray-600 border-gray-200' },
  { value: 'medium', label: 'Medium', active: 'bg-amber-500 text-white border-amber-500', idle: 'bg-white text-amber-600 border-amber-200' },
  { value: 'high', label: 'High', active: 'bg-red-500 text-white border-red-500', idle: 'bg-white text-red-600 border-red-200' },
];

const selectCls = 'w-full text-sm rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed';

const emptyLocation = {
  erp_user_id: '', erp_user_name: '',
  erp_page_id: '', erp_page_name: '',
  erp_sub_tab_id: '', erp_sub_tab_name: '',
  erp_ultra_sub_tab_id: '', erp_ultra_sub_tab_name: '',
  erp_ultra_tab_id: '', erp_ultra_tab_name: '',
  erp_ultra_tab_pro_id: '', erp_ultra_tab_pro_name: '',
};

const emptyState = {
  websitePageId: '',
  taskName: '', priority: 'medium',
  reference_image: '',
  voice_note: '',
};

/** Client Portal's "Add New Task" popup — always pre-scoped to the client's
 * own project (never asked, unlike the internal Add Task flows), field
 * order per the client-facing brief: Date & Time (auto), User/Page tagging,
 * Task or Bug, Voice Note, Reference Image, Priority. `department` selects
 * which tagging structure to show: "erp" (a single searchable User picker,
 * from `erpUsers` — deliberately simpler than the internal Add Task popup's
 * full Department/Page/Sub Tab cascade, since a client only needs to say
 * who it's for) or "website" (a single flat Page picker, from `pages`).
 * No Assign To field — a client never picks who on the team handles it. */
export default function AddTaskModal({ open, onClose, projectName, department = 'erp', erpUsers, erpDepartments, pages, sessionToken, onCreated }) {
  const [location, setLocation] = useState(emptyLocation);
  const [form, setForm] = useState(emptyState);
  const [submitting, setSubmitting] = useState(false);
  const [reportedAt] = useState(() => new Date());

  const isErp = department === 'erp';
  const userOptions = (erpUsers || []).map((u) => ({ value: u.id, label: u.user_name }));

  const selectedWebsitePage = (pages || []).find((p) => p.id === form.websitePageId);

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
        reader.onload = () => setForm((f) => ({ ...f, voice_note: reader.result }));
        reader.readAsDataURL(blob);
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
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
  const deleteVoiceNote = () => setForm((f) => ({ ...f, voice_note: '' }));

  // If the modal closes (Cancel, backdrop) mid-recording, release the mic
  // instead of leaving it "on" in the background.
  useEffect(() => () => { mediaStreamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

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
        reader.onload = () => setForm((f) => ({ ...f, reference_image: reader.result }));
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleClose = () => { setLocation(emptyLocation); setForm(emptyState); onClose(); };

  const submit = async () => {
    if (!form.taskName.trim()) { toast.error('Please describe the task or bug'); return; }
    setSubmitting(true);
    try {
      const payload = {
        task_name: form.taskName.trim(),
        priority: form.priority,
        department,
        reference_image: form.reference_image || null,
        voice_note: form.voice_note || null,
      };
      if (isErp) {
        Object.assign(payload, location);
      } else {
        Object.assign(payload, {
          website_page_id: form.websitePageId || null,
          website_page_name: selectedWebsitePage?.page_name || null,
        });
      }
      await axios.post(`${API}/api/client-portal/tasks`, payload, { headers: { Authorization: `Bearer ${sessionToken}` } });
      toast.success('Task added');
      setLocation(emptyLocation);
      setForm(emptyState);
      onCreated?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add task');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={handleClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="client-portal-add-task-modal"
      >
        <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[#6366f1]" /> Add New Task
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">For {projectName}</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700" data-testid="client-portal-add-task-close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Date &amp; Time</p>
            <div className="flex items-center gap-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              {reportedAt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {isErp ? (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Where is this?</p>
              <SearchableSelect
                value={location.erp_user_id}
                onChange={(id) => {
                  const u = (erpUsers || []).find((x) => x.id === id);
                  setLocation({ ...emptyLocation, erp_user_id: id, erp_user_name: u?.user_name || '' });
                }}
                options={userOptions}
                placeholder="— Select user —"
                searchPlaceholder="Search users…"
                emptyText="No users yet"
                className={selectCls}
                data-testid="client-portal-task-location-user"
              />
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Page</p>
              <select
                value={form.websitePageId}
                onChange={(e) => setForm((f) => ({ ...f, websitePageId: e.target.value }))}
                className={selectCls}
                data-testid="client-portal-task-website-page"
              >
                <option value="">— Select page —</option>
                {(pages || []).map((p) => <option key={p.id} value={p.id}>{p.page_name}</option>)}
              </select>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Task or Bug <span className="text-red-500">*</span></p>
            <textarea
              value={form.taskName}
              onChange={(e) => setForm((f) => ({ ...f, taskName: e.target.value }))}
              placeholder="Describe the task or bug…"
              rows={4}
              className="w-full text-sm rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-2 resize-none"
              data-testid="client-portal-task-name"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Reference Image</p>
            {form.reference_image ? (
              <div className="relative inline-block">
                <img
                  src={form.reference_image}
                  alt="Reference"
                  className="max-h-40 rounded-lg border border-gray-200"
                  data-testid="client-portal-task-refimage-preview"
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, reference_image: '' }))}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                  data-testid="client-portal-task-refimage-remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div
                onPaste={handleImagePaste}
                tabIndex={0}
                className="flex items-center justify-center h-20 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-500 text-xs text-center px-3 cursor-text focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
                data-testid="client-portal-task-refimage-dropzone"
              >
                Click here, then paste a screenshot (Ctrl+V / Cmd+V)
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Voice Note</p>
            {form.voice_note ? (
              <div className="flex items-center gap-2">
                <audio controls src={form.voice_note} className="h-9 flex-1" data-testid="client-portal-task-voicenote-player" />
                <button
                  type="button"
                  onClick={deleteVoiceNote}
                  className="p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white shrink-0"
                  title="Delete voice note"
                  data-testid="client-portal-task-voicenote-remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 h-11 px-3 rounded-lg border border-dashed border-gray-300 bg-gray-50">
                {recState === 'idle' && (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:underline"
                    data-testid="client-portal-task-voicenote-record"
                  >
                    <Mic className="h-4 w-4" /> Record a voice note
                  </button>
                )}
                {recState !== 'idle' && (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                      <span className={`h-2 w-2 rounded-full bg-red-500 ${recState === 'recording' ? 'animate-pulse' : ''}`} />
                      {recState === 'recording' ? 'Recording…' : 'Paused'}
                    </span>
                    <div className="flex-1" />
                    {recState === 'recording' ? (
                      <button type="button" onClick={pauseRecording} className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-900" title="Pause" data-testid="client-portal-task-voicenote-pause">
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button type="button" onClick={resumeRecording} className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-900" title="Resume" data-testid="client-portal-task-voicenote-resume">
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={stopRecording} className="p-1.5 rounded-full bg-[#6366f1] hover:bg-[#4f46e5] text-white" title="Stop & Save" data-testid="client-portal-task-voicenote-stop">
                      <Square className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Priority</p>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: p.value }))}
                  className={`flex-1 text-sm font-medium rounded-lg border px-3 py-2 transition-colors ${form.priority === p.value ? p.active : p.idle}`}
                  data-testid={`client-portal-task-priority-${p.value}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-gray-200 flex items-center gap-2 sticky bottom-0 bg-white">
          <Button variant="outline" onClick={handleClose} className="flex-1" disabled={submitting}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="client-portal-task-submit"
          >
            {submitting ? 'Adding…' : 'Add Task'}
          </Button>
        </div>
      </div>
    </div>
  );
}
