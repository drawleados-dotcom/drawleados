import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Wallet, ChevronRight, X, FolderOpen } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const MONTHS = [
  { id: 'all', label: 'All months' },
  ...Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1).padStart(2, '0'),
    label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
  })),
];

export default function FinancePaymentScheduleTab({ isDark, token }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

  // Filters
  const [monthFilter, setMonthFilter] = useState('all'); // MM or 'all'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-50';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
        if (!active) return;
        const withPay = (res.data || []).filter((p) => p.payment_schedule);
        setProjects(withPay);
      } catch (e) {
        toast.error('Failed to load projects');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

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
          ...sp,
        });
      });
    });
    return rows;
  }, [projects]);

  // Apply date / month filters on expected_date
  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      const d = r.expected_date || '';
      if (monthFilter !== 'all') {
        if (!d || d.slice(5, 7) !== monthFilter) return false;
      }
      if (fromDate && (!d || d < fromDate)) return false;
      if (toDate && (!d || d > toDate)) return false;
      return true;
    });
  }, [allRows, monthFilter, fromDate, toDate]);

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
        map.set(r.project_id, { project_id: r.project_id, project_name: r.project_name, currency: r.currency, splits: [] });
      }
      map.get(r.project_id).splits.push(r);
    });
    return Array.from(map.values()).map(p => {
      const total = p.splits.reduce((a, s) => a + (Number(s.amount) || 0), 0);
      const collected = p.splits.filter(s => s.collected).reduce((a, s) => a + (Number(s.amount) || 0), 0);
      return { ...p, total, collected, pending: total - collected };
    });
  }, [filteredRows]);

  const selected = useMemo(
    () => projects.find(p => p.project_id === selectedProject?.project_id) || null,
    [projects, selectedProject],
  );

  return (
    <div className="space-y-4" data-testid="finance-payment-schedule-tab">
      {/* Filters */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${textSecondary}`}>Month</span>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className={`h-9 px-3 rounded-lg border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
              data-testid="finance-pay-month-filter"
            >
              {MONTHS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
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
          {(monthFilter !== 'all' || fromDate || toDate) && (
            <Button variant="outline" size="sm" onClick={() => { setMonthFilter('all'); setFromDate(''); setToDate(''); }} className={`${borderColor} h-9`}>
              Clear
            </Button>
          )}
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
                      <th className={`text-left p-3 text-xs font-medium ${textSecondary} uppercase`}>Status</th>
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
                          <Badge className={`pointer-events-none ${sp.collected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {sp.collected ? `Collected${sp.collected_date ? ` · ${sp.collected_date}` : ''}` : 'Not collected'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={`text-xs ${textSecondary}`}>
                Edits are managed inside the project's Payment Schedule tab — Super Admin only.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
