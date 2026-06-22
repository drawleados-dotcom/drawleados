import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronRight, Layers, X, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const STAGES = ['developing', 'testing', 'bug'];

/**
 * ManageErpTaxonomyModal
 * ----------------------
 * Cascading CRUD over the four-layer ERP taxonomy:
 *     Designation → Pages → Sub-pages → Functions → Modules
 * Designation is a free-form text input on a page (sourced from existing
 * `users.designation` values are *suggested* but not enforced).
 * Modal stays compact: three vertical columns (Page · Sub-page · Function/Module)
 * with inline add inputs at the bottom of each.
 */
const ManageErpTaxonomyModal = ({ project, onClose, onChanged, isDark = true }) => {
  const headers = { Authorization: `Bearer ${localStorage.getItem('session_token')}` };
  const projectId = project.project_id;

  const [pages, setPages] = useState([]);
  const [subpages, setSubpages] = useState([]);
  const [functions, setFunctions] = useState([]);
  const [modules, setModules] = useState([]);

  const [selPage, setSelPage] = useState(null);
  const [selSub, setSelSub] = useState(null);
  const [selFn, setSelFn] = useState(null);

  const [newPage, setNewPage] = useState({ name: '', designation: '' });
  const [newSub, setNewSub] = useState('');
  const [newFn, setNewFn] = useState('');
  const [newMod, setNewMod] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await axios.get(`${API}/api/projects/${projectId}/erp/summary`, { headers });
      setPages(summary.data.pages || []);
      setSubpages(summary.data.subpages || []);
      setFunctions(summary.data.functions || []);
      setModules(summary.data.modules || []);
    } catch (e) {
      toast.error('Failed to load ERP taxonomy');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [projectId]);

  // --- Mutations -----------------------------------------------------------
  const addPage = async () => {
    if (!newPage.name.trim()) return;
    try {
      await axios.post(`${API}/api/projects/${projectId}/erp/pages`, {
        name: newPage.name.trim(), designation: newPage.designation.trim(),
      }, { headers });
      setNewPage({ name: '', designation: '' });
      await refresh(); onChanged?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const addSub = async () => {
    if (!newSub.trim() || !selPage) return;
    try {
      await axios.post(`${API}/api/projects/${projectId}/erp/subpages`, {
        name: newSub.trim(), page_id: selPage.page_id,
      }, { headers });
      setNewSub(''); await refresh(); onChanged?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const addFn = async () => {
    if (!newFn.trim() || !selSub) return;
    try {
      await axios.post(`${API}/api/projects/${projectId}/erp/functions`, {
        name: newFn.trim(), subpage_id: selSub.subpage_id,
      }, { headers });
      setNewFn(''); await refresh(); onChanged?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const addMod = async () => {
    if (!newMod.trim() || !selFn) return;
    try {
      await axios.post(`${API}/api/projects/${projectId}/erp/modules`, {
        name: newMod.trim(), function_id: selFn.function_id,
      }, { headers });
      setNewMod(''); await refresh(); onChanged?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const remove = async (kind, id, label) => {
    if (!window.confirm(`Remove "${label}"? This also deletes all children.`)) return;
    try {
      await axios.delete(`${API}/api/projects/${projectId}/erp/${kind}/${id}`, { headers });
      if (kind === 'pages' && selPage?.page_id === id) { setSelPage(null); setSelSub(null); setSelFn(null); }
      if (kind === 'subpages' && selSub?.subpage_id === id) { setSelSub(null); setSelFn(null); }
      if (kind === 'functions' && selFn?.function_id === id) setSelFn(null);
      await refresh(); onChanged?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  // --- Derived lists -------------------------------------------------------
  const subsFor = selPage ? subpages.filter(s => s.page_id === selPage.page_id) : [];
  const fnsFor = selSub ? functions.filter(f => f.subpage_id === selSub.subpage_id) : [];
  const modsFor = selFn ? modules.filter(m => m.function_id === selFn.function_id) : [];

  const bg = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bg2 = isDark ? 'bg-[#09090b]' : 'bg-gray-50';
  const border = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const txt = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const sub = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const Column = ({ title, items, idKey, labelKey, selected, onSelect, onAdd, addValue, setAddValue, kind, disabled, extra }) => (
    <div className={`${bg2} border ${border} rounded-lg flex flex-col min-h-[360px]`}>
      <div className="px-3 py-2 border-b text-xs font-semibold uppercase tracking-wider flex items-center justify-between"
           style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
        <span className={txt}>{title}</span>
        <span className={sub}>({items.length})</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.length === 0 ? (
          <p className={`text-xs ${sub} italic px-2 py-4 text-center`}>{disabled ? 'Pick a parent above' : 'No items yet'}</p>
        ) : items.map(it => {
          const id = it[idKey];
          const active = selected && selected[idKey] === id;
          return (
            <div
              key={id}
              onClick={() => onSelect?.(it)}
              data-testid={`erp-tax-${kind}-row-${id}`}
              className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                active ? 'bg-[#6366f1]/20 text-[#a78bfa]' : `${txt} hover:bg-[#27272a]`
              }`}
            >
              <span className="truncate flex-1">{it[labelKey]}</span>
              {extra?.(it)}
              <button
                onClick={(e) => { e.stopPropagation(); remove(kind, id, it[labelKey]); }}
                className="opacity-0 group-hover:opacity-100 text-[#f87171] hover:text-[#fca5a5] ml-2"
                data-testid={`erp-tax-${kind}-del-${id}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
      {!disabled && (
        <div className="p-2 border-t flex gap-1" style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
          <input
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
            placeholder={`Add ${title.toLowerCase()}…`}
            data-testid={`erp-tax-${kind}-input`}
            className={`flex-1 px-2 py-1.5 text-sm rounded ${bg} border ${border} ${txt} placeholder-[#52525b]`}
          />
          <button onClick={onAdd} data-testid={`erp-tax-${kind}-add`} className="px-2 py-1 rounded bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="erp-taxonomy-modal">
      <div className={`${bg} border ${border} rounded-xl shadow-2xl w-full max-w-6xl mx-4 max-h-[92vh] flex flex-col`}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#6366f1]" />
            <div>
              <h2 className={`text-base font-semibold ${txt}`}>ERP Taxonomy</h2>
              <p className={`text-xs ${sub}`}>{project.name}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1 rounded hover:bg-[#27272a] ${sub}`} data-testid="erp-taxonomy-close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" /></div>
          ) : (
            <div>
              <p className={`text-xs ${sub} mb-3 flex items-center gap-1`}>
                Pages <ChevronRight className="h-3 w-3" /> Sub-pages <ChevronRight className="h-3 w-3" /> Functions <ChevronRight className="h-3 w-3" /> Modules
              </p>
              {/* Page add row needs the optional designation, so it's outside the generic Column */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className={`${bg2} border ${border} rounded-lg flex flex-col min-h-[360px]`}>
                  <div className="px-3 py-2 border-b text-xs font-semibold uppercase tracking-wider flex items-center justify-between"
                       style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
                    <span className={txt}>Pages</span>
                    <span className={sub}>({pages.length})</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {pages.length === 0 ? (
                      <p className={`text-xs ${sub} italic px-2 py-4 text-center`}>No pages yet</p>
                    ) : pages.map(it => {
                      const active = selPage?.page_id === it.page_id;
                      return (
                        <div key={it.page_id}
                          onClick={() => { setSelPage(it); setSelSub(null); setSelFn(null); }}
                          data-testid={`erp-tax-pages-row-${it.page_id}`}
                          className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                            active ? 'bg-[#6366f1]/20 text-[#a78bfa]' : `${txt} hover:bg-[#27272a]`
                          }`}>
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{it.name}</div>
                            {it.designation && <div className={`text-[10px] ${sub} truncate`}>{it.designation}</div>}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); remove('pages', it.page_id, it.name); }}
                            className="opacity-0 group-hover:opacity-100 text-[#f87171] hover:text-[#fca5a5] ml-2"
                            data-testid={`erp-tax-pages-del-${it.page_id}`}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-2 border-t space-y-1" style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
                    <input value={newPage.name}
                      onChange={(e) => setNewPage({ ...newPage, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addPage()}
                      placeholder="Page name…"
                      data-testid="erp-tax-pages-input"
                      className={`w-full px-2 py-1.5 text-sm rounded ${bg} border ${border} ${txt} placeholder-[#52525b]`} />
                    <div className="flex gap-1">
                      <input value={newPage.designation}
                        onChange={(e) => setNewPage({ ...newPage, designation: e.target.value })}
                        placeholder="Designation (optional)"
                        data-testid="erp-tax-pages-desg"
                        className={`flex-1 px-2 py-1.5 text-xs rounded ${bg} border ${border} ${txt} placeholder-[#52525b]`} />
                      <button onClick={addPage} data-testid="erp-tax-pages-add" className="px-2 py-1 rounded bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <Column title="Sub-pages" items={subsFor} idKey="subpage_id" labelKey="name"
                  selected={selSub} onSelect={(s) => { setSelSub(s); setSelFn(null); }}
                  onAdd={addSub} addValue={newSub} setAddValue={setNewSub} kind="subpages" disabled={!selPage} />

                <Column title="Functions" items={fnsFor} idKey="function_id" labelKey="name"
                  selected={selFn} onSelect={(f) => setSelFn(f)}
                  onAdd={addFn} addValue={newFn} setAddValue={setNewFn} kind="functions" disabled={!selSub} />

                <Column title="Modules" items={modsFor} idKey="module_id" labelKey="name"
                  selected={null} onSelect={() => {}}
                  onAdd={addMod} addValue={newMod} setAddValue={setNewMod} kind="modules" disabled={!selFn} />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-end" style={{ borderColor: isDark ? '#27272a' : '#e5e7eb' }}>
          <button onClick={onClose} className="px-4 py-2 rounded bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm" data-testid="erp-taxonomy-done">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export { STAGES };
export default ManageErpTaxonomyModal;
