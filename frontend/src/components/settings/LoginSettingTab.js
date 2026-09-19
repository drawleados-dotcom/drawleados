import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Clock, Hand, Bell, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { setupPushNotifications } from '../../utils/pushNotifications';

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
  const notifSupported = typeof window !== 'undefined' && 'Notification' in window;
  const [notifPermission, setNotifPermission] = useState(notifSupported ? Notification.permission : 'unsupported');
  const [testingPush, setTestingPush] = useState(false);

  const handleTestPush = async () => {
    setTestingPush(true);
    try {
      await setupPushNotifications(token);
      if (notifSupported) setNotifPermission(Notification.permission);
      if (notifSupported && Notification.permission !== 'granted') {
        toast.error('Notifications are blocked for this site — allow them in your browser settings first');
        return;
      }
      await axios.post(`${API}/api/push/test`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Test notification sent — check for it in a moment');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send test notification');
    } finally {
      setTestingPush(false);
    }
  };

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

      {/* Push Notifications */}
      <div className={`${bgCard} border ${borderColor} rounded-xl p-6`} data-testid="push-notification-settings">
        <h3 className={`text-lg font-semibold ${textPrimary} mb-1 flex items-center gap-2`}>
          <Bell className="h-5 w-5 text-[#6366f1]" /> Push Notifications
        </h3>
        <p className={`text-xs ${textSecondary} mb-5`}>
          Task assignments, work/lunch/logout-time reminders, and long-break nudges — delivered even when Drawlead OS isn't open.
        </p>

        <div className={`flex items-center justify-between gap-4 rounded-lg border ${borderColor} ${bgSecondary} p-4`}>
          <div>
            <Label className={`${textPrimary} text-sm font-medium`}>
              {!notifSupported
                ? 'Not supported in this browser'
                : notifPermission === 'granted'
                ? 'Notifications enabled'
                : notifPermission === 'denied'
                ? 'Notifications blocked'
                : 'Notifications not enabled yet'}
            </Label>
            <p className={`text-[11px] ${textSecondary} mt-1 max-w-md`}>
              {!notifSupported
                ? "This browser doesn't support push notifications."
                : notifPermission === 'denied'
                ? 'Blocked at the browser level — re-allow notifications for this site in your browser settings, then try again.'
                : 'Click to allow notifications (if not already) and send yourself a test one.'}
            </p>
          </div>
          <Button
            onClick={handleTestPush}
            disabled={testingPush || !notifSupported}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white shrink-0"
            data-testid="send-test-notification-btn"
          >
            {testingPush ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Test Notification'}
          </Button>
        </div>
      </div>
    </div>
  );
}
