import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Scale, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const API = process.env.REACT_APP_BACKEND_URL;

const fmt = (n) => {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Simple Profit & Loss summary — Income / Expense / net Profit-or-Loss for
 * a date, month, or all-time window. Pulls the same cashbook totals
 * (gst_type=all, so GST + Non-GST combined) that the Cashbook tab shows,
 * so the numbers here never drift from what's recorded there.
 */
export default function PnLTab() {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const bgCard = isDark ? 'bg-white dark:bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-gray-50 dark:bg-[#0c0a09]' : 'bg-gray-50';
  const borderColor = isDark ? 'border-gray-200 dark:border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-gray-900 dark:text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-600 dark:text-[#a1a1aa]' : 'text-gray-500';

  const _now = new Date();
  const [filterAllTime, setFilterAllTime] = useState(true);
  const [filterMonth, setFilterMonth] = useState(_now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(_now.getFullYear());
  const [singleDate, setSingleDate] = useState('');
  const [summary, setSummary] = useState({ income: { total: 0 }, expense: { total: 0 } });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const period = filterAllTime ? '' : `&month=${filterMonth}&year=${filterYear}`;
      const r = await axios.get(`${API}/api/finance/banks/cashbook/entries?gst_type=all${period}`, { headers });
      setSummary(r.data?.summary || { income: { total: 0 }, expense: { total: 0 } });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load P&L');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAllTime, filterMonth, filterYear]);

  useEffect(() => { load(); }, [load]);

  const filterYearOptions = Array.from({ length: 6 }, (_, i) => _now.getFullYear() - 3 + i);
  const gotoMonth = (delta) => {
    setFilterAllTime(false);
    setSingleDate('');
    let m = filterMonth + delta;
    let y = filterYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setFilterMonth(m);
    setFilterYear(y);
  };
  // A specific date picked here just jumps the month/year filter to that
  // date's month — the underlying totals are always a monthly (or all-time)
  // window, there's no day-level P&L breakdown.
  const onPickDate = (value) => {
    setSingleDate(value);
    if (!value) return;
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    setFilterAllTime(false);
    setFilterMonth(d.getMonth() + 1);
    setFilterYear(d.getFullYear());
  };

  const income = summary?.income?.total || 0;
  const expense = summary?.expense?.total || 0;
  const net = income - expense;
  const isProfit = net >= 0;
  const periodLabel = filterAllTime ? 'All Time' : `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`;

  return (
    <div className="space-y-5" data-testid="pnl-tab">
      {/* Date / Month / Year filter — same pattern as Cashbook, so switching
          between the two tabs feels consistent. */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => { setFilterAllTime(true); setSingleDate(''); }}
          className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
            filterAllTime ? 'bg-[#6366f1] border-[#6366f1] text-white' : `${borderColor} ${bgSecondary} ${textSecondary}`
          }`}
          data-testid="pnl-filter-all-time"
        >
          All Time
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => gotoMonth(-1)}
            className={`h-8 w-8 flex items-center justify-center rounded-md border ${borderColor} ${bgSecondary} ${textSecondary} hover:${textPrimary}`}
            data-testid="pnl-filter-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select
            value={filterMonth}
            onChange={(e) => { setFilterAllTime(false); setSingleDate(''); setFilterMonth(Number(e.target.value)); }}
            className={`h-8 px-2 rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
            data-testid="pnl-filter-month"
          >
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={filterYear}
            onChange={(e) => { setFilterAllTime(false); setSingleDate(''); setFilterYear(Number(e.target.value)); }}
            className={`h-8 px-2 rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
            data-testid="pnl-filter-year"
          >
            {filterYearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            type="button"
            onClick={() => gotoMonth(1)}
            className={`h-8 w-8 flex items-center justify-center rounded-md border ${borderColor} ${bgSecondary} ${textSecondary} hover:${textPrimary}`}
            data-testid="pnl-filter-next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <input
          type="date"
          value={singleDate}
          onChange={(e) => onPickDate(e.target.value)}
          className={`h-8 px-2 rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} text-sm`}
          data-testid="pnl-filter-date"
        />
        {loading && <Loader2 className={`h-4 w-4 animate-spin ${textSecondary}`} />}
      </div>

      <div>
        <h2 className={`text-2xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>Profit &amp; Loss</h2>
        <p className={`text-sm ${textSecondary}`}>{periodLabel}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`} data-testid="pnl-income-card">
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-medium ${textSecondary}`}>Income</p>
            <TrendingUp className="h-5 w-5 text-[#10b981]" />
          </div>
          <p className="text-2xl font-bold text-[#10b981]">{fmt(income)}</p>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`} data-testid="pnl-expense-card">
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-medium ${textSecondary}`}>Expense</p>
            <TrendingDown className="h-5 w-5 text-[#ef4444]" />
          </div>
          <p className="text-2xl font-bold text-[#ef4444]">{fmt(expense)}</p>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`} data-testid="pnl-net-card">
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-medium ${textSecondary}`}>{isProfit ? 'Profit' : 'Loss'}</p>
            <Scale className={`h-5 w-5 ${isProfit ? 'text-[#10b981]' : 'text-[#ef4444]'}`} />
          </div>
          <p className={`text-2xl font-bold ${isProfit ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>{fmt(Math.abs(net))}</p>
        </div>
      </div>
    </div>
  );
}
