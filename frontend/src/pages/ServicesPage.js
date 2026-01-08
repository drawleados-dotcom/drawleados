import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

const ServicesPage = () => {
  const [services, setServices] = useState([]);
  const [sources, setSources] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [serviceForm, setServiceForm] = useState({
    name: '',
    category: '',
    billing_type: 'one-time',
    amount: '',
  });

  const [sourceForm, setSourceForm] = useState({ name: '' });
  const [statusForm, setStatusForm] = useState({ name: '', color: '#6366f1' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [servicesRes, sourcesRes, statusesRes] = await Promise.all([
        api.get('/services'),
        api.get('/sources'),
        api.get('/statuses'),
      ]);
      setServices(servicesRes.data);
      setSources(sourcesRes.data);
      setStatuses(statusesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      await api.post('/services', {
        ...serviceForm,
        amount: parseFloat(serviceForm.amount),
      });
      toast.success('Service created');
      setShowServiceModal(false);
      setServiceForm({ name: '', category: '', billing_type: 'one-time', amount: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create service');
    }
  };

  const handleCreateSource = async (e) => {
    e.preventDefault();
    try {
      await api.post('/sources', sourceForm);
      toast.success('Lead source created');
      setShowSourceModal(false);
      setSourceForm({ name: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create lead source');
    }
  };

  const handleCreateStatus = async (e) => {
    e.preventDefault();
    try {
      await api.post('/statuses', statusForm);
      toast.success('Status created');
      setShowStatusModal(false);
      setStatusForm({ name: '', color: '#6366f1' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create status');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className="text-[#a1a1aa]">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8" data-testid="services-page">
        <div>
          <h1
            className="text-4xl font-bold tracking-tight mb-2"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
              Master Data
            </span>
          </h1>
          <p className="text-[#a1a1aa] text-base">Manage services, lead sources, and statuses</p>
        </div>

        {/* Services */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#fafafa]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Services
            </h2>
            <Button
              onClick={() => setShowServiceModal(true)}
              data-testid="create-service-button"
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.service_id}
                className="bg-[#09090b] border border-[#27272a] rounded-lg p-4 hover:border-[#6366f1]/20 transition-all"
              >
                <h3 className="text-sm font-medium text-[#fafafa] mb-2">{service.name}</h3>
                <p className="text-xs text-[#a1a1aa] mb-2">{service.category}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#a1a1aa] capitalize">{service.billing_type}</span>
                  <span className="text-sm font-semibold text-[#6366f1]">₹{service.amount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Sources */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#fafafa]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Lead Sources
            </h2>
            <Button
              onClick={() => setShowSourceModal(true)}
              data-testid="create-source-button"
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sources.map((source) => (
              <div
                key={source.source_id}
                className="bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-3 text-center hover:border-[#6366f1]/20 transition-all"
              >
                <p className="text-sm font-medium text-[#fafafa]">{source.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Statuses */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#fafafa]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Lead Statuses
            </h2>
            <Button
              onClick={() => setShowStatusModal(true)}
              data-testid="create-status-button"
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Status
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {statuses.map((status) => (
              <div
                key={status.status_id}
                className="bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-3 flex items-center gap-3 hover:border-[#6366f1]/20 transition-all"
              >
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
                <p className="text-sm font-medium text-[#fafafa]">{status.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Service Modal */}
      {showServiceModal && (
        <Dialog open={true} onOpenChange={setShowServiceModal}>
          <DialogContent className="bg-[#18181b] border border-[#27272a] text-[#fafafa]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                New Service
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <Label htmlFor="service-name" className="text-[#fafafa] mb-2 block">
                  Service Name *
                </Label>
                <Input
                  id="service-name"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  required
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                />
              </div>
              <div>
                <Label htmlFor="category" className="text-[#fafafa] mb-2 block">
                  Category *
                </Label>
                <Input
                  id="category"
                  value={serviceForm.category}
                  onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                  required
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                />
              </div>
              <div>
                <Label htmlFor="billing-type" className="text-[#fafafa] mb-2 block">
                  Billing Type *
                </Label>
                <Select
                  value={serviceForm.billing_type}
                  onValueChange={(value) => setServiceForm({ ...serviceForm, billing_type: value })}
                >
                  <SelectTrigger className="bg-[#09090b] border-[#27272a] text-[#fafafa]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount" className="text-[#fafafa] mb-2 block">
                  Amount *
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={serviceForm.amount}
                  onChange={(e) => setServiceForm({ ...serviceForm, amount: e.target.value })}
                  required
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#6366f1] hover:bg-[#4f46e5] text-white">
                  Create Service
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Source Modal */}
      {showSourceModal && (
        <Dialog open={true} onOpenChange={setShowSourceModal}>
          <DialogContent className="bg-[#18181b] border border-[#27272a] text-[#fafafa]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                New Lead Source
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSource} className="space-y-4">
              <div>
                <Label htmlFor="source-name" className="text-[#fafafa] mb-2 block">
                  Source Name *
                </Label>
                <Input
                  id="source-name"
                  value={sourceForm.name}
                  onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                  required
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowSourceModal(false)}
                  className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#6366f1] hover:bg-[#4f46e5] text-white">
                  Create Source
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Status Modal */}
      {showStatusModal && (
        <Dialog open={true} onOpenChange={setShowStatusModal}>
          <DialogContent className="bg-[#18181b] border border-[#27272a] text-[#fafafa]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                New Status
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateStatus} className="space-y-4">
              <div>
                <Label htmlFor="status-name" className="text-[#fafafa] mb-2 block">
                  Status Name *
                </Label>
                <Input
                  id="status-name"
                  value={statusForm.name}
                  onChange={(e) => setStatusForm({ ...statusForm, name: e.target.value })}
                  required
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                />
              </div>
              <div>
                <Label htmlFor="status-color" className="text-[#fafafa] mb-2 block">
                  Color *
                </Label>
                <Input
                  id="status-color"
                  type="color"
                  value={statusForm.color}
                  onChange={(e) => setStatusForm({ ...statusForm, color: e.target.value })}
                  required
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa] h-12"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#6366f1] hover:bg-[#4f46e5] text-white">
                  Create Status
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
};

export default ServicesPage;
