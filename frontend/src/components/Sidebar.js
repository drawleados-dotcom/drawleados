import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard,
  Users,
  User,
  Settings,
  LogOut,
  Package,
  DollarSign,
  UserCircle,
  Shield,
  ChevronLeft,
  Plus,
  Database,
  MessageSquare,
  Megaphone,
  ClipboardList,
  ClipboardCheck,
  CheckCircle2,
  Globe,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
  FileSpreadsheet,
  Search,
  Calendar,
  Briefcase,
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
  const [operationsExpanded, setOperationsExpanded] = useState(false);
  const [salesExpanded] = useState(false);
  const [metaAdsExpanded, setMetaAdsExpanded] = useState(false);
  // websiteProjects state removed — Web Dev now uses its own page (/dl-operations)
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
    // Super Admin - Full access to all modules
    if (userRole === 'super_admin') {
      return true; // Super admin has access to everything
    }
    
    // Admin has full access
    if (userRole === 'admin') return true;
    
    // HR access - check explicit module access (support multiple names)
    if (module === 'hr') {
      return moduleAccess.includes('hr') || moduleAccess.includes('my_profile');
    }
    
    // HR Admin/Manager - separate permission (support multiple names)
    if (module === 'hr_admin') {
      return moduleAccess.includes('hr_admin') || moduleAccess.includes('hr_manager');
    }
    
    // Operations - check explicit access
    if (module === 'operations') return moduleAccess.includes('operations') || moduleAccess.includes('web_dev');
    
    // Profile - ALL employees get Profile access
    if (module === 'profile') return true;
    
    // Calendar - check explicit access
    if (module === 'calendar') return moduleAccess.includes('calendar');
    
    // My Tasks - check explicit access
    if (module === 'my_tasks') return moduleAccess.includes('my_tasks');
    
    // Our Tasks - check explicit access
    if (module === 'our_tasks') return moduleAccess.includes('our_tasks');
    
    // Tasks module - check explicit access
    if (module === 'tasks') return moduleAccess.includes('tasks');
    
    // Check explicit module access for other modules
    return moduleAccess.includes(module);
  };
  
  // Check if user has ONLY tasks module (Operations Head view)
  const hasTasksModuleOnly = moduleAccess.includes('tasks') && !isAdmin;
  
  // Legacy checks (for backward compatibility)
  const isEmployee = userRole === 'employee';
  const isBDE = userRole === 'business_development' || userRole === 'bde';
  const isProjectManager = userRole === 'project_manager';
  // HR Admin access: Super Admin, HR Manager, or users with hr_admin/hr_manager module access
  const canManageHR = isAdmin || userRole === 'hr_manager' || hasAccess('hr_admin') || moduleAccess.includes('hr_manager');
  const canManageUsers = user?.can_manage_users || false;

  // User designation for department filtering
  const userDesignation = (user?.designation || '').toLowerCase();
  
  // Check if user can see a specific operations department
  const canSeeDepartment = (deptKey) => {
    // Admin and super admin can see all
    if (isAdmin) return true;
    
    // BDE role can always see bde tasks
    if (deptKey === 'bde' && isBDE) return true;
    
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

  // loadWebsiteProjects removed — Web Dev sidebar badge no longer shown

  useEffect(() => {
    loadDatabases();
    loadUnreadCount();
    
    // Poll for unread count every 10 seconds
    const interval = setInterval(loadUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [loadDatabases, loadUnreadCount]);

  // Operations dropdown is toggled manually by clicking the Operations nav button

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
        {/* === TASKS MODULE USER VIEW (Operations Head) === */}
        {hasTasksModuleOnly && (
          <>
            {/* Calendar */}
            <Link
              to="/calendar"
              data-testid="nav-calendar-tasks"
              className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname.startsWith('/calendar') ? navItemActive : navItemInactive}`}
              title={isCollapsed ? 'Calendar' : ''}
            >
              <Calendar className="h-5 w-5" strokeWidth={2} />
              {!isCollapsed && 'Calendar'}
            </Link>

            {/* My Profile */}
            <Link
              to="/hr"
              data-testid="nav-my-profile"
              className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/hr' ? navItemActive : navItemInactive}`}
              title={isCollapsed ? 'My Profile' : ''}
            >
              <UserCircle className="h-5 w-5" strokeWidth={2} />
              {!isCollapsed && 'My Profile'}
            </Link>

            {/* Documentation (Personal) */}
            <Link
              to="/my-documents"
              data-testid="nav-my-documents"
              className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/my-documents' ? navItemActive : navItemInactive}`}
              title={isCollapsed ? 'Documentation' : ''}
            >
              <FolderOpen className="h-5 w-5" strokeWidth={2} />
              {!isCollapsed && 'Documentation'}
            </Link>
          </>
        )}

        {/* === PROJECT MANAGER VIEW removed (used deleted /website-projects module) === */}

        {/* === STANDARD VIEW (for non-tasks-only users and non-project-managers) === */}
        {!hasTasksModuleOnly && !isProjectManager && (
          <>
        {/* 1. Calendar - only if user has calendar access */}
        {hasAccess('calendar') && (
        <Link
          to="/calendar"
          data-testid="nav-calendar"
          className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname.startsWith('/calendar') ? navItemActive : navItemInactive}`}
          title={isCollapsed ? 'Calendar' : ''}
        >
          <Calendar className="h-5 w-5" strokeWidth={2} />
          {!isCollapsed && 'Calendar'}
        </Link>
        )}

        {/* 2. My Tasks removed — use Operations instead */}

        {/* Our Tasks - only if user has our_tasks access */}
        {hasAccess('our_tasks') && (
        <Link
          to="/our-tasks"
          data-testid="nav-our-tasks"
          className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/our-tasks' ? navItemActive : navItemInactive}`}
          title={isCollapsed ? 'Operations' : ''}
        >
          <ClipboardList className="h-5 w-5" strokeWidth={2} />
          {!isCollapsed && 'Operations'}
        </Link>
        )}

        {/* 3. Leads - direct top-level link (Sales group removed) */}
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

        {/* 3.5 Web Dev - Website Development Projects */}
        {(hasAccess('operations') || hasAccess('web_dev') || userRole === 'super_admin' || isAdmin || isProjectManager) && (
          <Link
            to="/dl-operations"
            data-testid="nav-web-dev"
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/dl-operations' || location.pathname.startsWith('/project/') ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'Web Dev' : ''}
          >
            <Globe className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && 'Web Dev'}
          </Link>
        )}

        {/* 3.6 Approvals - Centralized approval page */}
        {(userRole === 'super_admin' || isAdmin || isProjectManager || hasAccess('approvals')) && (
          <Link
            to="/approvals"
            data-testid="nav-approvals"
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/approvals' ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'Approvals' : ''}
          >
            <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && 'Approvals'}
          </Link>
        )}


        {/* 5. My Profile (HR) - visible for all users */}
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

        {/* 6. HR Admin/Manager - Admin/Manager only */}
        {canManageHR && (
          <Link
            to="/hr-admin"
            data-testid="nav-hr-admin"
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/hr-admin' ? navItemActive : navItemInactive}`}
            title={isCollapsed ? (moduleAccess.includes('hr_manager') && !moduleAccess.includes('hr_admin') ? 'HR Manager' : 'HR Admin') : ''}
          >
            <Shield className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && (moduleAccess.includes('hr_manager') && !moduleAccess.includes('hr_admin') ? 'HR Manager' : 'HR Admin')}
          </Link>
        )}

        {/* 7. Finance - visible if user has finance access */}
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

        {/* 8. Settings - visible only for admins */}
        {hasAccess('settings') && (
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

        {/* 9. Documentation - visible for business_development, admins, and super_admin */}
        {(hasAccess('documentations') || hasAccess('leads') || isBDE || isAdmin) && (
          <Link
            to="/documentations"
            data-testid="nav-documentations"
            className={`${navItemBase} ${isCollapsed ? 'justify-center px-2' : ''} ${location.pathname === '/documentations' ? navItemActive : navItemInactive}`}
            title={isCollapsed ? 'Documentation' : ''}
          >
            <FileSpreadsheet className="h-5 w-5" strokeWidth={2} />
            {!isCollapsed && 'Documentation'}
          </Link>
        )}
          </>
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
