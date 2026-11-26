import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, FileSpreadsheet, Link2, RefreshCw, ExternalLink, Trash2, Pencil, Plus, Check, AlertCircle, Layers } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL;

const SOURCE_TYPES = [
  { v: 'meta', label: 'Meta Ads' },
  { v: 'whatsapp', label: 'WhatsApp' },
  { v: 'website', label: 'Website' },
  { v: 'walk_in', label: 'Walk-in' },
  { v: 'referral', label: 'Referral' },
  { v: 'link', label: 'Link' },
  { v: 'other', label: 'Other' },
];
const sourceLabel = (v) => SOURCE_TYPES.find((s) => s.v === v)?.label || v;

const emptyForm = { name: '', sheet_url: '', source_type: 'website' };
const SHEET_URL_RE = /\/spreadsheets\/d\/[a-zA-Z0-9-_]+/;
const emptyTabsInfo = { url: '', loading: false, error: '', title: '', tabs: [] };

/**
 * SheetConnectModal — manages every connected sheet of one type (Prospect
 * or Lead). A type can hold multiple sheets (e.g. a separate Meta Ads sheet
 * and WhatsApp sheet both feeding Lead) — each is its own config, synced
 * independently via its config_id.
 * Props:
 *   open, onClose, onSaved
 *   sheetType: 'prospect' | 'lead'
 *   userId, headers
 *   theme: {bgCard, bgSecondary, borderColor, textPrimary, textSecondary}
 */
export default function SheetConnectModal({
  open, onClose, onSaved, sheetType, userId, headers,
  bgCard = 'bg-white', bgSecondary = 'bg-gray-100',
  borderColor = 'border-gray-200', textPrimary = 'text-gray-900', textSecondary = 'text-gray-500',
  stagesPanel = null,
}) {
  const [oauthConnected, setOauthConnected] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState(null); // null = adding a new sheet
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState({ headers: [], rows: [], total: 0 });
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  // Tab picker: the pasted sheet's tabs with new / already-in-leads counts
  // (POST /sheets/inspect), and which tabs this connection syncs.
  const [tabsInfo, setTabsInfo] = useState(emptyTabsInfo);
  const [selectedTabs, setSelectedTabs] = useState([]);
  const presetTabsRef = useRef(null); // edit mode: the config's saved tabs, applied once they load

  const label = sheetType === 'prospect' ? 'Prospect Sheet' : 'Lead Sheet';

  // The parent builds `headers` as a fresh object every render. Reading it
  // through a ref keeps refreshStatus stable — otherwise every parent
  // re-render (stages panel typing, leads/stats finishing loading) re-ran the
  // open-reset effect below and wiped a half-filled "Add New Sheet" form.
  const headersRef = useRef(headers);
  headersRef.current = headers;

  const refreshStatus = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        axios.get(`${API}/api/sheets/status`, { headers: headersRef.current }),
        axios.get(`${API}/api/sheets/configs`, { headers: headersRef.current }),
      ]);
      setOauthConnected(!!s.data?.connected);
      setConfigs(c.data?.[sheetType] || []);
    } catch { /* ignore */ }
  }, [sheetType]);

  // Reset only when the modal opens, never while it's open.
  useEffect(() => {
    if (!open) return;
    refreshStatus();
    setFormOpen(false);
    setEditingConfigId(null);
    setForm(emptyForm);
    setPreview({ headers: [], rows: [], total: 0 });
    setTabsInfo(emptyTabsInfo);
    setSelectedTabs([]);
  }, [open, refreshStatus]);

  // Load the pasted sheet's tabs (debounced) whenever the link changes.
  useEffect(() => {
    const url = form.sheet_url.trim();
    if (!formOpen || !oauthConnected || !SHEET_URL_RE.test(url)) {
      setTabsInfo(emptyTabsInfo);
      return undefined;
    }
    if (tabsInfo.url === url && !tabsInfo.error) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      setTabsInfo({ ...emptyTabsInfo, url, loading: true });
      try {
        const r = await axios.post(`${API}/api/sheets/inspect`, { sheet_url: url }, { headers: headersRef.current });
        if (cancelled) return;
        const tabs = r.data?.tabs || [];
        setTabsInfo({ url, loading: false, error: '', title: r.data?.spreadsheet_title || '', tabs });
        const titles = tabs.map((x) => x.title);
        const preset = presetTabsRef.current;
        presetTabsRef.current = null;
        if (preset) {
          // Editing: keep the saved tabs (an older connection with none = its first tab).
          setSelectedTabs(preset.length ? preset.filter((x) => titles.includes(x)) : titles.slice(0, 1));
        } else {
          setSelectedTabs(tabs.filter((x) => x.total > 0 && !x.hidden).map((x) => x.title));
        }
      } catch (e) {
        if (!cancelled) setTabsInfo({ ...emptyTabsInfo, url, error: e.response?.data?.detail || 'Could not read this sheet' });
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.sheet_url, formOpen, oauthConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // After OAuth completion, listen for url param sheets_connected=1 set by callback redirect
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('sheets_connected')) {
      refreshStatus();
      // Strip the param
      url.searchParams.delete('sheets_connected');
      url.searchParams.delete('sheet_type');
      window.history.replaceState({}, '', url.toString());
      toast.success('Google Sheets connected');
    }
  }, [refreshStatus]);

  const handleStartOAuth = async () => {
    try {
      const r = await axios.get(`${API}/api/oauth/sheets/login`, {
        params: { user_id: userId, sheet_type: sheetType },
        headers,
      });
      const popup = window.open(r.data.auth_url, 'sheets_oauth', 'width=500,height=700');
      // Poll until popup closes
      const timer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(timer);
          refreshStatus();
        }
      }, 800);
    } catch (e) {
      toast.error('Failed to start Google authorization');
    }
  };

  const handleDisconnectOAuth = async () => {
    if (!window.confirm('Disconnect your Google account from this app? You will need to reconnect to sync.')) return;
    try {
      await axios.delete(`${API}/api/sheets/disconnect`, { headers });
      setOauthConnected(false);
      toast.success('Google account disconnected');
    } catch (e) { toast.error('Failed to disconnect'); }
  };

  const openAddForm = () => {
    setEditingConfigId(null);
    presetTabsRef.current = null;
    setTabsInfo(emptyTabsInfo);
    setSelectedTabs([]);
    setForm(emptyForm);
    setPreview({ headers: [], rows: [], total: 0 });
    setFormOpen(true);
  };
  const openEditForm = (cfg) => {
    setEditingConfigId(cfg.config_id);
    presetTabsRef.current = cfg.tabs || [];
    setTabsInfo(emptyTabsInfo);
    setSelectedTabs(cfg.tabs || []);
    setForm({ name: cfg.name || '', sheet_url: cfg.sheet_url || '', source_type: cfg.source_type || 'website' });
    setPreview({ headers: [], rows: [], total: 0 });
    setFormOpen(true);
    if (cfg.sheet_id) {
      axios.get(`${API}/api/sheets/preview/${cfg.config_id}`, { headers })
        .then((r) => setPreview(r.data || { headers: [], rows: [], total: 0 }))
        .catch(() => { /* ignore — usually means not yet authorized */ });
    }
  };
  const closeForm = () => { setFormOpen(false); setEditingConfigId(null); setForm(emptyForm); setTabsInfo(emptyTabsInfo); setSelectedTabs([]); };
  const toggleTab = (title) => setSelectedTabs((prev) => (prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title]));

  const handleSave = async () => {
    if (!form.sheet_url.trim()) { toast.error('Sheet link is required'); return; }
    if (tabsInfo.tabs.length > 0 && selectedTabs.length === 0) { toast.error('Select at least one tab to sync'); return; }
    // Saved in the sheet's own tab order.
    const tabs = tabsInfo.tabs.length ? tabsInfo.tabs.map((x) => x.title).filter((x) => selectedTabs.includes(x)) : undefined;
    setBusy(true);
    try {
      if (editingConfigId) {
        await axios.put(`${API}/api/sheets/config/${editingConfigId}`, {
          name: form.name.trim(),
          sheet_url: form.sheet_url.trim(),
          source_type: form.source_type,
          ...(tabs ? { tabs } : {}),
        }, { headers });
        toast.success(`${label} updated`);
      } else {
        await axios.post(`${API}/api/sheets/config`, {
          sheet_type: sheetType,
          name: form.name.trim(),
          sheet_url: form.sheet_url.trim(),
          source_type: form.source_type,
          ...(tabs ? { tabs } : {}),
        }, { headers });
        toast.success(`${label} added`);
      }
      closeForm();
      await refreshStatus();
      onSaved && onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    finally { setBusy(false); }
  };

  const handleSyncNow = async (configId) => {
    setSyncingId(configId);
    try {
      const r = await axios.post(`${API}/api/sheets/sync/${configId}`, {}, { headers });
      const { inserted = 0, updated = 0, skipped_existing: skipped = 0 } = r.data || {};
      toast.success(`Synced — ${inserted} new, ${updated} updated${skipped ? `, ${skipped} already in leads (skipped)` : ''}`);
      await refreshStatus();
      onSaved && onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Sync failed');
      // A 401 here means the backend already cleared the dead token — pull
      // fresh status so the button switches to "Connect Google" right away
      // instead of still showing "connected" until the modal reopens.
      if (e.response?.status === 401) await refreshStatus();
    }
    finally { setSyncingId(null); }
  };

  const handleDeleteConfig = async (cfg) => {
    if (!window.confirm(`Remove "${cfg.name || 'this sheet'}"? Imported rows will also be cleared.`)) return;
    try {
      await axios.delete(`${API}/api/sheets/config/${cfg.config_id}`, { headers });
      toast.success('Removed');
      if (editingConfigId === cfg.config_id) closeForm();
      await refreshStatus();
      onSaved && onSaved();
    } catch { toast.error('Failed to remove'); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <Card className={`${bgCard} border ${borderColor} w-full max-w-3xl max-h-[92vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#34d399] flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${textPrimary}`}>{label}</h3>
                <p className={`text-xs ${textSecondary}`}>Connect one or more Google Sheets, choose each one's source, and sync rows on demand.</p>
              </div>
            </div>
            <button onClick={onClose} className={textSecondary}><X className="h-5 w-5" /></button>
          </div>

          {/* OAuth status */}
          <div className={`p-3 rounded-lg border ${borderColor} ${bgSecondary} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              {oauthConnected ? (
                <>
                  <Check className="h-4 w-4 text-[#10b981]" />
                  <span className={`text-sm ${textPrimary}`}>Google account connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-[#f59e0b]" />
                  <span className={`text-sm ${textPrimary}`}>Connect your Google account first</span>
                </>
              )}
            </div>
            {oauthConnected ? (
              <Button variant="outline" size="sm" onClick={handleDisconnectOAuth}>
                Disconnect Google
              </Button>
            ) : (
              <Button size="sm" onClick={handleStartOAuth} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid={`sheet-oauth-${sheetType}`}>
                <Link2 className="h-4 w-4 mr-1" /> Connect Google
              </Button>
            )}
          </div>

          {/* Connected sheets list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className={`text-xs uppercase font-semibold ${textSecondary}`}>Connected Sheets · {configs.length}</p>
              {!formOpen && (
                <Button size="sm" onClick={openAddForm} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid={`sheet-add-${sheetType}`}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Another Sheet
                </Button>
              )}
            </div>
            {configs.length === 0 && !formOpen && (
              <div className={`p-4 rounded-lg border border-dashed ${borderColor} ${bgSecondary} text-center text-sm ${textSecondary}`}>
                No sheet connected yet.
              </div>
            )}
            {configs.map((cfg) => (
              <div key={cfg.config_id} className={`p-3 rounded-lg border ${borderColor} ${bgSecondary} flex items-center justify-between gap-3 flex-wrap`} data-testid={`sheet-row-${cfg.config_id}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-medium ${textPrimary} truncate`}>{cfg.name || 'Untitled sheet'}</p>
                    <Badge variant="outline" className="text-[10px]">{sourceLabel(cfg.source_type)}</Badge>
                  </div>
                  <p className={`text-[11px] ${textSecondary} mt-0.5`}>
                    {cfg.last_synced_at
                      ? `Last synced ${new Date(cfg.last_synced_at).toLocaleString()} · ${cfg.last_synced_count || 0} rows${cfg.last_skipped_existing ? ` · ${cfg.last_skipped_existing} already in leads` : ''}`
                      : 'Never synced'}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    <Layers className={`h-3 w-3 ${textSecondary}`} />
                    {(cfg.tabs || []).length
                      ? cfg.tabs.map((t) => <Badge key={t} variant="outline" className="text-[10px] font-normal">{t}</Badge>)
                      : <span className={`text-[10px] ${textSecondary}`}>First tab</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" onClick={() => handleSyncNow(cfg.config_id)} disabled={syncingId === cfg.config_id || !oauthConnected} className="bg-[#10b981] hover:bg-[#059669] text-white h-8" data-testid={`sheet-sync-${cfg.config_id}`}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncingId === cfg.config_id ? 'animate-spin' : ''}`} /> Sync
                  </Button>
                  <button type="button" onClick={() => openEditForm(cfg)} className={`p-2 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`sheet-edit-${cfg.config_id}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleDeleteConfig(cfg)} className="p-2 text-[#ef4444] hover:opacity-80" title="Remove" data-testid={`sheet-remove-${cfg.config_id}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add / Edit form */}
          {formOpen && (
            <div className={`p-4 rounded-lg border ${borderColor} space-y-3`}>
              <div className="flex items-center justify-between">
                <p className={`text-sm font-semibold ${textPrimary}`}>{editingConfigId ? 'Edit Sheet' : 'Add New Sheet'}</p>
                <button onClick={closeForm} className={textSecondary}><X className="h-4 w-4" /></button>
              </div>
              <div>
                <Label className={textPrimary}>Sheet Name</Label>
                <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder={`e.g. ${sheetType === 'prospect' ? 'Prospects June 2026' : 'Inbound Leads — Q2'}`} className={`${bgSecondary} border ${borderColor} ${textPrimary}`} />
              </div>
              <div>
                <Label className={textPrimary}>Sheet Link</Label>
                <Input value={form.sheet_url} onChange={(e) => setForm(p => ({ ...p, sheet_url: e.target.value }))} placeholder="https://docs.google.com/spreadsheets/d/..." className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`sheet-link-${sheetType}`} />
                {/* Tab picker — appears once a valid link is pasted */}
                {!oauthConnected && SHEET_URL_RE.test(form.sheet_url) && (
                  <p className="text-xs text-[#f59e0b] mt-2">Connect Google above to see this sheet's tabs.</p>
                )}
                {tabsInfo.loading && (
                  <p className={`text-xs mt-2 flex items-center gap-1 ${textSecondary}`}><RefreshCw className="h-3 w-3 animate-spin" /> Reading the sheet's tabs…</p>
                )}
                {tabsInfo.error && (
                  <div className="mt-2 p-2.5 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 text-xs text-[#ef4444] flex gap-2" data-testid={`sheet-tabs-error-${sheetType}`}>
                    <AlertCircle className="h-4 w-4 shrink-0" /> <span>{tabsInfo.error}</span>
                  </div>
                )}
                {tabsInfo.tabs.length > 0 && (
                  <div className={`mt-2 rounded-lg border ${borderColor} overflow-hidden`} data-testid={`sheet-tabs-${sheetType}`}>
                    <div className={`px-3 py-2 ${bgSecondary} flex items-center justify-between gap-2 flex-wrap`}>
                      <p className={`text-xs font-semibold ${textPrimary}`}>
                        Tabs in {tabsInfo.title ? `“${tabsInfo.title}”` : 'this sheet'} · {selectedTabs.length} of {tabsInfo.tabs.length} selected
                      </p>
                      <div className="flex gap-2 text-[11px]">
                        <button type="button" className="text-[#6366f1] hover:underline" onClick={() => setSelectedTabs(tabsInfo.tabs.map((x) => x.title))}>Select all</button>
                        <button type="button" className={`${textSecondary} hover:underline`} onClick={() => setSelectedTabs([])}>Clear</button>
                      </div>
                    </div>
                    <div className={`divide-y ${borderColor} max-h-60 overflow-y-auto`}>
                      {tabsInfo.tabs.map((t) => (
                        <label key={t.title} className="flex items-center gap-3 px-3 py-2 cursor-pointer" data-testid={`sheet-tab-${t.title}`}>
                          <input type="checkbox" className="accent-[#6366f1]" checked={selectedTabs.includes(t.title)} onChange={() => toggleTab(t.title)} />
                          <span className={`text-sm flex-1 min-w-0 truncate ${textPrimary}`}>{t.title}{t.hidden ? <span className={`text-[10px] ${textSecondary}`}> (hidden)</span> : null}</span>
                          {t.total === 0 ? (
                            <span className={`text-[11px] ${textSecondary}`}>Empty</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[11px] shrink-0">
                              <span className={textSecondary}>{t.total} rows</span>
                              <span className="px-1.5 py-0.5 rounded bg-[#10b981]/15 text-[#10b981]">{t.new} new</span>
                              <span className={`px-1.5 py-0.5 rounded ${t.existing ? 'bg-[#f59e0b]/15 text-[#b45309]' : `${bgSecondary} ${textSecondary}`}`}>{t.existing} already in leads</span>
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                    <p className={`px-3 py-1.5 text-[10px] ${textSecondary} border-t ${borderColor}`}>
                      “Already in leads” = same phone or email as an existing lead. Sync skips those instead of creating duplicates.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <Label className={textPrimary}>Source Type</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SOURCE_TYPES.map(s => (
                    <button
                      key={s.v}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, source_type: s.v }))}
                      className={`px-3 py-1.5 rounded-full text-xs border ${
                        form.source_type === s.v
                          ? 'bg-[#6366f1] text-white border-transparent'
                          : `${bgSecondary} ${textSecondary} ${borderColor}`
                      }`}
                      data-testid={`src-${sheetType}-${s.v}`}
                    >{s.label}</button>
                  ))}
                </div>
              </div>

              {/* Preview (edit mode only, once the sheet's been synced before) */}
              {preview.rows.length > 0 && (
                <div>
                  <p className={`text-xs uppercase font-semibold ${textSecondary} mb-2`}>Preview · last 5 of {preview.total}</p>
                  <div className={`rounded-lg border ${borderColor} overflow-x-auto`}>
                    <table className="w-full text-xs">
                      <thead className={`${bgSecondary} ${textSecondary}`}>
                        <tr>{preview.headers.map((h, i) => (<th key={i} className="p-2 text-left">{h}</th>))}</tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r, ri) => (
                          <tr key={ri} className={`border-t ${borderColor}`}>
                            {preview.headers.map((_, ci) => (<td key={ci} className={`p-2 ${textPrimary}`}>{r[ci] || '—'}</td>))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                {form.sheet_url && (
                  <a href={form.sheet_url} target="_blank" rel="noopener noreferrer" className={`px-3 py-2 rounded-lg border ${borderColor} text-sm ${textPrimary} hover:opacity-80 flex items-center gap-1`}>
                    <ExternalLink className="h-3 w-3" /> Open Sheet
                  </a>
                )}
                <Button variant="ghost" onClick={closeForm}>Cancel</Button>
                <Button onClick={handleSave} disabled={busy || !form.sheet_url.trim() || tabsInfo.loading || (tabsInfo.tabs.length > 0 && selectedTabs.length === 0)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid={`sheet-save-${sheetType}`}>
                  {busy ? 'Saving…' : editingConfigId ? 'Save Changes' : 'Add Sheet'}
                </Button>
              </div>
            </div>
          )}

          {/* Stages Panel (Lead Sheet only) — passed in from parent */}
          {sheetType === 'lead' && stagesPanel && (
            <div className={`pt-2 border-t ${borderColor}`}>
              {stagesPanel}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end pt-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { SOURCE_TYPES };
