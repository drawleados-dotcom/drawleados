import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  X, IndianRupee, Users, Target, TrendingUp, Megaphone, Layers, Zap, Sparkles, Wallet, PiggyBank, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const count = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// Literal class strings so Tailwind keeps them.
const TONES = {
  orange: { box: 'border-[#f97316]/30 bg-[#f97316]/10', text: 'text-[#f97316]', bar: 'bg-[#f97316]' },
  blue: { box: 'border-[#3b82f6]/30 bg-[#3b82f6]/10', text: 'text-[#3b82f6]', bar: 'bg-[#3b82f6]' },
  violet: { box: 'border-[#8b5cf6]/30 bg-[#8b5cf6]/10', text: 'text-[#8b5cf6]', bar: 'bg-[#8b5cf6]' },
  emerald: { box: 'border-[#10b981]/30 bg-[#10b981]/10', text: 'text-[#10b981]', bar: 'bg-[#10b981]' },
  indigo: { box: 'border-[#6366f1]/30 bg-[#6366f1]/10', text: 'text-[#6366f1]', bar: 'bg-[#6366f1]' },
  cyan: { box: 'border-[#06b6d4]/30 bg-[#06b6d4]/10', text: 'text-[#06b6d4]', bar: 'bg-[#06b6d4]' },
  lime: { box: 'border-[#65a30d]/30 bg-[#65a30d]/10', text: 'text-[#65a30d]', bar: 'bg-[#65a30d]' },
  amber: { box: 'border-[#f59e0b]/30 bg-[#f59e0b]/10', text: 'text-[#f59e0b]', bar: 'bg-[#f59e0b]' },
  teal: { box: 'border-[#14b8a6]/30 bg-[#14b8a6]/10', text: 'text-[#14b8a6]', bar: 'bg-[#14b8a6]' },
  rose: { box: 'border-[#ef4444]/30 bg-[#ef4444]/10', text: 'text-[#ef4444]', bar: 'bg-[#ef4444]' },
};

// Change vs the previous period. `better` says which direction is good news.
const deltaOf = (cur, prev, better) => {
  if (cur == null || prev == null) return null;
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return { label: 'New', tone: 'neutral', up: true };
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 0.05) return { label: '0%', tone: 'neutral', up: true };
  const up = pct > 0;
  const tone = better === 'neutral' ? 'neutral' : (up === (better === 'up') ? 'good' : 'bad');
  return { label: `${Math.abs(pct).toFixed(1)}%`, tone, up };
};
const DELTA_CLS = {
  good: 'bg-[#10b981]/15 text-[#10b981]',
  bad: 'bg-[#ef4444]/15 text-[#ef4444]',
  neutral: 'bg-slate-500/15 text-slate-400',
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pointLabel = (key, granularity) => (granularity === 'day'
  ? String(Number(key.slice(8, 10)))
  : `${MONTH_SHORT[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`);
const pointTitle = (key, granularity) => (granularity === 'day'
  ? fmtDate(key)
  : `${MONTH_SHORT[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`);

function Section({ title, tone, right, children, textPrimary }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className={`text-sm font-semibold ${textPrimary} flex items-center gap-2`}>
          <span className={`inline-block w-1 h-4 rounded-full ${TONES[tone].bar}`} />
          {title}
        </h4>
        {right}
      </div>
      {children}
    </section>
  );
}

function Bars({ points, field, tone, format, granularity, textSecondary }) {
  const max = Math.max(0, ...points.map(p => Number(p[field]) || 0));
  const step = Math.max(1, Math.ceil(points.length / 10));
  return (
    <div>
      <div className="flex items-end gap-[2px] h-24">
        {points.map(p => {
          const v = Number(p[field]) || 0;
          return (
            <div key={p.key} className="flex-1 min-w-[3px] h-full flex flex-col justify-end" title={`${pointTitle(p.key, granularity)} · ${format(v)}`}>
              <div className={`${TONES[tone].bar} rounded-t-sm opacity-90`} style={{ height: max > 0 && v > 0 ? `${Math.max((v / max) * 100, 4)}%` : '0%' }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px] mt-1">
        {points.map((p, i) => (
          <div key={p.key} className={`flex-1 min-w-[3px] text-center text-[9px] leading-none ${textSecondary}`}>
            {i % step === 0 ? pointLabel(p.key, granularity) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Operations > Projects > Meta Ads > Performance View > eye: a full report of
 * one project for the selected period — every table column expanded, plus the
 * campaign breakdown, trend, lead quality and wallet position.
 */
export default function MetaPerformanceSummary({
  project, range, periodLabel, headers, onClose,
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const headersRef = useRef(headers);
  headersRef.current = headers;

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    const params = {};
    if (range.from) params.from = range.from;
    if (range.to) params.to = range.to;
    axios.get(`${API}/api/meta-reports/performance/${project.project_id}`, { headers: headersRef.current, params })
      .then(res => { if (live) setData(res.data); })
      .catch(e => { if (live) setError(e.response?.data?.detail || 'Failed to load the summary'); });
    return () => { live = false; };
  }, [project.project_id, range.from, range.to]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const T = data?.totals;
  const prev = data?.previous;
  const prevLabel = data?.previous_range ? `${fmtDate(data.previous_range.from)} – ${fmtDate(data.previous_range.to)}` : '';

  const kpis = T ? [
    { key: 'spend', label: 'Total Spend', value: money(T.spend), tone: 'orange', icon: IndianRupee, delta: deltaOf(T.spend, prev?.spend, 'neutral') },
    { key: 'leads', label: 'Total Leads', value: count(T.leads), tone: 'blue', icon: Users, delta: deltaOf(T.leads, prev?.leads, 'up') },
    { key: 'cpl', label: 'Cost per Lead', value: T.cpl == null ? '—' : money(T.cpl), tone: 'violet', icon: Target, delta: deltaOf(T.cpl, prev?.cpl, 'down') },
    { key: 'conversions', label: 'Conversions', value: count(T.conversions), tone: 'emerald', icon: TrendingUp },
    { key: 'campaigns', label: 'Campaigns', value: count(T.campaigns), tone: 'indigo', icon: Megaphone },
    { key: 'adsets', label: 'Ad Sets', value: count(T.ad_sets), tone: 'cyan', icon: Layers },
    { key: 'active', label: 'Active Ads', value: count(T.active_ads), sub: `of ${count(T.ads)} ads`, tone: 'lime', icon: Zap },
    { key: 'new', label: 'New Ads', value: count(T.new_ads), sub: range.from || range.to ? 'added in period' : 'all ads', tone: 'amber', icon: Sparkles },
    { key: 'recharged', label: 'Amount Recharged', value: money(T.recharged), tone: 'teal', icon: Wallet },
    { key: 'wallet', label: 'Wallet Balance', value: money(data.wallet.balance), sub: 'all recharges − all spend', tone: data.wallet.balance < 0 ? 'rose' : 'emerald', icon: PiggyBank },
  ] : [];

  const points = data?.trend?.points || [];
  const hasTrend = points.some(p => p.spend > 0 || p.leads > 0);
  const q = data?.quality || { good: 0, average: 0, poor: 0 };
  const qTotal = q.good + q.average + q.poor;
  const camps = data?.campaigns || [];
  const th = `px-3 py-2 text-[11px] font-medium uppercase ${textSecondary}`;
  const td = `px-3 py-2.5 text-sm tabular-nums ${textPrimary}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose} data-testid="meta-perf-summary-modal">
      <div className={`${bgCard} border ${borderColor} rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden`} onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-white/70">Project performance summary</p>
            <h3 className="text-xl font-bold truncate" data-testid="meta-perf-summary-title">{project.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {(data?.project?.client_name || project.client_name) && <span className="px-2 py-0.5 rounded-full bg-white/15">{data?.project?.client_name || project.client_name}</span>}
              <span className="px-2 py-0.5 rounded-full bg-white/15 capitalize">{data?.project?.status || project.status || 'active'}</span>
              <span className="px-2 py-0.5 rounded-full bg-white/25 font-medium" data-testid="meta-perf-summary-period">{periodLabel}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-white/15" title="Close" data-testid="meta-perf-summary-close"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-8">
          {error ? (
            <p className="text-center text-sm text-red-500 py-10">{error}</p>
          ) : !data ? (
            <p className={`text-center text-sm ${textSecondary} py-10`}>Loading summary…</p>
          ) : (
            <>
              <Section title="Key numbers" tone="indigo" textPrimary={textPrimary}
                right={prevLabel && <span className={`text-[11px] ${textSecondary}`}>Changes compare with {prevLabel}</span>}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {kpis.map(k => {
                    const Icon = k.icon;
                    const tone = TONES[k.tone];
                    return (
                      <div key={k.key} className={`rounded-xl border ${tone.box} p-3`} data-testid={`meta-perf-summary-kpi-${k.key}`}>
                        <div className="flex items-center justify-between">
                          <p className={`text-[11px] font-medium uppercase ${textSecondary}`}>{k.label}</p>
                          <Icon className={`h-4 w-4 ${tone.text}`} />
                        </div>
                        <p className={`mt-1 text-xl font-bold tabular-nums ${tone.text}`}>{k.value}</p>
                        <div className="mt-1 flex items-center gap-1.5 min-h-[18px]">
                          {k.delta && (
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${DELTA_CLS[k.delta.tone]}`}>
                              {k.delta.label !== 'New' && k.delta.label !== '0%' && (k.delta.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
                              {k.delta.label}
                            </span>
                          )}
                          {k.sub && <span className={`text-[10px] ${textSecondary}`}>{k.sub}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section title={data.trend.granularity === 'day' ? 'Daily trend' : 'Monthly trend'} tone="orange" textPrimary={textPrimary}>
                {hasTrend ? (
                  <div className="grid md:grid-cols-2 gap-4" data-testid="meta-perf-summary-trend">
                    <div className={`rounded-xl border ${TONES.orange.box} p-3`}>
                      <p className={`text-xs font-medium mb-2 ${TONES.orange.text}`}>Spend</p>
                      <Bars points={points} field="spend" tone="orange" format={money} granularity={data.trend.granularity} textSecondary={textSecondary} />
                    </div>
                    <div className={`rounded-xl border ${TONES.blue.box} p-3`}>
                      <p className={`text-xs font-medium mb-2 ${TONES.blue.text}`}>Leads</p>
                      <Bars points={points} field="leads" tone="blue" format={count} granularity={data.trend.granularity} textSecondary={textSecondary} />
                    </div>
                  </div>
                ) : (
                  <p className={`text-xs ${textSecondary}`}>No daily reports were submitted in this period.</p>
                )}
              </Section>

              <Section title={`Campaign performance (${camps.length})`} tone="violet" textPrimary={textPrimary}>
                {camps.length === 0 ? (
                  <p className={`text-xs ${textSecondary}`}>This project has no campaigns yet.</p>
                ) : (
                  <div className={`rounded-xl border ${borderColor} overflow-x-auto`} data-testid="meta-perf-summary-campaigns">
                    <table className="w-full">
                      <thead className={bgSecondary}>
                        <tr>
                          <th className={`${th} text-left`}>Campaign</th>
                          <th className={`${th} text-right`}>Daily Budget</th>
                          <th className={`${th} text-right`}>Ad Sets</th>
                          <th className={`${th} text-right`}>Ads</th>
                          <th className={`${th} text-right`}>Active</th>
                          <th className={`${th} text-right`}>New</th>
                          <th className={`${th} text-right`}>Spend</th>
                          <th className={`${th} text-right`}>Leads</th>
                          <th className={`${th} text-right`}>CPL</th>
                          <th className={`${th} text-right`}>Conv.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {camps.map(c => (
                          <tr key={c.id} className={`border-t ${borderColor} align-top`} data-testid={`meta-perf-summary-campaign-${c.id}`}>
                            <td className="px-3 py-2.5">
                              <p className={`text-sm font-medium ${textPrimary}`}>
                                {c.name}
                                {!c.in_project && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-500/20 text-slate-400">removed</span>}
                              </p>
                              {c.ad_sets.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {c.ad_sets.map(a => (
                                    <span key={a.id} className={`text-[10px] px-1.5 py-0.5 rounded-full ${TONES.cyan.box} border ${TONES.cyan.text}`}>
                                      {a.name || 'Ad set'} · {a.ads} ad{a.ads === 1 ? '' : 's'}{a.active_ads ? ` (${a.active_ads} active)` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className={`${td} text-right`}>{c.daily_budget > 0 ? `${money(c.daily_budget)}/day` : '—'}</td>
                            <td className={`${td} text-right`}>{count(c.ad_sets.length)}</td>
                            <td className={`${td} text-right`}>{count(c.ads)}</td>
                            <td className={`${td} text-right`}>{count(c.active_ads)}</td>
                            <td className={`${td} text-right`}>{count(c.new_ads)}</td>
                            <td className={`${td} text-right font-medium ${TONES.orange.text}`}>{money(c.spend)}</td>
                            <td className={`${td} text-right font-medium ${TONES.blue.text}`}>{count(c.leads)}</td>
                            <td className={`${td} text-right`}>{c.cpl == null ? '—' : money(c.cpl)}</td>
                            <td className={`${td} text-right`}>{count(c.conversions)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className={`border-t-2 ${borderColor} ${bgSecondary}`}>
                          <td className={`px-3 py-2.5 text-xs font-semibold uppercase ${textSecondary}`}>Total</td>
                          <td className={`${td} text-right font-semibold`}>{money(camps.reduce((s, c) => s + (c.daily_budget || 0), 0))}/day</td>
                          <td className={`${td} text-right font-semibold`}>{count(T.ad_sets)}</td>
                          <td className={`${td} text-right font-semibold`}>{count(T.ads)}</td>
                          <td className={`${td} text-right font-semibold`}>{count(T.active_ads)}</td>
                          <td className={`${td} text-right font-semibold`}>{count(T.new_ads)}</td>
                          <td className={`${td} text-right font-semibold ${TONES.orange.text}`}>{money(T.spend)}</td>
                          <td className={`${td} text-right font-semibold ${TONES.blue.text}`}>{count(T.leads)}</td>
                          <td className={`${td} text-right font-semibold`}>{T.cpl == null ? '—' : money(T.cpl)}</td>
                          <td className={`${td} text-right font-semibold`}>{count(T.conversions)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Section>

              <div className="grid lg:grid-cols-2 gap-8">
                <Section title="Lead quality" tone="emerald" textPrimary={textPrimary}>
                  {qTotal === 0 ? (
                    <p className={`text-xs ${textSecondary}`}>No quality ratings in this period.</p>
                  ) : (
                    <div className="space-y-2" data-testid="meta-perf-summary-quality">
                      {[
                        { id: 'good', label: 'Good', tone: 'emerald' },
                        { id: 'average', label: 'Average', tone: 'amber' },
                        { id: 'poor', label: 'Poor', tone: 'rose' },
                      ].map(r => (
                        <div key={r.id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className={textPrimary}>{r.label}</span>
                            <span className={textSecondary}>{q[r.id]} · {Math.round((q[r.id] / qTotal) * 100)}%</span>
                          </div>
                          <div className={`h-2.5 rounded-full ${bgSecondary} overflow-hidden`}>
                            <div className={`h-full rounded-full ${TONES[r.tone].bar}`} style={{ width: `${(q[r.id] / qTotal) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                      <p className={`text-[10px] ${textSecondary}`}>Based on {qTotal} campaign rating{qTotal === 1 ? '' : 's'} from the daily reports.</p>
                    </div>
                  )}
                </Section>

                <Section title="Ad wallet" tone="teal" textPrimary={textPrimary}>
                  <div className="space-y-3" data-testid="meta-perf-summary-wallet">
                    <div className="grid grid-cols-3 gap-2">
                      <div className={`rounded-lg border ${TONES.teal.box} p-2`}>
                        <p className={`text-[10px] uppercase ${textSecondary}`}>Recharged (all)</p>
                        <p className={`text-sm font-bold tabular-nums ${TONES.teal.text}`}>{money(data.wallet.recharged_all)}</p>
                      </div>
                      <div className={`rounded-lg border ${TONES.orange.box} p-2`}>
                        <p className={`text-[10px] uppercase ${textSecondary}`}>Spent (all)</p>
                        <p className={`text-sm font-bold tabular-nums ${TONES.orange.text}`}>{money(data.wallet.spend_all)}</p>
                      </div>
                      <div className={`rounded-lg border ${data.wallet.balance < 0 ? TONES.rose.box : TONES.emerald.box} p-2`}>
                        <p className={`text-[10px] uppercase ${textSecondary}`}>Balance</p>
                        <p className={`text-sm font-bold tabular-nums ${data.wallet.balance < 0 ? TONES.rose.text : TONES.emerald.text}`}>{money(data.wallet.balance)}</p>
                      </div>
                    </div>
                    <div>
                      <p className={`text-[11px] font-medium uppercase mb-1 ${textSecondary}`}>Recharges in this period ({data.recharges.length})</p>
                      {data.recharges.length === 0 ? (
                        <p className={`text-xs ${textSecondary}`}>None logged.</p>
                      ) : (
                        <ul className={`rounded-lg border ${borderColor} divide-y max-h-40 overflow-y-auto`}>
                          {data.recharges.map(r => (
                            <li key={r.recharge_id} className={`flex items-center justify-between gap-3 px-3 py-2 text-xs ${borderColor}`}>
                              <span className={textPrimary}>{fmtDate(r.date)}</span>
                              <span className={`${textSecondary} flex-1 truncate`}>{r.note || '—'}{r.created_by_name ? ` · ${r.created_by_name}` : ''}</span>
                              <span className={`font-semibold tabular-nums ${TONES.teal.text}`}>{money(r.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </Section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
