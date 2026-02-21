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
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  FileText,
  Receipt,
  CreditCard,
  RefreshCw,
  Calendar,
  Filter,
  X,
  CheckCircle,
  AlertCircle,
  Banknote,
  PiggyBank,
  Target,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Category colors
const CATEGORY_COLORS = {
  'Salary': { bg: '#fee2e2', text: '#dc2626', dark: '#ef4444' },
  'Office Expense': { bg: '#fef3c7', text: '#d97706', dark: '#f59e0b' },
  'CEO': { bg: '#dbeafe', text: '#2563eb', dark: '#3b82f6' },
  'Vendor Payments': { bg: '#dcfce7', text: '#16a34a', dark: '#22c55e' },
  'Loans & Debts': { bg: '#f3e8ff', text: '#9333ea', dark: '#a855f7' },
  'Tools & Subscriptions': { bg: '#cffafe', text: '#0891b2', dark: '#06b6d4' },
  'BNI': { bg: '#fce7f3', text: '#db2777', dark: '#ec4899' },
  'Tax & Auditing': { bg: '#ecfccb', text: '#65a30d', dark: '#84cc16' },
  'Mentorship': { bg: '#ffedd5', text: '#ea580c', dark: '#f97316' },
  'Events & Networking': { bg: '#ccfbf1', text: '#0d9488', dark: '#14b8a6' },
  'Courses & Books': { bg: '#ede9fe', text: '#7c3aed', dark: '#8b5cf6' },
  'Marketing & Branding': { bg: '#e0e7ff', text: '#4f46e5', dark: '#6366f1' },
};

// Project type colors for Outstanding
const PROJECT_TYPE_COLORS = {
  'WhatsApp Marketing': { bg: '#dcfce7', text: '#16a34a' },
  'Website': { bg: '#dbeafe', text: '#2563eb' },
  'Product': { bg: '#fef3c7', text: '#d97706' },
  'Shopify': { bg: '#e0e7ff', text: '#4f46e5' },
  'SEO': { bg: '#f3e8ff', text: '#9333ea' },
  'Brochure': { bg: '#fce7f3', text: '#db2777' },
  'Meta': { bg: '#cffafe', text: '#0891b2' },
};

const ExpenseTab = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');

  // Main view state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  // Data state
  const [dashboardData, setDashboardData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cashbookData, setCashbookData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [outstandingData, setOutstandingData] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [categoryItems, setCategoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Modal states
  const [showAddCredit, setShowAddCredit] = useState(false);
  const [showAddDebit, setShowAddDebit] = useState(false);
  const [showAddOutstanding, setShowAddOutstanding] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [selectedOutstanding, setSelectedOutstanding] = useState(null);
  
  // Form states
  const [creditForm, setCreditForm] = useState({
    date: new Date().toISOString().split('T')[0],
    income_from: '',
    invoice_type: 'GST',
    invoice_id: '',
    create_invoice: false,
    payment_type: 'Full',
    payment_cycle: 'One-Time',
    amount: '',
    tax_percent: 18,
    bank_account_id: '',
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
    bank_account_id: '',
  });
  
  const [outstandingForm, setOutstandingForm] = useState({
    project_name: '',
    project_type: 'Website',
    amount: '',
    revenue_type: 'One-time',
    expected_date: new Date().toISOString().split('T')[0],
    client_name: '',
    remarks: '',
  });
  
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    bank_account_id: '',
    payment_type: 'Full',
    notes: '',
  });

  // Month options
  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
  ];

  // Load dashboard summary
  const loadDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/expense/dashboard-summary`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month: selectedMonth, year: selectedYear }
      });
      setDashboardData(res.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }, [token, selectedMonth, selectedYear]);

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

  // Load cashbook
  const loadCashbook = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/expense/cashflow`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month: selectedMonth, year: selectedYear }
      });
      setCashbookData(res.data);
    } catch (error) {
      console.error('Error loading cashbook:', error);
    }
  }, [token, selectedMonth, selectedYear]);

  // Load budget
  const loadBudget = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/expense/budget-monthly`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month: selectedMonth, year: selectedYear, category_id: selectedCategory?.category_id }
      });
      setBudgetData(res.data);
    } catch (error) {
      console.error('Error loading budget:', error);
    }
  }, [token, selectedMonth, selectedYear, selectedCategory]);

  // Load outstanding
  const loadOutstanding = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/expense/outstanding`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOutstandingData(res.data || []);
    } catch (error) {
      console.error('Error loading outstanding:', error);
    }
  }, [token]);

  // Load invoices
  const loadInvoices = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: 'pending' }
      });
      setInvoices(res.data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  }, [token]);

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

  // Initialize
  const initializeData = async () => {
    try {
      await axios.post(`${API}/api/expense/initialize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Data initialized');
      loadAll();
    } catch (error) {
      console.error('Error initializing:', error);
    }
  };

  // Load all data
  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadAccounts(),
      loadCategories(),
      loadDashboard(),
      loadCashbook(),
      loadOutstanding(),
      loadInvoices(),
    ]);
    setLoading(false);
  }, [loadAccounts, loadCategories, loadDashboard, loadCashbook, loadOutstanding, loadInvoices]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboard();
    if (activeTab === 'cashbook') loadCashbook();
    if (activeTab === 'budget') loadBudget();
    if (activeTab === 'outstanding') loadOutstanding();
  }, [activeTab, selectedMonth, selectedYear, loadDashboard, loadCashbook, loadBudget, loadOutstanding]);

  useEffect(() => {
    if (selectedCategory) loadBudget();
  }, [selectedCategory, loadBudget]);

  useEffect(() => {
    if (debitForm.category_id) loadCategoryItems(debitForm.category_id);
  }, [debitForm.category_id, loadCategoryItems]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Get category color
  const getCatColor = (name) => CATEGORY_COLORS[name] || { bg: '#f3f4f6', text: '#4b5563', dark: '#6b7280' };
  const getProjectColor = (type) => PROJECT_TYPE_COLORS[type] || { bg: '#f3f4f6', text: '#4b5563' };

  // Add credit handler
  const handleAddCredit = async () => {
    try {
      const taxAmount = (parseFloat(creditForm.amount) * creditForm.tax_percent / 100) || 0;
      await axios.post(`${API}/api/expense/income`, {
        source: creditForm.income_from,
        description: `${creditForm.payment_type} - ${creditForm.invoice_type}`,
        amount: parseFloat(creditForm.amount),
        invoice_number: creditForm.invoice_id,
        payment_type: creditForm.payment_type,
        payment_cycle: creditForm.payment_cycle,
        date: creditForm.date,
        bank_account_id: creditForm.bank_account_id || selectedAccount?.account_id,
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
        invoice_type: 'GST',
        invoice_id: '',
        create_invoice: false,
        payment_type: 'Full',
        payment_cycle: 'One-Time',
        amount: '',
        tax_percent: 18,
        bank_account_id: '',
      });
      loadCashbook();
      loadDashboard();
      loadAccounts();
    } catch (error) {
      toast.error('Failed to add income');
    }
  };

  // Add debit handler
  const handleAddDebit = async () => {
    try {
      let entryId = debitForm.existing_item_id;
      
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
      
      const taxAmount = (parseFloat(debitForm.amount) * debitForm.tax_percent / 100) || 0;
      await axios.post(`${API}/api/expense/payments`, {
        entry_id: entryId,
        amount: parseFloat(debitForm.amount),
        payment_date: debitForm.date,
        bank_account_id: debitForm.bank_account_id || selectedAccount?.account_id,
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
        bank_account_id: '',
      });
      loadCashbook();
      loadDashboard();
      loadBudget();
      loadAccounts();
    } catch (error) {
      toast.error('Failed to add expense');
    }
  };

  // Add outstanding handler
  const handleAddOutstanding = async () => {
    try {
      await axios.post(`${API}/api/expense/outstanding`, outstandingForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Outstanding revenue added');
      setShowAddOutstanding(false);
      setOutstandingForm({
        project_name: '',
        project_type: 'Website',
        amount: '',
        revenue_type: 'One-time',
        expected_date: new Date().toISOString().split('T')[0],
        client_name: '',
        remarks: '',
      });
      loadOutstanding();
      loadDashboard();
    } catch (error) {
      toast.error('Failed to add outstanding');
    }
  };

  // Record payment for outstanding
  const handleRecordPayment = async () => {
    if (!selectedOutstanding) return;
    try {
      await axios.post(`${API}/api/expense/outstanding/${selectedOutstanding.outstanding_id}/payment`, {
        outstanding_id: selectedOutstanding.outstanding_id,
        amount: parseFloat(paymentForm.amount),
        payment_date: paymentForm.payment_date,
        bank_account_id: paymentForm.bank_account_id || selectedAccount?.account_id,
        payment_type: paymentForm.payment_type,
        notes: paymentForm.notes,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Payment recorded');
      setShowRecordPayment(false);
      setSelectedOutstanding(null);
      setPaymentForm({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        bank_account_id: '',
        payment_type: 'Full',
        notes: '',
      });
      loadOutstanding();
      loadCashbook();
      loadDashboard();
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  // ============ RENDER DASHBOARD ============
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Revenue */}
        <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2.5 rounded-lg bg-[#22c55e]/20`}>
              <TrendingUp className="h-5 w-5 text-[#22c55e]" />
            </div>
          </div>
          <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Total Revenue</p>
          <p className="text-2xl font-bold text-[#22c55e]">{formatCurrency(dashboardData?.total_revenue)}</p>
        </div>

        {/* Payment Due */}
        <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2.5 rounded-lg bg-[#f59e0b]/20`}>
              <Clock className="h-5 w-5 text-[#f59e0b]" />
            </div>
          </div>
          <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Payment Due</p>
          <p className="text-2xl font-bold text-[#f59e0b]">{formatCurrency(dashboardData?.payment_due)}</p>
        </div>

        {/* Outstanding */}
        <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2.5 rounded-lg bg-[#6366f1]/20`}>
              <Target className="h-5 w-5 text-[#6366f1]" />
            </div>
          </div>
          <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Outstanding</p>
          <p className="text-2xl font-bold text-[#6366f1]">{formatCurrency(dashboardData?.outstanding_amount)}</p>
        </div>

        {/* Total Expense */}
        <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2.5 rounded-lg bg-[#ef4444]/20`}>
              <TrendingDown className="h-5 w-5 text-[#ef4444]" />
            </div>
          </div>
          <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Total Expense</p>
          <p className="text-2xl font-bold text-[#ef4444]">{formatCurrency(dashboardData?.total_expense)}</p>
        </div>

        {/* Profit */}
        <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2.5 rounded-lg ${(dashboardData?.profit || 0) >= 0 ? 'bg-[#22c55e]/20' : 'bg-[#ef4444]/20'}`}>
              <PiggyBank className={`h-5 w-5 ${(dashboardData?.profit || 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`} />
            </div>
          </div>
          <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Profit</p>
          <p className={`text-2xl font-bold ${(dashboardData?.profit || 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {formatCurrency(dashboardData?.profit)}
          </p>
        </div>
      </div>

      {/* Bank Accounts */}
      <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Bank Accounts</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {accounts.map(acc => (
            <div
              key={acc.account_id}
              className={`p-4 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-50'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-[#6366f1]" />
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{acc.name}</span>
              </div>
              <p className={`text-xl font-bold ${(acc.current_balance || 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {formatCurrency(acc.current_balance || acc.initial_balance || 0)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Button onClick={() => setShowAddCredit(true)} className="bg-[#22c55e] hover:bg-[#16a34a] h-auto py-4">
          <div className="flex flex-col items-center">
            <ArrowDownCircle className="h-6 w-6 mb-2" />
            <span>Add Cash In</span>
          </div>
        </Button>
        <Button onClick={() => setShowAddDebit(true)} className="bg-[#ef4444] hover:bg-[#dc2626] h-auto py-4">
          <div className="flex flex-col items-center">
            <ArrowUpCircle className="h-6 w-6 mb-2" />
            <span>Add Cash Out</span>
          </div>
        </Button>
        <Button onClick={() => setShowAddOutstanding(true)} className="bg-[#6366f1] hover:bg-[#5855eb] h-auto py-4">
          <div className="flex flex-col items-center">
            <Target className="h-6 w-6 mb-2" />
            <span>Add Outstanding</span>
          </div>
        </Button>
        <Button variant="outline" onClick={() => setActiveTab('budget')} className={`h-auto py-4 ${isDark ? 'border-[#3f3f46]' : ''}`}>
          <div className="flex flex-col items-center">
            <LayoutGrid className="h-6 w-6 mb-2" />
            <span>View Budget</span>
          </div>
        </Button>
      </div>
    </div>
  );

  // ============ RENDER CASHBOOK ============
  const renderCashbook = () => {
    const balance = selectedAccount?.current_balance || 0;
    const creditTotal = cashbookData?.credit?.total || 0;
    const debitTotal = cashbookData?.debit?.total || 0;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className={`p-4 rounded-xl ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Amount in Account</p>
                <p className={`text-3xl font-bold ${balance >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {formatCurrency(balance)}
                </p>
              </div>
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
              <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className={`w-[120px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
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

        {/* Split View */}
        <div className="grid grid-cols-2 gap-4">
          {/* Cash In */}
          <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
            <div className="bg-[#22c55e] text-white p-3 flex items-center justify-between">
              <h3 className="font-semibold">Cash In</h3>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">{formatCurrency(creditTotal)}</span>
                <Button size="sm" variant="secondary" onClick={() => setShowAddCredit(true)} className="bg-white/20 hover:bg-white/30 text-white">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-xs">
                <thead className={`sticky top-0 ${isDark ? 'bg-[#18181b]' : 'bg-gray-50'}`}>
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">From</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-100'}`}>
                  {(cashbookData?.credit?.entries || []).map((entry, idx) => (
                    <tr key={entry.income_id || idx} className={isDark ? 'hover:bg-[#18181b]' : 'hover:bg-gray-50'}>
                      <td className="p-2">{idx + 1}</td>
                      <td className="p-2">{entry.date}</td>
                      <td className={`p-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{entry.source}</td>
                      <td className="p-2">
                        <Badge className={`text-[10px] ${entry.invoice_type === 'GST' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {entry.invoice_type || entry.payment_type || 'Payment'}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">{formatCurrency(entry.amount)}</td>
                      <td className="p-2 text-right font-medium text-[#22c55e]">
                        {formatCurrency(entry.amount + (entry.tax_amount || 0))}
                      </td>
                    </tr>
                  ))}
                  {(!cashbookData?.credit?.entries?.length) && (
                    <tr><td colSpan={6} className={`p-6 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>No entries</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cash Out */}
          <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
            <div className="bg-[#ef4444] text-white p-3 flex items-center justify-between">
              <h3 className="font-semibold">Cash Out</h3>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">{formatCurrency(debitTotal)}</span>
                <Button size="sm" variant="secondary" onClick={() => setShowAddDebit(true)} className="bg-white/20 hover:bg-white/30 text-white">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-xs">
                <thead className={`sticky top-0 ${isDark ? 'bg-[#18181b]' : 'bg-gray-50'}`}>
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">To</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Remarks</th>
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
                          <Badge className="text-[10px]" style={{ backgroundColor: catColor.bg, color: catColor.text }}>
                            {entry.category_name || 'General'}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-medium text-[#ef4444]">{formatCurrency(entry.amount)}</td>
                        <td className="p-2 text-[10px] truncate max-w-[80px]">{entry.notes}</td>
                      </tr>
                    );
                  })}
                  {(!cashbookData?.debit?.entries?.length) && (
                    <tr><td colSpan={6} className={`p-6 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>No entries</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============ RENDER EXPENSE BUDGET ============
  const renderBudget = () => {
    if (selectedCategory) {
      // Category detail view
      return (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedCategory.name}</h3>
                  <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>
                    {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </p>
                </div>
              </div>
              {/* Summary */}
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <p className={isDark ? 'text-[#71717a]' : 'text-gray-500'}>Total</p>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(budgetData?.summary?.total)}</p>
                </div>
                <div className="text-center">
                  <p className={isDark ? 'text-[#71717a]' : 'text-gray-500'}>Paid</p>
                  <p className="font-bold text-[#22c55e]">{formatCurrency(budgetData?.summary?.paid)}</p>
                </div>
                <div className="text-center">
                  <p className={isDark ? 'text-[#71717a]' : 'text-gray-500'}>Balance</p>
                  <p className="font-bold text-[#ef4444]">{formatCurrency(budgetData?.summary?.balance)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
            <table className="w-full text-sm">
              <thead className={isDark ? 'bg-[#27272a]' : 'bg-gray-100'}>
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Balance</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-left">Remarks</th>
                  <th className="p-3 text-left">Transaction ID</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-100'}`}>
                {(budgetData?.entries || []).map(item => (
                  <tr key={item.entry_id} className={isDark ? 'hover:bg-[#18181b]' : 'hover:bg-gray-50'}>
                    <td className={`p-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</td>
                    <td className="p-3 text-right">{formatCurrency(item.total_amount)}</td>
                    <td className="p-3 text-right text-[#22c55e]">{formatCurrency(item.paid)}</td>
                    <td className="p-3 text-right text-[#ef4444]">{formatCurrency(item.balance)}</td>
                    <td className="p-3 text-center">
                      <Badge className={`text-xs ${
                        item.status === 'Paid' ? 'bg-green-100 text-green-700' :
                        item.status === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.status}
                      </Badge>
                    </td>
                    <td className={`p-3 text-xs ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>{item.remarks}</td>
                    <td className={`p-3 text-xs font-mono ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>
                      {item.transaction_ids?.join(', ') || '-'}
                    </td>
                  </tr>
                ))}
                {(!budgetData?.entries?.length) && (
                  <tr><td colSpan={7} className={`p-6 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>No items in this category</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Category list view
    return (
      <div className="space-y-4">
        <div className={`p-4 rounded-xl ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Expense Budget</h3>
              <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>
                {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Month Tabs */}
              <div className="flex gap-1">
                {months.slice(0, 6).map(m => (
                  <button
                    key={m.value}
                    onClick={() => setSelectedMonth(m.value)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                      selectedMonth === m.value
                        ? 'bg-[#6366f1] text-white'
                        : isDark ? 'bg-[#27272a] text-[#a1a1aa] hover:bg-[#3f3f46]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m.label.slice(0, 3)}
                  </button>
                ))}
              </div>
              <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
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

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
            <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Total Budget</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(budgetData?.summary?.total)}</p>
          </div>
          <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
            <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Paid</p>
            <p className="text-2xl font-bold text-[#22c55e]">{formatCurrency(budgetData?.summary?.paid)}</p>
          </div>
          <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
            <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Balance</p>
            <p className="text-2xl font-bold text-[#ef4444]">{formatCurrency(budgetData?.summary?.balance)}</p>
          </div>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {(budgetData?.categories || categories).map(cat => {
            const color = getCatColor(cat.name);
            return (
              <div
                key={cat.category_id}
                onClick={() => setSelectedCategory(cat)}
                className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-lg ${
                  isDark ? 'bg-[#18181b] border-[#27272a] hover:border-[#3f3f46]' : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge style={{ backgroundColor: color.bg, color: color.text }}>{cat.name}</Badge>
                  <ChevronRight className={`h-4 w-4 ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className={isDark ? 'text-[#71717a]' : 'text-gray-400'}>Total</p>
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(cat.total || 0)}</p>
                  </div>
                  <div>
                    <p className={isDark ? 'text-[#71717a]' : 'text-gray-400'}>Paid</p>
                    <p className="font-semibold text-[#22c55e]">{formatCurrency(cat.paid || 0)}</p>
                  </div>
                  <div>
                    <p className={isDark ? 'text-[#71717a]' : 'text-gray-400'}>Balance</p>
                    <p className="font-semibold text-[#ef4444]">{formatCurrency(cat.balance || 0)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============ RENDER OUTSTANDING REVENUE ============
  const renderOutstanding = () => (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Outstanding Revenue</h3>
            <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Track expected payments</p>
          </div>
          <Button onClick={() => setShowAddOutstanding(true)} className="bg-[#6366f1] hover:bg-[#5855eb]">
            <Plus className="h-4 w-4 mr-2" /> Add Outstanding
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Total Expected</p>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {formatCurrency(outstandingData.reduce((sum, o) => sum + o.amount, 0))}
          </p>
        </div>
        <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Received</p>
          <p className="text-2xl font-bold text-[#22c55e]">
            {formatCurrency(outstandingData.reduce((sum, o) => sum + (o.received_amount || 0), 0))}
          </p>
        </div>
        <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Balance</p>
          <p className="text-2xl font-bold text-[#ef4444]">
            {formatCurrency(outstandingData.reduce((sum, o) => sum + (o.balance || 0), 0))}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
        <table className="w-full text-sm">
          <thead className={`${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
            <tr>
              <th className="p-3 text-left">#</th>
              <th className="p-3 text-left">Expected Date</th>
              <th className="p-3 text-left">Project Name</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-left">Revenue Type</th>
              <th className="p-3 text-right">Received</th>
              <th className="p-3 text-right">Balance</th>
              <th className="p-3 text-left">Remarks</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-100'}`}>
            {outstandingData.map((item, idx) => {
              const typeColor = getProjectColor(item.project_type);
              return (
                <tr key={item.outstanding_id} className={isDark ? 'hover:bg-[#18181b]' : 'hover:bg-gray-50'}>
                  <td className="p-3">{idx + 1}</td>
                  <td className="p-3">{item.expected_date}</td>
                  <td className={`p-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.project_name}</td>
                  <td className="p-3">
                    <Badge className="text-xs" style={{ backgroundColor: typeColor.bg, color: typeColor.text }}>
                      {item.project_type}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                  <td className="p-3">
                    <Badge className={`text-xs ${
                      item.revenue_type === 'One-time' ? 'bg-blue-100 text-blue-700' :
                      item.revenue_type === 'Monthly' ? 'bg-green-100 text-green-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {item.revenue_type}
                    </Badge>
                  </td>
                  <td className="p-3 text-right text-[#22c55e]">{formatCurrency(item.received_amount)}</td>
                  <td className="p-3 text-right text-[#ef4444]">{formatCurrency(item.balance)}</td>
                  <td className={`p-3 text-xs ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>{item.remarks}</td>
                  <td className="p-3 text-center">
                    {item.balance > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedOutstanding(item);
                          setPaymentForm({ ...paymentForm, amount: item.balance.toString() });
                          setShowRecordPayment(true);
                        }}
                        className={isDark ? 'border-[#3f3f46]' : ''}
                      >
                        Record Payment
                      </Button>
                    )}
                    {item.status === 'received' && (
                      <Badge className="bg-green-100 text-green-700">Received</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {outstandingData.length === 0 && (
              <tr><td colSpan={10} className={`p-6 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>No outstanding revenue</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ============ MAIN RENDER ============
  return (
    <div className="space-y-6" data-testid="expense-tab">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between">
        <div className={`flex p-1 rounded-lg ${isDark ? 'bg-[#18181b]' : 'bg-gray-100'}`}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
            { id: 'cashbook', label: 'CashBook', icon: Wallet },
            { id: 'budget', label: 'Expense Budget', icon: Receipt },
            { id: 'outstanding', label: 'Outstanding', icon: Target },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${
                activeTab === tab.id
                  ? 'bg-[#6366f1] text-white'
                  : isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAll} className={isDark ? 'border-[#3f3f46]' : ''}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={initializeData} className={isDark ? 'border-[#3f3f46]' : ''}>
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
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'cashbook' && renderCashbook()}
          {activeTab === 'budget' && renderBudget()}
          {activeTab === 'outstanding' && renderOutstanding()}
        </>
      )}

      {/* Add Credit Modal */}
      <Dialog open={showAddCredit} onOpenChange={setShowAddCredit}>
        <DialogContent className={`max-w-xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Cash In</DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>Record income received</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Date</label>
              <Input type="date" value={creditForm.date} onChange={e => setCreditForm({...creditForm, date: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Invoice Type</label>
              <Select value={creditForm.invoice_type} onValueChange={v => setCreditForm({...creditForm, invoice_type: v})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GST">GST</SelectItem>
                  <SelectItem value="NO GST">NO GST</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Income From</label>
              <Input placeholder="Client/Source name" value={creditForm.income_from} onChange={e => setCreditForm({...creditForm, income_from: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Payment Type</label>
              <Select value={creditForm.payment_type} onValueChange={v => setCreditForm({...creditForm, payment_type: v})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Advance">Advance</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Full">Full</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Bank Account</label>
              <Select value={creditForm.bank_account_id || selectedAccount?.account_id} onValueChange={v => setCreditForm({...creditForm, bank_account_id: v})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => <SelectItem key={acc.account_id} value={acc.account_id}>{acc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Amount</label>
              <Input type="number" placeholder="0.00" value={creditForm.amount} onChange={e => setCreditForm({...creditForm, amount: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Tax %</label>
              <Select value={creditForm.tax_percent.toString()} onValueChange={v => setCreditForm({...creditForm, tax_percent: parseInt(v)})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 5, 12, 18, 28].map(t => <SelectItem key={t} value={t.toString()}>{t}%</SelectItem>)}
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
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Cash Out</DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>Record expense payment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Date</label>
                <Input type="date" value={debitForm.date} onChange={e => setDebitForm({...debitForm, date: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
              </div>
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Amount</label>
                <Input type="number" placeholder="0.00" value={debitForm.amount} onChange={e => setDebitForm({...debitForm, amount: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
              </div>
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Category</label>
              <Select value={debitForm.category_id} onValueChange={v => setDebitForm({...debitForm, category_id: v, existing_item_id: '', is_new_item: false})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => <SelectItem key={cat.category_id} value={cat.category_id}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {debitForm.category_id && (
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Expense To</label>
                <Select value={debitForm.existing_item_id || 'new'} onValueChange={v => {
                  if (v === 'new') setDebitForm({...debitForm, existing_item_id: '', is_new_item: true});
                  else {
                    const item = categoryItems.find(i => i.entry_id === v);
                    setDebitForm({...debitForm, existing_item_id: v, expense_to: item?.name || '', is_new_item: false});
                  }
                }}>
                  <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select or add new" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new"><Plus className="h-3 w-3 inline mr-1" />Add New</SelectItem>
                    {categoryItems.map(item => <SelectItem key={item.entry_id} value={item.entry_id}>{item.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {debitForm.is_new_item && (
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>New Expense Name</label>
                <Input placeholder="e.g., Anbarasan, Office Rent" value={debitForm.expense_to} onChange={e => setDebitForm({...debitForm, expense_to: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Bank Account</label>
                <Select value={debitForm.bank_account_id || selectedAccount?.account_id} onValueChange={v => setDebitForm({...debitForm, bank_account_id: v})}>
                  <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => <SelectItem key={acc.account_id} value={acc.account_id}>{acc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Remarks</label>
                <Input placeholder="Optional notes" value={debitForm.remarks} onChange={e => setDebitForm({...debitForm, remarks: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDebit(false)}>Cancel</Button>
            <Button onClick={handleAddDebit} className="bg-[#ef4444] hover:bg-[#dc2626]">Add Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Outstanding Modal */}
      <Dialog open={showAddOutstanding} onOpenChange={setShowAddOutstanding}>
        <DialogContent className={`max-w-xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Outstanding Revenue</DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>Track expected payment</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Project Name</label>
              <Input placeholder="Project/Client name" value={outstandingForm.project_name} onChange={e => setOutstandingForm({...outstandingForm, project_name: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Project Type</label>
              <Select value={outstandingForm.project_type} onValueChange={v => setOutstandingForm({...outstandingForm, project_type: v})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PROJECT_TYPE_COLORS).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Revenue Type</label>
              <Select value={outstandingForm.revenue_type} onValueChange={v => setOutstandingForm({...outstandingForm, revenue_type: v})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="One-time">One-time</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Expected Date</label>
              <Input type="date" value={outstandingForm.expected_date} onChange={e => setOutstandingForm({...outstandingForm, expected_date: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Amount</label>
              <Input type="number" placeholder="0.00" value={outstandingForm.amount} onChange={e => setOutstandingForm({...outstandingForm, amount: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
            <div className="col-span-2">
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Remarks</label>
              <Input placeholder="Optional notes" value={outstandingForm.remarks} onChange={e => setOutstandingForm({...outstandingForm, remarks: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddOutstanding(false)}>Cancel</Button>
            <Button onClick={handleAddOutstanding} className="bg-[#6366f1] hover:bg-[#5855eb]">Add Outstanding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={showRecordPayment} onOpenChange={setShowRecordPayment}>
        <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Record Payment</DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>
              {selectedOutstanding?.project_name} - Balance: {formatCurrency(selectedOutstanding?.balance)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Amount</label>
              <Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Payment Date</label>
              <Input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({...paymentForm, payment_date: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Payment Type</label>
              <Select value={paymentForm.payment_type} onValueChange={v => setPaymentForm({...paymentForm, payment_type: v})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Advance">Advance</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Full">Full</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Bank Account</label>
              <Select value={paymentForm.bank_account_id || selectedAccount?.account_id} onValueChange={v => setPaymentForm({...paymentForm, bank_account_id: v})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => <SelectItem key={acc.account_id} value={acc.account_id}>{acc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordPayment(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} className="bg-[#22c55e] hover:bg-[#16a34a]">Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseTab;
