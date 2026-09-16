import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, CreditCard, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { useTheme } from '../../contexts/ThemeContext';

const API = process.env.REACT_APP_BACKEND_URL;

const CYCLE_LABEL = { one_time: 'One time', monthly: 'Monthly', yearly: 'Yearly' };

const STATUS_STYLE = {
  collected: 'bg-[#22c55e]/15 text-[#16a34a]',
  due: 'bg-[#f59e0b]/15 text-[#b45309]',
  overdue: 'bg-[#ef4444]/15 text-[#dc2626]',
};

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const EMPTY_FORM = { debt_name: '', debt_type: '', cycle: 'one_time', due_date: '', amount: '', lender_name: '', disbursed_date: '' };

const DebtsTab = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgInput = isDark ? 'bg-[#0c0a09]' : 'bg-gray-50';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [innerTab, setInnerTab] = useState('collected'); // collected | due
  const [debts, setDebts] = useState([]);
  const [loadingDebts, setLoadingDebts] = useState(false);

  const now = new Date();
  const [dueMonth, setDueMonth] = useState(now.getMonth() + 1);
  const [dueYear, setDueYear] = useState(now.getFullYear());
  const [dueRows, setDueRows] = useState([]);
  const [loadingDue, setLoadingDue] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadDebts = useCallback(async () => {
    setLoadingDebts(true);
    try {
      const r = await axios.get(`${API}/api/finance/debts`, { headers });
      setDebts(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load debts');
    } finally {
      setLoadingDebts(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDue = useCallback(async () => {
    setLoadingDue(true);
    try {
      const r = await axios.get(`${API}/api/finance/debts/due`, { headers, params: { month: dueMonth, year: dueYear } });
      setDueRows(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load due debts');
    } finally {
      setLoadingDue(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueMonth, dueYear]);

  useEffect(() => { loadDebts(); }, [loadDebts]);
  useEffect(() => { if (innerTab === 'due') loadDue(); }, [innerTab, loadDue]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (d) => {
    setEditingId(d.debt_id);
    setForm({
      debt_name: d.debt_name, debt_type: d.debt_type || '', cycle: d.cycle, due_date: d.due_date,
      amount: String(d.amount || ''), lender_name: d.lender_name || '', disbursed_date: d.disbursed_date || '',
    });
    setShowModal(true);
  };

  const saveDebt = async () => {
    if (!form.debt_name.trim()) { toast.error('Debt name is required'); return; }
    if (!form.due_date) { toast.error('Due date is required'); return; }
    setSaving(true);
    try {
      const payload = {
        debt_name: form.debt_name.trim(),
        debt_type: form.debt_type.trim(),
        cycle: form.cycle,
        due_date: form.due_date,
        amount: parseFloat(form.amount) || 0,
        lender_name: form.lender_name.trim(),
        disbursed_date: form.disbursed_date || null,
      };
      if (editingId) {
        await axios.put(`${API}/api/finance/debts/${editingId}`, payload, { headers });
        toast.success('Debt updated');
      } else {
        await axios.post(`${API}/api/finance/debts`, payload, { headers });
        toast.success('Debt added');
      }
      setShowModal(false);
      loadDebts();
      if (innerTab === 'due') loadDue();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save debt');
    } finally {
      setSaving(false);
    }
  };

  const deleteDebt = async (debtId) => {
    if (!window.confirm('Delete this debt?')) return;
    try {
      await axios.delete(`${API}/api/finance/debts/${debtId}`, { headers });
      toast.success('Debt deleted');
      loadDebts();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete debt');
    }
  };

  const markCollected = async (row) => {
    try {
      await axios.post(`${API}/api/finance/debts/${row.debt_id}/collect`, {
        period_key: row.period_key, due_date: row.due_date, amount: row.amount,
      }, { headers });
      toast.success('Marked as collected');
      loadDue();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to mark collected');
    }
  };

  const undoCollected = async (row) => {
    try {
      await axios.delete(`${API}/api/finance/debts/${row.debt_id}/collect/${row.period_key}`, { headers });
      toast.success('Reverted to due');
      loadDue();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to revert');
    }
  };

  return (
    <div className="space-y-4" data-testid="finance-debts-tab">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-2xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>Debts</h2>
          <p className={`text-sm ${textSecondary}`}>Loan EMIs, subscriptions, vendor dues — one-time or recurring</p>
        </div>
        <Button onClick={openCreate} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="debt-add-btn">
          <Plus className="h-4 w-4 mr-1.5" /> Add Debt
        </Button>
      </div>

      <div className="flex gap-2">
        {[{ key: 'collected', label: 'Collected' }, { key: 'due', label: 'Due' }].map(t => (
          <button
            key={t.key}
            onClick={() => setInnerTab(t.key)}
            data-testid={`debts-inner-tab-${t.key}`}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              innerTab === t.key ? 'bg-[#6366f1] text-white' : `${bgInput} ${textSecondary} border ${borderColor}`
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {innerTab === 'collected' && (
        <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
          {loadingDebts ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : debts.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className={`h-8 w-8 mx-auto mb-2 ${textSecondary}`} />
              <p className={`text-sm ${textSecondary}`}>No debts added yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className={bgInput}>
                <tr>
                  <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Debt Name</th>
                  <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Type</th>
                  <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Loan Giver</th>
                  <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Disbursed</th>
                  <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Cycle</th>
                  <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Due Date</th>
                  <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Amount</th>
                  <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Status</th>
                  <th className={`text-right px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderColor}`}>
                {debts.map(d => (
                  <tr key={d.debt_id} data-testid={`debt-row-${d.debt_id}`}>
                    <td className={`px-4 py-3 font-medium ${textPrimary}`}>{d.debt_name}</td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{d.debt_type || '-'}</td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{d.lender_name || '-'}</td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{fmtDate(d.disbursed_date)}</td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{CYCLE_LABEL[d.cycle] || d.cycle}</td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{fmtDate(d.due_date)}</td>
                    <td className={`px-4 py-3 ${textPrimary}`}>{fmtMoney(d.amount)}</td>
                    <td className="px-4 py-3">
                      <Badge className={d.status === 'active' ? 'bg-[#22c55e]/15 text-[#16a34a]' : 'bg-gray-400/15 text-gray-500'}>
                        {d.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(d)} className="text-[#6366f1] hover:opacity-70 mr-3" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteDebt(d.debt_id)} className="text-[#ef4444] hover:opacity-70" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {innerTab === 'due' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={dueMonth}
              onChange={(e) => setDueMonth(parseInt(e.target.value))}
              className={`px-3 py-2 rounded-md text-sm ${bgInput} border ${borderColor} ${textPrimary}`}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <Input
              type="number"
              value={dueYear}
              onChange={(e) => setDueYear(parseInt(e.target.value))}
              className={`w-24 ${bgInput} ${borderColor}`}
              min="2020"
              max="2030"
            />
          </div>

          <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
            {loadingDue ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : dueRows.length === 0 ? (
              <p className={`text-sm ${textSecondary} text-center py-12`}>No debts due this month.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className={bgInput}>
                  <tr>
                    <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Debt Name</th>
                    <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Type</th>
                    <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Due Date</th>
                    <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Amount</th>
                    <th className={`text-left px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Status</th>
                    <th className={`text-right px-4 py-2.5 text-xs font-medium uppercase ${textSecondary}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${borderColor}`}>
                  {dueRows.map(row => (
                    <tr key={`${row.debt_id}-${row.period_key}`} data-testid={`due-row-${row.debt_id}-${row.period_key}`}>
                      <td className={`px-4 py-3 font-medium ${textPrimary}`}>{row.debt_name}</td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{row.debt_type || '-'}</td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{fmtDate(row.due_date)}</td>
                      <td className={`px-4 py-3 ${textPrimary}`}>{fmtMoney(row.amount)}</td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_STYLE[row.status]}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.status === 'collected' ? (
                          <button onClick={() => undoCollected(row)} className={`text-xs ${textSecondary} hover:underline`}>
                            Undo
                          </button>
                        ) : (
                          <Button size="sm" onClick={() => markCollected(row)} className="bg-[#22c55e] hover:bg-[#16a34a] h-7 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Collected
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className={`${bgCard} border ${borderColor}`}>
          <DialogHeader>
            <DialogTitle className={textPrimary}>{editingId ? 'Edit Debt' : 'Add Debt'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className={textPrimary}>Debt Name</Label>
              <Input
                value={form.debt_name}
                onChange={(e) => setForm(prev => ({ ...prev, debt_name: e.target.value }))}
                placeholder="e.g. Office Loan EMI"
                className={`${bgInput} ${borderColor} ${textPrimary}`}
              />
            </div>
            <div>
              <Label className={textPrimary}>Debt Type</Label>
              <Input
                value={form.debt_type}
                onChange={(e) => setForm(prev => ({ ...prev, debt_type: e.target.value }))}
                placeholder="e.g. Loan, Subscription, Vendor"
                className={`${bgInput} ${borderColor} ${textPrimary}`}
              />
            </div>
            <div>
              <Label className={textPrimary}>Cycle</Label>
              <Select value={form.cycle} onValueChange={(v) => setForm(prev => ({ ...prev, cycle: v }))}>
                <SelectTrigger className={`${bgInput} border ${borderColor} ${textPrimary}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One time</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={textPrimary}>
                {form.cycle === 'one_time' ? 'Due Date' : 'First Due Date'}
              </Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                className={`${bgInput} ${borderColor} ${textPrimary}`}
              />
              {form.cycle !== 'one_time' && (
                <p className={`text-xs ${textSecondary} mt-1`}>
                  {form.cycle === 'monthly' ? 'Repeats every month on this day.' : 'Repeats every year on this month/day.'}
                </p>
              )}
            </div>
            <div>
              <Label className={textPrimary}>Amount</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
                className={`${bgInput} ${borderColor} ${textPrimary}`}
              />
            </div>
            <div>
              <Label className={textPrimary}>Loan Giver Name</Label>
              <Input
                value={form.lender_name}
                onChange={(e) => setForm(prev => ({ ...prev, lender_name: e.target.value }))}
                placeholder="e.g. HDFC Bank"
                className={`${bgInput} ${borderColor} ${textPrimary}`}
              />
            </div>
            <div>
              <Label className={textPrimary}>Loan Disbursed Date</Label>
              <Input
                type="date"
                value={form.disbursed_date}
                onChange={(e) => setForm(prev => ({ ...prev, disbursed_date: e.target.value }))}
                className={`${bgInput} ${borderColor} ${textPrimary}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} className={borderColor}>Cancel</Button>
            <Button onClick={saveDebt} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? 'Save Changes' : 'Add Debt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebtsTab;
