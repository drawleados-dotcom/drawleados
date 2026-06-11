import React, { useEffect } from 'react';
import { User, Users, Briefcase, Building2, CheckCircle2, Video } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * OperationsTabsBar
 * Renders the 6 main pill tabs inside the Operations page (My Tasks,
 * Assign to Team, Projects, Departments, Approvals, Meetings) with full RBAC:
 *   • Super Admin / Admin always see everything.
 *   • Otherwise visibility is driven by user.designation_config (operations_*).
 *   • Robust fallback: a user with 'operations' in module_access always sees at least My Tasks.
 *   • Operation Head designation gets a reordered tab strip (assign → approvals → my tasks → …).
 *   • Auto-corrects mainTab if the active tab is hidden for this user.
 */
export default function OperationsTabsBar({
  user,
  mainTab,
  setMainTab,
  setMeetingsSubActive,
  setFilter,
  setFilters,
  counts = {},
  bgCard,
  textSecondary,
  hoverBg,
  borderColor,
}) {
  const allTabs = [
    { id: 'assigned_to_me', label: 'My Tasks', icon: User, count: counts.myTasks ?? 0 },
    { id: 'assign_to_team', label: 'Assign to Team', icon: Users, count: counts.assignToTeam ?? 0 },
    { id: 'projects', label: 'Projects', icon: Briefcase, count: counts.projects ?? 0 },
    { id: 'departments', label: 'Departments', icon: Building2, count: counts.departments ?? 0 },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle2, count: counts.approvals ?? 0 },
    { id: 'meetings', label: 'Meetings', icon: Video, count: counts.meetings ?? 0 },
  ];

  const role = (user?.role || '').toLowerCase();
  const isPrivileged = role === 'super_admin' || role === 'admin';
  const userModules = Array.isArray(user?.module_access) ? user.module_access : [];
  const hasOpsModule = userModules.some((m) => String(m).toLowerCase() === 'operations');
  const cfg = user?.designation_config || (hasOpsModule ? { operations_my_tasks: true } : {});

  const isVisible = (id) => {
    if (isPrivileged) return true;
    if (id === 'assigned_to_me') {
      return !!(
        cfg.operations_my_tasks ||
        cfg.operations_assign_to_team ||
        (cfg.operations_projects && cfg.operations_projects !== 'none')
      );
    }
    if (id === 'assign_to_team') return !!cfg.operations_assign_to_team;
    if (id === 'projects') return (cfg.operations_projects || 'none') !== 'none';
    if (id === 'departments') return !!cfg.operations_departments_tab;
    if (id === 'approvals') return !!cfg.operations_approvals_tab;
    if (id === 'meetings') return !!cfg.operations_meetings_tab;
    return false;
  };

  const visibleTabs = allTabs.filter((t) => isVisible(t.id));
  const desg = (user?.designation || '').toLowerCase().trim();
  const isOpHead = desg === 'operation head';
  const tabs = isOpHead
    ? ['assign_to_team', 'approvals', 'assigned_to_me', 'projects', 'departments', 'meetings']
        .map((id) => visibleTabs.find((t) => t.id === id))
        .filter(Boolean)
    : visibleTabs;

  // Auto-correct mainTab if hidden
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find((t) => t.id === mainTab)) {
      setMainTab(tabs[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, mainTab]);

  if (tabs.length === 0) {
    return (
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <div className={`px-4 py-3 text-sm ${textSecondary}`} data-testid="ops-no-access">
          No Operations sub-tabs have been granted to your designation. Contact your admin.
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = mainTab === tab.id;
        return (
          <Button
            key={tab.id}
            onClick={() => {
              setMainTab(tab.id);
              if (setMeetingsSubActive) setMeetingsSubActive(false);
              if (tab.id !== 'approvals' && setFilter) setFilter('all');
              if (setFilters) setFilters((prev) => ({ ...prev, assignedTo: 'all' }));
            }}
            data-testid={`ops-tab-${tab.id.replace(/_/g, '-')}`}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all ${
              isActive
                ? 'bg-[#6366f1] text-white shadow-lg'
                : `${bgCard} ${textSecondary} ${hoverBg} border ${borderColor}`
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
            <span
              className={`ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-xs font-semibold px-1.5 ${
                isActive ? 'bg-white/25 text-white' : 'bg-[#6366f1]/15 text-[#6366f1]'
              }`}
            >
              {tab.count ?? 0}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
