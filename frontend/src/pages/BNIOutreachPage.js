import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import CSVImportModal from '../components/shared/CSVImportModal';
import { Send, Plus, Upload, Pencil, Trash2, Link as LinkIcon, Tag, Target, Handshake, Search, Database, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const OUTREACH_STATUSES = ['To do', 'RNR', 'Scheduled One to One', 'One to One Completed', 'Not Interested', 'Relationship', 'Lead', 'Later'];

// Cells shown in the Outreach summary card (in this order).
const SUMMARY_STATUSES = ['RNR', 'One to One Completed', 'Scheduled One to One', 'Not Interested', 'Relationship', 'Lead', 'Later'];

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

const TABS = [
  { key: 'outreach', label: 'Outreach', icon: Send },
  { key: 'sources', label: 'Sources', icon: Database },
  { key: 'category', label: 'Category', icon: Tag },
  { key: 'target', label: 'Target Category', icon: Target },
  { key: 'partnership', label: 'Partnership', icon: Handshake },
];

const TYPE_OPTIONS = [
  { value: 'none', label: 'No Target Now' },
  { value: 'target', label: 'Target Category' },
  { value: 'partnership', label: 'Partnership' },
];

const TAG_PALETTE = [
  { bg: 'bg-[#3b82f6]/15', text: 'text-[#3b82f6]', border: 'border-[#3b82f6]/40' },
  { bg: 'bg-[#10b981]/15', text: 'text-[#10b981]', border: 'border-[#10b981]/40' },
  { bg: 'bg-[#f59e0b]/15', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]/40' },
  { bg: 'bg-[#8b5cf6]/15', text: 'text-[#8b5cf6]', border: 'border-[#8b5cf6]/40' },
  { bg: 'bg-[#ec4899]/15', text: 'text-[#ec4899]', border: 'border-[#ec4899]/40' },
  { bg: 'bg-[#06b6d4]/15', text: 'text-[#06b6d4]', border: 'border-[#06b6d4]/40' },
  { bg: 'bg-[#ef4444]/15', text: 'text-[#ef4444]', border: 'border-[#ef4444]/40' },
];
const tagColor = (seed) => {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
};

const typeTriggerColor = (t) => {
  if (t === 'target') return 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/40';
  if (t === 'partnership') return 'bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/40';
  return 'bg-[#71717a]/15 text-[#71717a] border border-[#71717a]/40';
};

const countByGroup = (list) => {
  const byGroup = {};
  let ungrouped = 0;
  list.forEach((c) => { if (c.group) byGroup[c.group] = (byGroup[c.group] || 0) + 1; else ungrouped += 1; });
  return { byGroup, ungrouped, total: list.length };
};

const BNIOutreachPage = () => {
  const { isDark } = useTheme();

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  const [activeTab, setActiveTab] = useState('outreach');

  const [outreach, setOutreach] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [sources, setSources] = useState([]);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceForm, setSourceForm] = useState({ name: '', sheet_url: '' });
  const [sourceSaving, setSourceSaving] = useState(false);
  const [syncingId, setSyncingId] = useState(null);

  // Outreach tab filters
  const [filterChapter, setFilterChapter] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterWebsite, setFilterWebsite] = useState('all'); // all | has | none
  const [filterStatus, setFilterStatus] = useState(null); // null = all; set by clicking a summary card

  // Per-tab search + group filters
  const [catSearch, setCatSearch] = useState('');
  const [catGroup, setCatGroup] = useState('all');
  const [tgtSearch, setTgtSearch] = useState('');
  const [tgtGroup, setTgtGroup] = useState('all');
  const [partSearch, setPartSearch] = useState('');
  const [partGroup, setPartGroup] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [outreachRes, categoriesRes, groupsRes, sourcesRes] = await Promise.all([
        api.get('/bni/outreach'),
        api.get('/bni/categories'),
        api.get('/bni/categories/groups').catch(() => ({ data: [] })),
        api.get('/bni/outreach-sources').catch(() => ({ data: [] })),
      ]);
      setOutreach(outreachRes.data || []);
      setCategories(categoriesRes.data || []);
      setCategoryGroups(groupsRes.data || []);
      setSources(sourcesRes.data || []);
    } catch (error) {
      toast.error('Failed to load BNI Outreach');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allGroupNames = useMemo(() => {
    const set = new Set(categoryGroups.map((g) => g.name));
    categories.forEach((c) => { if (c.group) set.add(c.group); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categoryGroups, categories]);

  const filterCats = (list, search, group) => {
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      if (group === '__ungrouped__') { if (c.group) return false; }
      else if (group !== 'all') { if ((c.group || '') !== group) return false; }
      if (q && ![c.name, c.description, c.group].some((v) => (v || '').toLowerCase().includes(q))) return false;
      return true;
    });
  };

  const distinctVals = (key) => Array.from(new Set(outreach.map((o) => (o[key] || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const chapterOptions = useMemo(() => distinctVals('chapter_name'), [outreach]); // eslint-disable-line react-hooks/exhaustive-deps
  const locationOptions = useMemo(() => distinctVals('location'), [outreach]); // eslint-disable-line react-hooks/exhaustive-deps
  const categoryOptions = useMemo(() => distinctVals('category_name'), [outreach]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rows matching the Chapter/Location/Category dropdowns — the summary card
  // counts are computed over THIS set, so they stay meaningful per filter.
  const hasWebsite = (o) => {
    const w = (o.website || '').trim().toLowerCase();
    return w !== '' && w !== 'none' && w !== 'n/a' && w !== '-';
  };
  const dropdownFiltered = useMemo(() => outreach.filter((o) => {
    if (filterChapter !== 'all' && (o.chapter_name || '') !== filterChapter) return false;
    if (filterLocation !== 'all' && (o.location || '') !== filterLocation) return false;
    if (filterCategory !== 'all' && (o.category_name || '') !== filterCategory) return false;
    if (filterWebsite === 'has' && !hasWebsite(o)) return false;
    if (filterWebsite === 'none' && hasWebsite(o)) return false;
    return true;
  }), [outreach, filterChapter, filterLocation, filterCategory, filterWebsite]);

  const outreachSummary = useMemo(() => {
    const counts = { Total: dropdownFiltered.length };
    SUMMARY_STATUSES.forEach((s) => { counts[s] = 0; });
    dropdownFiltered.forEach((o) => { if (counts[o.status] !== undefined) counts[o.status] += 1; });
    return counts;
  }, [dropdownFiltered]);

  // Table rows: dropdown-filtered, then narrowed by the clicked summary card.
  const visibleOutreach = useMemo(
    () => (filterStatus ? dropdownFiltered.filter((o) => o.status === filterStatus) : dropdownFiltered),
    [dropdownFiltered, filterStatus],
  );

  const targetByGroup = useMemo(() => countByGroup(categories.filter((c) => c.target_type === 'target')), [categories]);
  const partnershipByGroup = useMemo(() => countByGroup(categories.filter((c) => c.target_type === 'partnership')), [categories]);

  // Progress within the group currently selected in the Category tab.
  const catProgress = useMemo(() => {
    const scope = catGroup === 'all' || catGroup === '__ungrouped__'
      ? (catGroup === '__ungrouped__' ? categories.filter((c) => !c.group) : categories)
      : categories.filter((c) => (c.group || '') === catGroup);
    const target = scope.filter((c) => c.target_type === 'target').length;
    const partnership = scope.filter((c) => c.target_type === 'partnership').length;
    return { total: scope.length, target, partnership };
  }, [categories, catGroup]);

  // ---- Outreach handlers ----
  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setShowModal(true); };
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
      if (editingId) { await api.put(`/bni/outreach/${editingId}`, form); toast.success('Outreach entry updated'); }
      else { await api.post('/bni/outreach', form); toast.success('Outreach entry added'); }
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
      if (status === 'Lead') toast.success('Marked as Lead — added to Sales Leads');
      else if (status === 'Scheduled One to One' || status === 'One to One Completed') toast.success('Synced to BNI One-to-One (cross chapter)');
    } catch (error) { toast.error('Failed to update status'); }
  };
  const remove = async (outreachId) => {
    if (!window.confirm('Delete this outreach entry?')) return;
    try {
      await api.delete(`/bni/outreach/${outreachId}`);
      toast.success('Outreach entry deleted');
      load();
    } catch (error) { toast.error('Failed to delete outreach entry'); }
  };
  const importRows = async (rows) => {
    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const results = await Promise.allSettled(rows.map((r) => {
      const catMatch = categories.find((c) => norm(c.name) === norm(r.category_name));
      return api.post('/bni/outreach', { ...emptyForm(), ...r, category_id: catMatch?.category_id || '' });
    }));
    const success = results.filter((r) => r.status === 'fulfilled').length;
    toast.success(`Imported ${success} of ${rows.length} outreach entries`);
    load();
  };

  // ---- Sources handlers ----
  const loadSources = async () => {
    try {
      const res = await api.get('/bni/outreach-sources');
      setSources(res.data || []);
    } catch (error) { /* silent */ }
  };
  const openAddSource = () => { setSourceForm({ name: '', sheet_url: '' }); setShowSourceModal(true); };
  const saveSource = async () => {
    if (!sourceForm.name.trim()) { toast.error('Source name is required'); return; }
    if (!sourceForm.sheet_url.trim()) { toast.error('Paste the Google Sheet link'); return; }
    setSourceSaving(true);
    try {
      await api.post('/bni/outreach-sources', sourceForm);
      toast.success('Source added');
      setShowSourceModal(false);
      loadSources();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add source');
    } finally {
      setSourceSaving(false);
    }
  };
  const syncSource = async (sourceId) => {
    setSyncingId(sourceId);
    try {
      const res = await api.post(`/bni/outreach-sources/${sourceId}/sync`);
      const { imported = 0, updated = 0, tabs = 0, total_rows = 0 } = res.data || {};
      toast.success(`Synced ${tabs} tab${tabs === 1 ? '' : 's'} · ${total_rows} rows — ${imported} added, ${updated} updated`);
      load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sync source');
    } finally {
      setSyncingId(null);
    }
  };
  const deleteSource = async (sourceId) => {
    if (!window.confirm('Delete this source? Rows it imported stay in the Outreach list.')) return;
    try {
      await api.delete(`/bni/outreach-sources/${sourceId}`);
      toast.success('Source deleted');
      load();
    } catch (error) {
      toast.error('Failed to delete source');
    }
  };

  // ---- Category type handler ----
  const updateCategoryType = async (categoryId, targetType) => {
    try {
      await api.put(`/bni/categories/${categoryId}`, { target_type: targetType });
      setCategories((prev) => prev.map((c) => (c.category_id === categoryId ? { ...c, target_type: targetType } : c)));
    } catch (error) {
      toast.error('Failed to update type');
    }
  };

  // Plain render-functions (NOT components) so the search input keeps focus
  // across re-renders — a `<SearchBox/>` component would remount each keystroke.
  // When `counts` is passed, each group shows its count and groups that have
  // any (e.g. target categories) are ordered first.
  const groupFilter = (value, onChange, testid, counts) => {
    const names = counts
      ? [...allGroupNames].sort((a, b) => (counts.byGroup[b] || 0) - (counts.byGroup[a] || 0) || a.localeCompare(b))
      : allGroupNames;
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={`w-[220px] ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={testid}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="all">All Groups{counts ? ` (${counts.total})` : ''}</SelectItem>
          <SelectItem value="__ungrouped__">Ungrouped{counts ? ` (${counts.ungrouped})` : ''}</SelectItem>
          {names.map((name) => (
            <SelectItem key={name} value={name}>{name}{counts ? ` (${counts.byGroup[name] || 0})` : ''}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const searchBox = (value, onChange, placeholder, testid) => (
    <div className="relative max-w-sm flex-1 min-w-[180px]">
      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`pl-9 ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={testid} />
    </div>
  );

  const categoryTag = (c) => (
    <Badge className={`${tagColor(c.category_id).bg} ${tagColor(c.category_id).text} border ${tagColor(c.category_id).border} font-semibold`}>{c.name}</Badge>
  );

  const readOnlyCategoryTable = (list, emptyMsg) => (
    <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={bgSecondary}>
            <tr>
              <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Category Name</th>
              <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Group</th>
              <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Description</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${borderColor}`}>
            {list.length === 0 ? (
              <tr><td colSpan={3} className={`px-4 py-8 text-center ${textSecondary}`}>{emptyMsg}</td></tr>
            ) : (
              list.map((c) => (
                <tr key={c.category_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                  <td className="px-4 py-3">{categoryTag(c)}</td>
                  <td className={`px-4 py-3 ${textSecondary}`}>{c.group || '—'}</td>
                  <td className={`px-4 py-3 ${textSecondary}`}>{c.description || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6" data-testid="bni-outreach-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className={`text-3xl font-bold flex items-center gap-2 ${textPrimary}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
              <Send className="h-7 w-7 text-[#6366f1]" /> BNI Outreach
            </h1>
            <p className={`text-sm ${textSecondary} mt-1`}>Prospects, categories, and partnership targets for the chapter — shares data with the BNI module.</p>
          </div>
          {activeTab === 'outreach' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowImport(true)} data-testid="bni-outreach-import-btn">
                <Upload className="h-4 w-4 mr-2" /> Import CSV
              </Button>
              <Button onClick={openAdd} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-outreach-add-btn">
                <Plus className="h-4 w-4 mr-2" /> Add New
              </Button>
            </div>
          )}
          {activeTab === 'sources' && (
            <Button onClick={openAddSource} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-outreach-add-source-btn">
              <Plus className="h-4 w-4 mr-2" /> Add Source
            </Button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`bni-outreach-tab-${tab.key}`}
                className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all whitespace-nowrap border ${
                  isActive ? 'bg-[#6366f1] text-white border-transparent shadow-sm' : `${bgCard} ${textSecondary} ${borderColor} hover:border-[#6366f1]/40`
                }`}
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className={`text-center py-12 ${textSecondary}`}>Loading…</div>
        ) : (
          <>
            {activeTab === 'outreach' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'All Chapters', value: filterChapter, set: setFilterChapter, opts: chapterOptions, tid: 'bni-outreach-filter-chapter' },
                    { label: 'All Locations', value: filterLocation, set: setFilterLocation, opts: locationOptions, tid: 'bni-outreach-filter-location' },
                    { label: 'All Categories', value: filterCategory, set: setFilterCategory, opts: categoryOptions, tid: 'bni-outreach-filter-category' },
                  ].map((f) => (
                    <Select key={f.tid} value={f.value} onValueChange={f.set}>
                      <SelectTrigger className={`w-[190px] ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={f.tid}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="all">{f.label}</SelectItem>
                        {f.opts.map((v) => (<SelectItem key={v} value={v}>{v}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  ))}
                  <Select value={filterWebsite} onValueChange={setFilterWebsite}>
                    <SelectTrigger className={`w-[160px] ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-outreach-filter-website">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Websites</SelectItem>
                      <SelectItem value="has">Has Website</SelectItem>
                      <SelectItem value="none">No Website</SelectItem>
                    </SelectContent>
                  </Select>
                  {filterStatus && (
                    <Button variant="outline" size="sm" onClick={() => setFilterStatus(null)} data-testid="bni-outreach-clear-status">
                      Status: {filterStatus} ✕
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {['Total', ...SUMMARY_STATUSES].map((label) => {
                    const active = label === 'Total' ? !filterStatus : filterStatus === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setFilterStatus(label === 'Total' ? null : label)}
                        className={`${bgCard} border rounded-xl p-3 text-left transition-colors ${active ? 'border-[#6366f1] ring-1 ring-[#6366f1]' : `${borderColor} hover:border-[#6366f1]/40`}`}
                        data-testid={`bni-outreach-summary-${label.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <p className={`text-[11px] ${textSecondary} leading-tight`}>{label}</p>
                        <p className={`text-xl font-bold ${label === 'Lead' ? 'text-[#10b981]' : label === 'Not Interested' ? 'text-[#ef4444]' : textPrimary}`}>{outreachSummary[label] || 0}</p>
                      </button>
                    );
                  })}
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
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Group</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Source</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {visibleOutreach.length === 0 ? (
                        <tr>
                          <td colSpan={13} className={`px-4 py-8 text-center ${textSecondary}`}>
                            {outreach.length === 0 ? 'No outreach entries yet — click "Add New" or "Import CSV" to get started.' : 'No entries match these filters.'}
                          </td>
                        </tr>
                      ) : (
                        visibleOutreach.map((o) => (
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
                                  {OUTREACH_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.location || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.category_name || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary}`}>{o.group || '—'}</td>
                            <td className="px-4 py-3">
                              {o.source_name ? (
                                <Badge className="bg-[#06b6d4]/15 text-[#06b6d4] border border-[#06b6d4]/40">{o.source_name}</Badge>
                              ) : <span className={textSecondary}>—</span>}
                            </td>
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
              </div>
            )}

            {activeTab === 'sources' && (
              <div className="space-y-3">
                <p className={`text-sm ${textSecondary}`}>
                  Add Google Sheets shared as "Anyone with the link can view". Each tab is treated as a category — the tab name is the category, and the part before its first bracket is the group. Sync pulls every tab's rows into the Outreach tab.
                </p>
                <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className={bgSecondary}>
                        <tr>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Source</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Sheet</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Last Synced</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Tabs</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Rows</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${borderColor}`}>
                        {sources.length === 0 ? (
                          <tr><td colSpan={6} className={`px-4 py-8 text-center ${textSecondary}`}>No sources yet — click "Add Source" to connect a Google Sheet.</td></tr>
                        ) : (
                          sources.map((s) => (
                            <tr key={s.source_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                              <td className={`px-4 py-3 font-medium ${textPrimary}`}>{s.name}</td>
                              <td className="px-4 py-3">
                                <a href={s.sheet_url} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline flex items-center gap-1">
                                  <LinkIcon className="h-3.5 w-3.5" /> Open
                                </a>
                              </td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{s.last_synced_at ? new Date(s.last_synced_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}</td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{s.last_tab_count || 0}</td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{s.last_row_count || 0}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <Button variant="outline" size="sm" onClick={() => syncSource(s.source_id)} disabled={syncingId === s.source_id} data-testid={`bni-source-sync-${s.source_id}`}>
                                    <RefreshCw className={`h-4 w-4 mr-1 ${syncingId === s.source_id ? 'animate-spin' : ''}`} /> {syncingId === s.source_id ? 'Syncing…' : 'Sync'}
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => deleteSource(s.source_id)} data-testid={`bni-source-delete-${s.source_id}`}>
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
              </div>
            )}

            {activeTab === 'category' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {searchBox(catSearch, setCatSearch, 'Search categories…', 'bni-outreach-cat-search')}
                  {groupFilter(catGroup, setCatGroup, 'bni-outreach-cat-group')}
                  <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
                    <Badge className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/40 font-semibold" data-testid="bni-outreach-target-progress">
                      Target {catProgress.target} / {catProgress.total}
                    </Badge>
                    <Badge className="bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/40 font-semibold">
                      Partnership {catProgress.partnership} / {catProgress.total}
                    </Badge>
                  </div>
                </div>
                <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className={bgSecondary}>
                        <tr>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Category Name</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Group</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Type</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Description</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${borderColor}`}>
                        {filterCats(categories, catSearch, catGroup).length === 0 ? (
                          <tr><td colSpan={4} className={`px-4 py-8 text-center ${textSecondary}`}>No categories match.</td></tr>
                        ) : (
                          filterCats(categories, catSearch, catGroup).map((c) => (
                            <tr key={c.category_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                              <td className="px-4 py-3">{categoryTag(c)}</td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{c.group || '—'}</td>
                              <td className="px-4 py-3">
                                <Select value={c.target_type || 'none'} onValueChange={(v) => updateCategoryType(c.category_id, v)}>
                                  <SelectTrigger className={`w-[170px] ${typeTriggerColor(c.target_type || 'none')}`} data-testid={`bni-outreach-cat-type-${c.category_id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TYPE_OPTIONS.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{c.description || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'target' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {searchBox(tgtSearch, setTgtSearch, 'Search target categories…', 'bni-outreach-tgt-search')}
                  {groupFilter(tgtGroup, setTgtGroup, 'bni-outreach-tgt-group', targetByGroup)}
                  <Badge className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/40 font-semibold" data-testid="bni-outreach-target-count">
                    {targetByGroup.total} Target Categories
                  </Badge>
                </div>
                {readOnlyCategoryTable(
                  filterCats(categories.filter((c) => c.target_type === 'target'), tgtSearch, tgtGroup),
                  'No target categories yet — mark categories as "Target Category" in the Category tab.'
                )}
              </div>
            )}

            {activeTab === 'partnership' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {searchBox(partSearch, setPartSearch, 'Search partnerships…', 'bni-outreach-part-search')}
                  {groupFilter(partGroup, setPartGroup, 'bni-outreach-part-group', partnershipByGroup)}
                  <Badge className="bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/40 font-semibold" data-testid="bni-outreach-partnership-count">
                    {partnershipByGroup.total} Partnerships
                  </Badge>
                </div>
                {readOnlyCategoryTable(
                  filterCats(categories.filter((c) => c.target_type === 'partnership'), partSearch, partGroup),
                  'No partnership categories yet — mark categories as "Partnership" in the Category tab.'
                )}
              </div>
            )}
          </>
        )}

        <Dialog open={showSourceModal} onOpenChange={setShowSourceModal}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>Add Source</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Source Name *</Label>
                <Input value={sourceForm.name} onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} placeholder="e.g. Chennai Prospects Sheet" autoFocus data-testid="bni-source-name-input" />
              </div>
              <div>
                <Label className={textPrimary}>Google Sheet Link *</Label>
                <Input value={sourceForm.sheet_url} onChange={(e) => setSourceForm({ ...sourceForm, sheet_url: e.target.value })} className={`${bgSecondary} border ${borderColor}`} placeholder="https://docs.google.com/spreadsheets/d/…" data-testid="bni-source-url-input" />
                <p className={`text-xs ${textSecondary} mt-1`}>Share the sheet as "Anyone with the link can view". Each tab becomes a category — the tab name is the category, and the part before its first bracket is the group. Row columns: Name, Brand Name, Chapter Name, Email, Profile Link, Phone, Website, Status, Location.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowSourceModal(false)}>Cancel</Button>
              <Button onClick={saveSource} disabled={sourceSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-source-save-btn">
                {sourceSaving ? 'Saving…' : 'Add Source'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                    {categories.map((c) => (<SelectItem key={c.category_id} value={c.category_id}>{c.name}</SelectItem>))}
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
                    {OUTREACH_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
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
