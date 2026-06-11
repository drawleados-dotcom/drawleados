import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet,
  Calendar, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import useAutoRefresh from '../../hooks/useAutoRefresh';

const API = process.env.REACT_APP_BACKEND_URL;
const INR = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return '—'; }
};

/**
 * WeekWiseTab
 * Tue → Mon week view of cashbook income vs. expense. Week 01 starts Jan 20, 2026.
 */
export default function WeekWiseTab({ isDark, bgCard, bgSecondary, bgInput, textPrimary, textSecondary, borderColor }) {
  const token = localStorage.getItem('session_token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeWeek, setActiveWeek] = useState(null); // null means current
  const [innerTab, setInnerTab] = useState('income'); // 'income' | 'expense'

  const load = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const params = activeWeek ? `?week_number=${activeWeek}` : '';
      const res = await axios.get(`${API}/api/expense/weekly${params}`, { headers });
      setData(res.data);
    } catch (e) {
      toast.error('Failed to load weekly data');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [activeWeek, headers]);

  useEffect(() => { load(true); }, [load]);
  useAutoRefresh(load);

  const currentWeek = data?.current_week_number || 1;
  const viewedWeek = data?.week_number || 1;

  if (loading && !data) {
    return <div className={`${bgCard} border ${borderColor} rounded-2xl p-12 text-center`}>
      <p className={textSecondary}>Loading week data…</p>
    </div>;
  }

  const income = data?.summary?.income || 0;
  const expense = data?.summary?.expense || 0;
  const net = data?.summary?.net || 0;
  const isPositive = net >= 0;

  return (
    <div className="space-y-4" data-testid="weekwise-tab">
      {/* Navigator */}
      <div className={`${bgCard} border ${borderColor} rounded-2xl p-4`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              disabled={viewedWeek <= 1}
              onClick={() => setActiveWeek(viewedWeek - 1)}
              data-testid="weekwise-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className={`text-2xl font-bold ${textPrimary}`}>{data?.label}</p>
              <p className={`text-xs ${textSecondary}`}>
                {fmtDate(data?.start_date)} → {fmtDate(data?.end_date)}, {new Date(data?.start_date).getFullYear()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={viewedWeek >= currentWeek}
              onClick={() => setActiveWeek(viewedWeek + 1)}
              data-testid="weekwise-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {data?.is_current && (
              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 ml-2">
                <Calendar className="h-3 w-3 mr-1" /> This Week
              </Badge>
            )}
          </div>
          {/* Week dropdown */}
          <select
            className={`text-sm rounded-lg border ${borderColor} ${bgInput || bgSecondary} ${textPrimary} px-3 py-2`}
            value={viewedWeek}
            onChange={(e) => setActiveWeek(Number(e.target.value))}
            data-testid="weekwise-select"
          >
            {(data?.weeks || []).slice().reverse().map((w) => (
              <option key={w.week_number} value={w.week_number}>
                {w.label} ({fmtDate(w.start_date)} – {fmtDate(w.end_date)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          className={`${bgCard} border ${borderColor} rounded-2xl p-5 relative overflow-hidden`}
          data-testid="weekwise-card-income"
        >
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-500/0" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs uppercase tracking-wide ${textSecondary}`}>Income</p>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-500">{INR(income)}</p>
            <p className={`text-[11px] ${textSecondary} mt-1`}>{(data?.income_entries || []).length} entries this week</p>
          </div>
        </div>

        <div
          className={`${bgCard} border ${borderColor} rounded-2xl p-5 relative overflow-hidden`}
          data-testid="weekwise-card-expense"
        >
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-rose-500/30 to-rose-500/0" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs uppercase tracking-wide ${textSecondary}`}>Expense</p>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-3xl font-bold text-rose-500">{INR(expense)}</p>
            <p className={`text-[11px] ${textSecondary} mt-1`}>{(data?.expense_entries || []).length} entries this week</p>
          </div>
        </div>

        <div
          className={`${bgCard} border ${borderColor} rounded-2xl p-5 relative overflow-hidden`}
          data-testid="weekwise-card-net"
        >
          <div className={`absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br ${isPositive ? 'from-blue-500/30' : 'from-amber-500/30'} to-transparent`} />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs uppercase tracking-wide ${textSecondary}`}>Net ({isPositive ? 'Excess' : 'Deficit'})</p>
              <Wallet className={`h-4 w-4 ${isPositive ? 'text-blue-500' : 'text-amber-500'}`} />
            </div>
            <p className={`text-3xl font-bold ${isPositive ? 'text-blue-500' : 'text-amber-500'}`}>
              {isPositive ? '+' : ''}{INR(net)}
            </p>
            <p className={`text-[11px] ${textSecondary} mt-1`}>Income − Expense</p>
          </div>
        </div>
      </div>

      {/* Inner tabs: Income / Expense */}
      <div className="flex gap-2">
        {[
          { id: 'income', label: 'Income', icon: ArrowUpRight, accent: 'text-emerald-500', count: (data?.income_entries || []).length },
          { id: 'expense', label: 'Expense', icon: ArrowDownRight, accent: 'text-rose-500', count: (data?.expense_entries || []).length },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = innerTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setInnerTab(t.id)}
              data-testid={`weekwise-inner-${t.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                isActive
                  ? `bg-[#6366f1] border-[#6366f1] text-white shadow`
                  : `${bgCard} ${borderColor} ${textSecondary} hover:border-[#6366f1]/40`
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : t.accent}`} />
              {t.label}
              <span className={`ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-xs font-semibold px-1.5 ${
                isActive ? 'bg-white/25 text-white' : 'bg-[#6366f1]/15 text-[#6366f1]'
              }`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Entry list */}
      <div className={`${bgCard} border ${borderColor} rounded-2xl overflow-hidden`}>
        {(() => {
          const rows = innerTab === 'income' ? (data?.income_entries || []) : (data?.expense_entries || []);
          if (rows.length === 0) {
            return (
              <div className="text-center p-12">
                <p className={textSecondary}>No {innerTab} entries this week.</p>
              </div>
            );
          }
          return (
            <table className="w-full text-sm">
              <thead className={`${bgSecondary}`}>
                <tr className={`${textSecondary} text-left text-xs uppercase tracking-wide`}>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description / Category</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.entry_id || row.cashbook_id || idx} className={`border-t ${borderColor}`}>
                    <td className={`px-4 py-3 ${textPrimary}`}>{fmtDate(row.date || row.created_at)}</td>
                    <td className={`px-4 py-3 ${textPrimary}`}>
                      {row.description || row.item_name || row.notes || row.category_name || row.title || '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      innerTab === 'income' ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {INR(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()}
      </div>
      {/* Total Week Summary — cumulative Week 01 → current week */}
      {data?.cumulative && (
        <div className="mt-2" data-testid="weekwise-cumulative">
          <div className="flex items-center gap-2 mb-3">
            <div className={`h-px flex-1 bg-gradient-to-r from-transparent via-${isDark ? '[#3f3f46]' : 'gray-300'} to-transparent`} />
            <p className={`text-xs uppercase tracking-widest font-semibold ${textSecondary}`}>
              Total Week Summary (Week {String(data.cumulative.from_week).padStart(2, '0')} → Week {String(data.cumulative.to_week).padStart(2, '0')})
            </p>
            <div className={`h-px flex-1 bg-gradient-to-r from-transparent via-${isDark ? '[#3f3f46]' : 'gray-300'} to-transparent`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              className={`${bgCard} border ${borderColor} rounded-2xl p-5 relative overflow-hidden`}
              data-testid="weekwise-cum-income"
            >
              <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/0" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs uppercase tracking-wide ${textSecondary}`}>Total Income</p>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-3xl font-bold text-emerald-500">{INR(data.cumulative.income)}</p>
                <p className={`text-[11px] ${textSecondary} mt-1`}>across all {data.cumulative.to_week} weeks</p>
              </div>
            </div>
            <div
              className={`${bgCard} border ${borderColor} rounded-2xl p-5 relative overflow-hidden`}
              data-testid="weekwise-cum-expense"
            >
              <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-500/0" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs uppercase tracking-wide ${textSecondary}`}>Total Expense</p>
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                </div>
                <p className="text-3xl font-bold text-rose-500">{INR(data.cumulative.expense)}</p>
                <p className={`text-[11px] ${textSecondary} mt-1`}>across all {data.cumulative.to_week} weeks</p>
              </div>
            </div>
            <div
              className={`${bgCard} border ${borderColor} rounded-2xl p-5 relative overflow-hidden`}
              data-testid="weekwise-cum-net"
            >
              <div className={`absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br ${(data.cumulative.net >= 0) ? 'from-blue-500/20' : 'from-amber-500/20'} to-transparent`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs uppercase tracking-wide ${textSecondary}`}>
                    Excess Net ({(data.cumulative.net >= 0) ? 'Surplus' : 'Deficit'})
                  </p>
                  <Wallet className={`h-4 w-4 ${(data.cumulative.net >= 0) ? 'text-blue-500' : 'text-amber-500'}`} />
                </div>
                <p className={`text-3xl font-bold ${(data.cumulative.net >= 0) ? 'text-blue-500' : 'text-amber-500'}`}>
                  {(data.cumulative.net >= 0) ? '+' : ''}{INR(data.cumulative.net)}
                </p>
                <p className={`text-[11px] ${textSecondary} mt-1`}>Total Income − Total Expense</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
