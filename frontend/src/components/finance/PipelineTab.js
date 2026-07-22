import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Calendar, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useTheme } from '../../contexts/ThemeContext';

const API = process.env.REACT_APP_BACKEND_URL;

const formatCurrency = (n) => {
  const v = Number(n) || 0;
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
};

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
];

const presetRange = (key) => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (key) {
    case 'today':
      return { from: start, to: end };
    case 'week': {
      const d = start.getDay() || 7;
      start.setDate(start.getDate() - (d - 1));
      return { from: start, to: end };
    }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: end };
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      return { from: new Date(now.getFullYear(), q * 3, 1), to: end };
    }
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1), to: end };
    case 'all':
    default:
      return { from: null, to: null };
  }
};

const PipelineTab = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const bgCard = isDark ? 'bg-white dark:bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-gray-50 dark:bg-[#0c0a09]' : 'bg-gray-50';
  const borderColor = isDark ? 'border-gray-200 dark:border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-gray-900 dark:text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-600 dark:text-[#a1a1aa]' : 'text-gray-500';

  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState('month');
  const initial = presetRange('month');
  const [range, setRange] = useState({
    from: initial.from ? initial.from.toISOString().slice(0, 10) : '',
    to: initial.to ? initial.to.toISOString().slice(0, 10) : '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        axios.get(`${API}/api/leads-v2/stages`, { headers }),
        axios.get(`${API}/api/leads-v2/leads`, { headers }),
      ]);
      setStages(s.data || []);
      setLeads(l.data || []);
    } catch (e) {
      console.error('Pipeline load error:', e);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Apply date range filter on lead.created_at
  const filteredLeads = useMemo(() => {
    if (!range.from && !range.to) return leads;
    const fromTs = range.from ? new Date(range.from + 'T00:00:00').getTime() : -Infinity;
    const toTs = range.to ? new Date(range.to + 'T23:59:59').getTime() : Infinity;
    return leads.filter((l) => {
      const ts = l.created_at ? new Date(l.created_at).getTime() : 0;
      return ts >= fromTs && ts <= toTs;
    });
  }, [leads, range]);

  const stageNameById = (id) => stages.find((s) => s.stage_id === id)?.name?.toLowerCase() || '';
  const matchBucket = (lead, keywords) => {
    const n = stageNameById(lead.stage_id);
    return keywords.some((k) => n.includes(k));
  };
  const sumAmount = (arr) => arr.reduce((acc, l) => acc + (Number(l.estimation) || 0), 0);

  const buckets = useMemo(() => {
    const q = filteredLeads.filter((l) => matchBucket(l, ['proposal', 'quotation', 'quote']));
    const n = filteredLeads.filter((l) => matchBucket(l, ['negotiation']));
    const c = filteredLeads.filter((l) => matchBucket(l, ['deal closed', 'closed', 'won', 'payment']));
    const lo = filteredLeads.filter((l) => matchBucket(l, ['lost', 'rejected', 'cancel']));
    return {
      quotation: { count: q.length, amount: sumAmount(q) },
      negotiation: { count: n.length, amount: sumAmount(n) },
      closed: { count: c.length, amount: sumAmount(c) },
      lost: { count: lo.length, amount: sumAmount(lo) },
    };
  }, [filteredLeads]); // eslint-disable-line react-hooks/exhaustive-deps

  const stageCounts = useMemo(() => {
    const map = {};
    for (const l of filteredLeads) {
      const k = l.stage_id || '_unknown';
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }, [filteredLeads]);

  const totalLeadValue = useMemo(() => sumAmount(filteredLeads), [filteredLeads]);

  const applyPreset = (key) => {
    setPreset(key);
    if (key === 'custom') return;
    const r = presetRange(key);
    setRange({
      from: r.from ? r.from.toISOString().slice(0, 10) : '',
      to: r.to ? r.to.toISOString().slice(0, 10) : '',
    });
  };

  const summaryCards = [
    { key: 'quotation', label: 'Total Quotation', color: '#f59e0b', data: buckets.quotation, icon: '📄' },
    { key: 'negotiation', label: 'Negotiation', color: '#ec4899', data: buckets.negotiation, icon: '🤝' },
    { key: 'closed', label: 'Deal Closed', color: '#22c55e', data: buckets.closed, icon: '✅' },
    { key: 'lost', label: 'Amount Lost', color: '#ef4444', data: buckets.lost, icon: '❌' },
  ];

  return (
    <div className="space-y-5" data-testid="finance-pipeline-tab">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-2xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Sales Pipeline
          </h2>
          <p className={`text-sm ${textSecondary}`}>
            Lead value across each stage — filter by lead creation date.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={load} variant="outline" className={`${borderColor} gap-2`} data-testid="pipeline-refresh-btn">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Date filter */}
      <div className={`${bgCard} border ${borderColor} rounded-xl p-4`} data-testid="pipeline-filter">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className={`h-4 w-4 ${textSecondary}`} />
            <span className={`text-sm font-medium ${textPrimary}`}>Date Range:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                data-testid={`pipeline-preset-${p.key}`}
                className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                  preset === p.key
                    ? 'border-[#6366f1] bg-[#6366f1]/15 text-[#6366f1] font-semibold'
                    : `${borderColor} ${textSecondary} hover:${textPrimary}`
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-auto">
              <Calendar className={`h-4 w-4 ${textSecondary}`} />
              <Input
                type="date"
                value={range.from}
                onChange={(e) => setRange({ ...range, from: e.target.value })}
                className={`h-8 w-36 text-xs ${bgSecondary} ${borderColor}`}
                data-testid="pipeline-date-from"
              />
              <span className={textSecondary}>→</span>
              <Input
                type="date"
                value={range.to}
                onChange={(e) => setRange({ ...range, to: e.target.value })}
                className={`h-8 w-36 text-xs ${bgSecondary} ${borderColor}`}
                data-testid="pipeline-date-to"
              />
            </div>
          )}
          <span className={`ml-auto text-xs ${textSecondary}`}>
            {filteredLeads.length} lead{filteredLeads.length === 1 ? '' : 's'} • Total value <b className={textPrimary}>{formatCurrency(totalLeadValue)}</b>
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map((c) => (
              <div
                key={c.key}
                className={`${bgCard} border ${borderColor} rounded-xl p-5 hover:border-[#6366f1] transition-colors`}
                style={{ borderLeftWidth: 4, borderLeftColor: c.color }}
                data-testid={`pipeline-card-${c.key}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs uppercase tracking-wider font-semibold ${textSecondary}`}>{c.label}</span>
                  <span className="text-lg" aria-hidden>{c.icon}</span>
                </div>
                <div className="text-3xl font-bold" style={{ color: c.color, fontFamily: 'Plus Jakarta Sans' }}>
                  {formatCurrency(c.data.amount)}
                </div>
                <div className={`text-xs mt-1 ${textSecondary}`}>
                  {c.data.count} lead{c.data.count === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>

          {/* Stage-wise breakdown table */}
          <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
            <div className={`px-5 py-3 border-b ${borderColor}`}>
              <h3 className={`text-base font-semibold ${textPrimary}`}>Stage-wise Pipeline</h3>
            </div>
            {stages.length === 0 ? (
              <div className={`p-8 text-center ${textSecondary}`}>No stages configured yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className={`${bgSecondary} ${textSecondary} text-xs uppercase`}>
                  <tr>
                    <th className="px-5 py-2.5 text-left">Stage</th>
                    <th className="px-5 py-2.5 text-right">Leads</th>
                    <th className="px-5 py-2.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((s) => {
                    const stageLeads = filteredLeads.filter((l) => l.stage_id === s.stage_id);
                    return (
                      <tr key={s.stage_id} className={`border-t ${borderColor}`} data-testid={`pipeline-stage-row-${s.stage_id}`}>
                        <td className="px-5 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className={textPrimary}>{s.name}</span>
                          </span>
                        </td>
                        <td className={`px-5 py-2.5 text-right ${textPrimary}`}>{stageCounts[s.stage_id] || 0}</td>
                        <td className={`px-5 py-2.5 text-right font-semibold ${textPrimary}`}>{formatCurrency(sumAmount(stageLeads))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PipelineTab;
