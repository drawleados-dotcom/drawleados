import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import api from '../../utils/api';
import { toast } from 'sonner';
import {
  Plus, Search, Eye, Pencil, Trash2, Loader2, Users, FileText,
  RefreshCw, Building2, User as UserIcon, IndianRupee,
} from 'lucide-react';
import AddClientModal from './AddClientModal';
import ClientSummaryModal from './ClientSummaryModal';

const fmtCurrency = (n, currency = 'INR') => {
  const v = Number(n || 0);
  if (currency === 'INR') return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `${currency} ${v.toLocaleString()}`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { year: '2-digit', month: 'short', day: 'numeric' });
  } catch { return '—'; }
};

const ClientsTab = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [summaryClientId, setSummaryClientId] = useState(null);
  const [migrating, setMigrating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/clients');
      setClients(res.data || []);
    } catch (err) {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (client) => {
    if (!window.confirm(`Delete client "${client.display_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/finance/clients/${client.client_id}`);
      toast.success('Client deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete client');
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const res = await api.post('/finance/clients/migrate-from-invoices');
      toast.success(res.data?.message || 'Migration completed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  // Aggregate totals for header cards
  const totals = useMemo(() => {
    return clients.reduce((acc, c) => {
      const s = c.summary || {};
      acc.invoiced += Number(s.total_invoiced || 0);
      acc.paid += Number(s.total_paid || 0);
      acc.outstanding += Number(s.outstanding || 0);
      return acc;
    }, { invoiced: 0, paid: 0, outstanding: 0 });
  }, [clients]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter((c) =>
      (c.display_name || '').toLowerCase().includes(q) ||
      (c.company_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.gstin || '').toLowerCase().includes(q) ||
      (c.mobile || '').includes(q) ||
      (c.work_phone || '').includes(q)
    );
  }, [clients, search]);

  return (
    <div className="space-y-5" data-testid="clients-tab">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            <Users className="h-6 w-6 text-[#6366f1]" /> Clients
          </h2>
          <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-0.5">Manage your client directory and invoice history</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleMigrate}
            disabled={migrating}
            variant="outline"
            className="border-gray-200 dark:border-[#27272a] text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-[#fafafa] hover:bg-gray-50 dark:hover:bg-[#1c1c1f]"
            data-testid="migrate-clients-btn"
            title="Auto-create clients from existing invoices"
          >
            {migrating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Migrate
          </Button>
          <Button
            onClick={() => { setEditClient(null); setShowAdd(true); }}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            data-testid="add-client-btn"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Client
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 dark:bg-[#09090b] border border-gray-200 dark:border-[#27272a] rounded-lg p-4">
          <div className="text-xs text-gray-600 dark:text-[#a1a1aa] uppercase mb-1.5">Total Clients</div>
          <div className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-[#6366f1]" /> {clients.length}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-[#09090b] border border-gray-200 dark:border-[#27272a] rounded-lg p-4">
          <div className="text-xs text-gray-600 dark:text-[#a1a1aa] uppercase mb-1.5">Total Invoiced</div>
          <div className="text-2xl font-bold text-[#6366f1]">{fmtCurrency(totals.invoiced)}</div>
        </div>
        <div className="bg-gray-50 dark:bg-[#09090b] border border-gray-200 dark:border-[#27272a] rounded-lg p-4">
          <div className="text-xs text-gray-600 dark:text-[#a1a1aa] uppercase mb-1.5">Total Paid</div>
          <div className="text-2xl font-bold text-green-600 dark:text-[#4ade80]">{fmtCurrency(totals.paid)}</div>
        </div>
        <div className="bg-gray-50 dark:bg-[#09090b] border border-gray-200 dark:border-[#27272a] rounded-lg p-4">
          <div className="text-xs text-gray-600 dark:text-[#a1a1aa] uppercase mb-1.5">Outstanding</div>
          <div className="text-2xl font-bold text-red-600 dark:text-[#f87171]">{fmtCurrency(totals.outstanding)}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 dark:text-[#a1a1aa]" />
        <Input
          placeholder="Search by name, company, email, GSTIN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-gray-50 dark:bg-[#09090b] border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-[#fafafa]"
          data-testid="clients-search-input"
        />
      </div>

      {/* Client Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#6366f1]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 dark:bg-[#09090b] border border-gray-200 dark:border-[#27272a] rounded-lg p-12 text-center text-gray-600 dark:text-[#a1a1aa]">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-900 dark:text-[#fafafa]">
            {search ? 'No matching clients found' : 'No clients yet'}
          </p>
          <p className="text-sm mt-1">
            {search ? 'Try a different search term.' : 'Click + Add Client to add your first client.'}
          </p>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-[#09090b] border border-gray-200 dark:border-[#27272a] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#1c1c1f] text-gray-600 dark:text-[#a1a1aa] text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">GSTIN</th>
                <th className="px-4 py-3 text-right">Invoiced</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-center">Invoices</th>
                <th className="px-4 py-3 text-left">Last Inv</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const s = c.summary || {};
                return (
                  <tr
                    key={c.client_id}
                    className="border-t border-gray-200 dark:border-[#27272a] hover:bg-gray-50/40 dark:hover:bg-[#1c1c1f]/40 transition-colors"
                    data-testid={`client-row-${c.client_id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.customer_type === 'Business'
                          ? <Building2 className="h-4 w-4 text-gray-600 dark:text-[#a1a1aa]" />
                          : <UserIcon className="h-4 w-4 text-gray-600 dark:text-[#a1a1aa]" />}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-[#fafafa]">{c.display_name}</div>
                          {c.company_name && c.company_name !== c.display_name && (
                            <div className="text-xs text-gray-600 dark:text-[#a1a1aa]">{c.company_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-[#d4d4d8]">
                      <div>{c.email || '—'}</div>
                      <div className="text-xs text-gray-600 dark:text-[#a1a1aa]">{c.mobile || c.work_phone || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-[#a1a1aa] font-mono text-xs">{c.gstin || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-[#fafafa] font-medium">
                      {fmtCurrency(s.total_invoiced, c.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 dark:text-[#4ade80]">
                      {fmtCurrency(s.total_paid, c.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={Number(s.outstanding) > 0 ? 'text-red-600 dark:text-[#f87171] font-medium' : 'text-gray-600 dark:text-[#a1a1aa]'}>
                        {fmtCurrency(s.outstanding, c.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-900 dark:text-[#fafafa]">{s.invoice_count || 0}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-[#a1a1aa] text-xs">{fmtDate(s.last_invoice_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSummaryClientId(c.client_id)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#27272a] text-[#6366f1]"
                          title="View Summary"
                          data-testid={`view-summary-${c.client_id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setEditClient(c); setShowAdd(true); }}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#27272a] text-gray-600 dark:text-[#a1a1aa]"
                          title="Edit"
                          data-testid={`edit-client-${c.client_id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#27272a] text-red-600 dark:text-[#f87171]"
                          title="Delete"
                          data-testid={`delete-client-${c.client_id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddClientModal
          client={editClient}
          onClose={() => { setShowAdd(false); setEditClient(null); }}
          onSaved={load}
        />
      )}

      {summaryClientId && (
        <ClientSummaryModal
          clientId={summaryClientId}
          onClose={() => setSummaryClientId(null)}
        />
      )}
    </div>
  );
};

export default ClientsTab;
