import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, TrendingUp, Wallet, Target, CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/badge';

const API = process.env.REACT_APP_BACKEND_URL;
const QUALITY_STYLE = {
  good: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  average: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  poor: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

/**
 * Meta Ads "Reports" tab — daily campaign performance submitted from the
 * task list's Submit Report popup. Shows one card per date with a total
 * summary across all campaigns, and a collapsible campaign-wise breakdown.
 */
export default function ProjectMetaReportsTab({ project, isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/meta-reports/project/${project.project_id}`, { headers });
      setReports(res.data || []);
    } catch (e) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [project.project_id, headers]);

  useEffect(() => { load(); }, [load]);

  // Group by date: total summary + campaign-wise breakdown
  const byDate = useMemo(() => {
    const groups = {};
    for (const r of reports) {
      const d = r.date;
      if (!groups[d]) groups[d] = { date: d, entries: [] };
      for (const e of (r.entries || [])) {
        groups[d].entries.push({ ...e, submitted_by_name: r.submitted_by_name });
      }
    }
    return Object.values(groups)
      .map(g => {
        const totalLeads = g.entries.reduce((s, e) => s + (Number(e.total_leads) || 0), 0);
        const totalSpend = g.entries.reduce((s, e) => s + (Number(e.total_spend) || 0), 0);
        const totalConvert = g.entries.reduce((s, e) => s + (Number(e.convert) || 0), 0);
        const avgCostPerLead = totalLeads > 0 ? (totalSpend / totalLeads) : 0;

        const campaignMap = {};
        for (const e of g.entries) {
          const key = e.campaign_id || e.campaign_name;
          if (!campaignMap[key]) {
            campaignMap[key] = {
              campaign_name: e.campaign_name, total_leads: 0, total_spend: 0, convert: 0,
              cost_per_lead_sum: 0, cost_per_lead_count: 0, qualities: [], remarks: [],
            };
          }
          const c = campaignMap[key];
          c.total_leads += Number(e.total_leads) || 0;
          c.total_spend += Number(e.total_spend) || 0;
          c.convert += Number(e.convert) || 0;
          if (e.cost_per_lead) { c.cost_per_lead_sum += Number(e.cost_per_lead) || 0; c.cost_per_lead_count += 1; }
          if (e.quality) c.qualities.push(e.quality);
          if (e.remarks) c.remarks.push(e.remarks);
        }
        const campaigns = Object.values(campaignMap).map(c => ({
          ...c,
          avg_cost_per_lead: c.cost_per_lead_count > 0 ? (c.cost_per_lead_sum / c.cost_per_lead_count) : 0,
        }));

        return { date: g.date, totalLeads, totalSpend, totalConvert, avgCostPerLead, campaigns };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [reports]);

  if (loading) {
    return <div className={`${bgCard} border ${borderColor} rounded-2xl p-12 text-center`} data-testid="meta-reports-tab">
      <p className={textSecondary}>Loading reports…</p>
    </div>;
  }

  if (byDate.length === 0) {
    return <div className={`${bgCard} border ${borderColor} rounded-2xl p-12 text-center`} data-testid="meta-reports-tab">
      <p className={textSecondary}>No reports submitted yet. Reports appear here once a "Report" task's Submit Report popup is filled in.</p>
    </div>;
  }

  return (
    <div className="space-y-4" data-testid="meta-reports-tab">
      {byDate.map((g) => {
        const isExpanded = expandedDate === g.date;
        return (
          <div key={g.date} className={`${bgCard} border ${borderColor} rounded-2xl p-4`} data-testid={`meta-report-date-${g.date}`}>
            <button
              type="button"
              onClick={() => setExpandedDate(isExpanded ? null : g.date)}
              className="w-full flex items-center justify-between gap-3 flex-wrap"
              data-testid={`meta-report-toggle-${g.date}`}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className={`text-base font-semibold ${textPrimary}`}>{fmtDate(g.date)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30">
                  <Target className="h-3 w-3 mr-1" /> {g.totalLeads} Leads
                </Badge>
                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                  <TrendingUp className="h-3 w-3 mr-1" /> {g.totalConvert} Converted
                </Badge>
                <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30">
                  <Wallet className="h-3 w-3 mr-1" /> ₹{g.totalSpend.toLocaleString('en-IN')}
                </Badge>
                <Badge className="bg-indigo-500/15 text-indigo-500 border-indigo-500/30">
                  Avg ₹{g.avgCostPerLead.toFixed(2)}/lead
                </Badge>
              </div>
            </button>

            {isExpanded && (
              <div className={`mt-3 overflow-x-auto rounded-md border ${borderColor}`}>
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${borderColor} ${bgSecondary}`}>
                      <th className={`text-left px-3 py-2 text-[11px] font-medium ${textSecondary} uppercase`}>Campaign</th>
                      <th className={`text-left px-3 py-2 text-[11px] font-medium ${textSecondary} uppercase`}>Total Leads</th>
                      <th className={`text-left px-3 py-2 text-[11px] font-medium ${textSecondary} uppercase`}>Cost per Lead</th>
                      <th className={`text-left px-3 py-2 text-[11px] font-medium ${textSecondary} uppercase`}>Total Spend</th>
                      <th className={`text-left px-3 py-2 text-[11px] font-medium ${textSecondary} uppercase`}>Quality</th>
                      <th className={`text-left px-3 py-2 text-[11px] font-medium ${textSecondary} uppercase`}>Convert</th>
                      <th className={`text-left px-3 py-2 text-[11px] font-medium ${textSecondary} uppercase`}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.campaigns.map((c) => (
                      <tr key={c.campaign_name} className={`border-b ${borderColor} last:border-b-0`} data-testid={`meta-report-campaign-${c.campaign_name}`}>
                        <td className={`px-3 py-2 text-sm font-medium ${textPrimary}`}>{c.campaign_name}</td>
                        <td className={`px-3 py-2 text-sm ${textPrimary}`}>{c.total_leads}</td>
                        <td className={`px-3 py-2 text-sm ${textPrimary}`}>₹{c.avg_cost_per_lead.toFixed(2)}</td>
                        <td className={`px-3 py-2 text-sm ${textPrimary}`}>₹{c.total_spend.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {[...new Set(c.qualities)].map((q) => (
                              <span key={q} className={`px-2 py-0.5 rounded text-[10px] font-medium border capitalize ${QUALITY_STYLE[q] || QUALITY_STYLE.average}`}>
                                {q}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className={`px-3 py-2 text-sm ${textPrimary}`}>
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {c.convert}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-xs ${textSecondary}`}>{c.remarks.join('; ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
