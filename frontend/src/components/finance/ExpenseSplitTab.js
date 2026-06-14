/**
 * Expense Split — % allocation of monthly income across top + sub categories.
 *
 *  Income (cashbook credits for selected month/year)
 *  └── Top Category  (% of Income)        e.g.  Overhead  30%
 *        └── Sub Category  (% of Top)     e.g.    Rent    50% of Overhead
 *
 * The % is a soft cap — over-budget rows go red but expenses are not blocked.
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, ChevronDown, ChevronRight, Edit2, Trash2, Check, X,
  Layers, AlertTriangle, TrendingUp, Loader2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../ui/select';

const API = process.env.REACT_APP_BACKEND_URL;
const months = [
  { v: 1, l: 'January' }, { v: 2, l: 'February' }, { v: 3, l: 'March' },
  { v: 4, l: 'April' }, { v: 5, l: 'May' }, { v: 6, l: 'June' },
  { v: 7, l: 'July' }, { v: 8, l: 'August' }, { v: 9, l: 'September' },
  { v: 10, l: 'October' }, { v: 11, l: 'November' }, { v: 12, l: 'December' },
];
const COLORS = ['#fb7185', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#22d3ee', '#facc15'];
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const ExpenseSplitTab = () => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState(0);
  const [categories, setCategories] = useState([]);
  const [totalPct, setTotalPct] = useState(0);
  const [expanded, setExpanded] = useState({});

  // Add modal — used for both top + sub
  const [addModal, setAddModal] = useState(null); // { parent_id?, parent_name? } or null
  const [form, setForm] = useState({ name: '', percent: '', color: COLORS[0] });
  const [saving, setSaving] = useState(false);

  // Inline edit row
  const [editing, setEditing] = useState(null); // category_id
  const [editForm, setEditForm] = useState({ name: '', percent: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/finance/expense-split/categories`, {
        params: { month, year }, headers,
      });
      setIncome(res.data.income || 0);
      setCategories(res.data.categories || []);
      setTotalPct(res.data.total_allocated_percent || 0);
    } catch (e) {
      toast.error('Failed to load expense split');
    } finally {
      setLoading(false);
    }
  }, [month, year, token]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openAdd = (parent) => {
    setForm({ name: '', percent: '', color: parent ? parent.color : COLORS[categories.length % COLORS.length] });
    setAddModal(parent ? { parent_id: parent.category_id, parent_name: parent.name } : {});
  };

  const submitAdd = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const pct = parseFloat(form.percent);
    if (Number.isNaN(pct) || pct < 0) { toast.error('Enter a valid percentage'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/api/finance/expense-split/categories`, {
        name: form.name.trim(),
        percent: pct,
        parent_id: addModal?.parent_id || null,
        color: form.color,
      }, { headers });
      toast.success(`${addModal?.parent_id ? 'Sub-category' : 'Top category'} added`);
      setAddModal(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat) => {
    setEditing(cat.category_id);
    setEditForm({ name: cat.name, percent: String(cat.percent) });
  };

  const saveEdit = async (cat) => {
    const pct = parseFloat(editForm.percent);
    if (!editForm.name.trim() || Number.isNaN(pct) || pct < 0) {
      toast.error('Invalid name or percent'); return;
    }
    try {
      await axios.put(`${API}/api/finance/expense-split/categories/${cat.category_id}`, {
        name: editForm.name.trim(), percent: pct,
      }, { headers });
      toast.success('Updated');
      setEditing(null);
      load();
    } catch (e) {
      toast.error('Failed to update');
    }
  };

  const remove = async (cat) => {
    const msg = cat.sub_categories?.length
      ? `Delete "${cat.name}" and its ${cat.sub_categories.length} sub-categories?`
      : `Delete "${cat.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await axios.delete(`${API}/api/finance/expense-split/categories/${cat.category_id}`, { headers });
      toast.success('Deleted');
      load();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const overAllocated = totalPct > 100;
  const totalAllocatedAmount = categories.reduce((s, c) => s + (c.allocated || 0), 0);
  const totalSpent = categories.reduce((s, c) => s + (c.spent || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#a78bfa]" />
            <div>
              <h3 className="text-lg font-bold text-[#fafafa]">Expense Split</h3>
              <p className="text-xs text-[#a1a1aa]">Allocate income across top & sub categories by locked percentage</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
              <SelectTrigger className="w-[130px] bg-[#27272a] border-[#3f3f46] text-[#fafafa]" data-testid="split-month-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m.v} value={String(m.v)}>{m.l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-[100px] bg-[#27272a] border-[#3f3f46] text-[#fafafa]" data-testid="split-year-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => openAdd(null)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="split-add-top-btn">
              <Plus className="h-4 w-4 mr-1" /> Top Category
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Income (Period)" value={fmt(income)} accent="emerald" icon={TrendingUp} />
        <StatCard
          label="Allocated %"
          value={`${totalPct.toFixed(1)}%`}
          accent={overAllocated ? 'red' : 'indigo'}
          icon={Layers}
          tag={overAllocated ? 'Over 100%' : null}
        />
        <StatCard label="Allocated ₹" value={fmt(totalAllocatedAmount)} accent="indigo" icon={Layers} />
        <StatCard label="Spent ₹" value={fmt(totalSpent)} accent={totalSpent > totalAllocatedAmount && totalAllocatedAmount > 0 ? 'red' : 'amber'} icon={TrendingUp} />
      </div>

      {overAllocated && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          <AlertTriangle className="h-4 w-4" />
          Top categories total {totalPct.toFixed(1)}% — over 100% of income.
        </div>
      )}

      {/* Categories */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-12 text-[#a1a1aa]">
            <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" />
            Loading…
          </div>
        )}
        {!loading && categories.length === 0 && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12 text-center" data-testid="split-empty">
            <Layers className="h-10 w-10 mx-auto text-[#52525b] mb-3" />
            <p className="text-[#fafafa] font-medium mb-1">No top categories yet</p>
            <p className="text-xs text-[#a1a1aa] mb-4">Create your first top category (e.g. Overhead 30%) to start splitting income.</p>
            <Button onClick={() => openAdd(null)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white">
              <Plus className="h-4 w-4 mr-1" /> Add Top Category
            </Button>
          </div>
        )}

        {!loading && categories.map((cat) => {
          const isOpen = expanded[cat.category_id];
          const subPctTotal = (cat.sub_categories || []).reduce((s, x) => s + Number(x.percent || 0), 0);
          const subsOver = subPctTotal > 100;
          return (
            <div key={cat.category_id} className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden" data-testid={`split-top-${cat.category_id}`}>
              {/* Top row */}
              <div className="flex items-center gap-3 p-3">
                <button
                  onClick={() => setExpanded({ ...expanded, [cat.category_id]: !isOpen })}
                  className="text-[#a1a1aa] hover:text-[#fafafa]"
                  data-testid={`split-expand-${cat.category_id}`}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />

                {editing === cat.category_id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="h-8 bg-[#0c0a09] border-[#27272a] text-[#fafafa] text-sm" />
                    <Input type="number" value={editForm.percent} onChange={(e) => setEditForm({ ...editForm, percent: e.target.value })}
                      className="h-8 w-20 bg-[#0c0a09] border-[#27272a] text-[#fafafa] text-sm" />
                    <span className="text-xs text-[#a1a1aa]">%</span>
                    <Button size="sm" onClick={() => saveEdit(cat)} className="bg-emerald-600 hover:bg-emerald-700 h-7 px-2"><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="h-7 px-2 text-[#a1a1aa]"><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <>
                    <span className="font-semibold text-[#fafafa]">{cat.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-[#27272a] text-[#a1a1aa]">{cat.percent}%</span>
                    {cat.over_budget && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400">OVER BUDGET</span>
                    )}
                  </>
                )}

                <div className="ml-auto flex items-center gap-4 text-xs">
                  <Stat l="Allocated" v={fmt(cat.allocated)} />
                  <Stat l="Spent" v={fmt(cat.spent)} red={cat.over_budget} />
                  <Stat l="Balance" v={fmt(cat.balance)} red={cat.balance < 0} />
                </div>

                <div className="flex items-center gap-1 ml-2">
                  <Button size="sm" variant="ghost" onClick={() => openAdd(cat)} className="text-[#a1a1aa] hover:text-[#fafafa] h-7 w-7 p-0" title="Add Sub Category" data-testid={`split-add-sub-${cat.category_id}`}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  {editing !== cat.category_id && (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(cat)} className="text-[#a1a1aa] hover:text-[#fafafa] h-7 w-7 p-0" title="Edit"><Edit2 className="h-3.5 w-3.5" /></Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(cat)} className="text-red-400 hover:bg-red-500/10 h-7 w-7 p-0" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-3 pb-2">
                <div className="h-1.5 rounded-full bg-[#27272a] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${cat.over_budget ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, (cat.spent / Math.max(cat.allocated || 1, 1)) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Sub-categories */}
              {isOpen && (
                <div className="border-t border-[#27272a] bg-[#0c0a09]">
                  {subsOver && (
                    <div className="px-4 py-2 text-[11px] text-red-400 bg-red-500/5 border-b border-red-500/20 flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3" /> Sub-categories total {subPctTotal.toFixed(1)}% — over 100% of {cat.name}&apos;s bucket.
                    </div>
                  )}
                  {(cat.sub_categories || []).length === 0 ? (
                    <div className="px-4 py-4 text-center text-xs text-[#71717a]">
                      No sub-categories. <button onClick={() => openAdd(cat)} className="text-[#a78bfa] hover:underline">Add one</button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#27272a]">
                      {(cat.sub_categories || []).map((sub) => (
                        <div key={sub.category_id} className="flex items-center gap-3 px-4 py-2.5 pl-10" data-testid={`split-sub-${sub.category_id}`}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0 opacity-60" style={{ backgroundColor: sub.color }} />
                          {editing === sub.category_id ? (
                            <div className="flex-1 flex items-center gap-2">
                              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="h-7 bg-[#18181b] border-[#27272a] text-[#fafafa] text-xs" />
                              <Input type="number" value={editForm.percent} onChange={(e) => setEditForm({ ...editForm, percent: e.target.value })}
                                className="h-7 w-16 bg-[#18181b] border-[#27272a] text-[#fafafa] text-xs" />
                              <span className="text-xs text-[#a1a1aa]">% of {cat.name}</span>
                              <Button size="sm" onClick={() => saveEdit(sub)} className="bg-emerald-600 hover:bg-emerald-700 h-6 px-2"><Check className="h-3 w-3" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="h-6 px-2 text-[#a1a1aa]"><X className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm text-[#fafafa]">{sub.name}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#27272a] text-[#a1a1aa]">{sub.percent}%</span>
                              {sub.over_budget && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400">OVER</span>
                              )}
                            </>
                          )}
                          <div className="ml-auto flex items-center gap-4 text-xs">
                            <Stat l="Alloc" v={fmt(sub.allocated)} compact />
                            <Stat l="Spent" v={fmt(sub.spent)} red={sub.over_budget} compact />
                            <Stat l="Bal" v={fmt(sub.balance)} red={sub.balance < 0} compact />
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            {editing !== sub.category_id && (
                              <Button size="sm" variant="ghost" onClick={() => startEdit(sub)} className="text-[#a1a1aa] hover:text-[#fafafa] h-6 w-6 p-0"><Edit2 className="h-3 w-3" /></Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => remove(sub)} className="text-red-400 hover:bg-red-500/10 h-6 w-6 p-0"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      <Dialog open={!!addModal} onOpenChange={(o) => !o && setAddModal(null)}>
        <DialogContent className="bg-[#18181b] border border-[#27272a] text-[#fafafa] max-w-md" data-testid="split-add-modal">
          <DialogHeader>
            <DialogTitle>
              {addModal?.parent_id ? `Add Sub-Category to ${addModal.parent_name}` : 'Add Top Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-[#fafafa]">Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={addModal?.parent_id ? 'e.g. Rent' : 'e.g. Overhead'}
                className="bg-[#0c0a09] border-[#27272a] text-[#fafafa]"
                autoFocus
                data-testid="split-name-input"
              />
            </div>
            <div>
              <Label className="text-[#fafafa]">
                Percent *{' '}
                <span className="text-[#71717a] text-xs font-normal">
                  ({addModal?.parent_id ? `of ${addModal.parent_name}'s bucket` : 'of Income'})
                </span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={form.percent}
                  onChange={(e) => setForm({ ...form, percent: e.target.value })}
                  placeholder="e.g. 30"
                  step="0.1"
                  min="0"
                  className="bg-[#0c0a09] border-[#27272a] text-[#fafafa]"
                  data-testid="split-percent-input"
                />
                <span className="text-[#a1a1aa]">%</span>
              </div>
              {form.percent && !addModal?.parent_id && (
                <p className="text-xs text-[#a1a1aa] mt-1">
                  = {fmt((income * parseFloat(form.percent || 0)) / 100)} for {months[month - 1].l} {year}
                </p>
              )}
            </div>
            <div>
              <Label className="text-[#fafafa]">Color</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddModal(null)} className="text-[#a1a1aa]">Cancel</Button>
            <Button onClick={submitAdd} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="split-save-btn">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ label, value, accent = 'indigo', icon: Icon, tag }) => {
  const colors = {
    indigo: 'text-[#a78bfa]',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
  };
  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] uppercase tracking-wide text-[#a1a1aa]">{label}</p>
        {Icon && <Icon className={`h-4 w-4 ${colors[accent]}`} />}
      </div>
      <p className={`text-lg font-bold ${colors[accent]}`}>{value}</p>
      {tag && <p className="text-[10px] text-red-400 mt-0.5">{tag}</p>}
    </div>
  );
};

const Stat = ({ l, v, red, compact }) => (
  <div className={compact ? 'text-right min-w-[55px]' : 'text-right min-w-[80px]'}>
    <p className="text-[10px] uppercase tracking-wide text-[#71717a]">{l}</p>
    <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold ${red ? 'text-red-400' : 'text-[#fafafa]'}`}>{v}</p>
  </div>
);

export default ExpenseSplitTab;
