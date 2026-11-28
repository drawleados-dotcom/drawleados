import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Globe, KeyRound, Copy, Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = process.env.REACT_APP_BACKEND_URL;
const INTAKE_URL = `${API || window.location.origin}/api/leads-v2/public/leads`;
// Lead source the website's keys belong to: matched to an existing source in
// any letter case ("website" / "Website"), created on the first key otherwise.
const WEBSITE_SOURCE = 'Website';
// The website's sub_source for each of its forms; leads show as "Website/Popup" etc.
const WEBSITE_FORMS = ['Popup', 'Calendar', 'WhatsApp'];

const SAMPLE_BODY = `{
  "external_id": "booking-12",
  "name": "Kumar Dass",
  "phone": "9876543210",
  "email": "kumar@example.com",
  "sub_source": "Calendar",
  "notes": "Calendar booking · Call: 2 Dec, 3:00 PM",
  "date_of_lead": "2026-11-28"
}`;

const fmtDate = (iso) => (iso
  ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'never');

const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied');
  } catch (e) {
    toast.error('Copy failed — select the text and copy it manually');
  }
};

/**
 * Sales Department > Website tab. An admin generates an API key here and
 * pastes it, with the endpoint URL, into the website's Admin Panel > Lead
 * Source > "Drawlead OS connection". From then on every calendar booking and
 * WhatsApp chat on the website lands in Pre-sales > Lead with source
 * "Website/Popup", "Website/Calendar" or "Website/WhatsApp" (the form it came through).
 */
const WebsiteIntegrationPanel = ({ isAdmin, isDark, textPrimary, textSecondary, borderColor, bgCard, bgSecondary }) => {
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [newKey, setNewKey] = useState(''); // full key — only available right after generating

  const loadKeys = async () => {
    try {
      const res = await axios.get(`${API}/api/leads-v2/api-keys`, { headers, params: { source_name: WEBSITE_SOURCE } });
      setKeys(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(
        `${API}/api/leads-v2/api-keys`,
        { source_name: WEBSITE_SOURCE, label: label.trim() || 'Drawlead website' },
        { headers },
      );
      setNewKey(res.data.api_key);
      setLabel('');
      loadKeys();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async (key) => {
    if (!window.confirm(`Revoke "${key.label}"? The website will stop sending leads with this key until you paste a new one.`)) return;
    try {
      await axios.delete(`${API}/api/leads-v2/api-keys/${key.key_id}`, { headers });
      toast.success('API key revoked');
      loadKeys();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to revoke API key');
    }
  };

  const card = `${bgCard} border ${borderColor} rounded-xl p-5`;
  const sectionLabel = `text-xs font-medium uppercase tracking-wide ${textSecondary}`;

  if (!isAdmin) {
    return (
      <div className="px-4 py-4" data-testid="website-integration-panel">
        <div className={card}>
          <div className={`flex items-center gap-2 text-lg font-semibold ${textPrimary}`}>
            <Globe className="h-5 w-5 text-[#3b82f6]" /> Website connection
          </div>
          <p className={`text-sm mt-2 ${textSecondary}`}>
            Only an admin can generate the API key that connects the website. Ask an admin to open this tab.
          </p>
        </div>
      </div>
    );
  }

  const totalLeads = keys.reduce((n, k) => n + (k.leads_received || 0), 0);
  const lastUsed = keys.map(k => k.last_used_at).filter(Boolean).sort().pop();
  const status = keys.length === 0
    ? { text: 'Not connected', cls: `${bgSecondary} ${textSecondary}` }
    : lastUsed
      ? { text: 'Connected', cls: 'bg-emerald-500/15 text-emerald-500' }
      : { text: 'Key ready — waiting for the website', cls: 'bg-amber-500/15 text-amber-500' };

  return (
    <div className="px-4 py-4 space-y-4" data-testid="website-integration-panel">
      {/* Header + status */}
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className={`flex items-center gap-2 text-lg font-semibold ${textPrimary}`}>
              <Globe className="h-5 w-5 text-[#3b82f6]" /> Website connection
            </div>
            <p className={`text-sm mt-1 ${textSecondary}`}>
              Connect the Drawlead website so every calendar booking and WhatsApp chat lands in{' '}
              <span className={textPrimary}>Pre-sales → Lead</span> automatically. The source shows which form it came through:{' '}
              {WEBSITE_FORMS.map((form, i) => (
                <React.Fragment key={form}>
                  {i > 0 && (i === WEBSITE_FORMS.length - 1 ? ' or ' : ', ')}
                  <span className={textPrimary}>&ldquo;{WEBSITE_SOURCE}/{form}&rdquo;</span>
                </React.Fragment>
              ))}.
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.cls}`} data-testid="website-connection-status">{status.text}</span>
        </div>
        {keys.length > 0 && (
          <div className="flex gap-8 mt-4">
            <div>
              <div className={`text-2xl font-semibold ${textPrimary}`}>{totalLeads}</div>
              <div className={sectionLabel}>Leads received</div>
            </div>
            <div>
              <div className={`text-sm font-medium mt-1.5 ${textPrimary}`}>{fmtDate(lastUsed)}</div>
              <div className={`${sectionLabel} mt-1`}>Last contact from website</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Step 1 — generate */}
        <div className={`${card} space-y-3`}>
          <div className={`font-semibold ${textPrimary}`}>1. Generate an API key</div>
          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !generating) generate(); }}
              placeholder="Label, e.g. Drawlead website"
              className={bgSecondary}
              data-testid="api-key-label-input"
            />
            <Button onClick={generate} disabled={generating} className="bg-[#3b82f6] hover:bg-[#2563eb] shrink-0" data-testid="generate-api-key-btn">
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1" />}
              Generate API key
            </Button>
          </div>

          {newKey && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-2" data-testid="new-api-key-box">
              <p className="text-sm text-amber-500 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                Copy this key now. For security it won&apos;t be shown again — if you lose it, generate a new one.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={newKey} className={`${bgSecondary} font-mono text-xs`} onFocus={(e) => e.target.select()} data-testid="new-api-key-value" />
                <Button size="icon" onClick={() => copy(newKey)} title="Copy API key" className="shrink-0 bg-[#3b82f6] hover:bg-[#2563eb]">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className={sectionLabel}>Endpoint URL</p>
            <div className="flex gap-2">
              <Input readOnly value={INTAKE_URL} className={`${bgSecondary} font-mono text-xs`} onFocus={(e) => e.target.select()} data-testid="api-endpoint-url" />
              <Button variant="outline" size="icon" onClick={() => copy(INTAKE_URL)} title="Copy endpoint URL" className="shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2 — paste into the website */}
        <div className={`${card} space-y-3`}>
          <div className={`font-semibold ${textPrimary}`}>2. Paste it into the website</div>
          <ol className={`text-sm space-y-2 list-decimal pl-5 ${textSecondary}`}>
            <li>Open the website&apos;s <span className={textPrimary}>Admin Panel → Lead Source</span>.</li>
            <li>In <span className={textPrimary}>Drawlead OS connection</span>, paste the <span className={textPrimary}>Endpoint URL</span> and the <span className={textPrimary}>API key</span>.</li>
            <li>Click <span className={textPrimary}>Save &amp; test</span>. It should say it&apos;s connected.</li>
          </ol>
          <p className={`text-sm flex items-start gap-2 ${textSecondary}`}>
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
            That&apos;s all. The leads the website already has come over on their own in the background, and every new
            lead arrives as soon as it&apos;s submitted. If the OS is down, the website tries again later. A lead sent twice is only added once.
          </p>
        </div>
      </div>

      {/* Active keys */}
      <div className={`${card} space-y-2`}>
        <div className={`font-semibold ${textPrimary}`}>Active keys</div>
        {loading ? (
          <p className={`text-sm ${textSecondary} py-2`}>Loading…</p>
        ) : keys.length === 0 ? (
          <p className={`text-sm ${textSecondary} py-2`}>No keys yet — generate one above.</p>
        ) : (
          <div className="space-y-1">
            {keys.map((k) => (
              <div key={k.key_id} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md ${bgSecondary}`} data-testid={`api-key-row-${k.key_id}`}>
                <div className="min-w-0">
                  <p className={`text-sm truncate ${textPrimary}`}>
                    {k.label} <span className={`font-mono text-xs ${textSecondary}`}>{k.key_preview}…</span>
                  </p>
                  <p className={`text-xs ${textSecondary}`}>
                    Created {fmtDate(k.created_at)}{k.created_by_name ? ` by ${k.created_by_name}` : ''}
                    {' · '}Last used {fmtDate(k.last_used_at)}
                    {' · '}{k.leads_received || 0} lead{k.leads_received === 1 ? '' : 's'}
                  </p>
                </div>
                <button onClick={() => revoke(k)} className="text-red-400 hover:text-red-500 shrink-0" title="Revoke key" data-testid={`revoke-api-key-${k.key_id}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <details className={`text-sm pt-2 ${textSecondary}`}>
          <summary className="cursor-pointer select-none">Technical details (for a developer)</summary>
          <div className="mt-2 space-y-2">
            <p>
              <span className="font-mono">POST</span> the lead to the endpoint URL from a <b>server</b> (never from browser
              JavaScript, where visitors could read the key), with the header{' '}
              <span className="font-mono">X-API-Key: &lt;key&gt;</span>. A <span className="font-mono">GET</span> with the same
              header tests the key without creating a lead. Body (JSON or form fields):
            </p>
            <pre className={`${bgSecondary} ${textPrimary} rounded-md p-3 text-xs overflow-x-auto`}>{SAMPLE_BODY}</pre>
            <p>
              Only one of name, phone or email is required. <span className="font-mono">external_id</span> stops the same
              lead being added twice. <span className="font-mono">sub_source</span> is the form the lead came through, shown
              after the source (&ldquo;{WEBSITE_SOURCE}/Calendar&rdquo;). Other accepted fields: company, city, service, message.
              Anything else is saved on the lead.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
};

export default WebsiteIntegrationPanel;
