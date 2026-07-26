import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { X, Clock, ListChecks } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', active: 'bg-gray-600 text-white border-gray-600', idle: 'bg-white text-gray-600 border-gray-200' },
  { value: 'medium', label: 'Medium', active: 'bg-amber-500 text-white border-amber-500', idle: 'bg-white text-amber-600 border-amber-200' },
  { value: 'high', label: 'High', active: 'bg-red-500 text-white border-red-500', idle: 'bg-white text-red-600 border-red-200' },
];

const selectCls = 'w-full text-sm rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed';

const emptyState = {
  erpUserId: '', erpPageId: '', erpSubtabId: '', erpUltraSubtabId: '',
  websitePageId: '',
  taskName: '', priority: 'medium',
};

/** Client Portal's "Add New Task" popup — always pre-scoped to the client's
 * own project (never asked, unlike the internal Add Task flows), field
 * order per the client-facing brief: Date & Time (auto), User/Page tagging,
 * Task or Bug, Priority. `department` selects which tagging structure to
 * show: "erp" (User / Page / Sub Page / Super Sub Page, from `erpUsers`)
 * or "website" (a single flat Page picker, from `pages`). */
export default function AddTaskModal({ open, onClose, projectName, department = 'erp', erpUsers, pages, sessionToken, onCreated }) {
  const [form, setForm] = useState(emptyState);
  const [submitting, setSubmitting] = useState(false);
  const [reportedAt] = useState(() => new Date());

  const isErp = department === 'erp';

  const selectedUser = (erpUsers || []).find((u) => u.id === form.erpUserId);
  const selectedPage = (selectedUser?.pages || []).find((p) => p.id === form.erpPageId);
  const selectedSubtab = (selectedPage?.sub_tabs || []).find((st) => st.id === form.erpSubtabId);
  const selectedUltraSubtab = (selectedSubtab?.ultra_sub_tabs || []).find((ut) => ut.id === form.erpUltraSubtabId);
  const selectedWebsitePage = (pages || []).find((p) => p.id === form.websitePageId);

  const handleClose = () => { setForm(emptyState); onClose(); };

  const submit = async () => {
    if (!form.taskName.trim()) { toast.error('Please describe the task or bug'); return; }
    setSubmitting(true);
    try {
      const payload = {
        task_name: form.taskName.trim(),
        priority: form.priority,
        department,
      };
      if (isErp) {
        Object.assign(payload, {
          erp_user_id: form.erpUserId || null,
          erp_user_name: selectedUser?.user_name || null,
          erp_page_id: form.erpPageId || null,
          erp_page_name: selectedPage?.page_name || null,
          erp_subtab_id: form.erpSubtabId || null,
          erp_subtab_name: selectedSubtab?.name || null,
          erp_ultra_subtab_id: form.erpUltraSubtabId || null,
          erp_ultra_subtab_name: selectedUltraSubtab?.name || null,
        });
      } else {
        Object.assign(payload, {
          website_page_id: form.websitePageId || null,
          website_page_name: selectedWebsitePage?.page_name || null,
        });
      }
      await axios.post(`${API}/api/client-portal/tasks`, payload, { headers: { Authorization: `Bearer ${sessionToken}` } });
      toast.success('Task added');
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
            <>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">User</p>
                <select
                  value={form.erpUserId}
                  onChange={(e) => setForm((f) => ({ ...f, erpUserId: e.target.value, erpPageId: '', erpSubtabId: '', erpUltraSubtabId: '' }))}
                  className={selectCls}
                  data-testid="client-portal-task-user"
                >
                  <option value="">— Select user —</option>
                  {(erpUsers || []).map((u) => <option key={u.id} value={u.id}>{u.user_name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Page</p>
                  <select
                    value={form.erpPageId}
                    onChange={(e) => setForm((f) => ({ ...f, erpPageId: e.target.value, erpSubtabId: '', erpUltraSubtabId: '' }))}
                    className={selectCls}
                    disabled={!form.erpUserId}
                    data-testid="client-portal-task-page"
                  >
                    <option value="">{form.erpUserId ? '— Select page —' : 'Pick a user first'}</option>
                    {(selectedUser?.pages || []).map((p) => <option key={p.id} value={p.id}>{p.page_name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Sub Page</p>
                  <select
                    value={form.erpSubtabId}
                    onChange={(e) => setForm((f) => ({ ...f, erpSubtabId: e.target.value, erpUltraSubtabId: '' }))}
                    className={selectCls}
                    disabled={(selectedPage?.sub_tabs || []).length === 0}
                    data-testid="client-portal-task-subpage"
                  >
                    <option value="">{(selectedPage?.sub_tabs || []).length ? '— Select sub page —' : 'No sub pages'}</option>
                    {(selectedPage?.sub_tabs || []).map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Super Sub Page</p>
                  <select
                    value={form.erpUltraSubtabId}
                    onChange={(e) => setForm((f) => ({ ...f, erpUltraSubtabId: e.target.value }))}
                    className={selectCls}
                    disabled={(selectedSubtab?.ultra_sub_tabs || []).length === 0}
                    data-testid="client-portal-task-supersubpage"
                  >
                    <option value="">{(selectedSubtab?.ultra_sub_tabs || []).length ? '— Select super sub page —' : 'No super sub pages'}</option>
                    {(selectedSubtab?.ultra_sub_tabs || []).map((ut) => <option key={ut.id} value={ut.id}>{ut.name}</option>)}
                  </select>
                </div>
              </div>
            </>
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
