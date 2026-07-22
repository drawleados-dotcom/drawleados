import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Wallet, ChevronRight, X, FolderOpen, ChevronLeft, Calendar } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// "Month key" is `YYYY-MM`. `all` reserved for "All time" (no month clip).
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const fmtMonth = (key) => {
  if (!key || key === 'all') return 'All Time';
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};
const shiftMonth = (key, delta) => {
  if (!key || key === 'all') return monthKey(new Date());
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
};

export default function FinancePaymentScheduleTab({ isDark, token }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [collectingId, setCollectingId] = useState(null);
  const [me, setMe] = useState(null);

  // Filters
  // `monthFilter` is a YYYY-MM key (e.g. "2026-06") or "all" for All Time.
  // Defaults to the current calendar month so the dashboard "opens on today".
  const [monthFilter, setMonthFilter] = useState(monthKey());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const canCollect = useMemo(() => {
    const r = (me?.role || '').toLowerCase();
    return ['super_admin', 'admin', 'finance'].includes(r);
  }, [me]);

  const loadProjects = async () => {
    try {
      const res = await axios.get(`${API}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
      setProjects((res.data || []).filter((p) => p.payment_schedule));
    } catch (e) {
      toast.error('Failed to load projects');
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [pRes, meRes] = await Promise.all([
          axios.get(`${API}/api/projects`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!active) return;
        setProjects((pRes.data || []).filter((p) => p.payment_schedule));
        setMe(meRes.data?.user || meRes.data || null);
      } catch (e) {
        toast.error('Failed to load projects');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

  const handleInvoiceReq = async (projectId, splitId) => {
    if (!canCollect) return;
    setCollectingId(splitId);
    try {
      const res = await axios.post(
        `${API}/api/projects/${projectId}/payment-schedule/${splitId}/invoice-req`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(`Invoice raised · ${res.data.invoice_number}`);
      await loadProjects();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to raise invoice');
    } finally {
      setCollectingId(null);
    }
  };

  const bgCard = isDark ? 'bg-white dark:bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-gray-100 dark:bg-[#27272a]' : 'bg-gray-50';
  const textPrimary = isDark ? 'text-gray-900 dark:text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-600 dark:text-[#a1a1aa]' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-200 dark:border-[#27272a]' : 'border-gray-200';

  // (project + me loaded in the effect above)

  // Flatten all splits across all projects (for rows view + summary)
  const allRows = useMemo(() => {
    const rows = [];
    projects.forEach((p) => {
      const sch = p.payment_schedule || {};
      (sch.splits || []).forEach((sp) => {
        rows.push({
          project_id: p.project_id,
          project_name: p.name,
          schedule_type: sch.type || 'one_time',
          recurrence: sch.recurrence || '',
          currency: sch.currency || 'INR',
          departments: p.departments || [],
          ...sp,
        });
      });
    });
    return rows;
  }, [projects]);

  // Apply month / date-range filters on expected_date.
  // monthFilter is "YYYY-MM" → match the row's year+month; "all" disables it.
  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      const d = r.expected_date || '';
      if (monthFilter !== 'all') {
        // Compare against YYYY-MM (first 7 chars of "YYYY-MM-DD")
        if (!d || d.slice(0, 7) !== monthFilter) return false;
      }
      if (fromDate && (!d || d < fromDate)) return false;
      if (toDate && (!d || d > toDate)) return false;
      return true;
    });
  }, [allRows, monthFilter, fromDate, toDate]);

  // All distinct YYYY-MM month keys actually present in the schedules — feeds
  // the jump dropdown. We also always include the current month so the user
  // can land on "this month" even when there's nothing scheduled yet.
  const availableMonths = useMemo(() => {
    const set = new Set();
    set.add(monthKey()); // current month always reachable
    allRows.forEach(r => {
      const d = r.expected_date || '';
      if (d && d.length >= 7) set.add(d.slice(0, 7));
    });
    return Array.from(set).sort(); // chronological
  }, [allRows]);

  // Summary totals (driven by filtered rows)
  const totals = useMemo(() => {
    const total = filteredRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const collected = filteredRows.filter(r => r.collected).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    return { total, collected, pending: total - collected };
  }, [filteredRows]);

  // Group filtered rows by project for the rows-then-detail flow
  const projectsView = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((r) => {
      if (!map.has(r.project_id)) {
        map.set(r.project_id, {
          project_id: r.project_id,
          project_name: r.project_name,
          currency: r.currency,
          departments: r.departments || [],
          splits: [],
        });
      }
      map.get(r.project_id).splits.push(r);
    });
    return Array.from(map.values()).map(p => {
      const total = p.splits.reduce((a, s) => a + (Number(s.amount) || 0), 0);
      const collected = p.splits.filter(s => s.collected).reduce((a, s) => a + (Number(s.amount) || 0), 0);
      const dates = p.splits.map(s => s.expected_date).filter(Boolean).sort();
      return {
        ...p,
        total,
        collected,
        pending: total - collected,
        start_date: dates[0] || null,
        due_date: dates[dates.length - 1] || null,
      };
    });
  }, [filteredRows]);

  const selected = useMemo(
    () => projects.find(p => p.project_id === selectedProject?.project_id) || null,
    [projects, selectedProject],
  );

  return (
    <div className="space-y-4" data-testid="finance-payment-schedule-tab">
      {/* Month navigator — arrow-style switcher just like Week-Wise.
          Lets users jump month-by-month with ← / → buttons and pick any
          available month (or All Time) from the dropdown on the right.
          The From/To inputs remain available for custom-range queries. */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMonthFilter(prev => prev === 'all' ? monthKey() : shiftMonth(prev, -1))}
                className={`h-9 w-9 ${borderColor}`}
                title="Previous month"
                data-testid="finance-pay-month-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 py-1.5 min-w-[180px] text-center">
                <p className={`text-base font-semibold ${textPrimary}`} data-testid="finance-pay-month-label">
                  {fmtMonth(monthFilter)}
                </p>
                {monthFilter !== 'all' && (
                  <p className={`text-[10px] ${textSecondary}`}>{filteredRows.length} payment splits</p>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMonthFilter(prev => prev === 'all' ? monthKey() : shiftMonth(prev, 1))}
                className={`h-9 w-9 ${borderColor}`}
                title="Next month"
                data-testid="finance-pay-month-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {monthFilter === monthKey() && (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> This Month
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
                data-testid="finance-pay-month-filter"
              >
                <option value="all">All Time</option>
                {availableMonths.map(k => <option key={k} value={k}>{fmtMonth(k)}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${textSecondary}`}>From</span>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={`h-9 ${bgSecondary} border ${borderColor} ${textPrimary} text-sm w-[150px]`}
                  data-testid="finance-pay-from"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${textSecondary}`}>To</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className={`h-9 ${bgSecondary} border ${borderColor} ${textPrimary} text-sm w-[150px]`}
                  data-testid="finance-pay-to"
                />
              </div>
              {(monthFilter !== monthKey() || fromDate || toDate) && (
                <Button variant="outline" size="sm" onClick={() => { setMonthFilter(monthKey()); setFromDate(''); setToDate(''); }} className={`${borderColor} h-9`} data-testid="finance-pay-clear">
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4">
            <p className={`text-xs ${textSecondary}`}>Total Value</p>
            <p className={`text-2xl font-bold ${textPrimary}`} data-testid="finance-pay-total">
              ₹ {totals.total.toLocaleString()}
            </p>
            <p className={`text-[10px] ${textSecondary} mt-0.5`}>{filteredRows.length} payment splits</p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4">
            <p className={`text-xs ${textSecondary}`}>Collected</p>
            <p className="text-2xl font-bold text-[#10b981]" data-testid="finance-pay-collected">
              ₹ {totals.collected.toLocaleString()}
            </p>
            <p className={`text-[10px] ${textSecondary} mt-0.5`}>
              {totals.total > 0 ? `${Math.round((totals.collected / totals.total) * 100)}% received` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className={`${bgCard} border ${borderColor}`}>
          <CardContent className="p-4">
            <p className={`text-xs ${textSecondary}`}>Pending</p>
            <p className="text-2xl font-bold text-[#f59e0b]" data-testid="finance-pay-pending">
              ₹ {totals.pending.toLocaleString()}
            </p>
            <p className={`text-[10px] ${textSecondary} mt-0.5`}>
              {filteredRows.filter(r => !r.collected).length} unpaid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projects rows */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          {loading ? (
            <div className={`p-8 text-center ${textSecondary}`}>Loading…</div>
          ) : projectsView.length === 0 ? (
            <div className={`p-10 text-center ${textSecondary}`}>
              <Wallet className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No payment schedules found for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${borderColor}`}>
                    <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Project</th>
                    <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Departments</th>
                    <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Start</th>
                    <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Due</th>
                    <th className={`text-right p-3 text-xs font-medium ${textSecondary} uppercase`}>Splits</th>
                    <th className={`text-right p-3 text-xs font-medium ${textSecondary} uppercase`}>Total</th>
                    <th className={`text-right p-3 text-xs font-medium ${textSecondary} uppercase`}>Collected</th>
                    <th className={`text-right p-3 text-xs font-medium ${textSecondary} uppercase`}>Pending</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {projectsView.map((p) => (
                    <tr
                      key={p.project_id}
                      onClick={() => setSelectedProject(p)}
                      className={`border-b ${borderColor} cursor-pointer hover:${bgSecondary}`}
                      data-testid={`finance-pay-project-${p.project_id}`}
                    >
                      <td className={`p-3 ${textPrimary} flex items-center gap-2`}>
                        <FolderOpen className={`h-4 w-4 ${textSecondary}`} />
                        {p.project_name}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(p.departments || []).length === 0 ? (
                            <span className={`text-xs ${textSecondary} italic`}>—</span>
                          ) : (p.departments || []).map((d) => (
                            <Badge key={d} className="bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/30 text-[10px] pointer-events-none">
                              {d.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className={`p-3 ${textSecondary} text-sm`}>{p.start_date || '—'}</td>
                      <td className={`p-3 ${textSecondary} text-sm`}>{p.due_date || '—'}</td>
                      <td className={`p-3 text-right ${textSecondary}`}>{p.splits.length}</td>
                      <td className={`p-3 text-right ${textPrimary} font-medium`}>₹ {p.total.toLocaleString()}</td>
                      <td className={`p-3 text-right text-[#10b981]`}>₹ {p.collected.toLocaleString()}</td>
                      <td className={`p-3 text-right text-[#f59e0b]`}>₹ {p.pending.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <ChevronRight className={`h-4 w-4 ${textSecondary}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail modal: exact project's payment schedule */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4"
          onClick={() => setSelectedProject(null)}
          data-testid="finance-pay-detail-modal"
        >
          <Card
            className={`${bgCard} border ${borderColor} w-full max-w-3xl max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
                    <Wallet className="h-5 w-5 text-[#10b981]" />
                    {selected.name}
                  </h3>
                  <p className={`text-xs ${textSecondary}`}>
                    {selected.payment_schedule?.type === 'recurring'
                      ? `Recurring · ${selected.payment_schedule?.recurrence}`
                      : 'One-time'} · {selected.payment_schedule?.currency || 'INR'} {Number(selected.payment_schedule?.total_amount || 0).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => setSelectedProject(null)} className={textSecondary} data-testid="finance-pay-detail-close">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${borderColor}`}>
                      <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Label</th>
                      <th className={`text-right p-3 text-xs font-medium ${textSecondary} uppercase`}>Amount / %</th>
                      <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Mode</th>
                      <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Expected</th>
                      <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Status / Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.payment_schedule?.splits || []).map((sp) => (
                      <tr key={sp.id} className={`border-b ${borderColor}`}>
                        <td className={`p-3 ${textPrimary}`}>{sp.label}</td>
                        <td className={`p-3 text-right ${textPrimary} font-medium`}>
                          ₹ {Number(sp.amount || 0).toLocaleString()}
                          {sp.amount_type === 'percentage' && (
                            <span className={`ml-1 text-xs ${textSecondary}`}>({sp.percentage}%)</span>
                          )}
                        </td>
                        <td className={`p-3 ${textPrimary}`}>{sp.mode || '—'}</td>
                        <td className={`p-3 ${textPrimary}`}>{sp.expected_date || '—'}</td>
                        <td className="p-3">
                          {sp.collected ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-emerald-500/20 text-emerald-400 pointer-events-none">
                                Collected{sp.collected_date ? ` · ${sp.collected_date}` : ''}
                              </Badge>
                              {sp.invoice_number && (
                                <Badge className="bg-blue-500/20 text-blue-400 pointer-events-none">{sp.invoice_number}</Badge>
                              )}
                            </div>
                          ) : sp.invoice_raised ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-blue-500/20 text-blue-400 pointer-events-none">
                                Invoice Raised{sp.invoice_requested_at ? ` · ${sp.invoice_requested_at}` : ''}
                              </Badge>
                              {sp.invoice_number && (
                                <span className={`text-xs ${textSecondary}`}>{sp.invoice_number}</span>
                              )}
                            </div>
                          ) : canCollect ? (
                            <Button
                              size="sm"
                              onClick={() => handleInvoiceReq(selected.project_id, sp.id)}
                              disabled={collectingId === sp.id}
                              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white h-8 px-3"
                              data-testid={`finance-pay-invoice-req-${sp.id}`}
                            >
                              {collectingId === sp.id ? 'Raising…' : 'Invoice req'}
                            </Button>
                          ) : (
                            <Badge className="bg-amber-500/20 text-amber-400 pointer-events-none">Not collected</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={`text-xs ${textSecondary}`}>
                Only Super Admin / Admin / Finance can raise an invoice request — that creates a draft invoice under Invoice → Payment Schedule Invoice. Income is recorded later via Cashbook → Add Income.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
