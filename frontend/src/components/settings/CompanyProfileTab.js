import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
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
  const { isDark } = useTheme();
  
  // Theme classes - properly computed based on isDark
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const bgInput = isDark ? 'bg-[#09090b]' : 'bg-white';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const tabsBg = isDark ? 'bg-[#09090b]' : 'bg-gray-100';
  
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
    invoice_theme_color: '#F97316',
    invoice_signature_label: 'Authorized Signature',
    invoice_logo_width_mm: 35,
    invoice_logo_height_mm: 0,
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
    return <div className={textSecondary}>Loading company profile...</div>;
  }

  return (
    <div className="space-y-6" data-testid="company-profile-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${textPrimary}`}>Company Profile</h2>
          <p className={`text-sm ${textSecondary}`}>
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
        <TabsList className={`${tabsBg} border ${borderColor} p-1`}>
          <TabsTrigger value="basic" className={`data-[state=active]:bg-[#6366f1] data-[state=active]:text-white text-xs`}>
            <Building className="h-4 w-4 mr-2" />
            Basic Info
          </TabsTrigger>
          <TabsTrigger value="bank" className={`data-[state=active]:bg-[#6366f1] data-[state=active]:text-white text-xs`}>
            <CreditCard className="h-4 w-4 mr-2" />
            Bank & UPI
          </TabsTrigger>
          <TabsTrigger value="invoice" className={`data-[state=active]:bg-[#6366f1] data-[state=active]:text-white text-xs`}>
            <FileText className="h-4 w-4 mr-2" />
            Invoice Settings
          </TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="mt-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Company Details Card */}
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader>
                <CardTitle className={`${textPrimary} text-lg`}>Company Details</CardTitle>
                <CardDescription className={textSecondary}>Basic company information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className={textPrimary}>Company Name *</Label>
                  <Input
                    value={profile.company_name}
                    onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                    placeholder="Enter company name"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    data-testid="company-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className={textPrimary}>Company Logo</Label>
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor="company-logo-upload"
                      className={`cursor-pointer px-4 py-2 rounded border ${borderColor} ${bgInput} ${textPrimary} hover:bg-[#27272a] text-sm`}
                      data-testid="upload-logo-btn"
                    >
                      Upload Logo
                    </label>
                    <input
                      id="company-logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          alert('Logo must be under 2 MB. Please compress it first.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setProfile({ ...profile, logo_url: ev.target.result });
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    {profile.logo_url && (
                      <button
                        type="button"
                        onClick={() => setProfile({ ...profile, logo_url: '' })}
                        className="text-[#f87171] text-sm hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <Input
                    value={profile.logo_url || ''}
                    onChange={(e) => setProfile({ ...profile, logo_url: e.target.value })}
                    placeholder="…or paste a logo URL (https://...)"
                    className={`${bgInput} border ${borderColor} ${textPrimary} text-xs`}
                  />
                  {profile.logo_url && (
                    <div className="mt-2 p-3 rounded border border-dashed border-[#27272a] inline-block bg-white">
                      <img
                        src={profile.logo_url}
                        alt="Company Logo"
                        style={{ maxHeight: '64px', maxWidth: '200px', objectFit: 'contain' }}
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className={textPrimary}>Website</Label>
                  <Input
                    value={profile.website}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    placeholder="www.example.com"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contact Details Card */}
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader>
                <CardTitle className={`${textPrimary} text-lg`}>Contact Details</CardTitle>
                <CardDescription className={textSecondary}>Contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className={textPrimary}>Phone</Label>
                  <Input
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+91-XXXXXXXXXX"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={textPrimary}>Email</Label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    placeholder="info@example.com"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Address Card */}
            <Card className={`${bgCard} border ${borderColor} col-span-2`}>
              <CardHeader>
                <CardTitle className={`${textPrimary} text-lg`}>Address</CardTitle>
                <CardDescription className={textSecondary}>Business address</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label className={textPrimary}>Street Address</Label>
                    <Textarea
                      value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      placeholder="Enter street address"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={textPrimary}>City</Label>
                    <Input
                      value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                      placeholder="City"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={textPrimary}>State</Label>
                    <Input
                      value={profile.state}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                      placeholder="State"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={textPrimary}>Pincode</Label>
                    <Input
                      value={profile.pincode}
                      onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                      placeholder="XXXXXX"
                      className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tax Details Card */}
            <Card className={`${bgCard} border ${borderColor} col-span-2`}>
              <CardHeader>
                <CardTitle className={`${textPrimary} text-lg`}>Tax Information</CardTitle>
                <CardDescription className={textSecondary}>GST and PAN details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className={textPrimary}>GST Number</Label>
                    <Input
                      value={profile.gst_number}
                      onChange={(e) => setProfile({ ...profile, gst_number: e.target.value.toUpperCase() })}
                      placeholder="22AAAAA0000A1Z5"
                      className={`${bgInput} border ${borderColor} ${textPrimary} uppercase`}
                      data-testid="gst-number-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={textPrimary}>PAN Number</Label>
                    <Input
                      value={profile.pan_number}
                      onChange={(e) => setProfile({ ...profile, pan_number: e.target.value.toUpperCase() })}
                      placeholder="AAAAA0000A"
                      className={`${bgInput} border ${borderColor} ${textPrimary} uppercase`}
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
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader>
                <CardTitle className={`${textPrimary} text-lg`}>Bank Account Details</CardTitle>
                <CardDescription className={textSecondary}>Primary bank account for payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className={textPrimary}>Account Name</Label>
                  <Input
                    value={profile.bank_details.account_name}
                    onChange={(e) => updateBankDetails('account_name', e.target.value)}
                    placeholder="Account holder name"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={textPrimary}>Account Number</Label>
                  <Input
                    value={profile.bank_details.account_number}
                    onChange={(e) => updateBankDetails('account_number', e.target.value)}
                    placeholder="Enter account number"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    data-testid="bank-account-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className={textPrimary}>IFSC Code</Label>
                  <Input
                    value={profile.bank_details.ifsc_code}
                    onChange={(e) => updateBankDetails('ifsc_code', e.target.value.toUpperCase())}
                    placeholder="ABCD0001234"
                    className={`${bgInput} border ${borderColor} ${textPrimary} uppercase`}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={textPrimary}>Bank Name</Label>
                  <Input
                    value={profile.bank_details.bank_name}
                    onChange={(e) => updateBankDetails('bank_name', e.target.value)}
                    placeholder="Bank name"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={textPrimary}>Branch</Label>
                  <Input
                    value={profile.bank_details.branch}
                    onChange={(e) => updateBankDetails('branch', e.target.value)}
                    placeholder="Branch name"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* UPI IDs Card */}
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader>
                <CardTitle className={`${textPrimary} text-lg`}>UPI IDs</CardTitle>
                <CardDescription className={textSecondary}>Add multiple UPI IDs for payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newUpiId}
                    onChange={(e) => setNewUpiId(e.target.value)}
                    placeholder="example@upi"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
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
                      className={`flex items-center justify-between ${bgInput} border ${borderColor} rounded-lg px-3 py-2`}
                    >
                      <span className={`text-sm ${textPrimary}`}>{upiId}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveUpiId(upiId)}
                        className={`h-6 w-6 p-0 ${textSecondary} hover:text-[#ef4444]`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {profile.upi_ids.length === 0 && (
                    <p className={`text-sm ${textSecondary} text-center py-4`}>No UPI IDs added yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Invoice Settings Tab */}
        <TabsContent value="invoice" className="mt-4">
          <div className="grid grid-cols-2 gap-6">
            <Card className={`${bgCard} border ${borderColor}`}>
              <CardHeader>
                <CardTitle className={`${textPrimary} text-lg`}>Invoice Configuration</CardTitle>
                <CardDescription className={textSecondary}>Configure invoice numbering and defaults</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className={textPrimary}>Invoice Prefix</Label>
                  <Input
                    value={profile.invoice_prefix}
                    onChange={(e) => setProfile({ ...profile, invoice_prefix: e.target.value.toUpperCase() })}
                    placeholder="INV"
                    className={`${bgInput} border ${borderColor} ${textPrimary} uppercase`}
                    data-testid="invoice-prefix-input"
                  />
                  <p className={`text-xs ${textSecondary}`}>
                    Preview: {profile.invoice_prefix}-2026-001
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-[#27272a]">
                  <Label className={textPrimary}>Invoice Theme Color</Label>
                  <p className={`text-xs ${textSecondary} -mt-1`}>
                    Used for the header strip, table header, and totals on the downloaded PDF
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={profile.invoice_theme_color || '#F97316'}
                      onChange={(e) => setProfile({ ...profile, invoice_theme_color: e.target.value })}
                      className="h-10 w-16 rounded cursor-pointer bg-transparent border border-[#27272a]"
                      data-testid="invoice-theme-color-picker"
                    />
                    <Input
                      value={profile.invoice_theme_color || '#F97316'}
                      onChange={(e) => setProfile({ ...profile, invoice_theme_color: e.target.value })}
                      placeholder="#F97316"
                      className={`${bgInput} border ${borderColor} ${textPrimary} flex-1 font-mono`}
                      data-testid="invoice-theme-color-input"
                    />
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {['#F97316', '#6366F1', '#10B981', '#EF4444', '#0EA5E9', '#8B5CF6', '#0F172A'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setProfile({ ...profile, invoice_theme_color: c })}
                        className="h-7 w-7 rounded border-2 border-[#27272a] hover:scale-110 transition-transform"
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-[#27272a]">
                  <Label className={textPrimary}>Logo Size on Invoice</Label>
                  <p className={`text-xs ${textSecondary} -mt-1`}>
                    Controls the width of your logo on the downloaded invoice PDF
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className={`${textSecondary} text-xs`}>Width (mm)</Label>
                      <Input
                        type="number" min="10" max="100" step="1"
                        value={profile.invoice_logo_width_mm ?? 35}
                        onChange={(e) => setProfile({ ...profile, invoice_logo_width_mm: parseFloat(e.target.value) || 35 })}
                        className={`${bgInput} border ${borderColor} ${textPrimary}`}
                        data-testid="invoice-logo-width-input"
                      />
                    </div>
                    <div>
                      <Label className={`${textSecondary} text-xs`}>Height (mm) — 0 = auto</Label>
                      <Input
                        type="number" min="0" max="60" step="1"
                        value={profile.invoice_logo_height_mm ?? 0}
                        onChange={(e) => setProfile({ ...profile, invoice_logo_height_mm: parseFloat(e.target.value) || 0 })}
                        className={`${bgInput} border ${borderColor} ${textPrimary}`}
                        data-testid="invoice-logo-height-input"
                      />
                    </div>
                  </div>
                  <p className={`text-xs ${textSecondary}`}>
                    Tip: A4 width is 210mm. 35mm ≈ a normal-sized header logo.
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-[#27272a]">
                  <Label className={textPrimary}>Signature Label</Label>
                  <Input
                    value={profile.invoice_signature_label || 'Authorized Signature'}
                    onChange={(e) => setProfile({ ...profile, invoice_signature_label: e.target.value })}
                    placeholder="Authorized Signature"
                    className={`${bgInput} border ${borderColor} ${textPrimary}`}
                    data-testid="invoice-signature-label-input"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className={`${bgCard} border ${borderColor} col-span-2`}>
              <CardHeader>
                <CardTitle className={`${textPrimary} text-lg`}>Terms & Conditions</CardTitle>
                <CardDescription className={textSecondary}>Default terms shown on invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={profile.terms_conditions}
                  onChange={(e) => setProfile({ ...profile, terms_conditions: e.target.value })}
                  placeholder="Enter default terms and conditions for invoices..."
                  className={`${bgInput} border ${borderColor} ${textPrimary} min-h-[200px]`}
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
