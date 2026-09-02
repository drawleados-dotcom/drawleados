import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Sparkles } from 'lucide-react';

const TASK_STATUS_STYLE = {
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  in_progress: 'bg-red-500/20 text-red-400 border-red-500/40',
};
const taskStatusStyle = (status) => TASK_STATUS_STYLE[status || 'pending'] || 'bg-slate-500/20 text-slate-300 border-slate-500/40';

/**
 * Read-only rollup of every task whose Task Type is "Feature" (set from the
 * Pages tab's Add Task popup, stored in the task's existing `category`
 * field) across ALL of this website project's pages and sections — so a
 * feature request logged three levels deep on some page's section still
 * surfaces here without anyone having to go hunt for it.
 */
export default function ProjectFeaturesTab({
  project,
  users,
  bgCard,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const userName = (userId) => (users || []).find(u => u.user_id === userId)?.name || userId || '—';
  const tasks = project?.tasks || [];
  const features = tasks.filter(t => t.category === 'Feature' && t.website_page_id);

  return (
    <div className="space-y-3" data-testid="project-features-tab">
      <div>
        <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
          <Sparkles className="h-5 w-5 text-[#6366f1]" /> Features
        </h3>
        <p className={`text-xs ${textSecondary}`}>
          Every task tagged Task Type "Feature" from the Pages tab, across every page and section.
        </p>
      </div>

      <div className={`${bgCard} border ${borderColor} rounded-lg p-3 w-fit`} data-testid="features-summary-total">
        <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Total Features</p>
        <p className={`text-2xl font-bold mt-0.5 ${textPrimary}`}>{features.length}</p>
      </div>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Page</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Section</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Task</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Deadline</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Assign To</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {features.map((t) => (
                  <tr key={t.task_id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`feature-row-${t.task_id}`}>
                    <td className={`p-3 text-sm font-medium ${textPrimary}`}>{t.website_page_name || '—'}</td>
                    <td className={`p-3 text-xs ${textSecondary}`}>{t.page_section_name || '—'}</td>
                    <td className="p-3">
                      <p className={`text-sm ${textPrimary}`}>{t.task_name}</p>
                      {t.description && <p className={`text-xs ${textSecondary} mt-0.5`}>{t.description}</p>}
                    </td>
                    <td className={`p-3 text-xs ${textSecondary}`}>
                      {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className={`p-3 text-xs ${textSecondary}`}>{userName(t.assigned_to)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase border ${taskStatusStyle(t.status)}`}>
                        {(t.status || 'pending').replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {features.length === 0 && (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No feature tasks yet. Add one from the Pages tab and set its Task Type to "Feature".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
