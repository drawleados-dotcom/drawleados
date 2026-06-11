import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Eye, EyeOff, Shield, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// (Demo user quick-login list removed in production cleanup.)

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const { login, setAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/auth/login`, { email, password });
      
      if (response.data.requires_2fa) {
        // User has 2FA enabled, show code input
        setRequires2FA(true);
        toast.info('Please enter your 2FA code');
      } else {
        // No 2FA, proceed with login
        setAuth(response.data.user, response.data.session_token);
        toast.success('Login successful!');
        navigate('/our-tasks');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/auth/2fa/verify?email=${encodeURIComponent(email)}&code=${twoFactorCode}`);
      setAuth(response.data.user, response.data.session_token);
      toast.success('Login successful!');
      navigate('/our-tasks');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid 2FA code');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setRequires2FA(false);
    setTwoFactorCode('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)' }}>
      <div className="w-full max-w-md">
        <div className="bg-[#18181b] p-8 rounded-2xl border border-[#27272a] shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                Drawlead OS
              </span>
            </h1>
            <p className="text-[#a1a1aa] text-sm">
              {requires2FA ? 'Two-Factor Authentication' : 'Sign in to your account'}
            </p>
          </div>

          {!requires2FA ? (
            // Regular Login Form
            <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
              <div>
                <Label htmlFor="email" className="text-[#fafafa] text-sm font-medium mb-2 block">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="email-input"
                  className="bg-[#18181b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1] focus:ring-[#6366f1]"
                  placeholder="admin@drawlead.com"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-[#fafafa] text-sm font-medium mb-2 block">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="password-input"
                    className="bg-[#18181b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1] focus:ring-[#6366f1] pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
                    data-testid="toggle-password-visibility"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-[#6366f1] hover:text-[#8b5cf6] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="login-button"
                className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white font-medium py-3 rounded-lg glow-primary transition-all duration-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          ) : (
            // 2FA Code Form
            <form onSubmit={handle2FASubmit} className="space-y-6" data-testid="2fa-form">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-[#6366f1]/20 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-[#6366f1]" />
                </div>
              </div>
              
              <p className="text-center text-[#a1a1aa] text-sm mb-6">
                Enter the 6-digit code from your authenticator app
              </p>

              <div>
                <Label htmlFor="2fa-code" className="text-[#fafafa] text-sm font-medium mb-2 block">
                  Authentication Code
                </Label>
                <Input
                  id="2fa-code"
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  data-testid="2fa-code-input"
                  className="bg-[#18181b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1] focus:ring-[#6366f1] text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={goBack}
                  variant="outline"
                  className="flex-1 border-[#27272a] text-[#a1a1aa] hover:bg-[#27272a]"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || twoFactorCode.length !== 6}
                  data-testid="verify-2fa-button"
                  className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-medium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify'
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
