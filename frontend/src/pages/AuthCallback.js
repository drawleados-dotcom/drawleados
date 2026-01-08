import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { API_BASE } from '../utils/api';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = location.hash;
        const params = new URLSearchParams(hash.substring(1));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          navigate('/login');
          return;
        }

        // Exchange session_id for user data
        const response = await api.post('/auth/google-session', null, {
          params: { session_id: sessionId },
        });

        // Store session token
        localStorage.setItem('session_token', response.data.session_token);

        // Navigate to dashboard with user data
        navigate('/dashboard', { state: { user: response.data.user }, replace: true });
      } catch (error) {
        console.error('Session processing error:', error);
        navigate('/login');
      }
    };

    processSession();
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#6366f1] mx-auto mb-4" />
        <p className="text-[#fafafa] text-lg">Completing authentication...</p>
      </div>
    </div>
  );
}
