import React from 'react';
import { Clock, ListChecks, AlertCircle, ShieldCheck, Crown, Calendar } from 'lucide-react';

/**
 * OperationsSummaryCards
 * Renders the 5 KPI cards + date picker that sits above the main Operations tabs.
 * Backend: GET /api/our-tasks/summary/{date}
 */
export default function OperationsSummaryCards({
  summary = {},
  summaryDate,
  onDateChange,
  activeFilter,
  onCardClick,
  textPrimary,
  textSecondary,
  bgCard,
  bgSecondary,
  borderColor,
}) {
  const cards = [
    {
      key: 'worked',
      testid: 'summary-worked-hours',
      label: 'Total Worked Hours',
      sub: 'on selected date',
      value: summary?.worked_hours?.formatted || '0h 0m',
      icon: Clock,
      ring: 'from-emerald-500/30 to-emerald-500/0',
      text: 'text-emerald-500',
    },
    {
      key: 'todo',
      testid: 'summary-total-todo',
      label: 'Total Works To-Do',
      sub: 'open + in progress',
      value: summary?.total_to_do ?? 0,
      icon: ListChecks,
      ring: 'from-indigo-500/30 to-indigo-500/0',
      text: 'text-indigo-500',
    },
    {
      key: 'pending',
      testid: 'summary-pending',
      label: 'Pending',
      sub: 'awaiting start',
      value: summary?.pending ?? 0,
      icon: AlertCircle,
      ring: 'from-amber-500/30 to-amber-500/0',
      text: 'text-amber-500',
    },
    {
      key: 'ops',
      testid: 'summary-awaiting-ops',
      label: 'Awaiting for Ops',
      sub: 'Operations approval',
      value: summary?.awaiting_ops ?? 0,
      icon: ShieldCheck,
      ring: 'from-blue-500/30 to-blue-500/0',
      text: 'text-blue-500',
    },
    {
      key: 'ceo',
      testid: 'summary-awaiting-ceo',
      label: 'Awaiting CEO',
      sub: 'forwarded to CEO',
      value: summary?.awaiting_ceo ?? 0,
      icon: Crown,
      ring: 'from-purple-500/30 to-purple-500/0',
      text: 'text-purple-500',
    },
  ];

  return (
    <div className="space-y-3 mb-6" data-testid="operations-summary">
      <div className="flex items-center gap-2">
        <Calendar className={`h-4 w-4 ${textSecondary}`} />
        <span className={`text-xs ${textSecondary}`}>Summary for</span>
        <input
          type="date"
          value={summaryDate}
          onChange={(e) => onDateChange(e.target.value)}
          className={`text-sm rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} px-2 py-1`}
          data-testid="summary-date-picker"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const isActive =
            (card.key === 'pending' && activeFilter === 'pending') ||
            (card.key !== 'pending' && (activeFilter === 'all' || !activeFilter));
          const ringActive = isActive ? 'ring-2 ring-indigo-500/60' : '';
          return (
            <button
              type="button"
              key={card.key}
              data-testid={card.testid}
              onClick={() => onCardClick && onCardClick(card.key)}
              className={`relative overflow-hidden rounded-xl border ${borderColor} ${bgCard} p-4 text-left transition-transform hover:scale-[1.02] hover:shadow-lg cursor-pointer ${ringActive}`}
            >
              <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${card.ring}`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs uppercase tracking-wide ${textSecondary}`}>{card.label}</p>
                  <Icon className={`h-4 w-4 ${card.text}`} />
                </div>
                <p className={`text-2xl font-bold ${textPrimary}`}>{card.value}</p>
                <p className={`text-[11px] ${textSecondary} mt-0.5`}>{card.sub}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
