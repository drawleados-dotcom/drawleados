import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Plus, Pencil, Trash2, Package, Repeat, Zap } from 'lucide-react';
import { toast } from 'sonner';

const emptyServiceForm = () => ({ name: '', billing_type: 'one-time' });
const emptyPackageForm = () => ({ name: '', amount: '' });

export default function ServicePackagesPage() {
  const { isDark } = useTheme();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm());

  const [packageModalFor, setPackageModalFor] = useState(null); // service_id
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [packageForm, setPackageForm] = useState(emptyPackageForm());

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/services');
      setServices(res.data || []);
    } catch (e) {
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadServices(); }, [loadServices]);

  const openAddService = () => { setEditingServiceId(null); setServiceForm(emptyServiceForm()); setShowServiceModal(true); };
  const openEditService = (svc) => {
    setEditingServiceId(svc.service_id);
    setServiceForm({ name: svc.name, billing_type: svc.billing_type });
    setShowServiceModal(true);
  };

  const saveService = async () => {
    if (!serviceForm.name.trim()) { toast.error('Service name is required'); return; }
    try {
      if (editingServiceId) {
        await api.put(`/services/${editingServiceId}`, { name: serviceForm.name.trim(), billing_type: serviceForm.billing_type, category: '', amount: 0 });
        toast.success('Service updated');
      } else {
        await api.post('/services', { name: serviceForm.name.trim(), billing_type: serviceForm.billing_type, category: '', amount: 0 });
        toast.success('Service created');
      }
      setShowServiceModal(false);
      loadServices();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save service');
    }
  };

  const deleteService = async (serviceId) => {
    if (!window.confirm('Delete this service and all its packages?')) return;
    try {
      await api.delete(`/services/${serviceId}`);
      toast.success('Service deleted');
      loadServices();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete service');
    }
  };

  const openAddPackage = (serviceId) => { setPackageModalFor(serviceId); setEditingPackageId(null); setPackageForm(emptyPackageForm()); };
  const openEditPackage = (serviceId, pkg) => {
    setPackageModalFor(serviceId);
    setEditingPackageId(pkg.package_id);
    setPackageForm({ name: pkg.name, amount: String(pkg.amount) });
  };
  const closePackageModal = () => { setPackageModalFor(null); setEditingPackageId(null); };

  const savePackage = async () => {
    if (!packageForm.name.trim()) { toast.error('Package name is required'); return; }
    const amount = Number(packageForm.amount);
    if (!(amount > 0)) { toast.error('Package amount must be greater than 0'); return; }
    try {
      if (editingPackageId) {
        await api.put(`/services/${packageModalFor}/packages/${editingPackageId}`, { name: packageForm.name.trim(), amount });
        toast.success('Package updated');
      } else {
        await api.post(`/services/${packageModalFor}/packages`, { name: packageForm.name.trim(), amount });
        toast.success('Package added');
      }
      closePackageModal();
      loadServices();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save package');
    }
  };

  const deletePackage = async (serviceId, packageId) => {
    if (!window.confirm('Delete this package?')) return;
    try {
      await api.delete(`/services/${serviceId}/packages/${packageId}`);
      toast.success('Package removed');
      loadServices();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete package');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className={textSecondary}>Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="service-packages-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className={`text-3xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Service and Packages
            </h1>
            <p className={`text-sm ${textSecondary}`}>Define services and their pricing packages, used when onboarding a client.</p>
          </div>
          <Button onClick={openAddService} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="add-service-btn">
            <Plus className="h-4 w-4 mr-2" /> Add Service
          </Button>
        </div>

        {services.length === 0 ? (
          <div className={`${bgCard} border ${borderColor} rounded-xl p-12 text-center`}>
            <Package className={`h-10 w-10 mx-auto mb-3 ${textSecondary}`} />
            <p className={textSecondary}>No services yet. Click "Add Service" to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((svc) => (
              <div key={svc.service_id} className={`${bgCard} border ${borderColor} rounded-xl p-5`} data-testid={`service-card-${svc.service_id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>{svc.name}</h3>
                    <Badge className={svc.billing_type === 'recurring' ? 'bg-purple-500/15 text-purple-500 border-purple-500/30 mt-1' : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 mt-1'}>
                      {svc.billing_type === 'recurring' ? <Repeat className="h-3 w-3 mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                      {svc.billing_type === 'recurring' ? 'Recurring' : 'One-time'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditService(svc)} className={`p-1.5 rounded ${textSecondary} hover:opacity-80`} title="Edit service" data-testid={`edit-service-${svc.service_id}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteService(svc.service_id)} className="p-1.5 rounded text-red-500 hover:text-red-400" title="Delete service" data-testid={`delete-service-${svc.service_id}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {(svc.packages || []).length === 0 ? (
                    <p className={`text-xs ${textSecondary}`}>No packages yet.</p>
                  ) : (
                    (svc.packages || []).map((pkg) => (
                      <div key={pkg.package_id} className={`${bgSecondary} rounded-lg px-3 py-2 flex items-center justify-between`} data-testid={`package-row-${pkg.package_id}`}>
                        <span className={`text-sm ${textPrimary}`}>{pkg.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#6366f1]">₹{Number(pkg.amount || 0).toLocaleString()}</span>
                          <button onClick={() => openEditPackage(svc.service_id, pkg)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit package">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deletePackage(svc.service_id, pkg.package_id)} className="p-1 text-red-500 hover:text-red-400" title="Delete package">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <Button
                  onClick={() => openAddPackage(svc.service_id)}
                  variant="outline"
                  size="sm"
                  className={`mt-3 w-full ${borderColor}`}
                  data-testid={`add-package-${svc.service_id}`}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Package
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Service modal */}
      <Dialog open={showServiceModal} onOpenChange={setShowServiceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingServiceId ? 'Edit Service' : 'New Service'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Service Name *</Label>
              <Input
                value={serviceForm.name}
                onChange={(e) => setServiceForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Website Development"
                data-testid="service-form-name"
              />
            </div>
            <div>
              <Label>Type *</Label>
              <Select value={serviceForm.billing_type} onValueChange={(v) => setServiceForm(f => ({ ...f, billing_type: v }))}>
                <SelectTrigger data-testid="service-form-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One-time</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceModal(false)}>Cancel</Button>
            <Button onClick={saveService} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="service-form-save">
              {editingServiceId ? 'Save' : 'Create Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Package modal */}
      <Dialog open={!!packageModalFor} onOpenChange={(open) => !open && closePackageModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPackageId ? 'Edit Package' : 'New Package'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Package Name *</Label>
              <Input
                value={packageForm.name}
                onChange={(e) => setPackageForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Pages Package 01"
                data-testid="package-form-name"
              />
            </div>
            <div>
              <Label>Amount *</Label>
              <Input
                type="number" min="0"
                value={packageForm.amount}
                onChange={(e) => setPackageForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="e.g. 10000"
                data-testid="package-form-amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePackageModal}>Cancel</Button>
            <Button onClick={savePackage} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="package-form-save">
              {editingPackageId ? 'Save' : 'Add Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
