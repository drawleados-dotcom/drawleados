import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import CSVImportModal from '../components/shared/CSVImportModal';
import { Plus, Upload, Search, Pencil, Trash2, ExternalLink, Linkedin, Users } from 'lucide-react';
import { toast } from 'sonner';

// Matches LinkedIn's own "Connections.csv" export schema, so a raw export
// auto-maps column-for-column without the user needing to rename anything.
const CONNECTION_IMPORT_FIELDS = [
  { key: 'first_name', label: 'First Name', required: true, synonyms: ['first name', 'firstname'] },
  { key: 'last_name', label: 'Last Name', synonyms: ['last name', 'lastname', 'surname'] },
  { key: 'url', label: 'URL', synonyms: ['url', 'profile url', 'linkedin url', 'linkedin'] },
  { key: 'email', label: 'Email Address', synonyms: ['email address', 'email'] },
  { key: 'company', label: 'Company', synonyms: ['company', 'company name', 'organization'] },
  { key: 'position', label: 'Position', synonyms: ['position', 'title', 'job title'] },
  { key: 'connected_on', label: 'Connected On', synonyms: ['connected on', 'connection date', 'date connected'] },
];

const IMPORT_CHUNK_SIZE = 500;

const emptyForm = () => ({
  name: '', company: '', position: '', url: '', email: '', connected_on: '', notes: '',
});

const LinkedInConnectionsPage = () => {
  const { isDark } = useTheme();
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/linkedin-connections');
      setConnections(res.data || []);
    } catch (e) {
      toast.error('Failed to load LinkedIn connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((c) =>
      [c.name, c.company, c.position, c.email].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [connections, search]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (c) => {
    setEditingId(c.connection_id);
    setForm({
      name: c.name || '', company: c.company || '', position: c.position || '',
      url: c.url || '', email: c.email || '', connected_on: c.connected_on || '', notes: c.notes || '',
    });
    setShowForm(true);
  };

  const saveConnection = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/linkedin-connections/${editingId}`, form);
        toast.success('Connection updated');
      } else {
        await api.post('/linkedin-connections', form);
        toast.success('Connection added');
      }
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save connection');
    } finally {
      setSaving(false);
    }
  };

  const deleteConnection = async (id) => {
    if (!window.confirm('Delete this connection?')) return;
    try {
      await api.delete(`/linkedin-connections/${id}`);
      toast.success('Connection deleted');
      load();
    } catch (e) {
      toast.error('Failed to delete connection');
    }
  };

  const importConnections = async (rows) => {
    let imported = 0;
    let skipped = 0;
    for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + IMPORT_CHUNK_SIZE);
      const res = await api.post('/linkedin-connections/bulk-import', { rows: chunk });
      imported += res.data?.imported || 0;
      skipped += res.data?.skipped_duplicates || 0;
    }
    toast.success(`Imported ${imported} connection${imported === 1 ? '' : 's'}${skipped ? ` — skipped ${skipped} already in the database` : ''}`);
    load();
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="linkedin-connections-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className={`text-3xl font-bold flex items-center gap-2 ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
              <Linkedin className="h-7 w-7 text-[#0a66c2]" /> LinkedIn
            </h1>
            <div className={`text-sm ${textSecondary} flex items-center gap-2 mt-1`}>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${bgSecondary} ${textPrimary} text-xs font-semibold`} data-testid="linkedin-connection-count">
                <Users className="h-3 w-3" /> {connections.length} Connections
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)} data-testid="linkedin-import-btn">
              <Upload className="h-4 w-4 mr-2" /> Import CSV
            </Button>
            <Button onClick={openAdd} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="linkedin-add-connection-btn">
              <Plus className="h-4 w-4 mr-2" /> Add Connection
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connections…"
            className={`pl-9 ${bgSecondary} border ${borderColor} ${textPrimary}`}
            data-testid="linkedin-connection-search"
          />
        </div>

        {loading ? (
          <div className={`text-center py-12 ${textSecondary}`}>Loading…</div>
        ) : (
          <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={bgSecondary}>
                  <tr>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Name</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Company</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Position</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Email</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Connected On</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Profile</th>
                    <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${borderColor}`}>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`px-4 py-8 text-center ${textSecondary}`}>
                        {connections.length === 0
                          ? 'No connections yet — click "Add Connection" or "Import CSV" to add some.'
                          : 'No connections match your search.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.connection_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                        <td className={`px-4 py-3 font-medium ${textPrimary}`}>{c.name}</td>
                        <td className={`px-4 py-3 ${textSecondary}`}>{c.company || '—'}</td>
                        <td className={`px-4 py-3 ${textSecondary}`}>{c.position || '—'}</td>
                        <td className={`px-4 py-3 ${textSecondary}`}>{c.email || '—'}</td>
                        <td className={`px-4 py-3 ${textSecondary}`}>{c.connected_on || '—'}</td>
                        <td className="px-4 py-3">
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noreferrer" className="text-[#6366f1] inline-flex items-center gap-1 hover:underline">
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className={textSecondary}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(c)} data-testid={`linkedin-connection-edit-${c.connection_id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => deleteConnection(c.connection_id)} data-testid={`linkedin-connection-delete-${c.connection_id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add / Edit Connection */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className={`${bgCard} max-w-lg`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>{editingId ? 'Edit Connection' : 'Add Connection'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="linkedin-connection-name-input" />
              </div>
              <div>
                <Label className={textPrimary}>Company</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="linkedin-connection-company-input" />
              </div>
              <div>
                <Label className={textPrimary}>Profile URL</Label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://www.linkedin.com/in/…" className={`${bgSecondary} border ${borderColor}`} data-testid="linkedin-connection-url-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Position</Label>
                  <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
                <div>
                  <Label className={textPrimary}>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Connected On</Label>
                <Input value={form.connected_on} onChange={(e) => setForm({ ...form, connected_on: e.target.value })} placeholder="e.g. 29 Jul 2026" className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div>
                <Label className={textPrimary}>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${bgSecondary} border ${borderColor}`} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={saveConnection} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="linkedin-connection-save-btn">
                {saving ? 'Saving…' : (editingId ? 'Update Connection' : 'Add Connection')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CSVImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          title="Import Connections from CSV"
          fields={CONNECTION_IMPORT_FIELDS}
          onImport={importConnections}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />
      </div>
    </Layout>
  );
};

export default LinkedInConnectionsPage;
