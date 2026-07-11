import React from 'react';
import { Card, CardContent } from '../ui/card';
import { FolderOpen } from 'lucide-react';

const STATUS_STYLE = {
  pending: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  on_hold: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
};

// Website-project tasks that aren't tagged to a specific Page — the sibling
// tab next to Pages for work that doesn't belong under any single page.
export default function ProjectOthersTab({ project, isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const tasks = (project?.tasks || []).filter(
    t => t.department === 'website' && (!t.website_page_id || t.website_page_id === 'others')
  );

  return (
    <div className="space-y-3" data-testid="project-others-tab">
      <div>
        <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
          <FolderOpen className="h-5 w-5 text-[#6366f1]" /> Others
        </h3>
        <p className={`text-xs ${textSecondary}`}>Website tasks not tied to a specific page.</p>
      </div>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase w-12`}>S.No</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Task</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Category</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, idx) => (
                  <tr key={t.task_id} className={`border-b ${borderColor}`} data-testid={`other-task-row-${t.task_id}`}>
                    <td className={`p-3 text-xs ${textSecondary}`}>{idx + 1}</td>
                    <td className={`p-3 text-sm font-medium ${textPrimary}`}>{t.task_name}</td>
                    <td className={`p-3 text-xs ${textSecondary}`}>{t.category || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_STYLE[t.status] || STATUS_STYLE.pending}`}>
                        {(t.status || 'pending').replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={4} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No tasks outside a specific page yet.
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
