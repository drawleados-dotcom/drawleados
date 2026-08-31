/**
 * Finance -> Expense -> Forecasting.
 *
 * A day-by-day planner for upcoming (or past) day-to-day expenses —
 * separate from the live Cashbook/Master Expense. "Add Expense" opens a
 * popup where multiple expense rows (Name/Amount/Remarks) are entered at
 * once for a single date; on save that batch lands on that date's card,
 * appending to it if the date already has one. Cards render as tiles
 * sorted date-ascending, each showing every line item plus the day's total.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CalendarClock, Plus, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog';

const API = process.env.REACT_APP_BACKEND_URL;
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const dayName = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' }) : '');
const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const todayIso = () => new Date().toISOString().slice(0, 10);
const emptyRow = () => ({ name: '', amount: '', remarks: '' });

const ExpenseForecastTab = () => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(todayIso());
  const [rows, setRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { forecast_id } | null

  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState(''); // "YYYY-MM"

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/finance/expense-forecast`, { headers });
      setDays(res.data || []);
    } catch (e) {
      toast.error('Failed to load Forecasting');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const dayTotal = (d) => (d.items || []).reduce((s, i) => s + Number(i.amount || 0), 0);

  const visibleDays = useMemo(() => {
    return days.filter((d) => {
      if (filterDate && d.date !== filterDate) return false;
      if (filterMonth && !d.date.startsWith(filterMonth)) return false;
      return true;
    });
  }, [days, filterDate, filterMonth]);

  const filteredTotal = visibleDays.reduce((s, d) => s + dayTotal(d), 0);

  const openAdd = () => {
    setModalDate(todayIso());
    setRows([emptyRow()]);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const updateRow = (idx, patch) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (idx) => setRows((rs) => (rs.length > 1 ? rs.filter((_, i) => i !== idx) : rs));
  const rowsTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const save = async () => {
    const validRows = rows.filter((r) => r.name.trim());
    if (!modalDate) { toast.error('Pick a date'); return; }
    if (validRows.length === 0) { toast.error('Add at least one expense row'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/api/finance/expense-forecast`, {
        date: modalDate,
        items: validRows.map((r) => ({ name: r.name.trim(), amount: Number(r.amount) || 0, remarks: r.remarks.trim() })),
      }, { headers });
      toast.success('Expense forecast saved');
      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteDay = async () => {
    if (!confirmDelete) return;
    try {
      await axios.delete(`${API}/api/finance/expense-forecast/${confirmDelete.forecast_id}`, { headers });
      toast.success('Removed');
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const deleteItem = async (forecastId, itemId) => {
    try {
      await axios.delete(`${API}/api/finance/expense-forecast/${forecastId}/items/${itemId}`, { headers });
      await load();
    } catch (e) {
      toast.error('Failed to delete row');
    }
  };

  return (
    <div className="space-y-4" data-testid="finance-expense-forecast-tab">
      <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-violet-600 dark:text-[#a78bfa]" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-[#fafafa]">Forecasting</h3>
            <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">Plan day-to-day expenses for upcoming days</p>
          </div>
        </div>
        <Button onClick={openAdd} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="forecast-add-btn">
          <Plus className="h-4 w-4 mr-1" /> Add Expense
        </Button>
      </div>

      <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setFilterMonth(''); }}
            className="h-9 w-[160px] bg-gray-100 dark:bg-[#27272a] border-gray-300 dark:border-[#3f3f46] text-gray-900 dark:text-[#fafafa]"
            data-testid="forecast-filter-date"
          />
          <Input
            type="month"
            value={filterMonth}
            onChange={(e) => { setFilterMonth(e.target.value); setFilterDate(''); }}
            className="h-9 w-[160px] bg-gray-100 dark:bg-[#27272a] border-gray-300 dark:border-[#3f3f46] text-gray-900 dark:text-[#fafafa]"
            data-testid="forecast-filter-month"
          />
          {(filterDate || filterMonth) && (
            <button
              type="button"
              onClick={() => { setFilterDate(''); setFilterMonth(''); }}
              className="text-xs text-gray-500 dark:text-[#a1a1aa] hover:underline"
              data-testid="forecast-filter-clear"
            >
              Clear
            </button>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-[#71717a]">
            {filterMonth ? 'Total for month' : filterDate ? 'Total for date' : 'Total (all)'}
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-[#fafafa]">{fmt(filteredTotal)}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-600 dark:text-[#a1a1aa]">
          <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" /> Loading…
        </div>
      ) : visibleDays.length === 0 ? (
        <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-12 text-center" data-testid="forecast-empty">
          <CalendarClock className="h-10 w-10 mx-auto text-gray-400 dark:text-[#52525b] mb-3" />
          <p className="text-gray-900 dark:text-[#fafafa] font-medium mb-1">No planned expenses</p>
          <p className="text-xs text-gray-600 dark:text-[#a1a1aa]">Click <b>Add Expense</b> to plan a day's spend.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleDays.map((d) => (
            <div key={d.forecast_id} className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl overflow-hidden" data-testid={`forecast-day-${d.forecast_id}`}>
              <div className="px-4 py-3 border-b border-gray-200 dark:border-[#27272a] flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-[#fafafa]">{fmtDate(d.date)}</p>
                  <p className="text-[11px] text-gray-500 dark:text-[#71717a]">{dayName(d.date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-[#71717a]">Total</p>
                    <p className="text-base font-bold text-gray-900 dark:text-[#fafafa]">{fmt(dayTotal(d))}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete({ forecast_id: d.forecast_id })}
                    className="p-1.5 text-red-500 hover:text-red-600"
                    title="Delete this day"
                    data-testid={`forecast-day-delete-${d.forecast_id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-[#27272a]">
                {(d.items || []).map((it) => (
                  <div key={it.item_id} className="flex items-center gap-3 px-4 py-2.5" data-testid={`forecast-item-${it.item_id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-[#fafafa] truncate">{it.name}</p>
                      {it.remarks && <p className="text-[11px] text-gray-500 dark:text-[#71717a] truncate">{it.remarks}</p>}
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">{fmt(it.amount)}</p>
                    <button
                      type="button"
                      onClick={() => deleteItem(d.forecast_id, it.item_id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="Remove row"
                      data-testid={`forecast-item-delete-${it.item_id}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Expense modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] max-w-lg" data-testid="forecast-add-modal">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-[#fafafa]">Add Expense</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-[#a1a1aa]">
              Plan one or more expenses for a date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-600 dark:text-[#a1a1aa]">Date</Label>
              <Input
                type="date"
                value={modalDate}
                onChange={(e) => setModalDate(e.target.value)}
                data-testid="forecast-form-date"
              />
              {modalDate && <p className="text-[11px] text-gray-500 dark:text-[#71717a] mt-1">{dayName(modalDate)}</p>}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {rows.map((r, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_1fr_auto] gap-2 items-start" data-testid={`forecast-form-row-${idx}`}>
                  <Input
                    value={r.name}
                    onChange={(e) => updateRow(idx, { name: e.target.value })}
                    placeholder="Expense name"
                    data-testid={`forecast-form-row-name-${idx}`}
                  />
                  <Input
                    type="number" min="0"
                    value={r.amount}
                    onChange={(e) => updateRow(idx, { amount: e.target.value })}
                    placeholder="Amount"
                    data-testid={`forecast-form-row-amount-${idx}`}
                  />
                  <Input
                    value={r.remarks}
                    onChange={(e) => updateRow(idx, { remarks: e.target.value })}
                    placeholder="Remarks"
                    data-testid={`forecast-form-row-remarks-${idx}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    disabled={rows.length === 1}
                    className="h-9 px-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remove row"
                    data-testid={`forecast-form-row-remove-${idx}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addRow} className="w-full border-dashed" data-testid="forecast-form-add-row">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
            </Button>

            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-[#0c0a09] border border-gray-200 dark:border-[#27272a]">
              <p className="text-sm font-medium text-gray-900 dark:text-[#fafafa]">Total</p>
              <p className="text-lg font-bold text-gray-900 dark:text-[#fafafa]" data-testid="forecast-form-total">{fmt(rowsTotal)}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeModal} className="border-gray-200 dark:border-[#27272a]">Cancel</Button>
              <Button onClick={save} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="forecast-form-save">
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] max-w-sm" data-testid="forecast-delete-modal">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-[#fafafa]">Delete this day's plan?</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-[#a1a1aa]">
              This removes every planned expense for that date. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)} className="border-gray-200 dark:border-[#27272a]">Cancel</Button>
            <Button onClick={deleteDay} className="bg-red-500 hover:bg-red-600 text-white" data-testid="forecast-delete-confirm">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseForecastTab;
