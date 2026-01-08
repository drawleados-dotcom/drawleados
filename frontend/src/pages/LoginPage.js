import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)' }}>
      <div className="w-full max-w-md">
        <div className="glass-morphism p-8 rounded-2xl border border-[#27272a]">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                Drawlead OS
              </span>
            </h1>
            <p className="text-[#a1a1aa] text-sm">Sign in to your account</p>
          </div>

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
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="password-input"
                className="bg-[#18181b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1] focus:ring-[#6366f1]"
                placeholder="••••••••"
              />
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

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#27272a]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#18181b] text-[#a1a1aa]">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleGoogleLogin}
              data-testid="google-login-button"
              className="w-full mt-4 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] font-medium py-3 rounded-lg border border-[#3f3f46] transition-all duration-300"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-[#a1a1aa]">
            Demo credentials: admin@drawlead.com / admin123
          </p>
        </div>
      </div>
    </div>
  );
}
