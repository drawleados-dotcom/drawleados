import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Crown, Building2, Briefcase, Wrench, Megaphone, Plus, Pencil, Trash2, Save, GripVertical, X, Check } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const ICONS = { crown: Crown, building: Building2, brief: Briefcase, wrench: Wrench, mega: Megaphone };
const ICON_OPTIONS = ['', 'crown', 'building', 'brief', 'wrench', 'mega'];
const COLOR_PRESETS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#6366f1', '#8b5cf6', '#06b6d4', '#ef4444'];

// Flatten the tree to a depth-ordered display list
function flatten(nodes, parentId = null, depth = 0, acc = []) {
  const children = nodes
    .filter((n) => (n.parent_id || null) === parentId)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));
  for (const c of children) {
    acc.push({ ...c, depth });
    flatten(nodes, c.id, depth + 1, acc);
  }
  return acc;
}

function newId() {
  return 'node_' + Math.random().toString(36).slice(2, 10);
}

export default function OrgChart({ isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor, canEdit = true }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', color: '', icon: '' });
  const [addingUnder, setAddingUnder] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [dragId, setDragId] = useState(null);

  const headers = useMemo(() => {
    const token = localStorage.getItem('session_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/api/org-tree`, { headers });
        setNodes(res.data.nodes || []);
      } catch (e) {
        toast.error('Failed to load org tree');
      } finally {
        setLoading(false);
      }
    })();
  }, [headers]);

  const flat = useMemo(() => flatten(nodes, null, 0, []), [nodes]);
  const dashColor = isDark ? 'border-[#3f3f46]' : 'border-gray-300';

  const startEdit = (n) => {
    setEditingId(n.id);
    setEditDraft({ name: n.name, color: n.color, icon: n.icon || '' });
  };

  const saveEdit = (id) => {
    if (!editDraft.name.trim()) { toast.error('Name required'); return; }
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, name: editDraft.name.trim(), color: editDraft.color, icon: editDraft.icon || null } : n)));
    setEditingId(null);
    setDirty(true);
  };

  const collectDescendants = (parentId, list) => {
    const out = [parentId];
    const queue = [parentId];
    while (queue.length) {
      const cur = queue.shift();
      const children = list.filter((n) => n.parent_id === cur);
      for (const c of children) { out.push(c.id); queue.push(c.id); }
    }
    return out;
  };

  const deleteNode = (id) => {
    if (!window.confirm('Delete this node and ALL its children? This cannot be undone.')) return;
    setNodes((prev) => {
      const toRemove = new Set(collectDescendants(id, prev));
      return prev.filter((n) => !toRemove.has(n.id));
    });
    setDirty(true);
  };

  const addChild = (parentId) => {
    setAddingUnder(parentId);
    setEditDraft({ name: '', color: '#6366f1', icon: '' });
  };

  const submitAdd = () => {
    if (!editDraft.name.trim()) { toast.error('Name required'); return; }
    const siblings = nodes.filter((n) => (n.parent_id || null) === (addingUnder || null));
    const newNode = {
      id: newId(),
      name: editDraft.name.trim(),
      color: editDraft.color,
      icon: editDraft.icon || null,
      parent_id: addingUnder,
      sort: siblings.length,
    };
    setNodes((prev) => [...prev, newNode]);
    setAddingUnder(null);
    setDirty(true);
  };

  // ---- Drag & Drop ----
  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const onDropOn = (e, targetId, mode /* 'child' | 'sibling' */) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragId || dragId === targetId) { setDragId(null); return; }

    setNodes((prev) => {
      // Prevent dropping a node into its own descendant
      const banned = new Set(collectDescendants(dragId, prev));
      if (banned.has(targetId)) return prev;

      return prev.map((n) => {
        if (n.id !== dragId) return n;
        if (mode === 'child') return { ...n, parent_id: targetId };
        // sibling: same parent as target + insert after
        const target = prev.find((x) => x.id === targetId);
        if (!target) return n;
        return { ...n, parent_id: target.parent_id, sort: (target.sort || 0) + 0.5 };
      });
    });
    setDragId(null);
    setDirty(true);
  };

  const persist = async () => {
    setSaving(true);
    try {
      // Normalize sort numbers per-parent
      const grouped = {};
      for (const n of nodes) {
        const k = n.parent_id || 'root';
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(n);
      }
      const normalized = [];
      for (const k of Object.keys(grouped)) {
        grouped[k]
          .sort((a, b) => (a.sort || 0) - (b.sort || 0))
          .forEach((n, idx) => normalized.push({ ...n, sort: idx }));
      }
      await axios.put(`${API}/api/org-tree`, { nodes: normalized }, { headers });
      setNodes(normalized);
      setDirty(false);
      toast.success('Org structure saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={textSecondary}>Loading org tree...</div>;

  return (
    <div className="space-y-2" data-testid="org-chart">
      {/* Header actions */}
      {canEdit && (
        <div className="flex items-center justify-between mb-4">
          <span className={`text-xs ${textSecondary}`}>
            Drag the <GripVertical className="h-3 w-3 inline" /> handle to reorder · Drop on a node to nest it · Drop on an indent guide to make it a sibling
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setAddingUnder('ROOT'); setEditDraft({ name: '', color: '#6366f1', icon: '' }); }}
              className={`text-xs px-3 py-1.5 rounded-lg border ${borderColor} ${textPrimary} hover:bg-[#6366f1]/10`}
              data-testid="org-add-root"
            >
              <Plus className="h-3 w-3 inline mr-1" /> Add Root
            </button>
            <button
              onClick={persist}
              disabled={!dirty || saving}
              className={`text-xs px-3 py-1.5 rounded-lg ${dirty ? 'bg-[#10b981] hover:bg-[#059669] text-white' : `${bgSecondary} ${textSecondary} cursor-not-allowed`}`}
              data-testid="org-save"
            >
              <Save className="h-3 w-3 inline mr-1" /> {saving ? 'Saving...' : dirty ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </div>
      )}

      {/* Add-root form rendered conditionally below */}

      {flat.map((n) => {
        const Icon = n.icon ? ICONS[n.icon] : null;
        const indent = n.depth * 32;
        const isEditing = editingId === n.id;
        return (
          <div
            key={n.id}
            className="flex items-center group"
            style={{ paddingLeft: indent }}
            data-testid={`org-node-${n.id}`}
            onDragOver={onDragOver}
            onDrop={(e) => onDropOn(e, n.id, 'sibling')}
          >
            {n.depth > 0 && (
              <span className={`inline-block w-5 border-t border-dashed ${dashColor} mr-2`} />
            )}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${borderColor} ${bgSecondary} min-w-[240px] ${dragId === n.id ? 'opacity-40' : ''}`}
              style={{ borderLeft: `4px solid ${n.color}` }}
              draggable={canEdit && !isEditing}
              onDragStart={(e) => onDragStart(e, n.id)}
              onDragOver={onDragOver}
              onDrop={(e) => onDropOn(e, n.id, 'child')}
            >
              {canEdit && (
                <GripVertical className={`h-4 w-4 ${textSecondary} cursor-grab`} />
              )}
              {Icon ? (
                <Icon className="h-4 w-4 shrink-0" style={{ color: n.color }} />
              ) : (
                <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ backgroundColor: n.color }} />
              )}

              {isEditing ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="text"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    autoFocus
                    className={`text-sm px-2 py-1 rounded border ${borderColor} ${bgCard} ${textPrimary} flex-1 min-w-[100px]`}
                    data-testid={`org-edit-input-${n.id}`}
                  />
                  <select
                    value={editDraft.icon}
                    onChange={(e) => setEditDraft({ ...editDraft, icon: e.target.value })}
                    className={`text-xs px-1 py-1 rounded border ${borderColor} ${bgCard} ${textPrimary}`}
                  >
                    {ICON_OPTIONS.map((i) => (<option key={i || 'none'} value={i}>{i || 'no icon'}</option>))}
                  </select>
                  <div className="flex items-center gap-0.5">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditDraft({ ...editDraft, color: c })}
                        className={`w-4 h-4 rounded-full border ${editDraft.color === c ? 'ring-2 ring-offset-1 ring-white' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button onClick={() => saveEdit(n.id)} className="text-[#10b981] hover:bg-[#10b981]/10 p-1 rounded" data-testid={`org-edit-save-${n.id}`}>
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-[#ef4444] hover:bg-[#ef4444]/10 p-1 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className={`text-sm font-medium ${textPrimary} flex-1 truncate`}>{n.name}</span>
                  {canEdit && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => addChild(n.id)}
                        className={`p-1 rounded hover:bg-[#6366f1]/10 text-[#6366f1]`}
                        title="Add child"
                        data-testid={`org-add-child-${n.id}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => startEdit(n)}
                        className={`p-1 rounded hover:bg-[#3b82f6]/10 text-[#3b82f6]`}
                        title="Edit"
                        data-testid={`org-edit-${n.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteNode(n.id)}
                        className={`p-1 rounded hover:bg-[#ef4444]/10 text-[#ef4444]`}
                        title="Delete"
                        data-testid={`org-delete-${n.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Add-child inline form for this row */}
            {addingUnder === n.id && (
              <div className={`ml-2 flex items-center gap-1 p-2 rounded-lg border ${borderColor} ${bgCard}`}>
                <input
                  type="text"
                  placeholder="New node name"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  autoFocus
                  className={`text-sm px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary}`}
                />
                <div className="flex items-center gap-0.5">
                  {COLOR_PRESETS.slice(0, 5).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditDraft({ ...editDraft, color: c })}
                      className={`w-3.5 h-3.5 rounded-full border ${editDraft.color === c ? 'ring-1 ring-white' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button onClick={submitAdd} className="text-[#10b981] p-1" data-testid="org-add-submit">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setAddingUnder(null)} className="text-[#ef4444] p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add-root inline form */}
      {addingUnder === 'ROOT' && (
        <div className={`flex items-center gap-2 p-2 rounded-lg border ${borderColor} ${bgCard} mt-2`}>
          <input
            type="text"
            placeholder="New root node name"
            value={editDraft.name}
            onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
            autoFocus
            className={`text-sm px-2 py-1 rounded border ${borderColor} ${bgSecondary} ${textPrimary}`}
          />
          <button onClick={() => { const a = editDraft; setAddingUnder(null); setNodes((p) => [...p, { id: newId(), name: a.name.trim(), color: a.color, icon: a.icon || null, parent_id: null, sort: p.filter((x) => !x.parent_id).length }]); setDirty(true); }} className="text-[#10b981] p-1">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={() => setAddingUnder(null)} className="text-[#ef4444] p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
