import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Clock, Hand } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * LoginSettingTab — per-user toggle for the Clock In/Out + Break In/Out time
 * entry mode.
 *  - Automatic: button click submits instantly with the server's current time.
 *  - Manual: the existing date+time picker modal opens so the user can pick a
 *    specific time (also lets them back-fill missed entries earlier today).
 */
export default function LoginSettingTab({
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const { user, refreshUser } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const [mode, setMode] = useState((user?.clock_mode || 'auto').toLowerCase());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode((user?.clock_mode || 'auto').toLowerCase());
  }, [user?.clock_mode]);

  const isManual = mode === 'manual';

  const toggle = async (nextManual) => {
    const next = nextManual ? 'manual' : 'auto';
    setMode(next);
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/users/me/clock-mode`,
        { clock_mode: next },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(`Clock time entry: ${next === 'auto' ? 'Automatic' : 'Manual'}`);
      // Refresh /auth/me so other pages (Layout's clock buttons) pick the change.
      try { await refreshUser?.(); } catch (_) { /* non-critical */ }
    } catch (e) {
      // Revert UI on failure
      setMode(next === 'auto' ? 'manual' : 'auto');
      toast.error(e.response?.data?.detail || 'Failed to save setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="login-setting-tab">
      <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${textPrimary} mb-1 flex items-center gap-2`}>
          <Clock className="h-5 w-5 text-[#6366f1]" /> Clock-In Time Entry
        </h3>
        <p className={`text-xs ${textSecondary} mb-5`}>
          Controls how the time is captured when you tap <b>Clock In</b>, <b>Clock Out</b>, <b>Break In</b> or <b>Break Out</b>.
        </p>

        <div className={`flex items-center justify-between rounded-lg border ${borderColor} ${bgSecondary} p-4`}>
          <div className="flex items-start gap-3 flex-1">
            {isManual ? (
              <Hand className="h-5 w-5 text-amber-400 mt-0.5" />
            ) : (
              <Clock className="h-5 w-5 text-emerald-400 mt-0.5" />
            )}
            <div>
              <Label className={`${textPrimary} text-sm font-medium`}>
                {isManual ? 'Manual time entry' : 'Automatic (server time)'}
              </Label>
              <p className={`text-[11px] ${textSecondary} mt-1 max-w-md`}>
                {isManual
                  ? 'A date + time picker pops up every time you clock in/out. Useful when you forgot to clock in on time and need to back-fill.'
                  : 'Tapping Clock In/Out instantly records the current server time — no modal, no picker. Fastest flow.'}
              </p>
            </div>
          </div>
          <Switch
            checked={isManual}
            disabled={saving}
            onCheckedChange={toggle}
            data-testid="clock-mode-toggle"
          />
        </div>

        <div className={`mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs ${textSecondary}`}>
          <div className={`p-3 rounded-lg border ${borderColor} ${bgSecondary}`}>
            <p className={`font-semibold ${textPrimary} mb-1 flex items-center gap-1.5`}>
              <Clock className="h-3.5 w-3.5 text-emerald-400" /> Automatic
            </p>
            <p>One tap = instant clock-in with server time. Great for being on time.</p>
          </div>
          <div className={`p-3 rounded-lg border ${borderColor} ${bgSecondary}`}>
            <p className={`font-semibold ${textPrimary} mb-1 flex items-center gap-1.5`}>
              <Hand className="h-3.5 w-3.5 text-amber-400" /> Manual
            </p>
            <p>Picker opens — adjust date + time. HR Admin will see the manually-entered time on attendance reports.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
