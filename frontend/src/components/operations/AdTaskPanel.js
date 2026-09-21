import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Megaphone, ExternalLink, CheckCircle2, Lock, Download } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SETUP_LABEL = { pending: 'Pending', in_review: 'In Review', published: 'Published' };

// A Meta Ads ad task (Content / Creative / Editing / Ad Setup), shown in the
// task view with the ad's details. Only the assignee acts on it, and the
// steps are ordered:
//   Content            — submit the content link; that completes the task
//   Creative / Editing — locked until Content is done; then upload the
//                        creative (image) and/or give its link to complete it
//   Ad Setup           — locked until Content + Creative (+ Editing for a
//                        Reel) are done; shows all of them, then mark the ad
//                        In Review or Publish it (Publish completes the task)
export default function AdTaskPanel({ task, headers, onSubmitted, textPrimary, textSecondary, bgSecondary, borderColor }) {
  const [ctx, setCtx] = useState(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [file, setFile] = useState(null); // { name, content_type, data_url }

  useEffect(() => {
    let cancelled = false;
    setCtx(null);
    setError('');
    axios.get(`${API}/api/ad-tasks/tasks/${task.task_id}/context`, { headers })
      .then((res) => {
        if (cancelled) return;
        setCtx(res.data);
        // Pre-fill with what's already on the ad for this step.
        setLink((l) => l || res.data[`${res.data.field}_link`] || '');
      })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.detail || 'Could not load the ad details'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.task_id, task.status, refreshKey]);

  const submit = async (body, okMessage) => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/api/ad-tasks/tasks/${task.task_id}/submit`, body, { headers });
      toast.success(okMessage);
      setFile(null);
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

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) { toast.error('Upload a PNG, JPG, GIF or WebP image — share videos as a link'); return; }
    if (f.size > MAX_IMAGE_BYTES) { toast.error('Image is too large (max 5MB) — share it as a link instead'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setFile({ name: f.name, content_type: f.type, data_url: reader.result });
    reader.readAsDataURL(f);
  };

  const submitContent = async () => {
    if (!link.trim()) { toast.error('Paste the content link first'); return; }
    await submit({ link: link.trim() }, completed ? 'Content link updated' : 'Content submitted — task completed');
  };
  const submitCreative = async () => {
    if (!link.trim() && !file) { toast.error('Upload the creative or add its link'); return; }
    await submit(
      { link: link.trim() || null, file },
      completed ? `${ctx.field_label} updated` : `${ctx.field_label} submitted — task completed`,
    );
  };

  const field = ctx?.field;
  const completed = ctx ? ctx.task_status === 'completed' : task.status === 'completed';

  const row = (label, value) => (
    <div className="flex justify-between gap-3 text-sm">
      <span className={textSecondary}>{label}</span>
      <span className={`${textPrimary} text-right`}>{value || '—'}</span>
    </div>
  );
  const openLink = (href) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-[#3b82f6] hover:underline inline-flex items-center gap-1">Open <ExternalLink className="h-3 w-3" /></a>
  );
  const filePreview = (f) => (
    <div className="mt-1">
      <img src={f.data_url} alt={f.name || 'creative'} className={`max-h-48 rounded-lg border ${borderColor}`} />
      <a href={f.data_url} download={f.name || 'creative'} className="text-xs text-[#3b82f6] hover:underline inline-flex items-center gap-1 mt-1">
        <Download className="h-3 w-3" /> {f.name || 'Download'}
      </a>
    </div>
  );
  // What earlier steps delivered, for the assignee to work from.
  const deliverable = (label, linkValue, fileValue) => (linkValue || fileValue) && (
    <div className={`border-t ${borderColor} pt-2`} data-testid={`ad-ref-${label.toLowerCase()}`}>
      <div className="flex justify-between gap-3 text-sm">
        <span className={textSecondary}>{label}</span>
        {linkValue ? openLink(linkValue) : <span className={`text-xs ${textSecondary}`}>Uploaded</span>}
      </div>
      {fileValue && filePreview(fileValue)}
    </div>
  );

  const showContentRef = field && field !== 'content';
  const showCreativeRef = field === 'setup' || field === 'editing';
  const showEditingRef = field === 'setup' && ctx?.requires_editing;
  const assigneeName = task.assigned_to_name || 'the assignee';

  return (
    <div className={`rounded-lg border-2 border-[#3b82f6]/40 ${bgSecondary} p-4 space-y-3`} data-testid="ad-task-panel">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-[#3b82f6]/20 text-[#3b82f6]"><Megaphone className="h-3 w-3 mr-1" />Meta Ads</Badge>
        <span className={`text-sm font-semibold ${textPrimary}`}>Ad · {ctx?.field_label || 'Task'}</span>
        {completed && <Badge className="bg-emerald-500/20 text-emerald-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!ctx && !error && <p className={`text-sm ${textSecondary}`}>Loading ad details…</p>}

      {ctx && (
        <>
          <div className="space-y-1.5" data-testid="ad-task-details">
            {row('Project', ctx.project_name)}
            {row('Ad Title', ctx.ad_name)}
            {row('Ad Set', ctx.ad_set_name)}
            {row('Campaign', ctx.campaign_name)}
            {row('Ad Type', ctx.ad_type ? ctx.ad_type.charAt(0).toUpperCase() + ctx.ad_type.slice(1) : '')}
            {row('Locations', (ctx.locations || []).join(', '))}
            {row('Due Date', task.due_date)}
            {field === 'setup' && row('Ad Status', SETUP_LABEL[ctx.setup_status] || ctx.setup_status)}
          </div>

          {showContentRef && deliverable('Content Link', ctx.content_link, null)}
          {showCreativeRef && deliverable('Creative', ctx.creative_link, ctx.creative_file)}
          {showEditingRef && deliverable('Editing', ctx.editing_link, ctx.editing_file)}

          {/* Locked until the earlier steps are done */}
          {!completed && ctx.blocked && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1" data-testid="ad-task-blocked">
              <p className="text-sm font-medium text-amber-500 flex items-center gap-1.5"><Lock className="h-4 w-4" /> Not ready to start</p>
              <p className={`text-xs ${textSecondary}`}>{ctx.blocked_message}</p>
            </div>
          )}

          {!completed && !ctx.blocked && !ctx.is_assignee && (
            <p className={`text-xs ${textSecondary}`}>Only {assigneeName} can submit this task.</p>
          )}

          {/* The assignee's action */}
          {ctx.can_submit && field === 'content' && (
            <div className={`border-t ${borderColor} pt-3 space-y-2`} data-testid="ad-content-form">
              <p className={`text-sm font-medium ${textPrimary}`}>{completed ? 'Content link — update' : 'Content link'}</p>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" data-testid="ad-content-link-input" />
              <p className={`text-xs ${textSecondary}`}>
                {completed ? 'This task is completed — you can still correct the link.' : "The task can't be completed without the content link."}
              </p>
              <Button type="button" onClick={submitContent} disabled={busy} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white" data-testid="ad-content-submit">
                {busy ? (completed ? 'Saving…' : 'Submitting…') : (completed ? 'Save changes' : 'Submit & Complete Task')}
              </Button>
            </div>
          )}

          {ctx.can_submit && (field === 'creative' || field === 'editing') && (
            <div className={`border-t ${borderColor} pt-3 space-y-2`} data-testid="ad-creative-form">
              <p className={`text-sm font-medium ${textPrimary}`}>{ctx.field_label} — {completed ? 'update your upload or link' : 'upload and link'}</p>
              {completed && ctx[`${field}_file`] && !file && (
                <div data-testid="ad-current-upload">
                  <p className={`text-xs ${textSecondary}`}>Current upload</p>
                  {filePreview(ctx[`${field}_file`])}
                </div>
              )}
              <input
                type="file"
                accept={IMAGE_TYPES.join(',')}
                onChange={pickFile}
                className={`text-sm ${textSecondary}`}
                data-testid="ad-creative-file-input"
              />
              {file && filePreview(file)}
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Creative link (https://…)" data-testid="ad-creative-link-input" />
              <p className={`text-xs ${textSecondary}`}>
                {completed
                  ? 'This task is completed — choose a new image to replace the upload and/or change the link. Videos go in as a link.'
                  : 'Upload an image (up to 5MB), add a link, or both. Share videos as a link.'}
              </p>
              <Button type="button" onClick={submitCreative} disabled={busy} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white" data-testid="ad-creative-submit">
                {busy ? (completed ? 'Saving…' : 'Submitting…') : (completed ? 'Save changes' : 'Submit & Complete Task')}
              </Button>
            </div>
          )}

          {ctx.can_submit && field === 'setup' && (
            <div className={`border-t ${borderColor} pt-3 space-y-2`} data-testid="ad-setup-form">
              <p className={`text-sm font-medium ${textPrimary}`}>Set the ad status</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => submit({ action: 'in_review' }, 'Ad marked In Review')}
                  disabled={busy || ctx.setup_status === 'in_review'}
                  data-testid="ad-setup-in-review"
                >
                  Mark In Review
                </Button>
                <Button
                  type="button"
                  onClick={() => submit({ action: 'publish' }, 'Ad published — task completed')}
                  disabled={busy}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="ad-setup-publish"
                >
                  Publish & Complete Task
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
