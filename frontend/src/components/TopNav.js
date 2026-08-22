import React, { useMemo, useEffect, useState } from 'react';
import axios from 'axios';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard, Users, User, Settings as SettingsIcon, DollarSign,
  UserCircle, Shield, MessageSquare, Megaphone, ClipboardList, ClipboardCheck,
  Globe, FolderOpen, Calendar, Briefcase, FileSpreadsheet, Search,
  Handshake, Bot, Linkedin, Send, TrendingUp,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Hardcoded Automation access — bypasses module_access/designation entirely
// for this account, regardless of role. Mirrors Sidebar.js/ProtectedRoute.js.
const AUTOMATION_HARDCODED_EMAILS = ['vinoth@drawlead.com'];

/**
 * TopNav — horizontal navigation alternative to the left Sidebar.
 * Triggered when user picks "Top Menu View" in Settings → Menu.
 * Shows only the modules the user has access to (same gating as Sidebar).
 */
export default function TopNav() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const moduleAccess = user?.module_access || [];
  const userRole = user?.role || 'employee';

  const hasAccess = useMemo(() => (module) => {
    // Dashboard is Super Admin/Admin's landing tab — always visible to
    // them, regardless of a designation's configured module_access list.
    if (module === 'dashboard' && (userRole === 'super_admin' || userRole === 'admin')) return true;
    // BNI / BNI Outreach / LinkedIn — Super Admin-only additions, always
    // visible regardless of a curated module_access list. (Client Master /
    // Service & Packages moved under Finance's own tab bar — see
    // ExpenseTab.js — so they're no longer gated here.)
    if ((module === 'bni' || module === 'bni_outreach' || module === 'linkedin') && userRole === 'super_admin') return true;
    // Automation — open to Admin too (not just Super Admin), plus a
    // hardcoded bypass for AUTOMATION_HARDCODED_EMAILS regardless of role.
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
  }, [moduleAccess, userRole]);

  const items = [
    { key: 'dashboard',     path: '/dashboard',       label: 'Dashboard',       icon: LayoutDashboard },
    { key: 'leads',         path: '/leads',           label: 'Sales',           icon: Megaphone },
    { key: 'finance',       path: '/finance',         label: 'Finance',         icon: DollarSign },
    { key: 'our_tasks',     path: '/our-tasks',       label: 'Operations',      icon: ClipboardList },
    { key: 'hr_admin',      path: '/hr-admin',        label: 'HR Admin',        icon: Users },
    { key: 'documentations', path: '/documentations', label: 'Docs',            icon: FolderOpen },
    { key: 'web_dev',       path: '/dl-operations',   label: 'Web Dev',         icon: Globe },
    { key: 'meetings',      path: '/calendar',        label: 'Meetings',        icon: Calendar },
    { key: 'approvals',     path: '/approvals',       label: 'Approvals',       icon: ClipboardCheck },
    { key: 'sales',         path: '/sales',           label: 'Sales',           icon: Briefcase },
    { key: 'meta_ads',      path: '/meta-ads',        label: 'Meta Ads',        icon: FileSpreadsheet },
    // Marketing — these four render as one "Marketing" hover dropdown in
    // the nav (grouped by the `group` key below) instead of four flat
    // top-level items.
    { key: 'bni',           path: '/bni',             label: 'BNI',             icon: Handshake, group: 'marketing' },
    { key: 'bni_outreach',  path: '/bni-outreach',    label: 'BNI Outreach',    icon: Send, group: 'marketing' },
    { key: 'automation',    path: '/automation',      label: 'Automation',      icon: Bot, group: 'marketing' },
    { key: 'linkedin',      path: '/linkedin',        label: 'LinkedIn',       icon: Linkedin, group: 'marketing' },
    { key: 'settings',      path: '/settings',        label: 'Settings',        icon: SettingsIcon },
    { key: 'my_profile',    path: '/hr',              label: 'My Profile',      icon: UserCircle },
    // Clients Master View / Service and Packages moved under Finance's own
    // tab bar (next to Pipeline) — see ExpenseTab.js — so they're no longer
    // separate top-level nav items.
  ];

  const visible = items.filter((it) => hasAccess(it.key));

  // Apply per-department order from /api/menu-order
  const [deptOrder, setDeptOrder] = useState(null);
  useEffect(() => {
    const token = localStorage.getItem('session_token');
    const loadOrder = async () => {
      try {
        const r = await axios.get(`${API}/api/menu-order`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDeptOrder(r.data?.order || []);
      } catch { setDeptOrder([]); }
    };
    loadOrder();
    const refresh = () => loadOrder();
    window.addEventListener('menu-order-change', refresh);
    return () => window.removeEventListener('menu-order-change', refresh);
  }, []);

  const sortedVisible = useMemo(() => {
    let ordered = visible;
    if (deptOrder && deptOrder.length > 0) {
      const idxMap = new Map(deptOrder.map((k, i) => [k, i]));
      ordered = [...visible].sort((a, b) => {
        const ai = idxMap.has(a.key) ? idxMap.get(a.key) : 999;
        const bi = idxMap.has(b.key) ? idxMap.get(b.key) : 999;
        return ai - bi;
      });
    }
    // Dashboard always leads — it's the landing tab — regardless of any
    // saved per-department order (which may predate this tab's existence).
    const dashboard = ordered.find((it) => it.key === 'dashboard');
    if (dashboard) ordered = [dashboard, ...ordered.filter((it) => it.key !== 'dashboard')];
    return ordered;
  }, [visible, deptOrder]);

  const location = useLocation();
  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors
     ${isActive
       ? 'bg-[#6366f1] text-white'
       : isDark
         ? 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#fafafa]'
         : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`;

  // Items in a `group` (currently just "marketing") render as one hover
  // dropdown instead of flat top-level links — render the dropdown at the
  // position of the first group member encountered, skip the rest.
  const renderedGroups = new Set();

  return (
    <nav
      data-testid="top-nav"
      className={`flex items-center gap-1 px-3 py-2 border-b overflow-x-auto whitespace-nowrap
        ${isDark ? 'bg-[#0c0a09] border-[#27272a]' : 'bg-white border-gray-200'}`}
    >
      {sortedVisible.map((item) => {
        const { key, path, label, icon: Icon, group } = item;

        if (group) {
          if (renderedGroups.has(group)) return null;
          renderedGroups.add(group);
          const groupItems = sortedVisible.filter((it) => it.group === group);
          const isGroupActive = groupItems.some((it) => location.pathname.startsWith(it.path));
          return (
            <div key={`group-${group}`} className="relative group">
              <button
                type="button"
                data-testid={`top-nav-group-${group}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors
                  ${isGroupActive
                    ? 'bg-[#6366f1] text-white'
                    : isDark
                      ? 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#fafafa]'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                <TrendingUp className="h-4 w-4" />
                Marketing
              </button>
              <div
                className={`absolute left-0 top-full z-50 hidden min-w-[180px] rounded-md border py-1 shadow-lg group-hover:block
                  ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}
              >
                {groupItems.map((gi) => (
                  <NavLink
                    key={gi.key}
                    to={gi.path}
                    data-testid={`top-nav-${gi.key}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 text-sm transition-colors
                       ${isActive
                         ? 'bg-[#6366f1] text-white'
                         : isDark
                           ? 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#fafafa]'
                           : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`
                    }
                  >
                    <gi.icon className="h-4 w-4" />
                    {gi.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        }

        return (
          <NavLink key={key} to={path} data-testid={`top-nav-${key}`} className={navLinkClass}>
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
