import React from 'react';
import { ListChecks, Pencil, Trash2 } from 'lucide-react';

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/** Toggle badge showing a level's task count — click to expand its ErpTaskList below. */
export function ErpTaskCountBadge({ count, active, onClick, textSecondary, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 p-1 text-xs ${active ? 'text-[#6366f1]' : textSecondary} hover:opacity-80`}
      title="Tasks"
      data-testid={testId}
    >
      <ListChecks className="h-4 w-4" /> {count}
    </button>
  );
}

/**
 * Task table for one exact level of the ERP Users hierarchy (a Page, Sub
 * Tab, Ultra Sub Tab, or Ultra Tab) — shown when that level's task-count
 * badge is expanded. Edit opens the shared quick task popup (which can also
 * move the task to a different user/page/sub-tab); Delete removes it outright.
 */
export default function ErpTaskList({
  tasks, onEdit, onDelete, assigneeName,
  textPrimary, textSecondary, borderColor, bgCard, testPrefix,
}) {
  if (tasks.length === 0) {
    return <p className={`p-3 text-xs ${textSecondary}`}>No tasks tagged here yet.</p>;
  }
  return (
    <div className={`overflow-x-auto rounded-md border ${borderColor} ${bgCard}`}>
      <table className="w-full">
        <thead>
          <tr className={`border-b ${borderColor}`}>
            <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Name of the Task</th>
            <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Category</th>
            <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Date</th>
            <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Assign To</th>
            <th className={`text-left px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase`}>Status</th>
            <th className={`text-right px-3 py-2 text-[10px] font-medium ${textSecondary} uppercase w-20`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t.task_id} className={`border-b ${borderColor} last:border-b-0`} data-testid={testPrefix ? `${testPrefix}-${t.task_id}` : undefined}>
              <td className={`px-3 py-2 text-sm ${textPrimary}`}>{t.task_name}</td>
              <td className={`px-3 py-2 text-xs ${textSecondary}`}>{t.category || '—'}</td>
              <td className={`px-3 py-2 text-xs ${textSecondary}`}>{fmtDate(t.due_date)}</td>
              <td className={`px-3 py-2 text-xs ${textSecondary}`}>{assigneeName(t.assigned_to)}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${textSecondary} border ${borderColor}`}>
                  {(t.status || 'pending').replace('_', ' ')}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <div className="inline-flex gap-1">
                  <button type="button" onClick={() => onEdit(t)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit / move" data-testid={`${testPrefix}-edit-${t.task_id}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => onDelete(t)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`${testPrefix}-delete-${t.task_id}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
