import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  // If user data passed from AuthCallback, render immediately
  if (location.state?.user) {
    return children;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#6366f1] mx-auto mb-4" />
          <p className="text-[#fafafa] text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has ONLY tasks module (Operations Head view)
  const moduleAccess = user?.module_access || [];
  const hasTasksModuleOnly = moduleAccess.includes('tasks') && !isAdmin;
  
  // Redirect tasks-only users from unauthorized pages to /my-tasks
  if (hasTasksModuleOnly) {
    const allowedPaths = ['/calendar', '/my-tasks', '/tasks', '/hr', '/my-documents'];
    const isAllowed = allowedPaths.some(path => location.pathname === path || location.pathname.startsWith(path + '/'));
    
    if (!isAllowed) {
      return <Navigate to="/my-tasks" replace />;
    }
  }

  return children;
}
