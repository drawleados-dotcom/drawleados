import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import api from '../../utils/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const LeadFormModal = ({ lead, services, sources, statuses, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    business_name: '',
    website: '',
    service_id: '',
    source_id: '',
    status_id: '',
    discussion_notes: '',
    proposal_url: '',
    service_cost: '',
    expected_closing_date: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || '',
        phone: lead.phone || '',
        email: lead.email || '',
        address: lead.address || '',
        business_name: lead.business_name || '',
        website: lead.website || '',
        service_id: lead.service_id || '',
        source_id: lead.source_id || '',
        status_id: lead.status_id || '',
        discussion_notes: lead.discussion_notes || '',
        proposal_url: lead.proposal_url || '',
        service_cost: lead.service_cost || '',
        expected_closing_date: lead.expected_closing_date
          ? new Date(lead.expected_closing_date).toISOString().split('T')[0]
          : '',
      });
    } else {
      // Set default status to first status if creating new lead
      if (statuses.length > 0) {
        setFormData((prev) => ({ ...prev, status_id: statuses[0].status_id }));
      }
    }
  }, [lead, statuses]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        service_cost: formData.service_cost ? parseFloat(formData.service_cost) : null,
        expected_closing_date: formData.expected_closing_date || null,
      };

      if (lead) {
        await api.put(`/leads/${lead.lead_id}`, payload);
        toast.success('Lead updated successfully');
      } else {
        await api.post('/leads', payload);
        toast.success('Lead created successfully');
      }
      onSave();
    } catch (error) {
      console.error('Error saving lead:', error);
      toast.error(error.response?.data?.detail || 'Failed to save lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className="bg-[#18181b] border border-[#27272a] text-[#fafafa] max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="lead-form-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {lead ? 'Edit Lead' : 'New Lead'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="text-[#fafafa] mb-2 block">
                Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                data-testid="lead-name-input"
                className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-[#fafafa] mb-2 block">
                Phone *
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                required
                data-testid="lead-phone-input"
                className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-[#fafafa] mb-2 block">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                data-testid="lead-email-input"
                className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
              />
            </div>

            <div>
              <Label htmlFor="business_name" className="text-[#fafafa] mb-2 block">
                Business Name
              </Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => handleChange('business_name', e.target.value)}
                data-testid="lead-business-input"
                className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
              />
            </div>

            <div>
              <Label htmlFor="website" className="text-[#fafafa] mb-2 block">
                Website
              </Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => handleChange('website', e.target.value)}
                data-testid="lead-website-input"
                className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
              />
            </div>

            <div>
              <Label htmlFor="service" className="text-[#fafafa] mb-2 block">
                Service
              </Label>
              <Select value={formData.service_id} onValueChange={(value) => handleChange('service_id', value)}>
                <SelectTrigger
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
                  data-testid="lead-service-select"
                >
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
                  {services.map((service) => (
                    <SelectItem key={service.service_id} value={service.service_id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="source" className="text-[#fafafa] mb-2 block">
                Lead Source
              </Label>
              <Select value={formData.source_id} onValueChange={(value) => handleChange('source_id', value)}>
                <SelectTrigger
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
                  data-testid="lead-source-select"
                >
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
                  {sources.map((source) => (
                    <SelectItem key={source.source_id} value={source.source_id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status" className="text-[#fafafa] mb-2 block">
                Status *
              </Label>
              <Select value={formData.status_id} onValueChange={(value) => handleChange('status_id', value)}>
                <SelectTrigger
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
                  data-testid="lead-status-select"
                >
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
                  {statuses.map((status) => (
                    <SelectItem key={status.status_id} value={status.status_id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="service_cost" className="text-[#fafafa] mb-2 block">
                Service Cost
              </Label>
              <Input
                id="service_cost"
                type="number"
                value={formData.service_cost}
                onChange={(e) => handleChange('service_cost', e.target.value)}
                data-testid="lead-cost-input"
                className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
              />
            </div>

            <div>
              <Label htmlFor="expected_closing_date" className="text-[#fafafa] mb-2 block">
                Expected Closing Date
              </Label>
              <Input
                id="expected_closing_date"
                type="date"
                value={formData.expected_closing_date}
                onChange={(e) => handleChange('expected_closing_date', e.target.value)}
                data-testid="lead-closing-date-input"
                className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address" className="text-[#fafafa] mb-2 block">
              Address
            </Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              data-testid="lead-address-input"
              className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
            />
          </div>

          <div>
            <Label htmlFor="proposal_url" className="text-[#fafafa] mb-2 block">
              Proposal URL
            </Label>
            <Input
              id="proposal_url"
              value={formData.proposal_url}
              onChange={(e) => handleChange('proposal_url', e.target.value)}
              data-testid="lead-proposal-input"
              className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
            />
          </div>

          <div>
            <Label htmlFor="discussion_notes" className="text-[#fafafa] mb-2 block">
              Discussion Notes
            </Label>
            <Textarea
              id="discussion_notes"
              value={formData.discussion_notes}
              onChange={(e) => handleChange('discussion_notes', e.target.value)}
              rows={4}
              data-testid="lead-notes-input"
              className="bg-[#09090b] border-[#27272a] text-[#fafafa] focus:border-[#6366f1]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#27272a]">
            <Button
              type="button"
              onClick={onClose}
              disabled={loading}
              data-testid="cancel-lead-button"
              className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              data-testid="save-lead-button"
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white glow-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                lead ? 'Update Lead' : 'Create Lead'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LeadFormModal;
