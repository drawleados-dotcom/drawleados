import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { CalendarDays, ExternalLink, CheckCircle2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LINK_LABELS = {
  content_link: 'Content Link',
  creative_link: 'Creative Link',
  editing_link: 'Editing',
  thumbnail_link: 'Thumbnail',
};

// A Content Calendar task, shown in the task view with the post's details.
// Only the assignee can act on it, and what they do here updates the post on
// the calendar:
//   link   (Content/Creative/Editing/Thumbnail) — submit the link, completes it
//   posting — Schedule (with a date) or mark Posted; posting creates the
//             next-day report task
//   report  — the live post link + likes / comments / shares / reach
export default function CalendarTaskPanel({ task, headers, onSubmitted, textPrimary, textSecondary, bgSecondary, borderColor }) {
  const [ctx, setCtx] = useState(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);

  // link
  const [link, setLink] = useState('');
  // posting
  const [postMode, setPostMode] = useState(''); // '' | 'schedule' | 'post'
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  // report
  const [reportLink, setReportLink] = useState('');
  const [metrics, setMetrics] = useState({ likes: '', comments: '', shares: '', reach: '' });

  useEffect(() => {
    let cancelled = false;
    setCtx(null);
    setError('');
    axios.get(`${API}/api/our-tasks/tasks/${task.task_id}/calendar-context`, { headers })
      .then((res) => {
        if (cancelled) return;
        setCtx(res.data);
        setSchedDate((d) => d || res.data.scheduled_date || res.data.post_date || '');
        setSchedTime((t) => t || res.data.scheduled_time || '');
        setReportLink((l) => l || res.data.post_link || '');
      })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.detail || 'Could not load the post details'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.task_id, task.status, refreshKey]);

  const call = async (path, body, okMessage) => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/api/our-tasks/tasks/${task.task_id}/${path}`, body, { headers });
      toast.success(okMessage);
      setRefreshKey((k) => k + 1);
      onSubmitted?.(res.data);
      return true;
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'That did not save — check the values and try again');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitLink = async () => {
    if (!link.trim()) { toast.error('Paste the link first'); return; }
    if (await call('calendar-submit', { link: link.trim() }, 'Link submitted — task completed')) setLink('');
  };

  const confirmPosting = async () => {
    if (postMode === 'schedule') {
      if (!schedDate) { toast.error('Pick the date it is scheduled for'); return; }
      if (await call('calendar-posting', { action: 'schedule', scheduled_date: schedDate, scheduled_time: schedTime || null }, 'Scheduled')) setPostMode('');
    } else if (postMode === 'post') {
      if (await call('calendar-posting', { action: 'post' }, 'Marked as posted — a report task is created for tomorrow')) setPostMode('');
    }
  };

  const submitReport = async () => {
    if (!reportLink.trim()) { toast.error('Post link is required'); return; }
    const nums = {};
    for (const key of ['likes', 'comments', 'shares', 'reach']) {
      const n = parseInt(metrics[key], 10);
      if (Number.isNaN(n) || n < 0) { toast.error(`Enter ${key} (0 or more)`); return; }
      nums[key] = n;
    }
    await call('calendar-report', { post_link: reportLink.trim(), ...nums }, 'Report submitted — task completed');
  };

  const fieldLabel = ctx?.field_label || 'Content Calendar';
  const kind = ctx?.kind;
  const row = (label, value) => (
    <div className="flex justify-between gap-3 text-sm">
      <span className={textSecondary}>{label}</span>
      <span className={`${textPrimary} text-right`}>{value || '—'}</span>
    </div>
  );
  const openLink = (href) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-[#6366f1] hover:underline inline-flex items-center gap-1">Open <ExternalLink className="h-3 w-3" /></a>
  );
  const stat = (label, value) => (
    <div className={`rounded-lg border ${borderColor} p-3 text-center`}>
      <p className={`text-xs ${textSecondary}`}>{label}</p>
      <p className={`text-xl font-bold ${textPrimary}`}>{Number(value ?? 0).toLocaleString()}</p>
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
          {/* Everything about the post */}
          <div className="space-y-1.5" data-testid="calendar-task-details">
            {row('Project', ctx.project_name)}
            {row('Post Title', ctx.post_title)}
            {row('Post Date', ctx.post_date)}
            {row('Due Date', task.due_date)}
            {row('Platform', ctx.platform ? ctx.platform.charAt(0).toUpperCase() + ctx.platform.slice(1) : '')}
            {row('Post Type', ctx.post_type)}
            {Object.entries(ctx.links).filter(([f, v]) => v && f !== ctx.field).map(([f, v]) => (
              <div key={f} className="flex justify-between gap-3 text-sm">
                <span className={textSecondary}>{LINK_LABELS[f]}</span>
                {openLink(v)}
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

          {/* ---- link tasks ---- */}
          {kind === 'link' && (
            <>
              {ctx.current_link && (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-4 w-4" /> Submitted {fieldLabel}</span>
                  {openLink(ctx.current_link)}
                </div>
              )}
              {ctx.review_status === 'rejected' && (
                <p className="text-sm text-red-500">Rejected{ctx.reject_reason ? `: ${ctx.reject_reason}` : ''} — submit a corrected link below.</p>
              )}
              {ctx.can_submit ? (
                <div className="space-y-2">
                  <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder={`Paste the ${fieldLabel} link (https://...)`} data-testid="calendar-task-link-input" />
                  <Button type="button" onClick={submitLink} disabled={busy} className="bg-[#10b981] hover:bg-[#059669] text-white w-full" data-testid="calendar-task-submit">
                    {busy ? 'Submitting…' : 'Submit link & complete task'}
                  </Button>
                </div>
              ) : (
                !ctx.current_link && <p className={`text-xs ${textSecondary}`}>Only the assignee can add the link and complete this task.</p>
              )}
            </>
          )}

          {/* ---- posting tasks: schedule or post ---- */}
          {kind === 'posting' && (
            <div className={`border-t ${borderColor} pt-3 space-y-3`} data-testid="calendar-task-posting">
              <div className="flex items-center justify-between text-sm">
                <span className={textSecondary}>Post status</span>
                <span className={`font-medium ${ctx.entry_status === 'posted' ? 'text-emerald-500' : ctx.entry_status === 'scheduled' ? 'text-amber-500' : textPrimary}`}>
                  {ctx.entry_status === 'posted' ? 'Posted' : ctx.entry_status === 'scheduled'
                    ? `Scheduled for ${ctx.scheduled_date}${ctx.scheduled_time ? ` · ${ctx.scheduled_time}` : ''}` : 'Not scheduled yet'}
                </span>
              </div>
              {ctx.entry_status === 'posted' && (
                <p className={`text-xs ${textSecondary}`}>
                  Posted. A report task (post link + likes, comments, shares, reach) is due {ctx.report_due_date}.
                </p>
              )}
              {ctx.can_submit ? (
                <>
                  <div className="flex gap-2">
                    <Button type="button" variant={postMode === 'schedule' ? 'default' : 'outline'} onClick={() => setPostMode('schedule')} className="flex-1" data-testid="calendar-task-mode-schedule">Schedule</Button>
                    <Button type="button" variant={postMode === 'post' ? 'default' : 'outline'} onClick={() => setPostMode('post')} className="flex-1" data-testid="calendar-task-mode-post">Posted</Button>
                  </div>
                  {postMode === 'schedule' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className={textPrimary}>Scheduled Date <span className="text-red-500">*</span></Label>
                        <Input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} data-testid="calendar-task-schedule-date" />
                      </div>
                      <div>
                        <Label className={textSecondary}>Time (optional)</Label>
                        <Input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
                      </div>
                    </div>
                  )}
                  {postMode === 'post' && (
                    <p className={`text-xs ${textSecondary}`}>
                      This completes the task. On {ctx.report_due_date} you'll be asked for the post link and how it did.
                    </p>
                  )}
                  {postMode && (
                    <Button type="button" onClick={confirmPosting} disabled={busy} className="bg-[#10b981] hover:bg-[#059669] text-white w-full" data-testid="calendar-task-posting-confirm">
                      {busy ? 'Saving…' : postMode === 'schedule' ? 'Confirm schedule' : 'Confirm — mark as posted'}
                    </Button>
                  )}
                </>
              ) : (
                ctx.entry_status !== 'posted' && <p className={`text-xs ${textSecondary}`}>Only the assignee can schedule or post this.</p>
              )}
            </div>
          )}

          {/* ---- report task: post link + results ---- */}
          {kind === 'report' && (
            <div className={`border-t ${borderColor} pt-3 space-y-3`} data-testid="calendar-task-report">
              {ctx.post_report ? (
                <>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-4 w-4" /> Report submitted</span>
                    {ctx.post_link && openLink(ctx.post_link)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {stat('Likes', ctx.post_report.likes)}
                    {stat('Comments', ctx.post_report.comments)}
                    {stat('Shares', ctx.post_report.shares)}
                    {stat('Reach', ctx.post_report.reach)}
                  </div>
                </>
              ) : ctx.can_submit ? (
                <>
                  <div>
                    <Label className={textPrimary}>Post Link <span className="text-red-500">*</span></Label>
                    <Input value={reportLink} onChange={(e) => setReportLink(e.target.value)} placeholder="https://..." data-testid="calendar-task-report-link" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[['likes', 'Likes'], ['comments', 'Comments'], ['shares', 'Shares'], ['reach', 'Reach']].map(([key, label]) => (
                      <div key={key}>
                        <Label className={textPrimary}>{label} <span className="text-red-500">*</span></Label>
                        <Input
                          type="number"
                          min="0"
                          value={metrics[key]}
                          onChange={(e) => setMetrics((m) => ({ ...m, [key]: e.target.value }))}
                          data-testid={`calendar-task-report-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                  <Button type="button" onClick={submitReport} disabled={busy} className="bg-[#10b981] hover:bg-[#059669] text-white w-full" data-testid="calendar-task-report-submit">
                    {busy ? 'Submitting…' : 'Submit report & complete task'}
                  </Button>
                </>
              ) : (
                <p className={`text-xs ${textSecondary}`}>Only the assignee can submit this report.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
