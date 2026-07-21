import React, { useState } from 'react';
import api from '../../utils/api';
import { toast } from 'sonner';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import { Input } from '../ui/input';
import { Plus, Pencil, Check, X, ChevronDown } from 'lucide-react';

/** "Source of the Client" picker — a custom Popover dropdown (not shadcn
 * Select) because each row needs its own Edit icon, and a nested button
 * inside a Radix SelectItem can't reliably intercept clicks without also
 * triggering selection. Renaming a source updates it everywhere it's used,
 * not just in this form. */
export default function SourceSelect({ value, onChange, sources, onSourcesChange }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const resetRowState = () => {
    setEditingId(null);
    setEditingName('');
    setAdding(false);
    setNewName('');
  };

  const selectSource = (name) => {
    onChange(name);
    setOpen(false);
  };

  const startEdit = (e, s) => {
    e.stopPropagation();
    setAdding(false);
    setEditingId(s.source_id);
    setEditingName(s.name);
  };
  const cancelEdit = (e) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditingName('');
  };
  const saveEdit = async (e, s) => {
    e?.stopPropagation();
    const name = editingName.trim();
    if (!name) { toast.error('Source name is required'); return; }
    setSaving(true);
    try {
      const res = await api.put(`/sources/${s.source_id}`, { name });
      onSourcesChange(sources.map((x) => (x.source_id === s.source_id ? res.data : x)));
      if (value === s.name) onChange(res.data.name);
      toast.success('Source updated');
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update source');
    } finally {
      setSaving(false);
    }
  };

  const startAdd = (e) => { e.stopPropagation(); setEditingId(null); setAdding(true); };
  const cancelAdd = (e) => { e?.stopPropagation(); setAdding(false); setNewName(''); };
  const confirmAdd = async (e) => {
    e?.stopPropagation();
    const name = newName.trim();
    if (!name) { toast.error('Source name is required'); return; }
    setSaving(true);
    try {
      const res = await api.post('/sources', { name });
      onSourcesChange([...sources, res.data]);
      onChange(res.data.name);
      toast.success('Source added');
      setAdding(false);
      setNewName('');
      setOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add source');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetRowState(); }}>
      <PopoverAnchor asChild>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between rounded-md border border-input bg-transparent px-3 h-9 text-sm shadow-sm"
          data-testid="client-form-source"
        >
          <span className={value ? '' : 'text-muted-foreground'}>{value || 'Select a source'}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-1 max-h-72 overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {sources.map((s) => (
          <div key={s.source_id} className="flex items-center gap-1" data-testid={`client-form-source-row-${s.source_id}`}>
            {editingId === s.source_id ? (
              <div className="flex items-center gap-1 w-full py-0.5">
                <Input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(e, s); } if (e.key === 'Escape') cancelEdit(e); }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 text-sm"
                  data-testid="client-form-source-edit-input"
                />
                <button type="button" onClick={(e) => saveEdit(e, s)} disabled={saving} className="p-1 text-emerald-600 hover:opacity-80 shrink-0" title="Save" data-testid="client-form-source-edit-save">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={cancelEdit} className="p-1 text-gray-400 hover:opacity-80 shrink-0" title="Cancel">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => selectSource(s.name)}
                  className="flex-1 min-w-0 text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground truncate"
                >
                  {s.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => startEdit(e, s)}
                  className="p-1 text-gray-400 hover:text-gray-700 shrink-0"
                  title="Edit source name"
                  data-testid={`client-form-source-edit-${s.source_id}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
        {sources.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No sources yet.</p>}

        <div className="border-t mt-1 pt-1">
          {adding ? (
            <div className="flex items-center gap-1 py-0.5">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAdd(e); } if (e.key === 'Escape') cancelAdd(e); }}
                placeholder="New source name"
                className="h-7 text-sm"
                data-testid="client-form-new-source-input"
              />
              <button type="button" onClick={confirmAdd} disabled={saving} className="p-1 text-emerald-600 hover:opacity-80 shrink-0" title="Save" data-testid="client-form-new-source-save">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={cancelAdd} className="p-1 text-gray-400 hover:opacity-80 shrink-0" title="Cancel">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startAdd}
              className="w-full flex items-center gap-1 px-2 py-1.5 text-sm text-[#6366f1] font-medium rounded-sm hover:bg-accent"
              data-testid="client-form-add-source-btn"
            >
              <Plus className="h-3.5 w-3.5" /> Add New Source
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
