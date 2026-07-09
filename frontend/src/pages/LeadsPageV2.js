import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar as CalendarPicker } from '../components/ui/calendar';
import { toast } from 'sonner';
import axios from 'axios';
import SheetConnectModal from '../components/SheetConnectModal';
import LeadInvoiceRaiseModal from '../components/finance/LeadInvoiceRaiseModal';
import { useAuth } from '../contexts/AuthContext';
import useAutoRefresh from '../hooks/useAutoRefresh';
import {
  Plus,
  Search,
  Filter,
  Users,
  Phone,
  Mail,
  Calendar,
  Edit2,
  Trash2,
  Eye,
  MoreHorizontal,
  Table2,
  LayoutGrid,
  Columns3,
  Settings,
  Link2,
  RefreshCw,
  FileSpreadsheet,
  X,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ExternalLink,
  Clock,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LeadsPageV2 = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Data state
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState([]);
  // Mini popup for stages that need a date+time — Appointment / Appointment
  // Reschedule / Followup / Prospect Followup. Stores the target stage and a
  // working date+time before commit.
  const [stageDateModal, setStageDateModal] = useState(null);
  const [stageDateValue, setStageDateValue] = useState('');
  const [stageTimeValue, setStageTimeValue] = useState('');
  const [stageDateSaving, setStageDateSaving] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [stats, setStats] = useState({ total: 0, by_stage: {} });
  const [sheetsConfig, setSheetsConfig] = useState(null);
  // New: separate Prospect & Lead sheet configs
  const [prospectCfg, setProspectCfg] = useState(null);
  const [leadCfg, setLeadCfg] = useState(null);
  const [showProspectSheetModal, setShowProspectSheetModal] = useState(false);
  const [showLeadSheetModal, setShowLeadSheetModal] = useState(false);
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Dropdown data
  const [services, setServices] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // UI state
  const [viewMode, setViewMode] = useState('list'); // 'list' only
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState(null); // Filter by stage when clicking stats cards
  const [filterLeadOwner, setFilterLeadOwner] = useState(null); // Filter by lead owner
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined }); // Default: All Time
  const [showDatePopover, setShowDatePopover] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showStagesModal, setShowStagesModal] = useState(false);
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);

  // Invoice Raise (Sales → Finance) modal — opens when a lead is moved into the "Invoice Raise" stage
  const [invoiceRaiseLead, setInvoiceRaiseLead] = useState(null);
  
  // Add new service/industry modal state
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showAddIndustryModal, setShowAddIndustryModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newIndustryName, setNewIndustryName] = useState('');
  
  // Import/Export state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importTemplate, setImportTemplate] = useState(null);
  const [importing, setImporting] = useState(false);

  // Form state - comprehensive lead form
  const [leadForm, setLeadForm] = useState({
    // Basic Details
    name: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    social_media: '',
    company_name: '',
    what_do_you_do: '',
    // Lead Details
    source: '',
    lead_owner: '',
    service: '',
    priority: 'Medium',
    lead_type: '',
    date_of_lead: new Date().toISOString().split('T')[0],
    industry: '',
    estimation: '',
    quotation_link: '',
    proposal_link: '',
    notes: '',
    stage_id: '',
    custom_fields: {},
  });

  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#3b82f6');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');

  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('Sheet1');

  // Follow-up modal state
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpLead, setFollowUpLead] = useState(null);
  const [followUpRemarks, setFollowUpRemarks] = useState('');

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  // ============== DATA LOADING ==============

  const loadLeads = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/leads-v2/leads`, { headers });
      setLeads(res.data || []);
    } catch (error) {
      console.error('Error loading leads:', error);
    }
  }, []);

  const loadStages = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/leads-v2/stages`, { headers });
      setStages(res.data || []);
    } catch (error) {
      console.error('Error loading stages:', error);
    }
  }, []);

  const loadCustomFields = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/leads-v2/custom-fields`, { headers });
      setCustomFields(res.data || []);
    } catch (error) {
      console.error('Error loading custom fields:', error);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/leads-v2/stats`, { headers });
      setStats(res.data || { total: 0, by_stage: {} });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  const loadSheetsConfig = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/leads-v2/google-sheets/config`, { headers });
      setSheetsConfig(res.data || null);
    } catch (error) {
      console.error('Error loading sheets config:', error);
    }
    // Also load the new dual-sheet (Prospect/Lead) configs
    try {
      const res2 = await axios.get(`${API}/api/sheets/configs`, { headers });
      setProspectCfg(res2.data?.prospect || null);
      setLeadCfg(res2.data?.lead || null);
    } catch (e) { /* ignore */ }
  }, []);

  const loadServices = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/leads-v2/services`, { headers });
      setServices(res.data || []);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  }, []);

  const loadIndustries = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/leads-v2/industries`, { headers });
      setIndustries(res.data || []);
    } catch (error) {
      console.error('Error loading industries:', error);
    }
  }, []);

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/leads-v2/team-members`, { headers });
      setTeamMembers(res.data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        loadStages(),
        loadLeads(),
        loadCustomFields(),
        loadStats(),
        loadSheetsConfig(),
        loadServices(),
        loadIndustries(),
        loadTeamMembers(),
      ]);
      setLoading(false);
    };
    loadAll();
  }, [loadStages, loadLeads, loadCustomFields, loadStats, loadSheetsConfig, loadServices, loadIndustries, loadTeamMembers]);

  // Background polling + focus refresh — keeps leads + stats live
  useAutoRefresh([loadLeads, loadStats]);

  // Show OAuth callback results (success / error) returned via URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sheets_connected') === '1') {
      const t = params.get('sheet_type') || 'sheet';
      toast.success(`Google ${t === 'lead' ? 'Lead' : 'Prospect'} Sheet connected!`);
      window.history.replaceState({}, '', window.location.pathname);
    }
    const err = params.get('sheets_error');
    if (err) {
      const detail = params.get('detail') || '';
      const map = {
        invalid_state: 'OAuth session expired. Please click Connect and finish in the same browser.',
        missing_scopes: `Google Sheets permission missing: ${detail}. Please grant Sheets access.`,
        callback_failed: `Sheets connection failed: ${detail || 'unknown error'}`,
      };
      toast.error(map[err] || `Sheets error: ${err}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // ============== LEAD ACTIONS ==============

  const createLead = async () => {
    if (!leadForm.name.trim()) {
      toast.error('Lead name is required');
      return;
    }
    try {
      const data = { ...leadForm };
      if (!data.stage_id && stages.length > 0) {
        data.stage_id = stages[0].stage_id;
      }
      await axios.post(`${API}/api/leads-v2/leads`, data, { headers });
      toast.success('Lead created');
      setShowAddLeadModal(false);
      resetLeadForm();
      loadLeads();
      loadStats();
    } catch (error) {
      toast.error('Failed to create lead');
    }
  };

  const updateLead = async () => {
    if (!editingLead) return;
    try {
      await axios.put(`${API}/api/leads-v2/leads/${editingLead.lead_id}`, leadForm, { headers });
      toast.success('Lead updated');
      setShowAddLeadModal(false);
      setEditingLead(null);
      resetLeadForm();
      loadLeads();
      loadStats();
    } catch (error) {
      toast.error('Failed to update lead');
    }
  };

  const deleteLead = async (leadId) => {
    if (!window.confirm('Delete this lead?')) return;
    try {
      await axios.delete(`${API}/api/leads-v2/leads/${leadId}`, { headers });
      toast.success('Lead deleted');
      loadLeads();
      loadStats();
    } catch (error) {
      toast.error('Failed to delete lead');
    }
  };

  const updateLeadStage = async (leadId, stageId) => {
    try {
      await axios.put(`${API}/api/leads-v2/leads/${leadId}/stage`, { stage_id: stageId }, { headers });
      // Detect transition to the special "Invoice Raise" stage by name and pop the billing-request modal.
      const stageName = (stages.find(s => s.stage_id === stageId)?.name || '').toLowerCase().trim();
      if (stageName === 'invoice raise' || stageName === 'invoice_raise' || stageName === 'invoiceraise') {
        const lead = leads.find(l => l.lead_id === leadId) || (editingLead && editingLead.lead_id === leadId ? editingLead : null);
        if (lead) setInvoiceRaiseLead(lead);
      }
      loadLeads();
      loadStats();
    } catch (error) {
      toast.error('Failed to update lead stage');
    }
  };

  const resetLeadForm = () => {
    setLeadForm({
      // Basic Details
      name: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      social_media: '',
      company_name: '',
      what_do_you_do: '',
      // Lead Details
      source: '',
      lead_owner: '',
      service: '',
      priority: 'Medium',
      lead_type: '',
      date_of_lead: new Date().toISOString().split('T')[0],
      industry: '',
      estimation: '',
      quotation_link: '',
      proposal_link: '',
      notes: '',
      stage_id: stages.length > 0 ? stages[0].stage_id : '',
      custom_fields: {},
    });
  };

  const openEditLead = (lead) => {
    setEditingLead(lead);
    setLeadForm({
      // Basic Details
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      location: lead.location || '',
      website: lead.website || '',
      social_media: lead.social_media || '',
      company_name: lead.company_name || '',
      what_do_you_do: lead.what_do_you_do || '',
      // Lead Details
      source: lead.source || '',
      lead_owner: lead.lead_owner || '',
      service: lead.service || '',
      priority: lead.priority || 'Medium',
      lead_type: lead.lead_type || '',
      date_of_lead: lead.date_of_lead || new Date().toISOString().split('T')[0],
      industry: lead.industry || '',
      estimation: lead.estimation || '',
      quotation_link: lead.quotation_link || '',
      proposal_link: lead.proposal_link || '',
      notes: lead.notes || '',
      stage_id: lead.stage_id || '',
      custom_fields: lead.custom_fields || {},
    });
    setShowAddLeadModal(true);
  };

  // ============== STAGE ACTIONS ==============

  const createStage = async () => {
    if (!newStageName.trim()) {
      toast.error('Stage name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/leads-v2/stages`, {
        name: newStageName,
        color: newStageColor
      }, { headers });
      toast.success('Stage created');
      setNewStageName('');
      setNewStageColor('#3b82f6');
      loadStages();
      loadStats();
    } catch (error) {
      toast.error('Failed to create stage');
    }
  };

  const deleteStage = async (stageId) => {
    if (!window.confirm('Delete this stage?')) return;
    try {
      await axios.delete(`${API}/api/leads-v2/stages/${stageId}`, { headers });
      toast.success('Stage deleted');
      loadStages();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete stage');
    }
  };

  const moveStageUp = async (index) => {
    if (index === 0) return;
    const newStages = [...stages];
    [newStages[index - 1], newStages[index]] = [newStages[index], newStages[index - 1]];
    
    // Update orders
    const stageOrders = newStages.map((stage, i) => ({
      stage_id: stage.stage_id,
      order: i
    }));
    
    try {
      await axios.put(`${API}/api/leads-v2/stages/reorder`, { stages: stageOrders }, { headers });
      setStages(newStages);
      toast.success('Stage order updated');
    } catch (error) {
      toast.error('Failed to reorder stages');
    }
  };

  const moveStageDown = async (index) => {
    if (index === stages.length - 1) return;
    const newStages = [...stages];
    [newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]];
    
    // Update orders
    const stageOrders = newStages.map((stage, i) => ({
      stage_id: stage.stage_id,
      order: i
    }));
    
    try {
      await axios.put(`${API}/api/leads-v2/stages/reorder`, { stages: stageOrders }, { headers });
      setStages(newStages);
      toast.success('Stage order updated');
    } catch (error) {
      toast.error('Failed to reorder stages');
    }
  };

  // ============== FOLLOW-UP ACTIONS ==============

  const openFollowUpModal = (lead) => {
    setFollowUpLead(lead);
    setFollowUpRemarks('');
    setShowFollowUpModal(true);
  };

  const submitFollowUp = async () => {
    if (!followUpLead) return;
    if (!followUpRemarks.trim()) {
      toast.error('Please enter remarks');
      return;
    }
    
    try {
      await axios.post(`${API}/api/leads-v2/leads/${followUpLead.lead_id}/followups`, {
        remarks: followUpRemarks.trim()
      }, { headers });
      
      toast.success('Follow-up added');
      setShowFollowUpModal(false);
      setFollowUpLead(null);
      setFollowUpRemarks('');
      loadLeads();
    } catch (error) {
      toast.error('Failed to add follow-up');
    }
  };

  // ============== SERVICE & INDUSTRY ACTIONS ==============

  const addNewService = async () => {
    if (!newServiceName.trim()) {
      toast.error('Service name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/leads-v2/services`, { name: newServiceName }, { headers });
      toast.success('Service added');
      setNewServiceName('');
      setShowAddServiceModal(false);
      loadServices();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add service');
    }
  };

  const addNewIndustry = async () => {
    if (!newIndustryName.trim()) {
      toast.error('Industry name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/leads-v2/industries`, { name: newIndustryName }, { headers });
      toast.success('Industry added');
      setNewIndustryName('');
      setShowAddIndustryModal(false);
      loadIndustries();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add industry');
    }
  };

  // ============== CUSTOM FIELD ACTIONS ==============

  const createCustomField = async () => {
    if (!newFieldName.trim()) {
      toast.error('Field name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/leads-v2/custom-fields`, {
        name: newFieldName,
        field_type: newFieldType
      }, { headers });
      toast.success('Custom field created');
      setNewFieldName('');
      setNewFieldType('text');
      loadCustomFields();
    } catch (error) {
      toast.error('Failed to create custom field');
    }
  };

  const deleteCustomField = async (fieldId) => {
    if (!window.confirm('Delete this custom field?')) return;
    try {
      await axios.delete(`${API}/api/leads-v2/custom-fields/${fieldId}`, { headers });
      toast.success('Custom field deleted');
      loadCustomFields();
    } catch (error) {
      toast.error('Failed to delete custom field');
    }
  };

  // ============== GOOGLE SHEETS ACTIONS ==============

  const connectGoogleSheets = async () => {
    if (!sheetId.trim()) {
      toast.error('Sheet ID is required');
      return;
    }
    try {
      await axios.post(`${API}/api/leads-v2/google-sheets/config`, {
        sheet_id: sheetId,
        sheet_name: sheetName || 'Sheet1',
        auto_sync: true
      }, { headers });
      toast.success('Google Sheets connected');
      setShowSheetsModal(false);
      loadSheetsConfig();
    } catch (error) {
      toast.error('Failed to connect Google Sheets');
    }
  };

  const disconnectSheets = async () => {
    if (!window.confirm('Disconnect Google Sheets?')) return;
    try {
      await axios.delete(`${API}/api/leads-v2/google-sheets/config`, { headers });
      toast.success('Google Sheets disconnected');
      setSheetsConfig(null);
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  const [syncing, setSyncing] = useState(false);
  const syncSheets = async () => {
    setSyncing(true);
    try {
      // Sync both connected sheets (Prospect + Lead) in parallel.
      const tasks = [];
      if (prospectCfg?.sheet_id) tasks.push(axios.post(`${API}/api/sheets/sync/prospect`, {}, { headers }));
      if (leadCfg?.sheet_id)     tasks.push(axios.post(`${API}/api/sheets/sync/lead`, {}, { headers }));
      if (tasks.length === 0) {
        toast.error('No Google Sheet connected — open Lead Sheet / Prospect Sheet first.');
        return;
      }
      const results = await Promise.all(tasks);
      const totalSynced = results.reduce((acc, r) => acc + (r.data?.synced || 0), 0);
      toast.success(`Synced ${totalSynced} row(s) from Google Sheets`);
      // Reload leads + stats so the new rows show up immediately.
      await Promise.all([loadLeads(), loadStats()]);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ============== IMPORT/EXPORT ACTIONS ==============

  const downloadTemplate = async () => {
    try {
      const res = await axios.get(`${API}/api/leads-v2/template`, { headers });
      setImportTemplate(res.data);
      
      // Generate CSV content
      const columns = res.data.columns.map(c => c.field);
      const headers_row = res.data.columns.map(c => c.label);
      const sample = res.data.sample_row;
      const sample_row = columns.map(col => sample[col] || '');
      
      const csvContent = [
        headers_row.join(','),
        sample_row.map(v => `"${v}"`).join(',')
      ].join('\n');
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads_import_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const exportLeads = async () => {
    try {
      const res = await axios.get(`${API}/api/leads-v2/export`, { headers });
      const data = res.data;
      
      if (data.length === 0) {
        toast.info('No leads to export');
        return;
      }
      
      // Generate CSV
      const columns = Object.keys(data[0]);
      const csvRows = [
        columns.join(','),
        ...data.map(row => columns.map(col => `"${row[col] || ''}"`).join(','))
      ];
      
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Exported ${data.length} leads`);
    } catch (error) {
      toast.error('Failed to export leads');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error('CSV file is empty or has only headers');
          return;
        }
        
        // Parse CSV
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const headers = parseCSVLine(lines[0]);
        const rows = lines.slice(1).map(line => {
          const values = parseCSVLine(line);
          const row = {};
          headers.forEach((header, idx) => {
            // Map common header names to field names
            const fieldMap = {
              'Name': 'name',
              'Email': 'email',
              'Phone': 'phone',
              'Location': 'location',
              'Website': 'website',
              'Social Media': 'social_media',
              'Source': 'source',
              'Lead Owner': 'lead_owner',
              'Service': 'service',
              'Priority': 'priority',
              'Lead Type': 'lead_type',
              'Date of Lead': 'date_of_lead',
              'Industry': 'industry',
              'Estimation (Amount)': 'estimation',
              'Quotation Link': 'quotation_link',
              'Proposal Link': 'proposal_link',
              'Notes': 'notes',
              'Stage': 'stage',
            };
            const field = fieldMap[header] || header.toLowerCase().replace(/\s+/g, '_');
            row[field] = values[idx] || '';
          });
          return row;
        }).filter(row => row.name); // Filter out empty rows
        
        setImportData(rows);
        setShowImportModal(true);
        toast.success(`Parsed ${rows.length} leads from CSV`);
      } catch (error) {
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  const importLeads = async () => {
    if (importData.length === 0) {
      toast.error('No leads to import');
      return;
    }
    
    setImporting(true);
    try {
      const res = await axios.post(`${API}/api/leads-v2/import`, {
        leads: importData
      }, { headers });
      
      toast.success(`Imported ${res.data.imported} of ${res.data.total} leads`);
      if (res.data.errors?.length > 0) {
        console.error('Import errors:', res.data.errors);
      }
      
      setShowImportModal(false);
      setImportData([]);
      loadLeads();
      loadStats();
    } catch (error) {
      toast.error('Failed to import leads');
    } finally {
      setImporting(false);
    }
  };

  // ============== HELPERS ==============

  const filteredLeads = leads.filter(lead => {
    // Filter by stage if filterStage is set
    if (filterStage && lead.stage_id !== filterStage) return false;
    
    // Filter by lead owner if filterLeadOwner is set
    if (filterLeadOwner && lead.lead_owner !== filterLeadOwner) return false;
    
    // Filter by date range — match if any of created_at / appointment_at /
    // followup_at falls inside the selected window. This way picking "this
    // week" surfaces leads that have meetings/follow-ups scheduled there too.
    if (dateRange.from || dateRange.to) {
      const candidates = [lead.created_at, lead.appointment_at, lead.followup_at].filter(Boolean);
      const from = dateRange.from ? new Date(dateRange.from) : null;
      if (from) from.setHours(0, 0, 0, 0);
      const to = dateRange.to ? new Date(dateRange.to) : null;
      if (to) to.setHours(23, 59, 59, 999);
      const inRange = candidates.some((d) => {
        const dt = new Date(d);
        if (isNaN(dt)) return false;
        if (from && dt < from) return false;
        if (to && dt > to) return false;
        return true;
      });
      if (!inRange) return false;
    }
    
    // Filter by search term
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(term) ||
      lead.email?.toLowerCase().includes(term) ||
      lead.phone?.includes(term) ||
      lead.lead_owner_name?.toLowerCase().includes(term)
    );
  });

  // ============== AMOUNT SUMMARY (Quotation / Negotiation / Deal Closed / Lost) ==============
  const formatCurrency = (n) => {
    const v = Number(n) || 0;
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${v.toLocaleString('en-IN')}`;
  };

  const stageNameById = (id) => stages.find(s => s.stage_id === id)?.name?.toLowerCase() || '';

  // Buckets matched by stage NAME (works even with user-created custom stages)
  const matchBucket = (lead, keywords) => {
    const name = stageNameById(lead.stage_id);
    return keywords.some(k => name.includes(k));
  };

  const sumAmount = (leadsArr) => leadsArr.reduce((acc, l) => acc + (Number(l.estimation) || 0), 0);

  const quotationLeads = filteredLeads.filter(l => matchBucket(l, ['proposal', 'quotation', 'quote']));
  const negotiationLeads = filteredLeads.filter(l => matchBucket(l, ['negotiation']));
  const closedLeads = filteredLeads.filter(l => matchBucket(l, ['deal closed', 'closed', 'won', 'payment']));
  const lostLeads = filteredLeads.filter(l => matchBucket(l, ['lost', 'rejected', 'cancel']));
  // "appoin" catches both "Appointment" and the "Appoinment" stage-name typo some teams use
  const appointmentLeads = filteredLeads.filter(l => matchBucket(l, ['appoin']));

  const summaryAmounts = {
    quotation: { count: quotationLeads.length, amount: sumAmount(quotationLeads) },
    negotiation: { count: negotiationLeads.length, amount: sumAmount(negotiationLeads) },
    closed: { count: closedLeads.length, amount: sumAmount(closedLeads) },
    lost: { count: lostLeads.length, amount: sumAmount(lostLeads) },
    appointment: { count: appointmentLeads.length, amount: sumAmount(appointmentLeads) },
  };

  const getLeadsByStage = (stageId) => {
    return filteredLeads.filter(l => l.stage_id === stageId);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const STAGE_COLORS = [
    '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#22c55e',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316'
  ];

  // ============== RENDER ==============

  return (
    <Layout>
      <div className="flex flex-col h-full" data-testid="leads-page">
        {/* Header */}
        <div className={`p-4 border-b ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#3b82f6]/20">
                <Users className="h-6 w-6 text-[#3b82f6]" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${textPrimary}`}>Leads</h1>
                <p className={`text-sm ${textSecondary}`}>{stats.total} Total Leads</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Two separate Google Sheets — Prospect & Lead */}
              <Button
                onClick={() => setShowProspectSheetModal(true)}
                variant="outline"
                className={`${borderColor} ${bgSecondary} ${textSecondary} gap-2`}
                data-testid="prospect-sheet-btn"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Prospect Sheet
                {prospectCfg?.sheet_id && <Badge className="bg-[#10b981]/20 text-[#10b981] text-[10px] ml-1">Connected</Badge>}
              </Button>
              <Button
                onClick={() => setShowLeadSheetModal(true)}
                variant="outline"
                className={`${borderColor} ${bgSecondary} ${textSecondary} gap-2`}
                data-testid="lead-sheet-btn"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Lead Sheet
                {leadCfg?.sheet_id && <Badge className="bg-[#10b981]/20 text-[#10b981] text-[10px] ml-1">Connected</Badge>}
              </Button>

              {/* Sync Sheets — pulls latest rows from any connected sheet */}
              <Button
                onClick={syncSheets}
                disabled={syncing || (!prospectCfg?.sheet_id && !leadCfg?.sheet_id)}
                variant="outline"
                className={`${borderColor} ${bgSecondary} ${textSecondary} hover:${textPrimary} gap-2`}
                data-testid="leads-sync-btn"
                title="Pull latest rows from connected Google Sheets"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync'}
              </Button>

              {/* View Toggle removed — List view is the only view */}

              <Button
                onClick={() => setShowStagesModal(true)}
                variant="outline"
                className={`${borderColor} ${bgSecondary} ${textSecondary} hover:${textPrimary}`}
              >
                <Settings className="h-4 w-4 mr-2" />
                Stages
              </Button>

              <Button
                onClick={() => setShowFieldsModal(true)}
                variant="outline"
                className={`${borderColor} ${bgSecondary} ${textSecondary} hover:${textPrimary}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Fields
              </Button>

              {/* Import/Export */}
              <div className={`flex items-center ${bgSecondary} rounded-lg p-1 border ${borderColor}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadTemplate}
                  title="Download Import Template"
                  className={textSecondary}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Import Leads from CSV"
                    className={textSecondary}
                    asChild
                  >
                    <span><Upload className="h-4 w-4" /></span>
                  </Button>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exportLeads}
                  title="Export All Leads"
                  className={textSecondary}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </Button>
              </div>

              <Button
                onClick={() => { resetLeadForm(); setEditingLead(null); setShowAddLeadModal(true); }}
                data-testid="new-lead-btn"
                className="bg-[#3b82f6] hover:bg-[#2563eb]"
              >
                <Plus className="h-4 w-4 mr-2" /> New Lead
              </Button>
            </div>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className={`px-4 pt-4 flex items-center gap-2 flex-wrap`} data-testid="date-filter-bar">
          <span className={`text-xs ${textSecondary} uppercase tracking-wide mr-1`}>Date Range:</span>
          <Popover open={showDatePopover} onOpenChange={setShowDatePopover}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid="date-range-trigger"
                className={`${bgSecondary} ${borderColor} ${textPrimary} gap-2`}
              >
                <Calendar className="h-4 w-4" />
                {dateRange.from && dateRange.to ? (
                  <span>
                    {new Date(dateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' — '}
                    {new Date(dateRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                ) : dateRange.from ? (
                  <span>
                    From {new Date(dateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                ) : (
                  <span>All Time</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="range"
                numberOfMonths={2}
                selected={dateRange}
                onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                initialFocus
                data-testid="date-range-calendar"
              />
              <div className={`flex items-center justify-between gap-2 p-3 border-t ${borderColor}`}>
                <div className="flex gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid="date-preset-today"
                    onClick={() => {
                      const t = new Date();
                      setDateRange({ from: t, to: t });
                    }}
                  >Today</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid="date-preset-this-week"
                    onClick={() => {
                      // Tuesday → Monday (matches Finance Week-Wise convention).
                      const t = new Date();
                      const day = t.getDay(); // 0=Sun..6=Sat, Tue=2
                      const back = day >= 2 ? day - 2 : day + 5;
                      const from = new Date(t);
                      from.setHours(0, 0, 0, 0);
                      from.setDate(t.getDate() - back);
                      const to = new Date(from);
                      to.setDate(from.getDate() + 6);
                      to.setHours(23, 59, 59, 999);
                      setDateRange({ from, to });
                    }}
                  >This Week (Tue–Mon)</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid="date-preset-week"
                    onClick={() => {
                      const t = new Date();
                      const w = new Date(t.getTime() - 6 * 24 * 60 * 60 * 1000);
                      setDateRange({ from: w, to: t });
                    }}
                  >Last 7 Days</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid="date-preset-month"
                    onClick={() => {
                      const t = new Date();
                      const m = new Date(t.getFullYear(), t.getMonth(), 1);
                      setDateRange({ from: m, to: t });
                    }}
                  >This Month</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid="date-preset-all"
                    onClick={() => setDateRange({ from: undefined, to: undefined })}
                  >All Time</Button>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid="date-clear"
                    onClick={() => setDateRange({ from: undefined, to: undefined })}
                  >Clear</Button>
                  <Button
                    size="sm"
                    data-testid="date-apply"
                    className="bg-[#3b82f6] hover:bg-[#2563eb]"
                    onClick={() => {
                      // Picking just one day in the calendar leaves `to` unset,
                      // which filters "that day onward" forever — not what a
                      // single click means to most people. Treat it as a
                      // one-day filter unless a second, later day was picked.
                      if (dateRange.from && !dateRange.to) {
                        setDateRange({ from: dateRange.from, to: dateRange.from });
                      }
                      setShowDatePopover(false);
                    }}
                  >Apply</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {(dateRange.from || dateRange.to) && (
            <Badge
              className="bg-[#3b82f6]/20 text-[#3b82f6] cursor-pointer gap-1"
              onClick={() => setDateRange({ from: undefined, to: undefined })}
            >
              {filteredLeads.length} in range <X className="h-3 w-3" />
            </Badge>
          )}
        </div>

        {/* Stage Stats Cards row removed — stage filtering available via List View tabs */}


        {/* Amount Summary Cards (Quotation / Negotiation / Deal Closed / Lost) */}
        <div className={`px-4 pt-4 grid grid-cols-2 md:grid-cols-5 gap-3`} data-testid="amount-summary-row">
          {[
            { key: 'quotation', label: 'Total Quotation', color: '#f59e0b', icon: '📄' },
            { key: 'appointment', label: 'Appointments', color: '#3b82f6', icon: '📅' },
            { key: 'negotiation', label: 'Negotiation', color: '#ec4899', icon: '🤝' },
            { key: 'closed', label: 'Deal Closed', color: '#22c55e', icon: '✅' },
            { key: 'lost', label: 'Amount Lost', color: '#ef4444', icon: '❌' },
          ].map(card => {
            const data = summaryAmounts[card.key];
            return (
              <div
                key={card.key}
                data-testid={`amount-card-${card.key}`}
                className={`p-4 rounded-xl border ${borderColor} ${bgSecondary} relative overflow-hidden`}
                style={{ borderLeft: `4px solid ${card.color}` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-[11px] uppercase tracking-wide ${textSecondary} font-medium`}>{card.label}</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1" style={{ color: card.color }}>
                      {data.count} <span className="text-xs sm:text-sm font-medium">{data.count === 1 ? 'lead' : 'leads'}</span>
                    </p>
                    <p
                      className="text-xs font-semibold mt-1.5 inline-block px-1.5 py-0.5 rounded"
                      style={{ color: card.color, backgroundColor: `${card.color}1a` }}
                    >
                      {formatCurrency(data.amount)}
                    </p>
                  </div>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${card.color}20` }}
                  >
                    {card.icon}
                  </div>
                </div>
              </div>
            );
          })}
        </div>


        {/* Search + Active Filter */}
        <div className={`p-4 border-b ${borderColor}`}>
          <div className="flex items-center gap-3">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="search-input"
                className={`pl-10 ${bgSecondary} border-none`}
              />
            </div>
            
            {/* Lead Owner Filter */}
            <Select
              value={filterLeadOwner || ''}
              onValueChange={(v) => setFilterLeadOwner(v === 'all' ? null : v)}
            >
              <SelectTrigger className={`w-[180px] ${bgSecondary}`}>
                <SelectValue placeholder="All Lead Owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lead Owners</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Active Filters */}
            {(filterStage || filterLeadOwner) && (
              <div className="flex items-center gap-2">
                <span className={`text-sm ${textSecondary}`}>Filters:</span>
                {filterStage && (
                  <Badge 
                    className="flex items-center gap-1 cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: stages.find(s => s.stage_id === filterStage)?.color || '#3b82f6' }}
                    onClick={() => setFilterStage(null)}
                  >
                    {stages.find(s => s.stage_id === filterStage)?.name}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {filterLeadOwner && (
                  <Badge 
                    className="flex items-center gap-1 cursor-pointer hover:opacity-80 bg-purple-500"
                    onClick={() => setFilterLeadOwner(null)}
                  >
                    {teamMembers.find(m => m.user_id === filterLeadOwner)?.name || 'Owner'}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className={`text-center py-12 ${textSecondary}`}>Loading...</div>
          ) : (
            <ListView
              leads={filteredLeads}
              stages={stages}
              customFields={customFields}
              onEdit={openEditLead}
              onDelete={deleteLead}
              onStageChange={updateLeadStage}
              formatDate={formatDate}
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
              bgSecondary={bgSecondary}
            />
          )}
        </div>

        {/* ============== MODALS ============== */}

        {/* Add/Edit Lead Modal - Comprehensive Form */}
        <Dialog open={showAddLeadModal} onOpenChange={setShowAddLeadModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-2xl max-h-[85vh] overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className={`grid w-full grid-cols-3 ${bgSecondary}`}>
                <TabsTrigger value="basic">Basic Details</TabsTrigger>
                <TabsTrigger value="lead">Lead Details</TabsTrigger>
                <TabsTrigger value="followup">Follow-up</TabsTrigger>
              </TabsList>
              
              {/* Basic Details Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Name *</label>
                  <Input
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    placeholder="Lead name"
                    data-testid="lead-name-input"
                    className={bgSecondary}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Email</label>
                    <Input
                      type="email"
                      value={leadForm.email}
                      onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                      placeholder="email@example.com"
                      className={bgSecondary}
                    />
                  </div>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Phone</label>
                    <Input
                      value={leadForm.phone}
                      onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className={bgSecondary}
                    />
                  </div>
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Location</label>
                  <Input
                    value={leadForm.location}
                    onChange={(e) => setLeadForm({ ...leadForm, location: e.target.value })}
                    placeholder="City, State"
                    className={bgSecondary}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Website</label>
                    <Input
                      value={leadForm.website}
                      onChange={(e) => setLeadForm({ ...leadForm, website: e.target.value })}
                      placeholder="https://example.com"
                      className={bgSecondary}
                    />
                  </div>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Social Media</label>
                    <Input
                      value={leadForm.social_media}
                      onChange={(e) => setLeadForm({ ...leadForm, social_media: e.target.value })}
                      placeholder="Instagram/LinkedIn URL"
                      className={bgSecondary}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Company Name</label>
                    <Input
                      value={leadForm.company_name}
                      onChange={(e) => setLeadForm({ ...leadForm, company_name: e.target.value })}
                      placeholder="Company / Business name"
                      className={bgSecondary}
                      data-testid="lead-company-name-input"
                    />
                  </div>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>What do you do?</label>
                    <Input
                      value={leadForm.what_do_you_do}
                      onChange={(e) => setLeadForm({ ...leadForm, what_do_you_do: e.target.value })}
                      placeholder="e.g. Build a new website"
                      className={bgSecondary}
                      data-testid="lead-what-do-you-do-input"
                    />
                  </div>
                </div>
                {/* Quick Remarks — top-level note about anything on this lead */}
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Remarks</label>
                  <textarea
                    value={leadForm.notes || ''}
                    onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                    placeholder="Write anything about this lead — call summary, blockers, next move…"
                    rows={3}
                    className={`w-full px-3 py-2 rounded-md border ${borderColor} ${bgSecondary} ${textPrimary} text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40`}
                    data-testid="lead-remarks-input"
                  />
                </div>
              </TabsContent>
              
              {/* Lead Details Tab */}
              <TabsContent value="lead" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Stage</label>
                    <Select
                      value={leadForm.stage_id}
                      onValueChange={(v) => setLeadForm({ ...leadForm, stage_id: v })}
                    >
                      <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select stage" /></SelectTrigger>
                      <SelectContent>
                        {stages.map(s => (
                          <SelectItem key={s.stage_id} value={s.stage_id}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Source</label>
                    <Input
                      value={leadForm.source}
                      onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                      placeholder="e.g., Website, Referral"
                      className={bgSecondary}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Lead Owner</label>
                    <Select
                      value={leadForm.lead_owner}
                      onValueChange={(v) => setLeadForm({ ...leadForm, lead_owner: v })}
                    >
                      <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select owner" /></SelectTrigger>
                      <SelectContent>
                        {teamMembers.map(m => (
                          <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Services</label>
                    <div className="flex gap-2">
                      <Select
                        value={leadForm.service}
                        onValueChange={(v) => {
                          if (v === '__add_new__') {
                            setShowAddServiceModal(true);
                          } else {
                            setLeadForm({ ...leadForm, service: v });
                          }
                        }}
                      >
                        <SelectTrigger className={`${bgSecondary} flex-1`}><SelectValue placeholder="Select service" /></SelectTrigger>
                        <SelectContent>
                          {services.map(s => (
                            <SelectItem key={s.service_id} value={s.name}>{s.name}</SelectItem>
                          ))}
                          <SelectItem value="__add_new__" className="text-blue-400">+ Add New Service</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Priority</label>
                    <Select
                      value={leadForm.priority}
                      onValueChange={(v) => setLeadForm({ ...leadForm, priority: v })}
                    >
                      <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select priority" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Lead Type</label>
                    <Select
                      value={leadForm.lead_type}
                      onValueChange={(v) => setLeadForm({ ...leadForm, lead_type: v })}
                    >
                      <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inbound">Inbound</SelectItem>
                        <SelectItem value="Outbound">Outbound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Date of Lead</label>
                    <Input
                      type="date"
                      value={leadForm.date_of_lead}
                      onChange={(e) => setLeadForm({ ...leadForm, date_of_lead: e.target.value })}
                      className={bgSecondary}
                    />
                  </div>
                </div>
                
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Industry</label>
                  <Select
                    value={leadForm.industry}
                    onValueChange={(v) => {
                      if (v === '__add_new__') {
                        setShowAddIndustryModal(true);
                      } else {
                        setLeadForm({ ...leadForm, industry: v });
                      }
                    }}
                  >
                    <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>
                      {industries.map(i => (
                        <SelectItem key={i.industry_id} value={i.name}>{i.name}</SelectItem>
                      ))}
                      <SelectItem value="__add_new__" className="text-blue-400">+ Add New Industry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className={`p-4 rounded-lg border ${borderColor} space-y-4`}>
                  <h4 className={`text-sm font-medium ${textPrimary}`}>Documents & Estimation</h4>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Estimation Amount (₹)</label>
                    <Input
                      type="number"
                      value={leadForm.estimation}
                      onChange={(e) => setLeadForm({ ...leadForm, estimation: e.target.value })}
                      placeholder="50000"
                      className={bgSecondary}
                    />
                  </div>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Quotation Link</label>
                    <Input
                      value={leadForm.quotation_link}
                      onChange={(e) => setLeadForm({ ...leadForm, quotation_link: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      className={bgSecondary}
                    />
                  </div>
                  <div>
                    <label className={`text-sm ${textSecondary} block mb-1`}>Proposal Link</label>
                    <Input
                      value={leadForm.proposal_link}
                      onChange={(e) => setLeadForm({ ...leadForm, proposal_link: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      className={bgSecondary}
                    />
                  </div>
                </div>
                
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Notes</label>
                  <Textarea
                    value={leadForm.notes}
                    onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                    placeholder="Additional notes..."
                    className={bgSecondary}
                    rows={3}
                  />
                </div>
              </TabsContent>
              
              {/* Follow-up Tab */}
              <TabsContent value="followup" className="mt-4">
                {editingLead ? (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-lg border ${borderColor}`}>
                      <h4 className={`text-sm font-medium ${textPrimary} mb-3`}>Add New Follow-up</h4>
                      <Textarea
                        value={followUpRemarks}
                        onChange={(e) => setFollowUpRemarks(e.target.value)}
                        placeholder="Enter follow-up remarks..."
                        className={`${bgSecondary} mb-3`}
                        rows={3}
                      />
                      <Button 
                        onClick={async () => {
                          if (!followUpRemarks.trim()) {
                            toast.error('Please enter remarks');
                            return;
                          }
                          try {
                            await axios.post(`${API}/api/leads-v2/leads/${editingLead.lead_id}/followups`, {
                              remarks: followUpRemarks.trim()
                            }, { headers });
                            toast.success('Follow-up added');
                            setFollowUpRemarks('');
                            loadLeads();
                            // Refresh editingLead data
                            const res = await axios.get(`${API}/api/leads-v2/leads`, { headers });
                            const updatedLead = res.data.find(l => l.lead_id === editingLead.lead_id);
                            if (updatedLead) setEditingLead(updatedLead);
                          } catch (error) {
                            toast.error('Failed to add follow-up');
                          }
                        }}
                        className="bg-[#3b82f6] hover:bg-[#2563eb]"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Follow-up
                      </Button>
                    </div>
                    
                    <div>
                      <h4 className={`text-sm font-medium ${textPrimary} mb-3`}>Follow-up History</h4>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {(editingLead.followups || []).length === 0 ? (
                          <p className={`text-sm ${textSecondary} text-center py-4`}>No follow-ups yet</p>
                        ) : (
                          [...(editingLead.followups || [])].reverse().map((fu, idx) => (
                            <div key={fu.followup_id || idx} className={`p-3 rounded-lg ${bgSecondary}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="h-4 w-4 text-blue-400" />
                                <span className={`text-xs ${textSecondary}`}>
                                  {new Date(fu.date).toLocaleString()} by {fu.created_by_name || 'Unknown'}
                                </span>
                              </div>
                              <p className={`text-sm ${textPrimary}`}>{fu.remarks}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`text-center py-8 ${textSecondary}`}>
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Save the lead first to add follow-ups</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            {/* Stage Transition Tabs - visible only when editing existing lead */}
            {editingLead && stages.length > 0 && (
              <div className={`border-t ${borderColor} pt-3 mt-1`} data-testid="stage-transition-tabs">
                <p className={`text-xs ${textSecondary} mb-2 uppercase tracking-wide`}>Move to Stage</p>
                <div className="flex flex-wrap gap-2">
                  {stages.map((stage) => {
                    const isCurrent = leadForm.stage_id === stage.stage_id;
                    const stageNameLower = (stage.name || '').toLowerCase().trim();
                    const needsAppointment = stageNameLower === 'appoinment' || stageNameLower === 'appointment' || stageNameLower === 'appointment reshuedule' || stageNameLower === 'appointment reschedule' || stageNameLower === 'appointment rescheule';
                    const needsFollowup = stageNameLower === 'followup' || stageNameLower === 'follow-up' || stageNameLower === 'prospect followup' || stageNameLower === 'follow up';
                    return (
                      <button
                        key={stage.stage_id}
                        type="button"
                        data-testid={`stage-tab-${stage.stage_id}`}
                        onClick={async () => {
                          if (isCurrent) return;
                          // Open mini date/time popup for Appointment & Followup stages.
                          if (needsAppointment || needsFollowup) {
                            const existingISO = needsAppointment
                              ? (editingLead?.appointment_at || '')
                              : (editingLead?.followup_at || '');
                            const ex = existingISO ? new Date(existingISO) : null;
                            const today = new Date();
                            const initialDate = (ex && !isNaN(ex)) ? ex.toISOString().slice(0, 10) : today.toISOString().slice(0, 10);
                            const initialTime = (ex && !isNaN(ex))
                              ? `${String(ex.getHours()).padStart(2, '0')}:${String(ex.getMinutes()).padStart(2, '0')}`
                              : '10:00';
                            setStageDateValue(initialDate);
                            setStageTimeValue(initialTime);
                            setStageDateModal({ stage, kind: needsAppointment ? 'appointment' : 'followup' });
                            return;
                          }
                          try {
                            await axios.put(
                              `${API}/api/leads-v2/leads/${editingLead.lead_id}/stage`,
                              { stage_id: stage.stage_id },
                              { headers }
                            );
                            setLeadForm({ ...leadForm, stage_id: stage.stage_id });
                            setEditingLead({ ...editingLead, stage_id: stage.stage_id });
                            toast.success(`Moved to ${stage.name}`);
                            loadLeads();
                            loadStats();
                            const stageName = (stage.name || '').toLowerCase().trim();
                            if (stageName === 'invoice raise' || stageName === 'invoice_raise' || stageName === 'invoiceraise') {
                              const leadForRaise = { ...editingLead, stage_id: stage.stage_id };
                              setEditingLead(null);
                              setInvoiceRaiseLead(leadForRaise);
                            }
                          } catch (e) {
                            toast.error('Failed to change stage');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                          isCurrent ? 'text-white' : `${textSecondary} hover:opacity-80`
                        }`}
                        style={{
                          borderColor: stage.color,
                          backgroundColor: isCurrent ? stage.color : 'transparent',
                          color: isCurrent ? '#fff' : stage.color,
                        }}
                      >
                        {stage.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <DialogFooter className="flex sm:justify-between gap-2 w-full">
              <div>
                {editingLead && (
                  <Button
                    onClick={async () => {
                      if (!window.confirm(`Permanently delete "${editingLead.name}"? This cannot be undone.`)) return;
                      try {
                        await axios.delete(`${API}/api/leads-v2/leads/${editingLead.lead_id}/permanent`, { headers });
                        toast.success('Lead permanently deleted');
                        setShowAddLeadModal(false);
                        setEditingLead(null);
                        loadLeads();
                        loadStats();
                      } catch (e) {
                        toast.error(e.response?.data?.detail || 'Failed to permanently delete');
                      }
                    }}
                    className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
                    data-testid="permanent-delete-lead-btn"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Permanently Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setShowAddLeadModal(false); setEditingLead(null); }}>Cancel</Button>
                <Button
                  onClick={editingLead ? updateLead : createLead}
                  data-testid="save-lead-btn"
                  className="bg-[#3b82f6] hover:bg-[#2563eb]"
                >
                  {editingLead ? 'Update Lead' : 'Create Lead'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Add Service Modal */}
        <Dialog open={showAddServiceModal} onOpenChange={setShowAddServiceModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-sm`}>
            <DialogHeader>
              <DialogTitle>Add New Service</DialogTitle>
            </DialogHeader>
            <Input
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              placeholder="Service name"
              className={bgSecondary}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowAddServiceModal(false)}>Cancel</Button>
              <Button onClick={addNewService} className="bg-[#3b82f6] hover:bg-[#2563eb]">Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Add Industry Modal */}
        <Dialog open={showAddIndustryModal} onOpenChange={setShowAddIndustryModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-sm`}>
            <DialogHeader>
              <DialogTitle>Add New Industry</DialogTitle>
            </DialogHeader>
            <Input
              value={newIndustryName}
              onChange={(e) => setNewIndustryName(e.target.value)}
              placeholder="Industry name"
              className={bgSecondary}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowAddIndustryModal(false)}>Cancel</Button>
              <Button onClick={addNewIndustry} className="bg-[#3b82f6] hover:bg-[#2563eb]">Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Leads Modal */}
        <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-4xl max-h-[85vh] overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle>Import Leads Preview</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className={`p-3 rounded-lg ${bgSecondary} flex items-center justify-between`}>
                <div>
                  <p className={textPrimary}><strong>{importData.length}</strong> leads ready to import</p>
                  <p className={`text-xs ${textSecondary}`}>Review the data below before importing</p>
                </div>
                <Badge className="bg-blue-500/20 text-blue-400">{importData.length} rows</Badge>
              </div>
              
              {/* Preview Table */}
              <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-sm">
                    <thead className={`${bgSecondary} sticky top-0`}>
                      <tr>
                        <th className={`px-3 py-2 text-left ${textSecondary} font-medium`}>#</th>
                        <th className={`px-3 py-2 text-left ${textSecondary} font-medium`}>Name</th>
                        <th className={`px-3 py-2 text-left ${textSecondary} font-medium`}>Email</th>
                        <th className={`px-3 py-2 text-left ${textSecondary} font-medium`}>Phone</th>
                        <th className={`px-3 py-2 text-left ${textSecondary} font-medium`}>Stage</th>
                        <th className={`px-3 py-2 text-left ${textSecondary} font-medium`}>Lead Owner</th>
                        <th className={`px-3 py-2 text-left ${textSecondary} font-medium`}>Service</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importData.slice(0, 50).map((lead, idx) => (
                        <tr key={idx} className={`border-t ${borderColor}`}>
                          <td className={`px-3 py-2 ${textSecondary}`}>{idx + 1}</td>
                          <td className={`px-3 py-2 ${textPrimary} font-medium`}>{lead.name}</td>
                          <td className={`px-3 py-2 ${textSecondary}`}>{lead.email}</td>
                          <td className={`px-3 py-2 ${textSecondary}`}>{lead.phone}</td>
                          <td className={`px-3 py-2`}>
                            <Badge className="text-xs" style={{ backgroundColor: stages.find(s => s.name.toLowerCase() === lead.stage?.toLowerCase())?.color + '40' || '#3b82f640' }}>
                              {lead.stage || 'Default'}
                            </Badge>
                          </td>
                          <td className={`px-3 py-2 ${textSecondary}`}>{lead.lead_owner}</td>
                          <td className={`px-3 py-2 ${textSecondary}`}>{lead.service}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importData.length > 50 && (
                  <div className={`p-2 text-center ${bgSecondary} ${textSecondary} text-xs`}>
                    Showing 50 of {importData.length} rows
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowImportModal(false); setImportData([]); }}>Cancel</Button>
              <Button 
                onClick={importLeads} 
                disabled={importing}
                className="bg-[#22c55e] hover:bg-[#16a34a]"
              >
                {importing ? 'Importing...' : `Import ${importData.length} Leads`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stages Modal */}
        <Dialog open={showStagesModal} onOpenChange={setShowStagesModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
            <DialogHeader>
              <DialogTitle>Manage Stages</DialogTitle>
            </DialogHeader>
            <p className={`text-xs ${textSecondary} mb-2`}>Drag stages to reorder or use arrows</p>
            <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto">
              {stages.map((stage, index) => (
                <div key={stage.stage_id} className={`p-3 rounded-lg ${bgSecondary} flex items-center justify-between gap-2`}>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveStageUp(index)}
                        disabled={index === 0}
                        data-testid={`move-stage-up-${index}`}
                        className={`p-0.5 rounded hover:bg-[#3f3f46] ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveStageDown(index)}
                        disabled={index === stages.length - 1}
                        data-testid={`move-stage-down-${index}`}
                        className={`p-0.5 rounded hover:bg-[#3f3f46] ${index === stages.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: stage.color }} />
                    <span className={textPrimary}>{stage.name}</span>
                    <span className={`text-xs ${textSecondary}`}>#{index + 1}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteStage(stage.stage_id)} className="text-red-400 h-7 w-7 p-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h4 className={`text-sm font-medium ${textPrimary} mb-3`}>Add New Stage</h4>
              <div className="flex gap-2 mb-3">
                <Input
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Stage name"
                  className={`flex-1 ${bgSecondary}`}
                />
                <Input
                  type="color"
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className="w-12 h-10 p-1 rounded"
                />
              </div>
              <div className="flex gap-1 mb-3 flex-wrap">
                {STAGE_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewStageColor(color)}
                    className={`w-6 h-6 rounded ${newStageColor === color ? 'ring-2 ring-white' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <Button onClick={createStage} className="w-full bg-[#10b981] hover:bg-[#059669]">
                <Plus className="h-4 w-4 mr-2" /> Add Stage
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowStagesModal(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Custom Fields Modal */}
        <Dialog open={showFieldsModal} onOpenChange={setShowFieldsModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
            <DialogHeader>
              <DialogTitle>Custom Fields</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
              {customFields.length === 0 ? (
                <p className={`text-sm ${textSecondary} text-center py-4`}>No custom fields yet</p>
              ) : (
                customFields.map(field => (
                  <div key={field.field_id} className={`p-3 rounded-lg ${bgSecondary} flex items-center justify-between`}>
                    <div>
                      <span className={textPrimary}>{field.name}</span>
                      <span className={`text-xs ${textSecondary} ml-2`}>({field.field_type})</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteCustomField(field.field_id)} className="text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h4 className={`text-sm font-medium ${textPrimary} mb-3`}>Add New Field</h4>
              <div className="space-y-3">
                <Input
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="Field name"
                  className={bgSecondary}
                />
                <Select value={newFieldType} onValueChange={setNewFieldType}>
                  <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="textarea">Long Text</SelectItem>
                    <SelectItem value="select">Dropdown</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={createCustomField} className="w-full bg-[#10b981] hover:bg-[#059669]">
                  <Plus className="h-4 w-4 mr-2" /> Add Field
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowFieldsModal(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Dual-Sheet Modals — Prospect & Lead */}
        <SheetConnectModal
          open={showProspectSheetModal}
          onClose={() => setShowProspectSheetModal(false)}
          onSaved={() => loadSheetsConfig()}
          sheetType="prospect"
          userId={currentUser?.user_id}
          headers={headers}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          borderColor={borderColor}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
        <SheetConnectModal
          open={showLeadSheetModal}
          onClose={() => setShowLeadSheetModal(false)}
          onSaved={() => loadSheetsConfig()}
          sheetType="lead"
          userId={currentUser?.user_id}
          headers={headers}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          borderColor={borderColor}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          stagesPanel={
            <div data-testid="leadsheet-stages-panel">
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-sm font-semibold ${textPrimary}`}>Lead Stages</h4>
                <span className={`text-xs ${textSecondary}`}>{stages.length} stage{stages.length === 1 ? '' : 's'}</span>
              </div>
              <p className={`text-xs ${textSecondary} mb-2`}>Reorder with ↑ / ↓ or delete a stage. New stages appear at the bottom.</p>
              <div className="space-y-1.5 mb-3 max-h-[220px] overflow-y-auto">
                {stages.length === 0 && (
                  <div className={`p-3 rounded-lg ${bgSecondary} text-xs ${textSecondary}`}>No stages yet. Create the first one below.</div>
                )}
                {stages.map((stage, index) => (
                  <div key={stage.stage_id} className={`px-2.5 py-2 rounded-lg ${bgSecondary} flex items-center justify-between gap-2`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveStageUp(index)}
                          disabled={index === 0}
                          data-testid={`leadsheet-move-stage-up-${index}`}
                          className={`p-0.5 rounded hover:bg-[#3f3f46] ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => moveStageDown(index)}
                          disabled={index === stages.length - 1}
                          data-testid={`leadsheet-move-stage-down-${index}`}
                          className={`p-0.5 rounded hover:bg-[#3f3f46] ${index === stages.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="w-3.5 h-3.5 rounded flex-shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className={`text-sm ${textPrimary} truncate`}>{stage.name}</span>
                      <span className={`text-xs ${textSecondary} ml-auto`}>#{index + 1}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteStage(stage.stage_id)} className="text-red-400 h-7 w-7 p-0" data-testid={`leadsheet-delete-stage-${stage.stage_id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className={`p-3 rounded-lg border ${borderColor}`}>
                <h5 className={`text-xs font-medium ${textPrimary} mb-2 uppercase tracking-wide`}>Add New Stage</h5>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder="Stage name"
                    className={`flex-1 ${bgSecondary} text-sm`}
                    data-testid="leadsheet-new-stage-name"
                  />
                  <input
                    type="color"
                    value={newStageColor}
                    onChange={(e) => setNewStageColor(e.target.value)}
                    className="w-10 h-9 p-0.5 rounded border-0 cursor-pointer"
                  />
                </div>
                <div className="flex gap-1 mb-2 flex-wrap">
                  {STAGE_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewStageColor(color)}
                      className={`w-5 h-5 rounded ${newStageColor === color ? 'ring-2 ring-[#6366f1]' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <Button onClick={createStage} className="w-full bg-[#10b981] hover:bg-[#059669] text-white h-8 text-sm" data-testid="leadsheet-add-stage-btn">
                  <Plus className="h-4 w-4 mr-2" /> Add Stage
                </Button>
              </div>
            </div>
          }
        />

        {/* Google Sheets Modal */}
        <Dialog open={showSheetsModal} onOpenChange={setShowSheetsModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-[#22c55e]" />
                Connect Google Sheets
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className={`text-sm ${textSecondary}`}>
                Connect a Google Sheet to automatically sync leads. The sheet will be checked for new leads periodically.
              </p>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Google Sheet ID *</label>
                <Input
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="e.g., 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className={bgSecondary}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>
                  Found in the URL: docs.google.com/spreadsheets/d/<strong>[SHEET_ID]</strong>/edit
                </p>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Sheet Name</label>
                <Input
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="Sheet1"
                  className={bgSecondary}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowSheetsModal(false)}>Cancel</Button>
              <Button onClick={connectGoogleSheets} className="bg-[#22c55e] hover:bg-[#16a34a]">
                <Link2 className="h-4 w-4 mr-2" /> Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Follow-up Modal */}
        <Dialog open={showFollowUpModal} onOpenChange={setShowFollowUpModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#f59e0b]" />
                Add Follow-up for {followUpLead?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className={`p-3 rounded-lg ${bgSecondary} flex items-center gap-2`}>
                <Calendar className="h-4 w-4 text-[#3b82f6]" />
                <span className={`text-sm ${textPrimary}`}>
                  {new Date().toLocaleString()}
                </span>
                <span className={`text-xs ${textSecondary}`}>(Auto-captured)</span>
              </div>
              
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Remarks *</label>
                <Textarea
                  value={followUpRemarks}
                  onChange={(e) => setFollowUpRemarks(e.target.value)}
                  placeholder="Enter follow-up remarks..."
                  className={bgSecondary}
                  rows={4}
                  autoFocus
                />
              </div>
              
              {/* Previous follow-ups */}
              {followUpLead?.followups && followUpLead.followups.length > 0 && (
                <div className={`border-t ${borderColor} pt-4`}>
                  <h4 className={`text-sm font-medium ${textPrimary} mb-2`}>Previous Follow-ups ({followUpLead.followups.length})</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {[...followUpLead.followups].reverse().map((fu, idx) => (
                      <div key={fu.followup_id || idx} className={`p-3 rounded ${bgSecondary}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-3 w-3 text-[#3b82f6]" />
                          <span className={`text-xs ${textSecondary}`}>
                            {new Date(fu.date).toLocaleString()} by {fu.created_by_name || 'Unknown'}
                          </span>
                        </div>
                        <p className={`text-sm ${textPrimary}`}>{fu.remarks}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowFollowUpModal(false); setFollowUpLead(null); setFollowUpRemarks(''); }}>Cancel</Button>
              <Button onClick={submitFollowUp} className="bg-[#f59e0b] hover:bg-[#d97706]">
                <MessageSquare className="h-4 w-4 mr-2" /> Add Follow-up
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Invoice Raise (Sales → Finance) modal */}
        {invoiceRaiseLead && (
          <LeadInvoiceRaiseModal
            lead={invoiceRaiseLead}
            onClose={() => setInvoiceRaiseLead(null)}
            onSubmitted={() => { loadLeads(); }}
          />
        )}

        {/* Appointment / Followup mini date+time popup — Radix Dialog so it
            sits on top of Edit Lead and doesn't get pointer-blocked. */}
        <Dialog open={!!stageDateModal} onOpenChange={(o) => !o && !stageDateSaving && setStageDateModal(null)}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-sm`} data-testid="stage-date-modal">
            {stageDateModal && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" style={{ color: stageDateModal.stage.color }} />
                    {stageDateModal.kind === 'appointment' ? 'Set Appointment Date & Time' : 'Set Follow-up Date & Time'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <p className={`text-xs ${textSecondary}`}>
                    Moving to <b style={{ color: stageDateModal.stage.color }}>{stageDateModal.stage.name}</b>. Pick when this should happen.
                  </p>
                  <div>
                    <Label className={textPrimary}>Date</Label>
                    <Input
                      type="date"
                      value={stageDateValue}
                      onChange={(e) => setStageDateValue(e.target.value)}
                      className={bgSecondary}
                      data-testid="stage-date-input"
                    />
                  </div>
                  <div>
                    <Label className={textPrimary}>Time</Label>
                    <Input
                      type="time"
                      value={stageTimeValue}
                      onChange={(e) => setStageTimeValue(e.target.value)}
                      className={bgSecondary}
                      data-testid="stage-time-input"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStageDateModal(null)} disabled={stageDateSaving}>Cancel</Button>
                  <Button
                    data-testid="stage-date-save"
                    disabled={!stageDateValue || !stageTimeValue || stageDateSaving}
                    onClick={async () => {
                      setStageDateSaving(true);
                      const stage = stageDateModal.stage;
                      const isAppt = stageDateModal.kind === 'appointment';
                      const iso = new Date(`${stageDateValue}T${stageTimeValue}:00`).toISOString();
                      try {
                        await axios.put(
                          `${API}/api/leads-v2/leads/${editingLead.lead_id}/stage`,
                          {
                            stage_id: stage.stage_id,
                            ...(isAppt ? { appointment_at: iso } : { followup_at: iso }),
                          },
                          { headers },
                        );
                        const patch = isAppt ? { appointment_at: iso } : { followup_at: iso };
                        setLeadForm({ ...leadForm, stage_id: stage.stage_id });
                        setEditingLead({ ...editingLead, stage_id: stage.stage_id, ...patch });
                        toast.success(`Moved to ${stage.name}`);
                        setStageDateModal(null);
                        loadLeads();
                        loadStats();
                      } catch (e) {
                        toast.error('Failed to change stage');
                      } finally {
                        setStageDateSaving(false);
                      }
                    }}
                    className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                  >
                    {stageDateSaving ? 'Saving…' : 'Confirm & Move'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

// ============== LIST VIEW ==============
const ListView = ({ leads, stages, customFields, onEdit, onDelete, onStageChange, formatDate, isDark, textPrimary, textSecondary, borderColor, bgSecondary }) => {
  const [activeTab, setActiveTab] = useState('all');
  const getStage = (stageId) => stages.find(s => s.stage_id === stageId);

  // Get counts per stage
  const stageCounts = stages.reduce((acc, stage) => {
    acc[stage.stage_id] = leads.filter(l => l.stage_id === stage.stage_id).length;
    return acc;
  }, {});

  // Filter leads based on active tab
  const filteredLeads = activeTab === 'all' 
    ? leads 
    : leads.filter(l => l.stage_id === activeTab);

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 1).toUpperCase();
  };

  // Get avatar color based on first letter
  const getAvatarColor = (name) => {
    const colors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', 
      '#10b981', '#06b6d4', '#6366f1', '#84cc16', '#f97316'
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  // Format date with time
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();
  };

  return (
    <div className="space-y-4">
      {/* Tab Filters - Scrollable */}
      <div className={`flex items-center gap-3 sm:gap-6 pb-3 border-b-2 ${borderColor} overflow-x-auto no-scrollbar`}>
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-1.5 sm:gap-2 pb-2 border-b-2 transition-all flex-shrink-0 ${
            activeTab === 'all' 
              ? 'border-[#3b82f6] text-[#3b82f6]' 
              : `border-transparent ${textSecondary} hover:${textPrimary}`
          }`}
        >
          <span className="font-medium text-xs sm:text-sm">All ({leads.length})</span>
        </button>
        {stages.map(stage => (
          <button
            key={stage.stage_id}
            onClick={() => setActiveTab(stage.stage_id)}
            className={`flex items-center gap-1 sm:gap-2 pb-2 border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === stage.stage_id 
                ? `border-current`
                : `border-transparent ${textSecondary} hover:${textPrimary}`
            }`}
            style={{ color: activeTab === stage.stage_id ? stage.color : undefined }}
          >
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
            <span className="text-xs sm:text-sm">{stage.name} ({stageCounts[stage.stage_id] || 0})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredLeads.length === 0 ? (
        <div className={`text-center py-12 ${textSecondary}`}>
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No leads found in this category</p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full">
            {/* Table Header */}
            <thead>
              <tr className={`text-xs ${textSecondary} uppercase border-b ${borderColor}`}>
                <th className="px-4 py-3 text-left font-medium">Lead</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">Source</th>
                <th className="px-4 py-3 text-left font-medium">Stage</th>
                <th className="px-4 py-3 text-left font-medium">Appointment</th>
                <th className="px-4 py-3 text-left font-medium">Follow-up</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => {
                const stage = getStage(lead.stage_id);
                const avatarColor = getAvatarColor(lead.name);
                return (
                  <tr 
                    key={lead.lead_id} 
                    onClick={() => onEdit(lead)}
                    data-testid={`lead-row-${lead.lead_id}`}
                    className={`border-b ${borderColor} ${isDark ? 'hover:bg-[#27272a]/30' : 'hover:bg-gray-50'} transition-colors cursor-pointer`}
                  >
                    {/* Lead Column - Avatar + Name + Location */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                          style={{ backgroundColor: avatarColor }}
                        >
                          {getInitials(lead.name)}
                        </div>
                        <div>
                          <p className={`font-medium ${textPrimary}`}>{lead.name}</p>
                          {lead.service && (
                            <p className={`text-xs ${textSecondary}`}>{lead.service}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact Column - Phone + Email */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className={textPrimary}>{lead.phone || '-'}</p>
                        {lead.email && (
                          <p className={`text-sm ${textSecondary}`}>{lead.email}</p>
                        )}
                      </div>
                    </td>

                    {/* Source Column */}
                    <td className="px-4 py-4">
                      {lead.source ? (
                        <span className={`px-3 py-1 rounded text-sm ${isDark ? 'bg-[#27272a] text-[#a1a1aa]' : 'bg-gray-100 text-gray-600'}`}>
                          {lead.source}
                        </span>
                      ) : (
                        <span className={textSecondary}>-</span>
                      )}
                    </td>

                    {/* Stage Column */}
                    <td className="px-4 py-4">
                      <span
                        className="inline-block px-3 py-1 rounded text-sm border-2 font-medium whitespace-nowrap"
                        style={{
                          borderColor: stage?.color || '#71717a',
                          color: stage?.color || '#71717a',
                          backgroundColor: 'transparent'
                        }}
                      >
                        {stage?.name || 'Unknown'}
                      </span>
                    </td>

                    {/* Appointment Column — shown for any lead with appointment_at */}
                    <td className={`px-4 py-4 ${textSecondary}`} data-testid={`lead-appointment-${lead.lead_id}`}>
                      {lead.appointment_at ? (
                        <div>
                          <p className={`text-sm ${textPrimary}`}>
                            {new Date(lead.appointment_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-xs">
                            {new Date(lead.appointment_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ) : <span>-</span>}
                    </td>

                    {/* Follow-up Column */}
                    <td className={`px-4 py-4 ${textSecondary}`} data-testid={`lead-followup-${lead.lead_id}`}>
                      {lead.followup_at ? (
                        <div>
                          <p className={`text-sm ${textPrimary}`}>
                            {new Date(lead.followup_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-xs">
                            {new Date(lead.followup_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ) : <span>-</span>}
                    </td>

                    {/* Created Column */}
                    <td className={`px-4 py-4 ${textSecondary}`}>
                      {formatDateTime(lead.created_at)}
                    </td>

                    {/* Actions Column */}
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={(e) => { e.stopPropagation(); onEdit(lead); }}
                          className="h-8 w-8 p-0 rounded-full"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============== KANBAN VIEW ==============
const KanbanView = ({ stages, getLeadsByStage, onEdit, onDelete, onStageChange, onFollowUp, formatDate, isDark, textPrimary, textSecondary, borderColor, bgSecondary }) => {
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const handleDragStart = (e, lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lead.lead_id);
    // Add visual feedback
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedLead(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  };

  const handleDragLeave = (e) => {
    // Only clear if leaving the column entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverStage(null);
    }
  };

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    setDragOverStage(null);
    
    if (draggedLead && draggedLead.stage_id !== stageId) {
      onStageChange(draggedLead.lead_id, stageId);
    }
    setDraggedLead(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-view">
      {stages.map(stage => {
        const stageLeads = getLeadsByStage(stage.stage_id);
        const isDropTarget = dragOverStage === stage.stage_id;
        
        return (
          <div
            key={stage.stage_id}
            className={`flex-shrink-0 w-72 ${isDark ? 'bg-[#18181b]' : 'bg-white'} rounded-lg border-2 transition-all duration-200 ${
              isDropTarget 
                ? 'border-[#3b82f6] bg-[#3b82f6]/5 scale-[1.02]' 
                : borderColor
            }`}
            onDragOver={(e) => handleDragOver(e, stage.stage_id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.stage_id)}
          >
            {/* Column Header */}
            <div 
              className={`p-3 border-b ${borderColor} flex items-center gap-2`}
              style={{ borderBottomColor: isDropTarget ? stage.color : undefined }}
            >
              <div className="w-3 h-3 rounded" style={{ backgroundColor: stage.color }} />
              <span className={`text-sm font-medium ${textPrimary}`}>{stage.name}</span>
              <Badge className={`${bgSecondary} ${textSecondary} text-xs ml-auto`}>
                {stageLeads.length}
              </Badge>
            </div>

            {/* Cards */}
            <div className={`p-2 space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto min-h-[100px] ${
              isDropTarget ? 'bg-[#3b82f6]/5' : ''
            }`}>
              {stageLeads.map(lead => (
                <LeadCard
                  key={lead.lead_id}
                  lead={lead}
                  stages={stages}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onStageChange={onStageChange}
                  onFollowUp={onFollowUp}
                  formatDate={formatDate}
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderColor={borderColor}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedLead?.lead_id === lead.lead_id}
                />
              ))}
              {stageLeads.length === 0 && (
                <div className={`text-center py-8 text-xs ${textSecondary} ${isDropTarget ? 'text-[#3b82f6]' : ''}`}>
                  {isDropTarget ? 'Drop here' : 'No leads'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============== PREVIEW BOARD ==============
const PreviewBoard = ({ leads, stages, selectedLead, setSelectedLead, onEdit, onDelete, onStageChange, customFields, formatDate, isDark, textPrimary, textSecondary, borderColor, bgSecondary }) => {
  const getStage = (stageId) => stages.find(s => s.stage_id === stageId);

  return (
    <div className="flex gap-4 h-full">
      {/* Left: Lead List */}
      <div className={`w-1/2 ${isDark ? 'bg-[#18181b]' : 'bg-white'} rounded-lg border ${borderColor} overflow-hidden`}>
        <div className={`p-3 border-b ${borderColor} ${bgSecondary}`}>
          <h3 className={`text-sm font-medium ${textPrimary}`}>All Leads ({leads.length})</h3>
        </div>
        <div className="overflow-y-auto max-h-[calc(100vh-350px)]">
          {leads.map(lead => {
            const stage = getStage(lead.stage_id);
            return (
              <div
                key={lead.lead_id}
                onClick={() => setSelectedLead(lead)}
                className={`p-3 border-b ${borderColor} cursor-pointer hover:${bgSecondary} ${selectedLead?.lead_id === lead.lead_id ? bgSecondary : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-medium ${textPrimary}`}>{lead.name}</span>
                  <Badge style={{ backgroundColor: `${stage?.color}20`, color: stage?.color }} className="text-xs">
                    {stage?.name}
                  </Badge>
                </div>
                <div className={`text-xs ${textSecondary} flex items-center gap-3`}>
                  {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                  {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Lead Detail */}
      <div className={`w-1/2 ${isDark ? 'bg-[#18181b]' : 'bg-white'} rounded-lg border ${borderColor} overflow-hidden`}>
        {selectedLead ? (
          <>
            <div className={`p-4 border-b ${borderColor} flex items-center justify-between`}>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>{selectedLead.name}</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(selectedLead)}>
                  <Edit2 className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400" onClick={() => onDelete(selectedLead.lead_id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-400px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-xs ${textSecondary} block mb-1`}>Phone</label>
                  <p className={textPrimary}>{selectedLead.phone || '-'}</p>
                </div>
                <div>
                  <label className={`text-xs ${textSecondary} block mb-1`}>Email</label>
                  <p className={textPrimary}>{selectedLead.email || '-'}</p>
                </div>
                <div>
                  <label className={`text-xs ${textSecondary} block mb-1`}>Stage</label>
                  <Select value={selectedLead.stage_id} onValueChange={(v) => onStageChange(selectedLead.lead_id, v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {stages.map(s => (
                        <SelectItem key={s.stage_id} value={s.stage_id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={`text-xs ${textSecondary} block mb-1`}>Source</label>
                  <p className={textPrimary}>{selectedLead.source || '-'}</p>
                </div>
                <div>
                  <label className={`text-xs ${textSecondary} block mb-1`}>Service</label>
                  <p className={textPrimary}>{selectedLead.service || '-'}</p>
                </div>
                <div>
                  <label className={`text-xs ${textSecondary} block mb-1`}>Created</label>
                  <p className={textPrimary}>{formatDate(selectedLead.created_at)}</p>
                </div>
              </div>
              {selectedLead.notes && (
                <div>
                  <label className={`text-xs ${textSecondary} block mb-1`}>Notes</label>
                  <p className={`${textPrimary} text-sm`}>{selectedLead.notes}</p>
                </div>
              )}
              {customFields.length > 0 && Object.keys(selectedLead.custom_fields || {}).length > 0 && (
                <div className={`border-t ${borderColor} pt-4`}>
                  <h4 className={`text-sm font-medium ${textPrimary} mb-2`}>Custom Fields</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {customFields.map(field => {
                      const value = selectedLead.custom_fields?.[field.field_id];
                      if (!value) return null;
                      return (
                        <div key={field.field_id}>
                          <label className={`text-xs ${textSecondary} block mb-1`}>{field.name}</label>
                          <p className={textPrimary}>{value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={`h-full flex items-center justify-center ${textSecondary}`}>
            <p>Select a lead to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============== LEAD CARD ==============
const LeadCard = ({ lead, stages, onEdit, onDelete, onStageChange, onFollowUp, formatDate, isDark, textPrimary, textSecondary, borderColor, onDragStart, onDragEnd, isDragging }) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, lead)}
      onDragEnd={onDragEnd}
      className={`p-3 ${isDark ? 'bg-[#1c1917]' : 'bg-white'} rounded-lg border ${isDark ? 'border-[#27272a]' : 'border-gray-200'} ${isDark ? 'hover:border-[#3f3f46]' : 'hover:border-gray-300'} shadow-sm group cursor-grab active:cursor-grabbing transition-all duration-200 overflow-hidden ${
        isDragging ? 'opacity-50 scale-95 rotate-2' : 'opacity-100'
      }`}
      data-testid={`lead-card-${lead.lead_id}`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GripVertical className={`h-4 w-4 ${textSecondary} opacity-0 group-hover:opacity-100 transition-opacity cursor-grab flex-shrink-0`} />
          <span className={`font-medium ${textPrimary} truncate`}>{lead.name}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onEdit(lead); }}>
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400" onClick={(e) => { e.stopPropagation(); onDelete(lead.lead_id); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className={`text-xs ${textSecondary} space-y-1 ml-6`}>
        {lead.phone && (
          <div className="flex items-center gap-1">
            <Phone className="h-3 w-3" /> {lead.phone}
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" /> {lead.email}
          </div>
        )}
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" /> {formatDate(lead.created_at)}
        </div>
      </div>
      
      {/* Follow-up Button */}
      <div className={`mt-2 pt-2 border-t ${isDark ? 'border-[#27272a]' : 'border-gray-100'}`}>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onFollowUp && onFollowUp(lead); }}
          className="w-full h-7 text-xs text-[#f59e0b] hover:bg-[#f59e0b]/10 justify-start"
        >
          <Clock className="h-3 w-3 mr-1" />
          Follow-up
          {lead.followups?.length > 0 && (
            <Badge className="ml-auto bg-[#f59e0b]/20 text-[#f59e0b] text-xs px-1">
              {lead.followups.length}
            </Badge>
          )}
        </Button>
      </div>
    </div>
  );
};

export default LeadsPageV2;
