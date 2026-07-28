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
  // Dashboard is Super Admin/Admin's landing tab — always accessible to
  // them, regardless of a designation's configured module_access list
  // (which may predate this module and simply never mention it).
  if (module === 'dashboard') {
    const role = String(user?.role || '').toLowerCase();
    if (role === 'super_admin' || isAdmin) return true;
  }
  // Client Master / Service & Packages are Super Admin-only additions —
  // always visible to super_admin regardless of a curated module_access
  // list (which predates these modules and never mentions them).
  if (module === 'client_master' || module === 'service_packages' || module === 'bni' || module === 'automation') {
    const role = String(user?.role || '').toLowerCase();
    if (role === 'super_admin') return true;
  }
  const moduleAccess = Array.isArray(user?.module_access) ? user.module_access : [];

  // Designation-driven module_access has HIGHEST priority for ALL roles
  // (including super_admin). This lets a super_admin self-restrict via
  // their assigned designation. Only modules in the list are accessible.
  if (moduleAccess.length > 0) {
    const allowed = new Set(moduleAccess.map((m) => String(m).toLowerCase()));
    const aliases = MODULE_ALIASES[module] || [module];
    return aliases.some((a) => allowed.has(String(a).toLowerCase()));
  }

  // Fallback when NO designation/module_access set: super_admin & admin see everything.
  const role = String(user?.role || '').toLowerCase();
  if (role === 'super_admin') return true;
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
