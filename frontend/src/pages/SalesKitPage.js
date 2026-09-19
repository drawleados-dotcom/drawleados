import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  ArrowLeft, Plus, Trash2, Pencil, Copy, Share2, Loader2, GripVertical,
  FileText, Table as TableIcon, X, ChevronLeft, ChevronRight,
  Type, AlignLeft, Hash, Mail, Phone, Calendar, ChevronDown, CircleDot, CheckSquare, Heading,
  Briefcase, Link2, MousePointerClick, UserCheck,
} from 'lucide-react';

const TABS = [
  { key: 'forms', label: 'Form Creation', icon: FileText },
  { key: 'portfolio', label: 'Portfolio', icon: Briefcase },
];

const LINK_TYPES = ['Portfolio', 'Case Study', 'Testimonials', 'Proposal Template'];

const FIELD_TYPE_META = {
  short_text: { label: 'Short Text', icon: Type },
  long_text: { label: 'Paragraph', icon: AlignLeft },
  number: { label: 'Number', icon: Hash },
  email: { label: 'Email', icon: Mail },
  phone: { label: 'Phone', icon: Phone },
  date: { label: 'Date', icon: Calendar },
  dropdown: { label: 'Dropdown', icon: ChevronDown },
  radio: { label: 'Multiple Choice', icon: CircleDot },
  checkbox: { label: 'Checkboxes', icon: CheckSquare },
  section_heading: { label: 'Section Heading', icon: Heading },
};

const HAS_OPTIONS = new Set(['dropdown', 'radio', 'checkbox']);

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const emptyField = (type = 'short_text') => ({
  field_id: uid(),
  type,
  label: '',
  placeholder: '',
  required: false,
  options: HAS_OPTIONS.has(type) ? ['Option 1'] : [],
});

const emptyPage = (title = 'Page 1') => ({ page_id: uid(), title, fields: [] });

const STATUS_BADGE = {
  draft: 'bg-[#71717a]/20 text-[#71717a] border-[#71717a]',
  published: 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]',
};

// ============== FIELD ROW (drag-and-drop reorder) ==============

const FieldRow = ({ field, index, moveField, onChange, onDelete, textSecondary, borderColor, bgCard }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'SK_FIELD',
    item: { index },
    collect: (m) => ({ isDragging: m.isDragging() }),
  });
  const [, drop] = useDrop({
    accept: 'SK_FIELD',
    hover: (dragged) => {
      if (dragged.index !== index) {
        moveField(dragged.index, index);
        dragged.index = index;
      }
    },
  });
  const meta = FIELD_TYPE_META[field.type] || FIELD_TYPE_META.short_text;
  const Icon = meta.icon;
  const isSection = field.type === 'section_heading';

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`border ${borderColor} ${bgCard} rounded-lg p-3 mb-2 transition-opacity ${isDragging ? 'opacity-40' : ''}`}
      data-testid={`sk-field-${field.field_id}`}
    >
      <div className="flex items-start gap-2">
        <div className="cursor-grab pt-2" title="Drag to reorder">
          <GripVertical className={`h-4 w-4 ${textSecondary}`} />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${textSecondary}`} />
            <span className={`text-[10px] uppercase tracking-wide ${textSecondary}`}>{meta.label}</span>
          </div>
          <Input
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            placeholder={isSection ? 'Section title' : 'Question / field label'}
            className={isSection ? 'font-semibold' : ''}
          />
          {!isSection && HAS_OPTIONS.has(field.type) && (
            <div className="space-y-1.5 pl-1">
              {(field.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const options = [...field.options];
                      options[i] = e.target.value;
                      onChange({ ...field, options });
                    }}
                    className="h-8 text-sm"
                  />
                  <button
                    onClick={() => onChange({ ...field, options: field.options.filter((_, oi) => oi !== i) })}
                    className={textSecondary}
                    title="Remove option"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => onChange({ ...field, options: [...(field.options || []), `Option ${(field.options || []).length + 1}`] })}
                className="text-xs text-[#3b82f6] hover:underline"
              >
                + Add option
              </button>
            </div>
          )}
          {!isSection && (
            <div className="flex items-center gap-3 pt-1">
              <Input
                value={field.placeholder || ''}
                onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
                placeholder="Placeholder / help text (optional)"
                className="h-8 text-xs flex-1"
              />
              <label className={`flex items-center gap-1.5 text-xs ${textSecondary} whitespace-nowrap cursor-pointer`}>
                <input
                  type="checkbox"
                  checked={!!field.required}
                  onChange={(e) => onChange({ ...field, required: e.target.checked })}
                />
                Required
              </label>
            </div>
          )}
        </div>
        <button onClick={onDelete} className="text-[#ef4444] hover:opacity-70 pt-1" title="Delete field">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// ============== FORM BUILDER ==============

const FormBuilderView = ({ initialForm, onCancel, onSaved, textPrimary, textSecondary, borderColor, bgCard, bgSecondary }) => {
  const [title, setTitle] = useState(initialForm.title || '');
  const [description, setDescription] = useState(initialForm.description || '');
  const [pages, setPages] = useState(
    (initialForm.pages && initialForm.pages.length ? initialForm.pages : [emptyPage()]).map(p => ({
      ...p,
      page_id: p.page_id || uid(),
      fields: (p.fields || []).map(f => ({ ...f, field_id: f.field_id || uid(), options: f.options || [] })),
    }))
  );
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(initialForm.status || 'draft');
  const [shareOpen, setShareOpen] = useState(false);
  const pageInputRefs = useRef({});

  const activePage = pages[activePageIdx] || pages[0];

  const updateActivePage = (updater) => {
    setPages(prev => prev.map((p, i) => (i === activePageIdx ? updater(p) : p)));
  };

  const addField = (type) => updateActivePage(p => ({ ...p, fields: [...p.fields, emptyField(type)] }));
  const changeField = (fieldId, next) => updateActivePage(p => ({
    ...p, fields: p.fields.map(f => (f.field_id === fieldId ? next : f)),
  }));
  const deleteField = (fieldId) => updateActivePage(p => ({
    ...p, fields: p.fields.filter(f => f.field_id !== fieldId),
  }));
  const moveField = (from, to) => updateActivePage(p => {
    const fields = [...p.fields];
    const [moved] = fields.splice(from, 1);
    fields.splice(to, 0, moved);
    return { ...p, fields };
  });

  const addPage = () => {
    setPages(prev => [...prev, emptyPage(`Page ${prev.length + 1}`)]);
    setActivePageIdx(pages.length);
  };
  const renamePage = (idx, name) => setPages(prev => prev.map((p, i) => (i === idx ? { ...p, title: name } : p)));
  const deletePage = (idx) => {
    if (pages.length <= 1) { toast.error('A form needs at least one page'); return; }
    setPages(prev => prev.filter((_, i) => i !== idx));
    setActivePageIdx(prev0 => Math.max(0, Math.min(prev0, pages.length - 2)));
  };
  const movePage = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= pages.length) return;
    setPages(prev => {
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
    setActivePageIdx(newIdx);
  };

  const totalFields = pages.reduce((sum, p) => sum + p.fields.length, 0);

  const save = async (nextStatus) => {
    if (!title.trim()) { toast.error('Form title is required'); return; }
    setSaving(true);
    try {
      const payload = { title, description, pages };
      if (nextStatus) payload.status = nextStatus;
      const res = await api.put(`/sales-kit/forms/${initialForm.form_id}`, payload);
      setStatus(res.data.status);
      toast.success(nextStatus === 'published' ? 'Form published' : (nextStatus === 'draft' ? 'Form unpublished' : 'Form saved'));
      onSaved(res.data);
    } catch (e) {
      toast.error('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const shareUrl = `${window.location.origin}/form/${initialForm.share_token}`;

  return (
    <DndProvider backend={HTML5Backend}>
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <button onClick={onCancel} className={`text-sm ${textSecondary} hover:underline inline-flex items-center gap-1`}>
            <ArrowLeft className="h-4 w-4" /> Back to Forms
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full border ${status === 'published' ? STATUS_BADGE.published : STATUS_BADGE.draft}`}>
              {status === 'published' ? 'Published' : 'Draft'}
            </span>
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} className={`${borderColor} ${textSecondary}`}>
              <Share2 className="h-4 w-4 mr-1.5" /> Share
            </Button>
            {status === 'published' ? (
              <Button variant="outline" size="sm" onClick={() => save('draft')} disabled={saving} className={`${borderColor} ${textSecondary}`}>
                Unpublish
              </Button>
            ) : (
              <Button size="sm" onClick={() => save('published')} disabled={saving} className="bg-[#22c55e] hover:bg-[#16a34a]">
                Publish
              </Button>
            )}
            <Button size="sm" onClick={() => save()} disabled={saving} className="bg-[#3b82f6] hover:bg-[#2563eb]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>

        <div className={`${bgCard} border ${borderColor} rounded-xl p-4 mb-4`}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Form title" className="text-lg font-semibold mb-2" />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} />
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {pages.map((p, idx) => (
            <div
              key={p.page_id}
              className={`flex items-center rounded-lg border ${borderColor} ${
                idx === activePageIdx ? 'bg-[#3b82f6] text-white border-[#3b82f6]' : `${bgSecondary} ${textSecondary}`
              }`}
            >
              {idx > 0 && (
                <button onClick={() => movePage(idx, -1)} className="pl-1.5 opacity-70 hover:opacity-100" title="Move page left">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              )}
              <input
                ref={(node) => { pageInputRefs.current[p.page_id] = node; }}
                value={p.title}
                onChange={(e) => renamePage(idx, e.target.value)}
                onFocus={(e) => { setActivePageIdx(idx); e.target.select(); }}
                placeholder={`Page ${idx + 1} name`}
                className={`bg-transparent px-2 py-1.5 text-sm font-medium outline-none w-28 border-b border-dashed ${
                  idx === activePageIdx ? 'border-white/50 placeholder-white/60' : `${borderColor} placeholder-gray-400`
                }`}
                title="Click to rename this page"
                data-testid={`sk-page-tab-${idx}`}
              />
              <button
                onClick={() => {
                  setActivePageIdx(idx);
                  pageInputRefs.current[p.page_id]?.focus();
                }}
                className="pr-1 opacity-70 hover:opacity-100"
                title="Rename page"
              >
                <Pencil className="h-3 w-3" />
              </button>
              {idx < pages.length - 1 && (
                <button onClick={() => movePage(idx, 1)} className="opacity-70 hover:opacity-100" title="Move page right">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              {pages.length > 1 && (
                <button onClick={() => deletePage(idx)} className="pr-2 pl-1 opacity-70 hover:opacity-100" title="Delete page">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addPage}
            className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-dashed ${borderColor} ${textSecondary} hover:${textPrimary}`}
          >
            <Plus className="h-3.5 w-3.5" /> Add Page
          </button>
          <span className={`text-xs ${textSecondary} ml-auto`}>{totalFields} field{totalFields === 1 ? '' : 's'} total</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
          <div>
            {activePage.fields.length === 0 && (
              <div className={`border border-dashed ${borderColor} rounded-lg p-8 text-center ${textSecondary} text-sm mb-2`}>
                No fields on this page yet. Add one from the panel on the right.
              </div>
            )}
            {activePage.fields.map((f, idx) => (
              <FieldRow
                key={f.field_id}
                field={f}
                index={idx}
                moveField={moveField}
                onChange={(next) => changeField(f.field_id, next)}
                onDelete={() => deleteField(f.field_id)}
                textSecondary={textSecondary}
                borderColor={borderColor}
                bgCard={bgCard}
              />
            ))}
          </div>
          <div className={`${bgCard} border ${borderColor} rounded-xl p-3 h-fit md:sticky md:top-4`}>
            <p className={`text-xs uppercase tracking-wide ${textSecondary} mb-2`}>Add a field</p>
            <div className="grid grid-cols-1 gap-1.5">
              {Object.entries(FIELD_TYPE_META).map(([type, meta]) => {
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    onClick={() => addField(type)}
                    className={`flex items-center gap-2 text-sm px-2.5 py-2 rounded-lg ${bgSecondary} ${textPrimary} hover:opacity-80 text-left`}
                    data-testid={`sk-add-field-${type}`}
                  >
                    <Icon className="h-4 w-4" /> {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Share Form</DialogTitle></DialogHeader>
          {status !== 'published' && (
            <p className="text-xs text-[#f59e0b] mb-2">This form is still a draft — publish it so the link works for respondents.</p>
          )}
          <div className="flex items-center gap-2">
            <Input readOnly value={shareUrl} className="flex-1" />
            <Button size="sm" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Link copied'); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DndProvider>
  );
};

// ============== FORMS LIST ==============

const FormsListView = ({ forms, onCreate, onEdit, onResponses, onShare, onDuplicate, onDelete, textPrimary, textSecondary, borderColor, bgCard }) => {
  if (forms.length === 0) {
    return (
      <div className={`border border-dashed ${borderColor} rounded-xl p-12 text-center`}>
        <FileText className={`h-8 w-8 ${textSecondary} mx-auto mb-3`} />
        <p className={`${textPrimary} font-medium mb-1`}>No forms yet</p>
        <p className={`text-sm ${textSecondary} mb-4`}>Create a custom requirement-gathering form to share with prospects.</p>
        <Button onClick={onCreate} className="bg-[#3b82f6] hover:bg-[#2563eb]"><Plus className="h-4 w-4 mr-1.5" /> New Form</Button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button onClick={onCreate} className="bg-[#3b82f6] hover:bg-[#2563eb]" data-testid="sk-new-form-btn">
          <Plus className="h-4 w-4 mr-1.5" /> New Form
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {forms.map(f => (
          <div key={f.form_id} className={`${bgCard} border ${borderColor} rounded-xl p-4 flex flex-col`} data-testid={`sk-form-card-${f.form_id}`}>
            <div className="flex items-start justify-between mb-2 gap-2">
              <p className={`font-medium ${textPrimary}`}>{f.title}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_BADGE[f.status] || STATUS_BADGE.draft}`}>
                {f.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
            {f.description && <p className={`text-xs ${textSecondary} mb-2 line-clamp-2`}>{f.description}</p>}
            <p className={`text-xs ${textSecondary} mb-3`}>
              {f.pages?.length || 0} page{(f.pages?.length || 0) === 1 ? '' : 's'} · {f.field_count} field{f.field_count === 1 ? '' : 's'} · {f.response_count} response{f.response_count === 1 ? '' : 's'}
            </p>
            <div className="mt-auto flex items-center gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => onEdit(f)} className={`${borderColor} ${textSecondary}`}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => onResponses(f)} className={`${borderColor} ${textSecondary}`}>
                <TableIcon className="h-3.5 w-3.5 mr-1" /> Responses
              </Button>
              <Button size="sm" variant="outline" onClick={() => onShare(f)} className={`${borderColor} ${textSecondary}`} title="Share">
                <Share2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDuplicate(f)} className={`${borderColor} ${textSecondary}`} title="Duplicate">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDelete(f)} className="border-[#ef4444]/40 text-[#ef4444]" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============== RESPONSES ==============

const ResponsesView = ({ form, responses, onBack, onDeleteResponse, textPrimary, textSecondary, borderColor, bgSecondary }) => {
  const fields = (form.pages || []).flatMap(p => p.fields || []).filter(f => f.type !== 'section_heading');
  const fmtAnswer = (val) => {
    if (val === undefined || val === null || val === '') return '—';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  };
  return (
    <div>
      <button onClick={onBack} className={`text-sm ${textSecondary} hover:underline mb-3 inline-flex items-center gap-1`}>
        <ArrowLeft className="h-4 w-4" /> Back to Forms
      </button>
      <div className="mb-3">
        <p className={`font-medium ${textPrimary}`}>{form.title} — Responses</p>
        <p className={`text-xs ${textSecondary}`}>{responses.length} submission{responses.length === 1 ? '' : 's'}</p>
      </div>
      {responses.length === 0 ? (
        <div className={`border border-dashed ${borderColor} rounded-xl p-10 text-center text-sm ${textSecondary}`}>
          No submissions yet. Share the form link to start collecting responses.
        </div>
      ) : (
        <div className={`border ${borderColor} rounded-xl overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={`${bgSecondary} ${textSecondary} text-left`}>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Submitted At</th>
                {fields.map(f => (
                  <th key={f.field_id} className="px-3 py-2 font-medium whitespace-nowrap">{f.label || 'Untitled'}</th>
                ))}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {responses.map(r => (
                <tr key={r.response_id} className={`border-t ${borderColor}`} data-testid={`sk-response-row-${r.response_id}`}>
                  <td className={`px-3 py-2 ${textSecondary} whitespace-nowrap`}>{new Date(r.submitted_at).toLocaleString()}</td>
                  {fields.map(f => (
                    <td key={f.field_id} className={`px-3 py-2 ${textPrimary}`}>{fmtAnswer(r.answers?.[f.field_id])}</td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => onDeleteResponse(r.response_id)} className="text-[#ef4444] hover:opacity-70" title="Delete response">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============== PORTFOLIO LIST ==============

const PortfolioListView = ({ portfolios, onCreate, onResponses, onShare, onDelete, linkTypeFilter, onLinkTypeFilterChange, textPrimary, textSecondary, borderColor, bgCard, bgSecondary }) => {
  const filtered = linkTypeFilter === 'all' ? portfolios : portfolios.filter(p => p.link_type === linkTypeFilter);
  const filterTabs = ['all', ...LINK_TYPES];

  if (portfolios.length === 0) {
    return (
      <div className={`border border-dashed ${borderColor} rounded-xl p-12 text-center`}>
        <Briefcase className={`h-8 w-8 ${textSecondary} mx-auto mb-3`} />
        <p className={`${textPrimary} font-medium mb-1`}>No portfolio items yet</p>
        <p className={`text-sm ${textSecondary} mb-4`}>Link to a portfolio and share a public or lead-gated link with prospects.</p>
        <Button onClick={onCreate} className="bg-[#3b82f6] hover:bg-[#2563eb]"><Plus className="h-4 w-4 mr-1.5" /> Add Portfolio</Button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterTabs.map(t => (
            <button
              key={t}
              onClick={() => onLinkTypeFilterChange(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                linkTypeFilter === t ? 'bg-[#3b82f6] text-white' : `${bgSecondary} ${textSecondary} hover:${textPrimary}`
              }`}
              data-testid={`sk-portfolio-filter-${t}`}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
        <Button onClick={onCreate} className="bg-[#3b82f6] hover:bg-[#2563eb]" data-testid="sk-new-portfolio-btn">
          <Plus className="h-4 w-4 mr-1.5" /> Add Portfolio
        </Button>
      </div>
      {filtered.length === 0 ? (
        <div className={`border border-dashed ${borderColor} rounded-xl p-10 text-center text-sm ${textSecondary}`}>
          No portfolio items with this link type yet.
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(p => (
          <div key={p.portfolio_id} className={`${bgCard} border ${borderColor} rounded-xl p-4 flex flex-col`} data-testid={`sk-portfolio-card-${p.portfolio_id}`}>
            <div className="flex items-start justify-between mb-2 gap-2">
              <p className={`font-medium ${textPrimary}`}>{p.service_name}</p>
              <div className="flex flex-col items-end gap-1">
                {p.link_type && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#3b82f6]/40 text-[#3b82f6] whitespace-nowrap">
                    {p.link_type}
                  </span>
                )}
                {p.service_type && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${bgSecondary} ${textSecondary} whitespace-nowrap`}>
                    {p.service_type}
                  </span>
                )}
              </div>
            </div>
            <a
              href={p.portfolio_link}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#3b82f6] hover:underline mb-3 truncate inline-flex items-center gap-1"
            >
              <Link2 className="h-3 w-3 shrink-0" /> {p.portfolio_link}
            </a>
            <div className={`text-xs ${textSecondary} mb-3 flex items-center gap-3`}>
              <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {p.click_count} click{p.click_count === 1 ? '' : 's'}</span>
              <span className="inline-flex items-center gap-1"><UserCheck className="h-3 w-3" /> {p.response_count} lead{p.response_count === 1 ? '' : 's'}</span>
            </div>
            <div className="mt-auto flex items-center gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => onResponses(p)} className={`${borderColor} ${textSecondary}`}>
                <TableIcon className="h-3.5 w-3.5 mr-1" /> Responses
              </Button>
              <Button size="sm" variant="outline" onClick={() => onShare(p)} className={`${borderColor} ${textSecondary}`} title="Share">
                <Share2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDelete(p)} className="border-[#ef4444]/40 text-[#ef4444]" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
};

const PortfolioResponsesView = ({ portfolio, responses, clicks, onBack, onDeleteResponse, textPrimary, textSecondary, borderColor, bgSecondary }) => {
  return (
    <div>
      <button onClick={onBack} className={`text-sm ${textSecondary} hover:underline mb-3 inline-flex items-center gap-1`}>
        <ArrowLeft className="h-4 w-4" /> Back to Portfolio
      </button>

      <div className={`border ${borderColor} rounded-xl p-3 mb-4 flex items-center gap-2`}>
        <MousePointerClick className="h-4 w-4 text-[#3b82f6] shrink-0" />
        <p className={`text-sm ${textSecondary}`}>
          Public link: <span className={`font-medium ${textPrimary}`}>{(clicks || []).length}</span> click{(clicks || []).length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mb-3">
        <p className={`font-medium ${textPrimary}`}>{portfolio.service_name} — Private Link Leads</p>
        <p className={`text-xs ${textSecondary}`}>{responses.length} lead{responses.length === 1 ? '' : 's'}</p>
      </div>
      {responses.length === 0 ? (
        <div className={`border border-dashed ${borderColor} rounded-xl p-10 text-center text-sm ${textSecondary}`}>
          No one has unlocked the private link yet. Share it to start collecting leads.
        </div>
      ) : (
        <div className={`border ${borderColor} rounded-xl overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={`${bgSecondary} ${textSecondary} text-left`}>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Viewed At</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Name</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Email</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {responses.map(r => (
                <tr key={r.response_id} className={`border-t ${borderColor}`} data-testid={`sk-portfolio-response-row-${r.response_id}`}>
                  <td className={`px-3 py-2 ${textSecondary} whitespace-nowrap`}>{new Date(r.submitted_at).toLocaleString()}</td>
                  <td className={`px-3 py-2 ${textPrimary}`}>{r.name}</td>
                  <td className={`px-3 py-2 ${textPrimary}`}>{r.email}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => onDeleteResponse(r.response_id)} className="text-[#ef4444] hover:opacity-70" title="Delete response">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============== MAIN PAGE ==============

const SalesKitPage = () => {
  const { isDark } = useTheme();
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  const [activeTab, setActiveTab] = useState('forms');
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState([]);
  const [view, setView] = useState('list'); // list | builder | responses
  const [activeForm, setActiveForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [shareForm, setShareForm] = useState(null);

  // Portfolio
  const [portfolios, setPortfolios] = useState([]);
  const [portfolioView, setPortfolioView] = useState('list'); // list | responses
  const [activePortfolio, setActivePortfolio] = useState(null);
  const [portfolioResponses, setPortfolioResponses] = useState([]);
  const [portfolioClicks, setPortfolioClicks] = useState([]);
  const [newPortfolioOpen, setNewPortfolioOpen] = useState(false);
  const [portfolioForm, setPortfolioForm] = useState({ service_name: '', service_type: '', link_type: '', portfolio_link: '' });
  const [creatingPortfolio, setCreatingPortfolio] = useState(false);
  const [deletePortfolioTarget, setDeletePortfolioTarget] = useState(null);
  const [sharePortfolio, setSharePortfolio] = useState(null);
  const [services, setServices] = useState([]);
  const [portfolioLinkTypeFilter, setPortfolioLinkTypeFilter] = useState('all');

  const loadForms = useCallback(async () => {
    try {
      const res = await api.get('/sales-kit/forms');
      setForms(res.data || []);
    } catch (e) {
      toast.error('Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPortfolios = useCallback(async () => {
    try {
      const res = await api.get('/sales-kit/portfolios');
      setPortfolios(res.data || []);
    } catch (e) {
      toast.error('Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadServices = useCallback(async () => {
    try {
      const res = await api.get('/services');
      setServices(res.data || []);
    } catch (e) {
      // Non-fatal — the Service Type dropdown just shows no options.
    }
  }, []);

  useEffect(() => { loadForms(); }, [loadForms]);
  useEffect(() => { loadPortfolios(); }, [loadPortfolios]);
  useEffect(() => { loadServices(); }, [loadServices]);

  const openCreate = () => { setNewFormTitle(''); setNewFormOpen(true); };

  const createForm = async () => {
    if (!newFormTitle.trim()) { toast.error('Form title is required'); return; }
    setCreating(true);
    try {
      const res = await api.post('/sales-kit/forms', { title: newFormTitle.trim() });
      setNewFormOpen(false);
      setForms(prev => [{ ...res.data, field_count: 0, response_count: 0 }, ...prev]);
      setActiveForm(res.data);
      setView('builder');
    } catch (e) {
      toast.error('Failed to create form');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = async (f) => {
    try {
      const res = await api.get(`/sales-kit/forms/${f.form_id}`);
      setActiveForm(res.data);
      setView('builder');
    } catch (e) {
      toast.error('Failed to load form');
    }
  };

  const openResponses = async (f) => {
    try {
      const res = await api.get(`/sales-kit/forms/${f.form_id}/responses`);
      setActiveForm(res.data.form);
      setResponses(res.data.responses || []);
      setView('responses');
    } catch (e) {
      toast.error('Failed to load responses');
    }
  };

  const duplicateForm = async (f) => {
    try {
      const res = await api.post(`/sales-kit/forms/${f.form_id}/duplicate`);
      toast.success('Form duplicated');
      const fieldCount = (res.data.pages || []).reduce((s, p) => s + (p.fields || []).length, 0);
      setForms(prev => [{ ...res.data, field_count: fieldCount, response_count: 0 }, ...prev]);
    } catch (e) {
      toast.error('Failed to duplicate form');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/sales-kit/forms/${deleteTarget.form_id}`);
      toast.success('Form deleted');
      setForms(prev => prev.filter(x => x.form_id !== deleteTarget.form_id));
      setDeleteTarget(null);
    } catch (e) {
      toast.error('Failed to delete form');
    }
  };

  const deleteResponseRow = async (responseId) => {
    try {
      await api.delete(`/sales-kit/responses/${responseId}`);
      setResponses(prev => prev.filter(r => r.response_id !== responseId));
      toast.success('Response deleted');
    } catch (e) {
      toast.error('Failed to delete response');
    }
  };

  const handleSaved = (savedForm) => {
    setActiveForm(savedForm);
    const fieldCount = (savedForm.pages || []).reduce((s, p) => s + (p.fields || []).length, 0);
    setForms(prev => {
      const exists = prev.some(x => x.form_id === savedForm.form_id);
      const prevEntry = prev.find(x => x.form_id === savedForm.form_id);
      const merged = { ...savedForm, field_count: fieldCount, response_count: prevEntry?.response_count || 0 };
      return exists ? prev.map(x => (x.form_id === savedForm.form_id ? merged : x)) : [merged, ...prev];
    });
  };

  // Portfolio handlers
  const openPortfolioCreate = () => {
    setPortfolioForm({ service_name: '', service_type: '', link_type: '', portfolio_link: '' });
    setNewPortfolioOpen(true);
  };

  const createPortfolio = async () => {
    if (!portfolioForm.service_name.trim()) { toast.error('Service name is required'); return; }
    if (!portfolioForm.portfolio_link.trim()) { toast.error('Portfolio link is required'); return; }
    setCreatingPortfolio(true);
    try {
      const res = await api.post('/sales-kit/portfolios', portfolioForm);
      setNewPortfolioOpen(false);
      setPortfolios(prev => [{ ...res.data, response_count: 0, click_count: 0 }, ...prev]);
      setSharePortfolio(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create portfolio');
    } finally {
      setCreatingPortfolio(false);
    }
  };

  const openPortfolioResponses = async (p) => {
    try {
      const res = await api.get(`/sales-kit/portfolios/${p.portfolio_id}/responses`);
      setActivePortfolio(res.data.portfolio);
      setPortfolioResponses(res.data.responses || []);
      setPortfolioClicks(res.data.clicks || []);
      setPortfolioView('responses');
    } catch (e) {
      toast.error('Failed to load responses');
    }
  };

  const confirmDeletePortfolio = async () => {
    if (!deletePortfolioTarget) return;
    try {
      await api.delete(`/sales-kit/portfolios/${deletePortfolioTarget.portfolio_id}`);
      toast.success('Portfolio deleted');
      setPortfolios(prev => prev.filter(x => x.portfolio_id !== deletePortfolioTarget.portfolio_id));
      setDeletePortfolioTarget(null);
    } catch (e) {
      toast.error('Failed to delete portfolio');
    }
  };

  const deletePortfolioResponseRow = async (responseId) => {
    try {
      await api.delete(`/sales-kit/portfolio-responses/${responseId}`);
      setPortfolioResponses(prev => prev.filter(r => r.response_id !== responseId));
      toast.success('Response deleted');
    } catch (e) {
      toast.error('Failed to delete response');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <button
          onClick={() => { window.location.href = '/leads'; }}
          className={`text-sm ${textSecondary} hover:underline mb-3 inline-flex items-center gap-1`}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Sales Department
        </button>

        <h1 className={`text-xl font-semibold ${textPrimary} mb-4`}>Sales Kit</h1>

        <div className="flex items-center gap-2 mb-5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setView('list'); setPortfolioView('list'); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                  isActive ? 'bg-[#3b82f6] text-white' : `${bgSecondary} ${textSecondary} hover:${textPrimary}`
                }`}
                data-testid={`sk-tab-${tab.key}`}
              >
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'forms' && (
          <>
            {view === 'list' && (
              <FormsListView
                forms={forms}
                onCreate={openCreate}
                onEdit={openEdit}
                onResponses={openResponses}
                onShare={setShareForm}
                onDuplicate={duplicateForm}
                onDelete={setDeleteTarget}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                borderColor={borderColor}
                bgCard={bgCard}
              />
            )}
            {view === 'builder' && activeForm && (
              <FormBuilderView
                initialForm={activeForm}
                onCancel={() => { setView('list'); loadForms(); }}
                onSaved={handleSaved}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                borderColor={borderColor}
                bgCard={bgCard}
                bgSecondary={bgSecondary}
              />
            )}
            {view === 'responses' && activeForm && (
              <ResponsesView
                form={activeForm}
                responses={responses}
                onBack={() => setView('list')}
                onDeleteResponse={deleteResponseRow}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                borderColor={borderColor}
                bgSecondary={bgSecondary}
              />
            )}
          </>
        )}

        {activeTab === 'portfolio' && (
          <>
            {portfolioView === 'list' && (
              <PortfolioListView
                portfolios={portfolios}
                onCreate={openPortfolioCreate}
                onResponses={openPortfolioResponses}
                onShare={setSharePortfolio}
                onDelete={setDeletePortfolioTarget}
                linkTypeFilter={portfolioLinkTypeFilter}
                onLinkTypeFilterChange={setPortfolioLinkTypeFilter}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                borderColor={borderColor}
                bgCard={bgCard}
                bgSecondary={bgSecondary}
              />
            )}
            {portfolioView === 'responses' && activePortfolio && (
              <PortfolioResponsesView
                portfolio={activePortfolio}
                responses={portfolioResponses}
                clicks={portfolioClicks}
                onBack={() => setPortfolioView('list')}
                onDeleteResponse={deletePortfolioResponseRow}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                borderColor={borderColor}
                bgSecondary={bgSecondary}
              />
            )}
          </>
        )}
      </div>

      <Dialog open={newFormOpen} onOpenChange={setNewFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Form</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Form Title</Label>
            <Input
              value={newFormTitle}
              onChange={(e) => setNewFormTitle(e.target.value)}
              placeholder="e.g. Website Requirement Gathering"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') createForm(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFormOpen(false)}>Cancel</Button>
            <Button onClick={createForm} disabled={creating} className="bg-[#3b82f6] hover:bg-[#2563eb]">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create & Edit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareForm} onOpenChange={(o) => !o && setShareForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Share Form</DialogTitle></DialogHeader>
          {shareForm && (
            <>
              {shareForm.status !== 'published' && (
                <p className="text-xs text-[#f59e0b] mb-2">This form is a draft — publish it (via Edit) so the link works for respondents.</p>
              )}
              <div className="flex items-center gap-2">
                <Input readOnly value={`${window.location.origin}/form/${shareForm.share_token}`} className="flex-1" />
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/form/${shareForm.share_token}`);
                    toast.success('Link copied');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Form</DialogTitle></DialogHeader>
          <p className={`text-sm ${textSecondary}`}>Delete "{deleteTarget?.title}"? This also hides its collected responses.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button onClick={confirmDelete} className="bg-[#ef4444] hover:bg-[#dc2626]">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newPortfolioOpen} onOpenChange={setNewPortfolioOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Portfolio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Service Name</Label>
              <Input
                value={portfolioForm.service_name}
                onChange={(e) => setPortfolioForm(prev => ({ ...prev, service_name: e.target.value }))}
                placeholder="e.g. E-commerce Website Development"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select
                value={portfolioForm.service_type}
                onValueChange={(v) => setPortfolioForm(prev => ({ ...prev, service_type: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                <SelectContent>
                  {services.map(s => <SelectItem key={s.service_id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Link Type</Label>
              <Select
                value={portfolioForm.link_type}
                onValueChange={(v) => setPortfolioForm(prev => ({ ...prev, link_type: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Portfolio Link</Label>
              <Input
                value={portfolioForm.portfolio_link}
                onChange={(e) => setPortfolioForm(prev => ({ ...prev, portfolio_link: e.target.value }))}
                placeholder="https://drive.google.com/... or your portfolio URL"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPortfolioOpen(false)}>Cancel</Button>
            <Button onClick={createPortfolio} disabled={creatingPortfolio} className="bg-[#3b82f6] hover:bg-[#2563eb]">
              {creatingPortfolio ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Link2 className="h-4 w-4 mr-1.5" /> Save &amp; Generate Links</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sharePortfolio} onOpenChange={(o) => !o && setSharePortfolio(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Share Portfolio</DialogTitle></DialogHeader>
          {sharePortfolio && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm">
                  <MousePointerClick className="h-3.5 w-3.5" /> Public link
                </Label>
                <p className="text-xs text-gray-500">No form — click, and straight to the portfolio. Just counts the click.</p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={`${process.env.REACT_APP_BACKEND_URL}/api/sales-kit/public/portfolio/${sharePortfolio.share_token}`} className="flex-1" />
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${process.env.REACT_APP_BACKEND_URL}/api/sales-kit/public/portfolio/${sharePortfolio.share_token}`);
                      toast.success('Public link copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm">
                  <UserCheck className="h-3.5 w-3.5" /> Private link
                </Label>
                <p className="text-xs text-gray-500">Asks for name + email first, then redirects — each submission is a lead.</p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={`${window.location.origin}/portfolio/${sharePortfolio.private_token}`} className="flex-1" />
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/portfolio/${sharePortfolio.private_token}`);
                      toast.success('Private link copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletePortfolioTarget} onOpenChange={(o) => !o && setDeletePortfolioTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Portfolio</DialogTitle></DialogHeader>
          <p className={`text-sm ${textSecondary}`}>Delete "{deletePortfolioTarget?.service_name}"? This also hides its collected responses.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePortfolioTarget(null)}>Cancel</Button>
            <Button onClick={confirmDeletePortfolio} className="bg-[#ef4444] hover:bg-[#dc2626]">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default SalesKitPage;
