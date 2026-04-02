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
  FileSpreadsheet,
  Search,
  Calendar,
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
  const [metaAdsExpanded, setMetaAdsExpanded] = useState(false);
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

  // Role-based access control
  const userRole = user?.role || 'employee';
  const moduleAccess = user?.module_access || [];
  const userDepartment = user?.department || '';
  
  // Check access permissions
  const hasAccess = (module) => {
    // Super Admin and Admin have full access
    if (userRole === 'super_admin' || userRole === 'admin') return true;
    
    // ALL employees get HR access (for their own attendance/leave/profile)
    if (module === 'hr') return true;
    
    // ALL employees get Operations access (filtered by department)
    if (module === 'operations') return true;
    
    // ALL employees get Profile access
    if (module === 'profile') return true;
    
    // Check explicit module access for other modules
    return moduleAccess.includes(module);
  };
  
  // Legacy checks (for backward compatibility)
  const isEmployee = userRole === 'employee';
  const isBDE = userRole === 'business_development' || userRole === 'bde';
  const isProjectManager = userRole === 'project_manager';
  // HR Admin access: Super Admin, HR Manager, or users with hr_admin module access
  const canManageHR = isAdmin || userRole === 'hr_manager' || hasAccess('hr_admin');
  const canManageUsers = user?.can_manage_users || false;

  // User designation for department filtering
  const userDesignation = (user?.designation || '').toLowerCase();
  
  // Check if user can see a specific operations department
  const canSeeDepartment = (deptKey) => {
    // Admin and super admin can see all
    if (isAdmin) return true;
    
    // Map department keys to designation keywords
    const deptMap = {
      'website': ['website', 'web developer', 'web', 'developer', 'frontend', 'backend', 'fullstack'],
      'seo': ['seo', 'search engine', 'seo specialist', 'seo executive'],
      'social': ['social', 'social media', 'smm', 'social media manager'],
      'creative': ['creative', 'design', 'designer', 'graphic', 'creative design'],
      'meta': ['meta', 'ads', 'meta ads', 'performance', 'paid', 'marketing'],
      'bde': ['bde', 'business development', 'sales', 'bd']
    };
    
    const keywords = deptMap[deptKey] || [];
    return keywords.some(kw => userDesignation.includes(kw));
  };

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
          data-testid="sidebar-toggle"
        >
          {isCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
      </div>

      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-4'} space-y-1 overflow-y-auto`}>
        {/* Leads - visible if user has leads access */}
        {hasAccess('leads') && (
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

        {/* Operations with Service Types - visible if user has operations access */}
        {hasAccess('operations') && (
        <div>
          <button
            onClick={() => {
              if (isCollapsed) {
                // Expand sidebar and open operations menu
                setIsCollapsed(false);
                setOperationsExpanded(true);
              } else {
                setOperationsExpanded(!operationsExpanded);
              }
            }}
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

          {/* Service Types - Filtered by user department */}
          {!isCollapsed && operationsExpanded && (
            <div className={`ml-4 mt-1 space-y-0.5 border-l pl-3 ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
              {/* Website Development - Direct Link */}
              {canSeeDepartment('website') && (
              <Link
                to="/website-projects"
                data-testid="nav-website-projects"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname.startsWith('/website-projects')
                    ? isDark ? 'bg-[#27272a] text-[#fafafa]' : 'bg-gray-100 text-gray-900'
                    : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Globe className="h-4 w-4" />
                <span className="flex-1 text-left">Website Development</span>
                <Badge className="bg-[#6366f1]/20 text-[#6366f1] text-xs px-1.5">{websiteProjects.length}</Badge>
              </Link>
              )}
              
              {canSeeDepartment('seo') && (
              <>
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
                to="/seo-board"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/seo-board'
                    ? isDark ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'bg-[#f59e0b]/10 text-[#d97706]'
                    : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Search className="h-4 w-4" />
                <span>SEO Board</span>
              </Link>
              </>
              )}
              
              {canSeeDepartment('social') && (
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
              )}
              
              {canSeeDepartment('creative') && (
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
              )}
              
              {/* Meta Ads - Expandable */}
              {canSeeDepartment('meta') && (
              <div>
                <button
                  onClick={() => setMetaAdsExpanded(!metaAdsExpanded)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                    location.pathname.startsWith('/meta-ads') || location.pathname === '/sop-works' && location.search.includes('service=meta_ads')
                      ? isDark ? 'bg-[#27272a] text-[#fafafa]' : 'bg-gray-100 text-gray-900'
                      : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📊</span>
                    <span>Meta Ads</span>
                  </div>
                  {metaAdsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                
                {metaAdsExpanded && (
                  <div className="ml-4 pl-2 border-l border-[#27272a] mt-1 space-y-1">
                    <Link
                      to="/meta-ads"
                      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                        location.pathname === '/meta-ads'
                          ? isDark ? 'bg-[#27272a] text-[#fafafa]' : 'bg-gray-100 text-gray-900'
                          : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <span className="text-base">📈</span>
                      <span>Meta Ads Board</span>
                    </Link>
                  </div>
                )}
              </div>
              )}

              {/* BDE Tasks */}
              {canSeeDepartment('bde') && (
              <Link
                to="/bde-tasks"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === '/bde-tasks'
                    ? isDark ? 'bg-[#27272a] text-[#fafafa]' : 'bg-gray-100 text-gray-900'
                    : isDark ? 'text-[#a1a1aa] hover:bg-[#27272a]/50 hover:text-[#e4e4e7]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-base">💼</span>
                <span>BDE Tasks</span>
              </Link>
              )}

              {/* Add Custom Service - Only for admins */}
              {isAdmin && (
              <Link
                to="/sop-works?action=add-service"
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${isDark ? 'text-[#6366f1] hover:bg-[#6366f1]/10' : 'text-[#6366f1] hover:bg-[#6366f1]/10'}`}
              >
                <Plus className="h-4 w-4" />
                <span>Add Custom Service</span>
              </Link>
              )}
            </div>
          )}
        </div>
        )}

        {/* My Profile (HR) - visible for all users */}
        {hasAccess('hr') && (
        <Link
          to="/hr"
          data-testid="nav-my-profile"
          className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/hr' ? navItemActive : navItemInactive}`}
          title={isCollapsed ? 'My Profile' : ''}
        >
          <UserCircle className="h-5 w-5" strokeWidth={2} />
          {!isCollapsed && 'My Profile'}
        </Link>
        )}

        {/* Calendar - visible for all users */}
        <Link
          to={`/calendar/${new Date().toISOString().split('T')[0]}`}
          data-testid="nav-calendar"
          className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname.startsWith('/calendar') ? navItemActive : navItemInactive}`}
          title={isCollapsed ? 'Calendar' : ''}
        >
          <Calendar className="h-5 w-5" strokeWidth={2} />
          {!isCollapsed && 'Calendar'}
        </Link>

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

        {/* Finance - visible if user has finance access */}
        {hasAccess('finance') && (
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

        {/* Settings - visible only for admins (not BDE) */}
        {hasAccess('settings') && !isBDE && (
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

        {/* Documentations - visible for business_development and admins */}
        {(hasAccess('leads') || isBDE) && (
          <Link
            to="/documentations"
            data-testid="nav-documentations"
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/documentations' ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'Documentations' : ''}
          >
            <FileSpreadsheet className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && 'Documentations'}
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
