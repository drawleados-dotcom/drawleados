import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Mail, ArrowLeft, KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import PasswordStrength, { isPasswordStrong } from '../components/PasswordStrength';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailHint, setEmailHint] = useState('');

  // Step 1: Request OTP
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/auth/forgot-password`, { email });
      setEmailHint(response.data.email_hint);
      toast.success('OTP sent to your email!');
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and proceed
  const handleVerifyOTP = () => {
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }
    setStep(3);
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!isPasswordStrong(newPassword)) {
      toast.error('Password does not meet all requirements');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/reset-password`, {
        email,
        otp,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      toast.success('Password reset successfully!');
      setStep(4);
    } catch (error) {
      if (error.response?.data?.detail?.includes('OTP')) {
        toast.error(error.response.data.detail);
        setStep(2); // Go back to OTP step
        setOtp('');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to reset password');
      }
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/auth/forgot-password`, { email });
      setEmailHint(response.data.email_hint);
      toast.success('New OTP sent!');
      setOtp('');
    } catch (error) {
      toast.error('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)' }}>
      <div className="w-full max-w-md">
        <div className="glass-morphism p-8 rounded-2xl border border-[#27272a]">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                {step === 4 ? 'Success!' : 'Reset Password'}
              </span>
            </h1>
            <p className="text-[#a1a1aa] text-sm">
              {step === 1 && 'Enter your email to receive a reset code'}
              {step === 2 && `Enter the OTP sent to ${emailHint}`}
              {step === 3 && 'Create a new strong password'}
              {step === 4 && 'Your password has been reset'}
            </p>
          </div>

          {/* Step Indicators */}
          {step < 4 && (
            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 w-12 rounded-full transition-all ${
                    s <= step ? 'bg-[#6366f1]' : 'bg-[#27272a]'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Step 1: Email Input */}
          {step === 1 && (
            <form onSubmit={handleRequestOTP} className="space-y-6">
              <div>
                <Label htmlFor="email" className="text-[#fafafa] text-sm font-medium mb-2 block">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717a]" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-[#18181b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1] pl-10"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white font-medium py-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Reset Code
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <Label className="text-[#fafafa] text-sm font-medium mb-2 block">
                  Enter 6-digit OTP
                </Label>
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="bg-[#18181b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1] text-center text-3xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 border-[#27272a] text-[#a1a1aa] hover:bg-[#27272a]"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleVerifyOTP}
                  disabled={otp.length !== 6}
                  className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                >
                  Continue
                </Button>
              </div>

              <button
                type="button"
                onClick={resendOTP}
                disabled={loading}
                className="w-full text-center text-sm text-[#6366f1] hover:text-[#8b5cf6] transition-colors"
              >
                {loading ? 'Sending...' : "Didn't receive code? Resend"}
              </button>
            </div>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <Label className="text-[#fafafa] text-sm font-medium mb-2 block">
                  New Password
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-[#71717a]" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="bg-[#18181b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1] pl-10 pr-10"
                    placeholder="New password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#71717a] hover:text-[#fafafa]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrength password={newPassword} />
              </div>

              <div>
                <Label className="text-[#fafafa] text-sm font-medium mb-2 block">
                  Confirm Password
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-[#71717a]" />
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={`bg-[#18181b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1] pl-10 pr-10 ${
                      confirmPassword && confirmPassword !== newPassword ? 'border-red-500' : ''
                    } ${confirmPassword && confirmPassword === newPassword && isPasswordStrong(newPassword) ? 'border-green-500' : ''}`}
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-[#71717a] hover:text-[#fafafa]"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                )}
                {confirmPassword && confirmPassword === newPassword && isPasswordStrong(newPassword) && (
                  <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Passwords match
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex-1 border-[#27272a] text-[#a1a1aa] hover:bg-[#27272a]"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !isPasswordStrong(newPassword) || newPassword !== confirmPassword}
                  className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
              </div>
              <div>
                <p className="text-[#fafafa] font-medium mb-2">Password Reset Complete</p>
                <p className="text-[#a1a1aa] text-sm">
                  Your password has been successfully reset. You can now login with your new password.
                </p>
              </div>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              >
                Go to Login
              </Button>
            </div>
          )}

          {/* Back to Login Link */}
          {step < 4 && (
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-[#a1a1aa] hover:text-[#fafafa] transition-colors">
                <ArrowLeft className="inline h-3 w-3 mr-1" />
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
