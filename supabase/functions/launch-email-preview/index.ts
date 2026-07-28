// supabase/functions/launch-email-preview/index.ts
//
// FOUNDER PREVIEW — send each launch email to the founder ~24 hours before the
// list receives it, so copy can still be changed on the fly.
//
// Two modes:
//   scheduled  (no body, or {})      find positions due in ~24h and preview them
//   manual     {"position": 8}       preview one position immediately
//
// Idempotent by design. public.launch_email_previews has sequence_position as
// its primary key, so each email is previewed once, before it first goes out.
// Recipients deferred to a later anchor must NOT trigger a second preview of
// copy that has already been approved. Pass {"force": true} to re-send anyway,
// or delete the row to re-preview after editing copy.
//
// Renders through the SAME buildLaunchEmail() the drainer uses, so the preview
// is the real email and not a reconstruction that can drift from it.
//
// ⚠️ Never calls the founding_gate RPC. That RPC is volatile: it stamps the
// one-way founding_closed_at latch. A preview must have no side effects on
// billing state, so the founding window is read passively from
// products.founding_closed_at instead.

import { buildLaunchEmail } from '../_shared/launch-sequence-templates.ts';
import { foundersFormUrl } from '../_shared/founders-link.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FOUNDER_EMAIL = Deno.env.get('FOUNDER_EMAIL') ?? 'hello@edeninstitute.health';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'The Eden Institute <hello@edeninstitute.health>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// How far ahead to look in scheduled mode. Wider than 24h on both sides so a
// cron that drifts, or a send hour that shifts, cannot skip an email entirely.
const LOOKAHEAD_MIN_H = 18;
const LOOKAHEAD_MAX_H = 30;

// The name the founder sees in her own preview. Using a real-looking first name
// rather than 'friend' means the greeting renders the way a recipient sees it.
const PREVIEW_NAME = 'Sarah';

function sb(path: string, init: RequestInit = {}): Promise<Response> {
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

// Passive read of the founding latch. Never calls founding_gate.
async function foundingOpen(): Promise<boolean> {
  try {
    const res = await sb('/rest/v1/products?select=founding_closed_at&founding_qty_limit=not.is.null&limit=1');
    if (!res.ok) return true;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return true;
    return !rows[0].founding_closed_at;
  } catch {
    return true; // Fail toward founding copy, matching the drainer.
  }
}

function fmtCentral(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// A banner above the real email, so a preview can never be mistaken for the
// live send sitting in the same inbox.
function banner(position: number, sendsAt: string, recipients: number, founding: boolean): string {
  return `<div style="font-family:Georgia,serif;background:#1C3A2E;color:#F5EFE3;padding:16px 20px;">
    <div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.75;">Preview &middot; not yet sent to the list</div>
    <div style="font-size:17px;margin-top:6px;"><strong>Email ${position}</strong> goes out <strong>${fmtCentral(sendsAt)} Central</strong></div>
    <div style="font-size:14px;margin-top:4px;opacity:.85;">${recipients.toLocaleString('en-US')} recipient${recipients === 1 ? '' : 's'} &middot; ${founding ? 'founding copy ($249)' : 'retail copy ($349)'}</div>
    <div style="font-size:13px;margin-top:10px;opacity:.75;">To change it, edit the builder in _shared/launch-sequence-templates.ts and redeploy nurture-emails before the send time above. Everything below this bar is the real email.</div>
  </div>`;
}

async function previewPosition(
  position: number,
  sendsAt: string,
  recipients: number,
  founding: boolean,
): Promise<{ position: number; sent: boolean; subject?: string; resend_id?: string | null; error?: string }> {
  // Positions 7 and 18 carry a per-recipient signed founders URL. For a preview
  // we sign one for the founder's own address so the button is clickable and
  // resolves the way a recipient's would.
  let foundersUrl: string | undefined;
  if (position === 7 || position === 18) {
    try {
      foundersUrl = await foundersFormUrl(FOUNDER_EMAIL, PREVIEW_NAME, 'launch_7');
    } catch (err) {
      console.error('preview: foundersFormUrl failed', String(err));
    }
  }

  const built = buildLaunchEmail(position, PREVIEW_NAME, founding, foundersUrl);
  if (!built) return { position, sent: false, error: `no builder for position ${position}` };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [FOUNDER_EMAIL],
      subject: `[PREVIEW ${fmtCentral(sendsAt)}] ${built.subject}`,
      html: banner(position, sendsAt, recipients, founding) + built.html,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('preview: Resend rejected', position, JSON.stringify(body));
    return { position, sent: false, error: 'resend_failed' };
  }

  // Record it. Conflict target is the primary key, so a race cannot double-send.
  await sb('/rest/v1/launch_email_previews?on_conflict=sequence_position', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{
      sequence_position: position,
      scheduled_for: sendsAt,
      subject: built.subject,
      resend_id: body?.id ?? null,
      sent_at: new Date().toISOString(),
    }]),
  });

  return { position, sent: true, subject: built.subject, resend_id: body?.id ?? null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const explicit = typeof body?.position === 'number' ? body.position : null;
    const force = body?.force === true;
    const founding = await foundingOpen();

    // Already previewed, unless forced.
    const doneRes = await sb('/rest/v1/launch_email_previews?select=sequence_position');
    const done = new Set<number>(
      doneRes.ok ? ((await doneRes.json()) as any[]).map((r) => Number(r.sequence_position)) : [],
    );

    // Candidate positions and their first pending send time.
    const now = Date.now();
    const from = new Date(now + LOOKAHEAD_MIN_H * 3600_000).toISOString();
    const to = new Date(now + LOOKAHEAD_MAX_H * 3600_000).toISOString();
    const q = explicit !== null
      ? `/rest/v1/launch_email_queue?select=sequence_position,scheduled_for&status=eq.pending&sequence_position=eq.${explicit}&order=scheduled_for.asc`
      : `/rest/v1/launch_email_queue?select=sequence_position,scheduled_for&status=eq.pending` +
        `&scheduled_for=gte.${encodeURIComponent(from)}&scheduled_for=lte.${encodeURIComponent(to)}` +
        `&order=scheduled_for.asc&limit=5000`;

    const rowsRes = await sb(q);
    if (!rowsRes.ok) {
      const t = await rowsRes.text().catch(() => '');
      return new Response(JSON.stringify({ error: `queue read failed: ${t.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const rows = (await rowsRes.json()) as { sequence_position: number; scheduled_for: string }[];

    // Earliest send + recipient count per position.
    const byPos = new Map<number, { sendsAt: string; count: number }>();
    for (const r of rows) {
      const cur = byPos.get(r.sequence_position);
      if (!cur) byPos.set(r.sequence_position, { sendsAt: r.scheduled_for, count: 1 });
      else {
        cur.count++;
        if (r.scheduled_for < cur.sendsAt) cur.sendsAt = r.scheduled_for;
      }
    }

    const results = [];
    for (const [position, info] of Array.from(byPos.entries()).sort((a, b) => a[0] - b[0])) {
      if (done.has(position) && !force) {
        results.push({ position, sent: false, error: 'already previewed' });
        continue;
      }
      results.push(await previewPosition(position, info.sendsAt, info.count, founding));
    }

    return new Response(
      JSON.stringify({
        mode: explicit !== null ? 'manual' : 'scheduled',
        founding,
        considered: Array.from(byPos.keys()).sort((a, b) => a - b),
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('launch-email-preview failed:', message);
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
