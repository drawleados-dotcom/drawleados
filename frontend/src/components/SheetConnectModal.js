import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, FileSpreadsheet, Link2, RefreshCw, ExternalLink, Trash2, Check, AlertCircle } from 'lucide-react';
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

/**
 * SheetConnectModal — manages connection of a single sheet (Prospect or Lead).
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
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ name: '', sheet_url: '', source_type: 'website' });
  const [preview, setPreview] = useState({ headers: [], rows: [], total: 0 });
  const [busy, setBusy] = useState(false);

  const label = sheetType === 'prospect' ? 'Prospect Sheet' : 'Lead Sheet';

  const refreshStatus = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        axios.get(`${API}/api/sheets/status`, { headers }),
        axios.get(`${API}/api/sheets/configs`, { headers }),
      ]);
      setOauthConnected(!!s.data?.connected);
      const cfg = c.data?.[sheetType];
      setConfig(cfg);
      if (cfg) {
        setForm({
          name: cfg.name || '',
          sheet_url: cfg.sheet_url || '',
          source_type: cfg.source_type || 'website',
        });
      }
    } catch { /* ignore */ }
  }, [headers, sheetType]);

  useEffect(() => {
    if (!open) return;
    refreshStatus();
  }, [open, refreshStatus]);

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

  const handleSave = async () => {
    if (!form.sheet_url.trim()) { toast.error('Sheet link is required'); return; }
    setBusy(true);
    try {
      const r = await axios.post(`${API}/api/sheets/config`, {
        sheet_type: sheetType,
        name: form.name.trim(),
        sheet_url: form.sheet_url.trim(),
        source_type: form.source_type,
      }, { headers });
      setConfig(r.data);
      toast.success(`${label} saved`);
      onSaved && onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    finally { setBusy(false); }
  };

  const handleSyncNow = async () => {
    setBusy(true);
    try {
      const r = await axios.post(`${API}/api/sheets/sync/${sheetType}`, {}, { headers });
      toast.success(`Synced ${r.data.synced} rows`);
      await refreshStatus();
      // Re-fetch preview
      const p = await axios.get(`${API}/api/sheets/preview/${sheetType}`, { headers });
      setPreview(p.data || { headers: [], rows: [], total: 0 });
    } catch (e) { toast.error(e.response?.data?.detail || 'Sync failed'); }
    finally { setBusy(false); }
  };

  const handleDeleteConfig = async () => {
    if (!window.confirm(`Remove the saved ${label}? Imported rows will also be cleared.`)) return;
    try {
      await axios.delete(`${API}/api/sheets/config/${sheetType}`, { headers });
      setConfig(null);
      setForm({ name: '', sheet_url: '', source_type: 'website' });
      setPreview({ headers: [], rows: [], total: 0 });
      toast.success('Removed');
      onSaved && onSaved();
    } catch { toast.error('Failed to remove'); }
  };

  // Try to load a preview if we already have a config
  useEffect(() => {
    if (!open || !config?.sheet_id) { setPreview({ headers: [], rows: [], total: 0 }); return; }
    axios.get(`${API}/api/sheets/preview/${sheetType}`, { headers })
      .then(r => setPreview(r.data || { headers: [], rows: [], total: 0 }))
      .catch(() => { /* ignore — usually means not yet authorized */ });
  }, [open, config?.sheet_id, sheetType, headers]);

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
                <p className={`text-xs ${textSecondary}`}>Connect a Google Sheet, choose its source, and sync rows on demand.</p>
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

          {/* Form */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className={textPrimary}>Sheet Name</Label>
              <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder={`e.g. ${sheetType === 'prospect' ? 'Prospects June 2026' : 'Inbound Leads — Q2'}`} className={`${bgSecondary} border ${borderColor} ${textPrimary}`} />
            </div>
            <div>
              <Label className={textPrimary}>Sheet Link</Label>
              <Input value={form.sheet_url} onChange={(e) => setForm(p => ({ ...p, sheet_url: e.target.value }))} placeholder="https://docs.google.com/spreadsheets/d/..." className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`sheet-link-${sheetType}`} />
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
          </div>

          {/* Sync status */}
          {config?.sheet_id && (
            <div className={`p-3 rounded-lg border ${borderColor} ${bgSecondary} flex items-center justify-between`}>
              <div>
                <p className={`text-xs ${textSecondary}`}>Last synced</p>
                <p className={`text-sm font-medium ${textPrimary}`}>
                  {config.last_synced_at ? new Date(config.last_synced_at).toLocaleString() : 'Never'} · {config.last_synced_count || 0} rows
                </p>
              </div>
              <Button size="sm" onClick={handleSyncNow} disabled={busy || !oauthConnected} className="bg-[#10b981] hover:bg-[#059669] text-white" data-testid={`sheet-sync-${sheetType}`}>
                <RefreshCw className={`h-4 w-4 mr-1 ${busy ? 'animate-spin' : ''}`} /> Sync Now
              </Button>
            </div>
          )}

          {/* Preview */}
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

          {/* Stages Panel (Lead Sheet only) — passed in from parent */}
          {sheetType === 'lead' && stagesPanel && (
            <div className={`pt-2 border-t ${borderColor}`}>
              {stagesPanel}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {config?.sheet_id && (
                <Button variant="ghost" onClick={handleDeleteConfig} className="text-[#ef4444]">
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {form.sheet_url && (
                <a href={form.sheet_url} target="_blank" rel="noopener noreferrer" className={`px-3 py-2 rounded-lg border ${borderColor} text-sm ${textPrimary} hover:opacity-80 flex items-center gap-1`}>
                  <ExternalLink className="h-3 w-3" /> Open Sheet
                </a>
              )}
              <Button variant="ghost" onClick={onClose}>Close</Button>
              <Button onClick={handleSave} disabled={busy || !form.sheet_url.trim()} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid={`sheet-save-${sheetType}`}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { SOURCE_TYPES };
