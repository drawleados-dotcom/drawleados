/**
 * Budget view — Expense sub-tab.
 *
 * Lives next to Master Expense & Expense Split.
 *
 * Same shape as Master Expense (horizontal Top-Category pills + per-sub rows)
 * BUT every sub-category has an editable "Budget" amount for the selected
 * month/year. Spent is computed from cashbook debits tagged with
 * split_category_id; Balance = Budget − Spent.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Wallet, IndianRupee, Loader2, Save, Pencil, X } from 'lucide-react';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const API = process.env.REACT_APP_BACKEND_URL;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const BudgetView = () => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [loading, setLoading] = useState(true);
  const [tops, setTops] = useState([]);
  const [activeTopId, setActiveTopId] = useState(null);

  // Inline editing state — keyed by category_id
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/api/finance/expense-split/budgets?month=${month}&year=${year}`,
        { headers },
      );
      const cats = res.data?.categories || [];
      setTops(cats);
      setActiveTopId((prev) => {
        if (prev && cats.find((c) => c.category_id === prev)) return prev;
        return cats[0]?.category_id || null;
      });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const activeTop = tops.find((t) => t.category_id === activeTopId) || null;

  const startEdit = (sub) => {
    setEditingId(sub.category_id);
    setEditValue(String(sub.budget || 0));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveBudget = async (sub) => {
    const amount = parseFloat(editValue);
    if (isNaN(amount) || amount < 0) {
      toast.error('Enter a valid budget amount');
      return;
    }
    setSavingId(sub.category_id);
    try {
      await axios.put(
        `${API}/api/finance/expense-split/budgets/${sub.category_id}`,
        { amount, month, year },
        { headers },
      );
      toast.success('Budget updated');
      setEditingId(null);
      setEditValue('');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update budget');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4" data-testid="budget-view">
      {/* Header */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-[#10b981]" />
          <div>
            <h3 className="text-lg font-bold text-[#fafafa]">Budget</h3>
            <p className="text-xs text-[#a1a1aa]">Set a fixed budget per sub-category for the month. Cashbook expenses tagged to that sub-category reduce the balance.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[130px] bg-[#27272a] border-[#3f3f46] text-[#fafafa]" data-testid="budget-month-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[100px] bg-[#27272a] border-[#3f3f46] text-[#fafafa]" data-testid="budget-year-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{[2024, 2025, 2026, 2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-[#a1a1aa]">
          <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" /> Loading…
        </div>
      )}

      {!loading && tops.length === 0 && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12 text-center" data-testid="budget-empty">
          <Wallet className="h-10 w-10 mx-auto text-[#52525b] mb-3" />
          <p className="text-[#fafafa] font-medium mb-1">No expense categories yet</p>
          <p className="text-xs text-[#a1a1aa]">Add categories in the <b>Expense Split</b> tab to start budgeting.</p>
        </div>
      )}

      {!loading && tops.length > 0 && (
        <>
          {/* Dynamic top-category sub-tabs */}
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#18181b] border border-[#27272a] flex-wrap" data-testid="budget-tabs">
            {tops.map((c) => {
              const active = c.category_id === activeTopId;
              return (
                <button
                  key={c.category_id}
                  onClick={() => setActiveTopId(c.category_id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? 'bg-[#27272a] text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                  data-testid={`budget-tab-${c.category_id}`}
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* Active top header */}
          {activeTop && (
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#a1a1aa]">Top Category</p>
                <p className="text-lg font-bold text-[#fafafa]">{activeTop.name}</p>
              </div>
              <div className="flex items-center gap-4">
                <Stat l="Total Budget" v={fmt(activeTop.budget)} />
                <Stat l="Spent" v={fmt(activeTop.spent)} red={activeTop.over_budget} />
                <Stat l="Balance" v={fmt(activeTop.balance)} green={activeTop.balance >= 0} red={activeTop.balance < 0} />
              </div>
            </div>
          )}

          {/* Sub-categories — Budget editable */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#27272a] flex items-center justify-between">
              <p className="text-sm font-medium text-[#fafafa]">Sub-Categories — Budget for {MONTHS[month - 1]} {year}</p>
              <span className="text-xs text-[#a1a1aa]">{activeTop?.sub_categories?.length || 0} items</span>
            </div>
            <div className="divide-y divide-[#27272a]">
              {(activeTop?.sub_categories || []).length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-[#71717a]">
                  No sub-categories for <b>{activeTop?.name}</b>. Add one from the Expense Split tab.
                </div>
              )}
              {(activeTop?.sub_categories || []).map((s) => {
                const isEditing = editingId === s.category_id;
                const isSaving = savingId === s.category_id;
                return (
                  <div key={s.category_id} className="grid grid-cols-12 items-center gap-3 px-4 py-3" data-testid={`budget-sub-${s.category_id}`}>
                    <div className="col-span-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <p className="text-sm text-[#fafafa]">{s.name}</p>
                    </div>
                    <div className="col-span-3 text-right">
                      <p className="text-[10px] uppercase tracking-wide text-[#71717a]">Budget</p>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8 text-right bg-[#27272a] border-[#3f3f46] text-[#fafafa] text-sm"
                          data-testid={`budget-input-${s.category_id}`}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-semibold text-[#fafafa]">
                          <IndianRupee className="inline h-3 w-3 -mt-0.5" />{String(fmt(s.budget)).replace(/^₹/, '')}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2 text-right">
                      <Stat l="Spent" v={fmt(s.spent)} red={s.over_budget} />
                    </div>
                    <div className="col-span-2 text-right">
                      <Stat l="Balance" v={fmt(s.balance)} green={s.balance >= 0} red={s.balance < 0} />
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => saveBudget(s)}
                            disabled={isSaving}
                            className="h-7 w-7 p-0 bg-[#10b981] hover:bg-[#059669] text-white"
                            data-testid={`budget-save-${s.category_id}`}
                          >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="h-7 w-7 p-0 text-[#a1a1aa] hover:text-white"
                            data-testid={`budget-cancel-${s.category_id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(s)}
                          className="h-7 px-2 text-[#a78bfa] hover:bg-[#a78bfa]/10"
                          data-testid={`budget-edit-${s.category_id}`}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Stat = ({ l, v, red, green }) => (
  <div className="text-right min-w-[90px]">
    <p className="text-[10px] uppercase tracking-wide text-[#71717a]">{l}</p>
    <p className={`text-sm font-semibold ${red ? 'text-red-400' : green ? 'text-emerald-400' : 'text-[#fafafa]'}`}>
      <IndianRupee className="inline h-3 w-3 -mt-0.5" />{String(v).replace(/^₹/, '')}
    </p>
  </div>
);

export default BudgetView;
