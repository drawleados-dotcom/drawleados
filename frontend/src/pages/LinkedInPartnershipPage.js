import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, LayoutDashboard, Users, Kanban, Sparkles, MessageSquareText, MessagesSquare,
  Workflow, ListTodo, Plug, Settings, ScrollText, Plus, ExternalLink, Copy, Trash2, Pencil,
  Wand2, Linkedin, Loader2,
} from 'lucide-react';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, live: true },
  { key: 'partners', label: 'Partners', icon: Users, live: true },
  { key: 'pipeline', label: 'Pipeline', icon: Kanban, live: true },
  { key: 'analyzer', label: 'AI Profile Analyzer', icon: Sparkles, live: true },
  { key: 'message_generator', label: 'Message Generator', icon: MessageSquareText, live: true },
  { key: 'conversation', label: 'Conversation Assistant', icon: MessagesSquare, live: false },
  { key: 'workflow', label: 'Workflow', icon: Workflow, live: false },
  { key: 'queue', label: 'Automation Queue', icon: ListTodo, live: false },
  { key: 'integrations', label: 'Integrations', icon: Plug, live: false },
  { key: 'ai_settings', label: 'AI Settings', icon: Settings, live: false },
  { key: 'logs', label: 'Logs', icon: ScrollText, live: false },
];

const STAGE_COLORS = [
  '#71717a', '#8b5cf6', '#3b82f6', '#f59e0b', '#22c55e', '#14b8a6',
  '#ec4899', '#f97316', '#6366f1', '#a855f7', '#10b981', '#ef4444',
];

const MESSAGE_BUTTONS = [
  { key: 'connection_request', label: 'Generate Connection Request' },
  { key: 'intro', label: 'Generate Intro Message' },
  { key: 'follow_up', label: 'Generate Follow-up' },
  { key: 'meeting_request', label: 'Generate Meeting Request' },
  { key: 'thank_you', label: 'Generate Thank You' },
];

const EMPTY_FORM = {
  name: '', company: '', country: '', industry: '', linkedin_url: '',
  agency_type: '', status: 'New', assigned_to: '', next_action: '', notes: '', deal_value: '',
};

// ============== KANBAN ==============

const PartnerCard = ({ partner, color, onOpen }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'PARTNER',
    item: { partner },
    collect: (m) => ({ isDragging: m.isDragging() }),
  }));
  return (
    <div
      ref={drag}
      onClick={() => onOpen(partner)}
      className={`bg-[#09090b] border border-[#27272a] rounded-lg p-3 cursor-move hover:border-[#6366f1]/40 transition-all ${isDragging ? 'opacity-40' : ''}`}
      data-testid={`kanban-partner-${partner.partner_id}`}
    >
      <p className="text-sm font-medium text-[#fafafa]">{partner.name}</p>
      {partner.company && <p className="text-xs text-[#a1a1aa] mt-0.5">{partner.company}</p>}
      {partner.agency_type && (
        <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: color, color }}>
          {partner.agency_type}
        </span>
      )}
    </div>
  );
};

const StageColumn = ({ stage, color, partners, onDrop, onOpen }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'PARTNER',
    drop: (item) => onDrop(item.partner, stage),
    collect: (m) => ({ isOver: m.isOver() }),
  }));
  return (
    <div
      ref={drop}
      className={`bg-[#18181b] border border-[#27272a] rounded-xl p-3 min-h-[420px] w-[260px] shrink-0 transition-all ${isOver ? 'border-[#6366f1] bg-[#6366f1]/5' : ''}`}
      data-testid={`kanban-column-${stage}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <h3 className="text-xs font-semibold text-[#fafafa] truncate">{stage}</h3>
        <span className="ml-auto text-[10px] text-[#a1a1aa] bg-[#27272a] px-1.5 py-0.5 rounded-full">{partners.length}</span>
      </div>
      <div className="space-y-2">
        {partners.map((p) => <PartnerCard key={p.partner_id} partner={p} color={color} onOpen={onOpen} />)}
      </div>
    </div>
  );
};

// ============== MAIN PAGE ==============

const LinkedInPartnershipPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [stages, setStages] = useState([]);
  const [agencyTypes, setAgencyTypes] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);

  const stageColor = (stage) => STAGE_COLORS[stages.indexOf(stage) % STAGE_COLORS.length] || '#71717a';

  const loadAll = useCallback(async () => {
    try {
      const [pRes, sRes, aRes, dRes] = await Promise.all([
        api.get('/automation/linkedin-partnership/partners'),
        api.get('/automation/linkedin-partnership/stages'),
        api.get('/automation/linkedin-partnership/agency-types'),
        api.get('/automation/linkedin-partnership/dashboard'),
      ]);
      setPartners(pRes.data || []);
      setStages(sRes.data || []);
      setAgencyTypes(aRes.data || []);
      setDashboardStats(dRes.data || null);
    } catch (e) {
      toast.error('Failed to load LinkedIn Partnership data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ---------- Partner CRUD ----------
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState(null);
  const [partnerForm, setPartnerForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openNewPartner = () => { setEditingPartnerId(null); setPartnerForm(EMPTY_FORM); setShowPartnerModal(true); };
  const openEditPartner = (p) => {
    setEditingPartnerId(p.partner_id);
    setPartnerForm({
      name: p.name || '', company: p.company || '', country: p.country || '', industry: p.industry || '',
      linkedin_url: p.linkedin_url || '', agency_type: p.agency_type || '', status: p.status || 'New',
      assigned_to: p.assigned_to || '', next_action: p.next_action || '', notes: p.notes || '',
      deal_value: p.deal_value || '',
    });
    setShowPartnerModal(true);
  };

  const savePartner = async () => {
    if (!partnerForm.name.trim()) { toast.error('Partner name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...partnerForm, deal_value: Number(partnerForm.deal_value) || 0 };
      if (editingPartnerId) {
        await api.put(`/automation/linkedin-partnership/partners/${editingPartnerId}`, payload);
        toast.success('Partner updated');
      } else {
        await api.post('/automation/linkedin-partnership/partners', payload);
        toast.success('Partner added');
      }
      setShowPartnerModal(false);
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save partner');
    } finally {
      setSaving(false);
    }
  };

  const deletePartner = async (partnerId) => {
    if (!window.confirm('Remove this partner?')) return;
    try {
      await api.delete(`/automation/linkedin-partnership/partners/${partnerId}`);
      toast.success('Partner removed');
      loadAll();
    } catch (e) {
      toast.error('Failed to remove partner');
    }
  };

  const changeStage = async (partner, newStage) => {
    if (partner.status === newStage) return;
    try {
      await api.put(`/automation/linkedin-partnership/partners/${partner.partner_id}`, { status: newStage });
      toast.success(`Moved to ${newStage}`);
      loadAll();
    } catch (e) {
      toast.error('Failed to update stage');
    }
  };

  const openLinkedIn = (partner) => {
    if (!partner.linkedin_url) { toast.error('No LinkedIn URL on this partner'); return; }
    const lastMsg = (partner.generated_messages || [])[partner.generated_messages.length - 1];
    if (lastMsg) {
      navigator.clipboard?.writeText(lastMsg.text).catch(() => {});
      toast.success('Latest AI message copied — paste it on LinkedIn');
    }
    window.open(partner.linkedin_url, '_blank', 'noopener,noreferrer');
  };

  // ---------- AI Profile Analyzer ----------
  const [analyzerPartnerId, setAnalyzerPartnerId] = useState('');
  const [profileText, setProfileText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const analyzerPartner = partners.find(p => p.partner_id === analyzerPartnerId);

  const runAnalysis = async () => {
    if (!analyzerPartnerId) { toast.error('Select a partner first'); return; }
    if (!profileText.trim()) { toast.error('Paste the LinkedIn profile text to analyze'); return; }
    setAnalyzing(true);
    try {
      await api.post(`/automation/linkedin-partnership/partners/${analyzerPartnerId}/analyze`, { profile_text: profileText });
      toast.success('Profile analyzed and saved');
      setProfileText('');
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  // ---------- Message Generator ----------
  const [msgPartnerId, setMsgPartnerId] = useState('');
  const [extraContext, setExtraContext] = useState('');
  const [generatingType, setGeneratingType] = useState(null);
  const msgPartner = partners.find(p => p.partner_id === msgPartnerId);

  const runGenerate = async (messageType) => {
    if (!msgPartnerId) { toast.error('Select a partner first'); return; }
    setGeneratingType(messageType);
    try {
      await api.post(`/automation/linkedin-partnership/partners/${msgPartnerId}/generate-message`, {
        message_type: messageType, extra_context: extraContext,
      });
      toast.success('Message generated');
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Message generation failed');
    } finally {
      setGeneratingType(null);
    }
  };

  const jumpToAnalyze = (partner) => { setAnalyzerPartnerId(partner.partner_id); setActiveTab('analyzer'); };
  const jumpToMessage = (partner) => { setMsgPartnerId(partner.partner_id); setActiveTab('message_generator'); };

  if (loading) {
    return <Layout><div className="p-6 flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="p-6" data-testid="linkedin-partnership-page">
        <button onClick={() => navigate('/automation')} className={`text-sm ${textSecondary} hover:underline mb-3 inline-flex items-center gap-1`}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Automation
        </button>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-[#0a66c2]/20">
            <Linkedin className="h-6 w-6 text-[#0a66c2]" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${textPrimary}`}>LinkedIn Partnership</h1>
            <p className={`text-sm ${textSecondary}`}>Relationship-first partnerships with agencies, consultants, and founders — never generic sales messages.</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                data-testid={`linkedin-tab-${t.key}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  active ? 'bg-[#6366f1] border-[#6366f1] text-white'
                  : `${bgSecondary} ${borderColor} ${textSecondary} hover:${textPrimary}`
                } ${!t.live ? 'opacity-70' : ''}`}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* ============== DASHBOARD ============== */}
        {activeTab === 'dashboard' && dashboardStats && (
          <div className="space-y-5" data-testid="linkedin-dashboard-tab">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: 'Total Partners', value: dashboardStats.total_partners, color: '#6366f1' },
                { label: 'New Leads', value: dashboardStats.new_leads, color: '#3b82f6' },
                { label: 'Invitations Sent', value: dashboardStats.invitations_sent, color: '#f59e0b' },
                { label: 'Accepted', value: dashboardStats.accepted, color: '#22c55e' },
                { label: 'Reply Rate', value: `${dashboardStats.reply_rate}%`, color: '#14b8a6' },
                { label: 'Interested', value: dashboardStats.interested, color: '#ec4899' },
                { label: 'Calls Booked', value: dashboardStats.calls_booked, color: '#8b5cf6' },
                { label: 'Partners Won', value: dashboardStats.partners_won, color: '#10b981' },
                { label: 'Revenue Generated', value: `₹${(dashboardStats.revenue_generated || 0).toLocaleString()}`, color: '#f97316' },
              ].map((c) => (
                <div key={c.label} className={`p-3 rounded-lg border ${borderColor} ${bgCard}`} style={{ borderLeft: `3px solid ${c.color}` }}>
                  <p className={`text-[10px] uppercase tracking-wide ${textSecondary}`}>{c.label}</p>
                  <p className="text-lg font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
                </div>
              ))}
            </div>

            <div className={`p-4 rounded-lg border ${borderColor} ${bgCard}`}>
              <h3 className={`text-sm font-semibold ${textPrimary} mb-3`}>Pipeline Chart</h3>
              <div className="space-y-2">
                {stages.map((s) => {
                  const count = dashboardStats.by_stage?.[s] || 0;
                  const max = Math.max(1, ...Object.values(dashboardStats.by_stage || {}));
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className={`text-xs w-32 shrink-0 truncate ${textSecondary}`}>{s}</span>
                      <div className={`flex-1 h-4 rounded ${bgSecondary} overflow-hidden`}>
                        <div className="h-full rounded" style={{ width: `${(count / max) * 100}%`, backgroundColor: stageColor(s) }} />
                      </div>
                      <span className={`text-xs w-6 text-right ${textPrimary}`}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${borderColor} ${bgCard} flex items-center gap-3`}>
              <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
              <div>
                <p className={`text-sm font-medium ${textPrimary}`}>Automation Status: AI-Assisted (Manual Send)</p>
                <p className={`text-xs ${textSecondary}`}>AI drafts every message; a human reviews and sends it on LinkedIn. No bot logs into LinkedIn or clicks anything.</p>
              </div>
            </div>
          </div>
        )}

        {/* ============== PARTNERS ============== */}
        {activeTab === 'partners' && (
          <div data-testid="linkedin-partners-tab">
            <div className="flex justify-end mb-3">
              <Button onClick={openNewPartner} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="new-partner-btn">
                <Plus className="h-4 w-4 mr-2" /> New Partner
              </Button>
            </div>
            <div className={`rounded-lg border ${borderColor} ${bgCard} overflow-x-auto`}>
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${borderColor}`}>
                    {['Partner', 'Company', 'Country', 'Industry', 'Agency Type', 'Status', 'Assigned To', 'Next Action', 'Actions'].map(h => (
                      <th key={h} className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase whitespace-nowrap`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => (
                    <tr key={p.partner_id} className={`border-b ${borderColor}`} data-testid={`partner-row-${p.partner_id}`}>
                      <td className={`p-3 text-sm font-medium ${textPrimary}`}>{p.name}</td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{p.company || '—'}</td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{p.country || '—'}</td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{p.industry || '—'}</td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{p.agency_type || '—'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium border" style={{ borderColor: stageColor(p.status), color: stageColor(p.status) }}>
                          {p.status}
                        </span>
                      </td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{p.assigned_to || '—'}</td>
                      <td className={`p-3 text-xs ${textSecondary} max-w-[160px] truncate`}>{p.next_action || '—'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button title="Analyze" onClick={() => jumpToAnalyze(p)} className={`p-1.5 rounded ${bgSecondary} hover:opacity-80`} data-testid={`partner-analyze-${p.partner_id}`}>
                            <Sparkles className="h-3.5 w-3.5 text-[#8b5cf6]" />
                          </button>
                          <button title="Generate Message" onClick={() => jumpToMessage(p)} className={`p-1.5 rounded ${bgSecondary} hover:opacity-80`} data-testid={`partner-message-${p.partner_id}`}>
                            <MessageSquareText className="h-3.5 w-3.5 text-[#3b82f6]" />
                          </button>
                          <button title="Open LinkedIn" onClick={() => openLinkedIn(p)} className={`p-1.5 rounded ${bgSecondary} hover:opacity-80`} data-testid={`partner-linkedin-${p.partner_id}`}>
                            <ExternalLink className="h-3.5 w-3.5 text-[#0a66c2]" />
                          </button>
                          <button title="Edit" onClick={() => openEditPartner(p)} className={`p-1.5 rounded ${bgSecondary} hover:opacity-80`} data-testid={`partner-edit-${p.partner_id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button title="Delete" onClick={() => deletePartner(p.partner_id)} className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20" data-testid={`partner-delete-${p.partner_id}`}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {partners.length === 0 && (
                    <tr><td colSpan={9} className={`p-8 text-center text-xs ${textSecondary}`}>No partners yet. Click "New Partner" to add one.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============== PIPELINE (KANBAN) ============== */}
        {activeTab === 'pipeline' && (
          <DndProvider backend={HTML5Backend}>
            <div className="flex gap-3 overflow-x-auto pb-3" data-testid="linkedin-pipeline-tab">
              {stages.map((s) => (
                <StageColumn
                  key={s}
                  stage={s}
                  color={stageColor(s)}
                  partners={partners.filter(p => p.status === s)}
                  onDrop={(partner, newStage) => changeStage(partner, newStage)}
                  onOpen={openEditPartner}
                />
              ))}
            </div>
          </DndProvider>
        )}

        {/* ============== AI PROFILE ANALYZER ============== */}
        {activeTab === 'analyzer' && (
          <div className={`max-w-2xl space-y-4 p-4 rounded-lg border ${borderColor} ${bgCard}`} data-testid="linkedin-analyzer-tab">
            <div>
              <Label className={textPrimary}>Partner</Label>
              <Select value={analyzerPartnerId} onValueChange={setAnalyzerPartnerId}>
                <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="analyzer-partner-select">
                  <SelectValue placeholder="Select a partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(p => <SelectItem key={p.partner_id} value={p.partner_id}>{p.name}{p.company ? ` — ${p.company}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={textPrimary}>LinkedIn Profile Text</Label>
              <Textarea
                value={profileText}
                onChange={(e) => setProfileText(e.target.value)}
                placeholder="Paste their headline, About section, and experience from LinkedIn…"
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                rows={8}
                data-testid="analyzer-profile-text"
              />
            </div>
            <Button onClick={runAnalysis} disabled={analyzing} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="analyzer-run-btn">
              {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              {analyzing ? 'Analyzing…' : 'Analyze using AI'}
            </Button>

            {analyzerPartner?.analyzed_at && (
              <div className={`mt-4 pt-4 border-t ${borderColor} space-y-2`} data-testid="analyzer-result">
                <p className="text-xs text-emerald-500 font-medium">✓ Saved to partner record</p>
                {[
                  ['Headline', analyzerPartner.headline], ['Company', analyzerPartner.company],
                  ['About', analyzerPartner.about], ['Industry', analyzerPartner.industry],
                  ['Location', analyzerPartner.location], ['Website', analyzerPartner.website],
                  ['Agency Type', analyzerPartner.agency_type], ['Business Summary', analyzerPartner.business_summary],
                  ['Target Customers', (analyzerPartner.target_customers || []).join(', ')],
                  ['Pain Points', (analyzerPartner.pain_points || []).join(', ')],
                  ['Ideal Partnership Angle', analyzerPartner.ideal_partnership_angle],
                  ['Ice Breakers', (analyzerPartner.ice_breakers || []).join(' | ')],
                  ['Suggested Opening', analyzerPartner.suggested_opening],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label}>
                    <p className={`text-[10px] uppercase tracking-wide ${textSecondary}`}>{label}</p>
                    <p className={`text-sm ${textPrimary}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============== MESSAGE GENERATOR ============== */}
        {activeTab === 'message_generator' && (
          <div className={`max-w-2xl space-y-4 p-4 rounded-lg border ${borderColor} ${bgCard}`} data-testid="linkedin-message-tab">
            <div>
              <Label className={textPrimary}>Partner</Label>
              <Select value={msgPartnerId} onValueChange={setMsgPartnerId}>
                <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid="message-partner-select">
                  <SelectValue placeholder="Select a partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(p => <SelectItem key={p.partner_id} value={p.partner_id}>{p.name}{p.company ? ` — ${p.company}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={textPrimary}>Extra Context (optional — e.g. their reply)</Label>
              <Textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder="Paste their reply or any relevant conversation context…"
                className={`${bgSecondary} border ${borderColor} ${textPrimary}`}
                rows={3}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {MESSAGE_BUTTONS.map((b) => (
                <Button
                  key={b.key}
                  variant="outline"
                  onClick={() => runGenerate(b.key)}
                  disabled={generatingType !== null}
                  className={`${borderColor} ${textPrimary}`}
                  data-testid={`generate-${b.key}-btn`}
                >
                  {generatingType === b.key ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
                  {b.label}
                </Button>
              ))}
            </div>

            {msgPartner && (msgPartner.generated_messages || []).length > 0 && (
              <div className={`mt-2 pt-4 border-t ${borderColor} space-y-2`} data-testid="message-history">
                <p className={`text-xs font-medium ${textPrimary}`}>Generated Messages</p>
                {[...msgPartner.generated_messages].reverse().map((m) => (
                  <div key={m.message_id} className={`p-3 rounded-lg ${bgSecondary}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] uppercase tracking-wide ${textSecondary}`}>{m.message_type.replace('_', ' ')}</span>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(m.text); toast.success('Copied'); }}
                        className={`text-[10px] ${textSecondary} hover:${textPrimary} inline-flex items-center gap-1`}
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <p className={`text-sm ${textPrimary} whitespace-pre-wrap`}>{m.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============== COMING SOON TABS ============== */}
        {['conversation', 'workflow', 'queue', 'integrations', 'ai_settings', 'logs'].includes(activeTab) && (
          <div className={`p-10 rounded-lg border ${borderColor} ${bgCard} text-center`} data-testid={`linkedin-${activeTab}-tab`}>
            <p className={`text-sm font-medium ${textPrimary}`}>{TABS.find(t => t.key === activeTab)?.label} — Coming Soon</p>
            <p className={`text-xs ${textSecondary} mt-1`}>This is part of the Automation roadmap and builds on the same framework as LinkedIn Partnership.</p>
          </div>
        )}

        {/* ============== PARTNER MODAL ============== */}
        <Dialog open={showPartnerModal} onOpenChange={setShowPartnerModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-lg max-h-[85vh] overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle>{editingPartnerId ? 'Edit Partner' : 'New Partner'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Name *</Label>
                <Input value={partnerForm.name} onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="partner-form-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Company</Label>
                  <Input value={partnerForm.company} onChange={(e) => setPartnerForm({ ...partnerForm, company: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
                <div>
                  <Label className={textPrimary}>Country</Label>
                  <Input value={partnerForm.country} onChange={(e) => setPartnerForm({ ...partnerForm, country: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Industry</Label>
                  <Input value={partnerForm.industry} onChange={(e) => setPartnerForm({ ...partnerForm, industry: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
                <div>
                  <Label className={textPrimary}>Agency Type</Label>
                  <Select value={partnerForm.agency_type || 'none'} onValueChange={(v) => setPartnerForm({ ...partnerForm, agency_type: v === 'none' ? '' : v })}>
                    <SelectTrigger className={`${bgSecondary} border ${borderColor}`}><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {agencyTypes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className={textPrimary}>LinkedIn URL</Label>
                <Input value={partnerForm.linkedin_url} onChange={(e) => setPartnerForm({ ...partnerForm, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/…" className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Status</Label>
                  <Select value={partnerForm.status} onValueChange={(v) => setPartnerForm({ ...partnerForm, status: v })}>
                    <SelectTrigger className={`${bgSecondary} border ${borderColor}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>Assigned To</Label>
                  <Input value={partnerForm.assigned_to} onChange={(e) => setPartnerForm({ ...partnerForm, assigned_to: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Next Action</Label>
                <Input value={partnerForm.next_action} onChange={(e) => setPartnerForm({ ...partnerForm, next_action: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div>
                <Label className={textPrimary}>Deal Value (₹) — once Partner stage is reached</Label>
                <Input type="number" value={partnerForm.deal_value} onChange={(e) => setPartnerForm({ ...partnerForm, deal_value: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div>
                <Label className={textPrimary}>Notes</Label>
                <Textarea value={partnerForm.notes} onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })} className={`${bgSecondary} border ${borderColor}`} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowPartnerModal(false)}>Cancel</Button>
              <Button onClick={savePartner} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="partner-form-save">
                {saving ? 'Saving…' : (editingPartnerId ? 'Update Partner' : 'Create Partner')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default LinkedInPartnershipPage;
