import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import api from '../../utils/api';
import { toast } from 'sonner';

const ClientFormModal = ({ client, services, sources, statuses, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    email: client?.email || '',
    business_name: client?.business_name || '',
    website: client?.website || '',
    address: client?.address || '',
    service_id: client?.service_id || '',
    source_id: client?.source_id || '',
    status_id: client?.status_id || statuses?.[0]?.status_id || '',
    discussion_notes: client?.discussion_notes || '',
    service_cost: client?.service_cost || 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Please fill in name and phone number');
      return;
    }

    setSaving(true);
    try {
      const submitData = {
        ...formData,
        service_cost: parseFloat(formData.service_cost) || 0,
      };

      if (client) {
        await api.put(`/leads/${client.lead_id}`, submitData);
        toast.success('Client updated successfully');
      } else {
        await api.post('/leads', submitData);
        toast.success('Client created successfully');
      }
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save client');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#18181b] border-[#27272a] text-[#fafafa] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{client ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label>Client/Contact Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter name"
              data-testid="client-name-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Phone Number *</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Enter phone number"
              data-testid="client-phone-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter email"
              data-testid="client-email-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              placeholder="Enter business name"
              data-testid="client-business-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="space-y-2">
            <Label>Website</Label>
            <Input
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="www.example.com"
              data-testid="client-website-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="space-y-2">
            <Label>Service</Label>
            <Select value={formData.service_id} onValueChange={(v) => setFormData({ ...formData, service_id: v })}>
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="client-service-select">
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a]">
                {services?.map((service) => (
                  <SelectItem key={service.service_id} value={service.service_id} className="text-[#fafafa] focus:bg-[#27272a]">
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Lead Source</Label>
            <Select value={formData.source_id} onValueChange={(v) => setFormData({ ...formData, source_id: v })}>
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="client-source-select">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a]">
                {sources?.map((source) => (
                  <SelectItem key={source.source_id} value={source.source_id} className="text-[#fafafa] focus:bg-[#27272a]">
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status_id} onValueChange={(v) => setFormData({ ...formData, status_id: v })}>
              <SelectTrigger className="bg-[#09090b] border-[#27272a]" data-testid="client-status-select">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-[#18181b] border-[#27272a]">
                {statuses?.map((status) => (
                  <SelectItem key={status.status_id} value={status.status_id} className="text-[#fafafa] focus:bg-[#27272a]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
                      {status.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Expected Value (₹)</Label>
            <Input
              type="number"
              value={formData.service_cost}
              onChange={(e) => setFormData({ ...formData, service_cost: e.target.value })}
              placeholder="Enter expected value"
              data-testid="client-cost-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Address</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter address"
              data-testid="client-address-input"
              className="bg-[#09090b] border-[#27272a]"
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.discussion_notes}
              onChange={(e) => setFormData({ ...formData, discussion_notes: e.target.value })}
              placeholder="Enter any notes or discussion points"
              data-testid="client-notes-input"
              className="bg-[#09090b] border-[#27272a] min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#27272a] text-[#a1a1aa]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            data-testid="save-client-button"
            className="bg-[#6366f1] hover:bg-[#4f46e5]"
          >
            {saving ? 'Saving...' : client ? 'Update Client' : 'Add Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClientFormModal;
