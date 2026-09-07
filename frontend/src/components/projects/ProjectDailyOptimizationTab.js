import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, X, Zap } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Meta Ads / SEO department's "Daily Optimization" tab — a per-project log
 * of optimization passes against a campaign. Each entry starts pending; the
 * Optimize action opens a Result popup (Output/Outcome) that, once saved,
 * flips the entry to Optimized and stays editable from the row's own button.
 */
export default function ProjectDailyOptimizationTab({
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

  const entries = project?.daily_optimizations || [];
  const campaigns = project?.campaigns || [];
  const [addModal, setAddModal] = useState(null); // { date, campaign_name, remarks }
  const [resultModal, setResultModal] = useState(null); // { id, output, outcome }
  const [saving, setSaving] = useState(false);

  const persist = async (next) => {
    try {
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { daily_optimizations: next },
        { headers },
      );
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  const openAdd = () => {
    if (!canEdit) return;
    setAddModal({ date: todayISO(), campaign_name: campaigns[0]?.name || '', remarks: '' });
  };
  const closeAdd = () => setAddModal(null);

  const saveAdd = async () => {
    if (!addModal.date) { toast.error('Optimization date is required'); return; }
    if (!addModal.campaign_name) { toast.error('Campaign name is required'); return; }
    setSaving(true);
    const entry = {
      id: newId('opt'),
      date: addModal.date,
      campaign_name: addModal.campaign_name,
      remarks: addModal.remarks.trim(),
      status: 'pending',
      output: '',
      outcome: '',
    };
    const ok = await persist([...entries, entry]);
    setSaving(false);
    if (ok) {
      toast.success('Optimization added');
      closeAdd();
    }
  };

  const deleteEntry = async (id) => {
    if (!canEdit) return;
    if (!window.confirm('Remove this optimization entry?')) return;
    const ok = await persist(entries.filter(e => e.id !== id));
    if (ok) toast.success('Entry removed');
  };

  const openResult = (entry) => {
    if (!canEdit) return;
    setResultModal({ id: entry.id, output: entry.output || '', outcome: entry.outcome || '' });
  };
  const closeResult = () => setResultModal(null);

  const saveResult = async () => {
    if (!resultModal.output.trim() || !resultModal.outcome.trim()) {
      toast.error('Output and Outcome are both required');
      return;
    }
    setSaving(true);
    const next = entries.map(e => (
      e.id === resultModal.id
        ? { ...e, status: 'optimized', output: resultModal.output.trim(), outcome: resultModal.outcome.trim() }
        : e
    ));
    const ok = await persist(next);
    setSaving(false);
    if (ok) {
      toast.success('Result saved');
      closeResult();
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-3" data-testid="project-daily-optimization-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <Zap className="h-5 w-5 text-[#6366f1]" /> Daily Optimization
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            Log an optimization pass on a campaign, then record its result once it's run.
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            onClick={openAdd}
            size="sm"
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="daily-optimization-add-btn"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
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
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Date</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Campaign Name</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Remarks</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Output</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Outcome</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, idx) => {
                  const isOptimized = e.status === 'optimized';
                  return (
                    <tr key={e.id} className={`border-b ${borderColor}`} data-testid={`daily-optimization-row-${e.id}`}>
                      <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                      <td className={`p-3 text-sm ${textPrimary}`}>{formatDate(e.date)}</td>
                      <td className={`p-3 text-sm font-medium ${textPrimary}`}>{e.campaign_name || '—'}</td>
                      <td className={`p-3 text-sm ${textSecondary} max-w-xs truncate`} title={e.remarks}>{e.remarks || '—'}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            isOptimized
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : `${isDark ? 'bg-[#3f3f46]' : 'bg-gray-200'} ${textSecondary}`
                          }`}
                          data-testid={`daily-optimization-status-${e.id}`}
                        >
                          {isOptimized ? 'Optimized' : 'Pending'}
                        </span>
                      </td>
                      <td className={`p-3 text-sm ${textSecondary} max-w-xs truncate`} title={e.output}>{e.output || '—'}</td>
                      <td className={`p-3 text-sm ${textSecondary} max-w-xs truncate`} title={e.outcome}>{e.outcome || '—'}</td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1 items-center">
                          {canEdit && (
                            <Button
                              type="button"
                              size="sm"
                              variant={isOptimized ? 'outline' : 'default'}
                              className={isOptimized ? '' : 'bg-[#6366f1] hover:bg-[#4f46e5] text-white'}
                              onClick={() => openResult(e)}
                              data-testid={`daily-optimization-optimize-${e.id}`}
                            >
                              {isOptimized ? 'Edit Result' : 'Optimize'}
                            </Button>
                          )}
                          {canEdit && (
                            <button type="button" onClick={() => deleteEntry(e.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`daily-optimization-delete-${e.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={8} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No optimization entries yet. {canEdit && <span>Click <span className="font-medium">Add</span> to log one.</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Optimization modal */}
      {addModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeAdd}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <Zap className="h-4 w-4 text-[#6366f1]" /> Add Optimization
              </h3>
              <button onClick={closeAdd} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Optimization Date</p>
                <Input
                  type="date"
                  value={addModal.date}
                  onChange={(e) => setAddModal(m => ({ ...m, date: e.target.value }))}
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="daily-optimization-form-date"
                />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Campaign Name</p>
                {campaigns.length > 0 ? (
                  <Select
                    value={addModal.campaign_name}
                    onValueChange={(v) => setAddModal(m => ({ ...m, campaign_name: v }))}
                  >
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="daily-optimization-form-campaign">
                      <SelectValue placeholder="Select campaign" />
                    </SelectTrigger>
                    <SelectContent className="z-[80]">
                      {campaigns.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className={`text-xs ${textSecondary}`}>
                    No campaigns yet — add one on the Campaigns tab first.
                  </p>
                )}
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Remarks</p>
                <Textarea
                  value={addModal.remarks}
                  onChange={(e) => setAddModal(m => ({ ...m, remarks: e.target.value }))}
                  placeholder="What are you optimizing and why?"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  rows={3}
                  data-testid="daily-optimization-form-remarks"
                />
              </div>
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={closeAdd}>Cancel</Button>
              <Button
                type="button"
                onClick={saveAdd}
                disabled={saving || campaigns.length === 0}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="daily-optimization-form-save"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Result modal — Output & Outcome, opened by the row's Optimize/Edit Result button */}
      {resultModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={closeResult}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
                <Zap className="h-4 w-4 text-[#6366f1]" /> Result
              </h3>
              <button onClick={closeResult} className={textSecondary}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Output</p>
                <Textarea
                  value={resultModal.output}
                  onChange={(e) => setResultModal(m => ({ ...m, output: e.target.value }))}
                  placeholder="What did you change?"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  rows={3}
                  data-testid="daily-optimization-result-output"
                  autoFocus
                />
              </div>
              <div>
                <p className={`text-xs font-medium ${textSecondary} mb-1`}>Outcome</p>
                <Textarea
                  value={resultModal.outcome}
                  onChange={(e) => setResultModal(m => ({ ...m, outcome: e.target.value }))}
                  placeholder="What effect did it have?"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  rows={3}
                  data-testid="daily-optimization-result-outcome"
                />
              </div>
            </div>
            <div className={`p-5 border-t ${borderColor} flex items-center justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={closeResult}>Cancel</Button>
              <Button
                type="button"
                onClick={saveResult}
                disabled={saving}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="daily-optimization-result-save"
              >
                Save & Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
