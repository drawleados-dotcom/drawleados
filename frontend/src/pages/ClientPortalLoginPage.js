import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Client Portal login — completely separate from staff auth. No Layout,
 * no useAuth(): the client isn't a user in the `users` collection at all,
 * just a username/password scoped to one project (see
 * backend/client_portal_routes.py).
 */
export default function ClientPortalLoginPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/client-portal/${projectId}/login`, { username, password });
      localStorage.setItem('client_portal_session_token', res.data.session_token);
      localStorage.setItem('client_portal_project_id', projectId);
      navigate(`/client-portal/${projectId}/view`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)' }}>
      <div className="w-full max-w-md">
        <div className="bg-[#18181b] p-8 rounded-2xl border border-[#27272a] shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                Client Portal
              </span>
            </h1>
            <p className="text-[#a1a1aa] text-sm">Sign in to view your project</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="client-portal-login-form">
            <div>
              <Label htmlFor="username" className="text-[#fafafa] text-sm font-medium mb-2 block">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="client-portal-login-username"
                className="bg-[#18181b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1] focus:ring-[#6366f1]"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-[#fafafa] text-sm font-medium mb-2 block">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="client-portal-login-password"
                className="bg-[#18181b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1] focus:ring-[#6366f1]"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="client-portal-login-submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
