import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api, { API_BASE } from '../../utils/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import {
  BarChart3, Megaphone, MessagesSquare, Inbox, Settings2, Plus, Play, Pause, Eye, Trash2, RefreshCw,
  CheckCheck, Check, Clock, AlertCircle, Send, Copy, ExternalLink, Search, ChevronDown, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

// WhatsApp Campaigns for BNI Outreach — sends approved Meta templates to
// members picked by category, then tracks delivery, replies and one-to-one
// conversion. Backend: backend/bni_campaign_routes.py (prefix /bni/campaigns).

const SUB_TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { key: 'responses', label: 'Responses', icon: MessagesSquare },
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'setup', label: 'Setup', icon: Settings2 },
];

const RESPONSE_STATUSES = ['Pending', 'Replied', 'Interested', 'Not Interested', 'Scheduled One to One', 'One to One Completed'];
const OUTREACH_STATUSES = ['To do', 'New Lead', 'Contacted', 'RNR', 'Scheduled One to One', 'One to One Completed', 'Not Interested', 'Relationship', 'Lead', 'Later'];
const VARIABLE_SOURCES = [
  { value: 'name', label: 'Member name' },
  { value: 'brand_name', label: 'Company / brand' },
  { value: 'category_name', label: 'Business category' },
  { value: 'chapter_name', label: 'Chapter' },
  { value: 'location', label: 'Location' },
  { value: 'custom', label: 'Custom text (same for all)' },
];
const TEMPLATE_TOKENS = ['name', 'company', 'category', 'chapter', 'location'];

const SUMMARY_CARDS = [
  { key: 'contacted', label: 'Members Contacted' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'read', label: 'Read' },
  { key: 'replied', label: 'Replied', tone: 'text-[#10b981]' },
  { key: 'not_replied', label: 'Not Replied' },
  { key: 'interested', label: 'Interested', tone: 'text-[#10b981]' },
  { key: 'not_interested', label: 'Not Interested', tone: 'text-[#ef4444]' },
  { key: 'scheduled', label: '1-to-1 Scheduled', tone: 'text-[#6366f1]', hint: 'Includes meetings since completed' },
  { key: 'completed', label: '1-to-1 Completed', tone: 'text-[#6366f1]' },
  { key: 'failed', label: 'Failed', tone: 'text-[#ef4444]' },
];

const responseColor = (s) => ({
  Pending: 'bg-[#71717a]/15 text-[#71717a] border-[#71717a]/40',
  Replied: 'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/40',
  Interested: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/40',
  'Not Interested': 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/40',
  'Scheduled One to One': 'bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/40',
  'One to One Completed': 'bg-[#8b5cf6]/15 text-[#8b5cf6] border-[#8b5cf6]/40',
}[s] || '');

const campaignStatusColor = (s) => ({
  draft: 'bg-[#71717a]/15 text-[#71717a] border-[#71717a]/40',
  sending: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/40',
  paused: 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/40',
  completed: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/40',
}[s] || '');

const templateStatusColor = (s) => ({
  APPROVED: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/40',
  PENDING: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/40',
  REJECTED: 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/40',
}[s] || 'bg-[#71717a]/15 text-[#71717a] border-[#71717a]/40');

const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

const renderBody = (body, values) => String(body || '').replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => values[Number(n) - 1] ?? m);

// Same fill rule as the server's variable_values — preview only.
const valuesFor = (member, variables) => variables.map((v) => {
  const raw = v.source === 'custom' ? v.value : member?.[v.source];
  const val = String(raw || '').replace(/\s+/g, ' ').trim();
  return val || (v.fallback || '').trim() || 'there';
});

const SendStatusIcon = ({ status, error }) => {
  if (status === 'read') return <CheckCheck className="h-4 w-4 text-[#3b82f6]" title="Read" />;
  if (status === 'delivered') return <CheckCheck className="h-4 w-4 text-[#71717a]" title="Delivered" />;
  if (status === 'sent') return <Check className="h-4 w-4 text-[#71717a]" title="Sent" />;
  if (status === 'failed') return <AlertCircle className="h-4 w-4 text-[#ef4444]" title={error || 'Failed'} />;
  return <Clock className="h-4 w-4 text-[#f59e0b]" title="Queued" />;
};

const webhookUrl = () => {
  const base = API_BASE.startsWith('http') ? API_BASE : `${window.location.origin}${API_BASE}`;
  return `${base}/bni/campaigns/webhook`;
};

const BNICampaignsTab = ({ categories, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) => {
  const [sub, setSub] = useState('overview');
  const [settings, setSettings] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [inboxPhone, setInboxPhone] = useState(null); // conversation to open when jumping to Inbox
  const [unread, setUnread] = useState(0);

  const loadSettings = useCallback(async () => {
    try { setSettings((await api.get('/bni/campaigns/settings')).data); } catch (e) { /* shown in Setup */ }
  }, []);
  const loadTemplates = useCallback(async () => {
    try { setTemplates((await api.get('/bni/campaigns/templates')).data || []); } catch (e) { /* silent */ }
  }, []);
  const loadCampaigns = useCallback(async () => {
    try { setCampaigns((await api.get('/bni/campaigns')).data || []); } catch (e) { toast.error('Failed to load campaigns'); }
  }, []);

  useEffect(() => { loadSettings(); loadTemplates(); loadCampaigns(); }, [loadSettings, loadTemplates, loadCampaigns]);

  const openChat = (phone) => { setInboxPhone(phone); setSub('inbox'); };
  const shared = { bgCard, bgSecondary, textPrimary, textSecondary, borderColor };

  return (
    <div className="space-y-4" data-testid="bni-campaigns">
      {settings && !settings.configured && (
        <div className="rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-3 text-sm text-[#b45309] flex items-center justify-between gap-3 flex-wrap">
          <span>WhatsApp Business API isn't connected yet — campaigns can't send until it is.</span>
          <Button size="sm" variant="outline" onClick={() => setSub('setup')}>Open Setup</Button>
        </div>
      )}
      <div className={`inline-flex flex-wrap rounded-lg border ${borderColor} p-1 ${bgSecondary}`}>
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setSub(t.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 transition-colors ${sub === t.key ? 'bg-[#6366f1] text-white' : textSecondary}`}
              data-testid={`bni-campaigns-sub-${t.key}`}
            >
              <Icon className="h-4 w-4" /> {t.label}
              {t.key === 'inbox' && unread > 0 && <span className="ml-1 rounded-full bg-[#10b981] text-white text-[10px] px-1.5">{unread}</span>}
            </button>
          );
        })}
      </div>

      {sub === 'overview' && <OverviewPanel campaigns={campaigns} onUnread={setUnread} {...shared} />}
      {sub === 'campaigns' && (
        <CampaignsPanel
          campaigns={campaigns} templates={templates} categories={categories} settings={settings}
          reload={loadCampaigns} onOpenChat={openChat} onGoSetup={() => setSub('setup')} {...shared}
        />
      )}
      {sub === 'responses' && <ResponsesPanel campaigns={campaigns} onOpenChat={openChat} {...shared} />}
      {sub === 'inbox' && <InboxPanel initialPhone={inboxPhone} onUnread={setUnread} {...shared} />}
      {sub === 'setup' && (
        <SetupPanel settings={settings} templates={templates} reloadSettings={loadSettings} reloadTemplates={loadTemplates} {...shared} />
      )}
    </div>
  );
};

// ------------------------------------------------------------------ Overview

function OverviewPanel({ campaigns, onUnread, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [campaignId, setCampaignId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (campaignId !== 'all') params.campaign_id = campaignId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get('/bni/campaigns/analytics/summary', { params });
      setData(res.data);
      onUnread(res.data.unread_messages || 0);
    } catch (e) {
      toast.error('Failed to load campaign analytics');
    } finally {
      setLoading(false);
    }
  }, [campaignId, dateFrom, dateTo, onUnread]);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};
  const maxContacted = Math.max(1, ...(data?.by_category || []).map((c) => c.contacted));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={campaignId} onValueChange={setCampaignId}>
          <SelectTrigger className={`w-[240px] ${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-campaigns-overview-campaign">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map((c) => <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`w-[160px] ${bgSecondary} border ${borderColor} ${textPrimary}`} title="Sent from" />
        <span className={textSecondary}>to</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`w-[160px] ${bgSecondary} border ${borderColor} ${textPrimary}`} title="Sent to" />
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SUMMARY_CARDS.map((card) => (
          <div key={card.key} className={`${bgCard} border ${borderColor} rounded-xl p-3`} title={card.hint || ''} data-testid={`bni-campaigns-card-${card.key}`}>
            <p className={`text-[11px] ${textSecondary} leading-tight`}>{card.label}</p>
            <p className={`text-xl font-bold ${card.tone || textPrimary}`}>{s[card.key] || 0}</p>
          </div>
        ))}
      </div>
      <div className={`flex gap-4 flex-wrap text-sm ${textSecondary}`}>
        <span>Delivery rate <b className={textPrimary}>{s.delivery_rate || 0}%</b></span>
        <span>Reply rate <b className={textPrimary}>{s.reply_rate || 0}%</b></span>
        <span>Meeting conversion <b className={textPrimary}>{s.meeting_rate || 0}%</b></span>
        {s.queued > 0 && <span>Still queued <b className={textPrimary}>{s.queued}</b></span>}
      </div>

      <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
        <div className={`px-4 py-3 border-b ${borderColor} flex items-center justify-between`}>
          <p className={`font-semibold ${textPrimary}`}>Category performance</p>
          <p className={`text-xs ${textSecondary}`}>Sorted by meeting conversion, then reply rate</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={bgSecondary}>
              <tr>
                {['Category', 'Contacted', 'Delivered', 'Replied', 'Interested', 'Scheduled', 'Completed', 'Reply rate', 'Meeting rate'].map((h) => (
                  <th key={h} className={`px-4 py-3 text-left font-medium ${textSecondary} whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${borderColor}`}>
              {(data?.by_category || []).length === 0 ? (
                <tr><td colSpan={9} className={`px-4 py-8 text-center ${textSecondary}`}>{loading ? 'Loading…' : 'No messages sent yet — create a campaign to get started.'}</td></tr>
              ) : data.by_category.map((c) => (
                <tr key={c.category_name}>
                  <td className={`px-4 py-3 font-medium ${textPrimary}`}>
                    {c.category_name}
                    <div className={`h-1.5 mt-1 rounded ${bgSecondary} w-32 overflow-hidden`}>
                      <div className="h-full bg-[#6366f1]" style={{ width: `${(c.contacted / maxContacted) * 100}%` }} />
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${textSecondary}`}>{c.contacted}</td>
                  <td className={`px-4 py-3 ${textSecondary}`}>{c.delivered}</td>
                  <td className={`px-4 py-3 ${textSecondary}`}>{c.replied}</td>
                  <td className={`px-4 py-3 ${textSecondary}`}>{c.interested}</td>
                  <td className={`px-4 py-3 ${textSecondary}`}>{c.scheduled}</td>
                  <td className={`px-4 py-3 ${textSecondary}`}>{c.completed}</td>
                  <td className={`px-4 py-3 font-semibold ${textPrimary}`}>{c.reply_rate}%</td>
                  <td className="px-4 py-3 font-semibold text-[#6366f1]">{c.meeting_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Campaigns

function CampaignsPanel({ campaigns, templates, categories, settings, reload, onOpenChat, onGoSetup, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [showNew, setShowNew] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const shared = { bgCard, bgSecondary, textPrimary, textSecondary, borderColor };

  // Refresh progress while anything is sending.
  useEffect(() => {
    if (!campaigns.some((c) => c.status === 'sending')) return undefined;
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [campaigns, reload]);

  const act = async (c, action) => {
    setBusyId(c.campaign_id);
    try {
      if (action === 'delete') {
        if (!window.confirm(`Delete campaign "${c.name}"? Its tracking rows are removed; inbox messages stay.`)) return;
        await api.delete(`/bni/campaigns/${c.campaign_id}`);
        toast.success('Campaign deleted');
      } else {
        await api.post(`/bni/campaigns/${c.campaign_id}/${action}`);
        toast.success(action === 'send' ? 'Sending started' : 'Campaign paused');
      }
      reload();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className={`text-sm ${textSecondary}`}>Each campaign sends one approved WhatsApp template to the members you pick, one message per second, up to your daily cap.</p>
        <Button onClick={() => setShowNew(true)} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-campaigns-new-btn">
          <Plus className="h-4 w-4 mr-2" /> New Campaign
        </Button>
      </div>
      <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={bgSecondary}>
              <tr>
                {['Campaign', 'Template', 'Status', 'Progress', 'Delivered', 'Replied', 'Interested', 'Meetings', 'Created', 'Actions'].map((h) => (
                  <th key={h} className={`px-4 py-3 text-left font-medium ${textSecondary} whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${borderColor}`}>
              {campaigns.length === 0 ? (
                <tr><td colSpan={10} className={`px-4 py-8 text-center ${textSecondary}`}>No campaigns yet — click "New Campaign".</td></tr>
              ) : campaigns.map((c) => {
                const st = c.stats || {};
                const done = st.total - st.queued;
                const stalled = c.status === 'sending' && !c.is_running;
                return (
                  <tr key={c.campaign_id} data-testid={`bni-campaign-row-${c.campaign_id}`}>
                    <td className={`px-4 py-3 font-medium ${textPrimary}`}>
                      <button type="button" className="hover:underline text-left" onClick={() => setDetailId(c.campaign_id)}>{c.name}</button>
                      {c.pause_reason && c.status === 'paused' && <p className="text-[11px] text-[#ef4444] max-w-[260px]">{c.pause_reason}</p>}
                    </td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{c.template_name}</td>
                    <td className="px-4 py-3">
                      <Badge className={`border ${campaignStatusColor(c.status)}`}>{stalled ? 'stalled' : c.status}</Badge>
                    </td>
                    <td className={`px-4 py-3 ${textSecondary} whitespace-nowrap`}>
                      {done} / {st.total}{st.failed ? <span className="text-[#ef4444]"> · {st.failed} failed</span> : null}
                    </td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{st.delivered || 0}</td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{st.replied || 0} <span className="text-[11px]">({st.reply_rate || 0}%)</span></td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{st.interested || 0}</td>
                    <td className={`px-4 py-3 ${textSecondary}`}>{st.scheduled || 0} / {st.completed || 0}</td>
                    <td className={`px-4 py-3 ${textSecondary} whitespace-nowrap`}>{fmtDateTime(c.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#6366f1]" onClick={() => setDetailId(c.campaign_id)} title="View"><Eye className="h-4 w-4" /></Button>
                        {(c.status === 'draft' || c.status === 'paused' || stalled) && st.queued > 0 && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#10b981]" disabled={busyId === c.campaign_id} onClick={() => act(c, 'send')} title={c.status === 'draft' ? 'Send' : 'Resume'} data-testid={`bni-campaign-send-${c.campaign_id}`}>
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {c.status === 'sending' && !stalled && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#f59e0b]" disabled={busyId === c.campaign_id} onClick={() => act(c, 'pause')} title="Pause"><Pause className="h-4 w-4" /></Button>
                        )}
                        {c.status !== 'sending' && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#ef4444]" disabled={busyId === c.campaign_id} onClick={() => act(c, 'delete')} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <NewCampaignDialog
          templates={templates} categories={categories} settings={settings}
          onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); reload(); }} onGoSetup={onGoSetup} {...shared}
        />
      )}
      {detailId && <CampaignDetailDialog campaignId={detailId} onClose={() => { setDetailId(null); reload(); }} onOpenChat={onOpenChat} {...shared} />}
    </div>
  );
}

function NewCampaignDialog({ templates, categories, settings, onClose, onCreated, onGoSetup, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const approved = useMemo(() => templates.filter((t) => t.status === 'APPROVED' && t.supported !== false), [templates]);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [variables, setVariables] = useState([]);
  const [catSearch, setCatSearch] = useState('');
  const [selectedCats, setSelectedCats] = useState([]);
  const [locationType, setLocationType] = useState('all');
  const [statuses, setStatuses] = useState(['To do', 'New Lead']);
  const [skipMessaged, setSkipMessaged] = useState(true);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const tpl = approved.find((t) => t.template_id === templateId);
  useEffect(() => {
    if (!tpl) { setVariables([]); return; }
    const map = tpl.variable_map || [];
    setVariables(Array.from({ length: tpl.variable_count || 0 }, (_, i) => ({ source: map[i] || (i === 0 ? 'name' : 'custom'), value: '', fallback: '' })));
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const categoryNames = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return categories
      .map((c) => c.name)
      .filter((n) => n && (!q || n.toLowerCase().includes(q)))
      .sort((a, b) => a.localeCompare(b));
  }, [categories, catSearch]);

  const audience = { category_names: selectedCats, location_type: locationType, statuses, skip_previously_messaged: skipMessaged, exclude_outreach_ids: [] };
  // Any change to the audience invalidates the last preview.
  useEffect(() => { setPreview(null); }, [selectedCats, locationType, statuses, skipMessaged]);

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const runPreview = async () => {
    setPreviewing(true);
    try {
      setPreview((await api.post('/bni/campaigns/audience/preview', audience)).data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to preview audience');
    } finally {
      setPreviewing(false);
    }
  };

  const create = async (sendNow) => {
    if (!name.trim()) { toast.error('Give the campaign a name'); return; }
    if (!tpl) { toast.error('Pick an approved template'); return; }
    if (variables.some((v) => v.source === 'custom' && !v.value.trim())) { toast.error('Fill in the custom text variables'); return; }
    if (sendNow && preview && !window.confirm(`Send to ${preview.eligible} member${preview.eligible === 1 ? '' : 's'} now?`)) return;
    setSaving(true);
    try {
      const res = await api.post('/bni/campaigns', { name, template_id: templateId, variables, audience, send_now: sendNow });
      toast.success(`${sendNow ? 'Sending' : 'Draft saved'} — ${res.data.recipient_count} members`);
      onCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  const sample = preview?.members?.[0];
  const overCap = preview && settings && preview.eligible > settings.daily_send_cap;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${bgCard} max-w-3xl max-h-[90vh] overflow-y-auto`}>
        <DialogHeader><DialogTitle className={textPrimary}>New WhatsApp Campaign</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div>
            <Label className={textPrimary}>Campaign name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nov — Construction categories intro" className={`${bgSecondary} border ${borderColor}`} autoFocus data-testid="bni-campaign-name" />
          </div>

          {/* 1. Message */}
          <section className="space-y-2">
            <p className={`font-semibold ${textPrimary}`}>1. Message</p>
            {approved.length === 0 ? (
              <div className={`text-sm ${textSecondary} rounded-lg border ${borderColor} p-3`}>
                No approved templates yet. WhatsApp only allows approved templates to start a conversation —{' '}
                <button type="button" className="text-[#6366f1] underline" onClick={() => { onClose(); onGoSetup(); }}>write one in Setup</button> and sync once Meta approves it.
              </div>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="bni-campaign-template"><SelectValue placeholder="Pick an approved template" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {approved.map((t) => <SelectItem key={t.template_id} value={t.template_id}>{t.name} ({t.language}) · {t.category}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {tpl && (
              <>
                {variables.map((v, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[70px_1fr_1fr] gap-2 items-center">
                    <span className={`text-sm font-mono ${textSecondary}`}>{`{{${i + 1}}}`}</span>
                    <Select value={v.source} onValueChange={(val) => setVariables(variables.map((x, j) => (j === i ? { ...x, source: val } : x)))}>
                      <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{VARIABLE_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {v.source === 'custom' ? (
                      <Input value={v.value} onChange={(e) => setVariables(variables.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="Text for everyone" className={`${bgSecondary} border ${borderColor}`} />
                    ) : (
                      <Input value={v.fallback} onChange={(e) => setVariables(variables.map((x, j) => (j === i ? { ...x, fallback: e.target.value } : x)))} placeholder='If blank, use… (default "there")' className={`${bgSecondary} border ${borderColor}`} />
                    )}
                  </div>
                ))}
                <div className={`rounded-lg p-3 text-sm whitespace-pre-wrap ${bgSecondary} ${textPrimary}`}>
                  <p className={`text-[11px] uppercase tracking-wide mb-1 ${textSecondary}`}>Preview{sample ? ` — ${sample.name}` : ''}</p>
                  {renderBody(tpl.body, sample ? valuesFor(sample, variables) : variables.map((v, i) => (v.source === 'custom' ? v.value || `{{${i + 1}}}` : `[${VARIABLE_SOURCES.find((s) => s.value === v.source)?.label}]`)))}
                  {tpl.footer && <p className={`text-xs mt-2 ${textSecondary}`}>{tpl.footer}</p>}
                  {(tpl.buttons || []).length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">{tpl.buttons.map((b) => <span key={b.text} className="text-xs rounded border border-[#3b82f6]/40 text-[#3b82f6] px-2 py-0.5">{b.text}</span>)}</div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* 2. Audience */}
          <section className="space-y-3">
            <p className={`font-semibold ${textPrimary}`}>2. Members</p>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <Label className={textPrimary}>Business categories {selectedCats.length ? `(${selectedCats.length} selected)` : '(none selected = all categories)'}</Label>
                {selectedCats.length > 0 && <button type="button" className="text-xs text-[#6366f1]" onClick={() => setSelectedCats([])}>Clear</button>}
              </div>
              <div className="relative mb-2">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
                <Input value={catSearch} onChange={(e) => setCatSearch(e.target.value)} placeholder="Search categories…" className={`pl-9 ${bgSecondary} border ${borderColor}`} />
              </div>
              <div className={`max-h-44 overflow-y-auto rounded-lg border ${borderColor} p-2 grid grid-cols-1 sm:grid-cols-2 gap-1`}>
                {categoryNames.map((n) => (
                  <label key={n} className={`flex items-center gap-2 text-sm ${textPrimary} cursor-pointer`}>
                    <input type="checkbox" className="accent-[#6366f1]" checked={selectedCats.includes(n)} onChange={() => toggle(selectedCats, setSelectedCats, n)} /> {n}
                  </label>
                ))}
                {categoryNames.length === 0 && <span className={`text-sm ${textSecondary}`}>No categories match.</span>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className={textPrimary}>Location</Label>
                <Select value={locationType} onValueChange={setLocationType}>
                  <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className={`flex items-center gap-2 text-sm ${textPrimary} sm:mt-6`}>
                <input type="checkbox" className="accent-[#6366f1]" checked={skipMessaged} onChange={(e) => setSkipMessaged(e.target.checked)} />
                Skip members already messaged by an earlier campaign
              </label>
            </div>
            <div>
              <Label className={textPrimary}>Outreach status {statuses.length ? '' : '(none selected = any status)'}</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {OUTREACH_STATUSES.map((s) => (
                  <button
                    key={s} type="button" onClick={() => toggle(statuses, setStatuses, s)}
                    className={`text-xs rounded-full px-3 py-1 border ${statuses.includes(s) ? 'bg-[#6366f1] text-white border-transparent' : `${borderColor} ${textSecondary}`}`}
                  >{s}</button>
                ))}
              </div>
            </div>
            <Button variant="outline" onClick={runPreview} disabled={previewing} data-testid="bni-campaign-preview">
              <Eye className="h-4 w-4 mr-2" /> {previewing ? 'Checking…' : 'Preview audience'}
            </Button>
            {preview && (
              <div className={`rounded-lg border ${borderColor} p-3 space-y-2 text-sm`}>
                <p className={textPrimary}><b className="text-lg">{preview.eligible}</b> members will receive this message.</p>
                <p className={`text-xs ${textSecondary}`}>
                  Skipped — no valid phone: {preview.skipped.no_phone} · already messaged: {preview.skipped.already_messaged} · opted out: {preview.skipped.opted_out} · duplicate phone: {preview.skipped.duplicate_phone}
                </p>
                {overCap && (
                  <p className="text-xs text-[#b45309]">
                    That's more than your daily cap of {settings.daily_send_cap}. The campaign will pause at the cap and you can resume it the next day.
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {preview.by_category.slice(0, 20).map((c) => (
                    <Badge key={c.category_name} className="bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/40">{c.category_name} · {c.count}</Badge>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" disabled={saving || !tpl} onClick={() => create(false)}>Save as Draft</Button>
          <Button className="bg-[#10b981] hover:bg-[#059669] text-white" disabled={saving || !tpl || !preview || preview.eligible === 0} onClick={() => create(true)} title={!preview ? 'Preview the audience first' : ''} data-testid="bni-campaign-send-now">
            <Send className="h-4 w-4 mr-2" /> {saving ? 'Creating…' : 'Create & Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Response status dropdown shared by the campaign detail and Responses lists.
// "Scheduled One to One" asks for the meeting date/time first, same as the
// Outreach tab, so the synced BNI One-to-One entry gets the real time.
function useResponseUpdater(onUpdated) {
  const [scheduleFor, setScheduleFor] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');

  const save = async (recipient, status, extra = {}) => {
    try {
      await api.put(`/bni/campaigns/recipients/${recipient.recipient_id}`, { response_status: status, ...extra });
      onUpdated(recipient.recipient_id, status);
      if (status === 'Scheduled One to One' || status === 'One to One Completed') toast.success('Updated — synced to BNI One-to-One');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update status');
    }
  };
  const change = (recipient, status) => {
    if (status === 'Scheduled One to One') {
      setScheduleFor(recipient);
      setDate(new Date().toISOString().slice(0, 10));
      return;
    }
    save(recipient, status);
  };
  const dialog = (theme) => (
    <Dialog open={!!scheduleFor} onOpenChange={(o) => !o && setScheduleFor(null)}>
      <DialogContent className={`${theme.bgCard} max-w-sm`}>
        <DialogHeader><DialogTitle className={theme.textPrimary}>Schedule One to One — {scheduleFor?.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className={theme.textPrimary}>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${theme.bgSecondary} border ${theme.borderColor}`} /></div>
          <div><Label className={theme.textPrimary}>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${theme.bgSecondary} border ${theme.borderColor}`} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setScheduleFor(null)}>Cancel</Button>
          <Button
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            onClick={async () => { if (!date || !time) { toast.error('Pick a date and time'); return; } await save(scheduleFor, 'Scheduled One to One', { meeting_date: date, meeting_time: time }); setScheduleFor(null); }}
          >Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { change, dialog };
}

function ResponseSelect({ value, onChange }) {
  return (
    <Select value={value || 'Pending'} onValueChange={onChange}>
      <SelectTrigger className={`w-[190px] h-8 text-xs border ${responseColor(value || 'Pending')}`}><SelectValue /></SelectTrigger>
      <SelectContent>{RESPONSE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function RecipientsTable({ rows, showCampaign, onChangeStatus, onOpenChat, emptyMsg, theme }) {
  const { bgSecondary, textPrimary, textSecondary, borderColor } = theme;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={bgSecondary}>
          <tr>
            {['Member', 'Category', ...(showCampaign ? ['Campaign'] : []), 'Sent', 'Reply', 'Response', ''].map((h) => (
              <th key={h} className={`px-3 py-2.5 text-left font-medium ${textSecondary} whitespace-nowrap`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className={`divide-y ${borderColor}`}>
          {rows.length === 0 ? (
            <tr><td colSpan={showCampaign ? 7 : 6} className={`px-4 py-8 text-center ${textSecondary}`}>{emptyMsg}</td></tr>
          ) : rows.map((r) => (
            <tr key={r.recipient_id}>
              <td className="px-3 py-2.5">
                <p className={`font-medium ${textPrimary}`}>{r.name}</p>
                <p className={`text-[11px] ${textSecondary}`}>{r.brand_name}{r.brand_name ? ' · ' : ''}+{r.wa_phone}</p>
              </td>
              <td className={`px-3 py-2.5 ${textSecondary}`}>{r.category_name}</td>
              {showCampaign && <td className={`px-3 py-2.5 ${textSecondary}`}>{r.campaign_name}</td>}
              <td className={`px-3 py-2.5 ${textSecondary} whitespace-nowrap`}>
                <span className="inline-flex items-center gap-1.5"><SendStatusIcon status={r.send_status} error={r.error} /> {fmtDateTime(r.sent_at)}</span>
                {r.send_status === 'failed' && <p className="text-[11px] text-[#ef4444] max-w-[220px]">{r.error}</p>}
              </td>
              <td className={`px-3 py-2.5 ${textSecondary} max-w-[320px]`}>
                {r.replied_at ? (
                  <>
                    <p className={`${textPrimary} line-clamp-2`}>{r.last_reply_text}</p>
                    <p className="text-[11px]">{fmtDateTime(r.last_reply_at)}{r.reply_count > 1 ? ` · ${r.reply_count} messages` : ''}</p>
                  </>
                ) : '—'}
              </td>
              <td className="px-3 py-2.5">
                {['queued', 'sending', 'failed'].includes(r.send_status)
                  ? <span className={`text-xs ${textSecondary}`}>—</span>
                  : <ResponseSelect value={r.response_status} onChange={(v) => onChangeStatus(r, v)} />}
              </td>
              <td className="px-3 py-2.5">
                {r.replied_at && (
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-[#10b981]" onClick={() => onOpenChat(r.wa_phone)} title="Open conversation">
                    <MessagesSquare className="h-4 w-4" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignDetailDialog({ campaignId, onClose, onOpenChat, ...theme }) {
  const { bgCard, bgSecondary, textPrimary, textSecondary, borderColor } = theme;
  const [camp, setCamp] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try { setCamp((await api.get(`/bni/campaigns/${campaignId}`)).data); } catch (e) { toast.error('Failed to load campaign'); }
  }, [campaignId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (camp?.status !== 'sending') return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [camp?.status, load]);

  const updater = useResponseUpdater((id, status) => setCamp((c) => ({ ...c, recipients: c.recipients.map((r) => (r.recipient_id === id ? { ...r, response_status: status } : r)) })));

  const rows = useMemo(() => (camp?.recipients || []).filter((r) => {
    if (filter === 'replied') return !!r.replied_at;
    if (filter === 'not_replied') return !r.replied_at && ['sent', 'delivered', 'read'].includes(r.send_status);
    if (filter === 'failed') return r.send_status === 'failed';
    if (filter === 'queued') return ['queued', 'sending'].includes(r.send_status);
    return true;
  }), [camp, filter]);

  const st = camp?.stats || {};
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${bgCard} max-w-6xl max-h-[90vh] overflow-y-auto`}>
        <DialogHeader><DialogTitle className={textPrimary}>{camp?.name || 'Campaign'}</DialogTitle></DialogHeader>
        {!camp ? <p className={textSecondary}>Loading…</p> : (
          <div className="space-y-4">
            <div className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${textSecondary}`}>
              <span>Template <b className={textPrimary}>{camp.template_name}</b></span>
              <span>Status <Badge className={`border ${campaignStatusColor(camp.status)}`}>{camp.status}</Badge></span>
              <span>Started {fmtDateTime(camp.started_at)}</span>
              {camp.completed_at && <span>Completed {fmtDateTime(camp.completed_at)}</span>}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
              {[['Total', st.total], ['Queued', st.queued], ...SUMMARY_CARDS.filter((c) => c.key !== 'not_interested').map((c) => [c.label, st[c.key]])].map(([l, v]) => (
                <div key={l} className={`rounded-lg border ${borderColor} p-2`}>
                  <p className={`text-[10px] ${textSecondary} leading-tight`}>{l}</p>
                  <p className={`text-lg font-bold ${textPrimary}`}>{v || 0}</p>
                </div>
              ))}
            </div>
            <div className={`rounded-lg p-3 text-sm whitespace-pre-wrap ${bgSecondary} ${textSecondary}`}>{camp.template_body}</div>
            <div className={`inline-flex flex-wrap rounded-lg border ${borderColor} p-1 ${bgSecondary}`}>
              {[['all', 'All'], ['replied', 'Replied'], ['not_replied', 'No reply'], ['failed', 'Failed'], ['queued', 'Queued']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setFilter(k)} className={`px-3 py-1 text-xs font-medium rounded-md ${filter === k ? 'bg-[#6366f1] text-white' : textSecondary}`}>{l}</button>
              ))}
            </div>
            <div className={`border ${borderColor} rounded-xl overflow-hidden`}>
              <RecipientsTable rows={rows} onChangeStatus={updater.change} onOpenChat={(p) => { onClose(); onOpenChat(p); }} emptyMsg="No members in this view." theme={theme} />
            </div>
          </div>
        )}
        {updater.dialog(theme)}
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ Responses

function ResponsesPanel({ campaigns, onOpenChat, ...theme }) {
  const { bgCard, bgSecondary, textPrimary, textSecondary, borderColor } = theme;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [campaignId, setCampaignId] = useState('all');
  const [category, setCategory] = useState('all');
  const [replied, setReplied] = useState('yes');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (campaignId !== 'all') params.campaign_id = campaignId;
      if (replied !== 'all') params.replied = replied;
      if (status !== 'all') params.response_status = status;
      setRows((await api.get('/bni/campaigns/responses', { params })).data || []);
    } catch (e) {
      toast.error('Failed to load responses');
    } finally {
      setLoading(false);
    }
  }, [campaignId, replied, status]);
  useEffect(() => { load(); }, [load]);

  const updater = useResponseUpdater((id, s) => setRows((prev) => prev.map((r) => (r.recipient_id === id ? { ...r, response_status: s } : r))));
  const categoriesInRows = useMemo(() => Array.from(new Set(rows.map((r) => r.category_name))).sort(), [rows]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (category === 'all' || r.category_name === category)
      && (!q || [r.name, r.brand_name, r.wa_phone, r.last_reply_text].some((v) => (v || '').toLowerCase().includes(q))));
  }, [rows, category, search]);

  const sel = (value, set, opts, w = 'w-[180px]') => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger className={`${w} ${bgSecondary} border ${borderColor} ${textPrimary}`}><SelectValue /></SelectTrigger>
      <SelectContent className="max-h-72">{opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search member, phone, message…" className={`pl-9 ${bgSecondary} border ${borderColor} ${textPrimary}`} />
        </div>
        {sel(replied, setReplied, [['yes', 'Replied'], ['no', 'Not replied'], ['all', 'Everyone messaged']], 'w-[170px]')}
        {sel(campaignId, setCampaignId, [['all', 'All Campaigns'], ...campaigns.map((c) => [c.campaign_id, c.name])], 'w-[200px]')}
        {sel(category, setCategory, [['all', 'All Categories'], ...categoriesInRows.map((c) => [c, c])], 'w-[200px]')}
        {sel(status, setStatus, [['all', 'Any response status'], ...RESPONSE_STATUSES.map((s) => [s, s])], 'w-[200px]')}
        <Badge className="bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/40">{visible.length} members</Badge>
      </div>
      <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
        <RecipientsTable rows={visible} showCampaign onChangeStatus={updater.change} onOpenChat={onOpenChat} emptyMsg={loading ? 'Loading…' : 'No members match.'} theme={theme} />
      </div>
      {updater.dialog(theme)}
    </div>
  );
}

// ------------------------------------------------------------------ Inbox

function InboxPanel({ initialPhone, onUnread, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(initialPhone || null);
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const endRef = useRef(null);

  const loadConvs = useCallback(async () => {
    try {
      const data = (await api.get('/bni/campaigns/inbox/conversations')).data || [];
      setConvs(data);
      onUnread(data.reduce((n, c) => n + (c.unread || 0), 0));
    } catch (e) { /* silent — retried by the poll */ }
  }, [onUnread]);
  const loadThread = useCallback(async (phone) => {
    try { setThread((await api.get(`/bni/campaigns/inbox/conversations/${phone}`)).data); } catch (e) { toast.error('Failed to load conversation'); }
  }, []);

  useEffect(() => { loadConvs(); const t = setInterval(loadConvs, 15000); return () => clearInterval(t); }, [loadConvs]);
  useEffect(() => {
    if (!active) return undefined;
    loadThread(active).then(loadConvs);
    const t = setInterval(() => loadThread(active), 10000);
    return () => clearInterval(t);
  }, [active, loadThread, loadConvs]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread?.messages?.length]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post(`/bni/campaigns/inbox/conversations/${active}/reply`, { text });
      setText('');
      loadThread(active);
      loadConvs();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const conv = convs.find((c) => c.wa_phone === active);
  const visibleConvs = convs.filter((c) => !search.trim() || `${c.name} ${c.wa_phone} ${c.brand_name}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-[320px_1fr] min-h-[560px]`}>
      <div className={`border-b md:border-b-0 md:border-r ${borderColor} flex flex-col`}>
        <div className="p-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" className={`${bgSecondary} border ${borderColor} ${textPrimary}`} />
        </div>
        <div className="overflow-y-auto max-h-[500px] md:max-h-none flex-1">
          {visibleConvs.length === 0 && <p className={`px-4 py-8 text-center text-sm ${textSecondary}`}>No conversations yet. Replies to your campaigns show up here.</p>}
          {visibleConvs.map((c) => (
            <button
              key={c.wa_phone} type="button" onClick={() => setActive(c.wa_phone)}
              className={`w-full text-left px-4 py-3 border-t ${borderColor} ${active === c.wa_phone ? bgSecondary : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`font-medium truncate ${textPrimary}`}>{c.name}</p>
                <span className={`text-[10px] shrink-0 ${textSecondary}`}>{fmtDateTime(c.last_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-xs truncate ${textSecondary}`}>{c.last_direction === 'out' ? 'You: ' : ''}{c.last_text}</p>
                {c.unread > 0 && <span className="rounded-full bg-[#10b981] text-white text-[10px] px-1.5 shrink-0">{c.unread}</span>}
              </div>
              {c.category_name && <p className="text-[10px] text-[#8b5cf6] truncate">{c.category_name}</p>}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        {!active ? (
          <div className={`flex-1 flex items-center justify-center text-sm ${textSecondary}`}>Pick a conversation</div>
        ) : (
          <>
            <div className={`px-4 py-3 border-b ${borderColor} flex items-center justify-between gap-2 flex-wrap`}>
              <div>
                <p className={`font-semibold ${textPrimary}`}>{conv?.name || `+${active}`}</p>
                <p className={`text-xs ${textSecondary}`}>+{active}{conv?.brand_name ? ` · ${conv.brand_name}` : ''}{conv?.outreach_status ? ` · Outreach: ${conv.outreach_status}` : ''}</p>
              </div>
              <a href={`https://wa.me/${active}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#10b981] inline-flex items-center gap-1 hover:underline">
                Open in WhatsApp <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[420px]">
              {(thread?.messages || []).map((m) => (
                <div key={m.message_id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.direction === 'out' ? 'bg-[#6366f1] text-white' : `${bgSecondary} ${textPrimary}`}`}>
                    {m.text}
                    <p className={`text-[10px] mt-1 flex items-center gap-1 ${m.direction === 'out' ? 'text-white/70 justify-end' : textSecondary}`}>
                      {fmtDateTime(m.timestamp)}
                      {m.direction === 'out' && (m.status === 'read' ? <CheckCheck className="h-3 w-3" /> : m.status === 'delivered' ? <CheckCheck className="h-3 w-3 opacity-60" /> : m.status === 'failed' ? <AlertCircle className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className={`p-3 border-t ${borderColor}`}>
              {thread && !thread.window_open ? (
                <p className={`text-xs ${textSecondary}`}>
                  The 24-hour reply window is closed — WhatsApp only allows an approved template now. Continue in the WhatsApp Business app, or include this member in a new campaign.
                </p>
              ) : (
                <div className="flex gap-2">
                  <Textarea
                    value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Type a reply…"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                  />
                  <Button onClick={send} disabled={sending || !text.trim()} className="bg-[#10b981] hover:bg-[#059669] text-white self-end"><Send className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Setup

function SetupPanel({ settings, templates, reloadSettings, reloadTemplates, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [showGuide, setShowGuide] = useState(!settings?.configured);
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      access_token: '', app_secret: '',
      phone_number_id: settings.phone_number_id, waba_id: settings.waba_id, verify_token: settings.verify_token,
      api_version: settings.api_version, local_country_code: settings.local_country_code,
      international_country_code: settings.international_country_code, daily_send_cap: settings.daily_send_cap,
    });
  }, [settings]);

  if (!form) return <p className={textSecondary}>Loading…</p>;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/bni/campaigns/settings', { ...form, daily_send_cap: Number(form.daily_send_cap) || 250 });
      toast.success('WhatsApp settings saved');
      reloadSettings();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };
  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult((await api.post('/bni/campaigns/settings/test')).data);
      toast.success('Connected to WhatsApp');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };
  const sync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/bni/campaigns/templates/sync');
      toast.success(`Synced ${res.data.total} templates · ${res.data.approved} approved`);
      reloadTemplates();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to sync templates');
    } finally {
      setSyncing(false);
    }
  };
  const copy = async (v) => { try { await navigator.clipboard.writeText(v); toast.success('Copied'); } catch (e) { toast.error('Copy failed'); } };
  const verifyToken = form.verify_token;

  const field = (label, key, props = {}) => (
    <div>
      <Label className={textPrimary}>{label}</Label>
      <Input value={form[key]} onChange={set(key)} className={`${bgSecondary} border ${borderColor} ${textPrimary}`} {...props} />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Setup guide */}
      <div className={`${bgCard} border ${borderColor} rounded-xl`}>
        <button type="button" onClick={() => setShowGuide(!showGuide)} className={`w-full px-4 py-3 flex items-center justify-between font-semibold ${textPrimary}`}>
          <span>Meta WhatsApp Cloud API — setup guide</span>
          {showGuide ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {showGuide && (
          <ol className={`px-6 pb-4 space-y-3 text-sm list-decimal ${textSecondary}`}>
            <li>
              <b className={textPrimary}>Get a dedicated number.</b> Use a number that is <i>not</i> active on the regular WhatsApp or WhatsApp Business app (or delete that account first) — a number can live on the Cloud API or the app, not both. It must be able to receive an SMS or voice call for verification.
            </li>
            <li>
              <b className={textPrimary}>Meta Business portfolio.</b> At <a className="text-[#6366f1] underline" href="https://business.facebook.com" target="_blank" rel="noopener noreferrer">business.facebook.com</a> create (or open) your business portfolio and complete <i>Business verification</i> under Security Center. Unverified businesses are limited to 250 business-initiated chats per 24 hours.
            </li>
            <li>
              <b className={textPrimary}>Create the app.</b> At <a className="text-[#6366f1] underline" href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">developers.facebook.com/apps</a> → Create app → use case <i>Other</i> → type <i>Business</i> → link it to your portfolio. In the app dashboard, add the <i>WhatsApp</i> product.
            </li>
            <li>
              <b className={textPrimary}>Add your number.</b> WhatsApp → API Setup → <i>Add phone number</i>. Enter the display name (must match your business name) and verify by SMS. Copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID</b> shown there into the fields below. Add a payment method in WhatsApp Manager → Payment settings (marketing templates are billed per message).
            </li>
            <li>
              <b className={textPrimary}>Permanent access token.</b> The token on the API Setup page expires in 24 hours — don't use it. Instead: Business Settings → Users → <i>System users</i> → Add (role Admin) → <i>Assign assets</i>: your app (Full control) and your WhatsApp account (Full control) → <i>Generate new token</i> for your app with expiry <i>Never</i> and permissions <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>. Paste it into Access token below.
            </li>
            <li>
              <b className={textPrimary}>App secret.</b> App settings → Basic → App secret → Show. Paste it below — the OS uses it to verify that webhook calls really come from Meta.
            </li>
            <li>
              <b className={textPrimary}>Save, then Test connection.</b> You should see your number, verified name and quality rating.
            </li>
            <li>
              <b className={textPrimary}>Webhook (for delivery ticks and replies).</b> In the app: WhatsApp → Configuration → Webhook → Edit. Callback URL:
              <span className={`ml-1 inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs ${bgSecondary} ${textPrimary}`}>
                {webhookUrl()}
                <button type="button" onClick={() => copy(webhookUrl())}><Copy className="h-3 w-3" /></button>
              </span>
              <br />Verify token: the value in <i>Webhook verify token</i> below{verifyToken ? <> (<span className="font-mono">{verifyToken}</span>)</> : ' — set and save one first'}. Click <i>Verify and save</i>, then under Webhook fields <b>Subscribe</b> to <code>messages</code>. Finally publish the app (App Mode: <i>Live</i>) — in Development mode Meta only delivers webhooks for test numbers.
            </li>
            <li>
              <b className={textPrimary}>Templates.</b> WhatsApp lets a business start a chat only with an approved template. Write one with <i>New Template</i> below (use {'{{name}}'}, {'{{company}}'}, {'{{category}}'} to personalise), wait for approval (usually minutes, up to 24h), then <i>Sync templates</i>. Adding quick-reply buttons such as “Interested” / “Not now” lets the OS mark responses automatically.
            </li>
            <li>
              <b className={textPrimary}>Send gently.</b> New numbers start at 250 business-initiated conversations / day; Meta raises the tier as quality stays high. Keep the daily cap at or below your tier, message only relevant categories, and honour “STOP” replies (the OS opts those members out automatically). Many blocks or reports will lower the number's quality rating and can restrict it.
            </li>
          </ol>
        )}
      </div>

      {/* Credentials */}
      <div className={`${bgCard} border ${borderColor} rounded-xl p-4 space-y-3`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className={`font-semibold ${textPrimary}`}>Connection</p>
          <Badge className={`border ${settings.configured ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/40' : 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/40'}`}>
            {settings.configured ? 'Credentials saved' : 'Not connected'}
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {field('Phone number ID *', 'phone_number_id', { placeholder: 'e.g. 123456789012345' })}
          {field('WhatsApp Business Account ID *', 'waba_id', { placeholder: 'e.g. 109876543210987' })}
          {field(`Access token *${settings.access_token_masked ? ` (saved: ${settings.access_token_masked})` : ''}`, 'access_token', { type: 'password', placeholder: settings.access_token_masked ? 'Leave blank to keep the saved token' : 'Permanent system-user token' })}
          {field(`App secret${settings.app_secret_set ? ' (saved)' : ''}`, 'app_secret', { type: 'password', placeholder: settings.app_secret_set ? 'Leave blank to keep the saved secret' : 'From App settings → Basic' })}
          {field('Webhook verify token', 'verify_token', { placeholder: 'Any random phrase — paste the same into Meta' })}
          {field('Graph API version', 'api_version')}
          {field('Country code for Local numbers', 'local_country_code', { placeholder: '91' })}
          {field('Country code for International numbers', 'international_country_code', { placeholder: '971' })}
          {field('Daily send cap', 'daily_send_cap', { type: 'number', min: 1 })}
        </div>
        <p className={`text-xs ${textSecondary}`}>Country codes are added to numbers saved without one (e.g. “055 840 8421” → 971558408421). Numbers that start with + or a country code are used as-is.</p>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={save} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white" data-testid="bni-wa-settings-save">{saving ? 'Saving…' : 'Save'}</Button>
          <Button variant="outline" onClick={test} disabled={testing || !settings.configured}>{testing ? 'Testing…' : 'Test connection'}</Button>
        </div>
        {testResult && (
          <div className={`text-sm rounded-lg p-3 ${bgSecondary} ${textPrimary}`}>
            {testResult.display_phone_number} · {testResult.verified_name} · Quality: <b>{testResult.quality_rating || '—'}</b>
            {testResult.messaging_limit_tier && <> · Tier: <b>{testResult.messaging_limit_tier}</b></>}
          </div>
        )}
      </div>

      {/* Templates */}
      <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
        <div className={`px-4 py-3 border-b ${borderColor} flex items-center justify-between gap-2 flex-wrap`}>
          <p className={`font-semibold ${textPrimary}`}>Message templates</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={sync} disabled={syncing || !settings.configured}>
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sync templates
            </Button>
            <Button size="sm" onClick={() => setShowNewTemplate(true)} disabled={!settings.configured} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white">
              <Plus className="h-4 w-4 mr-1" /> New Template
            </Button>
          </div>
        </div>
        <div className={`divide-y ${borderColor}`}>
          {templates.length === 0 && <p className={`px-4 py-8 text-center text-sm ${textSecondary}`}>No templates yet — write one or sync from Meta.</p>}
          {templates.map((t) => (
            <div key={`${t.name}-${t.language}`} className="px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-medium ${textPrimary}`}>{t.name}</p>
                <span className={`text-xs ${textSecondary}`}>{t.language} · {t.category}</span>
                <Badge className={`border ${templateStatusColor(t.status)}`}>{t.status}</Badge>
                {t.supported === false && <Badge className="border bg-[#71717a]/15 text-[#71717a] border-[#71717a]/40" title={t.unsupported_reason}>Can't use in campaigns</Badge>}
              </div>
              <p className={`text-sm whitespace-pre-wrap ${textSecondary}`}>{t.body}</p>
              {t.rejected_reason && t.rejected_reason !== 'NONE' && <p className="text-xs text-[#ef4444]">Rejected: {t.rejected_reason}</p>}
              {t.unsupported_reason && <p className={`text-xs ${textSecondary}`}>{t.unsupported_reason}</p>}
            </div>
          ))}
        </div>
      </div>

      {showNewTemplate && (
        <NewTemplateDialog
          onClose={() => setShowNewTemplate(false)}
          onCreated={() => { setShowNewTemplate(false); reloadTemplates(); }}
          bgCard={bgCard} bgSecondary={bgSecondary} textPrimary={textPrimary} textSecondary={textSecondary} borderColor={borderColor}
        />
      )}
    </div>
  );
}

const SAMPLE = { name: 'Hitesh', company: 'Hitesh Electrical', category: 'Electrical Contractor', chapter: 'Gazelles', location: 'Dubai' };

function NewTemplateDialog({ onClose, onCreated, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [form, setForm] = useState({
    name: 'bni_one_to_one_intro',
    language: 'en',
    category: 'MARKETING',
    body: 'Hi {{name}}, this is Vinoth from Drawlead (BNI). I came across {{company}} in the {{category}} category and would love to understand your business better.\n\nWould you be open to a quick 1-to-1 meeting this week?',
    footer: 'Reply STOP to opt out',
    quick_replies: 'Interested, Not now',
  });
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);

  const insertToken = (tok) => {
    const el = bodyRef.current;
    const ins = `{{${tok}}}`;
    if (!el) { setForm({ ...form, body: form.body + ins }); return; }
    const { selectionStart: a, selectionEnd: b } = el;
    setForm({ ...form, body: form.body.slice(0, a) + ins + form.body.slice(b) });
  };
  const preview = form.body.replace(/\{\{\s*([a-z_ ]+)\s*\}\}/gi, (m, t) => SAMPLE[t.trim().toLowerCase()] ?? m);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/bni/campaigns/templates', {
        ...form,
        quick_replies: form.quick_replies.split(',').map((s) => s.trim()).filter(Boolean),
      });
      toast.success('Submitted to Meta for approval — sync templates in a few minutes');
      onCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Meta rejected the template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${bgCard} max-w-2xl max-h-[90vh] overflow-y-auto`}>
        <DialogHeader><DialogTitle className={textPrimary}>New WhatsApp Template</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Label className={textPrimary}>Template name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} className={`${bgSecondary} border ${borderColor}`} />
            </div>
            <div>
              <Label className={textPrimary}>Language</Label>
              <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[['en', 'English'], ['en_US', 'English (US)'], ['en_GB', 'English (UK)'], ['ta', 'Tamil'], ['hi', 'Hindi'], ['ar', 'Arabic']].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={textPrimary}>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MARKETING">Marketing</SelectItem><SelectItem value="UTILITY">Utility</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className={textPrimary}>Message</Label>
              <div className="flex gap-1 flex-wrap">
                {TEMPLATE_TOKENS.map((t) => (
                  <button key={t} type="button" onClick={() => insertToken(t)} className="text-[11px] rounded border border-[#6366f1]/40 text-[#6366f1] px-1.5 py-0.5">{`{{${t}}}`}</button>
                ))}
              </div>
            </div>
            <Textarea ref={bodyRef} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} className={`${bgSecondary} border ${borderColor} ${textPrimary}`} />
            <p className={`text-[11px] mt-1 ${textSecondary}`}>Don't start or end the message with a token. Intro messages to BNI members are normally approved as Marketing.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className={textPrimary}>Footer (optional)</Label>
              <Input value={form.footer} onChange={(e) => setForm({ ...form, footer: e.target.value })} maxLength={60} className={`${bgSecondary} border ${borderColor}`} />
            </div>
            <div>
              <Label className={textPrimary}>Quick-reply buttons (comma separated, max 3)</Label>
              <Input value={form.quick_replies} onChange={(e) => setForm({ ...form, quick_replies: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
            </div>
          </div>
          <div className={`rounded-lg p-3 text-sm whitespace-pre-wrap ${bgSecondary} ${textPrimary}`}>
            <p className={`text-[11px] uppercase tracking-wide mb-1 ${textSecondary}`}>Preview</p>
            {preview}
            {form.footer && <p className={`text-xs mt-2 ${textSecondary}`}>{form.footer}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white">{saving ? 'Submitting…' : 'Submit for approval'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BNICampaignsTab;
