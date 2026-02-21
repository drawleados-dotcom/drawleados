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
  ChevronDown,
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
  Download,
  Settings,
  Trash2,
  Edit2,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';

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

// Default tabs
const DEFAULT_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, isDefault: true },
  { id: 'cashbook', label: 'Cashbook', icon: Wallet, isDefault: true },
  { id: 'expense', label: 'Expense', icon: TrendingDown, isDefault: true },
  { id: 'budget', label: 'Budget', icon: Receipt, isDefault: true },
  { id: 'invoice', label: 'Invoice', icon: FileText, isDefault: true },
  { id: 'outstanding', label: 'Outstanding', icon: Target, isDefault: true },
];

const ExpenseTab = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');

  // Tab management
  const [tabs, setTabs] = useState(() => {
    const saved = localStorage.getItem('finance_custom_tabs');
    return saved ? [...DEFAULT_TABS, ...JSON.parse(saved)] : DEFAULT_TABS;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddTab, setShowAddTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  
  // Category view state
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  // Data state
  const [dashboardData, setDashboardData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cashbookData, setCashbookData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [outstandingData, setOutstandingData] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [categoryItems, setCategoryItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [customTabData, setCustomTabData] = useState({});
  
  // Filter state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Modal states
  const [showAddCredit, setShowAddCredit] = useState(false);
  const [showAddDebit, setShowAddDebit] = useState(false);
  const [showAddOutstanding, setShowAddOutstanding] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showAddExpenseToCategory, setShowAddExpenseToCategory] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [selectedOutstanding, setSelectedOutstanding] = useState(null);
  const [targetCategory, setTargetCategory] = useState(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [creditStep, setCreditStep] = useState(1); // Step 1: Select type, Step 2: Select/Create invoice, Step 3: Enter amount
  
  // Form states
  const [creditForm, setCreditForm] = useState({
    date: new Date().toISOString().split('T')[0],
    income_from: '',
    invoice_type: 'GST',
    invoice_id: '',
    selected_invoice: null,
    create_new_invoice: false,
    payment_type: 'Full',
    payment_cycle: 'One-Time',
    amount: '',
    tax_percent: 18,
    bank_account_id: '',
  });
  
  // Create Invoice Form
  const [invoiceForm, setInvoiceForm] = useState({
    client_name: '',
    client_email: '',
    client_address: '',
    invoice_type: 'GST',
    items: [{ description: '', quantity: 1, rate: 0 }],
    tax_percent: 18,
    due_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
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
  
  const [expenseForm, setExpenseForm] = useState({
    name: '',
    total_amount: '',
    description: '',
    recurring: false,
  });
  
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    department: '',
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

  // ============== DATA LOADING ==============
  
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

  const loadUnpaidInvoices = useCallback(async (invoiceType) => {
    try {
      const res = await axios.get(`${API}/api/finance/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: 'unpaid', invoice_type: invoiceType }
      });
      // Filter unpaid invoices (pending, draft, partial)
      const unpaid = (res.data || []).filter(inv => 
        ['pending', 'draft', 'partial', 'sent'].includes(inv.status?.toLowerCase())
      );
      setUnpaidInvoices(unpaid);
    } catch (error) {
      console.error('Error loading unpaid invoices:', error);
      setUnpaidInvoices([]);
    }
  }, [token]);

  const loadInvoices = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/finance/invoices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoices(res.data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  }, [token]);

  const loadCategoryItems = useCallback(async (categoryId) => {
    try {
      const res = await axios.get(`${API}/api/expense/entries`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { category_id: categoryId }
      });
      setCategoryItems(prev => ({ ...prev, [categoryId]: res.data || [] }));
    } catch (error) {
      console.error('Error loading category items:', error);
    }
  }, [token]);

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
    if (activeTab === 'invoice') loadInvoices();
  }, [activeTab, selectedMonth, selectedYear, loadDashboard, loadCashbook, loadBudget, loadOutstanding, loadInvoices]);

  useEffect(() => {
    if (selectedCategory) loadBudget();
  }, [selectedCategory, loadBudget]);

  useEffect(() => {
    if (debitForm.category_id) loadCategoryItems(debitForm.category_id);
  }, [debitForm.category_id, loadCategoryItems]);

  // ============== UTILITIES ==============
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getCatColor = (name) => CATEGORY_COLORS[name] || { bg: '#f3f4f6', text: '#4b5563', dark: '#6b7280' };
  const getProjectColor = (type) => PROJECT_TYPE_COLORS[type] || { bg: '#f3f4f6', text: '#4b5563' };

  // ============== EXCEL EXPORT ==============
  
  const exportToExcel = (data, filename, sheetName = 'Sheet1') => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${filename}`);
  };

  const exportDashboard = () => {
    const data = [
      { Metric: 'Total Revenue', Value: dashboardData?.total_revenue || 0 },
      { Metric: 'Total Expense', Value: dashboardData?.total_expense || 0 },
      { Metric: 'Outstanding Amount', Value: dashboardData?.outstanding_amount || 0 },
      { Metric: 'Payment Due', Value: dashboardData?.payment_due || 0 },
      { Metric: 'Profit', Value: dashboardData?.profit || 0 },
      { Metric: 'Total Bank Balance', Value: dashboardData?.total_bank_balance || 0 },
    ];
    accounts.forEach(acc => {
      data.push({ Metric: `${acc.name} Balance`, Value: acc.current_balance || 0 });
    });
    exportToExcel(data, 'Finance_Dashboard', 'Dashboard');
  };

  const exportCashbook = () => {
    const creditData = (cashbookData?.credit?.entries || []).map((e, i) => ({
      'S.No': i + 1,
      'Type': 'Credit',
      'Date': e.date,
      'From/To': e.source,
      'Payment Type': e.payment_type || 'Payment',
      'Amount': e.amount,
      'Tax': e.tax_amount || 0,
      'Total': e.amount + (e.tax_amount || 0),
    }));
    const debitData = (cashbookData?.debit?.entries || []).map((e, i) => ({
      'S.No': i + 1,
      'Type': 'Debit',
      'Date': e.payment_date,
      'From/To': e.entry_name || 'Expense',
      'Category': e.category_name || 'General',
      'Amount': e.amount,
      'Tax': e.tax_amount || 0,
      'Total': e.amount + (e.tax_amount || 0),
      'Remarks': e.notes || '',
    }));
    exportToExcel([...creditData, ...debitData], 'Cashbook', 'Cashbook');
  };

  const exportExpense = () => {
    const data = [];
    categories.forEach(cat => {
      const items = categoryItems[cat.category_id] || [];
      items.forEach(item => {
        data.push({
          'Category': cat.name,
          'Item Name': item.name,
          'Total Amount': item.total_amount,
          'Total Paid': item.total_paid || 0,
          'Balance': item.balance || (item.total_amount - (item.total_paid || 0)),
          'Description': item.description || '',
        });
      });
    });
    exportToExcel(data, 'Expense_Items', 'Expenses');
  };

  const exportBudget = () => {
    const data = (budgetData?.categories || []).map(cat => ({
      'Category': cat.name,
      'Total Budget': cat.total || 0,
      'Paid': cat.paid || 0,
      'Balance': cat.balance || 0,
      'Items Count': cat.entry_count || 0,
    }));
    exportToExcel(data, 'Budget', 'Budget');
  };

  const exportInvoices = () => {
    const data = invoices.map(inv => ({
      'Invoice Number': inv.invoice_number,
      'Client': inv.client_name,
      'Date': inv.invoice_date,
      'Due Date': inv.due_date,
      'Amount': inv.total_amount,
      'Status': inv.status,
    }));
    exportToExcel(data, 'Invoices', 'Invoices');
  };

  const exportOutstanding = () => {
    const data = outstandingData.map((item, i) => ({
      'S.No': i + 1,
      'Expected Date': item.expected_date,
      'Project Name': item.project_name,
      'Project Type': item.project_type,
      'Amount': item.amount,
      'Revenue Type': item.revenue_type,
      'Received': item.received_amount || 0,
      'Balance': item.balance || 0,
      'Status': item.status,
      'Remarks': item.remarks || '',
    }));
    exportToExcel(data, 'Outstanding_Revenue', 'Outstanding');
  };

  // ============== TAB MANAGEMENT ==============
  
  const addCustomTab = () => {
    if (!newTabName.trim()) return;
    const newTab = {
      id: `custom_${Date.now()}`,
      label: newTabName.trim(),
      icon: FileSpreadsheet,
      isCustom: true,
    };
    const updatedTabs = [...tabs, newTab];
    setTabs(updatedTabs);
    localStorage.setItem('finance_custom_tabs', JSON.stringify(updatedTabs.filter(t => t.isCustom)));
    setNewTabName('');
    setShowAddTab(false);
    setActiveTab(newTab.id);
    toast.success(`Tab "${newTab.label}" created`);
  };

  const deleteCustomTab = (tabId) => {
    const updatedTabs = tabs.filter(t => t.id !== tabId);
    setTabs(updatedTabs);
    localStorage.setItem('finance_custom_tabs', JSON.stringify(updatedTabs.filter(t => t.isCustom)));
    if (activeTab === tabId) setActiveTab('dashboard');
    toast.success('Tab deleted');
  };

  // ============== HANDLERS ==============
  
  // Open Add Credit Modal and reset
  const openAddCreditModal = () => {
    setCreditStep(1);
    setCreditForm({
      date: new Date().toISOString().split('T')[0],
      income_from: '',
      invoice_type: 'GST',
      invoice_id: '',
      selected_invoice: null,
      create_new_invoice: false,
      payment_type: 'Full',
      payment_cycle: 'One-Time',
      amount: '',
      tax_percent: 18,
      bank_account_id: '',
    });
    setUnpaidInvoices([]);
    setShowAddCredit(true);
  };

  // Handle invoice type selection - load unpaid invoices
  const handleInvoiceTypeSelect = async (type) => {
    setCreditForm({ ...creditForm, invoice_type: type });
    await loadUnpaidInvoices(type);
    setCreditStep(2);
  };

  // Handle invoice selection
  const handleInvoiceSelect = (invoice) => {
    setCreditForm({
      ...creditForm,
      selected_invoice: invoice,
      invoice_id: invoice.invoice_id,
      income_from: invoice.client_name,
      amount: (invoice.total_amount - (invoice.paid_amount || 0)).toString(),
      tax_percent: invoice.tax_percent || 18,
    });
    setCreditStep(3);
  };

  // Open Create Invoice modal
  const openCreateInvoiceModal = () => {
    setInvoiceForm({
      client_name: '',
      client_email: '',
      client_address: '',
      invoice_type: creditForm.invoice_type,
      items: [{ description: '', quantity: 1, rate: 0 }],
      tax_percent: creditForm.invoice_type === 'GST' ? 18 : 0,
      due_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
    });
    setShowCreateInvoice(true);
  };

  // Add item to invoice
  const addInvoiceItem = () => {
    setInvoiceForm({
      ...invoiceForm,
      items: [...invoiceForm.items, { description: '', quantity: 1, rate: 0 }]
    });
  };

  // Remove item from invoice
  const removeInvoiceItem = (index) => {
    if (invoiceForm.items.length > 1) {
      setInvoiceForm({
        ...invoiceForm,
        items: invoiceForm.items.filter((_, i) => i !== index)
      });
    }
  };

  // Update invoice item
  const updateInvoiceItem = (index, field, value) => {
    const newItems = [...invoiceForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setInvoiceForm({ ...invoiceForm, items: newItems });
  };

  // Calculate invoice totals
  const calculateInvoiceTotal = () => {
    const subtotal = invoiceForm.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const taxAmount = (subtotal * invoiceForm.tax_percent) / 100;
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  // Create new invoice
  const handleCreateInvoice = async () => {
    try {
      const { subtotal, taxAmount, total } = calculateInvoiceTotal();
      
      // Format items with required fields for backend
      const formattedItems = invoiceForm.items.map(item => ({
        service_name: item.description,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.quantity * item.rate
      }));
      
      const res = await axios.post(`${API}/api/finance/invoices`, {
        client_name: invoiceForm.client_name,
        client_email: invoiceForm.client_email,
        client_address: invoiceForm.client_address || '',
        gst_type: invoiceForm.invoice_type === 'GST' ? 'gst' : 'non-gst',
        gst_rate: invoiceForm.tax_percent,
        invoice_date: new Date().toISOString(),
        due_date: new Date(invoiceForm.due_date).toISOString(),
        items: formattedItems,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Invoice created');
      setShowCreateInvoice(false);
      
      // Auto-select the new invoice
      const newInvoice = res.data;
      setCreditForm({
        ...creditForm,
        selected_invoice: newInvoice,
        invoice_id: newInvoice.invoice_id,
        income_from: newInvoice.client_name,
        amount: total.toString(),
        tax_percent: invoiceForm.tax_percent,
      });
      setCreditStep(3);
      
      // Refresh invoices list
      loadInvoices();
    } catch (error) {
      toast.error('Failed to create invoice');
    }
  };

  // Final submit - Add Income
  const handleAddCredit = async () => {
    try {
      const taxAmount = (parseFloat(creditForm.amount) * creditForm.tax_percent / 100) || 0;
      await axios.post(`${API}/api/expense/income`, {
        source: creditForm.income_from,
        description: `${creditForm.payment_type} - ${creditForm.invoice_type}`,
        amount: parseFloat(creditForm.amount),
        invoice_number: creditForm.invoice_id || creditForm.selected_invoice?.invoice_number,
        invoice_id: creditForm.selected_invoice?.invoice_id,
        payment_type: creditForm.payment_type,
        payment_cycle: creditForm.payment_cycle,
        date: creditForm.date,
        bank_account_id: creditForm.bank_account_id || selectedAccount?.account_id,
        tax_amount: taxAmount,
        invoice_type: creditForm.invoice_type,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update invoice status if linked
      if (creditForm.selected_invoice) {
        const paidAmount = (creditForm.selected_invoice.paid_amount || 0) + parseFloat(creditForm.amount);
        const newStatus = paidAmount >= creditForm.selected_invoice.total_amount ? 'paid' : 'partial';
        await axios.put(`${API}/api/finance/invoices/${creditForm.selected_invoice.invoice_id}`, {
          paid_amount: paidAmount,
          status: newStatus,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {}); // Ignore if update fails
      }
      
      toast.success('Income recorded');
      setShowAddCredit(false);
      setCreditStep(1);
      setCreditForm({
        date: new Date().toISOString().split('T')[0],
        income_from: '',
        invoice_type: 'GST',
        invoice_id: '',
        selected_invoice: null,
        create_new_invoice: false,
        payment_type: 'Full',
        payment_cycle: 'One-Time',
        amount: '',
        tax_percent: 18,
        bank_account_id: '',
      });
      loadCashbook();
      loadDashboard();
      loadAccounts();
      loadInvoices();
    } catch (error) {
      toast.error('Failed to add income');
    }
  };

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
      loadCategories();
    } catch (error) {
      toast.error('Failed to add expense');
    }
  };

  const handleAddExpenseToCategory = async () => {
    if (!targetCategory) return;
    try {
      await axios.post(`${API}/api/expense/entries`, {
        category_id: targetCategory.category_id,
        name: expenseForm.name,
        description: expenseForm.description,
        total_amount: parseFloat(expenseForm.total_amount),
        recurring: expenseForm.recurring,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Expense item added');
      setShowAddExpenseToCategory(false);
      setExpenseForm({ name: '', total_amount: '', description: '', recurring: false });
      loadCategoryItems(targetCategory.category_id);
      loadBudget();
    } catch (error) {
      toast.error('Failed to add expense item');
    }
  };

  const handleAddCategory = async () => {
    try {
      await axios.post(`${API}/api/expense/categories`, {
        name: categoryForm.name,
        category_type: 'expense',
        department: categoryForm.department,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Category added');
      setShowAddCategory(false);
      setCategoryForm({ name: '', department: '' });
      loadCategories();
    } catch (error) {
      toast.error('Failed to add category');
    }
  };

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

  const toggleCategory = async (categoryId) => {
    if (!expandedCategories[categoryId]) {
      await loadCategoryItems(categoryId);
    }
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  // ============ RENDER DASHBOARD ============
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-[#22c55e]/20">
              <TrendingUp className="h-5 w-5 text-[#22c55e]" />
            </div>
          </div>
          <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Total Revenue</p>
          <p className="text-2xl font-bold text-[#22c55e]">{formatCurrency(dashboardData?.total_revenue)}</p>
        </div>

        <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-[#f59e0b]/20">
              <Clock className="h-5 w-5 text-[#f59e0b]" />
            </div>
          </div>
          <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Payment Due</p>
          <p className="text-2xl font-bold text-[#f59e0b]">{formatCurrency(dashboardData?.payment_due)}</p>
        </div>

        <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-[#6366f1]/20">
              <Target className="h-5 w-5 text-[#6366f1]" />
            </div>
          </div>
          <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Outstanding</p>
          <p className="text-2xl font-bold text-[#6366f1]">{formatCurrency(dashboardData?.outstanding_amount)}</p>
        </div>

        <div className={`p-5 rounded-xl border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-[#ef4444]/20">
              <TrendingDown className="h-5 w-5 text-[#ef4444]" />
            </div>
          </div>
          <p className={`text-sm font-medium mb-1 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}`}>Total Expense</p>
          <p className="text-2xl font-bold text-[#ef4444]">{formatCurrency(dashboardData?.total_expense)}</p>
        </div>

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
            <div key={acc.account_id} className={`p-4 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-50'}`}>
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
        <Button onClick={openAddCreditModal} className="bg-[#22c55e] hover:bg-[#16a34a] h-auto py-4">
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

      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={exportDashboard} variant="outline" className={isDark ? 'border-[#3f3f46]' : ''}>
          <Download className="h-4 w-4 mr-2" /> Export Dashboard
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

        <div className="grid grid-cols-2 gap-4">
          {/* Cash In */}
          <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
            <div className="bg-[#22c55e] text-white p-3 flex items-center justify-between">
              <h3 className="font-semibold">Cash In</h3>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold">{formatCurrency(creditTotal)}</span>
                <Button size="sm" variant="secondary" onClick={openAddCreditModal} className="bg-white/20 hover:bg-white/30 text-white">
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

        {/* Export Button */}
        <div className="flex justify-end">
          <Button onClick={exportCashbook} variant="outline" className={isDark ? 'border-[#3f3f46]' : ''}>
            <Download className="h-4 w-4 mr-2" /> Export Cashbook
          </Button>
        </div>
      </div>
    );
  };

  // ============ RENDER EXPENSE (Category-based with accordion) ============
  const renderExpense = () => (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Expense Categories</h3>
            <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Click on a category to view and add expenses</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date Filters */}
            <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className={`w-[120px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
              <SelectTrigger className={`w-[90px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowAddCategory(true)} className="bg-[#6366f1] hover:bg-[#5855eb]">
              <Plus className="h-4 w-4 mr-2" /> Add Category
            </Button>
          </div>
        </div>
      </div>

      {/* Categories Accordion */}
      <div className="space-y-2">
        {categories.map(cat => {
          const color = getCatColor(cat.name);
          const isExpanded = expandedCategories[cat.category_id];
          const items = categoryItems[cat.category_id] || [];
          const totalAmount = items.reduce((sum, i) => sum + (i.total_amount || 0), 0);
          const totalPaid = items.reduce((sum, i) => sum + (i.total_paid || 0), 0);
          
          return (
            <div key={cat.category_id} className={`rounded-xl border overflow-hidden ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
              {/* Category Header */}
              <div
                onClick={() => toggleCategory(cat.category_id)}
                className={`p-4 cursor-pointer flex items-center justify-between transition-all ${
                  isDark ? 'bg-[#18181b] hover:bg-[#1f1f23]' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`} />
                  <Badge style={{ backgroundColor: color.bg, color: color.text }}>{cat.name}</Badge>
                  <span className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>
                    {items.length} items
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className={`text-xs ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Total</p>
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(totalAmount)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Paid</p>
                    <p className="font-semibold text-[#22c55e]">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Balance</p>
                    <p className="font-semibold text-[#ef4444]">{formatCurrency(totalAmount - totalPaid)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetCategory(cat);
                      setShowAddExpenseToCategory(true);
                    }}
                    className={isDark ? 'hover:bg-[#27272a]' : ''}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Expanded Items */}
              {isExpanded && (
                <div className={`border-t ${isDark ? 'border-[#27272a] bg-[#0f0f11]' : 'border-gray-100 bg-gray-50'}`}>
                  {items.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={isDark ? 'text-[#71717a]' : 'text-gray-500'}>
                          <th className="p-3 text-left font-medium">Name</th>
                          <th className="p-3 text-right font-medium">Total</th>
                          <th className="p-3 text-right font-medium">Paid</th>
                          <th className="p-3 text-right font-medium">Balance</th>
                          <th className="p-3 text-left font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-[#1f1f23]' : 'divide-gray-100'}`}>
                        {items.map(item => (
                          <tr key={item.entry_id} className={isDark ? 'hover:bg-[#18181b]' : 'hover:bg-white'}>
                            <td className={`p-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</td>
                            <td className="p-3 text-right">{formatCurrency(item.total_amount)}</td>
                            <td className="p-3 text-right text-[#22c55e]">{formatCurrency(item.total_paid || 0)}</td>
                            <td className="p-3 text-right text-[#ef4444]">{formatCurrency(item.balance || (item.total_amount - (item.total_paid || 0)))}</td>
                            <td className={`p-3 text-xs ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>{item.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className={`p-6 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>
                      No items in this category.
                      <button
                        onClick={() => {
                          setTargetCategory(cat);
                          setShowAddExpenseToCategory(true);
                        }}
                        className="text-[#6366f1] ml-1 hover:underline"
                      >
                        Add one
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={exportExpense} variant="outline" className={isDark ? 'border-[#3f3f46]' : ''}>
          <Download className="h-4 w-4 mr-2" /> Export Expenses
        </Button>
      </div>
    </div>
  );

  // ============ RENDER BUDGET ============
  const renderBudget = () => {
    if (selectedCategory) {
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
                  </tr>
                ))}
                {(!budgetData?.entries?.length) && (
                  <tr><td colSpan={6} className={`p-6 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>No items</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

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

        {/* Export Button */}
        <div className="flex justify-end">
          <Button onClick={exportBudget} variant="outline" className={isDark ? 'border-[#3f3f46]' : ''}>
            <Download className="h-4 w-4 mr-2" /> Export Budget
          </Button>
        </div>
      </div>
    );
  };

  // ============ RENDER INVOICE ============
  const renderInvoice = () => (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Invoices</h3>
            <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Manage all invoices</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportInvoices} className={isDark ? 'border-[#3f3f46]' : ''}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button className="bg-[#6366f1] hover:bg-[#5855eb]">
              <Plus className="h-4 w-4 mr-2" /> Create Invoice
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Total Invoices</p>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{invoices.length}</p>
        </div>
        <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Paid</p>
          <p className="text-2xl font-bold text-[#22c55e]">{invoices.filter(i => i.status === 'paid').length}</p>
        </div>
        <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Pending</p>
          <p className="text-2xl font-bold text-[#f59e0b]">{invoices.filter(i => i.status === 'pending').length}</p>
        </div>
        <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Overdue</p>
          <p className="text-2xl font-bold text-[#ef4444]">{invoices.filter(i => i.status === 'overdue').length}</p>
        </div>
      </div>

      <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
        <table className="w-full text-sm">
          <thead className={isDark ? 'bg-[#27272a]' : 'bg-gray-100'}>
            <tr>
              <th className="p-3 text-left">Invoice #</th>
              <th className="p-3 text-left">Client</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Due Date</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-100'}`}>
            {invoices.map(inv => (
              <tr key={inv.invoice_id} className={isDark ? 'hover:bg-[#18181b]' : 'hover:bg-gray-50'}>
                <td className={`p-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{inv.invoice_number}</td>
                <td className="p-3">{inv.client_name}</td>
                <td className="p-3">{inv.invoice_date}</td>
                <td className="p-3">{inv.due_date}</td>
                <td className="p-3 text-right font-medium">{formatCurrency(inv.total_amount)}</td>
                <td className="p-3 text-center">
                  <Badge className={`text-xs ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                    inv.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {inv.status}
                  </Badge>
                </td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-1">
                    <Button size="sm" variant="ghost"><FileText className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={7} className={`p-6 text-center ${isDark ? 'text-[#71717a]' : 'text-gray-400'}`}>No invoices</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ============ RENDER OUTSTANDING ============
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

      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={exportOutstanding} variant="outline" className={isDark ? 'border-[#3f3f46]' : ''}>
          <Download className="h-4 w-4 mr-2" /> Export Outstanding
        </Button>
      </div>
    </div>
  );

  // ============ RENDER CUSTOM TAB ============
  const renderCustomTab = (tab) => {
    const data = customTabData[tab.id] || [];
    
    return (
      <div className="space-y-4">
        <div className={`p-4 rounded-xl ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{tab.label}</h3>
              <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Custom tab - add your data</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className={isDark ? 'border-[#3f3f46]' : ''}>
                <Plus className="h-4 w-4 mr-2" /> Add Row
              </Button>
              <Button variant="outline" onClick={() => deleteCustomTab(tab.id)} className="text-red-500 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className={`p-8 rounded-xl border-2 border-dashed text-center ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
          <FileSpreadsheet className={`h-12 w-12 mx-auto mb-4 ${isDark ? 'text-[#3f3f46]' : 'text-gray-300'}`} />
          <p className={`text-lg font-medium ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Custom Tab: {tab.label}</p>
          <p className={`text-sm ${isDark ? 'text-[#52525b]' : 'text-gray-400'}`}>This is a customizable tab. Add your data here.</p>
          <Button className="mt-4 bg-[#6366f1] hover:bg-[#5855eb]">
            <Plus className="h-4 w-4 mr-2" /> Add Data
          </Button>
        </div>
      </div>
    );
  };

  // ============ MAIN RENDER ============
  return (
    <div className="space-y-6" data-testid="expense-tab">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between">
        <div className={`flex p-1 rounded-lg overflow-x-auto ${isDark ? 'bg-[#18181b]' : 'bg-gray-100'}`}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#6366f1] text-white'
                    : isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.isCustom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCustomTab(tab.id);
                    }}
                    className="ml-1 p-0.5 rounded hover:bg-white/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </button>
            );
          })}
          {/* Add Custom Tab Button */}
          <button
            onClick={() => setShowAddTab(true)}
            className={`px-3 py-2 text-sm font-medium rounded-md flex items-center gap-1 transition-all ${
              isDark ? 'text-[#71717a] hover:text-[#a1a1aa]' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Plus className="h-4 w-4" />
          </button>
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
          {activeTab === 'expense' && renderExpense()}
          {activeTab === 'budget' && renderBudget()}
          {activeTab === 'invoice' && renderInvoice()}
          {activeTab === 'outstanding' && renderOutstanding()}
          {tabs.find(t => t.id === activeTab && t.isCustom) && renderCustomTab(tabs.find(t => t.id === activeTab))}
        </>
      )}

      {/* Add Custom Tab Modal */}
      <Dialog open={showAddTab} onOpenChange={setShowAddTab}>
        <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Custom Tab</DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>Create a new tab for custom data</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Tab Name</label>
            <Input
              placeholder="e.g., Q1 Budget, Project Expenses"
              value={newTabName}
              onChange={e => setNewTabName(e.target.value)}
              className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTab(false)}>Cancel</Button>
            <Button onClick={addCustomTab} className="bg-[#6366f1] hover:bg-[#5855eb]">Create Tab</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Credit Modal - Multi-Step Flow */}
      <Dialog open={showAddCredit} onOpenChange={(open) => { if (!open) { setShowAddCredit(false); setCreditStep(1); } }}>
        <DialogContent className={`max-w-2xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>
              Add Cash In {creditStep > 1 && `- Step ${creditStep}/3`}
            </DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>
              {creditStep === 1 && 'Select invoice type'}
              {creditStep === 2 && 'Select existing invoice or create new'}
              {creditStep === 3 && 'Enter payment details'}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Select Invoice Type */}
          {creditStep === 1 && (
            <div className="py-6">
              <p className={`text-sm mb-4 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Select the type of invoice:</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleInvoiceTypeSelect('GST')}
                  className={`p-6 rounded-xl border-2 transition-all hover:border-[#6366f1] ${
                    isDark ? 'bg-[#27272a] border-[#3f3f46] hover:bg-[#2d2d32]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className="p-3 rounded-full bg-[#22c55e]/20 mb-3">
                      <Receipt className="h-8 w-8 text-[#22c55e]" />
                    </div>
                    <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>GST Invoice</span>
                    <span className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>With 18% GST</span>
                  </div>
                </button>
                <button
                  onClick={() => handleInvoiceTypeSelect('NO GST')}
                  className={`p-6 rounded-xl border-2 transition-all hover:border-[#6366f1] ${
                    isDark ? 'bg-[#27272a] border-[#3f3f46] hover:bg-[#2d2d32]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className="p-3 rounded-full bg-[#f59e0b]/20 mb-3">
                      <FileText className="h-8 w-8 text-[#f59e0b]" />
                    </div>
                    <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>NO GST Invoice</span>
                    <span className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Without GST</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select Invoice or Create New */}
          {creditStep === 2 && (
            <div className="py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setCreditStep(1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Badge className={creditForm.invoice_type === 'GST' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                    {creditForm.invoice_type}
                  </Badge>
                </div>
                <Button onClick={openCreateInvoiceModal} className="bg-[#6366f1] hover:bg-[#5855eb]">
                  <Plus className="h-4 w-4 mr-2" /> Create New Invoice
                </Button>
              </div>

              {unpaidInvoices.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <p className={`text-sm font-medium mb-2 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>
                    Select from unpaid invoices:
                  </p>
                  {unpaidInvoices.map(inv => (
                    <button
                      key={inv.invoice_id}
                      onClick={() => handleInvoiceSelect(inv)}
                      className={`w-full p-4 rounded-lg border text-left transition-all hover:border-[#6366f1] ${
                        isDark ? 'bg-[#27272a] border-[#3f3f46] hover:bg-[#2d2d32]' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {inv.invoice_number}
                            </span>
                            <Badge className="text-xs bg-orange-100 text-orange-700">{inv.status}</Badge>
                          </div>
                          <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>
                            {inv.client_name} • {inv.invoice_date}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {formatCurrency(inv.total_amount)}
                          </p>
                          <p className="text-sm text-[#ef4444]">
                            Due: {formatCurrency(inv.total_amount - (inv.paid_amount || 0))}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`p-8 rounded-xl border-2 border-dashed text-center ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`}>
                  <FileText className={`h-12 w-12 mx-auto mb-3 ${isDark ? 'text-[#3f3f46]' : 'text-gray-300'}`} />
                  <p className={`text-lg font-medium ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>
                    No unpaid {creditForm.invoice_type} invoices
                  </p>
                  <p className={`text-sm ${isDark ? 'text-[#52525b]' : 'text-gray-400'}`}>
                    Create a new invoice to record this income
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Enter Payment Details */}
          {creditStep === 3 && (
            <div className="py-4">
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="sm" onClick={() => setCreditStep(2)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {creditForm.selected_invoice && (
                  <Badge className="bg-purple-100 text-purple-700">
                    {creditForm.selected_invoice.invoice_number}
                  </Badge>
                )}
              </div>

              {creditForm.selected_invoice && (
                <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-[#27272a]' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {creditForm.selected_invoice.client_name}
                      </p>
                      <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>
                        Invoice: {creditForm.selected_invoice.invoice_number}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>Total: {formatCurrency(creditForm.selected_invoice.total_amount)}</p>
                      <p className="font-semibold text-[#ef4444]">
                        Due: {formatCurrency(creditForm.selected_invoice.total_amount - (creditForm.selected_invoice.paid_amount || 0))}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Date</label>
                  <Input type="date" value={creditForm.date} onChange={e => setCreditForm({...creditForm, date: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
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
                  <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Payment Cycle</label>
                  <Select value={creditForm.payment_cycle} onValueChange={v => setCreditForm({...creditForm, payment_cycle: v})}>
                    <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="One-Time">One-Time</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Half-Yearly">Half-Yearly</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
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
                  <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Amount Received</label>
                  <Input type="number" placeholder="0.00" value={creditForm.amount} onChange={e => setCreditForm({...creditForm, amount: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
                </div>
                <div>
                  <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Tax % (if applicable)</label>
                  <Select value={creditForm.tax_percent.toString()} onValueChange={v => setCreditForm({...creditForm, tax_percent: parseInt(v)})}>
                    <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 5, 12, 18, 28].map(t => <SelectItem key={t} value={t.toString()}>{t}%</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddCredit(false); setCreditStep(1); }}>Cancel</Button>
            {creditStep === 3 && (
              <Button onClick={handleAddCredit} className="bg-[#22c55e] hover:bg-[#16a34a]">Add Income</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Modal */}
      <Dialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice}>
        <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Create New Invoice</DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>
              Create a {creditForm.invoice_type} invoice
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Client Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Client Name *</label>
                <Input 
                  placeholder="Client/Company name" 
                  value={invoiceForm.client_name} 
                  onChange={e => setInvoiceForm({...invoiceForm, client_name: e.target.value})} 
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} 
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Client Email</label>
                <Input 
                  type="email"
                  placeholder="client@example.com" 
                  value={invoiceForm.client_email} 
                  onChange={e => setInvoiceForm({...invoiceForm, client_email: e.target.value})} 
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} 
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Due Date</label>
                <Input 
                  type="date"
                  value={invoiceForm.due_date} 
                  onChange={e => setInvoiceForm({...invoiceForm, due_date: e.target.value})} 
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} 
                />
              </div>
            </div>

            {/* Invoice Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Invoice Items</label>
                <Button size="sm" variant="outline" onClick={addInvoiceItem} className={isDark ? 'border-[#3f3f46]' : ''}>
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {invoiceForm.items.map((item, index) => (
                  <div key={index} className={`p-3 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-50'}`}>
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <Input 
                          placeholder="Description" 
                          value={item.description} 
                          onChange={e => updateInvoiceItem(index, 'description', e.target.value)} 
                          className={`text-sm ${isDark ? 'bg-[#18181b] border-[#3f3f46]' : ''}`} 
                        />
                      </div>
                      <div className="col-span-2">
                        <Input 
                          type="number" 
                          placeholder="Qty" 
                          value={item.quantity} 
                          onChange={e => updateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 0)} 
                          className={`text-sm ${isDark ? 'bg-[#18181b] border-[#3f3f46]' : ''}`} 
                        />
                      </div>
                      <div className="col-span-3">
                        <Input 
                          type="number" 
                          placeholder="Rate" 
                          value={item.rate} 
                          onChange={e => updateInvoiceItem(index, 'rate', parseFloat(e.target.value) || 0)} 
                          className={`text-sm ${isDark ? 'bg-[#18181b] border-[#3f3f46]' : ''}`} 
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        {invoiceForm.items.length > 1 && (
                          <Button size="sm" variant="ghost" onClick={() => removeInvoiceItem(index)} className="text-red-500 hover:text-red-600 p-1">
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className={`text-right text-sm mt-1 ${isDark ? 'text-[#71717a]' : 'text-gray-500'}`}>
                      = {formatCurrency(item.quantity * item.rate)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax & Total */}
            <div className={`p-4 rounded-lg ${isDark ? 'bg-[#27272a]' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}>Subtotal</span>
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(calculateInvoiceTotal().subtotal)}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}>Tax</span>
                  <Select value={invoiceForm.tax_percent.toString()} onValueChange={v => setInvoiceForm({...invoiceForm, tax_percent: parseInt(v)})}>
                    <SelectTrigger className={`w-20 h-8 ${isDark ? 'bg-[#18181b] border-[#3f3f46]' : ''}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 5, 12, 18, 28].map(t => <SelectItem key={t} value={t.toString()}>{t}%</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(calculateInvoiceTotal().taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-dashed">
                <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Total</span>
                <span className="text-xl font-bold text-[#22c55e]">{formatCurrency(calculateInvoiceTotal().total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateInvoice(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateInvoice} 
              disabled={!invoiceForm.client_name || invoiceForm.items.every(i => !i.description)}
              className="bg-[#6366f1] hover:bg-[#5855eb]"
            >
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Debit Modal */}
      <Dialog open={showAddDebit} onOpenChange={setShowAddDebit}>
        <DialogContent className={`max-w-xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>>
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
                    const items = categoryItems[debitForm.category_id] || [];
                    const item = items.find(i => i.entry_id === v);
                    setDebitForm({...debitForm, existing_item_id: v, expense_to: item?.name || '', is_new_item: false});
                  }
                }}>
                  <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select or add new" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new"><Plus className="h-3 w-3 inline mr-1" />Add New</SelectItem>
                    {(categoryItems[debitForm.category_id] || []).map(item => <SelectItem key={item.entry_id} value={item.entry_id}>{item.name}</SelectItem>)}
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

      {/* Add Expense to Category Modal */}
      <Dialog open={showAddExpenseToCategory} onOpenChange={setShowAddExpenseToCategory}>
        <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Expense to {targetCategory?.name}</DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>Add a new expense item</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Name</label>
              <Input placeholder="e.g., Office Rent, Employee Name" value={expenseForm.name} onChange={e => setExpenseForm({...expenseForm, name: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Total Amount</label>
              <Input type="number" placeholder="0.00" value={expenseForm.total_amount} onChange={e => setExpenseForm({...expenseForm, total_amount: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Description</label>
              <Input placeholder="Optional description" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExpenseToCategory(false)}>Cancel</Button>
            <Button onClick={handleAddExpenseToCategory} className="bg-[#6366f1] hover:bg-[#5855eb]">Add Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Modal */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className={`max-w-md ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDark ? 'text-white' : ''}>Add Category</DialogTitle>
            <DialogDescription className={isDark ? 'text-[#a1a1aa]' : ''}>Create a new expense category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Category Name</label>
              <Input placeholder="e.g., Travel, Utilities" value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''} />
            </div>
            <div>
              <label className={`text-sm font-medium ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>Department</label>
              <Select value={categoryForm.department} onValueChange={v => setCategoryForm({...categoryForm, department: v})}>
                <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Executive">Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategory(false)}>Cancel</Button>
            <Button onClick={handleAddCategory} className="bg-[#6366f1] hover:bg-[#5855eb]">Add Category</Button>
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
