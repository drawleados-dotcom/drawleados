import React, { useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { parseMetaCsv, LEVEL_LABEL } from './metaCsvImport';

const API = process.env.REACT_APP_BACKEND_URL;

const money = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 }));
const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Import a Meta Ads Manager export (Campaign / Ad Set / Ad level) for one
 * reporting day. Only Ad-level files carry performance numbers into the
 * Reports system (they're the only level with an ad to attach a number to);
 * Campaign and Ad Set files just bulk-create/update the structure and, when
 * the file states one, a daily budget.
 */
export default function MetaCsvImportModal({
  project, allowedLevels, headers, onClose, onImported,
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const [level, setLevel] = useState(allowedLevels[0]);
  const [campaignId, setCampaignId] = useState('');
  const [adSetId, setAdSetId] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { rows, date, dateError, skippedSummaryRows, levelMismatch }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const campaigns = project.campaigns || [];
  const campaign = campaigns.find((c) => c.id === campaignId);
  const adSets = campaign?.ad_sets || [];

  const needsCampaign = level === 'adset' || level === 'ad';
  const needsAdSet = level === 'ad';
  const parentReady = (!needsCampaign || !!campaignId) && (!needsAdSet || !!adSetId);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFileName(f.name);
    setParsed(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setParsed(parseMetaCsv(String(reader.result || ''), level));
    reader.onerror = () => toast.error("Couldn't read that file");
    reader.readAsText(f);
  };

  const reset = () => { setFileName(''); setParsed(null); setResult(null); if (fileRef.current) fileRef.current.value = ''; };
  const changeLevel = (v) => { setLevel(v); setCampaignId(''); setAdSetId(''); reset(); };

  const doImport = async () => {
    if (!parsed || parsed.dateError || parsed.rows.length === 0) return;
    setBusy(true);
    try {
      let res;
      if (level === 'campaign') {
        res = await axios.post(`${API}/api/meta-import/${project.project_id}/campaigns`, { date: parsed.date, rows: parsed.rows }, { headers });
      } else if (level === 'adset') {
        res = await axios.post(`${API}/api/meta-import/${project.project_id}/ad-sets`, { date: parsed.date, campaign_id: campaignId, rows: parsed.rows }, { headers });
      } else {
        res = await axios.post(`${API}/api/meta-import/${project.project_id}/ads`, { date: parsed.date, campaign_id: campaignId, ad_set_id: adSetId, rows: parsed.rows }, { headers });
      }
      setResult(res.data);
      onImported?.();
      toast.success('Imported');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const preview = useMemo(() => (parsed?.rows || []).slice(0, 8), [parsed]);
  const inputCls = `w-full h-9 rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} px-2 text-sm disabled:opacity-50`;
  const canImport = parsed && !parsed.dateError && !parsed.levelMismatch && parsed.rows.length > 0 && parentReady;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => !busy && onClose()} data-testid="meta-csv-import-modal">
      <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className={`p-4 border-b ${borderColor} flex items-start justify-between gap-3`}>
          <div>
            <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}><Upload className="h-4 w-4 text-[#6366f1]" /> Import CSV</h3>
            <p className={`text-xs ${textSecondary}`}>A Meta Ads Manager export for a single reporting day.</p>
          </div>
          <button type="button" onClick={onClose} className={textSecondary} disabled={busy}><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {result ? (
            <div className="space-y-3" data-testid="meta-csv-import-result">
              <div className="flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-semibold">Imported for {fmtDate(result.date)}</span>
              </div>
              <ul className={`text-sm ${textPrimary} space-y-1 list-disc pl-5`}>
                {result.created?.length > 0 && <li>{result.created.length} new {LEVEL_LABEL[level].toLowerCase()}{result.created.length === 1 ? '' : 's'} created</li>}
                {result.matched?.length > 0 && <li>{result.matched.length} matched an existing {LEVEL_LABEL[level].toLowerCase()}</li>}
                {typeof result.budgets_set === 'number' && result.budgets_set > 0 && <li>{result.budgets_set} daily budget{result.budgets_set === 1 ? '' : 's'} set from the file</li>}
                {typeof result.reported === 'number' && <li>{result.reported} ad{result.reported === 1 ? '' : 's'} reported for the day{result.reported === 0 ? ' (rows had no numbers to report)' : ''}</li>}
              </ul>
              <div className="flex justify-end">
                <Button type="button" onClick={onClose} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="meta-csv-import-done">Done</Button>
              </div>
            </div>
          ) : (
            <>
              {allowedLevels.length > 1 && (
                <div>
                  <label className={`text-[11px] uppercase ${textSecondary}`}>This file is</label>
                  <div className={`inline-flex items-center gap-1 p-1 rounded-lg border ${borderColor} ${bgCard} mt-1`}>
                    {allowedLevels.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => changeLevel(l)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${level === l ? 'bg-[#6366f1] text-white' : `${textSecondary} hover:bg-[#6366f1]/10`}`}
                        data-testid={`meta-csv-level-${l}`}
                      >
                        {LEVEL_LABEL[l]} performance
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {needsCampaign && (
                <div>
                  <label className={`text-[11px] uppercase ${textSecondary}`}>Campaign this file's {LEVEL_LABEL[level].toLowerCase()}s belong to</label>
                  {campaigns.length === 0 ? (
                    <p className="text-xs text-amber-500 mt-1">This project has no campaigns yet — import a Campaign CSV first, or add one on the Campaigns tab.</p>
                  ) : (
                    <select value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setAdSetId(''); }} className={inputCls} data-testid="meta-csv-campaign-select">
                      <option value="">Select campaign</option>
                      {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </div>
              )}
              {needsAdSet && campaignId && (
                <div>
                  <label className={`text-[11px] uppercase ${textSecondary}`}>Ad set this file's ads belong to</label>
                  {adSets.length === 0 ? (
                    <p className="text-xs text-amber-500 mt-1">This campaign has no ad sets yet — import an Ad Set CSV first, or add one on the Campaigns tab.</p>
                  ) : (
                    <select value={adSetId} onChange={(e) => setAdSetId(e.target.value)} className={inputCls} data-testid="meta-csv-adset-select">
                      <option value="">Select ad set</option>
                      {adSets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              {(!needsCampaign || parentReady || campaigns.length > 0) && (
                <div>
                  <label className={`text-[11px] uppercase ${textSecondary}`}>CSV file</label>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={pickFile} className={`block w-full text-sm ${textSecondary} mt-1`} data-testid="meta-csv-file-input" />
                </div>
              )}

              {fileName && parsed && (
                <div className={`rounded-lg border ${borderColor} p-3 space-y-2`} data-testid="meta-csv-preview">
                  <div className="flex items-center gap-2 text-sm">
                    <FileSpreadsheet className={`h-4 w-4 ${textSecondary}`} />
                    <span className={textPrimary}>{fileName}</span>
                  </div>

                  {parsed.levelMismatch && (
                    <p className="text-xs text-red-500 flex items-start gap-1"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> This looks like a {LEVEL_LABEL[parsed.detectedLevel]}-level export, not {LEVEL_LABEL[level]}. Switch the file type above, or upload the right file.</p>
                  )}
                  {parsed.dateError && (
                    <p className="text-xs text-red-500 flex items-start gap-1"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {parsed.dateError}</p>
                  )}
                  {!parsed.levelMismatch && !parsed.dateError && (
                    <>
                      <p className={`text-sm ${textPrimary}`}>
                        <span className="font-medium">{parsed.rows.length}</span> row{parsed.rows.length === 1 ? '' : 's'} for <span className="font-medium">{fmtDate(parsed.date)}</span>
                        {parsed.skippedSummaryRows > 0 && <span className={textSecondary}> · {parsed.skippedSummaryRows} account-total row{parsed.skippedSummaryRows === 1 ? '' : 's'} skipped</span>}
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className={bgSecondary}>
                            <tr>
                              <th className={`text-left px-2 py-1 ${textSecondary}`}>Name</th>
                              <th className={`text-right px-2 py-1 ${textSecondary}`}>Leads</th>
                              <th className={`text-right px-2 py-1 ${textSecondary}`}>Spend</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.map((r) => (
                              <tr key={r.name} className={`border-t ${borderColor}`}>
                                <td className={`px-2 py-1 ${textPrimary} truncate max-w-[280px]`}>{r.name}</td>
                                <td className={`px-2 py-1 text-right ${textPrimary}`}>{num(r.leads)}</td>
                                <td className={`px-2 py-1 text-right ${textPrimary}`}>{money(r.spend)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {parsed.rows.length > preview.length && <p className={`text-[11px] mt-1 ${textSecondary}`}>+ {parsed.rows.length - preview.length} more</p>}
                      </div>
                      <p className={`text-[11px] ${textSecondary}`}>
                        {level === 'ad'
                          ? 'A name that already exists in this ad set is matched and its numbers for the day are replaced; a new name creates the ad.'
                          : `A name that already exists is matched (and its daily budget updated, if the file states one); a new name creates the ${LEVEL_LABEL[level].toLowerCase()}. This file's own spend/leads aren't stored — import the Ads-level file for that to count in Reports.`}
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {!result && (
          <div className={`p-4 border-t ${borderColor} flex justify-end gap-2`}>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="button" onClick={doImport} disabled={!canImport || busy} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="meta-csv-import-confirm">
              {busy ? 'Importing…' : 'Import'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
