import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2, Save, X, Pencil, TrendingDown } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Status workflow shared with the Payment Schedule rows for consistency.
const STATUS_FLOW = ['created', 'raised', 'paid', 'declined'];
const STATUS_LABEL = { created: 'Created', raised: 'Raised', paid: 'Paid', declined: 'Declined' };
const STATUS_STYLE = {
  created: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  raised: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  declined: 'bg-red-500/20 text-red-400 border-red-500/40',
};
const nextStatus = (s) => {
  const i = STATUS_FLOW.indexOf(s || 'created');
  return STATUS_FLOW[(i + 1) % STATUS_FLOW.length];
};

const newRowId = () => `e_${Math.random().toString(36).slice(2, 10)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const emptyRow = () => ({
  id: newRowId(),
  date: todayIso(),
  label: '',
  amount: 0,
  status: 'created',
});

export default function ProjectExpenseTab({
  project,
  onProjectUpdated,
  isSuperAdmin,
  isDark,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const canEdit = !!isSuperAdmin;
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  // Sub-tabs: Credits | Other Expense
  const [subTab, setSubTab] = useState('credits');

  // Always work off the project's persisted expense state; local edits go via PATCH.
  const expenseState = project?.project_expense || { credits: [], other_expenses: [] };
  const credits = expenseState.credits || [];
  const others = expenseState.other_expenses || [];

  const [draftRow, setDraftRow] = useState(null); // inline add buffer (one at a time)
  const [editingId, setEditingId] = useState(null); // row being inline-edited
  const [editBuffer, setEditBuffer] = useState(null);

  const list = subTab === 'credits' ? credits : others;
  const totals = useMemo(() => {
    const count = list.length;
    const amount = list.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    return { count, amount };
  }, [list]);

  const persist = async (nextList) => {
    if (!canEdit) return;
    const nextState = {
      ...expenseState,
      [subTab === 'credits' ? 'credits' : 'other_expenses']: nextList,
    };
    try {
      const res = await axios.patch(
        `${API}/api/projects/${project.project_id}`,
        { project_expense: nextState },
        { headers },
      );
      onProjectUpdated?.(res.data);
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
      return false;
    }
  };

  const startAdd = () => {
    if (!canEdit) return;
    setDraftRow(emptyRow());
  };

  const cancelAdd = () => setDraftRow(null);

  const saveAdd = async () => {
    if (!draftRow) return;
    if (!draftRow.date) { toast.error('Date is required'); return; }
    const amt = Number(draftRow.amount) || 0;
    if (amt <= 0) { toast.error('Amount must be greater than 0'); return; }
    const next = [...list, { ...draftRow, amount: amt }];
    const ok = await persist(next);
    if (ok) {
      setDraftRow(null);
      toast.success(subTab === 'credits' ? 'Credit added' : 'Expense added');
    }
  };

  const startEdit = (row) => {
    if (!canEdit) return;
    setEditingId(row.id);
    setEditBuffer({ ...row });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBuffer(null);
  };

  const saveEdit = async () => {
    if (!editBuffer) return;
    const amt = Number(editBuffer.amount) || 0;
    if (amt <= 0) { toast.error('Amount must be greater than 0'); return; }
    const next = list.map(r => (r.id === editBuffer.id ? { ...editBuffer, amount: amt } : r));
    const ok = await persist(next);
    if (ok) { cancelEdit(); toast.success('Saved'); }
  };

  const deleteRow = async (id) => {
    if (!canEdit) return;
    const next = list.filter(r => r.id !== id);
    const ok = await persist(next);
    if (ok) toast.success('Removed');
  };

  const cycleRowStatus = async (row) => {
    if (!canEdit) return;
    const ns = nextStatus(row.status || 'created');
    const next = list.map(r => (r.id === row.id ? { ...r, status: ns } : r));
    await persist(next);
  };

  const pillBox = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const activeCls = isDark ? 'bg-[#27272a] text-white' : 'bg-gray-100 text-gray-900';
  const idleCls = isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-500 hover:text-gray-900';

  const subTabLabel = subTab === 'credits' ? 'Credits' : 'Other Expense';
  const addLabel = subTab === 'credits' ? '+ Add Credits' : '+ Add Expense';
  const labelCol = subTab === 'credits' ? 'Credits' : 'Expense';

  return (
    <div className="space-y-3" data-testid="project-expense-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <TrendingDown className="h-5 w-5 text-[#ef4444]" /> Expense
          </h3>
          <p className={`text-xs ${textSecondary}`}>
            Track credits issued and other expenses incurred against this project.
          </p>
        </div>
      </div>

      {/* Sub-tab pill strip: Credits | Other Expense */}
      <div className={`inline-flex items-center gap-1 p-1 rounded-lg border ${pillBox}`}>
        <button
          type="button"
          onClick={() => { setSubTab('credits'); cancelAdd(); cancelEdit(); }}
          data-testid="project-expense-subtab-credits"
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${subTab === 'credits' ? activeCls : idleCls}`}
        >
          Credits
        </button>
        <button
          type="button"
          onClick={() => { setSubTab('other_expense'); cancelAdd(); cancelEdit(); }}
          data-testid="project-expense-subtab-other"
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${subTab === 'other_expense' ? activeCls : idleCls}`}
        >
          Other Expense
        </button>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4">
            <p className={`text-xs ${textSecondary}`}>Total {subTabLabel}</p>
            <p className={`text-2xl font-bold ${textPrimary}`} data-testid="expense-total-count">
              {totals.count}
            </p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4">
            <p className={`text-xs ${textSecondary}`}>Amount</p>
            <p className="text-2xl font-bold text-[#ef4444]" data-testid="expense-total-amount">
              INR {totals.amount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between">
        <p className={`text-xs ${textSecondary}`}>
          {list.length === 0 ? `No ${subTabLabel.toLowerCase()} yet.` : `${list.length} row${list.length === 1 ? '' : 's'}`}
        </p>
        {canEdit && !draftRow && (
          <Button
            type="button"
            onClick={startAdd}
            size="sm"
            className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
            data-testid="expense-add-row-btn"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> {addLabel}
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-12`}>S.No</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Date</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>{labelCol}</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Amount</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, idx) => {
                  const isEditing = editingId === row.id;
                  return (
                    <tr key={row.id} className={`border-b ${borderColor}`} data-testid={`expense-row-${row.id}`}>
                      <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                      <td className={`p-3 ${textPrimary}`}>
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editBuffer.date}
                            onChange={(e) => setEditBuffer(b => ({ ...b, date: e.target.value }))}
                            className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary}`}
                          />
                        ) : (
                          <span className="text-sm">{row.date || '—'}</span>
                        )}
                      </td>
                      <td className={`p-3 ${textPrimary}`}>
                        {isEditing ? (
                          <Input
                            value={editBuffer.label}
                            onChange={(e) => setEditBuffer(b => ({ ...b, label: e.target.value }))}
                            placeholder={`${labelCol} description`}
                            className={`h-8 text-xs ${bgSecondary} border ${borderColor} ${textPrimary}`}
                          />
                        ) : (
                          <span className="text-sm">{row.label || '—'}</span>
                        )}
                      </td>
                      <td className={`p-3 text-right ${textPrimary} font-medium`}>
                        {isEditing ? (
                          <Input
                            type="number" min="0"
                            value={editBuffer.amount}
                            onChange={(e) => setEditBuffer(b => ({ ...b, amount: e.target.value }))}
                            className={`h-8 text-xs text-right ${bgSecondary} border ${borderColor} ${textPrimary}`}
                          />
                        ) : (
                          <span className="text-sm">INR {Number(row.amount || 0).toLocaleString()}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {(() => {
                          const st = row.status || 'created';
                          return (
                            <button
                              type="button"
                              onClick={() => cycleRowStatus(row)}
                              disabled={!canEdit || isEditing}
                              title={canEdit ? 'Click to advance status' : 'Read only'}
                              className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[st]} ${canEdit && !isEditing ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-80'}`}
                              data-testid={`expense-status-cycle-${row.id}`}
                            >
                              {STATUS_LABEL[st]}
                            </button>
                          );
                        })()}
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-1">
                            <button type="button" onClick={saveEdit} className="p-1 text-emerald-500 hover:text-emerald-400" title="Save" data-testid={`expense-save-edit-${row.id}`}>
                              <Save className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={cancelEdit} className={`p-1 ${textSecondary} hover:opacity-80`} title="Cancel">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          canEdit && (
                            <div className="inline-flex gap-1">
                              <button type="button" onClick={() => startEdit(row)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`expense-edit-${row.id}`}>
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => deleteRow(row.id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`expense-delete-${row.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Inline add row */}
                {draftRow && (
                  <tr className={`border-b ${borderColor} ${bgSecondary}`} data-testid="expense-draft-row">
                    <td className={`p-3 text-xs ${textSecondary}`}>{list.length + 1}</td>
                    <td className="p-3">
                      <Input
                        type="date"
                        value={draftRow.date}
                        onChange={(e) => setDraftRow(d => ({ ...d, date: e.target.value }))}
                        className={`h-8 text-xs ${isDark ? 'bg-[#0c0a09]' : 'bg-white'} border ${borderColor} ${textPrimary}`}
                        data-testid="expense-draft-date"
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        value={draftRow.label}
                        onChange={(e) => setDraftRow(d => ({ ...d, label: e.target.value }))}
                        placeholder={`${labelCol} description (optional)`}
                        className={`h-8 text-xs ${isDark ? 'bg-[#0c0a09]' : 'bg-white'} border ${borderColor} ${textPrimary}`}
                        data-testid="expense-draft-label"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <Input
                        type="number" min="0"
                        value={draftRow.amount}
                        onChange={(e) => setDraftRow(d => ({ ...d, amount: e.target.value }))}
                        placeholder="0"
                        className={`h-8 text-xs text-right ${isDark ? 'bg-[#0c0a09]' : 'bg-white'} border ${borderColor} ${textPrimary}`}
                        data-testid="expense-draft-amount"
                      />
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE.created}`}>Created</span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={saveAdd} className="p-1 text-emerald-500 hover:text-emerald-400" title="Save" data-testid="expense-save-add">
                          <Save className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={cancelAdd} className={`p-1 ${textSecondary} hover:opacity-80`} title="Cancel">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {list.length === 0 && !draftRow && (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No {subTabLabel.toLowerCase()} yet. {canEdit && <span>Click <span className="font-medium">{addLabel}</span> to add one.</span>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
