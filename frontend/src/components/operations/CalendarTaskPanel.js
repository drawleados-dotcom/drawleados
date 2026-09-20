import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { CalendarDays, ExternalLink, CheckCircle2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LINK_LABELS = {
  content_link: 'Content Link',
  creative_link: 'Creative Link',
  editing_link: 'Editing',
  thumbnail_link: 'Thumbnail',
};

// A Content Calendar deliverable task (Content / Creative / Editing /
// Thumbnail link assigned from a project's calendar), shown in the task view
// with the post's details. Only the assignee can submit the link, which fills
// that column on the calendar post and completes the task.
export default function CalendarTaskPanel({ task, headers, onSubmitted, textPrimary, textSecondary, bgSecondary, borderColor }) {
  const [ctx, setCtx] = useState(null);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCtx(null);
    setError('');
    axios.get(`${API}/api/our-tasks/tasks/${task.task_id}/calendar-context`, { headers })
      .then((res) => { if (!cancelled) setCtx(res.data); })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.detail || 'Could not load the post details'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.task_id, task.status]);

  const submit = async () => {
    if (!link.trim()) { toast.error('Paste the link first'); return; }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/api/our-tasks/tasks/${task.task_id}/calendar-submit`, { link: link.trim() }, { headers });
      toast.success('Link submitted — task completed');
      setLink('');
      onSubmitted?.(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to submit the link');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldLabel = LINK_LABELS[task.content_calendar_field] || 'Link';
  const row = (label, value) => (
    <div className="flex justify-between gap-3 text-sm">
      <span className={textSecondary}>{label}</span>
      <span className={`${textPrimary} text-right`}>{value || '—'}</span>
    </div>
  );

  return (
    <div className={`rounded-lg border-2 border-[#ec4899]/40 ${bgSecondary} p-4 space-y-3`} data-testid="calendar-task-panel">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-[#ec4899]/20 text-[#ec4899]"><CalendarDays className="h-3 w-3 mr-1" />Social Media</Badge>
        <span className={`text-sm font-semibold ${textPrimary}`}>Content Calendar · {fieldLabel}</span>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!ctx && !error && <p className={`text-sm ${textSecondary}`}>Loading post details…</p>}

      {ctx && (
        <>
          <div className="space-y-1.5">
            {row('Project', ctx.project_name)}
            {row('Post Title', ctx.post_title)}
            {row('Post Date', ctx.post_date)}
            {row('Due Date', task.due_date)}
            {row('Platform', ctx.platform ? ctx.platform.charAt(0).toUpperCase() + ctx.platform.slice(1) : '')}
            {row('Post Type', ctx.post_type)}
            {Object.entries(ctx.links).filter(([f, v]) => v && f !== ctx.field).map(([f, v]) => (
              <div key={f} className="flex justify-between gap-3 text-sm">
                <span className={textSecondary}>{LINK_LABELS[f]}</span>
                <a href={v} target="_blank" rel="noreferrer" className="text-[#6366f1] hover:underline inline-flex items-center gap-1">Open <ExternalLink className="h-3 w-3" /></a>
              </div>
            ))}
          </div>
          {(ctx.description || ctx.hashtags || ctx.keywords) && (
            <div className={`border-t ${borderColor} pt-2 space-y-1`}>
              {ctx.description && <p className={`text-sm ${textPrimary} whitespace-pre-wrap`}>{ctx.description}</p>}
              {ctx.hashtags && <p className="text-xs text-[#6366f1]">{ctx.hashtags}</p>}
              {ctx.keywords && <p className={`text-xs ${textSecondary}`}>Keywords: {ctx.keywords}</p>}
            </div>
          )}

          {ctx.current_link && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-4 w-4" /> Submitted {fieldLabel}</span>
              <a href={ctx.current_link} target="_blank" rel="noreferrer" className="text-[#6366f1] hover:underline inline-flex items-center gap-1">Open <ExternalLink className="h-3 w-3" /></a>
            </div>
          )}
          {ctx.review_status === 'rejected' && (
            <p className="text-sm text-red-500">Rejected{ctx.reject_reason ? `: ${ctx.reject_reason}` : ''} — submit a corrected link below.</p>
          )}

          {ctx.can_submit ? (
            <div className="space-y-2">
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={`Paste the ${fieldLabel} link (https://...)`}
                data-testid="calendar-task-link-input"
              />
              <Button type="button" onClick={submit} disabled={submitting} className="bg-[#10b981] hover:bg-[#059669] text-white w-full" data-testid="calendar-task-submit">
                {submitting ? 'Submitting…' : 'Submit link & complete task'}
              </Button>
            </div>
          ) : (
            !ctx.current_link && <p className={`text-xs ${textSecondary}`}>Only the assignee can add the link and complete this task.</p>
          )}
        </>
      )}
    </div>
  );
}
