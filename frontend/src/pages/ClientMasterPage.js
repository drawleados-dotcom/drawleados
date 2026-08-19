import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Combobox } from '../components/ui/combobox';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Plus, Pencil, Trash2, Users, FileText, Search, BarChart3, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import ClientAnalyticsTab from '../components/clientMaster/ClientAnalyticsTab';
import SourceSelect from '../components/clientMaster/SourceSelect';
import { STATUS_OPTIONS, STATUS_MAP } from '../lib/clientStatus';

const todayIso = () => new Date().toISOString().slice(0, 10);

const MONTH_OPTIONS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

// Derives {month, year} from an ISO date string, falling back to today's if
// the date is missing/invalid — used both to seed the form and to keep the
// Month/Year fields in sync whenever Onboarding Date changes.
const monthYearFromDate = (dateStr) => {
  const d = dateStr ? new Date(`${dateStr}T00:00:00`) : null;
  const fallback = new Date();
  if (!d || Number.isNaN(d.getTime())) return { month: fallback.getMonth() + 1, year: fallback.getFullYear() };
  return { month: d.getMonth() + 1, year: d.getFullYear() };
};

const emptyForm = () => ({
  name: '',
  source: '',
  onboarding_date: todayIso(),
  onboarding_month: monthYearFromDate(todayIso()).month,
  onboarding_year: monthYearFromDate(todayIso()).year,
  service_type: 'one-time',
  service_id: '',
  package_id: '',
  package_amount: '',
  case_study: '',
  recurring_months: '',
  start_date: todayIso(),
  end_date: '',
  is_ongoing: true,
  remarks: '',
  status: 'active',
});

export default function ClientMasterPage() {
  const { isDark } = useTheme();
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [sources, setSources] = useState([]);
  const [financeClients, setFinanceClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [monthFilter, setMonthFilter] = useState(''); // "YYYY-MM"
  const [searchFilter, setSearchFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [clientsRes, servicesRes, sourcesRes, financeClientsRes] = await Promise.all([
        api.get('/client-master'),
        api.get('/services'),
        api.get('/sources'),
        api.get('/finance/clients?include_summary=false'),
      ]);
      setClients(clientsRes.data || []);
      setServices(servicesRes.data || []);
      setSources(sourcesRes.data || []);
      setFinanceClients(financeClientsRes.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load Client Master data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const servicesForType = useMemo(
    () => services.filter(s => s.billing_type === form.service_type),
    [services, form.service_type]
  );
  const selectedService = useMemo(
    () => services.find(s => s.service_id === form.service_id),
    [services, form.service_id]
  );
  const packagesForService = selectedService?.packages || [];

  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (c) => {
    setEditingId(c.client_id);
    const fallbackMonthYear = monthYearFromDate(c.onboarding_date || todayIso());
    setForm({
      name: c.name || '',
      source: c.source || '',
      onboarding_date: c.onboarding_date || todayIso(),
      onboarding_month: c.onboarding_month || fallbackMonthYear.month,
      onboarding_year: c.onboarding_year || fallbackMonthYear.year,
      service_type: c.service_type || 'one-time',
      service_id: c.service_id || '',
      package_id: c.package_id || '',
      package_amount: c.package_amount != null ? String(c.package_amount) : '',
      case_study: c.case_study || '',
      recurring_months: c.recurring_months != null ? String(c.recurring_months) : '',
      start_date: c.start_date || todayIso(),
      end_date: c.end_date || '',
      is_ongoing: c.is_ongoing !== false && !c.end_date,
      remarks: c.remarks || '',
      status: c.status || 'active',
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingId(null); };

  const onServiceTypeChange = (v) => setForm(f => ({ ...f, service_type: v, service_id: '', package_id: '', package_amount: '' }));
  const onServiceChange = (serviceId) => setForm(f => ({ ...f, service_id: serviceId, package_id: '', package_amount: '' }));
  const onPackageChange = (packageId) => {
    const pkg = packagesForService.find(p => p.package_id === packageId);
    setForm(f => ({ ...f, package_id: packageId, package_amount: pkg ? String(pkg.amount) : f.package_amount }));
  };

  const saveClient = async () => {
    if (!form.name.trim()) { toast.error('Client name is required'); return; }
    if (!form.service_id) { toast.error('Please select a Service'); return; }
    if (!form.package_id) { toast.error('Please select a Package'); return; }
    const amount = Number(form.package_amount);
    if (!(amount >= 0)) { toast.error('Package amount is invalid'); return; }
    if (form.service_type === 'recurring' && !form.is_ongoing && !form.end_date) {
      toast.error('Please pick an end date, or mark it as ongoing ("till now")'); return;
    }
    const onboardingMonth = Number(form.onboarding_month);
    const onboardingYear = Number(form.onboarding_year);
    if (!(onboardingMonth >= 1 && onboardingMonth <= 12)) { toast.error('Onboarding month is invalid'); return; }
    if (!(onboardingYear >= 2000 && onboardingYear <= 2100)) { toast.error('Onboarding year is invalid'); return; }

    const payload = {
      name: form.name.trim(),
      source: form.source.trim() || null,
      onboarding_date: form.onboarding_date,
      onboarding_month: onboardingMonth,
      onboarding_year: onboardingYear,
      service_type: form.service_type,
      service_id: form.service_id,
      service_name: selectedService?.name || '',
      package_id: form.package_id,
      package_name: packagesForService.find(p => p.package_id === form.package_id)?.name || '',
      package_amount: amount,
      case_study: form.case_study.trim() || null,
      remarks: form.remarks.trim() || null,
      status: form.status,
      recurring_months: form.service_type === 'recurring' && form.recurring_months ? Number(form.recurring_months) : null,
      start_date: form.service_type === 'recurring' ? form.start_date : null,
      end_date: form.service_type === 'recurring' && !form.is_ongoing ? form.end_date : null,
      is_ongoing: form.service_type === 'recurring' ? form.is_ongoing : null,
    };

    try {
      if (editingId) {
        await api.put(`/client-master/${editingId}`, payload);
        toast.success('Client updated');
      } else {
        await api.post('/client-master', payload);
        toast.success('Client added');
      }
      closeModal();
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save client');
    }
  };

  const deleteClient = async (clientId) => {
    if (!window.confirm('Remove this client from Client Master?')) return;
    try {
      await api.delete(`/client-master/${clientId}`);
      toast.success('Client removed');
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove client');
    }
  };

  // The PDF is generated fresh on the server on every request — no caching
  // anywhere in the chain — so this always reflects whatever's currently
  // in Client Master, including a client added moments ago.
  const [downloadingReport, setDownloadingReport] = useState(false);
  const downloadReport = async () => {
    setDownloadingReport(true);
    try {
      const res = await api.get('/client-master/report/pdf', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `client_master_report_${todayIso()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to generate report');
    } finally {
      setDownloadingReport(false);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (monthFilter) {
        const [filterYear, filterMonth] = monthFilter.split('-').map(Number);
        const fallback = monthYearFromDate(c.onboarding_date);
        const clientMonth = c.onboarding_month || fallback.month;
        const clientYear = c.onboarding_year || fallback.year;
        if (clientMonth !== filterMonth || clientYear !== filterYear) return false;
      }
      if (searchFilter && !(c.name || '').toLowerCase().includes(searchFilter.toLowerCase())) return false;
      if (sourceFilter && c.source !== sourceFilter) return false;
      return true;
    });
  }, [clients, monthFilter, searchFilter, sourceFilter]);

  const totalEarned = filteredClients.reduce((sum, c) => sum + (Number(c.total_amount) || 0), 0);

  const durationLabel = (c) => {
    if (c.service_type !== 'recurring') return '—';
    const months = c.recurring_months ? `${c.recurring_months} mo` : '';
    const range = c.start_date
      ? `${c.start_date} → ${c.is_ongoing || !c.end_date ? 'Till now' : c.end_date}`
      : '';
    return [months, range].filter(Boolean).join(' · ') || '—';
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
      <div className="space-y-6" data-testid="client-master-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className={`text-3xl font-bold ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Clients Master View
            </h1>
            <p className={`text-sm ${textSecondary}`}>Onboarding, service/package, and delivery status for every client.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={downloadReport}
              disabled={downloadingReport}
              variant="outline"
              data-testid="client-master-download-report-btn"
            >
              <FileDown className="h-4 w-4 mr-2" /> {downloadingReport ? 'Generating...' : 'Download Report'}
            </Button>
            <Button onClick={openAdd} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="add-client-btn">
              <Plus className="h-4 w-4 mr-2" /> Add Client
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className={`inline-flex p-1 rounded-lg ${isDark ? 'bg-[#18181b]' : 'bg-gray-100'}`}>
          <button
            onClick={() => setActiveTab('overview')}
            data-testid="client-master-tab-overview"
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#6366f1] text-white'
                : isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="h-4 w-4" /> Overview
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            data-testid="client-master-tab-analytics"
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-[#6366f1] text-white'
                : isDark ? 'text-[#a1a1aa] hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="h-4 w-4" /> Analytics
          </button>
        </div>

        {activeTab === 'analytics' ? (
          <ClientAnalyticsTab clients={clients} isDark={isDark} />
        ) : (
        <>
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`${bgCard} border ${borderColor} rounded-xl p-4`}>
            <p className={`text-xs ${textSecondary}`}>Clients (filtered)</p>
            <p className={`text-2xl font-bold ${textPrimary}`} data-testid="client-master-count">{filteredClients.length}</p>
          </div>
          <div className={`${bgCard} border ${borderColor} rounded-xl p-4`}>
            <p className={`text-xs ${textSecondary}`}>Total Amount Earned</p>
            <p className="text-2xl font-bold text-[#10b981]" data-testid="client-master-total">₹{totalEarned.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <Label className={`text-xs ${textSecondary}`}>Onboarding Month</Label>
            <div className="flex items-center gap-2">
              <Input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="w-44" data-testid="client-master-month-filter" />
              {monthFilter && <Button variant="outline" size="sm" onClick={() => setMonthFilter('')}>Clear</Button>}
            </div>
          </div>
          <div>
            <Label className={`text-xs ${textSecondary}`}>Source</Label>
            <Select value={sourceFilter || '__all__'} onValueChange={(v) => setSourceFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-48" data-testid="client-master-source-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Sources</SelectItem>
                {sources.map(s => <SelectItem key={s.source_id} value={s.name}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className={`text-xs ${textSecondary}`}>Search Client</Label>
            <div className="relative">
              <Search className={`h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 ${textSecondary}`} />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search by client name..."
                className="pl-9"
                data-testid="client-master-search"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Client</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Source</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Onboarding</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Service</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Package</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Amount</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Duration</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Status</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Case Study</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase min-w-[160px]`}>Remarks</th>
                  <th className={`text-right p-3 text-[11px] font-medium ${textSecondary} uppercase w-20`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={11} className={`p-10 text-center text-sm ${textSecondary}`}>
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No clients match these filters.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => {
                    const st = STATUS_MAP[c.status] || STATUS_MAP.active;
                    return (
                      <tr key={c.client_id} className={`border-b ${borderColor}`} data-testid={`client-master-row-${c.client_id}`}>
                        <td className={`p-3 font-medium ${textPrimary}`}>{c.name}</td>
                        <td className={`p-3 text-sm ${textSecondary}`}>{c.source || '—'}</td>
                        <td className={`p-3 text-sm ${textSecondary}`}>{c.onboarding_date || '—'}</td>
                        <td className={`p-3 text-sm ${textPrimary}`}>
                          {c.service_name || '—'}
                          <Badge className="ml-2 text-[10px] bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/30">
                            {c.service_type === 'recurring' ? 'Recurring' : 'One-time'}
                          </Badge>
                        </td>
                        <td className={`p-3 text-sm ${textSecondary}`}>{c.package_name || '—'}</td>
                        <td className={`p-3 text-sm text-right font-medium ${textPrimary}`}>₹{Number(c.total_amount || 0).toLocaleString()}</td>
                        <td className={`p-3 text-xs ${textSecondary}`}>{durationLabel(c)}</td>
                        <td className="p-3">
                          <Badge className={`text-xs border ${st.cls}`}>{st.label}</Badge>
                        </td>
                        <td className="p-3">
                          {c.case_study ? (
                            /^https?:\/\//.test(c.case_study) ? (
                              <a href={c.case_study} target="_blank" rel="noreferrer" className="text-[#6366f1] hover:underline flex items-center gap-1 text-xs">
                                <FileText className="h-3 w-3" /> View
                              </a>
                            ) : (
                              <span className={`text-xs ${textSecondary}`}>{c.case_study}</span>
                            )
                          ) : <span className={`text-xs ${textSecondary}`}>—</span>}
                        </td>
                        <td className={`p-3 text-xs ${textSecondary}`}>{c.remarks || '—'}</td>
                        <td className="p-3 text-right">
                          <div className="inline-flex gap-1">
                            <button onClick={() => openEdit(c)} className={`p-1 ${textSecondary} hover:opacity-80`} title="Edit" data-testid={`edit-client-${c.client_id}`}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => deleteClient(c.client_id)} className="p-1 text-red-500 hover:text-red-400" title="Delete" data-testid={`delete-client-${c.client_id}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </div>

      {/* Add/Edit Client modal */}
      <Dialog open={showModal} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Client' : 'Add Client'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client Name *</Label>
                <Combobox
                  value={form.name}
                  onChange={(v) => setForm(f => ({ ...f, name: v }))}
                  options={financeClients.map(c => ({ value: c.client_id, label: c.display_name }))}
                  placeholder="Type or select a client"
                  emptyText="No matching Finance client — you can still use this as a new name"
                  data-testid="client-form-name"
                />
              </div>
              <div>
                <Label>Source of the Client</Label>
                <SourceSelect
                  value={form.source}
                  onChange={(name) => setForm(f => ({ ...f, source: name }))}
                  sources={sources}
                  onSourcesChange={setSources}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Onboarding Date</Label>
                <Input
                  type="date"
                  value={form.onboarding_date}
                  onChange={(e) => {
                    const v = e.target.value;
                    const { month, year } = monthYearFromDate(v);
                    setForm(f => ({ ...f, onboarding_date: v, onboarding_month: month, onboarding_year: year }));
                  }}
                  data-testid="client-form-onboarding-date"
                />
              </div>
              <div>
                <Label>Month</Label>
                <Select value={String(form.onboarding_month)} onValueChange={(v) => setForm(f => ({ ...f, onboarding_month: Number(v) }))}>
                  <SelectTrigger data-testid="client-form-onboarding-month"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={form.onboarding_year}
                  onChange={(e) => setForm(f => ({ ...f, onboarding_year: e.target.value === '' ? '' : Number(e.target.value) }))}
                  data-testid="client-form-onboarding-year"
                />
              </div>
            </div>

            <div>
              <Label>Service Type *</Label>
              <Select value={form.service_type} onValueChange={onServiceTypeChange}>
                <SelectTrigger data-testid="client-form-service-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One-time</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Service *</Label>
                <Select value={form.service_id} onValueChange={onServiceChange}>
                  <SelectTrigger data-testid="client-form-service"><SelectValue placeholder="Select a service" /></SelectTrigger>
                  <SelectContent>
                    {servicesForType.map(s => <SelectItem key={s.service_id} value={s.service_id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {servicesForType.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1">No {form.service_type === 'recurring' ? 'recurring' : 'one-time'} services yet — add one in Service and Packages.</p>
                )}
              </div>
              <div>
                <Label>Package *</Label>
                <Select value={form.package_id} onValueChange={onPackageChange} disabled={!form.service_id}>
                  <SelectTrigger data-testid="client-form-package"><SelectValue placeholder="Select a package" /></SelectTrigger>
                  <SelectContent>
                    {packagesForService.map(p => <SelectItem key={p.package_id} value={p.package_id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Package Amount *</Label>
              <Input
                type="number" min="0"
                value={form.package_amount}
                onChange={(e) => setForm(f => ({ ...f, package_amount: e.target.value }))}
                data-testid="client-form-package-amount"
              />
            </div>

            <div>
              <Label>Case Study</Label>
              <Input
                value={form.case_study}
                onChange={(e) => setForm(f => ({ ...f, case_study: e.target.value }))}
                placeholder="Link or short note"
                data-testid="client-form-case-study"
              />
            </div>

            {form.service_type === 'recurring' && (
              <div className={`border ${borderColor} rounded-lg p-3 space-y-3`}>
                <div>
                  <Label>Recurring Months</Label>
                  <Input
                    type="number" min="0"
                    value={form.recurring_months}
                    onChange={(e) => setForm(f => ({ ...f, recurring_months: e.target.value }))}
                    placeholder="e.g. 6"
                    data-testid="client-form-recurring-months"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))} data-testid="client-form-start-date" />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))}
                      disabled={form.is_ongoing}
                      data-testid="client-form-end-date"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is-ongoing"
                    checked={form.is_ongoing}
                    onCheckedChange={(v) => setForm(f => ({ ...f, is_ongoing: !!v, end_date: v ? '' : f.end_date }))}
                    data-testid="client-form-ongoing"
                  />
                  <Label htmlFor="is-ongoing" className="cursor-pointer">Ongoing (till now)</Label>
                </div>
              </div>
            )}

            <div>
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Notes about this client..."
                data-testid="client-form-remarks"
              />
            </div>

            <div>
              <Label>Status *</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="client-form-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={saveClient} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="client-form-save">
              {editingId ? 'Save' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
