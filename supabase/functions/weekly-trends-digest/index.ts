// weekly-trends-digest Edge Function
//
// Sends a weekly trends briefing to hello@edeninstitute.health every Friday.
// Unlike the daily digest (raw captures), this one TRANSLATES the data into
// week-over-week trends: what's growing, what's stalling, anomalies, and one
// recommended focus.
//
// Flow:
//   1. Triggered by Vercel cron Friday 14:00 UTC (08:00 America/Chicago CST).
//      Cron route at api/cron/weekly-trends-digest.ts calls this EF with
//      SUPABASE_SERVICE_ROLE_KEY in the Authorization header.
//   2. INSERTs a pending weekly_trends_runs row keyed on run_date (CT). On
//      UNIQUE conflict, exits skipped="already_ran" (cron-retry idempotency).
//   3. Calls weekly_trends_snapshot() RPC — this-week vs last-week aggregates
//      (leads by funnel/source, traffic, quiz), testers/bots/unsubs excluded.
//   4. Computes deltas + a plain-language narrative and emails it via Resend.
//   5. UPDATEs the run row to status='sent' or 'failed'.
//
// Aggregate-only — no PII leaves the DB, and it never depends on any local
// tooling. Pure server-side, runs forever on the EF's service-role key.
//
// Env vars (Supabase EF secrets — all already set for notify-founder-digest):
//   RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   FOUNDER_EMAIL (default hello@), FROM_EMAIL (default The Eden Institute <hello@>).
//
// Public-callable: no (verify_jwt=true default; cron passes service_role JWT).

// deno-lint-ignore-file no-explicit-any

import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FOUNDER_EMAIL = Deno.env.get('FOUNDER_EMAIL') ?? 'hello@edeninstitute.health';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'The Eden Institute <hello@edeninstitute.health>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BySource { funnel: string; source: string; wk: 'this' | 'last'; n: number; }
interface Snapshot {
  generated_at: string;
  this_week_start: string;
  last_week_start: string;
  leads: { this: number; last: number; by_source: BySource[] };
  traffic_views: { this: number; last: number };
  traffic_visitors: { this: number; last: number };
  quiz: { this: number; last: number };
}

// ── (funnel, source) → human label, matching the daily digest vocabulary. ──
function friendly(funnel: string, source: string): string {
  if (funnel === 'quiz_funnel' || funnel === 'constitution_assessment') return 'Constitution Quiz';
  if (funnel === 'homeschool') {
    if (source === 'sprouts_magnet') return "Eden's Table · Sprouts (K-2) magnet";
    if (source === 'seedlings_magnet') return "Eden's Table · Seedlings (3-5) magnet";
    if (source === 'reserve') return "Eden's Table · Founders Club (Reserve)";
    return "Eden's Table · Homeschool (general)";
  }
  if (funnel === 'edens_table') {
    if (source === 'sprouts_magnet') return "Eden's Table · Sprouts (K-2) magnet";
    if (source === 'seedlings_magnet') return "Eden's Table · Seedlings (3-5) magnet";
    if (source === 'reserve') return "Eden's Table · Founders Club (Reserve)";
    if (source === 'constitution_assessment') return 'Constitution Quiz';
    return "Eden's Table · waitlist";
  }
  if (funnel === 'course_tier2') return 'Tier 2 (Root) · waitlist';
  if (funnel === 'app_beta') return 'Apothecary App · beta waitlist';
  if (funnel === 'practitioner_waitlist') return 'Practitioner · waitlist';
  if (funnel === 'community') return 'Community · waitlist';
  return `${funnel} · ${source}`;
}

function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Trend math ──
interface Trend { thisN: number; lastN: number; abs: number; pct: number | null; label: string; arrow: string; }
function trend(thisN: number, lastN: number): Trend {
  const abs = thisN - lastN;
  let pct: number | null = null;
  if (lastN > 0) pct = Math.round((abs / lastN) * 100);
  let label: string;
  let arrow: string;
  if (lastN === 0 && thisN === 0) { label = 'no activity'; arrow = '—'; }
  else if (lastN === 0) { label = 'new this week'; arrow = '▲'; }
  else if (pct !== null && pct >= 15) { label = 'accelerating'; arrow = '▲'; }
  else if (pct !== null && pct <= -15) { label = 'cooling'; arrow = '▼'; }
  else { label = 'steady'; arrow = '→'; }
  return { thisN, lastN, abs, pct, label, arrow };
}
function pctStr(t: Trend): string {
  if (t.lastN === 0 && t.thisN === 0) return 'flat (0)';
  if (t.lastN === 0) return `new (+${t.thisN})`;
  const sign = t.abs > 0 ? '+' : '';
  return `${sign}${t.abs} (${sign}${t.pct}%)`;
}
function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10; // one decimal %
}

function ctDateString(now: Date): string {
  const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const y = ct.getFullYear();
  const m = String(ct.getMonth() + 1).padStart(2, '0');
  const d = String(ct.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function ctRange(startIso: string, endIso: string): string {
  const opt: Intl.DateTimeFormatOptions = { timeZone: 'America/Chicago', month: 'short', day: 'numeric' };
  return `${new Date(startIso).toLocaleDateString('en-US', opt)} – ${new Date(endIso).toLocaleDateString('en-US', opt)}`;
}

// ── Roll up by_source into funnel-level this/last + keep per-source rows. ──
interface Line { key: string; label: string; thisN: number; lastN: number; }
function rollup(by: BySource[]): { funnels: Line[]; sources: Line[] } {
  const fmap = new Map<string, Line>();
  const smap = new Map<string, Line>();
  for (const r of by) {
    const flabelKey = r.funnel;
    const f = fmap.get(flabelKey) ?? { key: flabelKey, label: r.funnel, thisN: 0, lastN: 0 };
    if (r.wk === 'this') f.thisN += r.n; else f.lastN += r.n;
    fmap.set(flabelKey, f);

    const sKey = `${r.funnel}|${r.source}`;
    const s = smap.get(sKey) ?? { key: sKey, label: friendly(r.funnel, r.source), thisN: 0, lastN: 0 };
    if (r.wk === 'this') s.thisN += r.n; else s.lastN += r.n;
    smap.set(sKey, s);
  }
  return {
    funnels: Array.from(fmap.values()).sort((a, b) => b.thisN - a.thisN),
    sources: Array.from(smap.values()).sort((a, b) => b.thisN - a.thisN),
  };
}

// ── The interpretation: anomalies + one recommended focus. ──
function interpret(s: Snapshot, sources: Line[]): { anomalies: string[]; focus: string } {
  const anomalies: string[] = [];
  const leadsT = trend(s.leads.this, s.leads.last);
  const visT = trend(s.traffic_visitors.this, s.traffic_visitors.last);
  const convThis = rate(s.leads.this, s.traffic_visitors.this);
  const convLast = rate(s.leads.last, s.traffic_visitors.last);

  // Source dried up / spiked.
  for (const src of sources) {
    if (src.lastN >= 3 && src.thisN === 0) anomalies.push(`${src.label} went quiet — ${src.lastN} last week, 0 this week.`);
    if (src.lastN === 0 && src.thisN >= 3) anomalies.push(`${src.label} appeared from nothing — ${src.thisN} this week.`);
    if (src.lastN >= 3 && src.thisN >= src.lastN * 2) anomalies.push(`${src.label} doubled — ${src.lastN} → ${src.thisN}.`);
  }
  // Traffic up but leads not following → conversion slip.
  if (visT.pct !== null && visT.pct >= 15 && leadsT.pct !== null && leadsT.pct <= 0) {
    anomalies.push(`Visits rose (${pctStr(visT)}) but leads didn't follow — a conversion slip, not a traffic problem.`);
  }
  // Conversion-rate movement.
  if (convThis !== null && convLast !== null) {
    const rel = convLast > 0 ? Math.round(((convThis - convLast) / convLast) * 100) : null;
    if (rel !== null && rel <= -20) anomalies.push(`Visitor→lead rate fell ${convLast}% → ${convThis}% (${rel}%).`);
    if (rel !== null && rel >= 25) anomalies.push(`Visitor→lead rate jumped ${convLast}% → ${convThis}% (+${rel}%).`);
  }

  // Recommended focus — first matching rule wins.
  let focus: string;
  if (s.traffic_visitors.this > 0 && s.leads.this === 0) {
    focus = 'Capture. Visitors are arriving but none converted to a lead — the offer/CTA is where to look first.';
  } else if (visT.pct !== null && visT.pct <= -15) {
    focus = 'Top of funnel. Visits are cooling — this is exactly where the new Meta ads + SEO recrawl should help; watch them lift this number.';
  } else if (convThis !== null && convLast !== null && convLast > 0 && (convThis - convLast) / convLast <= -0.2) {
    focus = 'Conversion. Visits held but the lead rate dropped — audit the homeschool CTAs / quiz capture for friction.';
  } else if (leadsT.pct !== null && leadsT.pct >= 15) {
    const top = sources[0];
    focus = top ? `Scale what's working. Leads are accelerating — ${top.label} is your top source this week; lean into it.` : 'Scale what\'s working — leads are accelerating.';
  } else {
    // Find a stalled funnel to nudge.
    const stalled = sources.find((x) => x.lastN >= 3 && x.thisN < x.lastN);
    focus = stalled
      ? `Shore up ${stalled.label} — it slipped from ${stalled.lastN} to ${stalled.thisN}.`
      : 'Steady week. With ad tracking now live, the lever this coming week is turning on a small Meta Leads test and watching cost-per-lead.';
  }
  return { anomalies, focus };
}

function buildEmail(s: Snapshot, runDate: string): { subject: string; html: string; text: string } {
  const leadsT = trend(s.leads.this, s.leads.last);
  const viewsT = trend(s.traffic_views.this, s.traffic_views.last);
  const visT = trend(s.traffic_visitors.this, s.traffic_visitors.last);
  const quizT = trend(s.quiz.this, s.quiz.last);
  const convThis = rate(s.leads.this, s.traffic_visitors.this);
  const convLast = rate(s.leads.last, s.traffic_visitors.last);
  const { funnels: _funnels, sources } = rollup(s.leads.by_source);
  const { anomalies, focus } = interpret(s, sources);

  const thisRange = ctRange(s.this_week_start, s.generated_at);
  const lastRange = ctRange(s.last_week_start, s.this_week_start);

  const subject = `Weekly trends — ${s.leads.this} lead${s.leads.this === 1 ? '' : 's'} (${pctStr(leadsT)}) · ${runDate}`;

  const metric = (name: string, t: Trend, extra?: string) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E0D0;font-family:Georgia,serif;font-size:14px;color:#1C3A2E;">${esc(name)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E0D0;font-family:Georgia,serif;font-size:18px;color:#1C3A2E;text-align:right;font-weight:bold;">${t.thisN}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E0D0;font-family:Georgia,serif;font-size:13px;text-align:right;color:#6B6560;">${t.lastN}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E0D0;font-family:Georgia,serif;font-size:13px;color:${t.arrow === '▲' ? '#2E6B3E' : t.arrow === '▼' ? '#A6492F' : '#6B6560'};">${t.arrow} ${esc(pctStr(t))}<br><span style="font-size:11px;color:#A8A29A;font-style:italic;">${esc(t.label)}${extra ? ' · ' + esc(extra) : ''}</span></td>
    </tr>`;

  const convExtra = convThis !== null ? `${convThis}% visitor→lead${convLast !== null ? ` (was ${convLast}%)` : ''}` : 'no visitor data';

  const sourceRows = sources.filter((x) => x.thisN > 0 || x.lastN > 0).map((x) => {
    const t = trend(x.thisN, x.lastN);
    return `
    <tr>
      <td style="padding:7px 12px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:13px;color:#1C3A2E;">${esc(x.label)}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:13px;color:#1C3A2E;text-align:right;font-weight:bold;">${x.thisN}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:12px;color:#6B6560;text-align:right;">${x.lastN}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:12px;color:${t.arrow === '▲' ? '#2E6B3E' : t.arrow === '▼' ? '#A6492F' : '#6B6560'};">${t.arrow} ${esc(pctStr(t))}</td>
    </tr>`;
  }).join('');

  const anomaliesHtml = anomalies.length
    ? anomalies.map((a) => `<li style="font-family:Georgia,serif;font-size:13px;color:#3D3832;margin-bottom:6px;">${esc(a)}</li>`).join('')
    : `<li style="font-family:Georgia,serif;font-size:13px;color:#6B6560;font-style:italic;">Nothing unusual — the numbers moved within normal range.</li>`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F5F0E8;font-family:Georgia,serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#FFFFFF;">

<tr><td style="background:#1C3A2E;padding:28px 24px;text-align:center;">
<div style="font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;">THE EDEN INSTITUTE</div>
<div style="font-family:Georgia,serif;font-size:14px;color:#F5F0E8;font-style:italic;padding-top:6px;">Weekly Trends Briefing</div>
</td></tr>

<tr><td style="padding:24px 24px 8px 24px;">
<p style="font-family:Georgia,serif;font-size:13px;color:#6B6560;margin:0 0 4px 0;">This week (${esc(thisRange)}) vs last week (${esc(lastRange)}) · America/Chicago</p>
<p style="font-family:Georgia,serif;font-size:22px;color:#1C3A2E;margin:8px 0 4px 0;font-weight:bold;">${s.leads.this} new lead${s.leads.this === 1 ? '' : 's'} this week <span style="font-size:15px;color:${leadsT.arrow === '▼' ? '#A6492F' : '#2E6B3E'};">${leadsT.arrow} ${esc(pctStr(leadsT))}</span></p>
</td></tr>

<tr><td style="padding:8px 24px;">
<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 8px 0;">The numbers</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
<thead><tr style="background:#F5F0E8;">
<th style="padding:8px 12px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Metric</th>
<th style="padding:8px 12px;text-align:right;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">This</th>
<th style="padding:8px 12px;text-align:right;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Last</th>
<th style="padding:8px 12px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Trend</th>
</tr></thead>
<tbody>
${metric('Leads captured', leadsT, convExtra)}
${metric('Unique visitors', visT)}
${metric('Page views', viewsT)}
${metric('Quiz completions', quizT)}
</tbody>
</table>

<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 8px 0;">Leads by source</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
<thead><tr style="background:#F5F0E8;">
<th style="padding:8px 12px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Source</th>
<th style="padding:8px 12px;text-align:right;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">This</th>
<th style="padding:8px 12px;text-align:right;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Last</th>
<th style="padding:8px 12px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">WoW</th>
</tr></thead>
<tbody>${sourceRows || `<tr><td colspan="4" style="padding:10px 12px;font-family:Georgia,serif;font-size:13px;color:#6B6560;font-style:italic;">No leads in either week.</td></tr>`}</tbody>
</table>

<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 8px 0;">What stands out</p>
<ul style="margin:0 0 24px 0;padding-left:20px;">${anomaliesHtml}</ul>

<div style="background:#1C3A2E;padding:18px 20px;margin-bottom:8px;">
<p style="font-family:Georgia,serif;font-size:11px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 6px 0;">This week&#x2019;s focus</p>
<p style="font-family:Georgia,serif;font-size:15px;color:#F5F0E8;margin:0;line-height:1.5;">${esc(focus)}</p>
</div>
</td></tr>

<tr><td style="background:#F5F0E8;padding:18px;text-align:center;font-family:Georgia,serif;font-size:11px;color:#6B6560;">
The Eden Institute · edeninstitute.health · automated weekly trends · testers &amp; bots excluded
</td></tr>

</table></td></tr></table></body></html>`;

  const text = [
    `WEEKLY TRENDS — ${runDate}`,
    `This week (${thisRange}) vs last week (${lastRange}), CT`,
    '',
    `Leads:            ${leadsT.thisN}  (was ${leadsT.lastN})  ${pctStr(leadsT)} — ${leadsT.label}` + (convThis !== null ? `  · ${convExtra}` : ''),
    `Unique visitors:  ${visT.thisN}  (was ${visT.lastN})  ${pctStr(visT)} — ${visT.label}`,
    `Page views:       ${viewsT.thisN}  (was ${viewsT.lastN})  ${pctStr(viewsT)} — ${viewsT.label}`,
    `Quiz completions: ${quizT.thisN}  (was ${quizT.lastN})  ${pctStr(quizT)} — ${quizT.label}`,
    '',
    'Leads by source:',
    ...sources.filter((x) => x.thisN > 0 || x.lastN > 0).map((x) => `  ${x.thisN} (was ${x.lastN})\t${x.label}`),
    '',
    'What stands out:',
    ...(anomalies.length ? anomalies.map((a) => `  - ${a}`) : ['  - Nothing unusual.']),
    '',
    `THIS WEEK'S FOCUS: ${focus}`,
  ].join('\n');

  return { subject, html, text };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  };
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Internal cron worker: only the service role (via the Vercel cron) may invoke.
  if (!isServiceRoleRequest(req)) return serviceRoleRequired(corsHeaders);

  try {
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('weekly-trends-digest: missing env vars', {
        hasResend: !!RESEND_API_KEY, hasSbUrl: !!SUPABASE_URL, hasSbKey: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return json(500, { error: 'Server configuration error' });
    }

    const runDate = ctDateString(new Date());

    // ── Idempotency INSERT ──
    const insertRes = await sbFetch('/rest/v1/weekly_trends_runs', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ run_date: runDate, status: 'pending' }),
    });
    if (insertRes.status === 409) {
      console.log(`weekly-trends-digest: already ran for ${runDate} — skipping`);
      return json(200, { skipped: 'already_ran', run_date: runDate });
    }
    if (!insertRes.ok) {
      const errText = await insertRes.text().catch(() => '');
      console.error('weekly-trends-digest: runs INSERT failed', insertRes.status, errText);
      return json(500, { error: 'Failed to create weekly_trends_runs row', detail: errText });
    }
    const inserted = await insertRes.json();
    const runId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;

    // ── Snapshot RPC ──
    const rpcRes = await sbFetch('/rest/v1/rpc/weekly_trends_snapshot', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!rpcRes.ok) {
      const errText = await rpcRes.text().catch(() => '');
      console.error('weekly-trends-digest: RPC failed', rpcRes.status, errText);
      await sbFetch(`/rest/v1/weekly_trends_runs?id=eq.${runId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', error_message: `RPC failed: ${errText.slice(0, 500)}`, completed_at: new Date().toISOString() }),
      });
      return json(500, { error: 'RPC fetch failed' });
    }
    const snapshot: Snapshot = await rpcRes.json();

    // ── Build + send (always send — the weekly rhythm is the point) ──
    const { subject, html, text } = buildEmail(snapshot, runDate);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: FOUNDER_EMAIL, subject, html, text }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => '');
      console.error('weekly-trends-digest: Resend send failed', resendRes.status, errText);
      await sbFetch(`/rest/v1/weekly_trends_runs?id=eq.${runId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', leads_this_week: snapshot.leads.this, error_message: `Resend ${resendRes.status}: ${errText.slice(0, 500)}`, completed_at: new Date().toISOString() }),
      });
      return json(502, { error: 'Resend send failed', detail: errText });
    }

    const resendData = await resendRes.json().catch(() => ({}));
    console.log(`weekly-trends-digest: sent ${runDate}`, JSON.stringify({ resendId: resendData?.id, leads: snapshot.leads.this }));

    await sbFetch(`/rest/v1/weekly_trends_runs?id=eq.${runId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'sent', leads_this_week: snapshot.leads.this, completed_at: new Date().toISOString() }),
    });

    return json(200, { sent: true, run_date: runDate, leads_this_week: snapshot.leads.this, resend_id: resendData?.id ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('weekly-trends-digest: unhandled error', msg, err);
    return json(500, { error: 'Unhandled exception', detail: msg });
  }
});
