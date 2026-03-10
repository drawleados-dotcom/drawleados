import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Plus,
  Search,
  Calendar,
  Target,
  FileText,
  Video,
  Image,
  ExternalLink,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Users,
  BarChart3,
  Table2,
  LayoutGrid,
  Settings,
  Building2,
  Phone,
  Mail,
  MapPin,
  FolderOpen,
  ArrowLeft,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Status options
const CONTENT_STATUS = ['Not Started', 'Writing', 'Review', 'Approved', 'Rejected'];
const CREATIVE_STATUS = ['Yet to Start', 'Design', 'Edit', 'Review', 'Published', 'Approved'];
const AD_STATUS = ['Draft', 'Active', 'Paused', 'Completed'];
const AD_TYPES = ['Static', 'Video', 'Carousel', 'Reel'];
const MODES = ['Online', 'Offline'];

const MetaAdsBoard = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // View state - 'clients', 'client-detail', 'all-campaigns'
  const [mainView, setMainView] = useState('clients');
  const [selectedClient, setSelectedClient] = useState(null);

  // Clients
  const [clients, setClients] = useState([]);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState({
    name: '',
    area: '',
    contact_person: '',
    email: '',
    phone: '',
    drive_url: '',
    notes: '',
  });

  // Campaigns & Ads
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCampaignModal, setShowAddCampaignModal] = useState(false);
  const [showAddAdModal, setShowAddAdModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState({});
  const [popupUrl, setPopupUrl] = useState(null);
  const [popupTitle, setPopupTitle] = useState('');
  
  // View mode for campaigns
  const [viewMode, setViewMode] = useState('table');
  
  // Custom attributes
  const [customAttributes, setCustomAttributes] = useState([]);
  const [showAddAttributeModal, setShowAddAttributeModal] = useState(false);
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrType, setNewAttrType] = useState('select');
  
  // Filters
  const [monthFilter, setMonthFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Campaign Form
  const [campaignForm, setCampaignForm] = useState({
    client_id: '',
    client_name: '',
    area: '',
    mode: 'Online',
    month: new Date().toISOString().slice(0, 7),
    target_name: '',
    service_angle: '',
  });

  // Ad Form
  const [adForm, setAdForm] = useState({
    ad_number: 1,
    ad_title: '',
    ad_type: 'Static',
    content_doc_url: '',
    content_status: 'Not Started',
    creative_platform: '',
    creative_drive_url: '',
    creative_status: 'Yet to Start',
    ad_status: 'Draft',
    leads_count: 0,
    spend: 0,
    notes: '',
    custom_attributes: {},
  });

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  // ============== DATA LOADING ==============
  
  const loadClients = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/meta-ads/clients`, { headers });
      setClients(res.data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      setClients([]);
    }
  }, []);

  const loadCampaigns = useCallback(async (clientId = null) => {
    try {
      const url = clientId 
        ? `${API}/api/meta-ads/campaigns?client_id=${clientId}`
        : `${API}/api/meta-ads/campaigns`;
      const res = await axios.get(url, { headers });
      setCampaigns(res.data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCustomAttributes = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/meta-ads/custom-attributes`, { headers });
      setCustomAttributes(res.data || []);
    } catch (error) {
      console.error('Error loading custom attributes:', error);
    }
  }, []);

  const loadClientDetail = useCallback(async (clientId) => {
    try {
      const res = await axios.get(`${API}/api/meta-ads/clients/${clientId}`, { headers });
      setSelectedClient(res.data);
      setCampaigns(res.data.campaigns || []);
    } catch (error) {
      console.error('Error loading client:', error);
    }
  }, []);

  useEffect(() => {
    loadClients();
    loadCustomAttributes();
    setLoading(false);
  }, [loadClients, loadCustomAttributes]);

  // ============== CLIENT ACTIONS ==============

  const createClient = async () => {
    if (!clientForm.name.trim()) {
      toast.error('Client name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/meta-ads/clients`, clientForm, { headers });
      toast.success('Client created');
      setShowAddClientModal(false);
      resetClientForm();
      loadClients();
    } catch (error) {
      toast.error('Failed to create client');
    }
  };

  const updateClient = async () => {
    if (!editingClient) return;
    try {
      await axios.put(`${API}/api/meta-ads/clients/${editingClient.client_id}`, clientForm, { headers });
      toast.success('Client updated');
      setEditingClient(null);
      setShowAddClientModal(false);
      resetClientForm();
      loadClients();
      if (selectedClient?.client_id === editingClient.client_id) {
        loadClientDetail(editingClient.client_id);
      }
    } catch (error) {
      toast.error('Failed to update client');
    }
  };

  const deleteClient = async (clientId) => {
    if (!window.confirm('Delete this client? This will not delete campaigns.')) return;
    try {
      await axios.delete(`${API}/api/meta-ads/clients/${clientId}`, { headers });
      toast.success('Client deleted');
      loadClients();
      if (selectedClient?.client_id === clientId) {
        setMainView('clients');
        setSelectedClient(null);
      }
    } catch (error) {
      toast.error('Failed to delete client');
    }
  };

  const openEditClient = (client) => {
    setEditingClient(client);
    setClientForm({
      name: client.name || '',
      area: client.area || '',
      contact_person: client.contact_person || '',
      email: client.email || '',
      phone: client.phone || '',
      drive_url: client.drive_url || '',
      notes: client.notes || '',
    });
    setShowAddClientModal(true);
  };

  const resetClientForm = () => {
    setClientForm({
      name: '',
      area: '',
      contact_person: '',
      email: '',
      phone: '',
      drive_url: '',
      notes: '',
    });
    setEditingClient(null);
  };

  // ============== CAMPAIGN ACTIONS ==============

  const createCampaign = async () => {
    if (!campaignForm.target_name) {
      toast.error('Target name is required');
      return;
    }
    try {
      const formData = { ...campaignForm };
      if (selectedClient) {
        formData.client_id = selectedClient.client_id;
        formData.client_name = selectedClient.name;
        formData.area = selectedClient.area || formData.area;
      }
      await axios.post(`${API}/api/meta-ads/campaigns`, formData, { headers });
      toast.success('Campaign created');
      setShowAddCampaignModal(false);
      resetCampaignForm();
      if (selectedClient) {
        loadClientDetail(selectedClient.client_id);
      } else {
        loadCampaigns();
      }
    } catch (error) {
      toast.error('Failed to create campaign');
    }
  };

  const deleteCampaign = async (campaignId) => {
    if (!window.confirm('Delete this campaign and all its ads?')) return;
    try {
      await axios.delete(`${API}/api/meta-ads/campaigns/${campaignId}`, { headers });
      toast.success('Campaign deleted');
      if (selectedClient) {
        loadClientDetail(selectedClient.client_id);
      } else {
        loadCampaigns();
      }
    } catch (error) {
      toast.error('Failed to delete campaign');
    }
  };

  const resetCampaignForm = () => {
    setCampaignForm({
      client_id: selectedClient?.client_id || '',
      client_name: selectedClient?.name || '',
      area: selectedClient?.area || '',
      mode: 'Online',
      month: new Date().toISOString().slice(0, 7),
      target_name: '',
      service_angle: '',
    });
  };

  // ============== AD ACTIONS ==============

  const addAd = async () => {
    if (!selectedCampaign) return;
    try {
      await axios.post(`${API}/api/meta-ads/campaigns/${selectedCampaign.campaign_id}/ads`, adForm, { headers });
      toast.success('Ad added');
      setShowAddAdModal(false);
      resetAdForm();
      if (selectedClient) {
        loadClientDetail(selectedClient.client_id);
      } else {
        loadCampaigns();
      }
    } catch (error) {
      toast.error('Failed to add ad');
    }
  };

  const updateAd = async (campaignId, adId, updates) => {
    try {
      await axios.put(`${API}/api/meta-ads/campaigns/${campaignId}/ads/${adId}`, updates, { headers });
      if (selectedClient) {
        loadClientDetail(selectedClient.client_id);
      } else {
        loadCampaigns();
      }
    } catch (error) {
      toast.error('Failed to update ad');
    }
  };

  const resetAdForm = () => {
    setAdForm({
      ad_number: 1,
      ad_title: '',
      ad_type: 'Static',
      content_doc_url: '',
      content_status: 'Not Started',
      creative_platform: '',
      creative_drive_url: '',
      creative_status: 'Yet to Start',
      ad_status: 'Draft',
      leads_count: 0,
      spend: 0,
      notes: '',
      custom_attributes: {},
    });
  };

  // ============== CUSTOM ATTRIBUTES ==============

  const createCustomAttribute = async () => {
    if (!newAttrName.trim()) {
      toast.error('Attribute name is required');
      return;
    }
    try {
      await axios.post(`${API}/api/meta-ads/custom-attributes`, {
        name: newAttrName,
        attr_type: newAttrType
      }, { headers });
      toast.success('Custom attribute created');
      setShowAddAttributeModal(false);
      setNewAttrName('');
      setNewAttrType('select');
      loadCustomAttributes();
    } catch (error) {
      toast.error('Failed to create attribute');
    }
  };

  const deleteCustomAttribute = async (attrId) => {
    if (!window.confirm('Delete this custom attribute?')) return;
    try {
      await axios.delete(`${API}/api/meta-ads/custom-attributes/${attrId}`, { headers });
      toast.success('Attribute deleted');
      loadCustomAttributes();
    } catch (error) {
      toast.error('Failed to delete attribute');
    }
  };

  // ============== HELPERS ==============

  const openPopup = (url, title) => {
    if (url) {
      setPopupUrl(url);
      setPopupTitle(title);
    }
  };

  const toggleCampaign = (campaignId) => {
    setExpandedCampaigns(prev => ({
      ...prev,
      [campaignId]: !prev[campaignId]
    }));
  };

  const viewClientDetail = (client) => {
    setSelectedClient(client);
    loadClientDetail(client.client_id);
    setMainView('client-detail');
  };

  const backToClients = () => {
    setMainView('clients');
    setSelectedClient(null);
    setCampaigns([]);
  };

  const viewAllCampaigns = () => {
    setMainView('all-campaigns');
    setSelectedClient(null);
    loadCampaigns();
  };

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(c => {
    const matchesMonth = monthFilter === 'all' || c.month === monthFilter;
    const matchesSearch = !searchTerm || 
      c.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.target_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.service_angle?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesMonth && matchesSearch;
  });

  // Get unique months
  const months = [...new Set(campaigns.map(c => c.month))].sort().reverse();

  // Group campaigns by month
  const campaignsByMonth = filteredCampaigns.reduce((acc, c) => {
    const month = c.month || 'Unknown';
    if (!acc[month]) acc[month] = [];
    acc[month].push(c);
    return acc;
  }, {});

  // Stats
  const totalLeads = campaigns.reduce((sum, c) => 
    sum + (c.ads || []).reduce((s, ad) => s + (ad.leads_count || 0), 0), 0
  );
  const totalSpend = campaigns.reduce((sum, c) => 
    sum + (c.ads || []).reduce((s, ad) => s + (ad.spend || 0), 0), 0
  );
  const totalAds = campaigns.reduce((sum, c) => sum + (c.ads?.length || 0), 0);

  const formatMonth = (monthStr) => {
    if (!monthStr) return 'Unknown';
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const getStatusColor = (status, type) => {
    if (type === 'content') {
      switch (status) {
        case 'Approved': return 'bg-green-500/20 text-green-400';
        case 'Writing': return 'bg-blue-500/20 text-blue-400';
        case 'Review': return 'bg-yellow-500/20 text-yellow-400';
        case 'Rejected': return 'bg-red-500/20 text-red-400';
        default: return 'bg-gray-500/20 text-gray-400';
      }
    } else if (type === 'creative') {
      switch (status) {
        case 'Published': case 'Approved': return 'bg-green-500/20 text-green-400';
        case 'Design': case 'Edit': return 'bg-blue-500/20 text-blue-400';
        case 'Review': return 'bg-yellow-500/20 text-yellow-400';
        default: return 'bg-gray-500/20 text-gray-400';
      }
    }
    return 'bg-gray-500/20 text-gray-400';
  };

  // ============== RENDER ==============

  return (
    <Layout>
      <div className="flex flex-col h-full" data-testid="meta-ads-board">
        {/* Header */}
        <div className={`p-4 border-b ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mainView !== 'clients' && (
                <Button variant="ghost" size="sm" onClick={backToClients} className="mr-2">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
              <div className="p-2 rounded-lg bg-[#1877f2]/20">
                <Target className="h-6 w-6 text-[#1877f2]" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${textPrimary}`}>
                  {mainView === 'clients' ? 'Meta Ads Board' : 
                   mainView === 'client-detail' ? selectedClient?.name : 'All Campaigns'}
                </h1>
                <p className={`text-sm ${textSecondary}`}>
                  {mainView === 'clients' ? 'Performance Marketing Management' : 
                   mainView === 'client-detail' ? `${selectedClient?.area || 'Client'} • ${campaigns.length} Campaigns` : 
                   `${campaigns.length} Total Campaigns`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {mainView === 'clients' && (
                <>
                  <Button 
                    onClick={viewAllCampaigns}
                    variant="outline"
                    className="border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa]"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" /> All Campaigns
                  </Button>
                  <Button 
                    onClick={() => { resetClientForm(); setShowAddClientModal(true); }}
                    data-testid="new-client-btn"
                    className="bg-[#1877f2] hover:bg-[#166fe5]"
                  >
                    <Plus className="h-4 w-4 mr-2" /> New Client
                  </Button>
                </>
              )}
              {(mainView === 'client-detail' || mainView === 'all-campaigns') && (
                <>
                  <div className="flex items-center bg-[#18181b] rounded-lg p-1 border border-[#27272a]">
                    <button
                      onClick={() => setViewMode('table')}
                      data-testid="view-table-btn"
                      className={`p-2 rounded ${viewMode === 'table' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a]'}`}
                    >
                      <Table2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('kanban')}
                      data-testid="view-kanban-btn"
                      className={`p-2 rounded ${viewMode === 'kanban' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a]'}`}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                  </div>
                  <Button 
                    onClick={() => setShowAddAttributeModal(true)}
                    variant="outline"
                    className="border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa]"
                  >
                    <Settings className="h-4 w-4 mr-2" /> Custom Fields
                  </Button>
                  <Button 
                    onClick={() => { resetCampaignForm(); setShowAddCampaignModal(true); }}
                    data-testid="new-campaign-btn"
                    className="bg-[#1877f2] hover:bg-[#166fe5]"
                  >
                    <Plus className="h-4 w-4 mr-2" /> New Campaign
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-4">
          {mainView === 'clients' ? (
            // ============== CLIENTS VIEW ==============
            <ClientsView
              clients={clients}
              viewClientDetail={viewClientDetail}
              openEditClient={openEditClient}
              deleteClient={deleteClient}
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
              bgSecondary={bgSecondary}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          ) : (
            // ============== CAMPAIGNS VIEW (Detail or All) ==============
            <>
              {/* Stats */}
              <div className={`mb-4 grid grid-cols-4 gap-4`}>
                <div className={`p-4 rounded-xl ${bgSecondary} text-center`}>
                  <BarChart3 className="h-6 w-6 mx-auto mb-2 text-[#1877f2]" />
                  <p className={`text-2xl font-bold ${textPrimary}`}>{campaigns.length}</p>
                  <p className={`text-xs ${textSecondary}`}>Campaigns</p>
                </div>
                <div className={`p-4 rounded-xl ${bgSecondary} text-center`}>
                  <FileText className="h-6 w-6 mx-auto mb-2 text-[#6366f1]" />
                  <p className={`text-2xl font-bold ${textPrimary}`}>{totalAds}</p>
                  <p className={`text-xs ${textSecondary}`}>Total Ads</p>
                </div>
                <div className={`p-4 rounded-xl ${bgSecondary} text-center`}>
                  <Users className="h-6 w-6 mx-auto mb-2 text-[#22c55e]" />
                  <p className={`text-2xl font-bold text-[#22c55e]`}>{totalLeads}</p>
                  <p className={`text-xs ${textSecondary}`}>Total Leads</p>
                </div>
                <div className={`p-4 rounded-xl ${bgSecondary} text-center`}>
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-[#f59e0b]" />
                  <p className={`text-2xl font-bold ${textPrimary}`}>₹{totalSpend.toLocaleString()}</p>
                  <p className={`text-xs ${textSecondary}`}>Total Spend</p>
                </div>
              </div>

              {/* Filters */}
              <div className={`mb-4 flex flex-wrap items-center gap-3`}>
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Search campaigns..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`pl-10 ${bgSecondary} border-none`}
                  />
                </div>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className={`w-36 ${bgSecondary} border-none`}>
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {months.map(m => (
                      <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Campaigns Table */}
              {viewMode === 'table' ? (
                <TableView
                  campaignsByMonth={campaignsByMonth}
                  expandedCampaigns={expandedCampaigns}
                  toggleCampaign={toggleCampaign}
                  setSelectedCampaign={setSelectedCampaign}
                  setShowAddAdModal={setShowAddAdModal}
                  deleteCampaign={deleteCampaign}
                  updateAd={updateAd}
                  openPopup={openPopup}
                  customAttributes={customAttributes}
                  formatMonth={formatMonth}
                  getStatusColor={getStatusColor}
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderColor={borderColor}
                  bgSecondary={bgSecondary}
                  showClientColumn={mainView === 'all-campaigns'}
                />
              ) : (
                <KanbanView
                  campaigns={filteredCampaigns}
                  updateAd={updateAd}
                  openPopup={openPopup}
                  customAttributes={customAttributes}
                  getStatusColor={getStatusColor}
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderColor={borderColor}
                  bgSecondary={bgSecondary}
                />
              )}
            </>
          )}
        </div>

        {/* ============== MODALS ============== */}

        {/* Add/Edit Client Modal */}
        <Dialog open={showAddClientModal} onOpenChange={setShowAddClientModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-lg`}>
            <DialogHeader>
              <DialogTitle>{editingClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={`text-sm ${textSecondary} block mb-1`}>Client/Brand Name *</label>
                <Input 
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  placeholder="e.g., Fitsiomax Gym"
                  data-testid="client-name-input"
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Area/Location</label>
                <Input 
                  value={clientForm.area}
                  onChange={(e) => setClientForm({ ...clientForm, area: e.target.value })}
                  placeholder="e.g., Anna Nagar, Chennai"
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Contact Person</label>
                <Input 
                  value={clientForm.contact_person}
                  onChange={(e) => setClientForm({ ...clientForm, contact_person: e.target.value })}
                  placeholder="e.g., John Doe"
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Email</label>
                <Input 
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  placeholder="client@example.com"
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Phone</label>
                <Input 
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className={bgSecondary}
                />
              </div>
              <div className="col-span-2">
                <label className={`text-sm ${textSecondary} block mb-1`}>Client Drive URL</label>
                <Input 
                  value={clientForm.drive_url}
                  onChange={(e) => setClientForm({ ...clientForm, drive_url: e.target.value })}
                  placeholder="Google Drive link for client assets"
                  className={bgSecondary}
                />
              </div>
              <div className="col-span-2">
                <label className={`text-sm ${textSecondary} block mb-1`}>Notes</label>
                <Textarea 
                  value={clientForm.notes}
                  onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                  placeholder="Any additional notes about the client..."
                  className={bgSecondary}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowAddClientModal(false); resetClientForm(); }}>Cancel</Button>
              <Button 
                onClick={editingClient ? updateClient : createClient} 
                data-testid="save-client-btn"
                className="bg-[#1877f2] hover:bg-[#166fe5]"
              >
                {editingClient ? 'Update Client' : 'Create Client'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Campaign Modal */}
        <Dialog open={showAddCampaignModal} onOpenChange={setShowAddCampaignModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-lg`}>
            <DialogHeader>
              <DialogTitle>Create New Campaign {selectedClient && `for ${selectedClient.name}`}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              {!selectedClient && (
                <div className="col-span-2">
                  <label className={`text-sm ${textSecondary} block mb-1`}>Client/Brand Name</label>
                  <Input 
                    value={campaignForm.client_name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, client_name: e.target.value })}
                    placeholder="e.g., Fitsiomax"
                    className={bgSecondary}
                  />
                </div>
              )}
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Month *</label>
                <Input 
                  type="month"
                  value={campaignForm.month}
                  onChange={(e) => setCampaignForm({ ...campaignForm, month: e.target.value })}
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Target Name *</label>
                <Input 
                  value={campaignForm.target_name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, target_name: e.target.value })}
                  placeholder="e.g., Target 01"
                  data-testid="campaign-target-name"
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Mode</label>
                <Select value={campaignForm.mode} onValueChange={(v) => setCampaignForm({ ...campaignForm, mode: v })}>
                  <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Area</label>
                <Input 
                  value={campaignForm.area}
                  onChange={(e) => setCampaignForm({ ...campaignForm, area: e.target.value })}
                  placeholder="e.g., Anna Nagar"
                  className={bgSecondary}
                />
              </div>
              <div className="col-span-2">
                <label className={`text-sm ${textSecondary} block mb-1`}>Service/Treatment Angle</label>
                <Input 
                  value={campaignForm.service_angle}
                  onChange={(e) => setCampaignForm({ ...campaignForm, service_angle: e.target.value })}
                  placeholder="e.g., New Year Offer, Post Pregnancy weight loss"
                  className={bgSecondary}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowAddCampaignModal(false); resetCampaignForm(); }}>Cancel</Button>
              <Button onClick={createCampaign} data-testid="create-campaign-btn" className="bg-[#1877f2] hover:bg-[#166fe5]">Create Campaign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Ad Modal */}
        <Dialog open={showAddAdModal} onOpenChange={setShowAddAdModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-lg max-h-[80vh] overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle>Add Ad to {selectedCampaign?.target_name}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={`text-sm ${textSecondary} block mb-1`}>Ad Title *</label>
                <Input 
                  value={adForm.ad_title}
                  onChange={(e) => setAdForm({ ...adForm, ad_title: e.target.value })}
                  placeholder="e.g., Buy 3 Months, Get 1 Month FREE"
                  data-testid="ad-title"
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Ad Type</label>
                <Select value={adForm.ad_type} onValueChange={(v) => setAdForm({ ...adForm, ad_type: v })}>
                  <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Creative Platform</label>
                <Input 
                  value={adForm.creative_platform}
                  onChange={(e) => setAdForm({ ...adForm, creative_platform: e.target.value })}
                  placeholder="e.g., Instagram, Client"
                  className={bgSecondary}
                />
              </div>
              <div className="col-span-2">
                <label className={`text-sm ${textSecondary} block mb-1`}>Content Doc URL</label>
                <Input 
                  value={adForm.content_doc_url}
                  onChange={(e) => setAdForm({ ...adForm, content_doc_url: e.target.value })}
                  placeholder="Google Docs link for content"
                  className={bgSecondary}
                />
              </div>
              <div className="col-span-2">
                <label className={`text-sm ${textSecondary} block mb-1`}>Creative/Design Drive URL</label>
                <Input 
                  value={adForm.creative_drive_url}
                  onChange={(e) => setAdForm({ ...adForm, creative_drive_url: e.target.value })}
                  placeholder="Google Drive link for design/reel"
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Content Status</label>
                <Select value={adForm.content_status} onValueChange={(v) => setAdForm({ ...adForm, content_status: v })}>
                  <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Creative Status</label>
                <Select value={adForm.creative_status} onValueChange={(v) => setAdForm({ ...adForm, creative_status: v })}>
                  <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CREATIVE_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              {customAttributes.length > 0 && (
                <div className="col-span-2 border-t border-[#3f3f46] pt-4 mt-2">
                  <h4 className={`text-sm font-medium ${textPrimary} mb-3`}>Custom Fields</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {customAttributes.map(attr => (
                      <div key={attr.attr_id}>
                        <label className={`text-sm ${textSecondary} block mb-1`}>{attr.name}</label>
                        {attr.attr_type === 'select' ? (
                          <Select 
                            value={adForm.custom_attributes?.[attr.attr_id] || ''} 
                            onValueChange={(v) => setAdForm({
                              ...adForm,
                              custom_attributes: { ...adForm.custom_attributes, [attr.attr_id]: v }
                            })}
                          >
                            <SelectTrigger className={bgSecondary}><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>
                              {attr.options?.map(opt => (
                                <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input 
                            type={attr.attr_type === 'number' ? 'number' : 'text'}
                            value={adForm.custom_attributes?.[attr.attr_id] || ''}
                            onChange={(e) => setAdForm({
                              ...adForm,
                              custom_attributes: { ...adForm.custom_attributes, [attr.attr_id]: e.target.value }
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
              <Button variant="ghost" onClick={() => { setShowAddAdModal(false); resetAdForm(); }}>Cancel</Button>
              <Button onClick={addAd} data-testid="add-ad-btn" className="bg-[#1877f2] hover:bg-[#166fe5]">Add Ad</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Custom Attributes Modal */}
        <Dialog open={showAddAttributeModal} onOpenChange={setShowAddAttributeModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
            <DialogHeader>
              <DialogTitle>Manage Custom Fields</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mb-4">
              {customAttributes.length === 0 ? (
                <p className={`text-sm ${textSecondary} text-center py-4`}>No custom fields yet</p>
              ) : (
                customAttributes.map(attr => (
                  <div key={attr.attr_id} className={`p-3 rounded-lg ${bgSecondary} flex items-center justify-between`}>
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{attr.name}</p>
                      <p className={`text-xs ${textSecondary}`}>Type: {attr.attr_type}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteCustomAttribute(attr.attr_id)} className="text-red-400">
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
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(e.target.value)}
                  placeholder="e.g., Priority, Assigned To"
                  className={bgSecondary}
                />
                <Select value={newAttrType} onValueChange={setNewAttrType}>
                  <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">Select (Dropdown)</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={createCustomAttribute} className="w-full bg-[#10b981] hover:bg-[#059669]">
                  <Plus className="h-4 w-4 mr-2" /> Add Field
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowAddAttributeModal(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Document Popup */}
        <Dialog open={!!popupUrl} onOpenChange={() => setPopupUrl(null)}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-5xl h-[80vh]`}>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{popupTitle}</span>
                <Button variant="ghost" size="sm" onClick={() => window.open(popupUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-1" /> Open in New Tab
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 h-full min-h-[60vh]">
              <iframe src={popupUrl} className="w-full h-full rounded-lg border" title={popupTitle} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

// ============== CLIENTS VIEW ==============
const ClientsView = ({
  clients,
  viewClientDetail,
  openEditClient,
  deleteClient,
  isDark,
  textPrimary,
  textSecondary,
  borderColor,
  bgSecondary,
  searchTerm,
  setSearchTerm
}) => {
  const filteredClients = clients.filter(c => 
    !searchTerm || c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.area?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search clients..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 ${bgSecondary} border-none`}
          />
        </div>
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <div className={`text-center py-12 ${textSecondary}`}>
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No clients found. Create your first client!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredClients.map(client => (
            <div 
              key={client.client_id}
              className={`p-4 rounded-xl border ${borderColor} ${isDark ? 'bg-[#18181b] hover:bg-[#1f1f23]' : 'bg-white hover:bg-gray-50'} cursor-pointer transition-all group`}
              onClick={() => viewClientDetail(client)}
              data-testid={`client-card-${client.client_id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-[#1877f2]/20">
                  <Building2 className="h-5 w-5 text-[#1877f2]" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => openEditClient(client)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteClient(client.client_id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <h3 className={`font-semibold ${textPrimary} mb-1 truncate`}>{client.name}</h3>
              {client.area && (
                <p className={`text-sm ${textSecondary} flex items-center gap-1 mb-2`}>
                  <MapPin className="h-3 w-3" /> {client.area}
                </p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#27272a]">
                <Badge className="bg-[#1877f2]/20 text-[#1877f2]">
                  {client.campaign_count || 0} Campaigns
                </Badge>
                {client.contact_person && (
                  <span className={`text-xs ${textSecondary}`}>{client.contact_person}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============== TABLE VIEW ==============
const TableView = ({
  campaignsByMonth,
  expandedCampaigns,
  toggleCampaign,
  setSelectedCampaign,
  setShowAddAdModal,
  deleteCampaign,
  updateAd,
  openPopup,
  customAttributes,
  formatMonth,
  getStatusColor,
  isDark,
  textPrimary,
  textSecondary,
  borderColor,
  bgSecondary,
  showClientColumn
}) => {
  if (Object.keys(campaignsByMonth).length === 0) {
    return (
      <div className={`text-center py-12 ${textSecondary}`}>
        <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No campaigns found. Create your first campaign!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(campaignsByMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, monthCampaigns]) => (
        <div key={month} className={`rounded-xl border ${borderColor} overflow-hidden`}>
          <div className={`p-4 ${bgSecondary} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-[#1877f2]" />
              <h2 className={`text-lg font-bold ${textPrimary}`}>{formatMonth(month)}</h2>
              <Badge className="bg-[#1877f2]/20 text-[#1877f2]">{monthCampaigns.length} Campaigns</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className={textSecondary}>
                Leads: <span className="font-semibold text-[#22c55e]">
                  {monthCampaigns.reduce((sum, c) => sum + (c.ads || []).reduce((s, ad) => s + (ad.leads_count || 0), 0), 0)}
                </span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={isDark ? 'bg-[#1f1f23]' : 'bg-gray-50'}>
                <tr className={`text-xs ${textSecondary} uppercase`}>
                  <th className="px-3 py-2 text-left w-8"></th>
                  <th className="px-3 py-2 text-left">Sno</th>
                  {showClientColumn && <th className="px-3 py-2 text-left">Client</th>}
                  <th className="px-3 py-2 text-left">Area</th>
                  <th className="px-3 py-2 text-left">Mode</th>
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-left">Service/Angle</th>
                  <th className="px-3 py-2 text-center">Ads</th>
                  <th className="px-3 py-2 text-center">Leads</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthCampaigns.map((campaign, idx) => (
                  <React.Fragment key={campaign.campaign_id}>
                    <tr 
                      className={`border-t ${borderColor} cursor-pointer hover:${bgSecondary}`}
                      onClick={() => toggleCampaign(campaign.campaign_id)}
                    >
                      <td className="px-3 py-3">
                        {expandedCampaigns[campaign.campaign_id] ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                      </td>
                      <td className={`px-3 py-3 font-medium ${textPrimary}`}>{idx + 1}</td>
                      {showClientColumn && (
                        <td className={`px-3 py-3 ${textPrimary}`}>{campaign.client_name || campaign.client?.name || '-'}</td>
                      )}
                      <td className={`px-3 py-3 ${textPrimary}`}>{campaign.area || '-'}</td>
                      <td className="px-3 py-3">
                        <Badge className={campaign.mode === 'Online' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}>
                          {campaign.mode}
                        </Badge>
                      </td>
                      <td className={`px-3 py-3 ${textPrimary}`}>{campaign.target_name}</td>
                      <td className={`px-3 py-3 ${textSecondary}`}>{campaign.service_angle || '-'}</td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="outline">{campaign.ads?.length || 0}</Badge>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-semibold text-[#22c55e]">
                          {(campaign.ads || []).reduce((s, ad) => s + (ad.leads_count || 0), 0)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex justify-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedCampaign(campaign); setShowAddAdModal(true); }}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteCampaign(campaign.campaign_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {expandedCampaigns[campaign.campaign_id] && (
                      <tr>
                        <td colSpan={showClientColumn ? 11 : 10} className={`p-0 ${isDark ? 'bg-[#0f0f11]' : 'bg-gray-50'}`}>
                          <AdTable
                            campaign={campaign}
                            updateAd={updateAd}
                            openPopup={openPopup}
                            customAttributes={customAttributes}
                            getStatusColor={getStatusColor}
                            isDark={isDark}
                            textPrimary={textPrimary}
                            textSecondary={textSecondary}
                            borderColor={borderColor}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============== AD TABLE ==============
const AdTable = ({ campaign, updateAd, openPopup, customAttributes, getStatusColor, isDark, textPrimary, textSecondary, borderColor }) => {
  const CONTENT_STATUS = ['Not Started', 'Writing', 'Review', 'Approved', 'Rejected'];
  const CREATIVE_STATUS = ['Yet to Start', 'Design', 'Edit', 'Review', 'Published', 'Approved'];
  const AD_STATUS = ['Draft', 'Active', 'Paused', 'Completed'];

  return (
    <table className="w-full text-sm">
      <thead className={isDark ? 'bg-[#1a1a1e]' : 'bg-gray-100'}>
        <tr className={`text-xs ${textSecondary}`}>
          <th className="px-4 py-2 text-left w-12">#</th>
          <th className="px-4 py-2 text-left">Ad Title</th>
          <th className="px-4 py-2 text-center">Type</th>
          <th className="px-4 py-2 text-center">Content</th>
          <th className="px-4 py-2 text-center">Content Status</th>
          <th className="px-4 py-2 text-center">Creative</th>
          <th className="px-4 py-2 text-center">Creative Status</th>
          <th className="px-4 py-2 text-center">Ad Status</th>
          <th className="px-4 py-2 text-center">Leads</th>
          {customAttributes.map(attr => (
            <th key={attr.attr_id} className="px-4 py-2 text-center">{attr.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(campaign.ads || []).map((ad, adIdx) => (
          <tr key={ad.ad_id} className={`border-t ${borderColor}`}>
            <td className={`px-4 py-2 ${textSecondary}`}>{adIdx + 1}</td>
            <td className={`px-4 py-2 ${textPrimary}`}>
              <div className="flex items-center gap-2">
                {ad.ad_type === 'Video' || ad.ad_type === 'Reel' ? 
                  <Video className="h-4 w-4 text-purple-400" /> : 
                  <Image className="h-4 w-4 text-blue-400" />
                }
                {ad.ad_title || `Ad ${adIdx + 1}`}
              </div>
            </td>
            <td className="px-4 py-2 text-center">
              <Badge variant="outline" className="text-xs">{ad.ad_type}</Badge>
            </td>
            <td className="px-4 py-2 text-center">
              {ad.content_doc_url ? (
                <Button size="sm" variant="ghost" onClick={() => openPopup(ad.content_doc_url, 'Content Document')} className="text-[#6366f1]">
                  <FileText className="h-4 w-4 mr-1" /> Doc
                </Button>
              ) : <span className={textSecondary}>-</span>}
            </td>
            <td className="px-4 py-2 text-center">
              <Select value={ad.content_status} onValueChange={(v) => updateAd(campaign.campaign_id, ad.ad_id, { content_status: v })}>
                <SelectTrigger className={`h-7 text-xs w-28 ${getStatusColor(ad.content_status, 'content')}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </td>
            <td className="px-4 py-2 text-center">
              {ad.creative_drive_url ? (
                <Button size="sm" variant="ghost" onClick={() => openPopup(ad.creative_drive_url, 'Creative')} className="text-[#22c55e]">
                  {ad.ad_type === 'Video' || ad.ad_type === 'Reel' ? <Video className="h-4 w-4 mr-1" /> : <Image className="h-4 w-4 mr-1" />}
                  {ad.creative_platform || 'View'}
                </Button>
              ) : <span className={textSecondary}>-</span>}
            </td>
            <td className="px-4 py-2 text-center">
              <Select value={ad.creative_status} onValueChange={(v) => updateAd(campaign.campaign_id, ad.ad_id, { creative_status: v })}>
                <SelectTrigger className={`h-7 text-xs w-28 ${getStatusColor(ad.creative_status, 'creative')}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATIVE_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </td>
            <td className="px-4 py-2 text-center">
              <Select value={ad.ad_status} onValueChange={(v) => updateAd(campaign.campaign_id, ad.ad_id, { ad_status: v })}>
                <SelectTrigger className={`h-7 text-xs w-24 ${
                  ad.ad_status === 'Active' ? 'bg-green-500/20 text-green-400' :
                  ad.ad_status === 'Paused' ? 'bg-yellow-500/20 text-yellow-400' :
                  ad.ad_status === 'Completed' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </td>
            <td className={`px-4 py-2 text-center font-semibold ${ad.leads_count > 0 ? 'text-[#22c55e]' : textSecondary}`}>
              {ad.leads_count || 0}
            </td>
            {customAttributes.map(attr => (
              <td key={attr.attr_id} className="px-4 py-2 text-center">
                {attr.attr_type === 'select' ? (
                  <Select 
                    value={ad.custom_attributes?.[attr.attr_id] || ''} 
                    onValueChange={(v) => updateAd(campaign.campaign_id, ad.ad_id, { 
                      custom_attributes: { ...ad.custom_attributes, [attr.attr_id]: v }
                    })}
                  >
                    <SelectTrigger className="h-7 text-xs w-28">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      {attr.options?.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={textSecondary}>{ad.custom_attributes?.[attr.attr_id] || '-'}</span>
                )}
              </td>
            ))}
          </tr>
        ))}
        {(!campaign.ads || campaign.ads.length === 0) && (
          <tr>
            <td colSpan={9 + customAttributes.length} className={`px-4 py-6 text-center ${textSecondary}`}>
              No ads yet. Click + to add an ad.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

// ============== KANBAN VIEW ==============
const KanbanView = ({ campaigns, updateAd, openPopup, customAttributes, getStatusColor, isDark, textPrimary, textSecondary, borderColor, bgSecondary }) => {
  const CREATIVE_STATUS = ['Yet to Start', 'Design', 'Edit', 'Review', 'Published', 'Approved'];

  const getAllAds = () => {
    const ads = [];
    campaigns.forEach(campaign => {
      (campaign.ads || []).forEach(ad => {
        ads.push({ ...ad, campaign });
      });
    });
    return ads;
  };

  const getAdsByStatus = () => {
    const grouped = {};
    CREATIVE_STATUS.forEach(status => { grouped[status] = []; });
    getAllAds().forEach(ad => {
      const status = ad.creative_status || 'Yet to Start';
      if (grouped[status]) {
        grouped[status].push(ad);
      } else {
        grouped['Yet to Start'].push(ad);
      }
    });
    return grouped;
  };

  const adsByStatus = getAdsByStatus();
  const columnColors = {
    'Yet to Start': '#71717a',
    'Design': '#3b82f6',
    'Edit': '#8b5cf6',
    'Review': '#f59e0b',
    'Published': '#10b981',
    'Approved': '#22c55e'
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-view">
      {CREATIVE_STATUS.map(status => (
        <div key={status} className={`flex-shrink-0 w-72 ${isDark ? 'bg-[#18181b]' : 'bg-white'} rounded-lg border ${borderColor}`}>
          <div className="p-3 border-b border-[#27272a] flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: columnColors[status] }} />
            <span className={`text-sm font-medium ${textPrimary}`}>{status}</span>
            <Badge className="bg-[#27272a] text-[#71717a] text-xs ml-auto">{adsByStatus[status].length}</Badge>
          </div>
          <div className="p-2 space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
            {adsByStatus[status].map(ad => (
              <div key={ad.ad_id} className={`p-3 ${isDark ? 'bg-[#0c0a09]' : 'bg-gray-50'} rounded-lg border ${borderColor}`}>
                <div className="flex items-center gap-2 mb-1">
                  {ad.ad_type === 'Video' || ad.ad_type === 'Reel' ? 
                    <Video className="h-4 w-4 text-purple-400" /> : 
                    <Image className="h-4 w-4 text-blue-400" />
                  }
                  <span className={`text-sm font-medium ${textPrimary} truncate`}>{ad.ad_title || 'Untitled Ad'}</span>
                </div>
                <p className={`text-xs ${textSecondary} mb-2`}>{ad.campaign?.client_name} • {ad.campaign?.target_name}</p>
                <div className="flex gap-1 mb-2">
                  <Badge variant="outline" className="text-xs">{ad.ad_type}</Badge>
                  <Badge className={`text-xs ${getStatusColor(ad.content_status, 'content')}`}>{ad.content_status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textSecondary}`}>Leads:</span>
                  <span className={`font-semibold ${ad.leads_count > 0 ? 'text-[#22c55e]' : textSecondary}`}>{ad.leads_count || 0}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-[#27272a]">
                  <Select value={ad.creative_status} onValueChange={(v) => updateAd(ad.campaign?.campaign_id, ad.ad_id, { creative_status: v })}>
                    <SelectTrigger className="h-7 text-xs w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CREATIVE_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {adsByStatus[status].length === 0 && (
              <p className={`text-center py-4 text-xs ${textSecondary}`}>No ads</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MetaAdsBoard;
