/**
 * Dashboard's own LAPS Overview — Leads -> Appointment -> Proposal Shared ->
 * Sales, same funnel/endpoint as Sales > Overview, with a fuller date filter
 * (adds Year and a Custom range on top of Today/Yesterday/This Week/Month).
 * Sits above the weekly Excel-style tracker as the very first thing shown.
 */
import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Users, Calendar as CalendarIcon, FileText, IndianRupee } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

// "This Week" uses the same Tue–Mon convention as Sales > Overview and
// Finance's Week-Wise view, so this card's number always agrees with theirs.
const getDateRange = (range, customFrom, customTo) => {
  const now = new Date();
  if (range === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (range === 'week') {
    const day = now.getDay(); // 0=Sun..6=Sat, Tue=2
    const back = day >= 2 ? day - 2 : day + 5;
    return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)), to: endOfDay(now) };
  }
  if (range === 'month') return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now) };
  if (range === 'year') return { from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: endOfDay(now) };
  if (range === 'custom') {
    const from = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now);
    const to = customTo ? endOfDay(new Date(customTo)) : endOfDay(now);
    return { from, to };
  }
  return { from: startOfDay(now), to: endOfDay(now) }; // 'today'
};

export default function LapsOverviewCard({ isDark }) {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const [range, setRange] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(range, customFrom, customTo);
      const res = await axios.get(`${API}/api/leads-v2/overview`, {
        headers, params: { date_from: from.toISOString(), date_to: to.toISOString() },
      });
      setData(res.data);
    } catch (e) {
      // Non-critical — the rest of the Dashboard still renders.
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const bgCard = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';
  const border = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const cards = [
    { key: 'leads', label: 'Leads', sub: 'in this period', count: data?.leads ?? 0, icon: Users, ring: 'from-blue-500/30 to-blue-500/0', text: 'text-blue-500' },
    { key: 'appointment', label: 'Appointment', sub: `${data?.appointment?.pct ?? 0}% of Leads`, count: data?.appointment?.count ?? 0, icon: CalendarIcon, ring: 'from-amber-500/30 to-amber-500/0', text: 'text-amber-500' },
    { key: 'proposal_shared', label: 'Proposal Shared', sub: `${data?.proposal_shared?.pct ?? 0}% of Appointment`, count: data?.proposal_shared?.count ?? 0, icon: FileText, ring: 'from-purple-500/30 to-purple-500/0', text: 'text-purple-500' },
    { key: 'sales', label: 'Sales', sub: `${formatCurrency(data?.sales?.value ?? 0)} · ${data?.sales?.pct ?? 0}% of Proposal Shared`, count: data?.sales?.count ?? 0, icon: IndianRupee, ring: 'from-emerald-500/30 to-emerald-500/0', text: 'text-emerald-500' },
  ];

  return (
    <div className={`rounded-xl border p-4 ${bgCard}`} data-testid="dashboard-laps-overview">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className={`text-lg font-bold ${textPrimary}`}>LAPS Overview</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs uppercase tracking-wide ${textSecondary}`}>Date Filter:</span>
          <div className="flex gap-1 flex-wrap">
            {RANGES.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                data-testid={`dashboard-laps-range-${opt.key}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  range === opt.key ? 'bg-[#3b82f6] text-white' : `${bgSecondary} ${textSecondary} hover:${textPrimary}`
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className={`text-xs rounded-lg px-2 py-1.5 border ${isDark ? 'bg-[#27272a] border-[#3f3f46] text-white' : 'bg-white border-gray-300'}`}
                data-testid="dashboard-laps-custom-from"
              />
              <span className={textSecondary}>–</span>
              <input
                type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className={`text-xs rounded-lg px-2 py-1.5 border ${isDark ? 'bg-[#27272a] border-[#3f3f46] text-white' : 'bg-white border-gray-300'}`}
                data-testid="dashboard-laps-custom-to"
              />
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.key} className={`relative overflow-hidden rounded-xl border ${border} p-4`} data-testid={`dashboard-laps-card-${card.key}`}>
              <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${card.ring}`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs uppercase tracking-wide ${textSecondary}`}>{card.label}</p>
                  <Icon className={`h-4 w-4 ${card.text}`} />
                </div>
                <p className={`text-2xl font-bold ${textPrimary}`}>{loading ? '…' : card.count}</p>
                <p className={`text-[11px] ${textSecondary} mt-0.5`}>{card.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
