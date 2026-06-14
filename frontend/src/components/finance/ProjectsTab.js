import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { FolderOpen, Loader2, Calendar, Building2, Wallet, ChevronRight, Receipt, Check, X, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { useTheme } from '../../contexts/ThemeContext';

const API = process.env.REACT_APP_BACKEND_URL;
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return iso; } };

const ProjectsTab = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#0c0a09]' : 'bg-gray-50';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // full project with payment_schedule
  const [editingSchedule, setEditingSchedule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/projects`, { headers });
      setProjects(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openProject = async (p) => {
    try {
      const r = await axios.get(`${API}/api/projects/${p.project_id}`, { headers });
      setSelected(r.data);
      setEditingSchedule(false);
    } catch (e) {
      toast.error('Failed to load project');
    }
  };

  const updateSchedule = async (splits) => {
    try {
      await axios.patch(`${API}/api/projects/${selected.project_id}`, {
        payment_schedule: { ...(selected.payment_schedule || {}), splits },
      }, { headers });
      toast.success('Payment schedule updated');
      const r = await axios.get(`${API}/api/projects/${selected.project_id}`, { headers });
      setSelected(r.data);
      setEditingSchedule(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Update failed');
    }
  };

  const splits = (selected?.payment_schedule?.splits) || [];

  if (loading && projects.length === 0) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" /></div>;
  }

  return (
    <div className="space-y-5" data-testid="finance-projects-tab">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-2xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>Projects</h2>
          <p className={`text-sm ${textSecondary}`}>Mirrors Operations → Projects. Click a project to manage its payment schedule.</p>
        </div>
      </div>

      <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
        {projects.length === 0 ? (
          <div className={`p-10 text-center ${textSecondary}`}>
            <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
            No projects yet. Create one in Operations → Projects.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className={`${bgSecondary} ${textSecondary} text-xs uppercase`}>
              <tr>
                <th className="px-5 py-2.5 text-left">Project</th>
                <th className="px-5 py-2.5 text-left">Client</th>
                <th className="px-5 py-2.5 text-left">Status</th>
                <th className="px-5 py-2.5 text-left">Due</th>
                <th className="px-5 py-2.5 text-right">Payment Schedule</th>
                <th className="px-5 py-2.5 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const ps = p.payment_schedule || {};
                const splitsX = ps.splits || [];
                const total = splitsX.reduce((s, x) => s + (Number(x.amount) || 0), 0);
                const collected = splitsX.filter((x) => x.collected).reduce((s, x) => s + (Number(x.amount) || 0), 0);
                return (
                  <tr key={p.project_id} className={`border-t ${borderColor} hover:bg-[#6366f1]/5 cursor-pointer`} onClick={() => openProject(p)} data-testid={`fin-project-row-${p.project_id}`}>
                    <td className={`px-5 py-2.5 font-medium ${textPrimary}`}>{p.name}</td>
                    <td className={`px-5 py-2.5 ${textSecondary}`}>
                      <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{p.client_name || '—'}</span>
                    </td>
                    <td className={`px-5 py-2.5 ${textSecondary} capitalize`}>{p.status || 'active'}</td>
                    <td className={`px-5 py-2.5 ${textSecondary}`}>
                      <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fmtDate(p.due_date)}</span>
                    </td>
                    <td className={`px-5 py-2.5 text-right ${textPrimary}`}>
                      {splitsX.length === 0 ? (
                        <span className={`${textSecondary} text-xs italic`}>Not configured</span>
                      ) : (
                        <span>{fmt(collected)} / {fmt(total)} <span className={`text-xs ${textSecondary}`}>({splitsX.length} split{splitsX.length === 1 ? '' : 's'})</span></span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <ChevronRight className={`h-4 w-4 ${textSecondary} inline`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Project Payment Schedule modal */}
      {selected && (
        <Dialog open={true} onOpenChange={() => setSelected(null)}>
          <DialogContent className={`${bgCard} border ${borderColor} ${textPrimary} max-w-3xl`} data-testid="project-payment-schedule-modal">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[#6366f1]" /> Payment Schedule — {selected.name}
              </DialogTitle>
              <p className={`text-xs ${textSecondary}`}>
                Client: {selected.client_name || '—'} • {splits.length} split{splits.length === 1 ? '' : 's'}
              </p>
            </DialogHeader>

            <PaymentScheduleEditor
              splits={splits}
              editing={editingSchedule}
              onCancel={() => setEditingSchedule(false)}
              onEdit={() => setEditingSchedule(true)}
              onSave={updateSchedule}
              fmt={fmt}
              bgSecondary={bgSecondary}
              borderColor={borderColor}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
            />

            <div className="flex justify-end pt-3 border-t mt-3" style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
              <Button onClick={() => setSelected(null)} variant="outline" className={borderColor}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

const PaymentScheduleEditor = ({ splits, editing, onCancel, onEdit, onSave, fmt, bgSecondary, borderColor, textPrimary, textSecondary }) => {
  const [draft, setDraft] = useState(() => splits.map((s) => ({ ...s })));

  useEffect(() => { if (editing) setDraft(splits.map((s) => ({ ...s, id: s.id || `split_${Math.random().toString(36).slice(2, 10)}` }))); }, [editing, splits]);

  const addRow = () => setDraft((d) => [...d, { id: `split_${Math.random().toString(36).slice(2, 10)}`, label: '', amount: '', due_date: '', collected: false }]);
  const updateRow = (idx, patch) => setDraft((d) => d.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx) => setDraft((d) => d.filter((_, i) => i !== idx));

  const totalDraft = draft.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  if (!editing) {
    return (
      <div className="space-y-2 mt-2">
        {splits.length === 0 ? (
          <div className={`p-6 text-center ${textSecondary} ${bgSecondary} rounded-lg border ${borderColor}`}>
            No payment schedule set yet.
          </div>
        ) : (
          <div className={`overflow-hidden rounded-lg border ${borderColor}`}>
            <table className="w-full text-sm">
              <thead className={`${bgSecondary} ${textSecondary} text-xs uppercase`}>
                <tr>
                  <th className="px-3 py-2 text-left">Milestone</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((s, i) => (
                  <tr key={s.id || i} className={`border-t ${borderColor}`}>
                    <td className={`px-3 py-2 ${textPrimary}`}>{s.label || '—'}</td>
                    <td className={`px-3 py-2 ${textSecondary}`}>{s.due_date || '—'}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${textPrimary}`}>{fmt(s.amount)}</td>
                    <td className="px-3 py-2 text-center">
                      {s.collected ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/15 text-emerald-500"><Check className="h-3 w-3 inline" /> Collected</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs bg-amber-500/15 text-amber-500">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={onEdit} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="edit-schedule-btn">
            <Plus className="h-3.5 w-3.5 mr-1" /> {splits.length === 0 ? 'Create Schedule' : 'Edit Schedule'}
          </Button>
        </div>
      </div>
    );
  }

  // Editing mode
  return (
    <div className="space-y-2 mt-2">
      {draft.map((s, idx) => (
        <div key={s.id} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${borderColor} ${bgSecondary}`}>
          <Input value={s.label} onChange={(e) => updateRow(idx, { label: e.target.value })} placeholder="Milestone (e.g. Advance / Mid / Final)" className="col-span-5" />
          <Input type="date" value={s.due_date || ''} onChange={(e) => updateRow(idx, { due_date: e.target.value })} className="col-span-3" />
          <Input type="number" value={s.amount} onChange={(e) => updateRow(idx, { amount: e.target.value })} placeholder="Amount" className="col-span-3" />
          <button onClick={() => removeRow(idx)} className={`col-span-1 ${textSecondary} hover:text-[#ef4444]`}>
            <Trash2 className="h-4 w-4 mx-auto" />
          </button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addRow} className={borderColor} data-testid="add-split-row">
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Split
      </Button>
      <p className={`text-xs ${textSecondary} text-right`}>Total: <b className={textPrimary}>{fmt(totalDraft)}</b></p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} className={textSecondary}><X className="h-4 w-4 mr-1" /> Cancel</Button>
        <Button onClick={() => onSave(draft.map((r) => ({ ...r, amount: Number(r.amount) || 0 })))} className="bg-[#10b981] hover:bg-[#059669] text-white" data-testid="save-schedule-btn">
          Save Schedule
        </Button>
      </div>
    </div>
  );
};

export default ProjectsTab;
