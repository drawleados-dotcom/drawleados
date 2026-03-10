import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
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
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LeadsPageV2 = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Data state
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [stats, setStats] = useState({ total: 0, by_stage: {} });
  const [sheetsConfig, setSheetsConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [viewMode, setViewMode] = useState('kanban'); // 'list', 'kanban', 'preview'
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showStagesModal, setShowStagesModal] = useState(false);
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);

  // Form state
  const [leadForm, setLeadForm] = useState({
    name: '',
    phone: '',
    email: '',
    stage_id: '',
    source: '',
    service: '',
    notes: '',
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
  const [followUpForm, setFollowUpForm] = useState({
    date: '',
    time: '',
    notes: '',
  });

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
      ]);
      setLoading(false);
    };
    loadAll();
  }, [loadStages, loadLeads, loadCustomFields, loadStats, loadSheetsConfig]);

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
      loadLeads();
      loadStats();
    } catch (error) {
      toast.error('Failed to update lead stage');
    }
  };

  const resetLeadForm = () => {
    setLeadForm({
      name: '',
      phone: '',
      email: '',
      stage_id: stages.length > 0 ? stages[0].stage_id : '',
      source: '',
      service: '',
      notes: '',
      custom_fields: {},
    });
  };

  const openEditLead = (lead) => {
    setEditingLead(lead);
    setLeadForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      stage_id: lead.stage_id || '',
      source: lead.source || '',
      service: lead.service || '',
      notes: lead.notes || '',
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
      await axios.put(`${API}/api/leads-v2/stages/reorder`, stageOrders, { headers });
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
      await axios.put(`${API}/api/leads-v2/stages/reorder`, stageOrders, { headers });
      setStages(newStages);
      toast.success('Stage order updated');
    } catch (error) {
      toast.error('Failed to reorder stages');
    }
  };

  // ============== FOLLOW-UP ACTIONS ==============

  const openFollowUpModal = (lead) => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    
    setFollowUpLead(lead);
    setFollowUpForm({
      date: dateStr,
      time: timeStr,
      notes: '',
    });
    setShowFollowUpModal(true);
  };

  const submitFollowUp = async () => {
    if (!followUpLead) return;
    
    try {
      const followUpEntry = {
        date: followUpForm.date,
        time: followUpForm.time,
        notes: followUpForm.notes,
        created_at: new Date().toISOString(),
      };
      
      // Get existing follow-ups or create empty array
      const existingFollowUps = followUpLead.follow_ups || [];
      
      // Add new follow-up to the lead
      await axios.put(`${API}/api/leads-v2/leads/${followUpLead.lead_id}`, {
        follow_ups: [...existingFollowUps, followUpEntry]
      }, { headers });
      
      toast.success('Follow-up added');
      setShowFollowUpModal(false);
      setFollowUpLead(null);
      setFollowUpForm({ date: '', time: '', notes: '' });
      loadLeads();
    } catch (error) {
      toast.error('Failed to add follow-up');
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

  const syncSheets = async () => {
    try {
      const res = await axios.post(`${API}/api/leads-v2/google-sheets/sync`, {}, { headers });
      toast.info(res.data.note || 'Sync initiated');
    } catch (error) {
      toast.error('Failed to sync');
    }
  };

  // ============== HELPERS ==============

  const filteredLeads = leads.filter(lead => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(term) ||
      lead.email?.toLowerCase().includes(term) ||
      lead.phone?.includes(term)
    );
  });

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
              {/* Google Sheets Connection */}
              {sheetsConfig?.sheet_id ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/20 text-green-400 flex items-center gap-1">
                    <FileSpreadsheet className="h-3 w-3" />
                    Connected
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={syncSheets} title="Sync Now">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={disconnectSheets} className="text-red-400">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowSheetsModal(true)}
                  variant="outline"
                  className="border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa]"
                  data-testid="connect-sheets-btn"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect Sheets
                </Button>
              )}

              {/* View Toggle */}
              <div className="flex items-center bg-[#18181b] rounded-lg p-1 border border-[#27272a]">
                <button
                  onClick={() => setViewMode('list')}
                  data-testid="view-list-btn"
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a]'}`}
                  title="List View"
                >
                  <Table2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  data-testid="view-preview-btn"
                  className={`p-2 rounded ${viewMode === 'preview' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a]'}`}
                  title="Preview Board"
                >
                  <Columns3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  data-testid="view-kanban-btn"
                  className={`p-2 rounded ${viewMode === 'kanban' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a]'}`}
                  title="Kanban View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              <Button
                onClick={() => setShowStagesModal(true)}
                variant="outline"
                className="border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa]"
              >
                <Settings className="h-4 w-4 mr-2" />
                Stages
              </Button>

              <Button
                onClick={() => setShowFieldsModal(true)}
                variant="outline"
                className="border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Fields
              </Button>

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

        {/* Stats Cards */}
        <div className={`p-4 border-b ${borderColor} flex gap-3 overflow-x-auto`}>
          <div className={`p-3 rounded-xl ${bgSecondary} min-w-[120px] text-center`}>
            <p className={`text-2xl font-bold ${textPrimary}`}>{stats.total}</p>
            <p className={`text-xs ${textSecondary}`}>Total Leads</p>
          </div>
          {stages.map(stage => (
            <div
              key={stage.stage_id}
              className={`p-3 rounded-xl min-w-[120px] text-center`}
              style={{ backgroundColor: `${stage.color}20` }}
            >
              <p className="text-2xl font-bold" style={{ color: stage.color }}>
                {stats.by_stage?.[stage.stage_id]?.count || 0}
              </p>
              <p className={`text-xs ${textSecondary}`}>{stage.name}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className={`p-4 border-b ${borderColor}`}>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-input"
              className={`pl-10 ${bgSecondary} border-none`}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className={`text-center py-12 ${textSecondary}`}>Loading...</div>
          ) : viewMode === 'list' ? (
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
          ) : viewMode === 'preview' ? (
            <PreviewBoard
              leads={filteredLeads}
              stages={stages}
              selectedLead={selectedLead}
              setSelectedLead={setSelectedLead}
              onEdit={openEditLead}
              onDelete={deleteLead}
              onStageChange={updateLeadStage}
              onFollowUp={openFollowUpModal}
              customFields={customFields}
              formatDate={formatDate}
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
              bgSecondary={bgSecondary}
            />
          ) : (
            <KanbanView
              stages={stages}
              getLeadsByStage={getLeadsByStage}
              onEdit={openEditLead}
              onDelete={deleteLead}
              onStageChange={updateLeadStage}
              onFollowUp={openFollowUpModal}
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

        {/* Add/Edit Lead Modal */}
        <Dialog open={showAddLeadModal} onOpenChange={setShowAddLeadModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-lg max-h-[85vh] overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
                  <label className={`text-sm ${textSecondary} block mb-1`}>Phone</label>
                  <Input
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className={bgSecondary}
                  />
                </div>
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
              </div>
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
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Service</label>
                <Input
                  value={leadForm.service}
                  onChange={(e) => setLeadForm({ ...leadForm, service: e.target.value })}
                  placeholder="Service interested in"
                  className={bgSecondary}
                />
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

              {/* Custom Fields */}
              {customFields.length > 0 && (
                <div className="border-t border-[#3f3f46] pt-4">
                  <h4 className={`text-sm font-medium ${textPrimary} mb-3`}>Custom Fields</h4>
                  <div className="space-y-3">
                    {customFields.map(field => (
                      <div key={field.field_id}>
                        <label className={`text-sm ${textSecondary} block mb-1`}>{field.name}</label>
                        {field.field_type === 'textarea' ? (
                          <Textarea
                            value={leadForm.custom_fields?.[field.field_id] || ''}
                            onChange={(e) => setLeadForm({
                              ...leadForm,
                              custom_fields: { ...leadForm.custom_fields, [field.field_id]: e.target.value }
                            })}
                            className={bgSecondary}
                            rows={2}
                          />
                        ) : field.field_type === 'select' ? (
                          <Select
                            value={leadForm.custom_fields?.[field.field_id] || ''}
                            onValueChange={(v) => setLeadForm({
                              ...leadForm,
                              custom_fields: { ...leadForm.custom_fields, [field.field_id]: v }
                            })}
                          >
                            <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>
                              {(field.options || []).map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                            value={leadForm.custom_fields?.[field.field_id] || ''}
                            onChange={(e) => setLeadForm({
                              ...leadForm,
                              custom_fields: { ...leadForm.custom_fields, [field.field_id]: e.target.value }
                            })}
                            className={bgSecondary}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowAddLeadModal(false); setEditingLead(null); }}>Cancel</Button>
              <Button
                onClick={editingLead ? updateLead : createLead}
                data-testid="save-lead-btn"
                className="bg-[#3b82f6] hover:bg-[#2563eb]"
              >
                {editingLead ? 'Update Lead' : 'Create Lead'}
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
                        className={`p-0.5 rounded hover:bg-[#3f3f46] ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveStageDown(index)}
                        disabled={index === stages.length - 1}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Date</label>
                  <Input
                    type="date"
                    value={followUpForm.date}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, date: e.target.value })}
                    className={bgSecondary}
                  />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Time</label>
                  <Input
                    type="time"
                    value={followUpForm.time}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, time: e.target.value })}
                    className={bgSecondary}
                  />
                </div>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Notes</label>
                <Textarea
                  value={followUpForm.notes}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                  placeholder="Follow-up notes..."
                  className={bgSecondary}
                  rows={3}
                />
              </div>
              
              {/* Previous follow-ups */}
              {followUpLead?.follow_ups && followUpLead.follow_ups.length > 0 && (
                <div className="border-t border-[#3f3f46] pt-4">
                  <h4 className={`text-sm font-medium ${textPrimary} mb-2`}>Previous Follow-ups</h4>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {followUpLead.follow_ups.map((fu, idx) => (
                      <div key={idx} className={`p-2 rounded ${bgSecondary} text-sm`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-3 w-3 text-[#f59e0b]" />
                          <span className={textPrimary}>{fu.date} {fu.time}</span>
                        </div>
                        {fu.notes && <p className={`text-xs ${textSecondary}`}>{fu.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowFollowUpModal(false); setFollowUpLead(null); }}>Cancel</Button>
              <Button onClick={submitFollowUp} className="bg-[#f59e0b] hover:bg-[#d97706]">
                <MessageSquare className="h-4 w-4 mr-2" /> Add Follow-up
              </Button>
            </DialogFooter>
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
      {/* Tab Filters */}
      <div className={`flex items-center gap-6 pb-3 border-b-2 ${borderColor} overflow-x-auto`}>
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 pb-2 border-b-2 transition-all ${
            activeTab === 'all' 
              ? 'border-[#3b82f6] text-[#3b82f6]' 
              : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
          }`}
        >
          <span className="font-medium">All ({leads.length})</span>
        </button>
        {stages.map(stage => (
          <button
            key={stage.stage_id}
            onClick={() => setActiveTab(stage.stage_id)}
            className={`flex items-center gap-2 pb-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === stage.stage_id 
                ? `border-current`
                : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
            }`}
            style={{ color: activeTab === stage.stage_id ? stage.color : undefined }}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
            <span>{stage.name} ({stageCounts[stage.stage_id] || 0})</span>
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
                    className={`border-b ${borderColor} hover:bg-[#27272a]/30 transition-colors`}
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
                        className="px-3 py-1 rounded text-sm border-2 font-medium"
                        style={{ 
                          borderColor: stage?.color || '#71717a',
                          color: stage?.color || '#71717a',
                          backgroundColor: 'transparent'
                        }}
                      >
                        {stage?.name || 'Unknown'}
                      </span>
                    </td>

                    {/* Created Column */}
                    <td className={`px-4 py-4 ${textSecondary}`}>
                      {formatDateTime(lead.created_at)}
                    </td>

                    {/* Actions Column */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex justify-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => onEdit(lead)}
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
              className="p-3 border-b border-[#27272a] flex items-center gap-2"
              style={{ borderBottomColor: isDropTarget ? stage.color : undefined }}
            >
              <div className="w-3 h-3 rounded" style={{ backgroundColor: stage.color }} />
              <span className={`text-sm font-medium ${textPrimary}`}>{stage.name}</span>
              <Badge className="bg-[#27272a] text-[#71717a] text-xs ml-auto">
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
                <div className="border-t border-[#3f3f46] pt-4">
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
      className={`p-3 ${isDark ? 'bg-[#0c0a09]' : 'bg-gray-50'} rounded-lg border ${borderColor} hover:border-[#3f3f46] group cursor-grab active:cursor-grabbing transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-95 rotate-2' : 'opacity-100'
      }`}
      data-testid={`lead-card-${lead.lead_id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <GripVertical className={`h-4 w-4 ${textSecondary} opacity-0 group-hover:opacity-100 transition-opacity cursor-grab`} />
          <span className={`font-medium ${textPrimary}`}>{lead.name}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
      <div className="mt-2 pt-2 border-t border-[#27272a]">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onFollowUp && onFollowUp(lead); }}
          className="w-full h-7 text-xs text-[#f59e0b] hover:bg-[#f59e0b]/10 justify-start"
        >
          <Clock className="h-3 w-3 mr-1" />
          Follow-up
          {lead.follow_ups?.length > 0 && (
            <Badge className="ml-auto bg-[#f59e0b]/20 text-[#f59e0b] text-xs px-1">
              {lead.follow_ups.length}
            </Badge>
          )}
        </Button>
      </div>
    </div>
  );
};

export default LeadsPageV2;
