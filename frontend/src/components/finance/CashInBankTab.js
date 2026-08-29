import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Landmark, X, Loader2, PiggyBank, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useTheme } from '../../contexts/ThemeContext';

const API = process.env.REACT_APP_BACKEND_URL;

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Each bank's current balance, with an optional Closing Balance checkpoint —
 * a manually-verified balance as of a specific date, for when the cashbook
 * doesn't have every historical transaction for that bank captured. Once
 * set, anything recorded on or after that date adjusts it going forward
 * instead of every past entry needing to be exactly right. See
 * `_balance_for` in backend/banks_routes.py for the actual calc.
 */
const CashInBankTab = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const bgCard = isDark ? 'bg-white dark:bg-[#18181b]' : 'bg-white';
  const bgInput = isDark ? 'bg-gray-50 dark:bg-[#0c0a09]' : 'bg-gray-50';
  const borderColor = isDark ? 'border-gray-200 dark:border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-gray-900 dark:text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-600 dark:text-[#a1a1aa]' : 'text-gray-500';

  const [viewMode, setViewMode] = useState('all'); // 'all' | 'gst' | 'non_gst' | 'closing_balance'
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  // { bankId, label, date, amount } | null
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = (viewMode === 'gst' || viewMode === 'non_gst') ? `?gst_type=${viewMode}` : '';
      const r = await axios.get(`${API}/api/finance/banks/closing-balances${params}`, { headers });
      setBanks(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load banks');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  useEffect(() => { load(); }, [load]);

  const totalBalance = banks.reduce((sum, b) => sum + (b.current_balance || 0), 0);

  const openModal = (bank) => setModal({
    bankId: bank.bank_id,
    label: bank.label,
    date: bank.closing_balance_date || new Date().toISOString().slice(0, 10),
    amount: bank.closing_balance_amount != null ? String(bank.closing_balance_amount) : '',
  });
  const closeModal = () => setModal(null);

  const saveClosingBalance = async () => {
    if (!modal.date) { toast.error('Date is required'); return; }
    const amount = parseFloat(modal.amount);
    if (Number.isNaN(amount)) { toast.error('Enter a valid amount'); return; }
    try {
      await axios.put(`${API}/api/finance/banks/${modal.bankId}/closing-balance`, { date: modal.date, amount }, { headers });
      toast.success('Closing balance saved');
      closeModal();
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save closing balance');
    }
  };

  const pills = [
    { key: 'all', label: 'All' },
    { key: 'gst', label: 'GST' },
    { key: 'non_gst', label: 'Non-GST' },
    { key: 'closing_balance', label: 'Closing Balance' },
  ];

  return (
    <div className="space-y-4" data-testid="finance-cash-in-bank-tab">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-2xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Cash in Bank
          </h2>
          <p className={`text-sm ${textSecondary}`}>
            {viewMode === 'closing_balance'
              ? "Set each bank's Closing Balance — a verified balance as of a date. Anything recorded on or after that date adjusts it going forward, instead of every past entry needing to be captured."
              : "Each bank's current balance, honoring its Closing Balance checkpoint if one is set."}
          </p>
        </div>
        {viewMode !== 'closing_balance' && (
          <div className={`${bgCard} border ${borderColor} rounded-lg px-4 py-2 text-right`}>
            <div className={`text-xs ${textSecondary}`}>Total</div>
            <div className={`text-lg font-bold ${textPrimary}`}>{fmtMoney(totalBalance)}</div>
          </div>
        )}
      </div>

      <div className={`flex items-center gap-1 border-b ${borderColor}`}>
        {pills.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setViewMode(p.key)}
            data-testid={`cash-in-bank-pill-${p.key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              viewMode === p.key ? 'border-[#6366f1] text-[#6366f1]' : `border-transparent ${textSecondary}`
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" /></div>
      ) : banks.length === 0 ? (
        <div className={`${bgCard} border ${borderColor} rounded-lg p-10 text-center ${textSecondary}`}>
          <Landmark className="h-10 w-10 mx-auto mb-2 opacity-40" />
          No bank accounts yet — add one from Cashbook &gt; Banks.
        </div>
      ) : (
        <div className={`${bgCard} border ${borderColor} rounded-lg overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className={`${bgInput} ${textSecondary} text-xs uppercase`}>
              <tr>
                <th className="text-left px-4 py-3">Bank</th>
                <th className="text-left px-4 py-3">GST Type</th>
                {viewMode === 'closing_balance' ? (
                  <>
                    <th className="text-left px-4 py-3">Closing Balance Date</th>
                    <th className="text-right px-4 py-3">Closing Balance Amount</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </>
                ) : (
                  <th className="text-right px-4 py-3">Balance</th>
                )}
              </tr>
            </thead>
            <tbody>
              {banks.map((b) => (
                <tr key={b.bank_id} className={`border-t ${borderColor}`} data-testid={`cash-in-bank-row-${b.bank_id}`}>
                  <td className="px-4 py-3">
                    <div className={`font-medium ${textPrimary}`}>{b.label}</div>
                    {b.bank_name && <div className={`text-xs ${textSecondary}`}>{b.bank_name}</div>}
                  </td>
                  <td className={`px-4 py-3 ${textSecondary} uppercase text-xs`}>{b.gst_type === 'non_gst' ? 'Non-GST' : 'GST'}</td>
                  {viewMode === 'closing_balance' ? (
                    <>
                      <td className={`px-4 py-3 ${textSecondary}`}>{b.closing_balance_date || '—'}</td>
                      <td className={`px-4 py-3 text-right ${textPrimary}`}>
                        {b.closing_balance_amount != null ? fmtMoney(b.closing_balance_amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => openModal(b)} data-testid={`cash-in-bank-add-closing-${b.bank_id}`}>
                          <PiggyBank className="h-3.5 w-3.5 mr-1.5" />
                          {b.closing_balance_date ? 'Edit' : 'Add'} Closing Balance
                        </Button>
                      </td>
                    </>
                  ) : (
                    <td className={`px-4 py-3 text-right font-semibold ${(b.current_balance || 0) < 0 ? 'text-red-500' : textPrimary}`}>
                      {fmtMoney(b.current_balance)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className={`${bgCard} border ${borderColor} rounded-xl w-full max-w-sm p-5 space-y-4`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className={`text-base font-semibold ${textPrimary}`}>Closing Balance — {modal.label}</h3>
              <button onClick={closeModal} className={textSecondary}><X className="h-5 w-5" /></button>
            </div>
            <p className={`text-xs ${textSecondary}`}>
              The verified balance for this bank as of the date below. Income/expense recorded on or after this date adjusts it going forward.
            </p>
            <div>
              <Label className={textPrimary}>Date</Label>
              <Input
                type="date"
                value={modal.date}
                onChange={(e) => setModal(m => ({ ...m, date: e.target.value }))}
                className={`${bgInput} ${borderColor} ${textPrimary}`}
                data-testid="cash-in-bank-closing-date"
              />
            </div>
            <div>
              <Label className={textPrimary}>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={modal.amount}
                onChange={(e) => setModal(m => ({ ...m, amount: e.target.value }))}
                placeholder="0.00"
                className={`${bgInput} ${borderColor} ${textPrimary}`}
                data-testid="cash-in-bank-closing-amount"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={closeModal} className={textSecondary}>Cancel</Button>
              <Button onClick={saveClosingBalance} className="bg-[#10b981] hover:bg-[#059669] text-white gap-2" data-testid="cash-in-bank-closing-save">
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashInBankTab;
