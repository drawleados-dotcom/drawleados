import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, TrendingUp, TrendingDown, Loader2, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { useTheme } from '../../contexts/ThemeContext';

const API = process.env.REACT_APP_BACKEND_URL;

const fmt = (n) => {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return iso; }
};

const PAYMENT_MODES = ['cash', 'cheque', 'bank', 'upi'];

/**
 * Single Cashbook with internal GST | Non-GST sub-tabs.
 * Pass `gstType` to lock it to one type (used internally when toggled).
 */
const CashbookSplit = ({ gstType: lockedGstType }) => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  const [activeGstType, setActiveGstType] = useState(lockedGstType || 'gst');
  const gstType = lockedGstType || activeGstType;

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#0c0a09]' : 'bg-gray-50';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // 'credit' | 'debit' | null
  const today = new Date().toISOString().slice(0, 10);
  const empty = { amount: '', date: today, payment_mode: 'bank', bank_id: '', party: '', category: '', notes: '' };
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/finance/banks/cashbook/entries?gst_type=${gstType}`, { headers });
      setData(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load cashbook');
    } finally {
      setLoading(false);
    }
  }, [gstType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openAdd = (kind) => {
    setModal(kind);
    const firstBank = (data?.banks || [])[0]?.bank_id || '';
    setForm({ ...empty, bank_id: firstBank });
  };

  const submit = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (form.payment_mode === 'bank' && !form.bank_id) {
      toast.error(`Select a ${gstType.toUpperCase()} bank account`);
      return;
    }
    try {
      await axios.post(`${API}/api/finance/banks/cashbook/entries`, {
        kind: modal,
        gst_type: gstType,
        amount: amt,
        date: form.date,
        payment_mode: form.payment_mode,
        bank_id: form.payment_mode === 'bank' ? form.bank_id : null,
        party: form.party,
        category: form.category,
        notes: form.notes,
      }, { headers });
      toast.success(`${modal === 'credit' ? 'Income' : 'Expense'} added`);
      setModal(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    }
  };

  const deleteEntry = async (entry) => {
    if (!window.confirm('Remove this entry?')) return;
    try {
      await axios.delete(`${API}/api/finance/banks/cashbook/entries/${entry.entry_id}`, { headers });
      toast.success('Removed');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Delete failed');
    }
  };

  if (loading && !data) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" /></div>;
  }
  if (!data) return null;

  const { summary, entries } = data;

  const PerBankList = ({ rows, color }) => (
    <div className="space-y-1.5">
      {(rows || []).length === 0 ? (
        <p className={`text-xs italic ${textSecondary}`}>No entries yet.</p>
      ) : (
        rows.map((r) => (
          <div key={r.bank_id} className="flex items-center justify-between text-sm">
            <span className={textPrimary}>{r.label}</span>
            <span className="font-semibold" style={{ color }}>{fmt(r.amount)}</span>
          </div>
        ))
      )}
    </div>
  );

  const credits = entries.filter((e) => e.kind === 'credit');
  const debits = entries.filter((e) => e.kind === 'debit');

  return (
    <div className="space-y-5" data-testid={`cashbook-${gstType}`}>
      {/* GST / Non-GST sub-tabs (hidden when locked to one) */}
      {!lockedGstType && (
        <div className={`flex items-center gap-1 border-b ${borderColor}`}>
          {[
            { key: 'gst', label: 'GST' },
            { key: 'non_gst', label: 'Non-GST' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveGstType(t.key)}
              data-testid={`cashbook-subtab-${t.key}`}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeGstType === t.key
                  ? 'border-[#6366f1] text-[#6366f1]'
                  : `border-transparent ${textSecondary} hover:${textPrimary}`
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Global action buttons */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-2xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {gstType === 'gst' ? 'GST Cashbook' : 'Non-GST Cashbook'}
          </h2>
          <p className={`text-sm ${textSecondary}`}>Balance: <b style={{ color: summary.balance >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(summary.balance)}</b></p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => openAdd('credit')} className="bg-[#10b981] hover:bg-[#059669] text-white gap-2" data-testid={`add-income-${gstType}`}>
            <Plus className="h-4 w-4" /> Add Income
          </Button>
          <Button onClick={() => openAdd('debit')} className="bg-[#ef4444] hover:bg-[#dc2626] text-white gap-2" data-testid={`add-expense-${gstType}`}>
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Two summary columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`} data-testid={`cashbook-income-summary-${gstType}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-base font-semibold flex items-center gap-2 ${textPrimary}`}>
              <TrendingUp className="h-4 w-4 text-[#10b981]" /> Income
            </h3>
            <span className="text-2xl font-bold text-[#10b981]">{fmt(summary.income.total)}</span>
          </div>
          <PerBankList rows={summary.income.rows} color="#10b981" />
        </div>

        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`} data-testid={`cashbook-expense-summary-${gstType}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-base font-semibold flex items-center gap-2 ${textPrimary}`}>
              <TrendingDown className="h-4 w-4 text-[#ef4444]" /> Expense
            </h3>
            <span className="text-2xl font-bold text-[#ef4444]">{fmt(summary.expense.total)}</span>
          </div>
          <PerBankList rows={summary.expense.rows} color="#ef4444" />
        </div>
      </div>

      {/* Cash In / Cash Out tables — like the old cashbook layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className="bg-[#10b981] text-white px-5 py-3 flex items-center justify-between">
            <span className="font-semibold">Cash In</span>
            <span className="font-bold">{fmt(summary.income.total)}</span>
          </div>
          {credits.length === 0 ? (
            <div className={`p-8 text-center ${textSecondary}`}>No entries</div>
          ) : (
            <table className="w-full text-sm">
              <thead className={`${bgSecondary} ${textSecondary} text-xs uppercase`}>
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">From</th>
                  <th className="px-4 py-2 text-left">Mode</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {credits.map((e) => (
                  <tr key={e.entry_id} className={`border-t ${borderColor}`} data-testid={`cb-row-${e.entry_id}`}>
                    <td className={`px-4 py-2 ${textSecondary}`}>{fmtDate(e.date)}</td>
                    <td className={`px-4 py-2 ${textPrimary}`}>{e.from || e.invoice_number || '—'}</td>
                    <td className={`px-4 py-2 ${textSecondary} capitalize`}>{e.payment_mode}{e.bank_label ? ` · ${e.bank_label}` : ''}</td>
                    <td className="px-4 py-2 text-right font-semibold text-[#10b981]">{fmt(e.amount)}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => deleteEntry(e)} className="text-[#f87171] hover:text-[#fca5a5]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className="bg-[#ef4444] text-white px-5 py-3 flex items-center justify-between">
            <span className="font-semibold">Cash Out</span>
            <span className="font-bold">{fmt(summary.expense.total)}</span>
          </div>
          {debits.length === 0 ? (
            <div className={`p-8 text-center ${textSecondary}`}>No entries</div>
          ) : (
            <table className="w-full text-sm">
              <thead className={`${bgSecondary} ${textSecondary} text-xs uppercase`}>
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">To</th>
                  <th className="px-4 py-2 text-left">Mode</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {debits.map((e) => (
                  <tr key={e.entry_id} className={`border-t ${borderColor}`} data-testid={`cb-row-${e.entry_id}`}>
                    <td className={`px-4 py-2 ${textSecondary}`}>{fmtDate(e.date)}</td>
                    <td className={`px-4 py-2 ${textPrimary}`}>{e.to || '—'}</td>
                    <td className={`px-4 py-2 ${textSecondary} capitalize`}>{e.payment_mode}{e.bank_label ? ` · ${e.bank_label}` : ''}</td>
                    <td className="px-4 py-2 text-right font-semibold text-[#ef4444]">{fmt(e.amount)}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => deleteEntry(e)} className="text-[#f87171] hover:text-[#fca5a5]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {modal && (
        <Dialog open={true} onOpenChange={() => setModal(null)}>
          <DialogContent className={`${bgCard} border ${borderColor} ${textPrimary} max-w-md`} data-testid={`cashbook-add-modal-${modal}`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {modal === 'credit' ? <TrendingUp className="h-5 w-5 text-[#10b981]" /> : <TrendingDown className="h-5 w-5 text-[#ef4444]" />}
                Add {modal === 'credit' ? 'Income' : 'Expense'} — {gstType === 'gst' ? 'GST' : 'Non-GST'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Amount *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={bgSecondary} autoFocus />
                </div>
                <div>
                  <Label className={textPrimary}>Date *</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={bgSecondary} />
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Payment Mode</Label>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {PAYMENT_MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm({ ...form, payment_mode: m })}
                      className={`px-2 py-1.5 rounded text-xs border capitalize transition-colors ${
                        form.payment_mode === m ? 'border-[#6366f1] bg-[#6366f1]/15' : `${borderColor} ${textSecondary}`
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {form.payment_mode === 'bank' && (
                <div>
                  <Label className={textPrimary}>{gstType === 'gst' ? 'GST' : 'Non-GST'} Bank</Label>
                  <select
                    value={form.bank_id}
                    onChange={(e) => setForm({ ...form, bank_id: e.target.value })}
                    className={`w-full h-10 px-3 rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                  >
                    <option value="">Select bank...</option>
                    {(data.banks || []).map((b) => (
                      <option key={b.bank_id} value={b.bank_id}>{b.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label className={textPrimary}>{modal === 'credit' ? 'From (party)' : 'To (party)'}</Label>
                <Input value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} placeholder="Name / company" className={bgSecondary} />
              </div>
              <div>
                <Label className={textPrimary}>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Service / Salary / Office" className={bgSecondary} />
              </div>
              <div>
                <Label className={textPrimary}>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="UTR / cheque # / remarks" className={bgSecondary} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t mt-3" style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
              <Button variant="ghost" onClick={() => setModal(null)} className={textSecondary}><X className="h-4 w-4 mr-1" /> Cancel</Button>
              <Button onClick={submit} className={modal === 'credit' ? 'bg-[#10b981] hover:bg-[#059669] text-white' : 'bg-[#ef4444] hover:bg-[#dc2626] text-white'}>
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default CashbookSplit;
