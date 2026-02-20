import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Search, Download, Upload } from 'lucide-react';
import LeadsListView from '../components/leads/LeadsListView';
import LeadsKanbanView from '../components/leads/LeadsKanbanView';
import LeadsChartView from '../components/leads/LeadsChartView';
import LeadFormModal from '../components/leads/LeadFormModal';
import { toast } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';

const LeadsPage = () => {
  const { isDark } = useTheme();
  const [leads, setLeads] = useState([]);
  const [services, setServices] = useState([]);
  const [sources, setSources] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [activeView, setActiveView] = useState('list');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [leadsRes, servicesRes, sourcesRes, statusesRes] = await Promise.all([
        api.get('/leads'),
        api.get('/services'),
        api.get('/sources'),
        api.get('/statuses'),
      ]);
      setLeads(leadsRes.data);
      setServices(servicesRes.data);
      setSources(sourcesRes.data);
      setStatuses(statusesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = () => {
    setSelectedLead(null);
    setShowLeadModal(true);
  };

  const handleEditLead = (lead) => {
    setSelectedLead(lead);
    setShowLeadModal(true);
  };

  const handleSaveLead = async () => {
    await fetchData();
    setShowLeadModal(false);
    setSelectedLead(null);
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await api.delete(`/leads/${leadId}`);
      toast.success('Lead deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete lead');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/leads/export');
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leads-export-${new Date().toISOString()}.json`;
      link.click();
      toast.success('Leads exported successfully');
    } catch (error) {
      toast.error('Failed to export leads');
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const search = searchTerm.toLowerCase();
    return (
      lead.name.toLowerCase().includes(search) ||
      (lead.business_name && lead.business_name.toLowerCase().includes(search)) ||
      (lead.phone && lead.phone.includes(search)) ||
      (lead.email && lead.email.toLowerCase().includes(search))
    );
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className={isDark ? 'text-[#a1a1aa]' : 'text-gray-500'}>Loading leads...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="leads-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-4xl font-bold tracking-tight mb-2"
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                Leads
              </span>
            </h1>
            <p className={`text-base ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>
              Manage your sales pipeline with {filteredLeads.length} leads
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleExport}
              data-testid="export-leads-button"
              className={isDark 
                ? 'bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] border border-[#3f3f46]'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
              }
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={handleCreateLead}
              data-testid="create-lead-button"
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white glow-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Lead
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDark ? 'text-[#a1a1aa]' : 'text-gray-400'}`} />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-leads-input"
              className={`pl-10 ${isDark 
                ? 'bg-[#18181b] border-[#27272a] text-[#fafafa]' 
                : 'bg-white border-gray-300 text-gray-900'
              } focus:border-[#6366f1]`}
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
          <TabsList className={`p-1 ${isDark ? 'bg-[#18181b] border border-[#27272a]' : 'bg-gray-100 border border-gray-200'}`}>
            <TabsTrigger
              value="list"
              data-testid="list-view-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              List View
            </TabsTrigger>
            <TabsTrigger
              value="kanban"
              data-testid="kanban-view-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              Kanban View
            </TabsTrigger>
            <TabsTrigger
              value="chart"
              data-testid="chart-view-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              Chart View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <LeadsListView
              leads={filteredLeads}
              services={services}
              sources={sources}
              statuses={statuses}
              onEditLead={handleEditLead}
              onDeleteLead={handleDeleteLead}
            />
          </TabsContent>

          <TabsContent value="kanban" className="mt-6">
            <LeadsKanbanView
              leads={filteredLeads}
              statuses={statuses}
              onEditLead={handleEditLead}
              onRefresh={fetchData}
            />
          </TabsContent>

          <TabsContent value="chart" className="mt-6">
            <LeadsChartView leads={filteredLeads} statuses={statuses} />
          </TabsContent>
        </Tabs>
      </div>

      {showLeadModal && (
        <LeadFormModal
          lead={selectedLead}
          services={services}
          sources={sources}
          statuses={statuses}
          onClose={() => setShowLeadModal(false)}
          onSave={handleSaveLead}
        />
      )}
    </Layout>
  );
};

export default LeadsPage;
