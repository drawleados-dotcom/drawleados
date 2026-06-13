import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Building2, Save, X, Loader2, CreditCard, Hash, MapPin, Smartphone, IndianRupee } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useTheme } from '../../contexts/ThemeContext';

const API = process.env.REACT_APP_BACKEND_URL;

const EMPTY_FORM = {
  account_holder: '',
  bank_name: '',
  ifsc_code: '',
  account_number: '',
  branch: '',
  upi: '',
  account_type: 'savings',
};

const BanksTab = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Theme tokens
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgInput = isDark ? 'bg-[#0c0a09]' : 'bg-gray-50';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [activeSubtab, setActiveSubtab] = useState('gst'); // 'gst' | 'non_gst'
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // bank_id when editing, null when adding
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/finance/banks?gst_type=${activeSubtab}`, { headers });
      setBanks(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load banks');
    } finally {
      setLoading(false);
    }
  }, [activeSubtab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(false);
  };

  const openEdit = (bank) => {
    setEditing(bank.bank_id);
    setForm({
      account_holder: bank.account_holder || '',
      bank_name: bank.bank_name || '',
      ifsc_code: bank.ifsc_code || '',
      account_number: bank.account_number || '',
      branch: bank.branch || '',
      upi: bank.upi || '',
      account_type: bank.account_type || 'savings',
    });
    setShowForm(true);
  };

  const submit = async () => {
    if (!form.account_holder.trim()) { toast.error('Account holder name is required'); return; }
    try {
      const payload = { ...form, gst_type: activeSubtab };
      if (editing) {
        await axios.put(`${API}/api/finance/banks/${editing}`, payload, { headers });
        toast.success('Bank updated');
      } else {
        await axios.post(`${API}/api/finance/banks`, payload, { headers });
        toast.success('Bank added');
      }
      resetForm();
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    }
  };

  const deleteBank = async (bank) => {
    if (!window.confirm(`Remove ${bank.account_holder}?`)) return;
    try {
      await axios.delete(`${API}/api/finance/banks/${bank.bank_id}`, { headers });
      toast.success('Bank removed');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Delete failed');
    }
  };

  const subtabs = [
    { key: 'gst', label: 'GST Accounts' },
    { key: 'non_gst', label: 'Non-GST Accounts' },
  ];

  return (
    <div className="space-y-4" data-testid="finance-banks-tab">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-2xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Bank Accounts
          </h2>
          <p className={`text-sm ${textSecondary}`}>Manage bank accounts used to collect invoice payments.</p>
        </div>
        <Button
          onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }}
          className="bg-[#6366f1] hover:bg-[#4f46e5] text-white gap-2"
          data-testid="add-bank-btn"
        >
          <Plus className="h-4 w-4" /> Add Bank
        </Button>
      </div>

      {/* GST / Non-GST switch */}
      <div className={`flex items-center gap-1 border-b ${borderColor}`}>
        {subtabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setActiveSubtab(t.key); resetForm(); }}
            data-testid={`bank-subtab-${t.key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeSubtab === t.key
                ? 'border-[#6366f1] text-[#6366f1]'
                : `border-transparent ${textSecondary} hover:${textPrimary}`
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className={`${bgCard} border ${borderColor} rounded-lg p-5 space-y-4`} data-testid="bank-form">
          <div className="flex items-center justify-between">
            <h3 className={`text-base font-semibold ${textPrimary}`}>
              {editing ? 'Edit' : 'Add'} {activeSubtab === 'gst' ? 'GST' : 'Non-GST'} Bank
            </h3>
            <button onClick={resetForm} className={`${textSecondary} hover:${textPrimary}`}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className={textPrimary}>Account Holder *</Label>
              <Input
                value={form.account_holder}
                onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
                placeholder={activeSubtab === 'gst' ? 'Drawlead Pvt Ltd' : 'Latha Babu'}
                className={`${bgInput} ${borderColor} ${textPrimary}`}
                data-testid="bank-account-holder-input"
              />
            </div>
            <div>
              <Label className={textPrimary}>Name of the Bank</Label>
              <Input
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                placeholder="HDFC / ICICI / SBI"
                className={`${bgInput} ${borderColor} ${textPrimary}`}
              />
            </div>
            <div>
              <Label className={textPrimary}>IFSC Code</Label>
              <Input
                value={form.ifsc_code}
                onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })}
                placeholder="HDFC0001234"
                className={`${bgInput} ${borderColor} ${textPrimary} font-mono`}
              />
            </div>
            <div>
              <Label className={textPrimary}>Account Number</Label>
              <Input
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                placeholder="50100123456789"
                className={`${bgInput} ${borderColor} ${textPrimary} font-mono`}
              />
            </div>
            <div>
              <Label className={textPrimary}>Branch</Label>
              <Input
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                placeholder="Anna Nagar"
                className={`${bgInput} ${borderColor} ${textPrimary}`}
              />
            </div>
            <div>
              <Label className={textPrimary}>UPI ID</Label>
              <Input
                value={form.upi}
                onChange={(e) => setForm({ ...form, upi: e.target.value })}
                placeholder="drawlead@hdfcbank"
                className={`${bgInput} ${borderColor} ${textPrimary}`}
              />
            </div>
            <div>
              <Label className={textPrimary}>Account Type</Label>
              <select
                value={form.account_type}
                onChange={(e) => setForm({ ...form, account_type: e.target.value })}
                className={`w-full h-10 px-3 rounded-md border ${borderColor} ${bgInput} ${textPrimary} text-sm`}
                data-testid="bank-account-type-select"
              >
                <option value="savings">Savings</option>
                <option value="current">Current</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={resetForm} className={textSecondary}>Cancel</Button>
            <Button onClick={submit} className="bg-[#10b981] hover:bg-[#059669] text-white gap-2" data-testid="bank-save-btn">
              <Save className="h-4 w-4" /> {editing ? 'Update' : 'Save'} Bank
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" /></div>
      ) : banks.length === 0 ? (
        <div className={`${bgCard} border ${borderColor} rounded-lg p-10 text-center ${textSecondary}`}>
          <Building2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
          No {activeSubtab === 'gst' ? 'GST' : 'Non-GST'} bank accounts yet — click <b>Add Bank</b> to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {banks.map((b) => (
            <div
              key={b.bank_id}
              className={`${bgCard} border ${borderColor} rounded-lg p-4 hover:border-[#6366f1] transition-colors`}
              data-testid={`bank-card-${b.bank_id}`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className={`text-base font-semibold ${textPrimary} truncate`}>{b.account_holder}</div>
                  <div className={`text-sm ${textSecondary} truncate`}>
                    {b.bank_name || '—'} • <span className="capitalize">{b.account_type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(b)} className={`p-1.5 rounded hover:bg-[#6366f1]/10 ${textSecondary} hover:text-[#6366f1]`} data-testid={`edit-bank-${b.bank_id}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteBank(b)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400" data-testid={`delete-bank-${b.bank_id}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                {b.account_number && (
                  <div className={`flex items-center gap-2 ${textSecondary}`}>
                    <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-mono">{b.account_number}</span>
                  </div>
                )}
                {b.ifsc_code && (
                  <div className={`flex items-center gap-2 ${textSecondary}`}>
                    <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-mono">{b.ifsc_code}</span>
                  </div>
                )}
                {b.branch && (
                  <div className={`flex items-center gap-2 ${textSecondary}`}>
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{b.branch}</span>
                  </div>
                )}
                {b.upi && (
                  <div className={`flex items-center gap-2 ${textSecondary}`}>
                    <Smartphone className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-mono">{b.upi}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BanksTab;
