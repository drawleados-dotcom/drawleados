import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Package,
  TrendingUp,
  DollarSign,
  UserCircle,
  Shield,
  ChevronRight,
  ChevronDown,
  Plus,
  Database,
  MessageSquare,
  Megaphone,
  ClipboardList,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import axios from 'axios';
import ChatPanel from './ChatPanel';

const API = process.env.REACT_APP_BACKEND_URL;

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const [databases, setDatabases] = useState([]);
  const [operationsExpanded, setOperationsExpanded] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const token = localStorage.getItem('session_token');

  // Check if user is employee or BDE (restricted access)
  const isEmployee = user?.role === 'employee' || user?.role === 'bde';
  const isProjectManager = user?.role === 'project_manager';
  const canManageHR = isAdmin || isProjectManager;

  // Load databases for operations submenu
  const loadDatabases = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/api/notion/databases`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDatabases(res.data || []);
    } catch (error) {
      console.error('Error loading databases:', error);
    }
  }, [token]);

  // Load unread message count
  const loadUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/api/chat/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(res.data.unread_count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, [token]);

  useEffect(() => {
    loadDatabases();
    loadUnreadCount();
    
    // Poll for unread count every 10 seconds
    const interval = setInterval(loadUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [loadDatabases, loadUnreadCount]);

  // Expand Operations if we're on that page
  useEffect(() => {
    if (location.pathname.startsWith('/operations')) {
      setOperationsExpanded(true);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isOperationsActive = location.pathname.startsWith('/operations');

  // Base styles for nav items
  const navItemBase = `flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300`;
  const navItemActive = `bg-[#6366f1]/15 text-[#6366f1] font-bold`;
  const navItemInactive = isDark 
    ? 'text-[#e4e4e7] hover:bg-[#6366f1]/10 hover:text-[#6366f1]'
    : 'text-gray-700 hover:bg-[#6366f1]/10 hover:text-[#6366f1]';

  return (
    <div
      className={`h-screen w-64 border-r flex flex-col ${isDark ? 'bg-[#0c0a09] border-[#27272a]' : 'bg-white border-gray-200'}`}
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

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {/* Dashboard */}
        <Link
          to="/dashboard"
          data-testid="nav-dashboard"
          className={`${navItemBase} ${location.pathname === '/dashboard' ? navItemActive : navItemInactive}`}
        >
          <LayoutDashboard className="h-5 w-5" strokeWidth={2} />
          Dashboard
        </Link>

        {/* Leads - NOT for employees */}
        {!isEmployee && (
          <Link
            to="/leads"
            data-testid="nav-leads"
            className={`${navItemBase} ${location.pathname === '/leads' ? navItemActive : navItemInactive}`}
          >
            <Users className="h-5 w-5" strokeWidth={2} />
            Leads
          </Link>
        )}

        {/* Operations with nested databases */}
        <div>
          <button
            onClick={() => setOperationsExpanded(!operationsExpanded)}
            data-testid="nav-operations"
            className={`w-full ${navItemBase} ${isOperationsActive ? navItemActive : navItemInactive}`}
          >
            {operationsExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Package className="h-5 w-5" strokeWidth={1.5} />
            <span className="flex-1 text-left">Operations</span>
          </button>

          {/* Nested Databases */}
          {operationsExpanded && (
            <div className="ml-4 mt-1 space-y-0.5 border-l border-[#27272a] pl-3">
              {databases.map((db) => (
                <Link
                  key={db.database_id}
                  to={`/operations?db=${db.database_id}`}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all ${
                    location.search.includes(db.database_id)
                      ? 'bg-[#27272a] text-[#fafafa]'
                      : 'text-[#71717a] hover:bg-[#27272a]/50 hover:text-[#a1a1aa]'
                  }`}
                >
                  <span className="text-base">{db.icon || '📋'}</span>
                  <span className="truncate">{db.name}</span>
                </Link>
              ))}

              {databases.length === 0 && (
                <div className="px-3 py-2 text-xs text-[#52525b]">
                  No databases yet
                </div>
              )}

              {/* Add New Database Link */}
              <Link
                to="/operations"
                className="flex items-center gap-2 px-3 py-2 text-sm text-[#52525b] hover:text-[#a1a1aa] rounded-lg transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>New Database</span>
              </Link>
            </div>
          )}
        </div>

        {/* SOP Works Board */}
        <Link
          to="/sop-works"
          data-testid="nav-sop-works"
          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
            location.pathname === '/sop-works'
              ? 'bg-[#6366f1]/15 text-[#6366f1]'
              : 'text-[#a1a1aa] hover:bg-[#6366f1]/10 hover:text-[#6366f1]'
          }`}
        >
          <ClipboardList className="h-5 w-5" strokeWidth={1.5} />
          SOP Works
        </Link>

        {/* HR - for everyone */}
        <Link
          to="/hr"
          data-testid="nav-hr"
          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
            location.pathname === '/hr'
              ? 'bg-[#6366f1]/15 text-[#6366f1]'
              : 'text-[#a1a1aa] hover:bg-[#6366f1]/10 hover:text-[#6366f1]'
          }`}
        >
          <UserCircle className="h-5 w-5" strokeWidth={1.5} />
          HR
        </Link>

        {/* Marketing - Admin only */}
        {isAdmin && (
          <Link
            to="/marketing"
            data-testid="nav-marketing"
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
              location.pathname === '/marketing'
                ? 'bg-[#6366f1]/15 text-[#6366f1]'
                : 'text-[#a1a1aa] hover:bg-[#6366f1]/10 hover:text-[#6366f1]'
            }`}
          >
            <Megaphone className="h-5 w-5" strokeWidth={1.5} />
            Marketing
          </Link>
        )}

        {/* Team Chat */}
        <button
          onClick={() => setChatOpen(true)}
          data-testid="nav-chat"
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 text-[#a1a1aa] hover:bg-[#6366f1]/10 hover:text-[#6366f1]"
        >
          <MessageSquare className="h-5 w-5" strokeWidth={1.5} />
          <span className="flex-1 text-left">Team Chat</span>
          {unreadCount > 0 && (
            <Badge className="bg-[#ef4444] text-white text-xs px-1.5 py-0 min-w-[20px]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </button>

        {/* HR Admin - Admin/Manager only */}
        {canManageHR && (
          <Link
            to="/hr-admin"
            data-testid="nav-hr-admin"
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
              location.pathname === '/hr-admin'
                ? 'bg-[#6366f1]/15 text-[#6366f1]'
                : 'text-[#a1a1aa] hover:bg-[#6366f1]/10 hover:text-[#6366f1]'
            }`}
          >
            <Shield className="h-5 w-5" strokeWidth={1.5} />
            HR Admin
          </Link>
        )}

        {/* Reports - NOT for employees */}
        {!isEmployee && (
          <Link
            to="/reports"
            data-testid="nav-reports"
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
              location.pathname === '/reports'
                ? 'bg-[#6366f1]/15 text-[#6366f1]'
                : 'text-[#a1a1aa] hover:bg-[#6366f1]/10 hover:text-[#6366f1]'
            }`}
          >
            <TrendingUp className="h-5 w-5" strokeWidth={1.5} />
            Reports
          </Link>
        )}

        {/* Finance - Admin only */}
        {isAdmin && (
          <Link
            to="/finance"
            data-testid="nav-finance"
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
              location.pathname === '/finance'
                ? 'bg-[#6366f1]/15 text-[#6366f1]'
                : 'text-[#a1a1aa] hover:bg-[#6366f1]/10 hover:text-[#6366f1]'
            }`}
          >
            <DollarSign className="h-5 w-5" strokeWidth={1.5} />
            Finance
          </Link>
        )}

        {/* Services - NOT for employees */}
        {!isEmployee && (
          <Link
            to="/services"
            data-testid="nav-services"
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
              location.pathname === '/services'
                ? 'bg-[#6366f1]/15 text-[#6366f1]'
                : 'text-[#a1a1aa] hover:bg-[#6366f1]/10 hover:text-[#6366f1]'
            }`}
          >
            <Package className="h-5 w-5" strokeWidth={1.5} />
            Services
          </Link>
        )}

        {/* Settings - Admin only */}
        {isAdmin && (
          <Link
            to="/settings"
            data-testid="nav-settings"
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
              location.pathname === '/settings'
                ? 'bg-[#6366f1]/15 text-[#6366f1]'
                : 'text-[#a1a1aa] hover:bg-[#6366f1]/10 hover:text-[#6366f1]'
            }`}
          >
            <Settings className="h-5 w-5" strokeWidth={1.5} />
            Settings
          </Link>
        )}
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

      {/* Chat Panel */}
      <ChatPanel isOpen={chatOpen} onClose={() => { setChatOpen(false); loadUnreadCount(); }} />
    </div>
  );
};

export default Sidebar;
