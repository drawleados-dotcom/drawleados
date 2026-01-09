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

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    localStorage.setItem('session_token', response.data.session_token);
    setUser(response.data.user);
    return response.data;
  };

  const register = async (email, name, password, role = 'bde') => {
    const response = await api.post('/auth/register', { email, name, password, role });
    localStorage.setItem('session_token', response.data.session_token);
    setUser(response.data.user);
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

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    checkAuth,
    isAdmin: ['admin', 'super_admin'].includes(user?.role),
    isSuperAdmin: user?.role === 'super_admin',
    isProjectManager: ['project_manager', 'admin', 'super_admin'].includes(user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
