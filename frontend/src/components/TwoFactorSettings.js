import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Shield, ShieldCheck, ShieldOff, Eye, EyeOff, Loader2, Copy, Check, AlertTriangle, Mail, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TwoFactorSettings() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [disableMode, setDisableMode] = useState(false);
  
  // Setup state
  const [qrCode, setQrCode] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgInput = isDark ? 'bg-[#09090b]' : 'bg-white';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    check2FAStatus();
  }, []);

  const check2FAStatus = async () => {
    try {
      const res = await axios.get(`${API}/api/auth/2fa/status`, { headers });
      setIs2FAEnabled(res.data.enabled);
    } catch (error) {
      console.error('Error checking 2FA status:', error);
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    setActionLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/2fa/setup`, { password }, { headers });
      setQrCode(res.data.qr_code);
      setSecretKey(res.data.secret);
      setSetupMode(true);
      setPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to setup 2FA');
    } finally {
      setActionLoading(false);
    }
  };

  const verifySetup = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/api/auth/2fa/verify-setup`, { code: verificationCode }, { headers });
      toast.success('Two-factor authentication enabled!');
      setIs2FAEnabled(true);
      setSetupMode(false);
      setQrCode('');
      setSecretKey('');
      setVerificationCode('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid code');
    } finally {
      setActionLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!password || verificationCode.length !== 6) {
      toast.error('Please enter your password and 2FA code');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/api/auth/2fa/disable`, { password, code: verificationCode }, { headers });
      toast.success('Two-factor authentication disabled');
      setIs2FAEnabled(false);
      setDisableMode(false);
      setPassword('');
      setVerificationCode('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to disable 2FA');
    } finally {
      setActionLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Secret key copied!');
  };

  const sendSetupEmail = async () => {
    setEmailSending(true);
    try {
      const res = await axios.post(`${API}/api/auth/2fa/send-setup-email`, {}, { headers });
      toast.success(res.data.message || 'Setup details sent to your email!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  if (loading) {
    return (
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${bgCard} border ${borderColor}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${textPrimary}`}>
          <Shield className="h-5 w-5 text-[#6366f1]" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription className={textSecondary}>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Badge */}
        <div className={`flex items-center gap-3 p-4 rounded-lg ${
          is2FAEnabled 
            ? 'bg-green-500/10 border border-green-500/30' 
            : 'bg-amber-500/10 border border-amber-500/30'
        }`}>
          {is2FAEnabled ? (
            <>
              <ShieldCheck className="h-6 w-6 text-green-500" />
              <div>
                <p className="font-medium text-green-500">2FA Enabled</p>
                <p className={`text-sm ${textSecondary}`}>Your account is protected with two-factor authentication</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <div>
                <p className="font-medium text-amber-500">2FA Not Enabled</p>
                <p className={`text-sm ${textSecondary}`}>Enable 2FA to add an extra layer of security</p>
              </div>
            </>
          )}
        </div>

        {/* Enable 2FA Flow */}
        {!is2FAEnabled && !setupMode && (
          <div className="space-y-4">
            <div>
              <Label className={textPrimary}>Enter your password to enable 2FA</Label>
              <div className="relative mt-2">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className={`${bgInput} border ${borderColor} ${textPrimary} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSecondary}`}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              onClick={startSetup}
              disabled={actionLoading || !password}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              Enable Two-Factor Authentication
            </Button>
          </div>
        )}

        {/* Setup Mode - QR Code */}
        {setupMode && (
          <div className="space-y-6">
            {/* Step-by-step instructions */}
            <div className={`p-4 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-blue-50'} border ${isDark ? 'border-[#3f3f46]' : 'border-blue-200'}`}>
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-[#6366f1] mt-0.5" />
                <div>
                  <p className={`font-medium ${textPrimary}`}>Setup Instructions</p>
                  <ol className={`text-sm ${textSecondary} mt-2 space-y-1 list-decimal list-inside`}>
                    <li>Download <strong>Google Authenticator</strong> app on your phone</li>
                    <li>Tap the <strong>+</strong> button in the app</li>
                    <li>Select <strong>"Scan QR code"</strong> and scan below</li>
                    <li>Enter the 6-digit code shown in the app</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* QR Code Display */}
            <div className="text-center">
              <p className={`${textPrimary} font-medium mb-4`}>Scan this QR code with Google Authenticator</p>
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg shadow-lg">
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>
            </div>

            {/* Send to Email Button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={sendSetupEmail}
                disabled={emailSending}
                className={`${borderColor} gap-2`}
              >
                {emailSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {emailSending ? 'Sending...' : 'Send Setup Details to Email'}
              </Button>
            </div>

            <div className={`p-4 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
              <p className={`text-sm ${textSecondary} mb-2`}>Can't scan? Enter this key manually in your app:</p>
              <div className="flex items-center gap-2">
                <code className={`flex-1 p-2 rounded font-mono text-sm ${isDark ? 'bg-[#09090b]' : 'bg-white'} ${textPrimary}`}>
                  {secretKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copySecret}
                  className={`${borderColor}`}
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label className={textPrimary}>Enter the 6-digit code from your authenticator app</Label>
              <Input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className={`${bgInput} border ${borderColor} ${textPrimary} mt-2 text-center text-2xl tracking-[0.5em] font-mono`}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSetupMode(false);
                  setQrCode('');
                  setSecretKey('');
                  setVerificationCode('');
                }}
                className={`flex-1 ${borderColor}`}
              >
                Cancel
              </Button>
              <Button
                onClick={verifySetup}
                disabled={actionLoading || verificationCode.length !== 6}
                className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify & Enable
              </Button>
            </div>
          </div>
        )}

        {/* Disable 2FA Flow */}
        {is2FAEnabled && !disableMode && (
          <Button
            variant="outline"
            onClick={() => setDisableMode(true)}
            className="border-red-500/50 text-red-500 hover:bg-red-500/10"
          >
            <ShieldOff className="h-4 w-4 mr-2" />
            Disable Two-Factor Authentication
          </Button>
        )}

        {disableMode && (
          <div className="space-y-4 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <p className={`${textPrimary} font-medium`}>Disable 2FA</p>
            <p className={`text-sm ${textSecondary}`}>
              To disable 2FA, enter your password and current 2FA code.
            </p>

            <div>
              <Label className={textPrimary}>Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className={`${bgInput} border ${borderColor} ${textPrimary} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSecondary}`}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label className={textPrimary}>2FA Code</Label>
              <Input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className={`${bgInput} border ${borderColor} ${textPrimary} mt-1 text-center text-xl tracking-[0.3em] font-mono`}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setDisableMode(false);
                  setPassword('');
                  setVerificationCode('');
                }}
                className={`flex-1 ${borderColor}`}
              >
                Cancel
              </Button>
              <Button
                onClick={disable2FA}
                disabled={actionLoading || !password || verificationCode.length !== 6}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Disable 2FA
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
