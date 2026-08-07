import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import CSVImportModal from '../components/shared/CSVImportModal';
import { Send, Plus, Upload, Pencil, Trash2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

const OUTREACH_STATUSES = ['To do', 'Contacted', 'Interested', 'Not Interested', 'Converted'];

const OUTREACH_IMPORT_FIELDS = [
  { key: 'name', label: 'Name', required: true, synonyms: ['name'] },
  { key: 'brand_name', label: 'Brand Name', synonyms: ['brand name', 'brand'] },
  { key: 'chapter_name', label: 'Chapter Name', synonyms: ['chapter name', 'chapter'] },
  { key: 'email', label: 'Email', synonyms: ['email', 'email address'] },
  { key: 'profile_link', label: 'Profile Link', synonyms: ['profile link', 'profile'] },
  { key: 'phone', label: 'Phone', synonyms: ['phone', 'phone number', 'mobile', 'contact number'] },
  { key: 'website', label: 'Website', synonyms: ['website', 'site'] },
  { key: 'status', label: 'Status', synonyms: ['status'] },
  { key: 'location', label: 'Location', synonyms: ['location'] },
  { key: 'category_name', label: 'Category', synonyms: ['category', 'category name', 'business category'] },
];

const emptyForm = () => ({ name: '', brand_name: '', chapter_name: '', email: '', profile_link: '', phone: '', website: '', status: 'To do', location: '', category_id: '' });

const BNIOutreachPage = () => {
  const { isDark } = useTheme();

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const [outreach, setOutreach] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [outreachRes, categoriesRes] = await Promise.all([
        api.get('/bni/outreach'),
        api.get('/bni/categories'),
      ]);
      setOutreach(outreachRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      toast.error('Failed to load BNI Outreach');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (o) => {
    setEditingId(o.outreach_id);
    setForm({
      name: o.name || '', brand_name: o.brand_name || '', chapter_name: o.chapter_name || '',
      email: o.email || '', profile_link: o.profile_link || '', phone: o.phone || '',
      website: o.website || '', status: o.status || 'To do', location: o.location || '',
      category_id: o.category_id || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/bni/outreach/${editingId}`, form);
        toast.success('Outreach entry updated');
      } else {
        await api.post('/bni/outreach', form);
        toast.success('Outreach entry added');
      }
      setShowModal(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save outreach entry');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (outreachId, status) => {
    try {
      await api.put(`/bni/outreach/${outreachId}`, { status });
      setOutreach((prev) => prev.map((o) => (o.outreach_id === outreachId ? { ...o, status } : o)));
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const remove = async (outreachId) => {
    if (!window.confirm('Delete this outreach entry?')) return;
    try {
      await api.delete(`/bni/outreach/${outreachId}`);
      toast.success('Outreach entry deleted');
      load();
    } catch (error) {
      toast.error('Failed to delete outreach entry');
    }
  };

  const importRows = async (rows) => {
    const normalizeCategoryText = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const results = await Promise.allSettled(rows.map((r) => {
      const catMatch = categories.find((c) => normalizeCategoryText(c.name) === normalizeCategoryText(r.category_name));
      return api.post('/bni/outreach', {
        ...emptyForm(),
        ...r,
        category_id: catMatch?.category_id || '',
      });
    }));
    const success = results.filter((r) => r.status === 'fulfilled').length;
    toast.success(`Imported ${success} of ${rows.length} outreach entries`);
    load();
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="bni-outreach-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className={`text-3xl font-bold flex items-center gap-2 ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
              <Send className="h-7 w-7 text-[#6366f1]" /> BNI Outreach
            </h1>
            <p className={`text-sm ${textSecondary} mt-1`}>Prospects being reached out to for the chapter — shared with the BNI module's Outreach tab.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)} data-testid="bni-outreach-import-btn">
              <Upload className="h-4 w-4 mr-2" /> Import CSV
            </Button>
            <Button onClick={openAdd} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-outreach-add-btn">
              <Plus className="h-4 w-4 mr-2" /> Add New
            </Button>
          </div>
        </div>

        <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={bgSecondary}>
                <tr>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Name</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Brand Name</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Chapter Name</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Email</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Profile Link</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Phone</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Website</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Status</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Location</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Category</th>
                  <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderColor}`}>
                {loading ? (
                  <tr><td colSpan={11} className={`px-4 py-8 text-center ${textSecondary}`}>Loading…</td></tr>
                ) : outreach.length === 0 ? (
                  <tr>
                    <td colSpan={11} className={`px-4 py-8 text-center ${textSecondary}`}>
                      No outreach entries yet — click "Add New" or "Import CSV" to get started.
                    </td>
                  </tr>
                ) : (
                  outreach.map((o) => (
                    <tr key={o.outreach_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                      <td className={`px-4 py-3 font-medium ${textPrimary}`}>{o.name}</td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{o.brand_name || '—'}</td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{o.chapter_name || '—'}</td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{o.email || '—'}</td>
                      <td className="px-4 py-3">
                        {o.profile_link ? (
                          <a href={o.profile_link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline flex items-center gap-1">
                            <LinkIcon className="h-3.5 w-3.5" /> View
                          </a>
                        ) : '—'}
                      </td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{o.phone || '—'}</td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{o.website || '—'}</td>
                      <td className="px-4 py-3">
                        <Select value={o.status || 'To do'} onValueChange={(v) => updateStatus(o.outreach_id, v)}>
                          <SelectTrigger className={`w-[150px] ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`bni-outreach-status-${o.outreach_id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OUTREACH_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{o.location || '—'}</td>
                      <td className={`px-4 py-3 ${textSecondary}`}>{o.category_name || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(o)} data-testid={`bni-outreach-edit-${o.outreach_id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => remove(o.outreach_id)} data-testid={`bni-outreach-delete-${o.outreach_id}`}>
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

        <CSVImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          title="Import BNI Outreach from CSV"
          fields={OUTREACH_IMPORT_FIELDS}
          onImport={importRows}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className={`${bgCard} max-w-lg`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>{editingId ? 'Edit Outreach' : 'Add Outreach'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className={textPrimary}>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} autoFocus />
              </div>
              <div>
                <Label className={textPrimary}>Brand Name</Label>
                <Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div>
                <Label className={textPrimary}>Chapter Name</Label>
                <Input value={form.chapter_name} onChange={(e) => setForm({ ...form, chapter_name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div>
                <Label className={textPrimary}>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div>
                <Label className={textPrimary}>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div className="col-span-2">
                <Label className={textPrimary}>Profile Link</Label>
                <Input value={form.profile_link} onChange={(e) => setForm({ ...form, profile_link: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div>
                <Label className={textPrimary}>Website</Label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div>
                <Label className={textPrimary}>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div className="col-span-2">
                <Label className={textPrimary}>Category</Label>
                <Select value={form.category_id || 'none'} onValueChange={(v) => setForm({ ...form, category_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`}>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.category_id} value={c.category_id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className={textPrimary}>Status</Label>
                <Select value={form.status || 'To do'} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTREACH_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-outreach-save-btn">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Outreach'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default BNIOutreachPage;
