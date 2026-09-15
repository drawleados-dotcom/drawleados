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
  ArrowLeft, Kanban, List, Plus, ExternalLink, Trash2, Pencil, Settings,
  Loader2, ArrowUp, ArrowDown, X, Briefcase, Clock, LayoutList,
} from 'lucide-react';

const TABS = [
  { key: 'list', label: 'Candidates', icon: List },
  { key: 'pipeline', label: 'Pipeline', icon: Kanban },
  { key: 'openings', label: 'Opening Positions', icon: LayoutList },
];

const STAGE_COLORS = [
  '#6366f1', '#3b82f6', '#f59e0b', '#8b5cf6', '#22c55e', '#ef4444',
  '#14b8a6', '#ec4899', '#f97316', '#a855f7', '#10b981', '#71717a',
];

const OPENING_STATUSES = ['Open', 'On Hold', 'Closed'];
const OPENING_STATUS_STYLE = {
  Open: 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]',
  'On Hold': 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]',
  Closed: 'bg-[#71717a]/20 text-[#71717a] border-[#71717a]',
};

const EMPTY_FORM = {
  name: '', email: '', phone: '', address: '', position_applied: '',
  experience_years: '', source: '', salary_expected: '', salary_offered: '',
  resume_link: '', notes: '', assigned_to: '', stage_id: '',
};

const EMPTY_OPENING_FORM = {
  title: '', department: '', status: 'Open', openings_count: 1, description: '',
};

// ============== KANBAN ==============

const CandidateCard = ({ candidate, color, onOpen }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'CANDIDATE',
    item: { candidate },
    collect: (m) => ({ isDragging: m.isDragging() }),
  }));
  return (
    <div
      ref={drag}
      onClick={() => onOpen(candidate)}
      className={`bg-[#09090b] border border-[#27272a] rounded-lg p-3 cursor-move hover:border-[#6366f1]/40 transition-all ${isDragging ? 'opacity-40' : ''}`}
      data-testid={`kanban-candidate-${candidate.candidate_id}`}
    >
      <p className="text-sm font-medium text-[#fafafa]">{candidate.name}</p>
      {candidate.position_applied && <p className="text-xs text-[#a1a1aa] mt-0.5">{candidate.position_applied}</p>}
      {candidate.assigned_to_name && (
        <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: color, color }}>
          {candidate.assigned_to_name}
        </span>
      )}
    </div>
  );
};

const StageColumn = ({ stage, color, candidates, onDrop, onOpen }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'CANDIDATE',
    drop: (item) => onDrop(item.candidate, stage),
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
        <span className="ml-auto text-[10px] text-[#a1a1aa] bg-[#27272a] px-1.5 py-0.5 rounded-full">{candidates.length}</span>
      </div>
      <div className="space-y-2">
        {candidates.map((c) => <CandidateCard key={c.candidate_id} candidate={c} color={color} onOpen={onOpen} />)}
      </div>
    </div>
  );
};

// ============== MAIN PAGE ==============

const RecruitmentPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [stages, setStages] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [openings, setOpenings] = useState([]);

  const stageColor = (stageName) => STAGE_COLORS[stages.findIndex(s => s.name === stageName) % STAGE_COLORS.length] || '#71717a';
  const stageById = (id) => stages.find(s => s.stage_id === id);

  const loadAll = useCallback(async () => {
    try {
      const [cRes, sRes, tRes, oRes] = await Promise.all([
        api.get('/recruitment/candidates'),
        api.get('/recruitment/stages'),
        api.get('/recruitment/team-members'),
        api.get('/recruitment/openings'),
      ]);
      setCandidates(cRes.data || []);
      setStages(sRes.data || []);
      setTeamMembers(tRes.data || []);
      setOpenings(oRes.data || []);
    } catch (e) {
      toast.error('Failed to load Recruitment data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ---------- Candidate CRUD ----------
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [editingCandidateId, setEditingCandidateId] = useState(null);
  const [candidateForm, setCandidateForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openNewCandidate = () => {
    setEditingCandidateId(null);
    setCandidateForm({ ...EMPTY_FORM, stage_id: stages[0]?.stage_id || '' });
    setShowCandidateModal(true);
  };
  const openEditCandidate = (c) => {
    setEditingCandidateId(c.candidate_id);
    setCandidateForm({
      name: c.name || '', email: c.email || '', phone: c.phone || '', address: c.address || '',
      position_applied: c.position_applied || '', experience_years: c.experience_years || '',
      source: c.source || '', salary_expected: c.salary_expected || '', salary_offered: c.salary_offered || '',
      resume_link: c.resume_link || '', notes: c.notes || '', assigned_to: c.assigned_to || '',
      stage_id: c.stage_id || '',
    });
    setShowCandidateModal(true);
  };

  const saveCandidate = async () => {
    if (!candidateForm.name.trim()) { toast.error('Candidate name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...candidateForm,
        salary_expected: Number(candidateForm.salary_expected) || 0,
        salary_offered: Number(candidateForm.salary_offered) || 0,
      };
      if (editingCandidateId) {
        await api.put(`/recruitment/candidates/${editingCandidateId}`, payload);
        toast.success('Candidate updated');
      } else {
        await api.post('/recruitment/candidates', payload);
        toast.success('Candidate added');
      }
      setShowCandidateModal(false);
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save candidate');
    } finally {
      setSaving(false);
    }
  };

  const deleteCandidate = async (candidateId) => {
    if (!window.confirm('Remove this candidate?')) return;
    try {
      await api.delete(`/recruitment/candidates/${candidateId}`);
      toast.success('Candidate removed');
      loadAll();
    } catch (e) {
      toast.error('Failed to remove candidate');
    }
  };

  const changeStage = async (candidate, newStage) => {
    if (candidate.stage_id === newStage.stage_id) return;
    try {
      await api.put(`/recruitment/candidates/${candidate.candidate_id}`, { stage_id: newStage.stage_id });
      toast.success(`Moved to ${newStage.name}`);
      loadAll();
    } catch (e) {
      toast.error('Failed to update stage');
    }
  };

  // ---------- Stages management ----------
  const [showStagesModal, setShowStagesModal] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6366f1');

  const createStage = async () => {
    if (!newStageName.trim()) { toast.error('Stage name is required'); return; }
    try {
      await api.post('/recruitment/stages', { name: newStageName, color: newStageColor });
      toast.success('Stage created');
      setNewStageName('');
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create stage');
    }
  };

  const deleteStage = async (stageId) => {
    if (!window.confirm('Delete this stage?')) return;
    try {
      await api.delete(`/recruitment/stages/${stageId}`);
      toast.success('Stage deleted');
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete stage');
    }
  };

  const moveStage = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= stages.length) return;
    const reordered = [...stages];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    try {
      await api.put('/recruitment/stages/reorder', {
        stages: reordered.map((s, i) => ({ stage_id: s.stage_id, order: i })),
      });
      setStages(reordered);
    } catch (e) {
      toast.error('Failed to reorder stages');
    }
  };

  // ---------- Opening Positions ----------
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [editingOpeningId, setEditingOpeningId] = useState(null);
  const [openingForm, setOpeningForm] = useState(EMPTY_OPENING_FORM);
  const [savingOpening, setSavingOpening] = useState(false);

  const openNewOpening = () => {
    setEditingOpeningId(null);
    setOpeningForm(EMPTY_OPENING_FORM);
    setShowOpeningModal(true);
  };
  const openEditOpening = (o) => {
    setEditingOpeningId(o.opening_id);
    setOpeningForm({
      title: o.title || '', department: o.department || '', status: o.status || 'Open',
      openings_count: o.openings_count ?? 1, description: o.description || '',
    });
    setShowOpeningModal(true);
  };

  const saveOpening = async () => {
    if (!openingForm.title.trim()) { toast.error('Position title is required'); return; }
    setSavingOpening(true);
    try {
      const payload = { ...openingForm, openings_count: Number(openingForm.openings_count) || 1 };
      if (editingOpeningId) {
        await api.put(`/recruitment/openings/${editingOpeningId}`, payload);
        toast.success('Opening updated');
      } else {
        await api.post('/recruitment/openings', payload);
        toast.success('Opening added');
      }
      setShowOpeningModal(false);
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save opening');
    } finally {
      setSavingOpening(false);
    }
  };

  const deleteOpening = async (openingId) => {
    if (!window.confirm('Delete this opening position?')) return;
    try {
      await api.delete(`/recruitment/openings/${openingId}`);
      toast.success('Opening deleted');
      loadAll();
    } catch (e) {
      toast.error('Failed to delete opening');
    }
  };

  if (loading) {
    return <Layout><div className="p-6 flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="p-6" data-testid="recruitment-page">
        <button onClick={() => navigate('/hr-admin')} className={`text-sm ${textSecondary} hover:underline mb-3 inline-flex items-center gap-1`}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to HR Admin
        </button>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#6366f1]/20">
              <Briefcase className="h-6 w-6 text-[#6366f1]" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${textPrimary}`}>Recruitment</h1>
              <p className={`text-sm ${textSecondary}`}>{candidates.length} candidates in the pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowStagesModal(true)} variant="outline" className={`${borderColor} ${bgSecondary} ${textSecondary}`} data-testid="recruitment-stages-btn">
              <Settings className="h-4 w-4 mr-2" /> Stages
            </Button>
            <Button onClick={openNewCandidate} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="new-candidate-btn">
              <Plus className="h-4 w-4 mr-2" /> Add Candidate
            </Button>
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
                data-testid={`recruitment-tab-${t.key}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  active ? 'bg-[#6366f1] border-[#6366f1] text-white' : `${bgSecondary} ${borderColor} ${textSecondary} hover:${textPrimary}`
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* ============== CANDIDATES LIST ============== */}
        {activeTab === 'list' && (
          <div className={`rounded-lg border ${borderColor} ${bgCard} overflow-x-auto`} data-testid="recruitment-list-tab">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  {['Candidate', 'Position', 'Experience', 'Salary Expected', 'Stage', 'Assigned To', 'Actions'].map(h => (
                    <th key={h} className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase whitespace-nowrap`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const stage = stageById(c.stage_id);
                  return (
                    <tr key={c.candidate_id} className={`border-b ${borderColor}`} data-testid={`candidate-row-${c.candidate_id}`}>
                      <td className="p-3">
                        <p className={`text-sm font-medium ${textPrimary}`}>{c.name}</p>
                        <p className={`text-xs ${textSecondary}`}>{c.email || c.phone || '—'}</p>
                      </td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{c.position_applied || '—'}</td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{c.experience_years ? `${c.experience_years} yrs` : '—'}</td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{c.salary_expected ? `₹${Number(c.salary_expected).toLocaleString()}` : '—'}</td>
                      <td className="p-3">
                        {stage ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium border" style={{ borderColor: stage.color, color: stage.color }}>
                            {stage.name}
                          </span>
                        ) : <span className={textSecondary}>—</span>}
                      </td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{c.assigned_to_name || '—'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {c.resume_link && (
                            <a href={c.resume_link} target="_blank" rel="noopener noreferrer" title="Resume" className={`p-1.5 rounded ${bgSecondary} hover:opacity-80`} data-testid={`candidate-resume-${c.candidate_id}`}>
                              <ExternalLink className="h-3.5 w-3.5 text-[#6366f1]" />
                            </a>
                          )}
                          <button title="Edit" onClick={() => openEditCandidate(c)} className={`p-1.5 rounded ${bgSecondary} hover:opacity-80`} data-testid={`candidate-edit-${c.candidate_id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button title="Delete" onClick={() => deleteCandidate(c.candidate_id)} className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20" data-testid={`candidate-delete-${c.candidate_id}`}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {candidates.length === 0 && (
                  <tr><td colSpan={7} className={`p-8 text-center text-xs ${textSecondary}`}>No candidates yet. Click "Add Candidate" to add one.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ============== PIPELINE (KANBAN) ============== */}
        {activeTab === 'pipeline' && (
          <DndProvider backend={HTML5Backend}>
            <div className="flex gap-3 overflow-x-auto pb-3" data-testid="recruitment-pipeline-tab">
              {stages.map((s) => (
                <StageColumn
                  key={s.stage_id}
                  stage={s.name}
                  color={s.color}
                  candidates={candidates.filter(c => c.stage_id === s.stage_id)}
                  onDrop={(candidate, _stageName) => changeStage(candidate, s)}
                  onOpen={openEditCandidate}
                />
              ))}
            </div>
          </DndProvider>
        )}

        {/* ============== OPENING POSITIONS ============== */}
        {activeTab === 'openings' && (
          <div data-testid="recruitment-openings-tab">
            <div className="flex justify-end mb-3">
              <Button onClick={openNewOpening} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="new-opening-btn">
                <Plus className="h-4 w-4 mr-2" /> Add Opening
              </Button>
            </div>
            <div className={`rounded-lg border ${borderColor} ${bgCard} overflow-x-auto`}>
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${borderColor}`}>
                    {['Position', 'Department', 'Openings', 'Status', 'Actions'].map(h => (
                      <th key={h} className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase whitespace-nowrap`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openings.map((o) => (
                    <tr key={o.opening_id} className={`border-b ${borderColor}`} data-testid={`opening-row-${o.opening_id}`}>
                      <td className="p-3">
                        <p className={`text-sm font-medium ${textPrimary}`}>{o.title}</p>
                        {o.description && <p className={`text-xs ${textSecondary} truncate max-w-xs`}>{o.description}</p>}
                      </td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{o.department || '—'}</td>
                      <td className={`p-3 text-xs ${textSecondary}`}>{o.openings_count}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${OPENING_STATUS_STYLE[o.status] || OPENING_STATUS_STYLE.Open}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button title="Edit" onClick={() => openEditOpening(o)} className={`p-1.5 rounded ${bgSecondary} hover:opacity-80`} data-testid={`opening-edit-${o.opening_id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button title="Delete" onClick={() => deleteOpening(o.opening_id)} className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20" data-testid={`opening-delete-${o.opening_id}`}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {openings.length === 0 && (
                    <tr><td colSpan={5} className={`p-8 text-center text-xs ${textSecondary}`}>No opening positions yet. Click "Add Opening" to post one.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============== CANDIDATE MODAL ============== */}
        <Dialog open={showCandidateModal} onOpenChange={setShowCandidateModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-lg max-h-[85vh] overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle>{editingCandidateId ? 'Edit Candidate' : 'Add Candidate'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Name *</Label>
                <Input value={candidateForm.name} onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })} className={`${bgSecondary} border ${borderColor}`} data-testid="candidate-form-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Email</Label>
                  <Input type="email" value={candidateForm.email} onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
                <div>
                  <Label className={textPrimary}>Phone</Label>
                  <Input value={candidateForm.phone} onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Address</Label>
                <Textarea value={candidateForm.address} onChange={(e) => setCandidateForm({ ...candidateForm, address: e.target.value })} className={`${bgSecondary} border ${borderColor}`} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Position Applied</Label>
                  <Select
                    value={candidateForm.position_applied || ''}
                    onValueChange={(v) => {
                      if (v === '__add_new__') {
                        openNewOpening();
                      } else {
                        setCandidateForm({ ...candidateForm, position_applied: v });
                      }
                    }}
                  >
                    <SelectTrigger className={`${bgSecondary} border ${borderColor}`} data-testid="candidate-form-position"><SelectValue placeholder="Select position" /></SelectTrigger>
                    <SelectContent>
                      {/* A candidate can already be tagged with a position that was
                          since removed from Opening Positions — keep it selectable
                          instead of silently blanking it out. */}
                      {candidateForm.position_applied && !openings.some(o => o.title === candidateForm.position_applied) && (
                        <SelectItem value={candidateForm.position_applied}>{candidateForm.position_applied} (not in list)</SelectItem>
                      )}
                      {openings.map(o => <SelectItem key={o.opening_id} value={o.title}>{o.title}</SelectItem>)}
                      <SelectItem value="__add_new__" className="text-blue-400">+ Add New Opening</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>Experience (years)</Label>
                  <Input value={candidateForm.experience_years} onChange={(e) => setCandidateForm({ ...candidateForm, experience_years: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Salary Expected (₹)</Label>
                  <Input type="number" value={candidateForm.salary_expected} onChange={(e) => setCandidateForm({ ...candidateForm, salary_expected: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
                <div>
                  <Label className={textPrimary}>Salary Offered (₹)</Label>
                  <Input type="number" value={candidateForm.salary_offered} onChange={(e) => setCandidateForm({ ...candidateForm, salary_offered: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Source</Label>
                <Input value={candidateForm.source} onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })} placeholder="e.g. Referral, LinkedIn, Naukri" className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div>
                <Label className={textPrimary}>Resume Link</Label>
                <Input value={candidateForm.resume_link} onChange={(e) => setCandidateForm({ ...candidateForm, resume_link: e.target.value })} placeholder="https://…" className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Stage</Label>
                  <Select value={candidateForm.stage_id} onValueChange={(v) => setCandidateForm({ ...candidateForm, stage_id: v })}>
                    <SelectTrigger className={`${bgSecondary} border ${borderColor}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {stages.map(s => <SelectItem key={s.stage_id} value={s.stage_id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>Assigned To</Label>
                  <Select value={candidateForm.assigned_to || 'none'} onValueChange={(v) => setCandidateForm({ ...candidateForm, assigned_to: v === 'none' ? '' : v })}>
                    <SelectTrigger className={`${bgSecondary} border ${borderColor}`}><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Unassigned —</SelectItem>
                      {teamMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Notes</Label>
                <Textarea value={candidateForm.notes} onChange={(e) => setCandidateForm({ ...candidateForm, notes: e.target.value })} className={`${bgSecondary} border ${borderColor}`} rows={3} />
              </div>

              {editingCandidateId && candidateForm.stage_id && (
                <div className={`pt-2 border-t ${borderColor}`}>
                  <p className={`text-xs font-medium ${textSecondary} mb-2 flex items-center gap-1`}><Clock className="h-3.5 w-3.5" /> Move to Stage</p>
                  <div className="flex flex-wrap gap-2">
                    {stages.map((s) => {
                      const isCurrent = candidateForm.stage_id === s.stage_id;
                      return (
                        <button
                          key={s.stage_id}
                          type="button"
                          onClick={() => setCandidateForm({ ...candidateForm, stage_id: s.stage_id })}
                          className="px-3 py-1 rounded-full text-xs font-medium border-2 transition-all"
                          style={{
                            borderColor: s.color,
                            backgroundColor: isCurrent ? s.color : 'transparent',
                            color: isCurrent ? '#fff' : s.color,
                          }}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCandidateModal(false)}>Cancel</Button>
              <Button onClick={saveCandidate} disabled={saving} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="candidate-form-save">
                {saving ? 'Saving…' : (editingCandidateId ? 'Update Candidate' : 'Add Candidate')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============== STAGES MODAL ============== */}
        <Dialog open={showStagesModal} onOpenChange={setShowStagesModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-sm`}>
            <DialogHeader>
              <DialogTitle>Recruitment Stages</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stages.map((s, idx) => (
                <div key={s.stage_id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md ${bgSecondary}`} data-testid={`stage-row-${s.stage_id}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-sm truncate">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} className={`p-1 rounded disabled:opacity-30 ${textSecondary} hover:opacity-80`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1} className={`p-1 rounded disabled:opacity-30 ${textSecondary} hover:opacity-80`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteStage(s.stage_id)} className="p-1 rounded text-red-400 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className={`pt-3 mt-1 border-t ${borderColor} flex gap-2`}>
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createStage(); }}
                placeholder="New stage name"
                className={`${bgSecondary} border ${borderColor}`}
                data-testid="new-stage-input"
              />
              <input
                type="color"
                value={newStageColor}
                onChange={(e) => setNewStageColor(e.target.value)}
                className="h-9 w-9 rounded border cursor-pointer shrink-0"
              />
              <Button onClick={createStage} className="bg-[#6366f1] hover:bg-[#4f46e5] shrink-0" data-testid="add-stage-btn">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowStagesModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============== ADD/EDIT OPENING MODAL ============== */}
        <Dialog open={showOpeningModal} onOpenChange={setShowOpeningModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-sm`}>
            <DialogHeader>
              <DialogTitle>{editingOpeningId ? 'Edit Opening' : 'Add Opening'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={textPrimary}>Position Title *</Label>
                <Input
                  value={openingForm.title}
                  onChange={(e) => setOpeningForm({ ...openingForm, title: e.target.value })}
                  placeholder="e.g. Backend Engineer"
                  className={`${bgSecondary} border ${borderColor}`}
                  data-testid="opening-form-title"
                />
              </div>
              <div>
                <Label className={textPrimary}>Department</Label>
                <Input value={openingForm.department} onChange={(e) => setOpeningForm({ ...openingForm, department: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={textPrimary}>Status</Label>
                  <Select value={openingForm.status} onValueChange={(v) => setOpeningForm({ ...openingForm, status: v })}>
                    <SelectTrigger className={`${bgSecondary} border ${borderColor}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPENING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={textPrimary}>No. of Openings</Label>
                  <Input type="number" min="1" value={openingForm.openings_count} onChange={(e) => setOpeningForm({ ...openingForm, openings_count: e.target.value })} className={`${bgSecondary} border ${borderColor}`} />
                </div>
              </div>
              <div>
                <Label className={textPrimary}>Description</Label>
                <Textarea value={openingForm.description} onChange={(e) => setOpeningForm({ ...openingForm, description: e.target.value })} className={`${bgSecondary} border ${borderColor}`} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowOpeningModal(false)}>Cancel</Button>
              <Button onClick={saveOpening} disabled={savingOpening} className="bg-[#6366f1] hover:bg-[#4f46e5]" data-testid="opening-form-save">
                {savingOpening ? 'Saving…' : (editingOpeningId ? 'Update Opening' : 'Add Opening')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default RecruitmentPage;
