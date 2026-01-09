import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Package,
  TrendingUp,
  FileText,
  DollarSign,
  UserCircle,
} from 'lucide-react';
import { Button } from './ui/button';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  // Check if user is employee or BDE (restricted access)
  const isEmployee = user?.role === 'employee' || user?.role === 'bde';
  const isProjectManager = user?.role === 'project_manager';

  // Build menu items based on role
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    // Leads - NOT for employees
    ...(!isEmployee ? [{ icon: Users, label: 'Leads', path: '/leads' }] : []),
    // Operations - for everyone
    { icon: Package, label: 'Operations', path: '/operations' },
    // HR - for everyone
    { icon: UserCircle, label: 'HR', path: '/hr' },
    // Reports - NOT for employees
    ...(!isEmployee ? [{ icon: TrendingUp, label: 'Reports', path: '/reports' }] : []),
    // Finance - Admin only
    ...(isAdmin ? [{ icon: DollarSign, label: 'Finance', path: '/finance' }] : []),
    // Services - NOT for employees
    ...(!isEmployee ? [{ icon: Package, label: 'Services', path: '/services' }] : []),
    // Settings - Admin only
    ...(isAdmin ? [{ icon: Settings, label: 'Settings', path: '/settings' }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div
      className="h-screen w-64 bg-[#0c0a09] border-r border-[#27272a] flex flex-col"
      data-testid="sidebar"
    >
      <div className="p-6">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: 'Plus Jakarta Sans' }}
        >
          <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
            Drawlead OS
          </span>
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 ${
                isActive
                  ? 'bg-[#6366f1]/15 text-[#6366f1]'
                  : 'text-[#a1a1aa] hover:bg-[#6366f1]/10 hover:text-[#6366f1]'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#27272a]">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-semibold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#fafafa] truncate">{user?.name}</p>
            <p className="text-xs text-[#a1a1aa] capitalize">{user?.role}</p>
          </div>
        </div>
        <Button
          onClick={handleLogout}
          data-testid="logout-button"
          className="w-full bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] font-medium py-2 rounded-lg border border-[#3f3f46] transition-all duration-300 flex items-center justify-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
