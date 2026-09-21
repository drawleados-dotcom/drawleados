import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Plus, Trash2, CheckCircle2, Pencil, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const num = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const cplOf = (spend, leads) => (Number(leads) > 0 ? Number(spend) / Number(leads) : null);
const cplText = (spend, leads) => { const v = cplOf(spend, leads); return v == null ? '—' : money(v); };
const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

const IMAGE_URL = /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i;
const thumbCache = new Map();

// Ad creative thumbnail: the uploaded creative (fetched once and cached), else
// a creative link that is itself an image, else a placeholder.
function AdThumb({ ad, headersRef, borderColor, textSecondary }) {
  const fileId = ad.creative_file_id || ad.editing_file_id || null;
  const direct = !fileId && IMAGE_URL.test(ad.creative_link || '') ? ad.creative_link : null;
  const [src, setSrc] = useState(() => direct || (fileId && thumbCache.get(fileId)) || null);
  useEffect(() => {
    if (!fileId || thumbCache.has(fileId)) { if (fileId) setSrc(thumbCache.get(fileId)); return undefined; }
    let live = true;
    axios.get(`${API}/api/ad-tasks/files/${fileId}`, { headers: headersRef.current })
      .then(res => { thumbCache.set(fileId, res.data?.data_url || null); if (live) setSrc(res.data?.data_url || null); })
      .catch(() => {});
    return () => { live = false; };
  }, [fileId, headersRef]);
  return src ? (
    <img src={src} alt={ad.name || 'creative'} className={`h-11 w-11 rounded-md object-cover border ${borderColor}`} />
  ) : (
    <div className={`h-11 w-11 rounded-md border ${borderColor} flex items-center justify-center ${textSecondary}`} title="No creative yet">
      <ImageIcon className="h-4 w-4" />
    </div>
  );
}

const sel = (bgSecondary, borderColor, textPrimary) => `w-full h-9 rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} px-2 text-sm disabled:opacity-50`;

/** The Ads sub-popup: one row per ad of the ad set — creative, name, leads, spend, CPL — auto-saved. */
function AdsSubPopup({ projectId, date, campaign, adSet, saved, headersRef, onDetail, onClose, theme }) {
  const { bgCard, bgSecondary, textPrimary, textSecondary, borderColor } = theme;
  const [values, setValues] = useState(() => Object.fromEntries((adSet.ads || []).map(ad => {
    const e = saved.find(x => x.ad_id === ad.id);
    return [ad.id, { leads: e ? String(e.total_leads) : '', spend: e ? String(e.total_spend) : '' }];
  })));
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const valuesRef = useRef(values);
  const propsRef = useRef({ campaign, adSet, onDetail });
  propsRef.current = { campaign, adSet, onDetail };
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  const chainRef = useRef(Promise.resolve(true));
  const firstRef = useRef(true);
  const inflight = useRef(0);

  const invalid = useMemo(() => Object.values(values).some(v => ['leads', 'spend'].some(k => v[k] !== '' && !(Number(v[k]) >= 0 && Number.isFinite(Number(v[k]))))), [values]);

  const doSave = useCallback(async () => {
    const { campaign: camp, adSet: set, onDetail: report } = propsRef.current;
    const cur = valuesRef.current;
    const bad = Object.values(cur).some(v => ['leads', 'spend'].some(k => v[k] !== '' && !(Number(v[k]) >= 0 && Number.isFinite(Number(v[k])))));
    if (bad) { setStatus('error'); return false; }
    inflight.current += 1;
    setStatus('saving');
    try {
      const res = await axios.put(`${API}/api/meta-reports/daily/${projectId}/${date}`, {
        campaign_id: camp.id,
        ad_set_id: set.id,
        rows: (set.ads || []).map(ad => ({
          ad_id: ad.id,
          leads: cur[ad.id].leads === '' ? null : Number(cur[ad.id].leads),
          spend: cur[ad.id].spend === '' ? null : Number(cur[ad.id].spend),
        })),
      }, { headers: headersRef.current });
      dirtyRef.current = valuesRef.current !== cur;
      report(res.data);
      inflight.current -= 1;
      if (inflight.current === 0) setStatus('saved');
      return true;
    } catch (e) {
      inflight.current -= 1;
      setStatus('error');
      toast.error(e.response?.data?.detail || 'Could not save this report');
      return false;
    }
  }, [projectId, date, headersRef]);

  const enqueue = useCallback(() => {
    chainRef.current = chainRef.current.then(doSave);
    return chainRef.current;
  }, [doSave]);

  useEffect(() => {
    valuesRef.current = values;
    if (firstRef.current) { firstRef.current = false; return undefined; }
    dirtyRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { enqueue(); }, 900);
    return () => clearTimeout(timerRef.current);
  }, [values, enqueue]);

  const finishRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') finishRef.current?.(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const finish = async (saveClicked) => {
    clearTimeout(timerRef.current);
    if (invalid) { toast.error('Enter leads and spend as numbers of 0 or more'); return; }
    let ok = true;
    if (dirtyRef.current || saveClicked) ok = await enqueue();
    if (ok) onClose(true);
  };

  finishRef.current = finish;
  const setVal = (adId, key, v) => setValues(prev => ({ ...prev, [adId]: { ...prev[adId], [key]: v } }));
  const ads = adSet.ads || [];
  const totLeads = ads.reduce((s, ad) => s + (Number(values[ad.id].leads) || 0), 0);
  const totSpend = ads.reduce((s, ad) => s + (Number(values[ad.id].spend) || 0), 0);
  const inputCls = `h-9 w-full rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} px-2 text-sm text-right tabular-nums`;
  const th = `px-3 py-2 text-[11px] font-medium uppercase ${textSecondary}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={(e) => { e.stopPropagation(); finish(false); }} data-testid="meta-report-ads-popup">
      <div
        className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-3xl max-h-[88vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-4 border-b ${borderColor} flex items-start justify-between gap-3`}>
          <div>
            <h3 className={`text-base font-semibold ${textPrimary}`}>Ads</h3>
            <p className={`text-xs ${textSecondary}`}>{campaign.name} <span className="mx-1">›</span> {adSet.name} · {longDate(date)}</p>
          </div>
          <button type="button" onClick={() => finish(false)} className={textSecondary} title="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className={bgSecondary}>
              <tr>
                <th className={`${th} text-left w-20`}>Ad Creative</th>
                <th className={`${th} text-left`}>Ad Name</th>
                <th className={`${th} text-right w-32`}>No. Leads</th>
                <th className={`${th} text-right w-36`}>Spend (₹)</th>
                <th className={`${th} text-right w-28`}>CPL</th>
              </tr>
            </thead>
            <tbody>
              {ads.map(ad => (
                <tr key={ad.id} className={`border-t ${borderColor}`} data-testid={`meta-report-ad-row-${ad.id}`}>
                  <td className="px-3 py-2"><AdThumb ad={ad} headersRef={headersRef} borderColor={borderColor} textSecondary={textSecondary} /></td>
                  <td className={`px-3 py-2 text-sm font-medium ${textPrimary}`}>
                    {ad.name || 'Untitled ad'}
                    <span className={`block text-[10px] font-normal capitalize ${textSecondary}`}>{ad.ad_type}</span>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="any" inputMode="decimal" value={values[ad.id].leads} onChange={(e) => setVal(ad.id, 'leads', e.target.value)} className={inputCls} placeholder="0" data-testid={`meta-report-leads-${ad.id}`} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="any" inputMode="decimal" value={values[ad.id].spend} onChange={(e) => setVal(ad.id, 'spend', e.target.value)} className={inputCls} placeholder="0" data-testid={`meta-report-spend-${ad.id}`} />
                  </td>
                  <td className={`px-3 py-2 text-sm text-right tabular-nums ${textPrimary}`}>{cplText(values[ad.id].spend, values[ad.id].leads)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={`border-t-2 ${borderColor} ${bgSecondary}`}>
                <td className={`px-3 py-2 text-xs font-semibold uppercase ${textSecondary}`} colSpan={2}>Total ({ads.length} ad{ads.length === 1 ? '' : 's'})</td>
                <td className={`px-3 py-2 text-sm text-right font-semibold tabular-nums ${textPrimary}`}>{num(totLeads)}</td>
                <td className={`px-3 py-2 text-sm text-right font-semibold tabular-nums ${textPrimary}`}>{money(totSpend)}</td>
                <td className={`px-3 py-2 text-sm text-right font-semibold tabular-nums ${textPrimary}`}>{cplText(totSpend, totLeads)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={`p-4 border-t ${borderColor} flex items-center justify-between gap-3`}>
          <span className={`text-xs ${status === 'error' || invalid ? 'text-red-500' : textSecondary}`} data-testid="meta-report-autosave-status">
            {invalid ? 'Enter numbers of 0 or more' : status === 'saving' ? 'Saving…' : status === 'saved' ? '✓ All changes saved' : status === 'error' ? 'Could not save — try again' : 'Changes save automatically'}
          </span>
          <Button type="button" onClick={() => finish(true)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="meta-report-ads-save">Save</Button>
        </div>
      </div>
    </div>
  );
}

const newRow = () => ({ key: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, campaign_id: '', ad_set_id: '' });

/**
 * One day of a Meta Ads project's report. Pick a campaign and ad set, open its
 * ads, and enter leads + spend per ad (auto-saved). Once every ad of every
 * campaign is reported the popup shows the submitted report instead.
 * Used from the project's Reports tab and from My Tasks (assigned report task).
 */
export default function MetaDayReportPopup({
  projectId, date, headers, canEdit = true, onClose, onChanged,
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const theme = { bgCard, bgSecondary, textPrimary, textSecondary, borderColor };
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('edit'); // edit | submitted
  const [rows, setRows] = useState([]);
  const [adsRowKey, setAdsRowKey] = useState(null);
  const changedRef = useRef(false);

  useEffect(() => {
    let live = true;
    axios.get(`${API}/api/meta-reports/daily/${projectId}/${date}`, { headers: headersRef.current })
      .then(res => {
        if (!live) return;
        const d = res.data;
        setDetail(d);
        const seen = new Set();
        const initial = [];
        (d.entries || []).forEach(e => {
          if (!seen.has(e.ad_set_id)) { seen.add(e.ad_set_id); initial.push({ ...newRow(), campaign_id: e.campaign_id, ad_set_id: e.ad_set_id }); }
        });
        setRows(initial.length ? initial : [newRow()]);
        setView(d.coverage.complete ? 'submitted' : 'edit');
      })
      .catch(e => { if (live) setError(e.response?.data?.detail || 'Could not load this day'); });
    return () => { live = false; };
  }, [projectId, date]);

  const onDetail = useCallback((d) => { changedRef.current = true; setDetail(d); }, []);
  const close = () => { onClose(); if (changedRef.current) onChanged?.(); };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && adsRowKey === null) { onClose(); if (changedRef.current) onChanged?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const structure = detail?.structure || [];
  const campaignById = (id) => structure.find(c => c.id === id);
  const adSetById = (cid, sid) => campaignById(cid)?.ad_sets.find(a => a.id === sid);
  const savedFor = (sid) => (detail?.entries || []).filter(e => e.ad_set_id === sid);
  const covSet = (cid, sid) => detail?.coverage.campaigns.find(c => c.id === cid)?.ad_sets.find(a => a.id === sid);
  const usedSets = (exceptKey) => new Set(rows.filter(r => r.key !== exceptKey && r.ad_set_id).map(r => r.ad_set_id));
  const setRow = (key, patch) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const pendingSets = () => {
    const have = new Set(rows.map(r => r.ad_set_id));
    const out = [];
    (detail?.coverage.campaigns || []).forEach(c => c.ad_sets.forEach(a => {
      if (!a.complete && !have.has(a.id)) out.push({ ...newRow(), campaign_id: c.id, ad_set_id: a.id });
    }));
    return out;
  };

  const openRow = rows.find(r => r.key === adsRowKey);
  const openCampaign = openRow && campaignById(openRow.campaign_id);
  const openAdSet = openRow && adSetById(openRow.campaign_id, openRow.ad_set_id);

  const th = `px-3 py-2 text-[11px] font-medium uppercase ${textSecondary}`;
  const cov = detail?.coverage;
  const pct = cov && cov.ads_total ? Math.round((cov.ads_reported / cov.ads_total) * 100) : 0;
  const entryTable = (entries) => (
    <table className="w-full">
      <thead className={bgSecondary}>
        <tr>
          <th className={`${th} text-left w-16`}>Creative</th>
          <th className={`${th} text-left`}>Ad Name</th>
          <th className={`${th} text-right w-28`}>No. Leads</th>
          <th className={`${th} text-right w-32`}>Spend</th>
          <th className={`${th} text-right w-28`}>CPL</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(e => {
          const ad = adSetById(e.campaign_id, e.ad_set_id)?.ads.find(a => a.id === e.ad_id) || { name: e.ad_name };
          return (
            <tr key={e.ad_id} className={`border-t ${borderColor}`}>
              <td className="px-3 py-2"><AdThumb ad={ad} headersRef={headersRef} borderColor={borderColor} textSecondary={textSecondary} /></td>
              <td className={`px-3 py-2 text-sm ${textPrimary}`}>{e.ad_name || ad.name}</td>
              <td className={`px-3 py-2 text-sm text-right tabular-nums ${textPrimary}`}>{num(e.total_leads)}</td>
              <td className={`px-3 py-2 text-sm text-right tabular-nums ${textPrimary}`}>{money(e.total_spend)}</td>
              <td className={`px-3 py-2 text-sm text-right tabular-nums ${textPrimary}`}>{cplText(e.total_spend, e.total_leads)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={close} data-testid="meta-day-report-popup">
      <div className={`${bgCard} border ${borderColor} rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden`} onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-white/70">Daily Meta Ads report</p>
            <h3 className="text-xl font-bold truncate">{longDate(date)}</h3>
            <p className="text-xs text-white/80 truncate">{detail?.project?.name || ''}</p>
          </div>
          <button type="button" onClick={close} className="p-1 rounded-md hover:bg-white/15" title="Close" data-testid="meta-day-report-close"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {error ? (
            <p className="text-center text-sm text-red-500 py-10">{error}</p>
          ) : !detail ? (
            <p className={`text-center text-sm ${textSecondary} py-10`}>Loading report…</p>
          ) : view === 'submitted' ? (
            <>
              <div className="rounded-xl border border-[#10b981]/30 bg-[#10b981]/10 p-4 flex flex-wrap items-center justify-between gap-3" data-testid="meta-report-submitted">
                <div className="flex items-center gap-2 text-[#10b981]">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-semibold">Report submitted — all {cov.ads_total} ad{cov.ads_total === 1 ? '' : 's'} across {cov.campaigns_total} campaign{cov.campaigns_total === 1 ? '' : 's'} reported</span>
                </div>
                {canEdit && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setView('edit')} data-testid="meta-report-edit"><Pencil className="h-3.5 w-3.5 mr-1" /> Edit report</Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: 'Total Leads', v: num(detail.leads), c: 'border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]' },
                  { l: 'Total Spend', v: money(detail.spend), c: 'border-[#f97316]/30 bg-[#f97316]/10 text-[#f97316]' },
                  { l: 'Cost per Lead', v: cplText(detail.spend, detail.leads), c: 'border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[#8b5cf6]' },
                ].map(k => (
                  <div key={k.l} className={`rounded-xl border p-3 ${k.c}`}>
                    <p className={`text-[11px] font-medium uppercase ${textSecondary}`}>{k.l}</p>
                    <p className="text-xl font-bold tabular-nums">{k.v}</p>
                  </div>
                ))}
              </div>
              {structure.map(c => {
                const es = (detail.entries || []).filter(e => e.campaign_id === c.id);
                if (!es.length) return null;
                const leads = es.reduce((s, e) => s + e.total_leads, 0);
                const spend = es.reduce((s, e) => s + e.total_spend, 0);
                return (
                  <section key={c.id} className={`rounded-xl border ${borderColor} overflow-hidden`} data-testid={`meta-report-campaign-${c.id}`}>
                    <div className={`${bgSecondary} px-4 py-2 flex flex-wrap items-center justify-between gap-2`}>
                      <p className={`text-sm font-semibold ${textPrimary}`}>{c.name}</p>
                      <p className={`text-xs ${textSecondary}`}>{num(leads)} leads · {money(spend)} · CPL {cplText(spend, leads)}</p>
                    </div>
                    {c.ad_sets.map(a => {
                      const ae = es.filter(e => e.ad_set_id === a.id);
                      if (!ae.length) return null;
                      return (
                        <div key={a.id}>
                          <p className={`px-4 pt-3 pb-1 text-[11px] font-medium uppercase ${textSecondary}`}>Ad set · {a.name}</p>
                          {entryTable(ae)}
                        </div>
                      );
                    })}
                  </section>
                );
              })}
            </>
          ) : (
            <>
              <div className={`rounded-xl border ${borderColor} p-4 space-y-2`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`text-sm font-medium ${textPrimary}`}>
                    {cov.ads_reported} of {cov.ads_total} ad{cov.ads_total === 1 ? '' : 's'} reported · {cov.campaigns_complete} of {cov.campaigns_total} campaign{cov.campaigns_total === 1 ? '' : 's'} complete
                  </p>
                  <p className={`text-xs ${textSecondary}`}>Saved automatically as you type</p>
                </div>
                <div className={`h-2 rounded-full ${bgSecondary} overflow-hidden`}><div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${pct}%` }} /></div>
                <div className="flex flex-wrap gap-1.5">
                  {cov.campaigns.filter(c => c.ads_total > 0).map(c => (
                    <span key={c.id} className={`text-[11px] px-2 py-0.5 rounded-full border ${c.complete ? 'border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]' : c.ads_reported ? 'border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b]' : `${borderColor} ${textSecondary}`}`}>
                      {c.complete ? '✓ ' : ''}{c.name} · {c.ads_reported}/{c.ads_total}
                    </span>
                  ))}
                </div>
              </div>

              {cov.ads_total === 0 ? (
                <p className={`text-sm ${textSecondary} text-center py-6`}>This project had no ads on this day, so there is nothing to report.</p>
              ) : (
                <div className={`rounded-xl border ${borderColor} overflow-x-auto`}>
                  <div className={`grid grid-cols-[minmax(160px,1.4fr)_minmax(160px,1.4fr)_120px_90px_110px_90px_36px] gap-3 px-4 py-2 ${bgSecondary}`}>
                    {['Campaign', 'Ad Set', 'Ads', 'Leads', 'Spend', 'CPL', ''].map((h, i) => <span key={i} className={`text-[11px] font-medium uppercase ${textSecondary} ${i >= 3 && i <= 5 ? 'text-right' : ''}`}>{h}</span>)}
                  </div>
                  {rows.map(r => {
                    const camp = campaignById(r.campaign_id);
                    const set = adSetById(r.campaign_id, r.ad_set_id);
                    const es = r.ad_set_id ? savedFor(r.ad_set_id) : [];
                    const leads = es.reduce((s, e) => s + e.total_leads, 0);
                    const spend = es.reduce((s, e) => s + e.total_spend, 0);
                    const cs = r.ad_set_id ? covSet(r.campaign_id, r.ad_set_id) : null;
                    const used = usedSets(r.key);
                    return (
                      <div key={r.key} className={`grid grid-cols-[minmax(160px,1.4fr)_minmax(160px,1.4fr)_120px_90px_110px_90px_36px] gap-3 px-4 py-3 border-t ${borderColor} items-center`} data-testid={`meta-report-row-${r.key}`}>
                        <select
                          value={r.campaign_id}
                          onChange={(e) => setRow(r.key, { campaign_id: e.target.value, ad_set_id: '' })}
                          disabled={!canEdit || es.length > 0}
                          className={sel(bgSecondary, borderColor, textPrimary)}
                          data-testid={`meta-report-campaign-select-${r.key}`}
                        >
                          <option value="">Select campaign</option>
                          {structure.filter(c => c.ad_sets.some(a => a.ads.length)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select
                          value={r.ad_set_id}
                          onChange={(e) => setRow(r.key, { ad_set_id: e.target.value })}
                          disabled={!canEdit || !camp || es.length > 0}
                          className={sel(bgSecondary, borderColor, textPrimary)}
                          data-testid={`meta-report-adset-select-${r.key}`}
                        >
                          <option value="">Select ad set</option>
                          {(camp?.ad_sets || []).filter(a => a.ads.length && !used.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!set || !canEdit}
                          onClick={() => setAdsRowKey(r.key)}
                          className={cs?.complete ? 'border-[#10b981]/50 text-[#10b981]' : ''}
                          data-testid={`meta-report-open-ads-${r.key}`}
                        >
                          {cs ? `Open · ${cs.ads_reported}/${cs.ads_total}` : 'Open'}
                        </Button>
                        <span className={`text-sm text-right tabular-nums ${textPrimary}`}>{es.length ? num(leads) : '—'}</span>
                        <span className={`text-sm text-right tabular-nums ${textPrimary}`}>{es.length ? money(spend) : '—'}</span>
                        <span className={`text-sm text-right tabular-nums ${textPrimary}`}>{es.length ? cplText(spend, leads) : '—'}</span>
                        {canEdit && es.length === 0 && rows.length > 1 ? (
                          <button type="button" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))} className="text-red-500 hover:text-red-400" title="Remove row"><Trash2 className="h-4 w-4" /></button>
                        ) : <span />}
                      </div>
                    );
                  })}
                </div>
              )}

              {canEdit && cov.ads_total > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setRows(rs => [...rs, newRow()])} data-testid="meta-report-add-row"><Plus className="h-3.5 w-3.5 mr-1" /> Add row</Button>
                  {pendingSets().length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setRows(rs => [...rs.filter(r => r.ad_set_id), ...pendingSets()])} data-testid="meta-report-add-pending">
                      Add all pending ad sets ({pendingSets().length})
                    </Button>
                  )}
                </div>
              )}

              <div className={`flex flex-wrap items-center justify-between gap-3 border-t ${borderColor} pt-4`}>
                <p className={`text-sm ${textPrimary}`}>
                  Day total: <span className="font-semibold">{num(detail.leads)}</span> leads · <span className="font-semibold">{money(detail.spend)}</span> · CPL <span className="font-semibold">{cplText(detail.spend, detail.leads)}</span>
                </p>
                <Button type="button" onClick={close} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="meta-report-done">Done</Button>
              </div>

              {detail.legacy_entries?.length > 0 && (
                <p className={`text-xs ${textSecondary}`}>This day also has {detail.legacy_entries.length} campaign-level entr{detail.legacy_entries.length === 1 ? 'y' : 'ies'} from the earlier report format; they are included in the totals above.</p>
              )}
            </>
          )}

          {detail && view === 'submitted' && detail.legacy_entries?.length > 0 && (
            <section className={`rounded-xl border ${borderColor} overflow-hidden`}>
              <p className={`${bgSecondary} px-4 py-2 text-xs font-medium uppercase ${textSecondary}`}>Earlier-format entries</p>
              {detail.legacy_entries.map((e, i) => (
                <div key={i} className={`px-4 py-2 border-t ${borderColor} text-sm ${textPrimary} flex flex-wrap justify-between gap-2`}>
                  <span>{e.campaign_name}</span>
                  <span className={textSecondary}>{num(e.total_leads)} leads · {money(e.total_spend)}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>

      {openRow && openCampaign && openAdSet && (
        <AdsSubPopup
          key={openRow.key}
          projectId={projectId}
          date={date}
          campaign={openCampaign}
          adSet={openAdSet}
          saved={savedFor(openAdSet.id)}
          headersRef={headersRef}
          onDetail={onDetail}
          theme={theme}
          onClose={() => {
            setAdsRowKey(null);
            axios.get(`${API}/api/meta-reports/daily/${projectId}/${date}`, { headers: headersRef.current })
              .then(res => { setDetail(res.data); if (res.data.coverage.complete) setView('submitted'); })
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
