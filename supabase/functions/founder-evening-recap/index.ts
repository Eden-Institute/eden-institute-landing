// supabase/functions/founder-evening-recap/index.ts
//
// EVENING RECAP — the end-of-day founder report.
//
// Deliberately SEPARATE from notify-founder-digest rather than a mode flag on
// it. That function runs every morning and is the one Camila already relies
// on; this one was added during launch week and must not be able to break it.
//
// Schedule: 01:00 UTC daily = 20:00 America/Chicago (CDT, UTC-5). During CST
// (UTC-6) it lands at 19:00 CT. Same one-hour seasonal drift the morning
// digest accepts; we do not reschedule the cron twice a year.
//
// Window: TODAY in Central time, from 00:00 CT up to the moment it runs. This
// is a same-day recap, not a previous-day summary. The morning digest already
// covers the completed previous day.
//
// Covers, in the order Camila reads them:
//   1. Orders and revenue today
//   2. Email performance today: sends, open events, click events, per email
//   3. New signups today, by funnel
//   4. Queue health: what is still pending, what failed
//
// PostgREST caps a single response at 1000 rows, so every list read here goes
// through fetchAllPages(). A launch day can easily produce more than 1000 open
// events, and a silent truncation would under-report the day.
//
// Re-sending a missed day: POST {"date":"YYYY-MM-DD"} with the service-role key
// to send the recap for that completed Central-time day, midnight to midnight.
// Added after the 2026-09-11 and 2026-09-12 recaps failed on gateway 504s. The
// "pending and due" backlog count cannot be rebuilt for a past day, so a
// re-send shows it as of the moment it runs and says so.

import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';
import { pgrstFetch } from '../_shared/pgrst-retry.ts';
import { escapeHtml } from '../_shared/html-escape.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FOUNDER_EMAIL = Deno.env.get('FOUNDER_EMAIL') ?? 'hello@edeninstitute.health';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'The Eden Institute <hello@edeninstitute.health>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAGE = 1000;

// pgrstFetch repeats a gateway 504 on the reads.
function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return pgrstFetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

// Reads every row for a query, page by page. `path` must already carry its
// query string and must NOT carry limit/offset.
async function fetchAllPages<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  for (;;) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await sbFetch(`${path}${sep}limit=${PAGE}&offset=${offset}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`query failed (${res.status}) for ${path}: ${body.slice(0, 300)}`);
    }
    const rows = (await res.json()) as T[];
    if (!Array.isArray(rows)) return out;
    out.push(...rows);
    if (rows.length < PAGE) return out;
    offset += PAGE;
  }
}

// ── Central-time day window ──────────────────────────────────────────────
// Central is the business's operating timezone. Deriving the offset from the
// runtime rather than hardcoding -05:00 keeps this correct across DST.
// "-05:00" or "-06:00": the UTC offset of Central time at this instant. Read
// from the tz database, so it does not depend on the runtime's own timezone
// (re-parsing a locale string does, and is an hour off on DST days outside UTC).
function centralOffset(at: Date): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'longOffset' })
    .formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? '';
  const m = name.match(/^GMT([+-]\d{2}:\d{2})$/);
  if (!m) throw new Error(`unexpected Central offset "${name}"`);
  return m[1];
}

function centralDayWindow(now: Date): { startIso: string; label: string; ymd: string } {
  const ctNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const y = ctNow.getFullYear();
  const m = String(ctNow.getMonth() + 1).padStart(2, '0');
  const d = String(ctNow.getDate()).padStart(2, '0');

  return {
    startIso: `${y}-${m}-${d}T00:00:00${centralOffset(now)}`,
    label: ctNow.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }),
    ymd: `${y}-${m}-${d}`,
  };
}

// A completed Central-time day, midnight to midnight, for re-sending a missed
// recap. Returns null unless `ymd` is a real calendar date. 06:00 UTC is 00:00
// CST or 01:00 CDT, before both 2am DST switches (08:00Z in March, 07:00Z in
// November), so it carries that midnight's offset.
function centralPastDayWindow(ymd: string): { startIso: string; endIso: string; label: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) !== ymd) return null;
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return {
    startIso: `${ymd}T00:00:00${centralOffset(new Date(`${ymd}T06:00:00Z`))}`,
    endIso: `${next}T00:00:00${centralOffset(new Date(`${next}T06:00:00Z`))}`,
    label: new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
      timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }),
  };
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface OrderRow {
  customer_email: string;
  product_label: string | null;
  amount_total_cents: number | null;
  quantity: number | null;
  status: string;
  is_preorder: boolean | null;
  order_number: string | null;
  created_at: string;
}
interface EventRow { event_type: string; recipient: string; email_key: string | null; campaign: string | null }
interface QueueRow { sequence_position: number; status: string }
interface SignupRow { entry_funnel: string | null }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Internal cron worker: only the service role (the Vercel cron, or a manual
  // re-send) may invoke. The anon key in the site bundle is also a valid JWT.
  if (!isServiceRoleRequest(req)) return serviceRoleRequired(corsHeaders);

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured: missing SUPABASE_URL, service role key, or RESEND_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const now = new Date();
    const today = centralDayWindow(now);

    // Optional {"date":"YYYY-MM-DD"}: re-send a completed past day.
    const payload = await req.json().catch(() => ({})) as { date?: unknown };
    let past: ReturnType<typeof centralPastDayWindow> = null;
    if (payload && payload.date !== undefined) {
      past = typeof payload.date === 'string' ? centralPastDayWindow(payload.date) : null;
      if (!past || (payload.date as string) >= today.ymd) {
        return new Response(
          JSON.stringify({ sent: false, error: 'date must be a past Central-time day as YYYY-MM-DD' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }
    const startIso = past ? past.startIso : today.startIso;
    const label = past ? past.label : today.label;
    const enc = encodeURIComponent(startIso);
    // Upper bound only for a past day; a live recap runs up to now.
    const before = (col: string) => (past ? `&${col}=lt.${encodeURIComponent(past.endIso)}` : '');
    const dayWord = past ? 'that day' : 'today';

    // 1. Orders placed that day that are still live.
    const orders = await fetchAllPages<OrderRow>(
      `/rest/v1/orders?select=customer_email,product_label,amount_total_cents,quantity,status,is_preorder,order_number,created_at` +
      `&created_at=gte.${enc}${before('created_at')}&status=not.in.(cancelled,refunded)&order=created_at.asc`,
    );
    const grossCents = orders.reduce((s, o) => s + (o.amount_total_cents ?? 0), 0);
    const units = orders.reduce((s, o) => s + (o.quantity ?? 1), 0);

    // 2. Email events that day.
    const events = await fetchAllPages<EventRow>(
      `/rest/v1/email_events?select=event_type,recipient,email_key,campaign&occurred_at=gte.${enc}${before('occurred_at')}`,
    );
    // 3. Sends that day, keyed by sequence position.
    const sent = await fetchAllPages<QueueRow>(
      `/rest/v1/launch_email_queue?select=sequence_position,status&sent_at=gte.${enc}${before('sent_at')}&status=eq.sent`,
    );
    // 4. New signups that day.
    const signups = await fetchAllPages<SignupRow>(
      `/rest/v1/waitlist_signups?select=entry_funnel&created_at=gte.${enc}${before('created_at')}`,
    );
    // 5. Failures that day and the pending backlog (always as of now).
    const failed = await fetchAllPages<QueueRow>(
      `/rest/v1/launch_email_queue?select=sequence_position,status&updated_at=gte.${enc}${before('updated_at')}&status=eq.failed`,
    );
    const pendingDue = await fetchAllPages<QueueRow>(
      `/rest/v1/launch_email_queue?select=sequence_position,status&status=eq.pending&scheduled_for=lte.${encodeURIComponent(now.toISOString())}`,
    );

    // ── Aggregate email performance per key ──
    const keys = new Map<string, { openEvents: number; openers: Set<string>; clickEvents: number; clickers: Set<string> }>();
    for (const e of events) {
      const k = e.email_key ?? '(untagged)';
      let row = keys.get(k);
      if (!row) { row = { openEvents: 0, openers: new Set(), clickEvents: 0, clickers: new Set() }; keys.set(k, row); }
      if (e.event_type === 'opened') { row.openEvents++; row.openers.add(e.recipient); }
      if (e.event_type === 'clicked') { row.clickEvents++; row.clickers.add(e.recipient); }
    }
    const emailRows = Array.from(keys.entries())
      .sort((a, b) => b[1].openers.size - a[1].openers.size)
      .map(([k, v]) => ({ key: k, openers: v.openers.size, openEvents: v.openEvents, clickers: v.clickers.size, clickEvents: v.clickEvents }));

    const totalOpeners = new Set(events.filter((e) => e.event_type === 'opened').map((e) => e.recipient)).size;
    const totalClickers = new Set(events.filter((e) => e.event_type === 'clicked').map((e) => e.recipient)).size;

    const sentByPos = new Map<number, number>();
    for (const s of sent) sentByPos.set(s.sequence_position, (sentByPos.get(s.sequence_position) ?? 0) + 1);

    const signupsByFunnel = new Map<string, number>();
    for (const s of signups) {
      const f = s.entry_funnel ?? 'unknown';
      signupsByFunnel.set(f, (signupsByFunnel.get(f) ?? 0) + 1);
    }

    // ── Render ──
    const th = 'padding:6px 10px;text-align:left;font-size:12px;color:#6b6257;border-bottom:1px solid #e6e0d6;';
    const td = 'padding:6px 10px;font-size:14px;color:#2f2a24;border-bottom:1px solid #f0ece4;';

    const ordersBlock = orders.length > 0
      ? `<table style="width:100%;border-collapse:collapse;">
           <tr><th style="${th}">Order</th><th style="${th}">Product</th><th style="${th}">Qty</th><th style="${th}">Amount</th></tr>
           ${orders.map((o) => `<tr>
             <td style="${td}">${escapeHtml(o.order_number ?? o.customer_email)}</td>
             <td style="${td}">${escapeHtml(o.product_label ?? o.status)}</td>
             <td style="${td}">${o.quantity ?? 1}</td>
             <td style="${td}">${money(o.amount_total_cents ?? 0)}</td>
           </tr>`).join('')}
         </table>`
      : `<p style="font-size:14px;color:#6b6257;margin:0;">No orders ${past ? 'that day' : 'yet today'}.</p>`;

    const emailBlock = emailRows.length > 0
      ? `<table style="width:100%;border-collapse:collapse;">
           <tr><th style="${th}">Email</th><th style="${th}">Openers</th><th style="${th}">Opens</th><th style="${th}">Clickers</th><th style="${th}">Clicks</th></tr>
           ${emailRows.map((r) => `<tr>
             <td style="${td}">${escapeHtml(r.key)}</td><td style="${td}">${r.openers}</td><td style="${td}">${r.openEvents}</td>
             <td style="${td}">${r.clickers}</td><td style="${td}">${r.clickEvents}</td>
           </tr>`).join('')}
         </table>`
      : `<p style="font-size:14px;color:#6b6257;margin:0;">No opens or clicks recorded ${dayWord}.</p>`;

    const sentBlock = sentByPos.size > 0
      ? `<p style="font-size:14px;color:#2f2a24;margin:0;">` +
        Array.from(sentByPos.entries()).sort((a, b) => a[0] - b[0])
          .map(([pos, n]) => `Email ${pos}: <strong>${n}</strong>`).join(' &middot; ') +
        `</p>`
      : `<p style="font-size:14px;color:#6b6257;margin:0;">Nothing sent ${dayWord}.</p>`;

    const signupBlock = signups.length > 0
      ? `<p style="font-size:14px;color:#2f2a24;margin:0;"><strong>${signups.length}</strong> new: ` +
        Array.from(signupsByFunnel.entries()).sort((a, b) => b[1] - a[1])
          .map(([f, n]) => `${escapeHtml(f)} ${n}`).join(', ') + `</p>`
      : `<p style="font-size:14px;color:#6b6257;margin:0;">No new signups ${dayWord}.</p>`;

    const healthBlock = (failed.length > 0 || pendingDue.length > 0)
      ? `<p style="font-size:14px;margin:0;color:${failed.length > 0 ? '#a33' : '#2f2a24'};">` +
        `Failed ${dayWord}: <strong>${failed.length}</strong>. Pending and already due${past ? ' right now' : ''}: <strong>${pendingDue.length}</strong>` +
        `${pendingDue.length > 400 ? ' (backlog is large, the drain cron may be behind)' : ''}.</p>`
      : `<p style="font-size:14px;color:#6b6257;margin:0;">Queue clean: nothing failed, nothing overdue.</p>`;

    const section = (title: string, inner: string) =>
      `<div style="margin:0 0 22px;"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a7f70;margin:0 0 8px;">${title}</div>${inner}</div>`;

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#faf7f2;font-family:Georgia,serif;">
      <div style="max-width:640px;margin:0 auto;background:#fffdf9;border:1px solid #e6e0d6;border-radius:6px;padding:28px;">
        <h1 style="font-size:20px;color:#2f2a24;margin:0 0 4px;">Evening recap</h1>
        <p style="font-size:13px;color:#8a7f70;margin:0 0 24px;">${past ? `${label}, the full day (re-sent because the original recap did not go out)` : `${label}, through ${now.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })} Central`}</p>
        ${section(`Orders ${dayWord}`, `<p style="font-size:22px;color:#2f2a24;margin:0 0 10px;"><strong>${orders.length}</strong> order${orders.length === 1 ? '' : 's'} &middot; ${units} unit${units === 1 ? '' : 's'} &middot; <strong>${money(grossCents)}</strong></p>${ordersBlock}`)}
        ${section(`Email ${dayWord}`, `<p style="font-size:16px;color:#2f2a24;margin:0 0 10px;"><strong>${totalOpeners}</strong> people opened &middot; <strong>${totalClickers}</strong> clicked</p>${emailBlock}<div style="margin-top:10px;">${sentBlock}</div>`)}
        ${section('New signups', signupBlock)}
        ${section('Queue health', healthBlock)}
        <p style="font-size:11px;color:#a99e8e;margin:24px 0 0;border-top:1px solid #f0ece4;padding-top:12px;">${past ? 'Full-day figures for a past Central-time day; the pending count is as of the re-send' : 'Same-day figures, Central time'}. Opens are pixel-based and undercount Apple Mail Privacy Protection and image-blocking clients.</p>
      </div></body></html>`;

    const text = [
      `EVENING RECAP — ${label}${past ? ' (full day, re-sent)' : ''}`,
      ``,
      `ORDERS: ${orders.length} (${units} units, ${money(grossCents)})`,
      ...orders.map((o) => `  ${o.order_number ?? o.customer_email} — ${o.product_label ?? o.status} x${o.quantity ?? 1} — ${money(o.amount_total_cents ?? 0)}`),
      ``,
      `EMAIL: ${totalOpeners} openers, ${totalClickers} clickers`,
      ...emailRows.map((r) => `  ${r.key}: ${r.openers} openers (${r.openEvents} opens), ${r.clickers} clickers`),
      `  Sent: ${Array.from(sentByPos.entries()).sort((a, b) => a[0] - b[0]).map(([p, n]) => `E${p}=${n}`).join(' ') || 'none'}`,
      ``,
      `SIGNUPS: ${signups.length}`,
      `QUEUE: ${failed.length} failed, ${pendingDue.length} pending and due`,
    ].filter(Boolean).join('\n');

    const subjectLead = past ? `Evening recap for ${past.label}` : 'Evening recap';
    const subject = orders.length > 0
      ? `${subjectLead}: ${orders.length} order${orders.length === 1 ? '' : 's'}, ${money(grossCents)}`
      : `${subjectLead}: ${totalOpeners} openers, no orders${past ? '' : ' yet'}`;

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [FOUNDER_EMAIL], subject, html, text }),
    });
    const sendBody = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
      console.error('founder-evening-recap: Resend rejected the send', JSON.stringify(sendBody));
      return new Response(JSON.stringify({ sent: false, error: 'resend_failed', detail: sendBody }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({
        sent: true, resend_id: sendBody?.id ?? null, window_start: startIso, window_end: past ? past.endIso : null,
        orders: orders.length, gross_cents: grossCents, openers: totalOpeners,
        clickers: totalClickers, signups: signups.length,
        failed: failed.length, pending_due: pendingDue.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('founder-evening-recap failed:', message);
    return new Response(JSON.stringify({ sent: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
