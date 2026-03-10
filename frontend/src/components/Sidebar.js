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
  ChevronLeft,
  Plus,
  Database,
  MessageSquare,
  Megaphone,
  ClipboardList,
  Globe,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
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
  
  // Sidebar collapsed state - default to collapsed
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === null ? true : saved === 'true';
  });

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isCollapsed.toString());
  }, [isCollapsed]);

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

  const isOperationsActive = location.pathname.startsWith('/operations') || location.pathname.startsWith('/sop-works') || location.pathname.startsWith('/website-projects');

  // Base styles for nav items
  const navItemBase = `flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300`;
  const navItemActive = `bg-[#6366f1]/15 text-[#6366f1] font-bold`;
  const navItemInactive = isDark 
    ? 'text-[#e4e4e7] hover:bg-[#6366f1]/10 hover:text-[#6366f1]'
    : 'text-gray-700 hover:bg-[#6366f1]/10 hover:text-[#6366f1]';

  return (
    <div
      className={`h-screen ${isCollapsed ? 'w-16' : 'w-64'} border-r flex flex-col transition-all duration-300 ${isDark ? 'bg-[#0c0a09] border-[#27272a]' : 'bg-white border-gray-200'}`}
      data-testid="sidebar"
    >
      {/* Toggle Button */}
      <div className={`p-2 flex ${isCollapsed ? 'justify-center' : 'justify-between items-center px-4'}`}>
        {!isCollapsed && (
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
              Drawlead OS
            </span>
          </h1>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-2 ${isDark ? 'hover:bg-[#27272a]' : 'hover:bg-gray-100'}`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
      </div>

      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-4'} space-y-1 overflow-y-auto`}>
        {/* Dashboard */}
        <Link
          to="/dashboard"
          data-testid="nav-dashboard"
          className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/dashboard' ? navItemActive : navItemInactive}`}
          title={isCollapsed ? 'Dashboard' : ''}
        >
          <LayoutDashboard className="h-5 w-5" strokeWidth={2} />
          {!isCollapsed && 'Dashboard'}
        </Link>

        {/* Leads - NOT for employees */}
        {!isEmployee && (
          <Link
            to="/leads"
            data-testid="nav-leads"
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/leads' ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'Leads' : ''}
          >
            <Users className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && 'Leads'}
          </Link>
        )}

        {/* Operations with Service Types */}
        <div>
          <button
            onClick={() => !isCollapsed && setOperationsExpanded(!operationsExpanded)}
            data-testid="nav-operations"
            className={`w-full ${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${isOperationsActive ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'Operations' : ''}
          >
            {!isCollapsed && (operationsExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            ))}
            <Package className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && <span className="flex-1 text-left">Operations</span>}
          </button>

          {/* Service Types */}
          {!isCollapsed && operationsExpanded && (
            <div className={`ml-4 mt-1 space-y-0.5 border-l pl-3 ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
              {/* Website Development with submenu */}
              <div>
                <button
                  onClick={() => setWebsiteExpanded(!websiteExpanded)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                    location.pathname.startsWith('/website-projects')
                      ? isDark ? 'bg-[#27272a] text-[#fafafa]' : 'bg-gray-100 text-gray-900'
                      : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  data-testid="nav-website-projects"
                >
                  {websiteExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Globe className="h-4 w-4" />
                  <span className="flex-1 text-left">Website Development</span>
                  <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs px-1.5">{websiteProjects.length}</Badge>
                </button>
                
                {/* Projects Submenu */}
                {websiteExpanded && (
                  <div className={`ml-4 mt-1 space-y-0.5 border-l pl-2 ${isDark ? 'border-[#3f3f46]' : 'border-gray-300'}`}>
                    {/* All Projects Link */}
                    <Link
                      to="/website-projects"
                      className={`flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded transition-all ${
                        location.pathname === '/website-projects' && !location.search
                          ? isDark ? 'bg-[#6366f1]/20 text-[#6366f1]' : 'bg-[#6366f1]/10 text-[#6366f1]'
                          : isDark ? 'text-[#71717a] hover:text-[#a1a1aa]' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <FolderOpen className="h-3 w-3" />
                      <span>All Projects</span>
                    </Link>
                    
                    {/* Individual Projects */}
                    {websiteProjects.slice(0, 5).map(project => (
                      <Link
                        key={project.project_id}
                        to={`/website-projects?id=${project.project_id}`}
                        className={`flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded transition-all ${
                          location.search.includes(project.project_id)
                            ? isDark ? 'bg-[#6366f1]/20 text-[#6366f1]' : 'bg-[#6366f1]/10 text-[#6366f1]'
                            : isDark ? 'text-[#71717a] hover:text-[#a1a1aa]' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span className="truncate flex-1">{project.name}</span>
                        <span className="text-[10px] opacity-60">{project.progress}%</span>
                      </Link>
                    ))}
                    
                    {websiteProjects.length > 5 && (
                      <Link
                        to="/website-projects"
                        className={`flex items-center gap-2 px-2 py-1 text-xs ${isDark ? 'text-[#6366f1]' : 'text-[#6366f1]'}`}
                      >
                        <span>+{websiteProjects.length - 5} more</span>
                      </Link>
                    )}
                    
                    {/* New Project */}
                    <Link
                      to="/website-projects?action=new"
                      className={`flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded transition-all ${isDark ? 'text-[#6366f1] hover:bg-[#6366f1]/10' : 'text-[#6366f1] hover:bg-[#6366f1]/10'}`}
                    >
                      <Plus className="h-3 w-3" />
                      <span>New Project</span>
                    </Link>
                  </div>
                )}
              </div>
              
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
                to="/social-media"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/social-media'
                    ? isDark ? 'bg-[#27272a] text-[#fafafa]' : 'bg-gray-100 text-gray-900'
                    : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-base">📱</span>
                <span>Social Media</span>
              </Link>
              
              <Link
                to="/creative-board"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/creative-board'
                    ? isDark ? 'bg-[#27272a] text-[#fafafa]' : 'bg-gray-100 text-gray-900'
                    : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-base">🎨</span>
                <span>Creative Design</span>
              </Link>
              
              <Link
                to="/meta-ads"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/meta-ads'
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
          className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/hr' ? navItemActive : navItemInactive}`}
          title={isCollapsed ? 'HR' : ''}
        >
          <UserCircle className="h-5 w-5" strokeWidth={2} />
          {!isCollapsed && 'HR'}
        </Link>

        {/* Marketing - Admin only */}
        {isAdmin && (
          <Link
            to="/marketing"
            data-testid="nav-marketing"
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/marketing' ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'Marketing' : ''}
          >
            <Megaphone className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && 'Marketing'}
          </Link>
        )}

        {/* Team Chat */}
        <button
          onClick={() => setChatOpen(true)}
          data-testid="nav-chat"
          className={`w-full ${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${navItemInactive}`}
          title={isCollapsed ? 'Team Chat' : ''}
        >
          <div className="relative">
            <MessageSquare className="h-5 w-5" strokeWidth={2} />
            {isCollapsed && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#ef4444] rounded-full"></span>
            )}
          </div>
          {!isCollapsed && <span className="flex-1 text-left">Team Chat</span>}
          {!isCollapsed && unreadCount > 0 && (
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
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/hr-admin' ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'HR Admin' : ''}
          >
            <Shield className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && 'HR Admin'}
          </Link>
        )}

        {/* Reports - NOT for employees */}
        {!isEmployee && (
          <Link
            to="/reports"
            data-testid="nav-reports"
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/reports' ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'Reports' : ''}
          >
            <TrendingUp className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && 'Reports'}
          </Link>
        )}

        {/* Finance - Admin only */}
        {isAdmin && (
          <Link
            to="/finance"
            data-testid="nav-finance"
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/finance' ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'Finance' : ''}
          >
            <DollarSign className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && 'Finance'}
          </Link>
        )}

        {/* Services - NOT for employees */}
        {!isEmployee && (
          <Link
            to="/services"
            data-testid="nav-services"
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/services' ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'Services' : ''}
          >
            <Package className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && 'Services'}
          </Link>
        )}

        {/* Settings - Admin only */}
        {isAdmin && (
          <Link
            to="/settings"
            data-testid="nav-settings"
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/settings' ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'Settings' : ''}
          >
            <Settings className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && 'Settings'}
          </Link>
        )}
      </nav>

      <div className={`p-4 border-t ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
        {!isCollapsed ? (
          <>
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
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <Button
              onClick={handleLogout}
              data-testid="logout-button"
              variant="ghost"
              size="icon"
              className="text-[#ef4444]"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Chat Panel */}
      <ChatPanel isOpen={chatOpen} onClose={() => { setChatOpen(false); loadUnreadCount(); }} />
    </div>
  );
};

export default Sidebar;
