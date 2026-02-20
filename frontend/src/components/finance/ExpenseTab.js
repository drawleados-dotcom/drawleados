import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings,
  ChevronDown,
  ChevronRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  X,
  Calendar,
  RefreshCw,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Category colors matching the user's spreadsheet
const CATEGORY_COLORS = {
  'Salary': '#ef4444',
  'Pay Roll': '#ef4444',
  'Office Exp': '#f97316',
  'CEO': '#3b82f6',
  'Vendor Payments': '#22c55e',
  'Vendor': '#22c55e',
  'Loans & Debts': '#8b5cf6',
  'Tools & Subscriptions': '#06b6d4',
  'BNI': '#ec4899',
  'Tax & Auditing': '#84cc16',
  'Mentorship': '#f59e0b',
  'Events & Networking': '#14b8a6',
  'Courses & Books': '#a855f7',
  'Marketing & Branding': '#6366f1',
};

const ExpenseTab = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');

  // State
  const [view, setView] = useState('cashbook'); // 'cashbook' | 'master' | 'category-detail'
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cashbookData, setCashbookData] = useState(null);
  const [masterData, setMasterData] = useState(null);
  const [categoryDetail, setCategoryDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Fiscal year state
  const [fiscalYear, setFiscalYear] = useState(() => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${String(year + 1).slice(2)}`;
  });
  const [fiscalQuarter, setFiscalQuarter] = useState(null);
  
  // Cashbook month/year filter
  const [cashbookMonth, setCashbookMonth] = useState(new Date().getMonth() + 1);
  const [cashbookYear, setCashbookYear] = useState(new Date().getFullYear());
  
  // Modal states
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [entryType, setEntryType] = useState('debit'); // 'credit' | 'debit'
  
  // Form states
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    tax_percent: 0,
    income_from: '',
    expense_to: '',
    payment_type: '',
    payment_cycle: '',
    invoice_type: '',
    invoice_number: '',
    category_id: '',
    remarks: '',
  });

  // Generate fiscal year options
  const fiscalYearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    fiscalYearOptions.push(`${y}-${String(y + 1).slice(2)}`);
  }

  // Load accounts
  const loadAccounts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/expense/bank-accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccounts(res.data || []);
      if (res.data.length > 0 && !selectedAccount) {
        setSelectedAccount(res.data[0]);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }, [token, selectedAccount]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/expense/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(res.data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, [token]);

  // Load cashflow view
  const loadCashbook = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const now = new Date();
      const res = await axios.get(`${API}/api/expense/cashflow`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month: now.getMonth() + 1, year: now.getFullYear() }
      });
      setCashbookData(res.data);
    } catch (error) {
      console.error('Error loading cashbook:', error);
      toast.error('Failed to load cashbook data');
    } finally {
      setLoading(false);
    }
  }, [token, selectedAccount]);

  // Load master expense view
  const loadMasterExpense = useCallback(async () => {
    setLoading(true);
    try {
      const fyYear = parseInt(fiscalYear.split('-')[0]);
      const res = await axios.get(`${API}/api/expense/master-view`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { fy_year: fyYear }
      });
      setMasterData(res.data);
    } catch (error) {
      console.error('Error loading master expense:', error);
      toast.error('Failed to load master expense data');
    } finally {
      setLoading(false);
    }
  }, [token, fiscalYear]);

  // Initialize data
  const initializeData = async () => {
    try {
      await axios.post(`${API}/api/expense/initialize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Expense data initialized');
      loadAccounts();
      loadCategories();
    } catch (error) {
      console.error('Error initializing:', error);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadAccounts();
    loadCategories();
  }, [loadAccounts, loadCategories]);

  // Load view-specific data
  useEffect(() => {
    if (view === 'cashbook' && selectedAccount) {
      loadCashbook();
    } else if (view === 'master') {
      loadMasterExpense();
    }
  }, [view, selectedAccount, loadCashbook, loadMasterExpense]);

  // Add new entry
  const handleAddEntry = async () => {
    try {
      const endpoint = entryType === 'credit' ? '/api/expense/income' : '/api/expense/payments';
      const payload = entryType === 'credit' ? {
        source: newEntry.income_from,
        description: newEntry.remarks,
        amount: parseFloat(newEntry.amount),
        invoice_number: newEntry.invoice_number,
        payment_type: newEntry.payment_type,
        payment_cycle: newEntry.payment_cycle,
        date: newEntry.date,
        bank_account_id: selectedAccount?.account_id,
        tax_amount: (parseFloat(newEntry.amount) * newEntry.tax_percent / 100) || 0,
      } : {
        entry_id: newEntry.category_id, // Using category as entry for now
        amount: parseFloat(newEntry.amount),
        payment_date: newEntry.date,
        bank_account_id: selectedAccount?.account_id,
        notes: newEntry.remarks,
        tax_amount: (parseFloat(newEntry.amount) * newEntry.tax_percent / 100) || 0,
      };

      await axios.post(`${API}${endpoint}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`${entryType === 'credit' ? 'Income' : 'Expense'} recorded successfully`);
      setShowAddEntry(false);
      setNewEntry({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        tax_percent: 0,
        income_from: '',
        expense_to: '',
        payment_type: '',
        payment_cycle: '',
        invoice_type: '',
        invoice_number: '',
        category_id: '',
        remarks: '',
      });
      loadCashbook();
      loadAccounts();
    } catch (error) {
      console.error('Error adding entry:', error);
      toast.error('Failed to add entry');
    }
  };

  // Add new account
  const handleAddAccount = async (accountData) => {
    try {
      await axios.post(`${API}/api/expense/bank-accounts`, accountData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Account created');
      setShowAddAccount(false);
      loadAccounts();
    } catch (error) {
      toast.error('Failed to create account');
    }
  };

  // Add new category
  const handleAddCategory = async (categoryData) => {
    try {
      await axios.post(`${API}/api/expense/categories`, categoryData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Category created');
      setShowAddCategory(false);
      loadCategories();
    } catch (error) {
      toast.error('Failed to create category');
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Render account tabs
  const renderAccountTabs = () => (
    <div className={`flex gap-1 p-1 rounded-lg ${isDark ? 'bg-[#18181b]' : 'bg-gray-100'} overflow-x-auto`}>
      {accounts.map((acc) => (
        <button
          key={acc.account_id}
          onClick={() => setSelectedAccount(acc)}
          className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-all ${
            selectedAccount?.account_id === acc.account_id
              ? 'bg-[#22c55e] text-white'
              : isDark
              ? 'text-[#a1a1aa] hover:bg-[#27272a]'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
          data-testid={`account-tab-${acc.account_id}`}
        >
          {acc.name}
        </button>
      ))}
      <button
        onClick={() => setShowAddAccount(true)}
        className={`px-3 py-2 text-sm font-medium rounded-md transition-all ${
          isDark ? 'text-[#6366f1] hover:bg-[#27272a]' : 'text-[#6366f1] hover:bg-gray-200'
        }`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );

  // Render cashbook view (split Credit/Debit)
  const renderCashbookView = () => {
    if (!cashbookData) return null;

    const balance = selectedAccount?.current_balance || 0;

    return (
      <div className="space-y-4">
        {/* Account Balance Header */}
        <div className={`p-4 rounded-lg ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Amount in Account</p>
              <p className={`text-2xl font-bold ${balance >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {formatCurrency(balance)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => { setEntryType('credit'); setShowAddEntry(true); }}
                className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                data-testid="add-credit-btn"
              >
                <ArrowDownCircle className="h-4 w-4 mr-2" />
                Add Credit
              </Button>
              <Button
                onClick={() => { setEntryType('debit'); setShowAddEntry(true); }}
                className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
                data-testid="add-debit-btn"
              >
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Add Debit
              </Button>
            </div>
          </div>
        </div>

        {/* Split View: Credit | Debit */}
        <div className="grid grid-cols-2 gap-4">
          {/* Credit/Inward Section */}
          <div className={`rounded-lg overflow-hidden ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
            <div className="bg-[#22c55e] text-white p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Credit/Inward</h3>
                <span className="text-lg font-bold">{formatCurrency(cashbookData.credit?.total || 0)}</span>
              </div>
            </div>
            
            {/* Credit Table */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className={`sticky top-0 ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Sno</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Income From</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 text-right font-medium">Tax</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(cashbookData.credit?.entries || []).map((entry, idx) => (
                    <tr
                      key={entry.income_id || idx}
                      className={`border-b ${isDark ? 'border-[#27272a] hover:bg-[#27272a]/50' : 'border-gray-100 hover:bg-gray-50'}`}
                    >
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2">{entry.date}</td>
                      <td className="px-3 py-2 font-medium">{entry.source}</td>
                      <td className="px-3 py-2">
                        <Badge className="bg-[#22c55e]/20 text-[#22c55e] text-xs">
                          {entry.payment_type || 'Payment'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(entry.amount)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(entry.tax_amount || 0)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(entry.amount + (entry.tax_amount || 0))}</td>
                    </tr>
                  ))}
                  {(!cashbookData.credit?.entries || cashbookData.credit.entries.length === 0) && (
                    <tr>
                      <td colSpan={7} className={`px-3 py-8 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>
                        No credit entries this month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Debit/Outward Section */}
          <div className={`rounded-lg overflow-hidden ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
            <div className="bg-[#ef4444] text-white p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Debit/Outward</h3>
                <span className="text-lg font-bold">{formatCurrency(cashbookData.debit?.total || 0)}</span>
              </div>
            </div>
            
            {/* Debit Table */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className={`sticky top-0 ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Sno</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Expense To</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 text-right font-medium">Tax</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-left font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {(cashbookData.debit?.entries || []).map((entry, idx) => (
                    <tr
                      key={entry.payment_id || idx}
                      className={`border-b ${isDark ? 'border-[#27272a] hover:bg-[#27272a]/50' : 'border-gray-100 hover:bg-gray-50'}`}
                    >
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2">{entry.payment_date}</td>
                      <td className="px-3 py-2 font-medium">{entry.entry_name || 'Expense'}</td>
                      <td className="px-3 py-2">
                        <Badge
                          style={{ backgroundColor: `${CATEGORY_COLORS[entry.category_name] || '#6366f1'}20`, color: CATEGORY_COLORS[entry.category_name] || '#6366f1' }}
                          className="text-xs"
                        >
                          {entry.category_name || 'General'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(entry.amount)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(entry.tax_amount || 0)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(entry.amount + (entry.tax_amount || 0))}</td>
                      <td className="px-3 py-2 text-xs truncate max-w-[150px]">{entry.notes}</td>
                    </tr>
                  ))}
                  {(!cashbookData.debit?.entries || cashbookData.debit.entries.length === 0) && (
                    <tr>
                      <td colSpan={8} className={`px-3 py-8 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>
                        No debit entries this month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render master expense view
  const renderMasterExpenseView = () => {
    if (!masterData) return null;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className={`p-4 rounded-lg ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Master Expense Board</h3>
              <p className={`text-sm ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>
                {masterData.fy_year} {fiscalQuarter ? `(Q${fiscalQuarter})` : ''}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Select value={fiscalYear} onValueChange={setFiscalYear}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Fiscal Year" />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYearOptions.map((fy) => (
                    <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fiscalQuarter?.toString() || 'all'} onValueChange={(v) => setFiscalQuarter(v === 'all' ? null : parseInt(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="1">Q1 (Apr-Jun)</SelectItem>
                  <SelectItem value="2">Q2 (Jul-Sep)</SelectItem>
                  <SelectItem value="3">Q3 (Oct-Dec)</SelectItem>
                  <SelectItem value="4">Q4 (Jan-Mar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Master Expense Table */}
        <div className={`rounded-lg overflow-hidden ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          {/* Green Header */}
          <div className="bg-[#22c55e] text-white">
            <div className="grid grid-cols-[200px_repeat(4,1fr)] text-sm">
              <div className="p-3 font-semibold">Master Expense</div>
              <div className="p-3 text-center font-semibold col-span-4">
                Financial Year {masterData.fy_year?.replace('FY ', '')}
              </div>
            </div>
          </div>

          {/* Sub-header */}
          <div className={`grid grid-cols-[200px_repeat(4,1fr)] text-xs ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
            <div className="p-2">
              <div className="font-medium">Type of Expense</div>
              <div className="grid grid-cols-3 gap-1 mt-1 text-[10px]">
                <span>Total</span>
                <span>Paid</span>
                <span>Balance</span>
              </div>
            </div>
            {(masterData.months || []).slice(0, 4).map((m) => (
              <div key={m.label} className="p-2 text-center border-l border-[#3f3f46]">
                <div className="font-medium">{m.label}</div>
                <div className="grid grid-cols-3 gap-1 mt-1 text-[10px]">
                  <span>Total</span>
                  <span>Paid</span>
                  <span>Balance</span>
                </div>
              </div>
            ))}
          </div>

          {/* Category Rows */}
          <div className="overflow-x-auto max-h-[400px]">
            {(masterData.categories || []).map((cat, idx) => (
              <div
                key={cat.category_id}
                onClick={() => {
                  setSelectedCategory(cat);
                  setView('category-detail');
                }}
                className={`grid grid-cols-[200px_repeat(4,1fr)] text-sm cursor-pointer border-b transition-colors ${
                  isDark
                    ? 'border-[#27272a] hover:bg-[#27272a]/50'
                    : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className="p-3 flex items-center gap-2">
                  <span className="font-medium">{idx + 1}. {cat.name}</span>
                  <ChevronRight className="h-4 w-4 opacity-50" />
                </div>
                {(masterData.months || []).slice(0, 4).map((m) => {
                  const monthData = cat.months?.[m.label] || { total: 0, paid: 0, balance: 0 };
                  return (
                    <div key={m.label} className="p-3 grid grid-cols-3 gap-1 text-xs border-l border-[#3f3f46]/30">
                      <span>{monthData.total.toFixed(2)}</span>
                      <span>{monthData.paid.toFixed(2)}</span>
                      <span className={monthData.balance > 0 ? 'text-[#ef4444]' : ''}>{monthData.balance.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Grand Total Row */}
          <div className={`grid grid-cols-[200px_repeat(4,1fr)] text-sm font-bold ${isDark ? 'bg-[#0c0a09]' : 'bg-gray-900 text-white'}`}>
            <div className="p-3">Grand Total</div>
            <div className="p-3 col-span-4 grid grid-cols-3 gap-2">
              <span>{formatCurrency(masterData.grand_total?.total || 0)}</span>
              <span>{formatCurrency(masterData.grand_total?.paid || 0)}</span>
              <span className="text-[#ef4444]">{formatCurrency(masterData.grand_total?.balance || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render category detail view
  const renderCategoryDetailView = () => {
    if (!selectedCategory) return null;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className={`p-4 rounded-lg ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('master')}
                className="p-2"
              >
                <ChevronDown className="h-4 w-4 rotate-90" />
              </Button>
              <div>
                <h3 className="text-lg font-semibold">{selectedCategory.name}</h3>
                <p className={`text-sm ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>
                  Category Detail - {masterData?.fy_year}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowAddCategory(true)}
              className="bg-[#6366f1] hover:bg-[#5855e0] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Sub-Item
            </Button>
          </div>
        </div>

        {/* Detail Table (placeholder - will show entries under this category) */}
        <div className={`rounded-lg overflow-hidden ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <div className="bg-[#22c55e] text-white p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{selectedCategory.name}</h3>
              <span className="text-lg font-bold">
                {formatCurrency(selectedCategory.grand_total || 0)}
              </span>
            </div>
          </div>

          <div className="p-8 text-center">
            <FileText className={`h-12 w-12 mx-auto mb-4 ${isDark ? 'text-[#3f3f46]' : 'text-gray-300'}`} />
            <p className={`${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>
              Click "Add Sub-Item" to add entries under this category
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="expense-tab">
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className={`flex gap-1 p-1 rounded-lg ${isDark ? 'bg-[#18181b]' : 'bg-gray-100'}`}>
          <button
            onClick={() => setView('cashbook')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              view === 'cashbook'
                ? 'bg-[#6366f1] text-white'
                : isDark
                ? 'text-[#a1a1aa] hover:bg-[#27272a]'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
            data-testid="view-cashbook"
          >
            <Wallet className="h-4 w-4 inline mr-2" />
            CashBook
          </button>
          <button
            onClick={() => setView('master')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              view === 'master'
                ? 'bg-[#6366f1] text-white'
                : isDark
                ? 'text-[#a1a1aa] hover:bg-[#27272a]'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
            data-testid="view-master"
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Master Expense
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={initializeData}
            className={isDark ? 'border-[#27272a]' : ''}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Initialize Data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddCategory(true)}
            className={isDark ? 'border-[#27272a]' : ''}
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage Categories
          </Button>
        </div>
      </div>

      {/* Account Tabs (for cashbook view) */}
      {view === 'cashbook' && renderAccountTabs()}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-[#6366f1]" />
        </div>
      ) : (
        <>
          {/* Render Views */}
          {view === 'cashbook' && renderCashbookView()}
          {view === 'master' && renderMasterExpenseView()}
          {view === 'category-detail' && renderCategoryDetailView()}
        </>
      )}

      {/* Add Entry Modal */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent className={`max-w-lg ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>
              Add {entryType === 'credit' ? 'Credit (Income)' : 'Debit (Expense)'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Date</label>
                <Input
                  type="date"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newEntry.amount}
                  onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                />
              </div>
            </div>

            {entryType === 'credit' ? (
              <>
                <div>
                  <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Income From</label>
                  <Input
                    placeholder="Client/Source name"
                    value={newEntry.income_from}
                    onChange={(e) => setNewEntry({ ...newEntry, income_from: e.target.value })}
                    className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Payment Type</label>
                    <Select
                      value={newEntry.payment_type}
                      onValueChange={(v) => setNewEntry({ ...newEntry, payment_type: v })}
                    >
                      <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Prepaid">Prepaid</SelectItem>
                        <SelectItem value="Partial Payment">Partial Payment</SelectItem>
                        <SelectItem value="One-Time">One-Time</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Invoice Type</label>
                    <Select
                      value={newEntry.invoice_type}
                      onValueChange={(v) => setNewEntry({ ...newEntry, invoice_type: v })}
                    >
                      <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}>
                        <SelectValue placeholder="GST/No GST" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GST">GST</SelectItem>
                        <SelectItem value="NO GST">NO GST</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Expense To</label>
                  <Input
                    placeholder="Payee name"
                    value={newEntry.expense_to}
                    onChange={(e) => setNewEntry({ ...newEntry, expense_to: e.target.value })}
                    className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                  />
                </div>
                <div>
                  <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Category</label>
                  <Select
                    value={newEntry.category_id}
                    onValueChange={(v) => setNewEntry({ ...newEntry, category_id: v })}
                  >
                    <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.category_id} value={cat.category_id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Tax %</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newEntry.tax_percent}
                  onChange={(e) => setNewEntry({ ...newEntry, tax_percent: parseFloat(e.target.value) || 0 })}
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Invoice Number</label>
                <Input
                  placeholder="INV-XXX"
                  value={newEntry.invoice_number}
                  onChange={(e) => setNewEntry({ ...newEntry, invoice_number: e.target.value })}
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                />
              </div>
            </div>

            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Remarks</label>
              <Input
                placeholder="Additional notes"
                value={newEntry.remarks}
                onChange={(e) => setNewEntry({ ...newEntry, remarks: e.target.value })}
                className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEntry(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddEntry}
              className={entryType === 'credit' ? 'bg-[#22c55e] hover:bg-[#16a34a]' : 'bg-[#ef4444] hover:bg-[#dc2626]'}
            >
              Add {entryType === 'credit' ? 'Credit' : 'Debit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Account Modal */}
      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Bank Account</DialogTitle>
          </DialogHeader>
          <AddAccountForm onSubmit={handleAddAccount} isDark={isDark} />
        </DialogContent>
      </Dialog>

      {/* Add Category Modal */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Expense Category</DialogTitle>
          </DialogHeader>
          <AddCategoryForm onSubmit={handleAddCategory} isDark={isDark} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Sub-components for forms
const AddAccountForm = ({ onSubmit, isDark }) => {
  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [initialBalance, setInitialBalance] = useState(0);

  return (
    <div className="space-y-4 py-4">
      <div>
        <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Account Name</label>
        <Input
          placeholder="e.g., Current Account"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
        />
      </div>
      <div>
        <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Account Number</label>
        <Input
          placeholder="Optional"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
        />
      </div>
      <div>
        <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Bank Name</label>
        <Input
          placeholder="Optional"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
        />
      </div>
      <div>
        <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Initial Balance</label>
        <Input
          type="number"
          placeholder="0.00"
          value={initialBalance}
          onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
          className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
        />
      </div>
      <DialogFooter>
        <Button
          onClick={() => onSubmit({ name, account_number: accountNumber, bank_name: bankName, initial_balance: initialBalance })}
          className="bg-[#6366f1] hover:bg-[#5855e0]"
        >
          Create Account
        </Button>
      </DialogFooter>
    </div>
  );
};

const AddCategoryForm = ({ onSubmit, isDark }) => {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');

  return (
    <div className="space-y-4 py-4">
      <div>
        <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Category Name</label>
        <Input
          placeholder="e.g., Office Expense"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
        />
      </div>
      <div>
        <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Department</label>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}>
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HR">HR</SelectItem>
            <SelectItem value="Finance">Finance</SelectItem>
            <SelectItem value="Operations">Operations</SelectItem>
            <SelectItem value="Marketing">Marketing</SelectItem>
            <SelectItem value="Executive">Executive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button
          onClick={() => onSubmit({ name, category_type: 'expense', department })}
          className="bg-[#6366f1] hover:bg-[#5855e0]"
        >
          Create Category
        </Button>
      </DialogFooter>
    </div>
  );
};

export default ExpenseTab;
