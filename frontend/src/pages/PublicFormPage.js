import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight, FileWarning } from 'lucide-react';

const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Explicit text/background colors — this page is always light-themed
// regardless of the visitor's OS/browser dark-mode preference, and the
// Input/Textarea components otherwise inherit color from theme CSS
// variables that can resolve to white-on-white here.
const FIELD_CLASS = 'text-gray-900 bg-white placeholder:text-gray-400';

const PublicFormPage = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_BASE}/sales-kit/public/${token}`)
      .then((res) => { if (!cancelled) setForm(res.data); })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full text-center">
          <FileWarning className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 font-medium mb-1">Form not available</p>
          <p className="text-sm text-gray-500">This link may have expired, or the form hasn't been published yet.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full text-center">
          <CheckCircle2 className="h-10 w-10 text-[#22c55e] mx-auto mb-3" />
          <p className="text-gray-900 font-medium mb-1">Thank you!</p>
          <p className="text-sm text-gray-500">Your response has been submitted.</p>
        </div>
      </div>
    );
  }

  const pages = form.pages || [];
  const page = pages[pageIdx];
  const isLastPage = pageIdx === pages.length - 1;

  const setAnswer = (fieldId, value) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
    setErrors(prev => (prev[fieldId] ? { ...prev, [fieldId]: undefined } : prev));
  };

  const toggleCheckbox = (fieldId, option, checked) => {
    const current = Array.isArray(answers[fieldId]) ? answers[fieldId] : [];
    const next = checked ? [...current, option] : current.filter(o => o !== option);
    setAnswer(fieldId, next);
  };

  const validatePage = () => {
    const nextErrors = {};
    for (const field of page.fields || []) {
      if (field.type === 'section_heading' || !field.required) continue;
      const val = answers[field.field_id];
      const isEmpty = Array.isArray(val) ? val.length === 0 : (val === undefined || val === null || String(val).trim() === '');
      if (isEmpty) nextErrors[field.field_id] = 'This field is required';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validatePage()) return;
    if (isLastPage) { handleSubmit(); return; }
    setPageIdx(i => i + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setPageIdx(i => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/sales-kit/public/${token}/submit`, { answers });
      setSubmitted(true);
    } catch (e) {
      setErrors({ _submit: 'Something went wrong submitting the form. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    if (field.type === 'section_heading') {
      return <h3 key={field.field_id} className="text-base font-semibold text-gray-900 pt-2">{field.label}</h3>;
    }
    const error = errors[field.field_id];
    return (
      <div key={field.field_id} className="space-y-1.5">
        <Label className="text-sm text-gray-800">
          {field.label || 'Untitled question'}{field.required && <span className="text-[#ef4444]"> *</span>}
        </Label>
        {field.type === 'short_text' && (
          <Input value={answers[field.field_id] || ''} placeholder={field.placeholder} onChange={(e) => setAnswer(field.field_id, e.target.value)} className={FIELD_CLASS} />
        )}
        {field.type === 'long_text' && (
          <Textarea value={answers[field.field_id] || ''} placeholder={field.placeholder} rows={3} onChange={(e) => setAnswer(field.field_id, e.target.value)} className={FIELD_CLASS} />
        )}
        {field.type === 'number' && (
          <Input type="number" value={answers[field.field_id] || ''} placeholder={field.placeholder} onChange={(e) => setAnswer(field.field_id, e.target.value)} className={FIELD_CLASS} />
        )}
        {field.type === 'email' && (
          <Input type="email" value={answers[field.field_id] || ''} placeholder={field.placeholder} onChange={(e) => setAnswer(field.field_id, e.target.value)} className={FIELD_CLASS} />
        )}
        {field.type === 'phone' && (
          <Input type="tel" value={answers[field.field_id] || ''} placeholder={field.placeholder} onChange={(e) => setAnswer(field.field_id, e.target.value)} className={FIELD_CLASS} />
        )}
        {field.type === 'date' && (
          <Input type="date" value={answers[field.field_id] || ''} onChange={(e) => setAnswer(field.field_id, e.target.value)} className={FIELD_CLASS} />
        )}
        {field.type === 'dropdown' && (
          <Select value={answers[field.field_id] || ''} onValueChange={(v) => setAnswer(field.field_id, v)}>
            <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt, i) => <SelectItem key={i} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {field.type === 'radio' && (
          <RadioGroup value={answers[field.field_id] || ''} onValueChange={(v) => setAnswer(field.field_id, v)}>
            {(field.options || []).map((opt, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <RadioGroupItem value={opt} id={`${field.field_id}-${i}`} /> {opt}
              </label>
            ))}
          </RadioGroup>
        )}
        {field.type === 'checkbox' && (
          <div className="space-y-1.5">
            {(field.options || []).map((opt, i) => {
              const checked = Array.isArray(answers[field.field_id]) && answers[field.field_id].includes(opt);
              return (
                <label key={i} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={(c) => toggleCheckbox(field.field_id, opt, !!c)} /> {opt}
                </label>
              );
            })}
          </div>
        )}
        {error && <p className="text-xs text-[#ef4444]">{error}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">{form.title}</h1>
          {form.description && <p className="text-sm text-gray-500 mb-4">{form.description}</p>}
          {pages.length > 1 && (
            <p className="text-xs text-gray-400 mb-4">Page {pageIdx + 1} of {pages.length}{page.title ? ` — ${page.title}` : ''}</p>
          )}

          <div className="space-y-5">
            {(page.fields || []).map(renderField)}
          </div>

          {errors._submit && <p className="text-xs text-[#ef4444] mt-4">{errors._submit}</p>}

          <div className="flex items-center justify-between mt-7">
            <Button variant="outline" onClick={goBack} disabled={pageIdx === 0} className="text-gray-600">
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button onClick={goNext} disabled={submitting} className="bg-[#3b82f6] hover:bg-[#2563eb]">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isLastPage ? 'Submit' : <>Next <ChevronRight className="h-4 w-4 ml-1" /></>)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicFormPage;
