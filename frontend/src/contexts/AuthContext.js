import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('session_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('session_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-refresh the logged-in user's profile (incl. designation_config) every
  // 60s + on window focus / tab visibility return. This makes admin changes to
  // module_access and Operations sub-tab grants visible to the user without
  // requiring a logout/login cycle.
  useEffect(() => {
    if (!user) return;
    const refreshMe = async () => {
      try {
        const token = localStorage.getItem('session_token');
        if (!token) return;
        const res = await api.get('/auth/me');
        setUser((prev) => {
          // Avoid unnecessary re-renders if nothing changed
          if (prev && JSON.stringify(prev) === JSON.stringify(res.data)) return prev;
          return res.data;
        });
      } catch (_) { /* silent */ }
    };
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refreshMe();
    }, 60000);
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshMe(); };
    const onFocus = () => refreshMe();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.user_id]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    localStorage.setItem('session_token', response.data.session_token);
    // Login response doesn't include `designation_config` — fetch the enriched
    // profile from /auth/me so sub-tab access is correctly populated immediately.
    try {
      const me = await api.get('/auth/me');
      setUser(me.data);
    } catch (_) {
      setUser(response.data.user);
    }
    return response.data;
  };

  const register = async (email, name, password, role = 'bde') => {
    const response = await api.post('/auth/register', { email, name, password, role });
    localStorage.setItem('session_token', response.data.session_token);
    try {
      const me = await api.get('/auth/me');
      setUser(me.data);
    } catch (_) {
      setUser(response.data.user);
    }
    return response.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('session_token');
    setUser(null);
  };

  const setAuth = (userData, token) => {
    localStorage.setItem('session_token', token);
    setUser(userData);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    checkAuth,
    refreshUser: checkAuth,
    setAuth,
    isAdmin: ['admin', 'super_admin'].includes(user?.role),
    isSuperAdmin: user?.role === 'super_admin',
    isProjectManager: ['project_manager', 'admin', 'super_admin'].includes(user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
