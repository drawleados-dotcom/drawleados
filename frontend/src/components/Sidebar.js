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
  Globe,
  FolderOpen,
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
  const [websiteExpanded, setWebsiteExpanded] = useState(false);
  const [websiteProjects, setWebsiteProjects] = useState([]);
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

  // Load website projects for sidebar
  const loadWebsiteProjects = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/api/website-projects/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWebsiteProjects(res.data || []);
    } catch (error) {
      console.error('Error loading website projects:', error);
    }
  }, [token]);

  useEffect(() => {
    loadDatabases();
    loadUnreadCount();
    loadWebsiteProjects();
    
    // Poll for unread count every 10 seconds
    const interval = setInterval(loadUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [loadDatabases, loadUnreadCount, loadWebsiteProjects]);

  // Expand Operations if we're on that page
  useEffect(() => {
    if (location.pathname.startsWith('/operations') || location.pathname.startsWith('/sop-works')) {
      setOperationsExpanded(true);
    }
    if (location.pathname.startsWith('/website-projects')) {
      setOperationsExpanded(true);
      setWebsiteExpanded(true);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isOperationsActive = location.pathname.startsWith('/operations') || location.pathname.startsWith('/sop-works');

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

        {/* Operations with Service Types */}
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
            <Package className="h-5 w-5" strokeWidth={2} />
            <span className="flex-1 text-left">Operations</span>
          </button>

          {/* Service Types */}
          {operationsExpanded && (
            <div className={`ml-4 mt-1 space-y-0.5 border-l pl-3 ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
              <Link
                to="/website-projects"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/website-projects'
                    ? isDark ? 'bg-[#27272a] text-[#fafafa]' : 'bg-gray-100 text-gray-900'
                    : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                data-testid="nav-website-projects"
              >
                <span className="text-base">🌐</span>
                <span>Website Development</span>
              </Link>
              
              <Link
                to="/sop-works?service=seo"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.search.includes('service=seo')
                    ? isDark ? 'bg-[#27272a] text-[#fafafa]' : 'bg-gray-100 text-gray-900'
                    : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-base">🔍</span>
                <span>SEO</span>
              </Link>
              
              <Link
                to="/sop-works?service=social_media"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.search.includes('service=social_media')
                    ? isDark ? 'bg-[#27272a] text-[#fafafa]' : 'bg-gray-100 text-gray-900'
                    : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-base">📱</span>
                <span>Social Media</span>
              </Link>
              
              <Link
                to="/sop-works?service=meta_ads"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.search.includes('service=meta_ads')
                    ? isDark ? 'bg-[#27272a] text-[#fafafa]' : 'bg-gray-100 text-gray-900'
                    : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-base">📊</span>
                <span>Meta Ads</span>
              </Link>

              {/* Add Custom Service */}
              <Link
                to="/sop-works?action=add-service"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${isDark ? 'text-[#6366f1] hover:bg-[#6366f1]/10' : 'text-[#6366f1] hover:bg-[#6366f1]/10'}`}
              >
                <Plus className="h-4 w-4" />
                <span>Add Custom Service</span>
              </Link>
            </div>
          )}
        </div>

        {/* HR - for everyone */}
        <Link
          to="/hr"
          data-testid="nav-hr"
          className={`${navItemBase} ${location.pathname === '/hr' ? navItemActive : navItemInactive}`}
        >
          <UserCircle className="h-5 w-5" strokeWidth={2} />
          HR
        </Link>

        {/* Marketing - Admin only */}
        {isAdmin && (
          <Link
            to="/marketing"
            data-testid="nav-marketing"
            className={`${navItemBase} ${location.pathname === '/marketing' ? navItemActive : navItemInactive}`}
          >
            <Megaphone className="h-5 w-5" strokeWidth={2} />
            Marketing
          </Link>
        )}

        {/* Team Chat */}
        <button
          onClick={() => setChatOpen(true)}
          data-testid="nav-chat"
          className={`w-full ${navItemBase} ${navItemInactive}`}
        >
          <MessageSquare className="h-5 w-5" strokeWidth={2} />
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
            className={`${navItemBase} ${location.pathname === '/hr-admin' ? navItemActive : navItemInactive}`}
          >
            <Shield className="h-5 w-5" strokeWidth={2} />
            HR Admin
          </Link>
        )}

        {/* Reports - NOT for employees */}
        {!isEmployee && (
          <Link
            to="/reports"
            data-testid="nav-reports"
            className={`${navItemBase} ${location.pathname === '/reports' ? navItemActive : navItemInactive}`}
          >
            <TrendingUp className="h-5 w-5" strokeWidth={2} />
            Reports
          </Link>
        )}

        {/* Finance - Admin only */}
        {isAdmin && (
          <Link
            to="/finance"
            data-testid="nav-finance"
            className={`${navItemBase} ${location.pathname === '/finance' ? navItemActive : navItemInactive}`}
          >
            <DollarSign className="h-5 w-5" strokeWidth={2} />
            Finance
          </Link>
        )}

        {/* Services - NOT for employees */}
        {!isEmployee && (
          <Link
            to="/services"
            data-testid="nav-services"
            className={`${navItemBase} ${location.pathname === '/services' ? navItemActive : navItemInactive}`}
          >
            <Package className="h-5 w-5" strokeWidth={2} />
            Services
          </Link>
        )}

        {/* Settings - Admin only */}
        {isAdmin && (
          <Link
            to="/settings"
            data-testid="nav-settings"
            className={`${navItemBase} ${location.pathname === '/settings' ? navItemActive : navItemInactive}`}
          >
            <Settings className="h-5 w-5" strokeWidth={2} />
            Settings
          </Link>
        )}
      </nav>

      <div className={`p-4 border-t ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-semibold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${isDark ? 'text-[#fafafa]' : 'text-gray-900'}`}>{user?.name}</p>
            <p className={`text-xs capitalize ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>{user?.role}</p>
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
