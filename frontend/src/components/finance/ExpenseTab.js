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
  DialogDescription,
} from '../ui/dialog';
import {
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronRight,
  ChevronLeft,
  Wallet,
  LayoutGrid,
  Table,
  RefreshCw,
  Settings,
  X,
  Calendar,
  FileText,
  IndianRupee,
  Percent,
  Receipt,
  Building2,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Category colors matching user's spreadsheet
const CATEGORY_COLORS = {
  'Salary': { bg: '#fee2e2', text: '#dc2626', dark: '#ef4444' },
  'Pay Roll': { bg: '#fee2e2', text: '#dc2626', dark: '#ef4444' },
  'Office Exp': { bg: '#fef3c7', text: '#d97706', dark: '#f59e0b' },
  'CEO': { bg: '#dbeafe', text: '#2563eb', dark: '#3b82f6' },
  'Vendor Payments': { bg: '#dcfce7', text: '#16a34a', dark: '#22c55e' },
  'Vendor': { bg: '#dcfce7', text: '#16a34a', dark: '#22c55e' },
  'Loans & Debts': { bg: '#f3e8ff', text: '#9333ea', dark: '#a855f7' },
  'Tools & Subscriptions': { bg: '#cffafe', text: '#0891b2', dark: '#06b6d4' },
  'BNI': { bg: '#fce7f3', text: '#db2777', dark: '#ec4899' },
  'Tax & Auditing': { bg: '#ecfccb', text: '#65a30d', dark: '#84cc16' },
  'Mentorship': { bg: '#ffedd5', text: '#ea580c', dark: '#f97316' },
  'Events & Networking': { bg: '#ccfbf1', text: '#0d9488', dark: '#14b8a6' },
  'Courses & Books': { bg: '#ede9fe', text: '#7c3aed', dark: '#8b5cf6' },
  'Marketing & Branding': { bg: '#e0e7ff', text: '#4f46e5', dark: '#6366f1' },
};

const ExpenseTab = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');

  // Main view state
  const [activeBoard, setActiveBoard] = useState('budget'); // 'budget' | 'cashbook'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  // Data state
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryItems, setCategoryItems] = useState([]);
  const [masterData, setMasterData] = useState(null);
  const [cashbookData, setCashbookData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Fiscal year
  const [fiscalYear, setFiscalYear] = useState(() => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${String(year + 1).slice(2)}`;
  });
  const [fiscalQuarter, setFiscalQuarter] = useState('Q4');
  
  // Cashbook filters
  const [cashbookMonth, setCashbookMonth] = useState(new Date().getMonth() + 1);
  const [cashbookYear, setCashbookYear] = useState(new Date().getFullYear());
  
  // Modal states
  const [showAddCredit, setShowAddCredit] = useState(false);
  const [showAddDebit, setShowAddDebit] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  
  // Form states
  const [creditForm, setCreditForm] = useState({
    date: new Date().toISOString().split('T')[0],
    income_from: '',
    payment_type: 'Prepaid',
    payment_cycle: 'Monthly',
    invoice_type: 'GST',
    invoice_number: '',
    amount: '',
    tax_percent: 18,
  });
  
  const [debitForm, setDebitForm] = useState({
    date: new Date().toISOString().split('T')[0],
    expense_to: '',
    category_id: '',
    existing_item_id: '',
    is_new_item: false,
    amount: '',
    tax_percent: 0,
    remarks: '',
  });

  // Get fiscal year months
  const getFiscalMonths = () => {
    const startYear = parseInt(fiscalYear.split('-')[0]);
    const quarters = {
      'Q1': [4, 5, 6],
      'Q2': [7, 8, 9],
      'Q3': [10, 11, 12],
      'Q4': [1, 2, 3],
    };
    
    const monthNums = quarters[fiscalQuarter] || [1, 2, 3];
    return monthNums.map(m => {
      const year = m <= 3 ? startYear + 1 : startYear;
      const date = new Date(year, m - 1, 1);
      return {
        month: m,
        year,
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        shortLabel: date.toLocaleDateString('en-US', { month: 'short' })
      };
    });
  };

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

  // Load master expense data
  const loadMasterData = useCallback(async () => {
    setLoading(true);
    try {
      const fyYear = parseInt(fiscalYear.split('-')[0]);
      const res = await axios.get(`${API}/api/expense/master-view`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { fy_year: fyYear }
      });
      setMasterData(res.data);
    } catch (error) {
      console.error('Error loading master data:', error);
    } finally {
      setLoading(false);
    }
  }, [token, fiscalYear]);

  // Load category items
  const loadCategoryItems = useCallback(async (categoryId) => {
    try {
      const res = await axios.get(`${API}/api/expense/entries`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { category_id: categoryId }
      });
      setCategoryItems(res.data || []);
    } catch (error) {
      console.error('Error loading category items:', error);
      setCategoryItems([]);
    }
  }, [token]);

  // Load cashbook data
  const loadCashbook = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/expense/cashflow`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month: cashbookMonth, year: cashbookYear }
      });
      setCashbookData(res.data);
    } catch (error) {
      console.error('Error loading cashbook:', error);
    } finally {
      setLoading(false);
    }
  }, [token, selectedAccount, cashbookMonth, cashbookYear]);

  // Initialize data
  const initializeData = async () => {
    try {
      await axios.post(`${API}/api/expense/initialize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Data initialized');
      loadAccounts();
      loadCategories();
      loadMasterData();
    } catch (error) {
      console.error('Error initializing:', error);
    }
  };

  // Add credit/income
  const handleAddCredit = async () => {
    try {
      const taxAmount = (parseFloat(creditForm.amount) * creditForm.tax_percent / 100) || 0;
      await axios.post(`${API}/api/expense/income`, {
        source: creditForm.income_from,
        description: `${creditForm.payment_type} - ${creditForm.payment_cycle}`,
        amount: parseFloat(creditForm.amount),
        invoice_number: creditForm.invoice_number,
        payment_type: creditForm.payment_type,
        payment_cycle: creditForm.payment_cycle,
        date: creditForm.date,
        bank_account_id: selectedAccount?.account_id,
        tax_amount: taxAmount,
        invoice_type: creditForm.invoice_type,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Income recorded');
      setShowAddCredit(false);
      setCreditForm({
        date: new Date().toISOString().split('T')[0],
        income_from: '',
        payment_type: 'Prepaid',
        payment_cycle: 'Monthly',
        invoice_type: 'GST',
        invoice_number: '',
        amount: '',
        tax_percent: 18,
      });
      loadCashbook();
      loadAccounts();
    } catch (error) {
      toast.error('Failed to add income');
    }
  };

  // Add debit/expense
  const handleAddDebit = async () => {
    try {
      let entryId = debitForm.existing_item_id;
      
      // If new item, create entry first
      if (debitForm.is_new_item || !entryId) {
        const entryRes = await axios.post(`${API}/api/expense/entries`, {
          category_id: debitForm.category_id,
          name: debitForm.expense_to,
          description: debitForm.remarks,
          total_amount: parseFloat(debitForm.amount),
          recurring: false,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        entryId = entryRes.data.entry_id;
      }
      
      // Record payment
      const taxAmount = (parseFloat(debitForm.amount) * debitForm.tax_percent / 100) || 0;
      await axios.post(`${API}/api/expense/payments`, {
        entry_id: entryId,
        amount: parseFloat(debitForm.amount),
        payment_date: debitForm.date,
        bank_account_id: selectedAccount?.account_id,
        notes: debitForm.remarks,
        tax_amount: taxAmount,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Expense recorded');
      setShowAddDebit(false);
      setDebitForm({
        date: new Date().toISOString().split('T')[0],
        expense_to: '',
        category_id: '',
        existing_item_id: '',
        is_new_item: false,
        amount: '',
        tax_percent: 0,
        remarks: '',
      });
      loadCashbook();
      loadMasterData();
      loadAccounts();
    } catch (error) {
      toast.error('Failed to add expense');
    }
  };

  // Load on mount
  useEffect(() => {
    loadAccounts();
    loadCategories();
  }, [loadAccounts, loadCategories]);

  // Load board-specific data
  useEffect(() => {
    if (activeBoard === 'budget') {
      loadMasterData();
    } else {
      loadCashbook();
    }
  }, [activeBoard, loadMasterData, loadCashbook]);

  // Load category items when selected
  useEffect(() => {
    if (selectedCategory) {
      loadCategoryItems(selectedCategory.category_id);
    }
  }, [selectedCategory, loadCategoryItems]);

  // Load items when category selected in debit form
  useEffect(() => {
    if (debitForm.category_id) {
      loadCategoryItems(debitForm.category_id);
    }
  }, [debitForm.category_id, loadCategoryItems]);

  // Format currency
  const formatCurrency = (amount, compact = false) => {
    if (compact && Math.abs(amount) >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Get category color
  const getCatColor = (name) => {
    return CATEGORY_COLORS[name] || { bg: '#f3f4f6', text: '#4b5563', dark: '#6b7280' };
  };

  // Fiscal months for display
  const fiscalMonths = getFiscalMonths();

  // ============ RENDER EXPENSE BUDGET BOARD ============
  const renderBudgetBoard = () => {
    if (selectedCategory) {
      return renderCategoryDetail();
    }
    return renderMasterView();
  };

  // Master Expense View
  const renderMasterView = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className={`p-4 rounded-xl ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Expense Master Board
            </h3>
            <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>
              FY {fiscalYear} • {fiscalQuarter}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={fiscalYear} onValueChange={setFiscalYear}>
              <SelectTrigger className={`w-[130px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['2024-25', '2025-26', '2026-27'].map(fy => (
                  <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fiscalQuarter} onValueChange={setFiscalQuarter}>
              <SelectTrigger className={`w-[100px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Q1">Q1 (Apr-Jun)</SelectItem>
                <SelectItem value="Q2">Q2 (Jul-Sep)</SelectItem>
                <SelectItem value="Q3">Q3 (Oct-Dec)</SelectItem>
                <SelectItem value="Q4">Q4 (Jan-Mar)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setShowAddCategory(true)}>
              <Plus className="h-4 w-4 mr-1" /> Category
            </Button>
          </div>
        </div>
      </div>

      {/* Master Table */}
      <div className={`rounded-xl overflow-hidden border ${isDark ? 'bg-[#0a0a0a] border-[#27272a]' : 'bg-white border-gray-200'}`}>
        {/* Table Header */}
        <div className="bg-[#22c55e] text-white">
          <div className="grid grid-cols-[200px_repeat(3,100px)_repeat(3,1fr)] text-xs font-semibold">
            <div className="p-3 border-r border-green-600">Master Expense</div>
            <div className="p-3 text-center border-r border-green-600" colSpan={3}>Grand Expenses</div>
            <div className="p-3 text-center col-span-3">Financial Year {fiscalYear} ({fiscalQuarter})</div>
          </div>
          <div className="grid grid-cols-[200px_repeat(3,100px)_repeat(3,1fr)] text-xs">
            <div className="p-2 border-r border-green-600">Type of Expense</div>
            <div className="p-2 text-center border-r border-green-600/50">Total</div>
            <div className="p-2 text-center border-r border-green-600/50">Paid</div>
            <div className="p-2 text-center border-r border-green-600">Balance</div>
            {fiscalMonths.map(m => (
              <div key={m.label} className="p-2 text-center border-r border-green-600/30 last:border-r-0">
                <div>{m.shortLabel} {m.year}</div>
                <div className="grid grid-cols-3 text-[10px] mt-1 opacity-80">
                  <span>Total</span>
                  <span>Paid</span>
                  <span>Bal</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Rows */}
        <div className="divide-y divide-[#27272a]">
          {(masterData?.categories || categories).map((cat, idx) => {
            const color = getCatColor(cat.name);
            const grandTotal = cat.grand_total || 0;
            const grandPaid = cat.grand_paid || 0;
            const grandBalance = grandTotal - grandPaid;
            
            return (
              <div
                key={cat.category_id}
                onClick={() => setSelectedCategory(cat)}
                className={`grid grid-cols-[200px_repeat(3,100px)_repeat(3,1fr)] text-sm cursor-pointer transition-colors ${
                  isDark ? 'hover:bg-[#18181b]' : 'hover:bg-gray-50'
                }`}
              >
                <div className="p-3 flex items-center gap-2 border-r border-[#27272a]/30">
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {idx + 1}. {cat.name}
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </div>
                <div className={`p-3 text-center font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {formatCurrency(grandTotal, true)}
                </div>
                <div className="p-3 text-center text-[#22c55e] font-medium">
                  {formatCurrency(grandPaid, true)}
                </div>
                <div className={`p-3 text-center font-medium border-r border-[#27272a]/30 ${grandBalance > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                  {formatCurrency(grandBalance, true)}
                </div>
                {fiscalMonths.map(m => {
                  const monthData = cat.months?.[m.label] || { total: 0, paid: 0 };
                  const bal = (monthData.total || 0) - (monthData.paid || 0);
                  return (
                    <div key={m.label} className="grid grid-cols-3 text-xs border-r border-[#27272a]/20 last:border-r-0">
                      <div className={`p-2 text-center ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>
                        {(monthData.total || 0).toFixed(0)}
                      </div>
                      <div className="p-2 text-center text-[#22c55e]">
                        {(monthData.paid || 0).toFixed(0)}
                      </div>
                      <div className={`p-2 text-center ${bal > 0 ? 'text-[#ef4444]' : ''}`}>
                        {bal.toFixed(0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Grand Total Row */}
        <div className={`grid grid-cols-[200px_repeat(3,100px)_repeat(3,1fr)] text-sm font-bold ${isDark ? 'bg-[#18181b]' : 'bg-gray-100'}`}>
          <div className={`p-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Grand Total</div>
          <div className={`p-3 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {formatCurrency(masterData?.grand_total?.total || 0)}
          </div>
          <div className="p-3 text-center text-[#22c55e]">
            {formatCurrency(masterData?.grand_total?.paid || 0)}
          </div>
          <div className={`p-3 text-center ${(masterData?.grand_total?.balance || 0) > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
            {formatCurrency(masterData?.grand_total?.balance || 0)}
          </div>
          <div className="col-span-3"></div>
        </div>
      </div>
    </div>
  );

  // Category Detail View
  const renderCategoryDetail = () => {
    const color = getCatColor(selectedCategory.name);
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className={`p-4 rounded-xl ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedCategory.name}
                </h3>
                <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>
                  FY {fiscalYear} • {fiscalQuarter}
                </p>
              </div>
            </div>
            <Button onClick={() => setShowAddItem(true)} className="bg-[#6366f1] hover:bg-[#5855eb]">
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </div>
        </div>

        {/* Items Table */}
        <div className={`rounded-xl overflow-hidden border ${isDark ? 'bg-[#0a0a0a] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          {/* Header */}
          <div style={{ backgroundColor: color.dark }} className="text-white">
            <div className="grid grid-cols-[50px_200px_repeat(3,1fr)] text-xs font-semibold">
              <div className="p-3 border-r border-white/20">Sno</div>
              <div className="p-3 border-r border-white/20">Type of Expense</div>
              {fiscalMonths.map(m => (
                <div key={m.label} className="p-3 text-center border-r border-white/20 last:border-r-0">
                  <div>{m.label}</div>
                  <div className="grid grid-cols-3 text-[10px] mt-1 opacity-80">
                    <span>Total</span>
                    <span>Paid</span>
                    <span>Balance</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="divide-y divide-[#27272a]">
            {categoryItems.length > 0 ? (
              categoryItems.map((item, idx) => (
                <div
                  key={item.entry_id}
                  className={`grid grid-cols-[50px_200px_repeat(3,1fr)] text-sm ${isDark ? 'hover:bg-[#18181b]' : 'hover:bg-gray-50'}`}
                >
                  <div className={`p-3 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>{idx + 1}</div>
                  <div className={`p-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</div>
                  {fiscalMonths.map(m => {
                    const monthKey = `${m.year}-${String(m.month).padStart(2, '0')}`;
                    const monthData = item.monthly_data?.[monthKey] || { total: 0, paid: 0 };
                    const bal = (monthData.total || 0) - (monthData.paid || 0);
                    return (
                      <div key={m.label} className="grid grid-cols-3 text-xs">
                        <div className={`p-3 text-center ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>
                          {(monthData.total || item.total_amount || 0).toFixed(0)}
                        </div>
                        <div className="p-3 text-center text-[#22c55e]">
                          {(monthData.paid || item.total_paid || 0).toFixed(0)}
                        </div>
                        <div className={`p-3 text-center ${bal > 0 ? 'text-[#ef4444]' : ''}`}>
                          {bal.toFixed(0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className={`p-8 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>
                No items in this category. Click "Add Item" to create one.
              </div>
            )}
          </div>

          {/* Total Row */}
          {categoryItems.length > 0 && (
            <div className={`grid grid-cols-[50px_200px_repeat(3,1fr)] text-sm font-bold ${isDark ? 'bg-[#18181b]' : 'bg-gray-100'}`}>
              <div className="p-3"></div>
              <div className={`p-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Grand Total</div>
              {fiscalMonths.map(m => {
                const total = categoryItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
                const paid = categoryItems.reduce((sum, item) => sum + (item.total_paid || 0), 0);
                return (
                  <div key={m.label} className="grid grid-cols-3 text-xs">
                    <div className={`p-3 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>{total.toFixed(0)}</div>
                    <div className="p-3 text-center text-[#22c55e]">{paid.toFixed(0)}</div>
                    <div className={`p-3 text-center ${(total - paid) > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                      {(total - paid).toFixed(0)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============ RENDER CASHBOOK BOARD ============
  const renderCashbookBoard = () => {
    const balance = selectedAccount?.current_balance || 0;
    const creditTotal = cashbookData?.credit?.total || 0;
    const debitTotal = cashbookData?.debit?.total || 0;

    const months = [
      { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
      { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
      { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
      { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
    ];

    return (
      <div className="space-y-4">
        {/* Header with Account Balance */}
        <div className={`p-4 rounded-xl ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Amount in Account</p>
                <p className={`text-3xl font-bold ${balance >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {formatCurrency(balance)}
                </p>
              </div>
              {/* Account Tabs */}
              <div className="flex gap-1">
                {accounts.map(acc => (
                  <button
                    key={acc.account_id}
                    onClick={() => setSelectedAccount(acc)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                      selectedAccount?.account_id === acc.account_id
                        ? 'bg-[#6366f1] text-white'
                        : isDark ? 'bg-[#27272a] text-[#a1a1aa] hover:bg-[#3f3f46]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={cashbookMonth.toString()} onValueChange={v => setCashbookMonth(parseInt(v))}>
                <SelectTrigger className={`w-[100px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={cashbookYear.toString()} onValueChange={v => setCashbookYear(parseInt(v))}>
                <SelectTrigger className={`w-[90px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Split View: Credit | Debit */}
        <div className="grid grid-cols-2 gap-4">
          {/* Credit/Inward */}
          <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
            <div className="bg-[#22c55e] text-white p-3 flex items-center justify-between">
              <h3 className="font-semibold">Credit/Inward</h3>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">{formatCurrency(creditTotal)}</span>
                <Button size="sm" variant="secondary" onClick={() => setShowAddCredit(true)} className="bg-white/20 hover:bg-white/30 text-white">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>
            
            {/* Credit Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className={isDark ? 'bg-[#18181b]' : 'bg-gray-50'}>
                  <tr>
                    <th className="p-2 text-left font-medium">Sno</th>
                    <th className="p-2 text-left font-medium">Date</th>
                    <th className="p-2 text-left font-medium">Income From</th>
                    <th className="p-2 text-left font-medium">Type</th>
                    <th className="p-2 text-left font-medium">Cycle</th>
                    <th className="p-2 text-left font-medium">Invoice</th>
                    <th className="p-2 text-right font-medium">Amount</th>
                    <th className="p-2 text-right font-medium">Tax</th>
                    <th className="p-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-100'}`}>
                  {(cashbookData?.credit?.entries || []).map((entry, idx) => (
                    <tr key={entry.income_id || idx} className={isDark ? 'hover:bg-[#18181b]' : 'hover:bg-gray-50'}>
                      <td className="p-2">{idx + 1}</td>
                      <td className="p-2">{entry.date}</td>
                      <td className={`p-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{entry.source}</td>
                      <td className="p-2">
                        <Badge className={`text-[10px] ${entry.payment_type === 'Prepaid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {entry.payment_type || 'Payment'}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge className="text-[10px] bg-blue-100 text-blue-700">
                          {entry.payment_cycle || 'One-Time'}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <span className={`text-[10px] px-1 py-0.5 rounded ${entry.invoice_type === 'GST' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {entry.invoice_type || 'N/A'}
                        </span>
                        {entry.invoice_number && <span className="ml-1 text-[10px]">{entry.invoice_number}</span>}
                      </td>
                      <td className="p-2 text-right">{formatCurrency(entry.amount)}</td>
                      <td className="p-2 text-right">{formatCurrency(entry.tax_amount || 0)}</td>
                      <td className="p-2 text-right font-medium text-[#22c55e]">
                        {formatCurrency(entry.amount + (entry.tax_amount || 0))}
                      </td>
                    </tr>
                  ))}
                  {(!cashbookData?.credit?.entries || cashbookData.credit.entries.length === 0) && (
                    <tr>
                      <td colSpan={9} className={`p-6 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>
                        No income entries this month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Debit/Outward */}
          <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
            <div className="bg-[#ef4444] text-white p-3 flex items-center justify-between">
              <h3 className="font-semibold">Debit/Outward</h3>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">{formatCurrency(debitTotal)}</span>
                <Button size="sm" variant="secondary" onClick={() => setShowAddDebit(true)} className="bg-white/20 hover:bg-white/30 text-white">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>
            
            {/* Debit Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className={isDark ? 'bg-[#18181b]' : 'bg-gray-50'}>
                  <tr>
                    <th className="p-2 text-left font-medium">Sno</th>
                    <th className="p-2 text-left font-medium">Date</th>
                    <th className="p-2 text-left font-medium">Expense To</th>
                    <th className="p-2 text-left font-medium">Type</th>
                    <th className="p-2 text-right font-medium">Amount</th>
                    <th className="p-2 text-right font-medium">Tax</th>
                    <th className="p-2 text-right font-medium">Total</th>
                    <th className="p-2 text-left font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-100'}`}>
                  {(cashbookData?.debit?.entries || []).map((entry, idx) => {
                    const catColor = getCatColor(entry.category_name);
                    return (
                      <tr key={entry.payment_id || idx} className={isDark ? 'hover:bg-[#18181b]' : 'hover:bg-gray-50'}>
                        <td className="p-2">{idx + 1}</td>
                        <td className="p-2">{entry.payment_date}</td>
                        <td className={`p-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{entry.entry_name || 'Expense'}</td>
                        <td className="p-2">
                          <Badge 
                            className="text-[10px]"
                            style={{ backgroundColor: catColor.bg, color: catColor.text }}
                          >
                            {entry.category_name || 'General'}
                          </Badge>
                        </td>
                        <td className="p-2 text-right">{formatCurrency(entry.amount)}</td>
                        <td className="p-2 text-right">{formatCurrency(entry.tax_amount || 0)}</td>
                        <td className="p-2 text-right font-medium text-[#ef4444]">
                          {formatCurrency(entry.amount + (entry.tax_amount || 0))}
                        </td>
                        <td className="p-2 text-[10px] truncate max-w-[100px]">{entry.notes}</td>
                      </tr>
                    );
                  })}
                  {(!cashbookData?.debit?.entries || cashbookData.debit.entries.length === 0) && (
                    <tr>
                      <td colSpan={8} className={`p-6 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>
                        No expense entries this month
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

  // ============ MAIN RENDER ============
  return (
    <div className="space-y-6" data-testid="expense-tab">
      {/* Board Toggle */}
      <div className="flex items-center justify-between">
        <div className={`flex p-1 rounded-lg ${isDark ? 'bg-[#18181b]' : 'bg-gray-100'}`}>
          <button
            onClick={() => setActiveBoard('budget')}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${
              activeBoard === 'budget'
                ? 'bg-[#6366f1] text-white'
                : isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Expense Budget
          </button>
          <button
            onClick={() => setActiveBoard('cashbook')}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${
              activeBoard === 'cashbook'
                ? 'bg-[#6366f1] text-white'
                : isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wallet className="h-4 w-4" />
            Cashbook
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={activeBoard === 'budget' ? loadMasterData : loadCashbook}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={initializeData}>
            Initialize
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-[#6366f1]" />
        </div>
      ) : (
        <>
          {activeBoard === 'budget' && renderBudgetBoard()}
          {activeBoard === 'cashbook' && renderCashbookBoard()}
        </>
      )}

      {/* Add Credit Modal */}
      <Dialog open={showAddCredit} onOpenChange={setShowAddCredit}>
        <DialogContent className={`max-w-xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Credit/Income</DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>
              Record income received
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Date</label>
              <Input
                type="date"
                value={creditForm.date}
                onChange={e => setCreditForm({...creditForm, date: e.target.value})}
                className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
              />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Income From</label>
              <Input
                placeholder="Client/Source name"
                value={creditForm.income_from}
                onChange={e => setCreditForm({...creditForm, income_from: e.target.value})}
                className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
              />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Payment Type</label>
              <Select value={creditForm.payment_type} onValueChange={v => setCreditForm({...creditForm, payment_type: v})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Prepaid">Prepaid</SelectItem>
                  <SelectItem value="Partial Payment">Partial Payment</SelectItem>
                  <SelectItem value="One-Time">One-Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Payment Cycle</label>
              <Select value={creditForm.payment_cycle} onValueChange={v => setCreditForm({...creditForm, payment_cycle: v})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Yearly">Yearly</SelectItem>
                  <SelectItem value="One-Time">One-Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Invoice Type</label>
              <Select value={creditForm.invoice_type} onValueChange={v => setCreditForm({...creditForm, invoice_type: v})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GST">GST</SelectItem>
                  <SelectItem value="NO GST">NO GST</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Invoice Number</label>
              <Input
                placeholder="INV-XXX"
                value={creditForm.invoice_number}
                onChange={e => setCreditForm({...creditForm, invoice_number: e.target.value})}
                className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
              />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Amount</label>
              <Input
                type="number"
                placeholder="0.00"
                value={creditForm.amount}
                onChange={e => setCreditForm({...creditForm, amount: e.target.value})}
                className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
              />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Tax %</label>
              <Select value={creditForm.tax_percent.toString()} onValueChange={v => setCreditForm({...creditForm, tax_percent: parseInt(v)})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="12">12%</SelectItem>
                  <SelectItem value="18">18%</SelectItem>
                  <SelectItem value="28">28%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCredit(false)}>Cancel</Button>
            <Button onClick={handleAddCredit} className="bg-[#22c55e] hover:bg-[#16a34a]">Add Income</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Debit Modal */}
      <Dialog open={showAddDebit} onOpenChange={setShowAddDebit}>
        <DialogContent className={`max-w-xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Debit/Expense</DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>
              Record expense payment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Date</label>
                <Input
                  type="date"
                  value={debitForm.date}
                  onChange={e => setDebitForm({...debitForm, date: e.target.value})}
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={debitForm.amount}
                  onChange={e => setDebitForm({...debitForm, amount: e.target.value})}
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                />
              </div>
            </div>
            
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Expense Category</label>
              <Select 
                value={debitForm.category_id} 
                onValueChange={v => setDebitForm({...debitForm, category_id: v, existing_item_id: '', is_new_item: false})}
              >
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.category_id} value={cat.category_id}>
                      <span className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getCatColor(cat.name).dark }}
                        />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {debitForm.category_id && (
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>
                  Expense To (Select existing or add new)
                </label>
                <Select 
                  value={debitForm.existing_item_id || 'new'} 
                  onValueChange={v => {
                    if (v === 'new') {
                      setDebitForm({...debitForm, existing_item_id: '', is_new_item: true});
                    } else {
                      const item = categoryItems.find(i => i.entry_id === v);
                      setDebitForm({...debitForm, existing_item_id: v, expense_to: item?.name || '', is_new_item: false});
                    }
                  }}
                >
                  <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}>
                    <SelectValue placeholder="Select or add new" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">
                      <span className="flex items-center gap-2 text-[#6366f1]">
                        <Plus className="h-3 w-3" /> Add New Item
                      </span>
                    </SelectItem>
                    {categoryItems.map(item => (
                      <SelectItem key={item.entry_id} value={item.entry_id}>
                        {item.name} (Balance: {formatCurrency((item.total_amount || 0) - (item.total_paid || 0))})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(debitForm.is_new_item || !debitForm.existing_item_id) && debitForm.category_id && (
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>New Expense Name</label>
                <Input
                  placeholder="e.g., Anbarasan, Office Rent, ChatGPT"
                  value={debitForm.expense_to}
                  onChange={e => setDebitForm({...debitForm, expense_to: e.target.value})}
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Tax %</label>
                <Select value={debitForm.tax_percent.toString()} onValueChange={v => setDebitForm({...debitForm, tax_percent: parseInt(v)})}>
                  <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="18">18%</SelectItem>
                    <SelectItem value="28">28%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Remarks</label>
                <Input
                  placeholder="Optional notes"
                  value={debitForm.remarks}
                  onChange={e => setDebitForm({...debitForm, remarks: e.target.value})}
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDebit(false)}>Cancel</Button>
            <Button onClick={handleAddDebit} className="bg-[#ef4444] hover:bg-[#dc2626]">Add Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Modal */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Category</DialogTitle>
          </DialogHeader>
          <AddCategoryForm 
            onSubmit={async (data) => {
              try {
                await axios.post(`${API}/api/expense/categories`, data, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                toast.success('Category added');
                setShowAddCategory(false);
                loadCategories();
                loadMasterData();
              } catch (e) {
                toast.error('Failed to add category');
              }
            }}
            isDark={isDark}
          />
        </DialogContent>
      </Dialog>

      {/* Add Item Modal */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Item to {selectedCategory?.name}</DialogTitle>
          </DialogHeader>
          <AddItemForm 
            categoryId={selectedCategory?.category_id}
            onSubmit={async (data) => {
              try {
                await axios.post(`${API}/api/expense/entries`, {
                  ...data,
                  category_id: selectedCategory?.category_id,
                }, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                toast.success('Item added');
                setShowAddItem(false);
                loadCategoryItems(selectedCategory?.category_id);
                loadMasterData();
              } catch (e) {
                toast.error('Failed to add item');
              }
            }}
            isDark={isDark}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Add Category Form
const AddCategoryForm = ({ onSubmit, isDark }) => {
  const [name, setName] = useState('');
  
  return (
    <div className="space-y-4 py-4">
      <div>
        <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Category Name</label>
        <Input
          placeholder="e.g., Office Expense, Salary"
          value={name}
          onChange={e => setName(e.target.value)}
          className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
        />
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ name, category_type: 'expense' })} className="bg-[#6366f1] hover:bg-[#5855eb]">
          Add Category
        </Button>
      </DialogFooter>
    </div>
  );
};

// Add Item Form
const AddItemForm = ({ categoryId, onSubmit, isDark }) => {
  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [recurring, setRecurring] = useState(false);
  
  return (
    <div className="space-y-4 py-4">
      <div>
        <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Item Name</label>
        <Input
          placeholder="e.g., Anbarasan, Office Rent, ChatGPT"
          value={name}
          onChange={e => setName(e.target.value)}
          className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
        />
      </div>
      <div>
        <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Total Amount (Budget)</label>
        <Input
          type="number"
          placeholder="0.00"
          value={totalAmount}
          onChange={e => setTotalAmount(e.target.value)}
          className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="recurring"
          checked={recurring}
          onChange={e => setRecurring(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="recurring" className={`text-sm ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>
          Recurring monthly expense
        </label>
      </div>
      <DialogFooter>
        <Button 
          onClick={() => onSubmit({ name, total_amount: parseFloat(totalAmount) || 0, recurring })} 
          className="bg-[#6366f1] hover:bg-[#5855eb]"
        >
          Add Item
        </Button>
      </DialogFooter>
    </div>
  );
};

export default ExpenseTab;
