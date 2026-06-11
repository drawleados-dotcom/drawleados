import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

// Aliases mirror Sidebar.js so route-level RBAC matches what the sidebar shows.
const MODULE_ALIASES = {
  operations: ['operations', 'our_tasks'],
  our_tasks: ['our_tasks', 'operations'],
  web_dev: ['web_dev'],
  hr: ['hr', 'my_profile'],
  hr_admin: ['hr_admin', 'hr_manager'],
  my_profile: ['my_profile', 'hr'],
};

function userHasModule(user, isAdmin, module) {
  if (!module) return true;
  // Super Admin ALWAYS has full access regardless of designation.module_access.
  const role = String(user?.role || '').toLowerCase();
  if (role === 'super_admin') return true;

  const moduleAccess = Array.isArray(user?.module_access) ? user.module_access : [];

  // Designation-driven module_access has HIGHEST priority for non-super-admin roles.
  if (moduleAccess.length > 0) {
    const allowed = new Set(moduleAccess.map((m) => String(m).toLowerCase()));
    const aliases = MODULE_ALIASES[module] || [module];
    return aliases.some((a) => allowed.has(String(a).toLowerCase()));
  }

  // Fallback for users without designation-defined module_access.
  if (isAdmin) return true;
  if (module === 'profile') return true;
  return false;
}

export default function ProtectedRoute({ children, module }) {
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

  // Module-level RBAC: block render of the page shell entirely when user
  // doesn't have access. Redirect to the unified landing route.
  if (module && !userHasModule(user, isAdmin, module)) {
    return <Navigate to="/our-tasks" replace />;
  }

  // Legacy guard: tasks-only users hit /my-tasks (kept for back-compat).
  const moduleAccess = user?.module_access || [];
  const hasTasksModuleOnly =
    moduleAccess.length === 1 && moduleAccess.includes('tasks') && !isAdmin;
  const userRole = user?.role || '';
  const isProjectManager = userRole === 'project_manager';

  if (hasTasksModuleOnly && !isProjectManager) {
    const allowedPaths = ['/calendar', '/my-tasks', '/tasks', '/hr', '/my-documents'];
    const isAllowed = allowedPaths.some(
      (path) => location.pathname === path || location.pathname.startsWith(path + '/'),
    );
    if (!isAllowed) {
      return <Navigate to="/my-tasks" replace />;
    }
  }

  return children;
}
