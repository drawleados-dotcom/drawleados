import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard, Users, Settings as SettingsIcon, Package, DollarSign,
  UserCircle, Megaphone, ClipboardList, ClipboardCheck, Globe, FolderOpen,
  Calendar, Briefcase, FileSpreadsheet, Building2, Handshake, Bot, Linkedin,
  Send, MoreHorizontal, X,
} from 'lucide-react';

// Mirrors Sidebar.js / TopNav.js / ProtectedRoute.js.
const AUTOMATION_HARDCODED_EMAILS = ['vinoth@drawlead.com'];

const ALL_ITEMS = [
  { key: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'leads', path: '/leads', label: 'Leads', icon: Megaphone },
  { key: 'finance', path: '/finance', label: 'Finance', icon: DollarSign },
  { key: 'our_tasks', path: '/our-tasks', label: 'Operations', icon: ClipboardList },
  { key: 'web_dev', path: '/dl-operations', label: 'Web Dev', icon: Globe },
  { key: 'meetings', path: '/calendar', label: 'Meetings', icon: Calendar },
  { key: 'approvals', path: '/approvals', label: 'Approvals', icon: ClipboardCheck },
  { key: 'hr_admin', path: '/hr-admin', label: 'HR Admin', icon: Users },
  { key: 'documentations', path: '/documentations', label: 'Docs', icon: FolderOpen },
  { key: 'sales', path: '/sales', label: 'Sales', icon: Briefcase },
  { key: 'meta_ads', path: '/meta-ads', label: 'Meta Ads', icon: FileSpreadsheet },
  { key: 'client_master', path: '/client-master', label: 'Clients Master', icon: Building2 },
  { key: 'service_packages', path: '/service-packages', label: 'Service & Packages', icon: Package },
  { key: 'bni', path: '/bni', label: 'BNI', icon: Handshake },
  { key: 'bni_outreach', path: '/bni-outreach', label: 'BNI Outreach', icon: Send },
  { key: 'automation', path: '/automation', label: 'Automation', icon: Bot },
  { key: 'linkedin', path: '/linkedin', label: 'LinkedIn', icon: Linkedin },
  { key: 'settings', path: '/settings', label: 'Settings', icon: SettingsIcon },
  { key: 'my_profile', path: '/hr', label: 'My Profile', icon: UserCircle },
];

// The four quick items pinned to the bottom bar (filtered by access); the rest
// live under "More".
const PRIMARY_KEYS = ['leads', 'finance', 'our_tasks', 'bni_outreach'];

export default function MobileBottomNav() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  const moduleAccess = user?.module_access || [];
  const userRole = user?.role || 'employee';

  const hasAccess = useMemo(() => (module) => {
    if (module === 'dashboard' && (userRole === 'super_admin' || userRole === 'admin')) return true;
    if ((module === 'client_master' || module === 'service_packages' || module === 'bni' || module === 'bni_outreach' || module === 'linkedin') && userRole === 'super_admin') return true;
    if (module === 'automation') {
      if (userRole === 'super_admin' || userRole === 'admin') return true;
      if (AUTOMATION_HARDCODED_EMAILS.includes(String(user?.email || '').toLowerCase())) return true;
    }
    if (Array.isArray(moduleAccess) && moduleAccess.length > 0) {
      const aliasMap = {
        operations: ['operations', 'our_tasks'],
        our_tasks: ['our_tasks', 'operations'],
        hr: ['hr', 'my_profile'],
        hr_admin: ['hr_admin', 'hr_manager'],
        my_profile: ['my_profile', 'hr'],
      };
      const allowed = new Set(moduleAccess.map((m) => String(m).toLowerCase()));
      const aliases = aliasMap[module] || [module];
      return aliases.some((a) => allowed.has(String(a).toLowerCase()));
    }
    if (userRole === 'super_admin' || userRole === 'admin') return true;
    return false;
  }, [moduleAccess, userRole, user?.email]);

  const visible = ALL_ITEMS.filter((it) => hasAccess(it.key));
  const primary = PRIMARY_KEYS.map((k) => visible.find((it) => it.key === k)).filter(Boolean).slice(0, 4);

  const bar = isDark ? 'bg-[#0c0a09] border-[#27272a]' : 'bg-white border-gray-200';
  const inactive = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';
  const activeCls = 'text-[#6366f1]';
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  const go = (path) => { setShowMore(false); navigate(path); };

  return (
    <>
      {/* Slide-up "More" sheet */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className={`absolute bottom-0 left-0 right-0 rounded-t-2xl border-t ${bar} p-4 pb-6 max-h-[70vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className={`font-semibold ${isDark ? 'text-[#fafafa]' : 'text-gray-900'}`}>All Menu</p>
              <button onClick={() => setShowMore(false)} className={inactive}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {visible.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.key}
                    onClick={() => go(it.path)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg ${isActive(it.path) ? 'bg-[#6366f1]/10' : ''}`}
                    data-testid={`mobile-more-${it.key}`}
                  >
                    <Icon className={`h-5 w-5 ${isActive(it.path) ? activeCls : inactive}`} />
                    <span className={`text-[10px] text-center leading-tight ${isActive(it.path) ? activeCls : inactive}`}>{it.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fixed bottom bar */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t ${bar} flex items-stretch`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        data-testid="mobile-bottom-nav"
      >
        {primary.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              onClick={() => go(it.path)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
              data-testid={`mobile-nav-${it.key}`}
            >
              <Icon className={`h-5 w-5 ${isActive(it.path) ? activeCls : inactive}`} />
              <span className={`text-[10px] ${isActive(it.path) ? activeCls : inactive}`}>{it.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setShowMore(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
          data-testid="mobile-nav-more"
        >
          <MoreHorizontal className={`h-5 w-5 ${showMore ? activeCls : inactive}`} />
          <span className={`text-[10px] ${showMore ? activeCls : inactive}`}>More</span>
        </button>
      </nav>
    </>
  );
}
