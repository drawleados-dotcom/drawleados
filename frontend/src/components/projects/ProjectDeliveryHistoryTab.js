import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Eye, X, History } from 'lucide-react';

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

// Every time a project's overdue delivery date is reset (see the "Reset
// Delivery Date" button next to Due Date in Project Details), a row lands
// here — who did it, what the new date was, and why. Available on every
// project regardless of department.
export default function ProjectDeliveryHistoryTab({ project, isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const history = [...(project?.delivery_date_history || [])].sort((a, b) => (b.recorded_at || '').localeCompare(a.recorded_at || ''));
  const [viewing, setViewing] = useState(null);

  return (
    <div className="space-y-3" data-testid="project-delivery-history-tab">
      <div>
        <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
          <History className="h-5 w-5 text-[#6366f1]" /> Delivery Date History
        </h3>
        <p className={`text-xs ${textSecondary}`}>Every time an overdue delivery date was reset, with who did it and why.</p>
      </div>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Date</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Date Set Person</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Delivery Date</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Reason</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-16`}>View</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className={`border-b ${borderColor}`} data-testid={`delivery-history-row-${h.id}`}>
                    <td className={`p-3 text-xs ${textSecondary}`}>{fmtDateTime(h.recorded_at)}</td>
                    <td className={`p-3 text-sm ${textPrimary}`}>{h.set_by_name || '—'}</td>
                    <td className={`p-3 text-sm ${textPrimary}`}>{fmtDate(h.new_due_date)}</td>
                    <td className={`p-3 text-xs ${textSecondary} max-w-[280px] truncate`}>{h.reason || '—'}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setViewing(h)}
                        className={`p-1 ${textSecondary} hover:opacity-80`}
                        title="View"
                        data-testid={`delivery-history-view-${h.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No delivery date resets yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {viewing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={() => setViewing(null)}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-base font-semibold ${textPrimary}`}>Delivery Date Reset</h3>
              <button onClick={() => setViewing(null)} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Recorded</p>
                <p className={`text-sm ${textPrimary}`}>{fmtDateTime(viewing.recorded_at)}</p>
              </div>
              <div>
                <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Set By</p>
                <p className={`text-sm ${textPrimary}`}>{viewing.set_by_name || '—'}</p>
              </div>
              <div>
                <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>New Delivery Date</p>
                <p className={`text-sm ${textPrimary}`}>{fmtDate(viewing.new_due_date)}</p>
              </div>
              <div>
                <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Reason</p>
                <p className={`text-sm ${textPrimary} whitespace-pre-wrap`}>{viewing.reason || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
