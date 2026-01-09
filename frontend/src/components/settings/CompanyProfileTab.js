import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Building, CreditCard, FileText, Plus, X, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';

const CompanyProfileTab = () => {
  const [profile, setProfile] = useState({
    company_name: '',
    logo_url: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    website: '',
    gst_number: '',
    pan_number: '',
    invoice_prefix: 'INV',
    terms_conditions: '',
    bank_details: {
      account_name: '',
      account_number: '',
      ifsc_code: '',
      bank_name: '',
      branch: '',
    },
    upi_ids: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newUpiId, setNewUpiId] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/company-profile');
      setProfile({
        ...profile,
        ...response.data,
        bank_details: response.data.bank_details || profile.bank_details,
        upi_ids: response.data.upi_ids || [],
      });
    } catch (error) {
      console.error('Error fetching company profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/company-profile', profile);
      toast.success('Company profile saved successfully');
    } catch (error) {
      toast.error('Failed to save company profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUpiId = () => {
    if (newUpiId.trim() && !profile.upi_ids.includes(newUpiId.trim())) {
      setProfile({
        ...profile,
        upi_ids: [...profile.upi_ids, newUpiId.trim()],
      });
      setNewUpiId('');
    }
  };

  const handleRemoveUpiId = (upiId) => {
    setProfile({
      ...profile,
      upi_ids: profile.upi_ids.filter((id) => id !== upiId),
    });
  };

  const updateBankDetails = (field, value) => {
    setProfile({
      ...profile,
      bank_details: {
        ...profile.bank_details,
        [field]: value,
      },
    });
  };

  if (loading) {
    return <div className="text-[#a1a1aa]">Loading company profile...</div>;
  }

  return (
    <div className="space-y-6" data-testid="company-profile-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#fafafa]">Company Profile</h2>
          <p className="text-sm text-[#a1a1aa]">
            This information is used across invoices, payslips, and all documents
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
          data-testid="save-company-profile"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="bg-[#09090b] border border-[#27272a] p-1">
          <TabsTrigger value="basic" className="data-[state=active]:bg-[#27272a] text-xs">
            <Building className="h-4 w-4 mr-2" />
            Basic Info
          </TabsTrigger>
          <TabsTrigger value="bank" className="data-[state=active]:bg-[#27272a] text-xs">
            <CreditCard className="h-4 w-4 mr-2" />
            Bank & UPI
          </TabsTrigger>
          <TabsTrigger value="invoice" className="data-[state=active]:bg-[#27272a] text-xs">
            <FileText className="h-4 w-4 mr-2" />
            Invoice Settings
          </TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="mt-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Company Details Card */}
            <Card className="bg-[#18181b] border-[#27272a]">
              <CardHeader>
                <CardTitle className="text-[#fafafa] text-lg">Company Details</CardTitle>
                <CardDescription>Basic company information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[#fafafa]">Company Name *</Label>
                  <Input
                    value={profile.company_name}
                    onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                    placeholder="Enter company name"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                    data-testid="company-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#fafafa]">Logo URL</Label>
                  <Input
                    value={profile.logo_url || ''}
                    onChange={(e) => setProfile({ ...profile, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                  />
                  {profile.logo_url && (
                    <img
                      src={profile.logo_url}
                      alt="Company Logo"
                      className="h-16 mt-2 rounded"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[#fafafa]">Website</Label>
                  <Input
                    value={profile.website}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    placeholder="www.example.com"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contact Details Card */}
            <Card className="bg-[#18181b] border-[#27272a]">
              <CardHeader>
                <CardTitle className="text-[#fafafa] text-lg">Contact Details</CardTitle>
                <CardDescription>Contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[#fafafa]">Phone</Label>
                  <Input
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+91-XXXXXXXXXX"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#fafafa]">Email</Label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    placeholder="info@example.com"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Address Card */}
            <Card className="bg-[#18181b] border-[#27272a] col-span-2">
              <CardHeader>
                <CardTitle className="text-[#fafafa] text-lg">Address</CardTitle>
                <CardDescription>Business address</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-[#fafafa]">Street Address</Label>
                    <Textarea
                      value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      placeholder="Enter street address"
                      className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#fafafa]">City</Label>
                    <Input
                      value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                      placeholder="City"
                      className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#fafafa]">State</Label>
                    <Input
                      value={profile.state}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                      placeholder="State"
                      className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#fafafa]">Pincode</Label>
                    <Input
                      value={profile.pincode}
                      onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                      placeholder="XXXXXX"
                      className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tax Details Card */}
            <Card className="bg-[#18181b] border-[#27272a] col-span-2">
              <CardHeader>
                <CardTitle className="text-[#fafafa] text-lg">Tax Information</CardTitle>
                <CardDescription>GST and PAN details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[#fafafa]">GST Number</Label>
                    <Input
                      value={profile.gst_number}
                      onChange={(e) => setProfile({ ...profile, gst_number: e.target.value.toUpperCase() })}
                      placeholder="22AAAAA0000A1Z5"
                      className="bg-[#09090b] border-[#27272a] text-[#fafafa] uppercase"
                      data-testid="gst-number-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#fafafa]">PAN Number</Label>
                    <Input
                      value={profile.pan_number}
                      onChange={(e) => setProfile({ ...profile, pan_number: e.target.value.toUpperCase() })}
                      placeholder="AAAAA0000A"
                      className="bg-[#09090b] border-[#27272a] text-[#fafafa] uppercase"
                      data-testid="pan-number-input"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bank & UPI Tab */}
        <TabsContent value="bank" className="mt-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Bank Details Card */}
            <Card className="bg-[#18181b] border-[#27272a]">
              <CardHeader>
                <CardTitle className="text-[#fafafa] text-lg">Bank Account Details</CardTitle>
                <CardDescription>Primary bank account for payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[#fafafa]">Account Name</Label>
                  <Input
                    value={profile.bank_details.account_name}
                    onChange={(e) => updateBankDetails('account_name', e.target.value)}
                    placeholder="Account holder name"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#fafafa]">Account Number</Label>
                  <Input
                    value={profile.bank_details.account_number}
                    onChange={(e) => updateBankDetails('account_number', e.target.value)}
                    placeholder="Enter account number"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                    data-testid="bank-account-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#fafafa]">IFSC Code</Label>
                  <Input
                    value={profile.bank_details.ifsc_code}
                    onChange={(e) => updateBankDetails('ifsc_code', e.target.value.toUpperCase())}
                    placeholder="ABCD0001234"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa] uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#fafafa]">Bank Name</Label>
                  <Input
                    value={profile.bank_details.bank_name}
                    onChange={(e) => updateBankDetails('bank_name', e.target.value)}
                    placeholder="Bank name"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#fafafa]">Branch</Label>
                  <Input
                    value={profile.bank_details.branch}
                    onChange={(e) => updateBankDetails('branch', e.target.value)}
                    placeholder="Branch name"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* UPI IDs Card */}
            <Card className="bg-[#18181b] border-[#27272a]">
              <CardHeader>
                <CardTitle className="text-[#fafafa] text-lg">UPI IDs</CardTitle>
                <CardDescription>Add multiple UPI IDs for payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newUpiId}
                    onChange={(e) => setNewUpiId(e.target.value)}
                    placeholder="example@upi"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddUpiId()}
                    data-testid="upi-id-input"
                  />
                  <Button
                    onClick={handleAddUpiId}
                    className="bg-[#6366f1] hover:bg-[#4f46e5]"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {profile.upi_ids.map((upiId, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2"
                    >
                      <span className="text-sm text-[#fafafa]">{upiId}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveUpiId(upiId)}
                        className="h-6 w-6 p-0 text-[#a1a1aa] hover:text-[#ef4444]"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {profile.upi_ids.length === 0 && (
                    <p className="text-sm text-[#a1a1aa] text-center py-4">No UPI IDs added yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Invoice Settings Tab */}
        <TabsContent value="invoice" className="mt-4">
          <div className="grid grid-cols-2 gap-6">
            <Card className="bg-[#18181b] border-[#27272a]">
              <CardHeader>
                <CardTitle className="text-[#fafafa] text-lg">Invoice Configuration</CardTitle>
                <CardDescription>Configure invoice numbering and defaults</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[#fafafa]">Invoice Prefix</Label>
                  <Input
                    value={profile.invoice_prefix}
                    onChange={(e) => setProfile({ ...profile, invoice_prefix: e.target.value.toUpperCase() })}
                    placeholder="INV"
                    className="bg-[#09090b] border-[#27272a] text-[#fafafa] uppercase"
                    data-testid="invoice-prefix-input"
                  />
                  <p className="text-xs text-[#a1a1aa]">
                    Preview: {profile.invoice_prefix}-2026-001
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#18181b] border-[#27272a] col-span-2">
              <CardHeader>
                <CardTitle className="text-[#fafafa] text-lg">Terms & Conditions</CardTitle>
                <CardDescription>Default terms shown on invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={profile.terms_conditions}
                  onChange={(e) => setProfile({ ...profile, terms_conditions: e.target.value })}
                  placeholder="Enter default terms and conditions for invoices..."
                  className="bg-[#09090b] border-[#27272a] text-[#fafafa] min-h-[200px]"
                  data-testid="terms-conditions-input"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompanyProfileTab;
