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
  Filter,
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
  Eye,
  Download,
  BarChart3,
  X,
  Table2,
  LayoutGrid,
  Settings,
  Palette,
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

  // State
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCampaignModal, setShowAddCampaignModal] = useState(false);
  const [showAddAdModal, setShowAddAdModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState({});
  const [popupUrl, setPopupUrl] = useState(null);
  const [popupTitle, setPopupTitle] = useState('');
  
  // View mode
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'kanban'
  
  // Custom attributes
  const [customAttributes, setCustomAttributes] = useState([]);
  const [showAddAttributeModal, setShowAddAttributeModal] = useState(false);
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrType, setNewAttrType] = useState('select');
  
  // Filters
  const [monthFilter, setMonthFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [campaignForm, setCampaignForm] = useState({
    client_name: '',
    area: '',
    mode: 'Online',
    month: new Date().toISOString().slice(0, 7),
    target_name: '',
    service_angle: '',
  });

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

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/meta-ads/campaigns`, { headers });
      setCampaigns(res.data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load custom attributes
  const loadCustomAttributes = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/meta-ads/custom-attributes`, { headers });
      setCustomAttributes(res.data || []);
    } catch (error) {
      console.error('Error loading custom attributes:', error);
    }
  }, [token]);

  useEffect(() => {
    loadCampaigns();
    loadCustomAttributes();
  }, [loadCampaigns, loadCustomAttributes]);

  // Create campaign
  const createCampaign = async () => {
    try {
      if (!campaignForm.client_name || !campaignForm.target_name) {
        toast.error('Client name and target name are required');
        return;
      }
      await axios.post(`${API}/api/meta-ads/campaigns`, campaignForm, { headers });
      toast.success('Campaign created');
      setShowAddCampaignModal(false);
      resetCampaignForm();
      loadCampaigns();
    } catch (error) {
      toast.error('Failed to create campaign');
    }
  };

  // Add ad to campaign
  const addAd = async () => {
    try {
      if (!selectedCampaign) return;
      await axios.post(`${API}/api/meta-ads/campaigns/${selectedCampaign.campaign_id}/ads`, adForm, { headers });
      toast.success('Ad added');
      setShowAddAdModal(false);
      resetAdForm();
      loadCampaigns();
    } catch (error) {
      toast.error('Failed to add ad');
    }
  };

  // Update ad
  const updateAd = async (campaignId, adId, updates) => {
    try {
      await axios.put(`${API}/api/meta-ads/campaigns/${campaignId}/ads/${adId}`, updates, { headers });
      loadCampaigns();
    } catch (error) {
      toast.error('Failed to update ad');
    }
  };

  // Delete campaign
  const deleteCampaign = async (campaignId) => {
    if (!window.confirm('Delete this campaign and all its ads?')) return;
    try {
      await axios.delete(`${API}/api/meta-ads/campaigns/${campaignId}`, { headers });
      toast.success('Campaign deleted');
      loadCampaigns();
    } catch (error) {
      toast.error('Failed to delete campaign');
    }
  };

  // Create custom attribute
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

  // Add option to custom attribute
  const addAttributeOption = async (attrId, optionName, color = '#71717a') => {
    try {
      await axios.post(`${API}/api/meta-ads/custom-attributes/${attrId}/options`, {
        name: optionName,
        color
      }, { headers });
      loadCustomAttributes();
    } catch (error) {
      toast.error('Failed to add option');
    }
  };

  // Delete custom attribute
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

  // Reset forms
  const resetCampaignForm = () => {
    setCampaignForm({
      client_name: '',
      area: '',
      mode: 'Online',
      month: new Date().toISOString().slice(0, 7),
      target_name: '',
      service_angle: '',
    });
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

  // Open popup
  const openPopup = (url, title) => {
    if (url) {
      setPopupUrl(url);
      setPopupTitle(title);
    }
  };

  // Toggle campaign expansion
  const toggleCampaign = (campaignId) => {
    setExpandedCampaigns(prev => ({
      ...prev,
      [campaignId]: !prev[campaignId]
    }));
  };

  // Get unique months and areas for filters
  const months = [...new Set(campaigns.map(c => c.month))].sort().reverse();
  const areas = [...new Set(campaigns.map(c => c.area).filter(Boolean))];

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(c => {
    const matchesMonth = monthFilter === 'all' || c.month === monthFilter;
    const matchesArea = areaFilter === 'all' || c.area === areaFilter;
    const matchesSearch = !searchTerm || 
      c.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.target_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.service_angle?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesMonth && matchesArea && matchesSearch;
  });

  // Group campaigns by month for month-on-month view
  const campaignsByMonth = filteredCampaigns.reduce((acc, c) => {
    const month = c.month || 'Unknown';
    if (!acc[month]) acc[month] = [];
    acc[month].push(c);
    return acc;
  }, {});

  // Get all ads for kanban view
  const getAllAds = () => {
    const ads = [];
    filteredCampaigns.forEach(campaign => {
      (campaign.ads || []).forEach(ad => {
        ads.push({ ...ad, campaign });
      });
    });
    return ads;
  };

  // Group ads by creative status for kanban
  const getAdsByCreativeStatus = () => {
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

  // Calculate stats
  const totalLeads = campaigns.reduce((sum, c) => 
    sum + (c.ads || []).reduce((s, ad) => s + (ad.leads_count || 0), 0), 0
  );
  const totalSpend = campaigns.reduce((sum, c) => 
    sum + (c.ads || []).reduce((s, ad) => s + (ad.spend || 0), 0), 0
  );
  const totalAds = campaigns.reduce((sum, c) => sum + (c.ads?.length || 0), 0);

  // Status color helper
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

  // Get kanban column color
  const getKanbanColumnColor = (status) => {
    switch (status) {
      case 'Yet to Start': return '#71717a';
      case 'Design': return '#3b82f6';
      case 'Edit': return '#8b5cf6';
      case 'Review': return '#f59e0b';
      case 'Published': return '#10b981';
      case 'Approved': return '#22c55e';
      default: return '#71717a';
    }
  };

  // Format month
  const formatMonth = (monthStr) => {
    if (!monthStr) return 'Unknown';
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <Layout>
      <div className="flex flex-col h-full" data-testid="meta-ads-board">
        {/* Header */}
        <div className={`p-4 border-b ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#1877f2]/20">
                <Target className="h-6 w-6 text-[#1877f2]" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${textPrimary}`}>Meta Ads Board</h1>
                <p className={`text-sm ${textSecondary}`}>Performance Marketing Management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-[#18181b] rounded-lg p-1 border border-[#27272a]">
                <button
                  onClick={() => setViewMode('table')}
                  data-testid="view-table-btn"
                  className={`p-2 rounded ${viewMode === 'table' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a]'}`}
                  title="Table View"
                >
                  <Table2 className="h-4 w-4" />
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
                onClick={() => setShowAddAttributeModal(true)}
                variant="outline"
                className="border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa]"
              >
                <Settings className="h-4 w-4 mr-2" />
                Custom Fields
              </Button>
              
              <Button 
                onClick={() => setShowAddCampaignModal(true)} 
                data-testid="new-campaign-btn"
                className="bg-[#1877f2] hover:bg-[#166fe5]"
              >
                <Plus className="h-4 w-4 mr-2" /> New Campaign
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className={`p-4 border-b ${borderColor} grid grid-cols-4 gap-4`}>
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
        <div className={`p-4 border-b ${borderColor} flex flex-wrap items-center gap-3`}>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search campaigns..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-input"
              className={`pl-10 ${bgSecondary} border-none`}
            />
          </div>
          
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className={`w-36 ${bgSecondary} border-none`} data-testid="month-filter">
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

          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className={`w-36 ${bgSecondary} border-none`} data-testid="area-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Areas</SelectItem>
              {areas.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-4">
          {viewMode === 'table' ? (
            // TABLE VIEW - Month on Month
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
            />
          ) : (
            // KANBAN VIEW - By Creative Status
            <KanbanView
              adsByStatus={getAdsByCreativeStatus()}
              updateAd={updateAd}
              openPopup={openPopup}
              customAttributes={customAttributes}
              getKanbanColumnColor={getKanbanColumnColor}
              getStatusColor={getStatusColor}
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
              bgSecondary={bgSecondary}
            />
          )}
        </div>

        {/* Add Campaign Modal */}
        <Dialog open={showAddCampaignModal} onOpenChange={setShowAddCampaignModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-lg`}>
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={`text-sm ${textSecondary} block mb-1`}>Client/Brand Name *</label>
                <Input 
                  value={campaignForm.client_name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, client_name: e.target.value })}
                  placeholder="e.g., Fitsiomax"
                  data-testid="campaign-client-name"
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Area/Location</label>
                <Input 
                  value={campaignForm.area}
                  onChange={(e) => setCampaignForm({ ...campaignForm, area: e.target.value })}
                  placeholder="e.g., Fitness, Anna Nagar"
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
              
              {/* Custom Attributes */}
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

        {/* Custom Attributes Management Modal */}
        <Dialog open={showAddAttributeModal} onOpenChange={setShowAddAttributeModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
            <DialogHeader>
              <DialogTitle>Manage Custom Fields</DialogTitle>
            </DialogHeader>
            
            {/* Existing Attributes */}
            <div className="space-y-3 mb-4">
              {customAttributes.length === 0 ? (
                <p className={`text-sm ${textSecondary} text-center py-4`}>No custom fields yet</p>
              ) : (
                customAttributes.map(attr => (
                  <div key={attr.attr_id} className={`p-3 rounded-lg ${bgSecondary} flex items-center justify-between`}>
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{attr.name}</p>
                      <p className={`text-xs ${textSecondary}`}>Type: {attr.attr_type}</p>
                      {attr.attr_type === 'select' && attr.options && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {attr.options.map(opt => (
                            <Badge 
                              key={opt.id} 
                              style={{ backgroundColor: `${opt.color}20`, color: opt.color }}
                              className="text-xs"
                            >
                              {opt.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteCustomAttribute(attr.attr_id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            
            {/* Add New Attribute */}
            <div className={`p-4 rounded-lg border ${borderColor}`}>
              <h4 className={`text-sm font-medium ${textPrimary} mb-3`}>Add New Field</h4>
              <div className="space-y-3">
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Field Name</label>
                  <Input 
                    value={newAttrName}
                    onChange={(e) => setNewAttrName(e.target.value)}
                    placeholder="e.g., Priority, Assigned To"
                    data-testid="new-attr-name"
                    className={bgSecondary}
                  />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Field Type</label>
                  <Select value={newAttrType} onValueChange={setNewAttrType}>
                    <SelectTrigger className={bgSecondary}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="select">Select (Dropdown)</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={createCustomAttribute} 
                  data-testid="create-attr-btn"
                  className="w-full bg-[#10b981] hover:bg-[#059669]"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Field
                </Button>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={() => setShowAddAttributeModal(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Popup for Docs/Drive Links */}
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
              <iframe 
                src={popupUrl} 
                className="w-full h-full rounded-lg border"
                title={popupTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

// ============== TABLE VIEW COMPONENT ==============
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
  bgSecondary
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
          {/* Month Header */}
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
              <span className={textSecondary}>
                Spend: <span className={`font-semibold ${textPrimary}`}>
                  ₹{monthCampaigns.reduce((sum, c) => sum + (c.ads || []).reduce((s, ad) => s + (ad.spend || 0), 0), 0).toLocaleString()}
                </span>
              </span>
            </div>
          </div>

          {/* Campaigns Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={isDark ? 'bg-[#1f1f23]' : 'bg-gray-50'}>
                <tr className={`text-xs ${textSecondary} uppercase`}>
                  <th className="px-3 py-2 text-left w-8"></th>
                  <th className="px-3 py-2 text-left">Sno</th>
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
                    {/* Campaign Row */}
                    <tr 
                      className={`border-t ${borderColor} cursor-pointer hover:${bgSecondary}`}
                      onClick={() => toggleCampaign(campaign.campaign_id)}
                      data-testid={`campaign-row-${campaign.campaign_id}`}
                    >
                      <td className="px-3 py-3">
                        {expandedCampaigns[campaign.campaign_id] ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                      </td>
                      <td className={`px-3 py-3 font-medium ${textPrimary}`}>{idx + 1}</td>
                      <td className={`px-3 py-3 ${textPrimary}`}>{campaign.area || campaign.client_name}</td>
                      <td className="px-3 py-3">
                        <Badge className={campaign.mode === 'Online' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}>
                          {campaign.mode}
                        </Badge>
                      </td>
                      <td className={`px-3 py-3 ${textPrimary}`}>{campaign.target_name}</td>
                      <td className={`px-3 py-3 ${textSecondary}`}>{campaign.service_angle}</td>
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
                          <Button 
                            size="sm" 
                            variant="ghost"
                            data-testid={`add-ad-btn-${campaign.campaign_id}`}
                            onClick={() => { setSelectedCampaign(campaign); setShowAddAdModal(true); }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-red-400"
                            onClick={() => deleteCampaign(campaign.campaign_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Ads */}
                    {expandedCampaigns[campaign.campaign_id] && (
                      <tr>
                        <td colSpan={9} className={`p-0 ${isDark ? 'bg-[#0f0f11]' : 'bg-gray-50'}`}>
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

// ============== AD TABLE COMPONENT ==============
const AdTable = ({
  campaign,
  updateAd,
  openPopup,
  customAttributes,
  getStatusColor,
  isDark,
  textPrimary,
  textSecondary,
  borderColor
}) => {
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
          {/* Custom attribute columns */}
          {customAttributes.map(attr => (
            <th key={attr.attr_id} className="px-4 py-2 text-center">{attr.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(campaign.ads || []).map((ad, adIdx) => (
          <tr key={ad.ad_id} className={`border-t ${borderColor}`} data-testid={`ad-row-${ad.ad_id}`}>
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
              <Badge variant="outline" className="text-xs">
                {ad.ad_type}
              </Badge>
            </td>
            <td className="px-4 py-2 text-center">
              {ad.content_doc_url ? (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => openPopup(ad.content_doc_url, 'Content Document')}
                  className="text-[#6366f1]"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Doc
                </Button>
              ) : (
                <span className={textSecondary}>-</span>
              )}
            </td>
            <td className="px-4 py-2 text-center">
              <Select 
                value={ad.content_status} 
                onValueChange={(v) => updateAd(campaign.campaign_id, ad.ad_id, { content_status: v })}
              >
                <SelectTrigger className={`h-7 text-xs w-28 ${getStatusColor(ad.content_status, 'content')}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_STATUS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>
            <td className="px-4 py-2 text-center">
              {ad.creative_drive_url ? (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => openPopup(ad.creative_drive_url, ad.ad_type === 'Video' || ad.ad_type === 'Reel' ? 'Reel/Video' : 'Design')}
                  className="text-[#22c55e]"
                >
                  {ad.ad_type === 'Video' || ad.ad_type === 'Reel' ? 
                    <Video className="h-4 w-4 mr-1" /> : 
                    <Image className="h-4 w-4 mr-1" />
                  }
                  {ad.creative_platform || 'View'}
                </Button>
              ) : (
                <span className={textSecondary}>-</span>
              )}
            </td>
            <td className="px-4 py-2 text-center">
              <Select 
                value={ad.creative_status} 
                onValueChange={(v) => updateAd(campaign.campaign_id, ad.ad_id, { creative_status: v })}
              >
                <SelectTrigger className={`h-7 text-xs w-28 ${getStatusColor(ad.creative_status, 'creative')}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATIVE_STATUS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>
            <td className="px-4 py-2 text-center">
              <Select 
                value={ad.ad_status} 
                onValueChange={(v) => updateAd(campaign.campaign_id, ad.ad_id, { ad_status: v })}
              >
                <SelectTrigger className={`h-7 text-xs w-24 ${
                  ad.ad_status === 'Active' ? 'bg-green-500/20 text-green-400' :
                  ad.ad_status === 'Paused' ? 'bg-yellow-500/20 text-yellow-400' :
                  ad.ad_status === 'Completed' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_STATUS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>
            <td className={`px-4 py-2 text-center font-semibold ${ad.leads_count > 0 ? 'text-[#22c55e]' : textSecondary}`}>
              {ad.leads_count || 0}
            </td>
            {/* Custom attribute values */}
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
                      {attr.options?.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={textSecondary}>
                    {ad.custom_attributes?.[attr.attr_id] || '-'}
                  </span>
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

// ============== KANBAN VIEW COMPONENT ==============
const KanbanView = ({
  adsByStatus,
  updateAd,
  openPopup,
  customAttributes,
  getKanbanColumnColor,
  getStatusColor,
  isDark,
  textPrimary,
  textSecondary,
  borderColor,
  bgSecondary
}) => {
  const CREATIVE_STATUS = ['Yet to Start', 'Design', 'Edit', 'Review', 'Published', 'Approved'];

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-view">
      {CREATIVE_STATUS.map(status => {
        const ads = adsByStatus[status] || [];
        const columnColor = getKanbanColumnColor(status);
        
        return (
          <div 
            key={status} 
            className={`flex-shrink-0 w-72 ${isDark ? 'bg-[#18181b]' : 'bg-white'} rounded-lg border ${borderColor}`}
          >
            {/* Column Header */}
            <div className="p-3 border-b border-[#27272a] flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: columnColor }} />
              <span className={`text-sm font-medium ${textPrimary}`}>{status}</span>
              <Badge className="bg-[#27272a] text-[#71717a] text-xs ml-auto">
                {ads.length}
              </Badge>
            </div>
            
            {/* Cards */}
            <div className="p-2 space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
              {ads.map(ad => (
                <KanbanCard
                  key={ad.ad_id}
                  ad={ad}
                  updateAd={updateAd}
                  openPopup={openPopup}
                  customAttributes={customAttributes}
                  getStatusColor={getStatusColor}
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderColor={borderColor}
                />
              ))}
              {ads.length === 0 && (
                <p className={`text-center py-4 text-xs ${textSecondary}`}>No ads</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============== KANBAN CARD COMPONENT ==============
const KanbanCard = ({
  ad,
  updateAd,
  openPopup,
  customAttributes,
  getStatusColor,
  isDark,
  textPrimary,
  textSecondary,
  borderColor
}) => {
  const CREATIVE_STATUS = ['Yet to Start', 'Design', 'Edit', 'Review', 'Published', 'Approved'];
  
  return (
    <div 
      className={`p-3 ${isDark ? 'bg-[#0c0a09]' : 'bg-gray-50'} rounded-lg border ${borderColor} hover:border-[#3f3f46] group`}
      data-testid={`kanban-card-${ad.ad_id}`}
    >
      {/* Title and Campaign Info */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          {ad.ad_type === 'Video' || ad.ad_type === 'Reel' ? 
            <Video className="h-4 w-4 text-purple-400" /> : 
            <Image className="h-4 w-4 text-blue-400" />
          }
          <span className={`text-sm font-medium ${textPrimary} truncate`}>
            {ad.ad_title || 'Untitled Ad'}
          </span>
        </div>
        <p className={`text-xs ${textSecondary}`}>
          {ad.campaign?.client_name} • {ad.campaign?.target_name}
        </p>
      </div>
      
      {/* Status Pills */}
      <div className="flex flex-wrap gap-1 mb-2">
        <Badge variant="outline" className="text-xs">{ad.ad_type}</Badge>
        <Badge className={`text-xs ${getStatusColor(ad.content_status, 'content')}`}>
          {ad.content_status}
        </Badge>
      </div>
      
      {/* Links */}
      <div className="flex gap-2 mb-2">
        {ad.content_doc_url && (
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => openPopup(ad.content_doc_url, 'Content Document')}
            className="h-6 px-2 text-xs text-[#6366f1]"
          >
            <FileText className="h-3 w-3 mr-1" /> Doc
          </Button>
        )}
        {ad.creative_drive_url && (
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => openPopup(ad.creative_drive_url, 'Creative')}
            className="h-6 px-2 text-xs text-[#22c55e]"
          >
            <Image className="h-3 w-3 mr-1" /> Creative
          </Button>
        )}
      </div>
      
      {/* Leads Count */}
      <div className="flex items-center justify-between">
        <span className={`text-xs ${textSecondary}`}>Leads:</span>
        <span className={`font-semibold ${ad.leads_count > 0 ? 'text-[#22c55e]' : textSecondary}`}>
          {ad.leads_count || 0}
        </span>
      </div>
      
      {/* Custom Attributes Summary */}
      {customAttributes.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#27272a]">
          <div className="flex flex-wrap gap-1">
            {customAttributes.slice(0, 2).map(attr => {
              const value = ad.custom_attributes?.[attr.attr_id];
              if (!value) return null;
              
              if (attr.attr_type === 'select') {
                const opt = attr.options?.find(o => o.id === value);
                if (!opt) return null;
                return (
                  <Badge 
                    key={attr.attr_id}
                    style={{ backgroundColor: `${opt.color}20`, color: opt.color }}
                    className="text-xs"
                  >
                    {opt.name}
                  </Badge>
                );
              }
              return (
                <span key={attr.attr_id} className={`text-xs ${textSecondary}`}>
                  {attr.name}: {value}
                </span>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Quick Status Update */}
      <div className="mt-2 pt-2 border-t border-[#27272a]">
        <Select 
          value={ad.creative_status} 
          onValueChange={(v) => updateAd(ad.campaign?.campaign_id, ad.ad_id, { creative_status: v })}
        >
          <SelectTrigger className="h-7 text-xs w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CREATIVE_STATUS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default MetaAdsBoard;
