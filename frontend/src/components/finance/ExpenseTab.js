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
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  PieChart,
  BarChart3,
  Table,
  LayoutDashboard,
  Filter,
  Search,
  Calendar,
  ChevronRight,
  MoreHorizontal,
  Edit2,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  IndianRupee,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Category colors
const CATEGORY_COLORS = {
  'Salary': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  'Office Expense': { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  'CEO': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  'Vendor Payments': { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  'Loans & Debts': { bg: '#faf5ff', text: '#9333ea', border: '#e9d5ff' },
  'Tools & Subscriptions': { bg: '#ecfeff', text: '#0891b2', border: '#a5f3fc' },
  'BNI': { bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8' },
  'Tax & Auditing': { bg: '#f7fee7', text: '#65a30d', border: '#d9f99d' },
  'Mentorship': { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  'Events & Networking': { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4' },
  'Courses & Books': { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe' },
  'Marketing & Branding': { bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe' },
};

const ExpenseTab = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');

  // View state
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'table'
  const [activeSection, setActiveSection] = useState('overview'); // 'overview' | 'cashbook' | 'master'
  
  // Data state
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [cashflowData, setCashflowData] = useState(null);
  const [masterData, setMasterData] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateRange, setDateRange] = useState('month'); // 'today' | 'week' | 'month' | 'quarter' | 'year'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fiscal year
  const [fiscalYear, setFiscalYear] = useState(() => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${String(year + 1).slice(2)}`;
  });
  
  // Modal state
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryType, setEntryType] = useState('debit');
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

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [accountsRes, categoriesRes, summaryRes] = await Promise.all([
        axios.get(`${API}/api/expense/bank-accounts`, { headers }),
        axios.get(`${API}/api/expense/categories`, { headers }),
        axios.get(`${API}/api/expense/summary`, { headers }),
      ]);
      
      setAccounts(accountsRes.data || []);
      setCategories(categoriesRes.data || []);
      setSummary(summaryRes.data || {});
      
      // Load cashflow for current month
      const now = new Date();
      const cashflowRes = await axios.get(`${API}/api/expense/cashflow`, {
        headers,
        params: { month: now.getMonth() + 1, year: now.getFullYear() }
      });
      setCashflowData(cashflowRes.data);
      
      // Combine recent transactions
      const credits = (cashflowRes.data?.credit?.entries || []).map(e => ({ ...e, type: 'credit' }));
      const debits = (cashflowRes.data?.debit?.entries || []).map(e => ({ ...e, type: 'debit' }));
      const combined = [...credits, ...debits].sort((a, b) => 
        new Date(b.date || b.payment_date) - new Date(a.date || a.payment_date)
      );
      setRecentTransactions(combined.slice(0, 10));
      
      // Load master expense
      const fyYear = parseInt(fiscalYear.split('-')[0]);
      const masterRes = await axios.get(`${API}/api/expense/master-view`, {
        headers,
        params: { fy_year: fyYear }
      });
      setMasterData(masterRes.data);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load expense data');
    } finally {
      setLoading(false);
    }
  }, [token, fiscalYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize default data
  const initializeData = async () => {
    try {
      await axios.post(`${API}/api/expense/initialize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Expense data initialized');
      loadData();
    } catch (error) {
      console.error('Error initializing:', error);
    }
  };

  // Add entry handler
  const handleAddEntry = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const accountId = selectedAccount === 'all' ? accounts[0]?.account_id : selectedAccount;
      
      if (entryType === 'credit') {
        await axios.post(`${API}/api/expense/income`, {
          source: newEntry.income_from,
          description: newEntry.remarks,
          amount: parseFloat(newEntry.amount),
          invoice_number: newEntry.invoice_number,
          payment_type: newEntry.payment_type,
          payment_cycle: newEntry.payment_cycle,
          date: newEntry.date,
          bank_account_id: accountId,
          tax_amount: (parseFloat(newEntry.amount) * newEntry.tax_percent / 100) || 0,
        }, { headers });
      } else {
        // First create expense entry, then record payment
        const entryRes = await axios.post(`${API}/api/expense/entries`, {
          category_id: newEntry.category_id,
          name: newEntry.expense_to,
          description: newEntry.remarks,
          total_amount: parseFloat(newEntry.amount),
          recurring: false,
        }, { headers });
        
        await axios.post(`${API}/api/expense/payments`, {
          entry_id: entryRes.data.entry_id,
          amount: parseFloat(newEntry.amount),
          payment_date: newEntry.date,
          bank_account_id: accountId,
          notes: newEntry.remarks,
          tax_amount: (parseFloat(newEntry.amount) * newEntry.tax_percent / 100) || 0,
        }, { headers });
      }
      
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
      loadData();
    } catch (error) {
      console.error('Error adding entry:', error);
      toast.error('Failed to add entry');
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Get category style
  const getCategoryStyle = (categoryName) => {
    return CATEGORY_COLORS[categoryName] || { bg: '#f3f4f6', text: '#4b5563', border: '#e5e7eb' };
  };

  // Calculate totals
  const totalCashIn = summary?.cash_in || cashflowData?.credit?.total || 0;
  const totalCashOut = summary?.cash_out || cashflowData?.debit?.total || 0;
  const currentBalance = summary?.balance || (totalCashIn - totalCashOut);
  const pendingAmount = summary?.need || 0;

  // Render Summary Cards
  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Cash In */}
      <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'} transition-all hover:shadow-lg`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg ${isDark ? 'bg-[#22c55e]/20' : 'bg-green-50'}`}>
            <ArrowDownCircle className="h-5 w-5 text-[#22c55e]" />
          </div>
          <Badge className="bg-[#22c55e]/10 text-[#22c55e] border-0">
            <TrendingUp className="h-3 w-3 mr-1" />
            +12%
          </Badge>
        </div>
        <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Total Cash In</p>
        <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(totalCashIn)}</p>
      </div>

      {/* Cash Out */}
      <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'} transition-all hover:shadow-lg`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg ${isDark ? 'bg-[#ef4444]/20' : 'bg-red-50'}`}>
            <ArrowUpCircle className="h-5 w-5 text-[#ef4444]" />
          </div>
          <Badge className="bg-[#ef4444]/10 text-[#ef4444] border-0">
            <TrendingDown className="h-3 w-3 mr-1" />
            -8%
          </Badge>
        </div>
        <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Total Cash Out</p>
        <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(totalCashOut)}</p>
      </div>

      {/* Balance */}
      <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'} transition-all hover:shadow-lg`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg ${isDark ? 'bg-[#6366f1]/20' : 'bg-indigo-50'}`}>
            <Wallet className="h-5 w-5 text-[#6366f1]" />
          </div>
          <CheckCircle className="h-5 w-5 text-[#22c55e]" />
        </div>
        <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Current Balance</p>
        <p className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{formatCurrency(currentBalance)}</p>
      </div>

      {/* Pending */}
      <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'} transition-all hover:shadow-lg`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg ${isDark ? 'bg-[#f59e0b]/20' : 'bg-amber-50'}`}>
            <Clock className="h-5 w-5 text-[#f59e0b]" />
          </div>
          <AlertCircle className="h-5 w-5 text-[#f59e0b]" />
        </div>
        <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Pending Payments</p>
        <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(pendingAmount)}</p>
      </div>
    </div>
  );

  // Render Account Cards
  const renderAccountCards = () => (
    <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Bank Accounts</h3>
        <Button variant="ghost" size="sm" className="text-[#6366f1]">
          <Plus className="h-4 w-4 mr-1" />
          Add Account
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {accounts.map((acc) => (
          <div
            key={acc.account_id}
            onClick={() => setSelectedAccount(acc.account_id)}
            className={`p-4 rounded-lg cursor-pointer transition-all ${
              selectedAccount === acc.account_id
                ? 'bg-[#6366f1] text-white'
                : isDark
                ? 'bg-[#27272a] hover:bg-[#3f3f46] text-white'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm font-medium truncate">{acc.name}</span>
            </div>
            <p className={`text-lg font-bold ${selectedAccount === acc.account_id ? 'text-white' : acc.current_balance >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {formatCurrency(acc.current_balance)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  // Render Category Breakdown
  const renderCategoryBreakdown = () => {
    const categoryData = masterData?.categories || [];
    const topCategories = categoryData
      .filter(c => c.grand_total > 0)
      .sort((a, b) => b.grand_total - a.grand_total)
      .slice(0, 6);

    return (
      <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Expense by Category</h3>
          <Button variant="ghost" size="sm" onClick={() => setActiveSection('master')} className="text-[#6366f1]">
            View All <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        
        {topCategories.length > 0 ? (
          <div className="space-y-3">
            {topCategories.map((cat) => {
              const style = getCategoryStyle(cat.name);
              const percentage = masterData?.grand_total?.total > 0 
                ? (cat.grand_total / masterData.grand_total.total * 100).toFixed(1)
                : 0;
              
              return (
                <div key={cat.category_id} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 text-xs font-medium rounded"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {cat.name}
                      </span>
                      <span className={`text-xs ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>
                        {percentage}%
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(cat.grand_total)}
                    </span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%`, backgroundColor: style.text }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`text-center py-8 ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>
            <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No expense data yet</p>
          </div>
        )}
      </div>
    );
  };

  // Render Recent Transactions
  const renderRecentTransactions = () => (
    <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Transactions</h3>
        <Button variant="ghost" size="sm" onClick={() => setActiveSection('cashbook')} className="text-[#6366f1]">
          View All <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      
      {recentTransactions.length > 0 ? (
        <div className="space-y-2">
          {recentTransactions.slice(0, 5).map((txn, idx) => {
            const isCredit = txn.type === 'credit';
            const date = txn.date || txn.payment_date;
            const name = isCredit ? txn.source : (txn.entry_name || txn.expense_to || 'Expense');
            
            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                  isDark ? 'hover:bg-[#27272a]' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isCredit ? 'bg-[#22c55e]/10' : 'bg-[#ef4444]/10'}`}>
                    {isCredit ? (
                      <ArrowDownCircle className="h-4 w-4 text-[#22c55e]" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 text-[#ef4444]" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{name}</p>
                    <p className={`text-xs ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>
                      {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${isCredit ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {isCredit ? '+' : '-'}{formatCurrency(txn.amount)}
                  </p>
                  {txn.category_name && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: getCategoryStyle(txn.category_name).bg,
                        color: getCategoryStyle(txn.category_name).text,
                      }}
                    >
                      {txn.category_name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`text-center py-8 ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>
          <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No transactions yet</p>
        </div>
      )}
    </div>
  );

  // Render Table View (Excel-like)
  const renderTableView = () => (
    <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
      {/* Table Header */}
      <div className={`grid grid-cols-12 gap-2 p-3 text-xs font-semibold uppercase ${isDark ? 'bg-[#27272a] text-[#a1a1aa]' : 'bg-gray-50 text-gray-500'}`}>
        <div className="col-span-1">Type</div>
        <div className="col-span-2">Date</div>
        <div className="col-span-3">Description</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-2 text-right">Amount</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>
      
      {/* Table Body */}
      <div className="divide-y divide-[#27272a]">
        {recentTransactions.map((txn, idx) => {
          const isCredit = txn.type === 'credit';
          const date = txn.date || txn.payment_date;
          const name = isCredit ? txn.source : (txn.entry_name || 'Expense');
          
          return (
            <div
              key={idx}
              className={`grid grid-cols-12 gap-2 p-3 items-center text-sm transition-all ${
                isDark ? 'hover:bg-[#27272a]/50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="col-span-1">
                {isCredit ? (
                  <Badge className="bg-[#22c55e]/10 text-[#22c55e] border-0 text-xs">IN</Badge>
                ) : (
                  <Badge className="bg-[#ef4444]/10 text-[#ef4444] border-0 text-xs">OUT</Badge>
                )}
              </div>
              <div className={`col-span-2 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>
                {new Date(date).toLocaleDateString('en-IN')}
              </div>
              <div className={`col-span-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {name}
              </div>
              <div className="col-span-2">
                {txn.category_name && (
                  <span
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: getCategoryStyle(txn.category_name).bg,
                      color: getCategoryStyle(txn.category_name).text,
                    }}
                  >
                    {txn.category_name}
                  </span>
                )}
              </div>
              <div className={`col-span-2 text-right font-semibold ${isCredit ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {isCredit ? '+' : '-'}{formatCurrency(txn.amount)}
              </div>
              <div className="col-span-2 text-right flex justify-end gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render Master Expense Section
  const renderMasterExpense = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setActiveSection('overview')} className={isDark ? 'text-white' : ''}>
          <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
          Back to Overview
        </Button>
        <Select value={fiscalYear} onValueChange={setFiscalYear}>
          <SelectTrigger className={`w-[140px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
            <SelectValue placeholder="Fiscal Year" />
          </SelectTrigger>
          <SelectContent>
            {['2024-25', '2025-26', '2026-27'].map((fy) => (
              <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(masterData?.categories || []).map((cat) => {
          const style = getCategoryStyle(cat.name);
          
          return (
            <div
              key={cat.category_id}
              className={`p-5 rounded-xl border cursor-pointer transition-all hover:shadow-lg ${
                isDark ? 'bg-[#18181b] border-[#27272a] hover:border-[#3f3f46]' : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="px-3 py-1 text-sm font-medium rounded-lg"
                  style={{ backgroundColor: style.bg, color: style.text }}
                >
                  {cat.name}
                </span>
                <ChevronRight className={`h-5 w-5 ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`} />
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className={`text-xs ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>Total</p>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(cat.grand_total || 0)}
                  </p>
                </div>
                <div>
                  <p className={`text-xs ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>Paid</p>
                  <p className="text-sm font-semibold text-[#22c55e]">
                    {formatCurrency(cat.grand_paid || 0)}
                  </p>
                </div>
                <div>
                  <p className={`text-xs ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>Balance</p>
                  <p className="text-sm font-semibold text-[#ef4444]">
                    {formatCurrency(cat.grand_balance || 0)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="expense-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Expense Management</h2>
          <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Track your income, expenses, and cash flow</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className={`flex p-1 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'}`}>
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'dashboard'
                  ? 'bg-[#6366f1] text-white'
                  : isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-[#6366f1] text-white'
                  : isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Table className="h-4 w-4" />
              Table View
            </button>
          </div>
          
          {/* Quick Actions */}
          <Button
            onClick={() => { setEntryType('credit'); setShowAddEntry(true); }}
            className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
          >
            <ArrowDownCircle className="h-4 w-4 mr-2" />
            Add Income
          </Button>
          <Button
            onClick={() => { setEntryType('debit'); setShowAddEntry(true); }}
            className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
          >
            <ArrowUpCircle className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`flex flex-wrap items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className={`h-4 w-4 ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`} />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`border-0 bg-transparent focus-visible:ring-0 ${isDark ? 'placeholder:text-[#71717a]' : ''}`}
          />
        </div>
        
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className={`w-[130px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className={`w-[150px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.category_id} value={cat.category_id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button variant="outline" size="sm" onClick={loadData} className={isDark ? 'border-[#3f3f46]' : ''}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        
        <Button variant="outline" size="sm" onClick={initializeData} className={isDark ? 'border-[#3f3f46]' : ''}>
          Initialize Data
        </Button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-[#6366f1]" />
        </div>
      ) : (
        <>
          {activeSection === 'overview' && viewMode === 'dashboard' && (
            <>
              {/* Summary Cards */}
              {renderSummaryCards()}
              
              {/* Account Cards */}
              {renderAccountCards()}
              
              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {renderCategoryBreakdown()}
                {renderRecentTransactions()}
              </div>
            </>
          )}
          
          {activeSection === 'overview' && viewMode === 'table' && renderTableView()}
          
          {activeSection === 'master' && renderMasterExpense()}
        </>
      )}

      {/* Add Entry Modal */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent className={`max-w-lg ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>
              {entryType === 'credit' ? 'Add Income' : 'Add Expense'}
            </DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>
              Record a new {entryType === 'credit' ? 'income' : 'expense'} transaction
            </DialogDescription>
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
                <div className="relative">
                  <IndianRupee className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`} />
                  <Input
                    type="number"
                    placeholder="0"
                    value={newEntry.amount}
                    onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                    className={`pl-9 ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}
                  />
                </div>
              </div>
            </div>

            {entryType === 'credit' ? (
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Income From</label>
                <Input
                  placeholder="Client or source name"
                  value={newEntry.income_from}
                  onChange={(e) => setNewEntry({ ...newEntry, income_from: e.target.value })}
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                />
              </div>
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

            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Notes (Optional)</label>
              <Input
                placeholder="Add any notes..."
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
              {entryType === 'credit' ? 'Add Income' : 'Add Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseTab;
