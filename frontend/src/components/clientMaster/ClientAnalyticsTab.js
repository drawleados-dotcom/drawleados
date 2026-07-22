import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Users, IndianRupee, CheckCircle2, XCircle, Target, TrendingUp, BarChart3 } from 'lucide-react';
import { STATUS_OPTIONS, STATUS_MAP } from '../../lib/clientStatus';

// Fixed categorical order — reused across every ranked breakdown on this board
// so a given rank position always reads the same hue (matches RevenueTab/ProductivityDashboard).
const CATEGORY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const TYPE_COLORS = { 'One-time': '#6366f1', 'Recurring': '#8b5cf6' };

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_3', label: 'Last 3 Months' },
  { value: 'last_6', label: 'Last 6 Months' },
  { value: 'last_12', label: 'Last 12 Months' },
  { value: 'this_year', label: 'This Year' },
];

const START_YEAR = 2022;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

// Falls back to deriving month/year from onboarding_date for any client
// record that predates the dedicated Month/Year fields.
const clientMonthYear = (c) => {
  if (c.onboarding_month && c.onboarding_year) return { month: c.onboarding_month, year: c.onboarding_year };
  const d = c.onboarding_date ? new Date(c.onboarding_date) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return { month: d.getMonth() + 1, year: d.getFullYear() };
};

const inPeriod = (client, period) => {
  if (period === 'all') return true;
  const my = clientMonthYear(client);
  if (!my) return false;
  const now = new Date();
  if (period === 'this_month') return my.year === now.getFullYear() && my.month === now.getMonth() + 1;
  if (period === 'this_year') return my.year === now.getFullYear();
  const monthsBack = { last_3: 3, last_6: 6, last_12: 12 }[period];
  const cutoff = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
  const clientMonthStart = new Date(my.year, my.month - 1, 1);
  return clientMonthStart >= cutoff;
};

const amt = (c) => Number(c.total_amount ?? c.package_amount ?? 0) || 0;

const topNWithOther = (rows, n = 6) => {
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  if (sorted.length <= n) return sorted;
  const top = sorted.slice(0, n - 1);
  const rest = sorted.slice(n - 1);
  const other = rest.reduce((acc, r) => ({ count: acc.count + r.count, amount: acc.amount + r.amount }), { count: 0, amount: 0 });
  return [...top, { name: 'Other', ...other }];
};

const groupBy = (rows, keyFn) => {
  const map = new Map();
  rows.forEach((c) => {
    const key = keyFn(c) || 'Unassigned';
    const cur = map.get(key) || { name: key, count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += amt(c);
    map.set(key, cur);
  });
  return Array.from(map.values());
};

const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const KpiCard = ({ icon: Icon, label, value, sub, color, bgCard, borderColor, textPrimary, textSecondary }) => (
  <div className={`${bgCard} border ${borderColor} rounded-xl p-4 transition-all`}>
    <div className="flex items-center gap-2 mb-3">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}22` }}>
        <Icon className="h-5 w-5" style={{ color }} strokeWidth={1.75} />
      </div>
    </div>
    <p className={`text-2xl font-bold ${textPrimary}`}>{value}</p>
    <p className={`text-xs ${textSecondary} mt-0.5`}>{label}{sub ? <span className="opacity-70"> · {sub}</span> : null}</p>
  </div>
);

export default function ClientAnalyticsTab({ clients = [], isDark }) {
  const [period, setPeriod] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  // Year and Period are mutually exclusive — picking one resets the other,
  // so it's always clear which single filter is driving the board.
  const onPeriodChange = (v) => { setPeriod(v); setYearFilter('all'); };
  const onYearChange = (v) => { setYearFilter(v); setPeriod('all'); };

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const gridStroke = isDark ? '#27272a' : '#e5e7eb';
  const tickColor = isDark ? '#a1a1aa' : '#6b7280';
  const tooltipStyle = {
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    border: `1px solid ${isDark ? '#27272a' : '#e5e7eb'}`,
    borderRadius: '8px',
    color: isDark ? '#fafafa' : '#111827',
    fontSize: '12px',
  };

  const filtered = useMemo(() => {
    if (yearFilter !== 'all') {
      return clients.filter((c) => clientMonthYear(c)?.year === Number(yearFilter));
    }
    return clients.filter((c) => inPeriod(c, period));
  }, [clients, period, yearFilter]);

  const totals = useMemo(() => {
    const totalClients = filtered.length;
    const totalRevenue = filtered.reduce((sum, c) => sum + amt(c), 0);
    const counts = { active: 0, delivered: 0, dropped: 0, not_satisfied: 0, unfinished: 0 };
    filtered.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });
    const avgDeal = totalClients ? totalRevenue / totalClients : 0;
    return { totalClients, totalRevenue, counts, avgDeal };
  }, [filtered]);

  const statusData = useMemo(() => {
    return STATUS_OPTIONS.map((s) => {
      const rows = filtered.filter((c) => (c.status || 'active') === s.value);
      return { name: s.label, value: rows.length, amount: rows.reduce((sum, c) => sum + amt(c), 0), color: s.hex };
    }).filter((d) => d.value > 0);
  }, [filtered]);

  const typeData = useMemo(() => {
    const oneTime = filtered.filter((c) => c.service_type !== 'recurring');
    const recurring = filtered.filter((c) => c.service_type === 'recurring');
    return [
      { name: 'One-time', value: oneTime.length, amount: oneTime.reduce((sum, c) => sum + amt(c), 0) },
      { name: 'Recurring', value: recurring.length, amount: recurring.reduce((sum, c) => sum + amt(c), 0) },
    ].filter((d) => d.value > 0);
  }, [filtered]);

  const sourceData = useMemo(() => topNWithOther(groupBy(filtered, (c) => c.source), 6).reverse(), [filtered]);
  const serviceData = useMemo(() => topNWithOther(groupBy(filtered, (c) => c.service_name), 6).reverse(), [filtered]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({ key, month: monthLabel(key), count: 0, amount: 0 });
    }
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
    clients.forEach((c) => {
      const my = clientMonthYear(c);
      if (!my) return;
      const key = `${my.year}-${String(my.month).padStart(2, '0')}`;
      if (byKey[key]) { byKey[key].count += 1; byKey[key].amount += amt(c); }
    });
    return buckets;
  }, [clients]);

  const yearlyData = useMemo(() => {
    const buckets = YEARS.map((y) => ({ year: String(y), count: 0, amount: 0 }));
    const byYear = Object.fromEntries(buckets.map((b) => [b.year, b]));
    clients.forEach((c) => {
      const my = clientMonthYear(c);
      if (!my) return;
      const key = String(my.year);
      if (byYear[key]) { byYear[key].count += 1; byYear[key].amount += amt(c); }
    });
    return buckets;
  }, [clients]);

  const topClients = useMemo(
    () => [...filtered].sort((a, b) => amt(b) - amt(a)).slice(0, 8),
    [filtered]
  );

  if (clients.length === 0) {
    return (
      <div className={`${bgCard} border ${borderColor} rounded-xl p-16 text-center`} data-testid="client-analytics-empty">
        <BarChart3 className={`h-10 w-10 mx-auto mb-3 opacity-40 ${textSecondary}`} />
        <p className={`text-sm font-medium ${textPrimary}`}>No client data yet</p>
        <p className={`text-xs ${textSecondary} mt-1`}>Add clients in the Overview tab and this board fills in automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="client-analytics-tab">
      {/* Header / period control */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>Client Analytics Board</h2>
          <p className={`text-xs ${textSecondary}`}>Live summary computed from every record in Client Master.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={onPeriodChange}>
            <SelectTrigger className="w-44" data-testid="client-analytics-period"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={onYearChange}>
            <SelectTrigger className="w-32" data-testid="client-analytics-year"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard icon={Users} label="Total Clients" value={totals.totalClients} color="#6366f1" {...{ bgCard, borderColor, textPrimary, textSecondary }} />
        <KpiCard icon={IndianRupee} label="Total Revenue" value={`₹${totals.totalRevenue.toLocaleString()}`} color="#10b981" {...{ bgCard, borderColor, textPrimary, textSecondary }} />
        <KpiCard
          icon={CheckCircle2} label="Active" color="#10b981"
          value={totals.counts.active || 0}
          sub={totals.totalClients ? `${Math.round(((totals.counts.active || 0) / totals.totalClients) * 100)}%` : null}
          {...{ bgCard, borderColor, textPrimary, textSecondary }}
        />
        <KpiCard
          icon={Target} label="Delivered" color="#3b82f6"
          value={totals.counts.delivered || 0}
          sub={totals.totalClients ? `${Math.round(((totals.counts.delivered || 0) / totals.totalClients) * 100)}%` : null}
          {...{ bgCard, borderColor, textPrimary, textSecondary }}
        />
        <KpiCard
          icon={XCircle} label="Dropped" color="#ef4444"
          value={totals.counts.dropped || 0}
          sub={totals.totalClients ? `${Math.round(((totals.counts.dropped || 0) / totals.totalClients) * 100)}%` : null}
          {...{ bgCard, borderColor, textPrimary, textSecondary }}
        />
        <KpiCard icon={TrendingUp} label="Avg Deal Size" value={`₹${Math.round(totals.avgDeal).toLocaleString()}`} color="#8b5cf6" {...{ bgCard, borderColor, textPrimary, textSecondary }} />
      </div>

      {/* Status + Engagement type donuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
          <h3 className={`text-sm font-semibold ${textPrimary} mb-4`}>Status Distribution</h3>
          {statusData.length === 0 ? (
            <p className={`text-sm ${textSecondary} py-16 text-center`}>No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2} dataKey="value" nameKey="name">
                  {statusData.map((d, i) => <Cell key={i} fill={d.color} stroke={isDark ? '#18181b' : '#ffffff'} strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name, props) => [`${value} clients · ₹${props.payload.amount.toLocaleString()}`, name]} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12, color: tickColor }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
          <h3 className={`text-sm font-semibold ${textPrimary} mb-4`}>One-time vs Recurring</h3>
          {typeData.length === 0 ? (
            <p className={`text-sm ${textSecondary} py-16 text-center`}>No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2} dataKey="value" nameKey="name">
                  {typeData.map((d, i) => <Cell key={i} fill={TYPE_COLORS[d.name]} stroke={isDark ? '#18181b' : '#ffffff'} strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name, props) => [`${value} clients · ₹${props.payload.amount.toLocaleString()}`, name]} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12, color: tickColor }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Revenue by source / service */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
          <h3 className={`text-sm font-semibold ${textPrimary} mb-4`}>Revenue by Source</h3>
          {sourceData.length === 0 ? (
            <p className={`text-sm ${textSecondary} py-16 text-center`}>No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, sourceData.length * 42)}>
              <BarChart data={sourceData} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: gridStroke }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: tickColor, fontSize: 12 }} axisLine={{ stroke: gridStroke }} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, _n, props) => [`₹${value.toLocaleString()} · ${props.payload.count} clients`, 'Revenue']} cursor={{ fill: isDark ? '#27272a55' : '#f3f4f655' }} />
                <Bar dataKey="amount" barSize={18} radius={[0, 4, 4, 0]}>
                  {sourceData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[(sourceData.length - 1 - i) % CATEGORY_COLORS.length]} />)}
                  <LabelList dataKey="amount" position="right" formatter={(v) => `₹${v.toLocaleString()}`} style={{ fill: tickColor, fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
          <h3 className={`text-sm font-semibold ${textPrimary} mb-4`}>Revenue by Service</h3>
          {serviceData.length === 0 ? (
            <p className={`text-sm ${textSecondary} py-16 text-center`}>No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, serviceData.length * 42)}>
              <BarChart data={serviceData} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: gridStroke }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: tickColor, fontSize: 12 }} axisLine={{ stroke: gridStroke }} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, _n, props) => [`₹${value.toLocaleString()} · ${props.payload.count} clients`, 'Revenue']} cursor={{ fill: isDark ? '#27272a55' : '#f3f4f655' }} />
                <Bar dataKey="amount" barSize={18} radius={[0, 4, 4, 0]}>
                  {serviceData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[(serviceData.length - 1 - i) % CATEGORY_COLORS.length]} />)}
                  <LabelList dataKey="amount" position="right" formatter={(v) => `₹${v.toLocaleString()}`} style={{ fill: tickColor, fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
          <h3 className={`text-sm font-semibold ${textPrimary} mb-4`}>New Clients — Last 12 Months</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} clients`, 'Onboarded']} cursor={{ fill: isDark ? '#27272a55' : '#f3f4f655' }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
          <h3 className={`text-sm font-semibold ${textPrimary} mb-4`}>Revenue — Last 12 Months</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']} cursor={{ fill: isDark ? '#27272a55' : '#f3f4f655' }} />
              <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Yearly trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
          <h3 className={`text-sm font-semibold ${textPrimary} mb-4`}>New Clients — Yearly ({START_YEAR}–{CURRENT_YEAR})</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={yearlyData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="year" tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} clients`, 'Onboarded']} cursor={{ fill: isDark ? '#27272a55' : '#f3f4f655' }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
          <h3 className={`text-sm font-semibold ${textPrimary} mb-4`}>Revenue — Yearly ({START_YEAR}–{CURRENT_YEAR})</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={yearlyData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="year" tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']} cursor={{ fill: isDark ? '#27272a55' : '#f3f4f655' }} />
              <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top clients leaderboard */}
      <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
        <div className={`p-4 border-b ${borderColor}`}>
          <h3 className={`text-sm font-semibold ${textPrimary}`}>Top Clients by Revenue</h3>
        </div>
        {topClients.length === 0 ? (
          <p className={`text-sm ${textSecondary} py-10 text-center`}>No data for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-10`}>#</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Client</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Source</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Service</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((c, i) => {
                  const st = STATUS_MAP[c.status] || STATUS_MAP.active;
                  return (
                    <tr key={c.client_id} className={`border-b ${borderColor}`} data-testid={`client-analytics-top-${c.client_id}`}>
                      <td className={`p-3 text-xs ${textSecondary}`}>{i + 1}</td>
                      <td className={`p-3 font-medium ${textPrimary}`}>{c.name}</td>
                      <td className={`p-3 text-sm ${textSecondary}`}>{c.source || '—'}</td>
                      <td className={`p-3 text-sm ${textSecondary}`}>{c.service_name || '—'}</td>
                      <td className="p-3"><span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span></td>
                      <td className={`p-3 text-sm text-right font-medium ${textPrimary}`}>₹{amt(c).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
