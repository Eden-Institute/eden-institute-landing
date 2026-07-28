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
//   1. Orders and revenue today, plus the founding-500 runway
//   2. Email performance today: sends, open events, click events, per email
//   3. New signups today, by funnel
//   4. Queue health: what is still pending, what failed
//
// PostgREST caps a single response at 1000 rows, so every list read here goes
// through fetchAllPages(). A launch day can easily produce more than 1000 open
// events, and a silent truncation would under-report the day.

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

function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}${path}`, {
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
function centralDayWindow(now: Date): { startIso: string; label: string } {
  const ctNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const y = ctNow.getFullYear();
  const m = String(ctNow.getMonth() + 1).padStart(2, '0');
  const d = String(ctNow.getDate()).padStart(2, '0');

  // Offset between UTC and Central at this instant, in minutes.
  const utcAsIfLocal = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMin = Math.round((utcAsIfLocal.getTime() - ctNow.getTime()) / 60000);
  const sign = offsetMin >= 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');

  return {
    startIso: `${y}-${m}-${d}T00:00:00${sign}${oh}:${om}`,
    label: ctNow.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }),
  };
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Founding runway (same latch-aware gate the checkout enforces) ─────────
async function foundingRunway(): Promise<{ claimed: number; limit: number; closed: boolean } | null> {
  try {
    const prodRes = await sbFetch(
      '/rest/v1/products?select=founding_qty_limit&founding_qty_limit=not.is.null&limit=1',
    );
    if (!prodRes.ok) return null;
    const prods = await prodRes.json();
    if (!Array.isArray(prods) || prods.length === 0) return null;
    const limit = Number(prods[0].founding_qty_limit ?? 0);

    const gateRes = await sbFetch('/rest/v1/rpc/founding_gate', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!gateRes.ok) return null;
    const rows = await gateRes.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    return {
      claimed: Number(row.claimed ?? row.founding_claimed ?? 0),
      limit,
      closed: Boolean(row.closed ?? row.founding_closed ?? false),
    };
  } catch (err) {
    console.error('foundingRunway failed:', String(err));
    return null;
  }
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

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured: missing SUPABASE_URL, service role key, or RESEND_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const now = new Date();
    const { startIso, label } = centralDayWindow(now);
    const enc = encodeURIComponent(startIso);

    // 1. Orders placed today that are still live.
    const orders = await fetchAllPages<OrderRow>(
      `/rest/v1/orders?select=customer_email,product_label,amount_total_cents,quantity,status,is_preorder,order_number,created_at` +
      `&created_at=gte.${enc}&status=not.in.(cancelled,refunded)&order=created_at.asc`,
    );
    const grossCents = orders.reduce((s, o) => s + (o.amount_total_cents ?? 0), 0);
    const units = orders.reduce((s, o) => s + (o.quantity ?? 1), 0);

    // 2. Email events today.
    const events = await fetchAllPages<EventRow>(
      `/rest/v1/email_events?select=event_type,recipient,email_key,campaign&occurred_at=gte.${enc}`,
    );
    // 3. Sends today, keyed by sequence position.
    const sent = await fetchAllPages<QueueRow>(
      `/rest/v1/launch_email_queue?select=sequence_position,status&sent_at=gte.${enc}&status=eq.sent`,
    );
    // 4. New signups today.
    const signups = await fetchAllPages<SignupRow>(
      `/rest/v1/waitlist_signups?select=entry_funnel&created_at=gte.${enc}`,
    );
    // 5. Failures today and the pending backlog.
    const failed = await fetchAllPages<QueueRow>(
      `/rest/v1/launch_email_queue?select=sequence_position,status&updated_at=gte.${enc}&status=eq.failed`,
    );
    const pendingDue = await fetchAllPages<QueueRow>(
      `/rest/v1/launch_email_queue?select=sequence_position,status&status=eq.pending&scheduled_for=lte.${encodeURIComponent(now.toISOString())}`,
    );

    const founding = await foundingRunway();

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
             <td style="${td}">${o.order_number ?? o.customer_email}</td>
             <td style="${td}">${o.product_label ?? o.status}</td>
             <td style="${td}">${o.quantity ?? 1}</td>
             <td style="${td}">${money(o.amount_total_cents ?? 0)}</td>
           </tr>`).join('')}
         </table>`
      : `<p style="font-size:14px;color:#6b6257;margin:0;">No orders yet today.</p>`;

    const emailBlock = emailRows.length > 0
      ? `<table style="width:100%;border-collapse:collapse;">
           <tr><th style="${th}">Email</th><th style="${th}">Openers</th><th style="${th}">Opens</th><th style="${th}">Clickers</th><th style="${th}">Clicks</th></tr>
           ${emailRows.map((r) => `<tr>
             <td style="${td}">${r.key}</td><td style="${td}">${r.openers}</td><td style="${td}">${r.openEvents}</td>
             <td style="${td}">${r.clickers}</td><td style="${td}">${r.clickEvents}</td>
           </tr>`).join('')}
         </table>`
      : `<p style="font-size:14px;color:#6b6257;margin:0;">No opens or clicks recorded today.</p>`;

    const sentBlock = sentByPos.size > 0
      ? `<p style="font-size:14px;color:#2f2a24;margin:0;">` +
        Array.from(sentByPos.entries()).sort((a, b) => a[0] - b[0])
          .map(([pos, n]) => `Email ${pos}: <strong>${n}</strong>`).join(' &middot; ') +
        `</p>`
      : `<p style="font-size:14px;color:#6b6257;margin:0;">Nothing sent today.</p>`;

    const signupBlock = signups.length > 0
      ? `<p style="font-size:14px;color:#2f2a24;margin:0;"><strong>${signups.length}</strong> new: ` +
        Array.from(signupsByFunnel.entries()).sort((a, b) => b[1] - a[1])
          .map(([f, n]) => `${f} ${n}`).join(', ') + `</p>`
      : `<p style="font-size:14px;color:#6b6257;margin:0;">No new signups today.</p>`;

    const foundingBlock = founding
      ? (founding.closed
          ? `<p style="font-size:14px;margin:0;">Founding 500 <strong>complete</strong>. Retail pricing is live.</p>`
          : `<p style="font-size:14px;margin:0;">Founding kits: <strong>${founding.claimed} of ${founding.limit}</strong> claimed, ${Math.max(0, founding.limit - founding.claimed)} remaining at $249.</p>`)
      : '';

    const healthBlock = (failed.length > 0 || pendingDue.length > 0)
      ? `<p style="font-size:14px;margin:0;color:${failed.length > 0 ? '#a33' : '#2f2a24'};">` +
        `Failed today: <strong>${failed.length}</strong>. Pending and already due: <strong>${pendingDue.length}</strong>` +
        `${pendingDue.length > 400 ? ' (backlog is large, the drain cron may be behind)' : ''}.</p>`
      : `<p style="font-size:14px;color:#6b6257;margin:0;">Queue clean: nothing failed, nothing overdue.</p>`;

    const section = (title: string, inner: string) =>
      `<div style="margin:0 0 22px;"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a7f70;margin:0 0 8px;">${title}</div>${inner}</div>`;

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#faf7f2;font-family:Georgia,serif;">
      <div style="max-width:640px;margin:0 auto;background:#fffdf9;border:1px solid #e6e0d6;border-radius:6px;padding:28px;">
        <h1 style="font-size:20px;color:#2f2a24;margin:0 0 4px;">Evening recap</h1>
        <p style="font-size:13px;color:#8a7f70;margin:0 0 24px;">${label}, through ${now.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })} Central</p>
        ${section('Orders today', `<p style="font-size:22px;color:#2f2a24;margin:0 0 10px;"><strong>${orders.length}</strong> order${orders.length === 1 ? '' : 's'} &middot; ${units} unit${units === 1 ? '' : 's'} &middot; <strong>${money(grossCents)}</strong></p>${ordersBlock}${foundingBlock ? `<div style="margin-top:10px;">${foundingBlock}</div>` : ''}`)}
        ${section('Email today', `<p style="font-size:16px;color:#2f2a24;margin:0 0 10px;"><strong>${totalOpeners}</strong> people opened &middot; <strong>${totalClickers}</strong> clicked</p>${emailBlock}<div style="margin-top:10px;">${sentBlock}</div>`)}
        ${section('New signups', signupBlock)}
        ${section('Queue health', healthBlock)}
        <p style="font-size:11px;color:#a99e8e;margin:24px 0 0;border-top:1px solid #f0ece4;padding-top:12px;">Same-day figures, Central time. Opens are pixel-based and undercount Apple Mail Privacy Protection and image-blocking clients.</p>
      </div></body></html>`;

    const text = [
      `EVENING RECAP — ${label}`,
      ``,
      `ORDERS: ${orders.length} (${units} units, ${money(grossCents)})`,
      ...orders.map((o) => `  ${o.order_number ?? o.customer_email} — ${o.product_label ?? o.status} x${o.quantity ?? 1} — ${money(o.amount_total_cents ?? 0)}`),
      founding && !founding.closed ? `  Founding: ${founding.claimed}/${founding.limit} claimed` : '',
      ``,
      `EMAIL: ${totalOpeners} openers, ${totalClickers} clickers`,
      ...emailRows.map((r) => `  ${r.key}: ${r.openers} openers (${r.openEvents} opens), ${r.clickers} clickers`),
      `  Sent: ${Array.from(sentByPos.entries()).sort((a, b) => a[0] - b[0]).map(([p, n]) => `E${p}=${n}`).join(' ') || 'none'}`,
      ``,
      `SIGNUPS: ${signups.length}`,
      `QUEUE: ${failed.length} failed, ${pendingDue.length} pending and due`,
    ].filter(Boolean).join('\n');

    const subject = orders.length > 0
      ? `Evening recap: ${orders.length} order${orders.length === 1 ? '' : 's'}, ${money(grossCents)}`
      : `Evening recap: ${totalOpeners} openers, no orders yet`;

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
        sent: true, resend_id: sendBody?.id ?? null, window_start: startIso,
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
