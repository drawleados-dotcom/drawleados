import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Combobox } from '../components/ui/combobox';
import CSVImportModal from '../components/shared/CSVImportModal';
import { Textarea } from '../components/ui/textarea';
import { Send, Plus, Upload, Pencil, Trash2, Link as LinkIcon, Tag, Target, Handshake, Search, Database, RefreshCw, Phone, Eye, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

const OUTREACH_STATUSES = ['To do', 'New Lead', 'Contacted', 'RNR', 'Scheduled One to One', 'One to One Completed', 'Not Interested', 'Relationship', 'Lead', 'Later'];

// Summary card cells — every stage (in this order).
const SUMMARY_STATUSES = ['New Lead', 'Contacted', 'RNR', 'Scheduled One to One', 'One to One Completed', 'Not Interested', 'Relationship', 'Lead', 'Later', 'To do'];

const OUTREACH_IMPORT_FIELDS = [
  { key: 'name', label: 'Name', required: true, synonyms: ['name'] },
  { key: 'brand_name', label: 'Brand Name', synonyms: ['brand name', 'brand'] },
  { key: 'chapter_name', label: 'Chapter Name', synonyms: ['chapter name', 'chapter'] },
  { key: 'email', label: 'Email', synonyms: ['email', 'email address'] },
  { key: 'profile_link', label: 'Profile Link', synonyms: ['profile link', 'profile'] },
  { key: 'phone', label: 'Phone', synonyms: ['phone', 'phone number', 'mobile', 'contact number', 'phone 01', 'phone1', 'phone 1'] },
  { key: 'phone2', label: 'Phone 2', synonyms: ['phone 02', 'phone2', 'phone 2', 'alternate phone', 'secondary phone', 'mobile 2', 'mobile 02'] },
  { key: 'website', label: 'Website', synonyms: ['website', 'site'] },
  { key: 'status', label: 'Status', synonyms: ['status'] },
  { key: 'location', label: 'Location', synonyms: ['location'] },
  { key: 'category_name', label: 'Category', synonyms: ['category', 'category name', 'business category'] },
];

const emptyForm = () => ({ name: '', brand_name: '', chapter_name: '', email: '', profile_link: '', phone: '', phone2: '', website: '', status: 'To do', location: '', location_type: '', category_id: '', remarks: '' });

// Local / International classification — a source or an outreach row without
// an explicit choice is guessed server-side from its Location text, so every
// existing row keeps showing under Local exactly as it does today.
const LOC_TABS = [
  { key: 'all', label: 'All' },
  { key: 'local', label: 'Local' },
  { key: 'international', label: 'International' },
];
const LOCATION_TYPE_OPTIONS = [
  { value: '', label: 'Auto (guess from Location)' },
  { value: 'local', label: 'Local' },
  { value: 'international', label: 'International' },
];

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

// Client-side preview only — matches the server's substitution in
// bni_outreach_routes.py._render_template. The actual send always asks the
// server to render it fresh, so this is just for what-you'll-send preview.
const renderTemplatePreview = (message, name) => {
  const n = name || '';
  return String(message || '')
    .replace(/\{\{\s*name\s*\}\}/gi, n)
    .replace(/\[\s*member\s*name\s*\]/gi, n)
    .replace(/\[\s*name\s*\]/gi, n);
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

  // View popup (Details / Remarks)
  const [showView, setShowView] = useState(false);
  const [viewEntry, setViewEntry] = useState(null);
  const [viewTab, setViewTab] = useState('details');
  const [remarksDraft, setRemarksDraft] = useState('');
  const [remarksSaving, setRemarksSaving] = useState(false);

  const [sources, setSources] = useState([]);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceForm, setSourceForm] = useState({ name: '', sheet_url: '', sourced_by: '', location: '', location_type: '' });
  const [sourceSaving, setSourceSaving] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [showEditSourceModal, setShowEditSourceModal] = useState(false);
  const [editSourceForm, setEditSourceForm] = useState({ source_id: '', sourced_by: '', location: '', location_type: '' });
  const [editSourceSaving, setEditSourceSaving] = useState(false);
  // Local / International sub-tab, independent per board (Sources vs Outreach).
  const [sourceLocTab, setSourceLocTab] = useState('all');
  const [outreachLocTab, setOutreachLocTab] = useState('all');

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
  // WhatsApp templates modal — which Target Category is currently being managed.
  const [templatesFor, setTemplatesFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [outreachRes, categoriesRes, groupsRes, sourcesRes, employeesRes] = await Promise.all([
        api.get('/bni/outreach'),
        api.get('/bni/categories'),
        api.get('/bni/categories/groups').catch(() => ({ data: [] })),
        api.get('/bni/outreach-sources').catch(() => ({ data: [] })),
        api.get('/hr/employee-reviews/employees').catch(() => ({ data: [] })),
      ]);
      setOutreach(outreachRes.data || []);
      setCategories(categoriesRes.data || []);
      setCategoryGroups(groupsRes.data || []);
      setSources(sourcesRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (error) {
      toast.error('Failed to load BNI Outreach');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ value: e.user_id, label: e.name, sublabel: e.designation || '' })),
    [employees]
  );

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
    if (outreachLocTab !== 'all' && (o.location_type || 'local') !== outreachLocTab) return false;
    if (filterChapter !== 'all' && (o.chapter_name || '') !== filterChapter) return false;
    if (filterLocation !== 'all' && (o.location || '') !== filterLocation) return false;
    if (filterCategory !== 'all' && (o.category_name || '') !== filterCategory) return false;
    if (filterWebsite === 'has' && !hasWebsite(o)) return false;
    if (filterWebsite === 'none' && hasWebsite(o)) return false;
    return true;
  }), [outreach, outreachLocTab, filterChapter, filterLocation, filterCategory, filterWebsite]);

  const visibleSources = useMemo(
    () => (sourceLocTab === 'all' ? sources : sources.filter((s) => (s.location_type || 'local') === sourceLocTab)),
    [sources, sourceLocTab],
  );

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
      email: o.email || '', profile_link: o.profile_link || '', phone: o.phone || '', phone2: o.phone2 || '',
      website: o.website || '', status: o.status || 'To do', location: o.location || '',
      location_type: o.location_type || '', category_id: o.category_id || '', remarks: o.remarks || '',
    });
    setShowModal(true);
  };

  const openView = (o) => {
    setViewEntry(o);
    setViewTab('details');
    setRemarksDraft(o.remarks || '');
    setShowView(true);
  };
  const saveRemarks = async () => {
    if (!viewEntry) return;
    setRemarksSaving(true);
    try {
      await api.put(`/bni/outreach/${viewEntry.outreach_id}`, { remarks: remarksDraft });
      setOutreach((prev) => prev.map((o) => (o.outreach_id === viewEntry.outreach_id ? { ...o, remarks: remarksDraft } : o)));
      setViewEntry((v) => ({ ...v, remarks: remarksDraft }));
      toast.success('Remarks saved');
    } catch (error) {
      toast.error('Failed to save remarks');
    } finally {
      setRemarksSaving(false);
    }
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
  const updateStatus = async (outreachId, status, extra = {}) => {
    try {
      await api.put(`/bni/outreach/${outreachId}`, { status, ...extra });
      setOutreach((prev) => prev.map((o) => (o.outreach_id === outreachId ? { ...o, status } : o)));
      if (status === 'Lead') toast.success('Marked as Lead — added to Sales Leads');
      else if (status === 'Scheduled One to One' || status === 'One to One Completed') toast.success('Synced to BNI One-to-One (cross chapter)');
    } catch (error) { toast.error('Failed to update status'); }
  };
  // "Scheduled One to One" asks for the meeting date/time first, so the
  // synced BNI One-to-One entry shows the real meeting time instead of
  // defaulting to today with a blank time.
  const [scheduleFor, setScheduleFor] = useState(null); // outreach entry pending a date/time
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const handleStatusChange = (outreachId, status) => {
    if (status === 'Scheduled One to One') {
      setScheduleFor(outreach.find((o) => o.outreach_id === outreachId) || { outreach_id: outreachId });
      setScheduleDate(new Date().toISOString().slice(0, 10));
      setScheduleTime('10:00');
      return;
    }
    updateStatus(outreachId, status);
  };
  const confirmSchedule = async () => {
    if (!scheduleDate || !scheduleTime) { toast.error('Pick a date and time'); return; }
    setScheduling(true);
    try {
      await updateStatus(scheduleFor.outreach_id, 'Scheduled One to One', { meeting_date: scheduleDate, meeting_time: scheduleTime });
      setScheduleFor(null);
    } finally {
      setScheduling(false);
    }
  };
  const remove = async (outreachId) => {
    if (!window.confirm('Delete this outreach entry?')) return;
    try {
      await api.delete(`/bni/outreach/${outreachId}`);
      toast.success('Outreach entry deleted');
      load();
    } catch (error) { toast.error('Failed to delete outreach entry'); }
  };
  // Reach Out — asks the server for this entry's category's live template
  // (name already filled in) and hands it to WhatsApp via a wa.me link.
  const [reachingOutId, setReachingOutId] = useState(null);
  const reachOut = async (o) => {
    setReachingOutId(o.outreach_id);
    try {
      const res = await api.post(`/bni/outreach/${o.outreach_id}/reach-out`);
      const digits = (o.phone || '').replace(/\D/g, '');
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(res.data.message)}`, '_blank', 'noopener,noreferrer');
      toast.success(`Opened WhatsApp with "${res.data.template_name}"`);
      const sentAt = new Date().toISOString();
      const patch = {
        template_id_sent: res.data.template_id, template_name_sent: res.data.template_name, reached_out_at: sentAt,
      };
      const appendHistory = (entry) => ({
        ...entry, ...patch,
        reach_out_history: [...(entry.reach_out_history || []), { template_id: res.data.template_id, template_name: res.data.template_name, sent_at: sentAt }],
      });
      setOutreach((prev) => prev.map((e) => (e.outreach_id === o.outreach_id ? appendHistory(e) : e)));
      setViewEntry((prev) => (prev && prev.outreach_id === o.outreach_id ? appendHistory(prev) : prev));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not reach out');
    } finally {
      setReachingOutId(null);
    }
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
  const openAddSource = () => { setSourceForm({ name: '', sheet_url: '', sourced_by: '', location: '', location_type: '' }); setShowSourceModal(true); };
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
  const openEditSource = (s) => {
    setEditSourceForm({ source_id: s.source_id, sourced_by: s.sourced_by || '', location: s.location || '', location_type: s.location_type || '' });
    setShowEditSourceModal(true);
  };
  const saveEditSource = async () => {
    setEditSourceSaving(true);
    try {
      await api.put(`/bni/outreach-sources/${editSourceForm.source_id}`, {
        sourced_by: editSourceForm.sourced_by,
        location: editSourceForm.location,
        location_type: editSourceForm.location_type,
      });
      toast.success('Source updated');
      setShowEditSourceModal(false);
      loadSources();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update source');
    } finally {
      setEditSourceSaving(false);
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

  // All / Local / International sub-tabs — "Local" always reads exactly like
  // today's page (everything not explicitly marked International).
  const locTabBar = (value, onChange, testidPrefix) => (
    <div className={`inline-flex rounded-lg border ${borderColor} p-1 ${bgSecondary} w-fit`}>
      {LOC_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${value === t.key ? 'bg-[#6366f1] text-white' : textSecondary}`}
          data-testid={`${testidPrefix}-${t.key}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  const categoryTag = (c) => (
    <Badge className={`${tagColor(c.category_id).bg} ${tagColor(c.category_id).text} border ${tagColor(c.category_id).border} font-semibold`}>{c.name}</Badge>
  );

  const readOnlyCategoryTable = (list, emptyMsg, onTemplates) => (
    <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={bgSecondary}>
            <tr>
              <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Category Name</th>
              <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Group</th>
              <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Description</th>
              {onTemplates && <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>WhatsApp Templates</th>}
            </tr>
          </thead>
          <tbody className={`divide-y ${borderColor}`}>
            {list.length === 0 ? (
              <tr><td colSpan={onTemplates ? 4 : 3} className={`px-4 py-8 text-center ${textSecondary}`}>{emptyMsg}</td></tr>
            ) : (
              list.map((c) => {
                const templates = c.templates || [];
                const live = templates.find((t) => t.is_live);
                return (
                  <tr key={c.category_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                    <td className="px-4 py-3">{categoryTag(c)}</td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{c.group || '—'}</td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{c.description || '—'}</td>
                    {onTemplates && (
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" onClick={() => onTemplates(c)} data-testid={`bni-category-templates-${c.category_id}`}>
                          <MessageCircle className="h-3.5 w-3.5 mr-1" />
                          {templates.length} Template{templates.length === 1 ? '' : 's'}{live ? ` · Live: ${live.name}` : ''}
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })
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
                {locTabBar(outreachLocTab, setOutreachLocTab, 'bni-outreach-loctab')}
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
              <div className={`hidden md:block ${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <thead className={bgSecondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[140px]`}>Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[160px]`}>Brand Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[150px]`}>Chapter Name</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[170px]`}>Email</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[150px]`}>Status</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[90px]`}>Profile Link</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[120px]`}>Phone</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[120px]`}>Phone 2</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[140px]`}>Website</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[130px]`}>Location</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[140px]`}>Category</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[110px]`}>Group</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[110px]`}>Source</th>
                        <th className={`px-4 py-3 text-left font-medium ${textSecondary} w-[160px]`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {visibleOutreach.length === 0 ? (
                        <tr>
                          <td colSpan={14} className={`px-4 py-8 text-center ${textSecondary}`}>
                            {outreach.length === 0 ? 'No outreach entries yet — click "Add New" or "Import CSV" to get started.' : 'No entries match these filters.'}
                          </td>
                        </tr>
                      ) : (
                        visibleOutreach.map((o) => (
                          <tr key={o.outreach_id} className={`${bgCard} hover:${bgSecondary} transition-colors align-top`}>
                            <td className={`px-4 py-3 font-medium ${textPrimary} line-clamp-2 break-words`}>{o.name}</td>
                            <td className={`px-4 py-3 ${textSecondary} line-clamp-2 break-words`}>{o.brand_name || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary} line-clamp-2 break-words`}>{o.chapter_name || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary} line-clamp-2 break-words`}>{o.email || '—'}</td>
                            <td className="px-4 py-3">
                              <Select value={o.status || 'To do'} onValueChange={(v) => handleStatusChange(o.outreach_id, v)}>
                                <SelectTrigger className={`w-full ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`bni-outreach-status-${o.outreach_id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {OUTREACH_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3">
                              {o.profile_link ? (
                                <Button asChild variant="outline" size="sm" className="text-[#6366f1]">
                                  <a href={o.profile_link} target="_blank" rel="noopener noreferrer" data-testid={`bni-outreach-profile-${o.outreach_id}`}>
                                    <LinkIcon className="h-3.5 w-3.5 mr-1" /> View
                                  </a>
                                </Button>
                              ) : <span className={textSecondary}>—</span>}
                            </td>
                            <td className={`px-4 py-3 ${textSecondary} line-clamp-2 break-words`}>{o.phone || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary} line-clamp-2 break-words`}>{o.phone2 || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary} line-clamp-2 break-words`}>{o.website || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary} line-clamp-2 break-words`}>{o.location || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary} line-clamp-2 break-words`}>{o.category_name || '—'}</td>
                            <td className={`px-4 py-3 ${textSecondary} line-clamp-2 break-words`}>{o.group || '—'}</td>
                            <td className="px-4 py-3">
                              {o.source_name ? (
                                <Badge className="bg-[#06b6d4]/15 text-[#06b6d4] border border-[#06b6d4]/40 line-clamp-2 break-words">{o.source_name}</Badge>
                              ) : <span className={textSecondary}>—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                <Button variant="ghost" size="sm" className="text-[#6366f1]" onClick={() => openView(o)} title="View details" data-testid={`bni-outreach-view-${o.outreach_id}`}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openEdit(o)} title="Edit" data-testid={`bni-outreach-edit-${o.outreach_id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost" size="sm" className="text-[#10b981]"
                                  onClick={() => reachOut(o)}
                                  disabled={reachingOutId === o.outreach_id || !o.phone}
                                  title={!o.phone ? 'No phone number on this entry' : 'Reach Out on WhatsApp'}
                                  data-testid={`bni-outreach-reachout-${o.outreach_id}`}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => remove(o.outreach_id)} title="Delete" data-testid={`bni-outreach-delete-${o.outreach_id}`}>
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

              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {visibleOutreach.length === 0 ? (
                  <div className={`${bgCard} border ${borderColor} rounded-xl p-6 text-center ${textSecondary}`}>
                    {outreach.length === 0 ? 'No outreach entries yet — tap "Add New" or "Import CSV".' : 'No entries match these filters.'}
                  </div>
                ) : (
                  visibleOutreach.map((o) => (
                    <div key={o.outreach_id} className={`${bgCard} border ${borderColor} rounded-xl p-4 space-y-3`} data-testid={`bni-outreach-card-${o.outreach_id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`font-semibold ${textPrimary} truncate`}>{o.name}</p>
                          <p className={`text-xs ${textSecondary} truncate`}>{[o.brand_name, o.chapter_name].filter(Boolean).join(' · ') || '—'}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="text-[#6366f1]" onClick={() => openView(o)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => remove(o.outreach_id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <div className={`text-xs ${textSecondary} space-y-0.5`}>
                        {o.email && <p className="truncate">{o.email}</p>}
                        {o.category_name && <p className="truncate">{o.category_name}</p>}
                        {o.location && <p className="truncate">{o.location}</p>}
                        {o.source_name && <p className="truncate">Source: {o.source_name}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={o.status || 'To do'} onValueChange={(v) => handleStatusChange(o.outreach_id, v)}>
                          <SelectTrigger className={`flex-1 ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`bni-outreach-card-status-${o.outreach_id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OUTREACH_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        {o.phone ? (
                          <a href={`tel:${o.phone}`} className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-md bg-[#10b981] text-white text-sm font-medium" data-testid={`bni-outreach-card-call-${o.outreach_id}`}>
                            <Phone className="h-4 w-4" /> Call
                          </a>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-md bg-[#71717a]/15 text-[#71717a] text-sm">
                            <Phone className="h-4 w-4" /> —
                          </span>
                        )}
                        {o.phone2 && (
                          <a href={`tel:${o.phone2}`} className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-md border border-[#10b981] text-[#10b981] text-sm font-medium" data-testid={`bni-outreach-card-call2-${o.outreach_id}`}>
                            <Phone className="h-4 w-4" /> Call 2
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              </div>
            )}

            {activeTab === 'sources' && (
              <div className="space-y-3">
                <p className={`text-sm ${textSecondary}`}>
                  Add Google Sheets shared as "Anyone with the link can view". Each tab is treated as a category — the tab name is the category, and the part before its first bracket is the group. Sync pulls every tab's rows into the Outreach tab.
                </p>
                {locTabBar(sourceLocTab, setSourceLocTab, 'bni-source-loctab')}
                <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className={bgSecondary}>
                        <tr>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Source</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Sheet</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Sourced By</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Location</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Last Synced</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Tabs</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Rows</th>
                          <th className={`px-4 py-3 text-left font-medium ${textSecondary}`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${borderColor}`}>
                        {visibleSources.length === 0 ? (
                          <tr><td colSpan={8} className={`px-4 py-8 text-center ${textSecondary}`}>
                            {sources.length === 0 ? 'No sources yet — click "Add Source" to connect a Google Sheet.' : 'No sources match this filter.'}
                          </td></tr>
                        ) : (
                          visibleSources.map((s) => (
                            <tr key={s.source_id} className={`${bgCard} hover:${bgSecondary} transition-colors`}>
                              <td className={`px-4 py-3 font-medium ${textPrimary}`}>{s.name}</td>
                              <td className="px-4 py-3">
                                <a href={s.sheet_url} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline flex items-center gap-1">
                                  <LinkIcon className="h-3.5 w-3.5" /> Open
                                </a>
                              </td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{s.sourced_by || '—'}</td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{s.location || '—'}</td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{s.last_synced_at ? new Date(s.last_synced_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}</td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{s.last_tab_count || 0}</td>
                              <td className={`px-4 py-3 ${textSecondary}`}>{s.last_row_count || 0}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEditSource(s)} data-testid={`bni-source-edit-${s.source_id}`}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
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
                  'No target categories yet — mark categories as "Target Category" in the Category tab.',
                  setTemplatesFor
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
              <div>
                <Label className={textPrimary}>Sourced By</Label>
                <Combobox
                  value={sourceForm.sourced_by}
                  onChange={(v) => setSourceForm({ ...sourceForm, sourced_by: v })}
                  options={employeeOptions}
                  placeholder="Search employees…"
                  emptyText="No matching employee — you can still type a name"
                  className={`${bgSecondary} border ${borderColor}`}
                  data-testid="bni-source-sourced-by-input"
                />
              </div>
              <div>
                <Label className={textPrimary}>Location</Label>
                <Input value={sourceForm.location} onChange={(e) => setSourceForm({ ...sourceForm, location: e.target.value })} className={`${bgSecondary} border ${borderColor}`} placeholder="e.g. Chennai" data-testid="bni-source-location-input" />
              </div>
              <div>
                <Label className={textPrimary}>Local / International</Label>
                <Select value={sourceForm.location_type || 'auto'} onValueChange={(v) => setSourceForm({ ...sourceForm, location_type: v === 'auto' ? '' : v })}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-source-loctype-input">
                    <SelectValue placeholder="Auto (guess from Location)" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPE_OPTIONS.map((o) => (<SelectItem key={o.value || 'auto'} value={o.value || 'auto'}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
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

        <Dialog open={showEditSourceModal} onOpenChange={setShowEditSourceModal}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>Edit Source</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Sourced By</Label>
                <Combobox
                  value={editSourceForm.sourced_by}
                  onChange={(v) => setEditSourceForm({ ...editSourceForm, sourced_by: v })}
                  options={employeeOptions}
                  placeholder="Search employees…"
                  emptyText="No matching employee — you can still type a name"
                  className={`${bgSecondary} border ${borderColor}`}
                  autoFocus
                  data-testid="bni-source-edit-sourced-by-input"
                />
              </div>
              <div>
                <Label className={textPrimary}>Location</Label>
                <Input value={editSourceForm.location} onChange={(e) => setEditSourceForm({ ...editSourceForm, location: e.target.value })} className={`${bgSecondary} border ${borderColor}`} placeholder="e.g. Chennai" data-testid="bni-source-edit-location-input" />
              </div>
              <div>
                <Label className={textPrimary}>Local / International</Label>
                <Select value={editSourceForm.location_type || 'auto'} onValueChange={(v) => setEditSourceForm({ ...editSourceForm, location_type: v === 'auto' ? '' : v })}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-source-edit-loctype-input">
                    <SelectValue placeholder="Auto (guess from Location)" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPE_OPTIONS.map((o) => (<SelectItem key={o.value || 'auto'} value={o.value || 'auto'}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowEditSourceModal(false)}>Cancel</Button>
              <Button onClick={saveEditSource} disabled={editSourceSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-source-edit-save-btn">
                {editSourceSaving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!scheduleFor} onOpenChange={(open) => { if (!open) setScheduleFor(null); }}>
          <DialogContent className={`${bgCard} max-w-md`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>
                Schedule One-to-One{scheduleFor?.name ? ` — ${scheduleFor.name}` : ''}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Meeting Date *</Label>
                <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-outreach-schedule-date-input" />
              </div>
              <div>
                <Label className={textPrimary}>Meeting Time *</Label>
                <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-outreach-schedule-time-input" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setScheduleFor(null)}>Cancel</Button>
              <Button onClick={confirmSchedule} disabled={scheduling} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-outreach-schedule-save-btn">
                {scheduling ? 'Saving…' : 'Schedule'}
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

        <Dialog open={showView} onOpenChange={setShowView}>
          <DialogContent className={`${bgCard} max-w-lg`}>
            <DialogHeader>
              <DialogTitle className={textPrimary}>{viewEntry?.name}</DialogTitle>
            </DialogHeader>
            <div className={`inline-flex rounded-lg border ${borderColor} p-1 ${bgSecondary} w-fit`}>
              {[{ k: 'details', l: 'Details' }, { k: 'remarks', l: 'Remarks' }, { k: 'whatsapp', l: 'WhatsApp' }].map((t) => (
                <button
                  key={t.k}
                  onClick={() => setViewTab(t.k)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewTab === t.k ? 'bg-[#6366f1] text-white' : textSecondary}`}
                  data-testid={`bni-outreach-view-tab-${t.k}`}
                >
                  {t.l}
                </button>
              ))}
            </div>
            {viewEntry && viewTab === 'details' && (
              <div className="space-y-2 text-sm">
                {[
                  ['Brand Name', viewEntry.brand_name],
                  ['Chapter Name', viewEntry.chapter_name],
                  ['Email', viewEntry.email],
                  ['Phone', viewEntry.phone],
                  ['Phone 2', viewEntry.phone2],
                  ['Website', viewEntry.website],
                  ['Location', viewEntry.location],
                  ['Category', viewEntry.category_name],
                  ['Group', viewEntry.group],
                  ['Status', viewEntry.status],
                  ['Source', viewEntry.source_name],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <span className={textSecondary}>{label}</span>
                    <span className={`${textPrimary} text-right break-all`}>{val || '—'}</span>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  {viewEntry.profile_link && (
                    <a href={viewEntry.profile_link} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline inline-flex items-center gap-1">
                      <LinkIcon className="h-4 w-4" /> Profile
                    </a>
                  )}
                  {viewEntry.phone && (
                    <a href={`tel:${viewEntry.phone}`} className="text-[#10b981] hover:underline inline-flex items-center gap-1">
                      <Phone className="h-4 w-4" /> Call
                    </a>
                  )}
                  {viewEntry.phone2 && (
                    <a href={`tel:${viewEntry.phone2}`} className="text-[#10b981] hover:underline inline-flex items-center gap-1">
                      <Phone className="h-4 w-4" /> Call 2
                    </a>
                  )}
                </div>
              </div>
            )}
            {viewEntry && viewTab === 'remarks' && (
              <div className="space-y-3">
                <Textarea
                  value={remarksDraft}
                  onChange={(e) => setRemarksDraft(e.target.value)}
                  rows={6}
                  placeholder="Add remarks about this lead…"
                  className={`${bgSecondary} border ${borderColor}`}
                  data-testid="bni-outreach-remarks-input"
                />
                <div className="flex justify-end">
                  <Button onClick={saveRemarks} disabled={remarksSaving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-outreach-remarks-save">
                    {remarksSaving ? 'Saving…' : 'Save Remarks'}
                  </Button>
                </div>
              </div>
            )}
            {viewEntry && viewTab === 'whatsapp' && (() => {
              const viewCategory = categories.find((c) => c.category_id === viewEntry.category_id);
              const liveTemplate = (viewCategory?.templates || []).find((t) => t.is_live);
              const history = [...(viewEntry.reach_out_history || [])].reverse();
              return (
                <div className="space-y-3">
                  {!viewEntry.category_id ? (
                    <p className={`text-sm ${textSecondary} text-center py-4`}>Set a category on this entry first — templates live on the category.</p>
                  ) : !liveTemplate ? (
                    <div className="text-center py-4 space-y-2">
                      <p className={`text-sm ${textSecondary}`}>No live template set for "{viewCategory?.name || viewEntry.category_name}" yet.</p>
                      {viewCategory && (
                        <Button variant="outline" size="sm" onClick={() => { setShowView(false); setTemplatesFor(viewCategory); }} data-testid="bni-outreach-view-manage-templates">
                          Manage Templates
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className={`rounded-lg border ${borderColor} ${bgSecondary} p-3`}>
                        <p className={`text-[11px] font-medium uppercase ${textSecondary}`}>Live template: {liveTemplate.name}</p>
                        <p className={`text-sm ${textPrimary} whitespace-pre-wrap mt-1`}>{renderTemplatePreview(liveTemplate.message, viewEntry.name)}</p>
                      </div>
                      <Button
                        onClick={() => reachOut(viewEntry)}
                        disabled={reachingOutId === viewEntry.outreach_id || !viewEntry.phone}
                        className="w-full bg-[#10b981] hover:bg-[#0d9668] text-white"
                        data-testid="bni-outreach-view-reachout"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" /> {viewEntry.phone ? 'Send via WhatsApp' : 'No phone number on this entry'}
                      </Button>
                    </>
                  )}
                  {history.length > 0 && (
                    <div className={`border-t ${borderColor} pt-2 space-y-1`}>
                      <p className={`text-[11px] font-medium uppercase ${textSecondary}`}>Sent before</p>
                      {history.map((h, i) => (
                        <p key={i} className={`text-xs ${textSecondary}`}>
                          {h.template_name} — {new Date(h.sent_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

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
              <div>
                <Label className={textPrimary}>Phone 2</Label>
                <Input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
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
              <div>
                <Label className={textPrimary}>Local / International</Label>
                <Select value={form.location_type || 'auto'} onValueChange={(v) => setForm({ ...form, location_type: v === 'auto' ? '' : v })}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-outreach-loctype-input">
                    <SelectValue placeholder="Auto (guess from Location)" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPE_OPTIONS.map((o) => (<SelectItem key={o.value || 'auto'} value={o.value || 'auto'}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
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

        {templatesFor && (
          <CategoryTemplatesModal
            category={templatesFor}
            onClose={() => setTemplatesFor(null)}
            onChanged={(nextTemplates) => {
              setCategories((prev) => prev.map((c) => (c.category_id === templatesFor.category_id ? { ...c, templates: nextTemplates } : c)));
              setTemplatesFor((prev) => (prev ? { ...prev, templates: nextTemplates } : prev));
            }}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        )}
      </div>
    </Layout>
  );
};

// Manages a Target Category's WhatsApp templates: add / edit / delete, which
// one is Live (and since when), and how each template has performed so far
// (sent count + where those prospects' status stands today) — the A/B
// comparison for "5 got Template A, 5 got Template B".
function CategoryTemplatesModal({ category, onClose, onChanged, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [templates, setTemplates] = useState(category.templates || []);
  const [perf, setPerf] = useState([]);
  const [perfLoading, setPerfLoading] = useState(true);
  const [addForm, setAddForm] = useState({ name: '', message: '' });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [liveFromDraft, setLiveFromDraft] = useState({}); // template_id -> date string
  const addTextareaRef = useRef(null);
  const editTextareaRef = useRef(null);

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const loadPerf = useCallback(async () => {
    setPerfLoading(true);
    try {
      const res = await api.get('/bni/outreach/templates/performance', { params: { category_id: category.category_id } });
      setPerf(res.data || []);
    } catch (e) { /* silent — performance is a nice-to-have, not blocking */ } finally { setPerfLoading(false); }
  }, [category.category_id]);

  useEffect(() => { loadPerf(); }, [loadPerf]);

  // Inserts {{name}} at the cursor position in whichever textarea is passed.
  const insertPlaceholder = (ref, setForm) => {
    const el = ref.current;
    const token = '{{name}}';
    if (!el) { setForm((f) => ({ ...f, message: `${f.message}${token}` })); return; }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    setForm((f) => ({ ...f, message: f.message.slice(0, start) + token + f.message.slice(end) }));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  };

  const addTemplate = async () => {
    if (!addForm.name.trim()) { toast.error('Template name is required'); return; }
    if (!addForm.message.trim()) { toast.error('Template message is required'); return; }
    setAdding(true);
    try {
      const res = await api.post(`/bni/categories/${category.category_id}/templates`, addForm);
      const next = [...templates, res.data];
      setTemplates(next);
      onChanged(next);
      setAddForm({ name: '', message: '' });
      toast.success('Template added');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add template');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (t) => { setEditingId(t.template_id); setEditForm({ name: t.name, message: t.message }); };
  const saveEdit = async () => {
    if (!editForm.name.trim()) { toast.error('Template name is required'); return; }
    if (!editForm.message.trim()) { toast.error('Template message is required'); return; }
    setSaving(true);
    try {
      const res = await api.put(`/bni/categories/${category.category_id}/templates/${editingId}`, editForm);
      const next = templates.map((t) => (t.template_id === editingId ? { ...t, ...res.data } : t));
      setTemplates(next);
      onChanged(next);
      setEditingId(null);
      toast.success('Template updated');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async (templateId) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.delete(`/bni/categories/${category.category_id}/templates/${templateId}`);
      const next = templates.filter((t) => t.template_id !== templateId);
      setTemplates(next);
      onChanged(next);
      toast.success('Template deleted');
    } catch (e) {
      toast.error('Failed to delete template');
    }
  };

  const makeLive = async (templateId) => {
    const liveFrom = liveFromDraft[templateId] || todayISO();
    try {
      const res = await api.post(`/bni/categories/${category.category_id}/templates/${templateId}/make-live`, { live_from: liveFrom });
      setTemplates(res.data.templates);
      onChanged(res.data.templates);
      toast.success('This template is now live');
      loadPerf();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to make live');
    }
  };

  const unliveTemplate = async (templateId) => {
    try {
      const res = await api.post(`/bni/categories/${category.category_id}/templates/${templateId}/unlive`);
      const next = res.data.templates || [];
      setTemplates(next);
      onChanged(next);
      toast.success('Template taken off live');
    } catch (e) {
      toast.error('Failed to update');
    }
  };

  const perfFor = (templateId) => perf.find((p) => p.template_id === templateId);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={`${bgCard} max-w-2xl max-h-[85vh] overflow-y-auto`} data-testid="bni-templates-modal">
        <DialogHeader>
          <DialogTitle className={textPrimary}>WhatsApp Templates — {category.name}</DialogTitle>
        </DialogHeader>
        <p className={`text-xs ${textSecondary}`}>
          Reach Out on the Outreach tab always sends whichever template is Live here. Use <code>{'{{name}}'}</code>{' '}
          anywhere in the text (or the "Insert Name" button) and it's filled in with each prospect's own name.
        </p>

        <div className="space-y-3">
          {templates.length === 0 && <p className={`text-sm ${textSecondary} text-center py-4`}>No templates yet — add one below.</p>}
          {templates.map((t) => {
            const stats = perfFor(t.template_id);
            const isEditing = editingId === t.template_id;
            return (
              <div key={t.template_id} className={`border rounded-lg p-3 space-y-2 ${t.is_live ? 'border-[#10b981]' : borderColor}`} data-testid={`bni-template-${t.template_id}`}>
                {isEditing ? (
                  <>
                    <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} placeholder="Template name" data-testid={`bni-template-edit-name-${t.template_id}`} />
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => insertPlaceholder(editTextareaRef, setEditForm)}>+ Insert Name</Button>
                    </div>
                    <Textarea ref={editTextareaRef} value={editForm.message} onChange={(e) => setEditForm({ ...editForm, message: e.target.value })} rows={4} className={`${bgSecondary} border ${borderColor}`} data-testid={`bni-template-edit-message-${t.template_id}`} />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button type="button" size="sm" onClick={saveEdit} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid={`bni-template-edit-save-${t.template_id}`}>{saving ? 'Saving…' : 'Save'}</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold ${textPrimary}`}>{t.name}</p>
                          {t.is_live && <Badge className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/40">Live from {t.live_from}</Badge>}
                        </div>
                        <p className={`text-sm ${textSecondary} whitespace-pre-wrap mt-1`}>{t.message}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(t)} data-testid={`bni-template-edit-${t.template_id}`}><Pencil className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="sm" className="text-[#ef4444]" onClick={() => removeTemplate(t.template_id)} data-testid={`bni-template-delete-${t.template_id}`}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.is_live ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => unliveTemplate(t.template_id)} data-testid={`bni-template-unlive-${t.template_id}`}>Take off Live</Button>
                      ) : (
                        <>
                          <Input
                            type="date"
                            value={liveFromDraft[t.template_id] || todayISO()}
                            onChange={(e) => setLiveFromDraft((d) => ({ ...d, [t.template_id]: e.target.value }))}
                            className={`h-8 w-40 text-xs ${bgSecondary} border ${borderColor}`}
                            data-testid={`bni-template-live-from-${t.template_id}`}
                          />
                          <Button type="button" size="sm" onClick={() => makeLive(t.template_id)} className="bg-[#10b981] hover:bg-[#0d9668] text-white" data-testid={`bni-template-make-live-${t.template_id}`}>
                            Make Live
                          </Button>
                        </>
                      )}
                      <span className={`text-xs ${textSecondary}`}>
                        {perfLoading ? 'Loading performance…' : !stats || stats.sent === 0 ? 'Not sent yet'
                          : `Sent to ${stats.sent} · ${Object.entries(stats.by_status).map(([s, n]) => `${s}: ${n}`).join(', ')}`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className={`border-t ${borderColor} pt-3 space-y-2`}>
          <p className={`text-xs font-medium uppercase ${textSecondary}`}>Add a template</p>
          <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} placeholder="Template name (e.g. Intro A)" data-testid="bni-template-add-name" />
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => insertPlaceholder(addTextareaRef, setAddForm)}>+ Insert Name</Button>
          </div>
          <Textarea ref={addTextareaRef} value={addForm.message} onChange={(e) => setAddForm({ ...addForm, message: e.target.value })} rows={4} placeholder="Hi {{name}}, ..." className={`${bgSecondary} border ${borderColor}`} data-testid="bni-template-add-message" />
          <div className="flex justify-end">
            <Button type="button" onClick={addTemplate} disabled={adding} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="bni-template-add-save">
              {adding ? 'Adding…' : 'Add Template'}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BNIOutreachPage;
