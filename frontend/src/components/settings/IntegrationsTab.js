import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import {
  FileSpreadsheet,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Copy,
  Pencil,
  Lock,
} from 'lucide-react';

/**
 * IntegrationsTab — Google Sheets OAuth credential management (super_admin only).
 * Persists client_id / client_secret / redirect_uri to MongoDB so admins can
 * rotate keys without ever touching env vars.
 */
export default function IntegrationsTab({
  bgCard,
  bgSecondary,
  bgInput,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [config, setConfig] = useState({
    client_id: '',
    client_secret: '',
    redirect_uri: '',
    has_client_secret: false,
    client_secret_masked: '',
    source: {},
    updated_at: null,
  });
  const [secretDirty, setSecretDirty] = useState(false);
  // Edit-lock state — saved-in-app fields stay read-only until the admin clicks Edit.
  const [editing, setEditing] = useState({ client_id: false, client_secret: false, redirect_uri: false });
  const isLocked = (field) => config.source?.[field] === 'db' && !editing[field];

  const defaultRedirectUri =
    (typeof window !== 'undefined' ? `${window.location.origin}` : '') +
    '/api/oauth/sheets/callback';

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/sheets/oauth-config');
      setConfig({
        ...data,
        client_secret: '', // never preload the secret into the input
      });
      setSecretDirty(false);
      setEditing({ client_id: false, client_secret: false, redirect_uri: false });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load OAuth config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    if (!config.client_id?.trim()) {
      toast.error('Client ID is required');
      return;
    }
    if (!config.has_client_secret && !secretDirty) {
      toast.error('Client Secret is required');
      return;
    }
    if (!config.redirect_uri?.trim()) {
      toast.error('Redirect URI is required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        client_id: config.client_id.trim(),
        redirect_uri: config.redirect_uri.trim(),
      };
      // Only send secret if the admin typed a new one
      if (secretDirty && config.client_secret) {
        payload.client_secret = config.client_secret;
      }
      await api.put('/sheets/oauth-config', payload);
      toast.success('Google Sheets OAuth credentials saved');
      await loadConfig();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToEnv = async () => {
    if (!window.confirm('Clear admin-saved credentials and fall back to environment variables?')) return;
    try {
      setSaving(true);
      await api.delete('/sheets/oauth-config');
      toast.success('Reverted to environment variable credentials');
      await loadConfig();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    toast.success('Copied');
  };

  const sourceBadge = (source) => {
    if (source === 'db') return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Saved in app</Badge>;
    if (source === 'env') return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Env var</Badge>;
    return <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30">Not set</Badge>;
  };

  // Renders an Edit / Cancel button next to a saved-in-app field so it can't be
  // overwritten accidentally.
  const editToggle = (field, label = field) => {
    if (config.source?.[field] !== 'db') return null;
    const isEditing = editing[field];
    return (
      <button
        type="button"
        onClick={() => {
          setEditing((e) => ({ ...e, [field]: !isEditing }));
          if (isEditing) {
            // Cancelled — wipe pending edits so the masked/saved value remains intact
            if (field === 'client_secret') {
              setConfig((c) => ({ ...c, client_secret: '' }));
              setSecretDirty(false);
            }
          }
        }}
        data-testid={`sheets-edit-${field}`}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${borderColor} ${textSecondary} hover:${textPrimary} hover:bg-[#6366f1]/10 transition`}
        title={isEditing ? `Cancel editing ${label}` : `Edit ${label}`}
      >
        {isEditing ? (<><Lock className="h-3 w-3" /> Cancel</>) : (<><Pencil className="h-3 w-3" /> Edit</>)}
      </button>
    );
  };

  return (
    <div className={`${bgCard} border ${borderColor} rounded-2xl p-6 space-y-6`} data-testid="integrations-sheets-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shrink-0">
            <FileSpreadsheet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${textPrimary}`}>Google Sheets OAuth</h3>
            <p className={`text-sm ${textSecondary} mt-0.5`}>
              Manage the credentials Leads uses to connect Google Sheets. Updates apply instantly — no redeploy needed.
            </p>
          </div>
        </div>
        {config.has_client_secret ? (
          <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Configured
          </Badge>
        ) : (
          <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30">
            <AlertCircle className="h-3.5 w-3.5 mr-1" /> Not configured
          </Badge>
        )}
      </div>

      {/* Setup helper */}
      <div className={`${bgSecondary} border ${borderColor} rounded-xl p-4 space-y-2`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs uppercase tracking-wider ${textSecondary} font-medium`}>
            Add this Redirect URI to your Google Cloud OAuth client
          </p>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#6366f1] hover:underline inline-flex items-center gap-1"
          >
            Open Google Console <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <code className={`flex-1 text-xs font-mono ${textPrimary} ${bgInput || bgCard} border ${borderColor} px-3 py-2 rounded-md break-all`}>
            {defaultRedirectUri}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(defaultRedirectUri)}
            data-testid="copy-redirect-uri"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="sheets-client-id" className={textPrimary}>Client ID</Label>
            <div className="flex items-center gap-2">
              {sourceBadge(config.source?.client_id)}
              {editToggle('client_id', 'Client ID')}
            </div>
          </div>
          <Input
            id="sheets-client-id"
            data-testid="sheets-client-id-input"
            value={config.client_id || ''}
            onChange={(e) => setConfig((c) => ({ ...c, client_id: e.target.value }))}
            placeholder="123456789-abcxyz.apps.googleusercontent.com"
            disabled={loading || saving || isLocked('client_id')}
            className={`${bgInput || bgCard} ${borderColor} ${textPrimary} font-mono text-sm ${isLocked('client_id') ? 'opacity-70 cursor-not-allowed' : ''}`}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="sheets-client-secret" className={textPrimary}>Client Secret</Label>
            <div className="flex items-center gap-2">
              {sourceBadge(config.source?.client_secret)}
              {editToggle('client_secret', 'Client Secret')}
            </div>
          </div>
          <div className="relative">
            <Input
              id="sheets-client-secret"
              data-testid="sheets-client-secret-input"
              type={showSecret ? 'text' : 'password'}
              value={config.client_secret || ''}
              onChange={(e) => {
                setConfig((c) => ({ ...c, client_secret: e.target.value }));
                setSecretDirty(true);
              }}
              placeholder={config.has_client_secret ? config.client_secret_masked : 'GOCSPX-...'}
              disabled={loading || saving || isLocked('client_secret')}
              className={`${bgInput || bgCard} ${borderColor} ${textPrimary} font-mono text-sm pr-10 ${isLocked('client_secret') ? 'opacity-70 cursor-not-allowed' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-[#6366f1]/10 ${textSecondary}`}
              aria-label="Toggle secret visibility"
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {isLocked('client_secret') ? (
            <p className={`text-xs ${textSecondary} flex items-center gap-1`}>
              <Lock className="h-3 w-3" /> Secret is saved &amp; locked. Click <b>Edit</b> above to replace it.
            </p>
          ) : config.has_client_secret && !secretDirty ? (
            <p className={`text-xs ${textSecondary}`}>
              Leave blank to keep the existing secret. Type a new value to replace it.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="sheets-redirect-uri" className={textPrimary}>Redirect URI</Label>
            <div className="flex items-center gap-2">
              {sourceBadge(config.source?.redirect_uri)}
              {editToggle('redirect_uri', 'Redirect URI')}
            </div>
          </div>
          <Input
            id="sheets-redirect-uri"
            data-testid="sheets-redirect-uri-input"
            value={config.redirect_uri || ''}
            onChange={(e) => setConfig((c) => ({ ...c, redirect_uri: e.target.value }))}
            placeholder={defaultRedirectUri}
            disabled={loading || saving || isLocked('redirect_uri')}
            className={`${bgInput || bgCard} ${borderColor} ${textPrimary} font-mono text-sm ${isLocked('redirect_uri') ? 'opacity-70 cursor-not-allowed' : ''}`}
          />
          <p className={`text-xs ${textSecondary}`}>
            Must match exactly one of the Authorized redirect URIs in your Google Cloud OAuth client.
          </p>
        </div>
      </div>

      {/* Footer actions */}
      <div className={`flex items-center justify-between gap-3 pt-2 border-t ${borderColor}`}>
        <div className={`text-xs ${textSecondary}`}>
          {config.updated_at
            ? `Last updated ${new Date(config.updated_at).toLocaleString()}`
            : 'Not yet saved in the app — using environment variables'}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetToEnv}
            disabled={loading || saving || !(config.source?.client_id === 'db' || config.source?.client_secret === 'db' || config.source?.redirect_uri === 'db')}
            data-testid="sheets-reset-env-btn"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Revert to env vars
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="sheets-save-btn"
          >
            {saving ? 'Saving…' : 'Save credentials'}
          </Button>
        </div>
      </div>
    </div>
  );
}
