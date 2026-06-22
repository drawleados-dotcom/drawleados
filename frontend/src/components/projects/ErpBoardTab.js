import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Layers, Settings, Bug, Wrench, FlaskConical, Loader2 } from 'lucide-react';
import ManageErpTaxonomyModal, { STAGES } from './ManageErpTaxonomyModal';

const API = process.env.REACT_APP_BACKEND_URL;

const STAGE_META = {
  developing: { label: 'Developing', icon: Wrench,        color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  testing:    { label: 'Testing',    icon: FlaskConical,  color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  bug:        { label: 'Bug',        icon: Bug,           color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
};

const PRIMARY_LAYERS = [
  { id: 'designations', label: 'Designations' },
  { id: 'pages',        label: 'Pages' },
  { id: 'subpages',     label: 'Sub-pages' },
  { id: 'functions',    label: 'Functions' },
  { id: 'modules',      label: 'Modules' },
  { id: 'stage',        label: 'Stage' },
];

/**
 * ErpBoardTab
 * -----------
 * Per-project ERP board. Two-row filter strip on top:
 *   Row 1 — primary layer toggle (designations / pages / subpages / functions / modules / stage)
 *   Row 2 — sub-pills listing items inside the active layer (with task counts)
 * Body is a 3-column Kanban grouped by stage (Developing · Testing · Bug),
 * filtered down to whatever the user picked in the filter strip.
 */
const ErpBoardTab = ({ project, isDark = true, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) => {
  const projectId = project.project_id;
  const headers = { Authorization: `Bearer ${localStorage.getItem('session_token')}` };

  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [primary, setPrimary] = useState('stage');     // active row-1 layer
  const [activeFilter, setActiveFilter] = useState(null); // active row-2 value (null = All)
  const [showTaxonomy, setShowTaxonomy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        axios.get(`${API}/api/projects/${projectId}/erp/summary`, { headers }),
        axios.get(`${API}/api/projects/${projectId}/erp/tasks`, { headers }),
      ]);
      setSummary(s.data);
      setTasks(t.data || []);
    } catch (e) {
      toast.error('Failed to load ERP board');
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [projectId]);

  // --- Compute the Row-2 sub-pills for the active primary layer ------------
  const subPills = useMemo(() => {
    if (!summary) return [];
    switch (primary) {
      case 'designations':
        return (summary.designations || []).map(d => ({ id: d, label: d, count: tasks.filter(t => t.erp_designation === d).length }));
      case 'pages':
        return (summary.pages || []).map(p => ({ id: p.page_id, label: p.name, count: tasks.filter(t => t.erp_page_id === p.page_id).length, sub: p.designation }));
      case 'subpages':
        return (summary.subpages || []).map(s => ({ id: s.subpage_id, label: s.name, count: tasks.filter(t => t.erp_subpage_id === s.subpage_id).length }));
      case 'functions':
        return (summary.functions || []).map(f => ({ id: f.function_id, label: f.name, count: tasks.filter(t => t.erp_function_id === f.function_id).length }));
      case 'modules':
        return (summary.modules || []).map(m => ({ id: m.module_id, label: m.name, count: tasks.filter(t => t.erp_module_id === m.module_id).length }));
      case 'stage':
        return STAGES.map(s => ({ id: s, label: STAGE_META[s].label, count: tasks.filter(t => t.erp_stage === s).length }));
      default: return [];
    }
  }, [primary, summary, tasks]);

  // Whenever the primary layer changes, reset the row-2 filter
  useEffect(() => { setActiveFilter(null); }, [primary]);

  // --- Apply current filter to the tasks list -------------------------------
  const filteredTasks = useMemo(() => {
    if (!activeFilter) return tasks;
    switch (primary) {
      case 'designations': return tasks.filter(t => t.erp_designation === activeFilter);
      case 'pages':        return tasks.filter(t => t.erp_page_id === activeFilter);
      case 'subpages':     return tasks.filter(t => t.erp_subpage_id === activeFilter);
      case 'functions':    return tasks.filter(t => t.erp_function_id === activeFilter);
      case 'modules':      return tasks.filter(t => t.erp_module_id === activeFilter);
      case 'stage':        return tasks.filter(t => t.erp_stage === activeFilter);
      default: return tasks;
    }
  }, [tasks, primary, activeFilter]);

  const counts = summary?.counts || {};

  return (
    <div className="space-y-4" data-testid="erp-board-tab">
      {/* Summary strip */}
      <div className={`${bgCard} border ${borderColor} rounded-xl p-4 flex items-center justify-between flex-wrap gap-3`}>
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[#6366f1]" />
          <h3 className={`text-base font-semibold ${textPrimary}`}>ERP Board</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {[
            ['Designations', counts.designations, 'designations'],
            ['Pages', counts.pages, 'pages'],
            ['Sub-pages', counts.subpages, 'subpages'],
            ['Functions', counts.functions, 'functions'],
            ['Modules', counts.modules, 'modules'],
            ['Tasks', counts.tasks, null],
            ['Dev', counts.developing, 'stage', 'developing'],
            ['Test', counts.testing, 'stage', 'testing'],
            ['Bug', counts.bug, 'stage', 'bug'],
          ].map(([label, count, jumpPrimary, jumpFilter], i) => (
            <button
              key={i}
              onClick={() => { if (jumpPrimary) { setPrimary(jumpPrimary); setActiveFilter(jumpFilter ?? null); } }}
              data-testid={`erp-summary-${(label || '').toLowerCase()}`}
              className={`px-2.5 py-1 rounded-full border ${borderColor} ${textSecondary} hover:text-white hover:bg-[#27272a] transition`}
            >
              {label}: <span className={`${textPrimary} font-semibold`}>{count ?? 0}</span>
            </button>
          ))}
          <button
            onClick={() => setShowTaxonomy(true)}
            className="ml-2 px-3 py-1.5 rounded-md text-xs bg-[#6366f1] hover:bg-[#4f46e5] text-white inline-flex items-center gap-1"
            data-testid="erp-manage-taxonomy"
          >
            <Settings className="h-3.5 w-3.5" /> Manage Taxonomy
          </button>
        </div>
      </div>

      {/* Filter strip Row 1 — primary layer */}
      <div className="flex items-center gap-1 flex-wrap" data-testid="erp-primary-tabs">
        {PRIMARY_LAYERS.map(t => (
          <button
            key={t.id}
            onClick={() => setPrimary(t.id)}
            data-testid={`erp-primary-tab-${t.id}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              primary === t.id
                ? 'bg-[#6366f1] text-white'
                : `${bgSecondary} ${textSecondary} border ${borderColor} hover:text-white`
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter strip Row 2 — sub-pills for the active layer */}
      <div className="flex items-center gap-1 flex-wrap" data-testid="erp-sub-tabs">
        <button
          onClick={() => setActiveFilter(null)}
          data-testid="erp-sub-tab-all"
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
            activeFilter == null ? 'bg-[#27272a] text-white' : `${textSecondary} hover:text-white`
          }`}
        >
          All ({tasks.length})
        </button>
        {subPills.length === 0 ? (
          <span className={`text-[11px] ${textSecondary} italic px-2`}>No {primary} configured yet</span>
        ) : subPills.map(p => (
          <button
            key={p.id}
            onClick={() => setActiveFilter(p.id)}
            data-testid={`erp-sub-tab-${p.id}`}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
              activeFilter === p.id ? 'bg-[#6366f1] text-white' : `${textSecondary} hover:text-white border ${borderColor}`
            }`}
            title={p.sub ? `${p.label} · ${p.sub}` : p.label}
          >
            {p.label} <span className="opacity-70">({p.count})</span>
          </button>
        ))}
      </div>

      {/* Kanban grouped by stage */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="erp-kanban">
          {STAGES.map(stage => {
            const Meta = STAGE_META[stage];
            const Icon = Meta.icon;
            const stageTasks = filteredTasks.filter(t => (t.erp_stage || '') === stage);
            return (
              <div key={stage} className={`${bgCard} border ${borderColor} rounded-xl flex flex-col min-h-[360px]`} data-testid={`erp-col-${stage}`}>
                <div className={`px-3 py-2 border-b flex items-center justify-between ${Meta.color} rounded-t-xl border-b-0`}>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    <Icon className="h-3.5 w-3.5" />
                    {Meta.label}
                  </div>
                  <span className="text-[11px] opacity-80">{stageTasks.length}</span>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {stageTasks.length === 0 ? (
                    <p className={`text-xs ${textSecondary} italic px-2 py-4 text-center`}>No tasks</p>
                  ) : stageTasks.map(t => {
                    const pageLabel = (summary?.pages || []).find(p => p.page_id === t.erp_page_id)?.name;
                    const subLabel = (summary?.subpages || []).find(s => s.subpage_id === t.erp_subpage_id)?.name;
                    const fnLabel = (summary?.functions || []).find(f => f.function_id === t.erp_function_id)?.name;
                    const modLabel = (summary?.modules || []).find(m => m.module_id === t.erp_module_id)?.name;
                    return (
                      <div key={t.task_id} className={`${bgSecondary} border ${borderColor} rounded-md p-2.5`} data-testid={`erp-card-${t.task_id}`}>
                        <div className={`text-sm font-medium ${textPrimary} line-clamp-2`}>{t.task_name}</div>
                        {(pageLabel || subLabel || fnLabel || modLabel) && (
                          <div className={`text-[10px] ${textSecondary} mt-1 flex flex-wrap gap-1`}>
                            {pageLabel && <span className="px-1.5 py-0.5 rounded bg-[#6366f1]/15 text-[#a78bfa]">{pageLabel}</span>}
                            {subLabel && <span className="px-1.5 py-0.5 rounded bg-[#6366f1]/10 text-[#a78bfa]">{subLabel}</span>}
                            {fnLabel && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">{fnLabel}</span>}
                            {modLabel && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">{modLabel}</span>}
                          </div>
                        )}
                        <div className={`text-[10px] ${textSecondary} mt-1.5 flex items-center justify-between`}>
                          <span>{t.erp_designation || '—'}</span>
                          {t.due_date && <span>{new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showTaxonomy && (
        <ManageErpTaxonomyModal
          project={project}
          isDark={isDark}
          onClose={() => setShowTaxonomy(false)}
          onChanged={loadAll}
        />
      )}
    </div>
  );
};

export default ErpBoardTab;
