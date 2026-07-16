import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { X, KeyRound, Copy, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ClientPortalModal({ project, onClose, isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  const [loading, setLoading] = useState(true);
  const [portal, setPortal] = useState(null); // { enabled, username, created_at, updated_at }
  const [usernameDraft, setUsernameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  // Only ever populated right after a create/reset call — this is the one
  // moment the plaintext password exists; only a hash is stored server-side.
  const [freshPassword, setFreshPassword] = useState('');

  useEffect(() => {
    axios.get(`${API}/api/projects/${project.project_id}/client-portal`, { headers })
      .then((res) => {
        setPortal(res.data);
        setUsernameDraft(res.data?.username || '');
      })
      .catch(() => toast.error('Failed to load client portal status'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginUrl = `${window.location.origin}/client-portal/${project.project_id}`;

  const shareMessage = portal?.username && freshPassword
    ? [
        `Hi ${project.client_name || project.name}`,
        'Your Operating System Development Process Management',
        '',
        `Login URL: ${loginUrl}`,
        `User name: ${portal.username}`,
        `Password: ${freshPassword}`,
      ].join('\n')
    : '';

  const createOrRename = async () => {
    if (!usernameDraft.trim()) { toast.error('Username is required'); return; }
    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/api/projects/${project.project_id}/client-portal`,
        { username: usernameDraft.trim() },
        { headers },
      );
      setFreshPassword(res.data.password);
      setPortal((p) => ({ ...(p || {}), enabled: true, username: res.data.username }));
      toast.success('Client login saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save client login');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    setSaving(true);
    try {
      const res = await axios.post(`${API}/api/projects/${project.project_id}/client-portal/reset-password`, {}, { headers });
      setFreshPassword(res.data.password);
      toast.success('Password reset');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed — select and copy manually');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-lg`} onClick={(e) => e.stopPropagation()} data-testid="client-portal-modal">
        <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
          <h3 className={`text-base font-semibold ${textPrimary} flex items-center gap-2`}>
            <KeyRound className="h-4 w-4 text-[#6366f1]" /> Client Portal
          </h3>
          <button onClick={onClose} className={textSecondary}><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className={`text-sm ${textSecondary}`}>Loading…</p>
          ) : (
            <>
              <div>
                <Label className={textPrimary}>Client Username</Label>
                <Input
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  placeholder="e.g. urbanspace"
                  className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  data-testid="client-portal-username"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={createOrRename}
                  disabled={saving}
                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                  data-testid="client-portal-save"
                >
                  {portal?.enabled ? 'Update Username' : 'Create Client Login'}
                </Button>
                {portal?.enabled && (
                  <Button type="button" variant="outline" onClick={resetPassword} disabled={saving} data-testid="client-portal-reset-password">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset Password
                  </Button>
                )}
              </div>

              {freshPassword && (
                <div className={`p-3 rounded-lg border ${borderColor} ${bgSecondary} space-y-1`} data-testid="client-portal-fresh-password">
                  <p className={`text-xs ${textSecondary}`}>New password (shown once — copy it now):</p>
                  <div className="flex items-center gap-2">
                    <code className={`text-sm font-mono ${textPrimary}`}>{freshPassword}</code>
                    <button type="button" onClick={() => copyText(freshPassword, 'Password')} className={textSecondary} title="Copy password">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {portal?.enabled && !freshPassword && (
                <p className={`text-xs ${textSecondary}`}>
                  Password already set — reset it if the client needs a new one (the old one can't be shown again).
                </p>
              )}

              {shareMessage && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className={textPrimary}>Share to Client</Label>
                    <button type="button" onClick={() => copyText(shareMessage, 'Message')} className={`text-xs ${textSecondary} hover:opacity-80 flex items-center gap-1`} data-testid="client-portal-copy-message">
                      <Copy className="h-3.5 w-3.5" /> Copy Message
                    </button>
                  </div>
                  <Textarea
                    readOnly
                    value={shareMessage}
                    className={`text-sm ${bgSecondary} border ${borderColor} ${textPrimary} min-h-[140px]`}
                    data-testid="client-portal-share-message"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className={`p-5 border-t ${borderColor} flex items-center justify-end`}>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
