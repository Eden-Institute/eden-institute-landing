// notify-founder-digest Edge Function
//
// Sends a daily lead-magnet capture digest to hello@edeninstitute.health,
// with an appended "Open punch list" section sourced from founder_punch_list.
//
// Flow:
//   1. Triggered by Vercel cron at 14:00 UTC (08:00 America/Chicago CST).
//      Cron route at api/cron/notify-founder-digest.ts calls this EF with
//      the SUPABASE_SERVICE_ROLE_KEY in the Authorization header.
//   2. Resolves the digest window: yesterday 00:00 CT → today 00:00 CT
//      (the previous full calendar day in Central Time).
//   3. INSERTs a pending digest_runs row keyed on digest_date. If a row
//      already exists for that date, INSERT fails on UNIQUE; we exit
//      with skipped="already_ran". This is the idempotency guard for
//      cron retries.
//   4. Calls lead_capture_digest_window RPC to fetch PII rows in the
//      window, and fetches open/deferred founder_punch_list items.
//      If BOTH are empty, marks the run skipped_zero (no email sent).
//   5. Composes the digest HTML — per-magnet counts, the row table, then
//      the open punch list.
//   6. Sends via Resend to hello@edeninstitute.health.
//   7. UPDATEs the digest_runs row to status='sent' or 'failed'.
//
// Env vars (set in Supabase EF secrets):
//   RESEND_API_KEY               — primary send key (re::send_xxx)
//   SUPABASE_URL                 — https://noeqztssupewjidpvhar.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    — service-role JWT for RPC + DML
//   FOUNDER_EMAIL                — recipient; defaults to hello@edeninstitute.health
//                                  if unset (override allowed for staging)
//   FROM_EMAIL                   — sender; defaults to hello@edeninstitute.health
//
// Public-callable: no (verify_jwt=true default; cron passes service_role JWT).

// deno-lint-ignore-file no-explicit-any

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FOUNDER_EMAIL = Deno.env.get('FOUNDER_EMAIL') ?? 'hello@edeninstitute.health';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'The Eden Institute <hello@edeninstitute.health>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CaptureRow {
  email: string;
  first_name: string | null;
  funnel: string;
  source: string;
  entered_at: string;
  source_url: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
}

interface PunchItem {
  title: string;
  detail: string | null;
  owner: string | null;
  status: string;
  sort_order: number;
}

// ── Magnet identity mapping ──
// (funnel, source) → human-readable magnet label + welcome email subject.
// Updated in lockstep with resend-waitlist build* dispatch.
function magnetLabel(funnel: string, source: string): {
  magnet: string;
  welcomeSubject: string;
} {
  if (funnel === 'quiz_funnel') {
    return {
      magnet: 'Constitution Quiz',
      welcomeSubject: 'Your Constitution Assessment',
    };
  }
  if (funnel === 'homeschool') {
    if (source === 'sprouts_magnet') {
      return {
        magnet: 'Homeschool · Sprouts (K-2) Magnet',
        welcomeSubject: 'Sprouts Week 1 (Lavender) — Your Free Preview',
      };
    }
    if (source === 'seedlings_magnet') {
      return {
        magnet: 'Homeschool · Seedlings (3-5) Magnet',
        welcomeSubject: 'Seedlings Week 1 (Elderberry) — Your Free Preview',
      };
    }
    if (source === 'reserve') {
      return {
        magnet: "Homeschool · Eden's Table Founders Club",
        welcomeSubject: "You're in the Founders Club — Eden's Table 2027",
      };
    }
    return {
      magnet: 'Homeschool · General CTA',
      welcomeSubject: "Eden's Table Waitlist (legacy copy)",
    };
  }
  if (funnel === 'edens_table') {
    return {
      magnet: "Eden's Table · General Waitlist",
      welcomeSubject: "Eden's Table Waitlist",
    };
  }
  if (funnel === 'course_tier2') {
    return {
      magnet: 'Tier 2 (Root) · Waitlist',
      welcomeSubject: 'Tier 2 / Root Waitlist',
    };
  }
  if (funnel === 'app_beta') {
    return {
      magnet: 'Apothecary App · Beta Waitlist',
      welcomeSubject: 'Apothecary App Beta',
    };
  }
  if (funnel === 'community') {
    return {
      magnet: 'Community Waitlist',
      welcomeSubject: 'Community Welcome',
    };
  }
  return {
    magnet: `${funnel} · ${source}`,
    welcomeSubject: '(uncategorized)',
  };
}

function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatLocal(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function buildDigestEmail(rows: CaptureRow[], digestDate: string, punchItems: PunchItem[]): {
  subject: string;
  html: string;
  text: string;
} {
  // ── Group by magnet for the headline counts ──
  const byMagnet = new Map<string, { count: number; welcomeSubject: string }>();
  for (const r of rows) {
    const { magnet, welcomeSubject } = magnetLabel(r.funnel, r.source);
    const cur = byMagnet.get(magnet);
    if (cur) cur.count += 1;
    else byMagnet.set(magnet, { count: 1, welcomeSubject });
  }
  const magnetSummary = Array.from(byMagnet.entries())
    .sort((a, b) => b[1].count - a[1].count);

  const total = rows.length;
  const punchCount = punchItems.length;
  const subject = total > 0
    ? `${total} new lead${total === 1 ? '' : 's'} — ${digestDate} · Eden Institute`
    : `No new leads · ${punchCount} open item${punchCount === 1 ? '' : 's'} — ${digestDate} · Eden Institute`;

  // ── HTML ──
  const summaryRows = magnetSummary.map(([magnet, info]) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E8E0D0;font-family:Georgia,serif;font-size:14px;color:#1C3A2E;">
        ${esc(magnet)}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #E8E0D0;font-family:Georgia,serif;font-size:14px;color:#1C3A2E;text-align:right;font-weight:bold;">
        ${info.count}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #E8E0D0;font-family:Georgia,serif;font-size:12px;color:#6B6560;font-style:italic;">
        sent: "${esc(info.welcomeSubject)}"
      </td>
    </tr>
  `).join('');

  const detailRows = rows.map((r) => {
    const { magnet, welcomeSubject } = magnetLabel(r.funnel, r.source);
    const utmBits = [
      r.utm_source ? `utm_source=${r.utm_source}` : '',
      r.utm_campaign ? `utm_campaign=${r.utm_campaign}` : '',
    ].filter(Boolean).join(' · ');
    return `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:13px;color:#1C3A2E;vertical-align:top;">
          ${esc(r.email)}<br><span style="font-size:11px;color:#6B6560;">${esc(r.first_name ?? '(no name)')}</span>
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:13px;color:#1C3A2E;vertical-align:top;">
          ${esc(magnet)}<br><span style="font-size:11px;color:#6B6560;">welcome: ${esc(welcomeSubject)}</span>
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:12px;color:#6B6560;vertical-align:top;white-space:nowrap;">
          ${esc(formatLocal(r.entered_at))}
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:11px;color:#6B6560;vertical-align:top;">
          ${utmBits ? esc(utmBits) : '<span style="color:#A8A29A;">direct</span>'}
        </td>
      </tr>
    `;
  }).join('');

  const capturesBlock = total > 0 ? `
<p style="font-family:Georgia,serif;font-size:24px;color:#1C3A2E;margin:8px 0 24px 0;font-weight:bold;">
  ${total} new lead${total === 1 ? '' : 's'} captured
</p>

<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 8px 0;">By magnet</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
<thead>
<tr style="background:#F5F0E8;">
<th style="padding:8px 12px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Magnet</th>
<th style="padding:8px 12px;text-align:right;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Count</th>
<th style="padding:8px 12px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Welcome email sent</th>
</tr>
</thead>
<tbody>${summaryRows}</tbody>
</table>

<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 8px 0;">All captures</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
<thead>
<tr style="background:#F5F0E8;">
<th style="padding:8px 10px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Subscriber</th>
<th style="padding:8px 10px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Magnet · Welcome</th>
<th style="padding:8px 10px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Captured (CT)</th>
<th style="padding:8px 10px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Attribution</th>
</tr>
</thead>
<tbody>${detailRows}</tbody>
</table>
` : `
<p style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:8px 0 24px 0;">No new leads captured yesterday.</p>
`;

  const punchRows = punchItems.map((p) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:13px;color:#1C3A2E;vertical-align:top;">
        <strong>${esc(p.title)}</strong>${p.detail ? `<br><span style="font-size:11px;color:#6B6560;">${esc(p.detail)}</span>` : ''}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:11px;color:#6B6560;vertical-align:top;white-space:nowrap;text-align:right;">
        ${esc(p.owner ?? '')}${p.status && p.status !== 'open' ? ` · ${esc(p.status)}` : ''}
      </td>
    </tr>
  `).join('');

  const punchSection = punchCount > 0 ? `
<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:8px 0 8px 0;">Open punch list (${punchCount})</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
<tbody>${punchRows}</tbody>
</table>
` : '';

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F5F0E8;font-family:Georgia,serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="720" cellpadding="0" cellspacing="0" style="max-width:720px;width:100%;background:#FFFFFF;">

<tr><td style="background:#1C3A2E;padding:28px 24px;text-align:center;">
<div style="font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;">THE EDEN INSTITUTE</div>
<div style="font-family:Georgia,serif;font-size:14px;color:#F5F0E8;font-style:italic;padding-top:6px;">Daily Lead Digest</div>
</td></tr>

<tr><td style="padding:24px;">
<p style="font-family:Georgia,serif;font-size:14px;color:#3D3832;margin:0 0 4px 0;">Digest for <strong>${esc(digestDate)}</strong> (America/Chicago)</p>
${capturesBlock}
${punchSection}

<p style="font-family:Georgia,serif;font-size:12px;color:#6B6560;margin:24px 0 0 0;font-style:italic;">
  Live analytics dashboard: ask in Cowork — "show me the lead-magnet dashboard" (artifact stays current).
</p>
</td></tr>

<tr><td style="background:#F5F0E8;padding:18px;text-align:center;font-family:Georgia,serif;font-size:11px;color:#6B6560;">
The Eden Institute · edeninstitute.health · automated daily digest
</td></tr>

</table></td></tr></table></body></html>`;

  const lines: string[] = [];
  if (total > 0) {
    lines.push(
      `${total} new lead${total === 1 ? '' : 's'} — ${digestDate} (CT)`,
      '',
      'By magnet:',
      ...magnetSummary.map(([m, info]) => `  ${info.count}\t${m}  →  sent: "${info.welcomeSubject}"`),
      '',
      'All captures:',
      ...rows.map((r) => {
        const { magnet } = magnetLabel(r.funnel, r.source);
        return `  ${formatLocal(r.entered_at)}\t${r.email}\t${magnet}`;
      }),
    );
  } else {
    lines.push(`No new leads — ${digestDate} (CT)`);
  }
  if (punchCount > 0) {
    lines.push(
      '',
      `Open punch list (${punchCount}):`,
      ...punchItems.map((p) => `  [${p.owner ?? ''}${p.status && p.status !== 'open' ? '/' + p.status : ''}] ${p.title}`),
    );
  }
  const text = lines.join('\n');

  return { subject, html, text };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('notify-founder-digest: missing env vars', {
        hasResend: !!RESEND_API_KEY,
        hasSbUrl: !!SUPABASE_URL,
        hasSbKey: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return json(500, { error: 'Server configuration error' });
    }

    // ── Resolve digest window: previous full calendar day in America/Chicago ──
    // Day boundary uses CT regardless of DST. Output is digest_date = yesterday
    // (CT). Window = [yesterday 00:00 CT, today 00:00 CT).
    const nowUtc = new Date();
    // Compute "yesterday in CT" via toLocaleString trick to avoid TZ lib.
    const nowCt = new Date(nowUtc.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const yesterdayCt = new Date(nowCt);
    yesterdayCt.setDate(yesterdayCt.getDate() - 1);
    const yyyy = yesterdayCt.getFullYear();
    const mm = String(yesterdayCt.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterdayCt.getDate()).padStart(2, '0');
    const digestDate = `${yyyy}-${mm}-${dd}`;

    // Window bounds — compose CT midnight strings then let Postgres parse with TZ.
    const windowStartCt = `${digestDate}T00:00:00-06:00`; // CST. Postgres normalizes to UTC.
    const todayCt = new Date(yesterdayCt);
    todayCt.setDate(todayCt.getDate() + 1);
    const ty = todayCt.getFullYear();
    const tm = String(todayCt.getMonth() + 1).padStart(2, '0');
    const td = String(todayCt.getDate()).padStart(2, '0');
    const windowEndCt = `${ty}-${tm}-${td}T00:00:00-06:00`;

    // ── Idempotency INSERT ──
    const insertRes = await sbFetch('/rest/v1/digest_runs', {
      method: 'POST',
      headers: {
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        digest_date: digestDate,
        window_start: windowStartCt,
        window_end: windowEndCt,
        status: 'pending',
      }),
    });

    if (insertRes.status === 409) {
      console.log(`notify-founder-digest: digest_runs row already exists for ${digestDate} — skipping`);
      return json(200, { skipped: 'already_ran', digest_date: digestDate });
    }
    if (!insertRes.ok) {
      const errText = await insertRes.text().catch(() => '');
      console.error('notify-founder-digest: digest_runs INSERT failed', insertRes.status, errText);
      return json(500, { error: 'Failed to create digest_runs row', detail: errText });
    }
    const inserted = await insertRes.json();
    const digestRunId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;

    // ── Fetch capture rows via RPC ──
    const rpcRes = await sbFetch('/rest/v1/rpc/lead_capture_digest_window', {
      method: 'POST',
      body: JSON.stringify({
        p_window_start: windowStartCt,
        p_window_end: windowEndCt,
      }),
    });
    if (!rpcRes.ok) {
      const errText = await rpcRes.text().catch(() => '');
      console.error('notify-founder-digest: RPC failed', rpcRes.status, errText);
      await sbFetch(`/rest/v1/digest_runs?id=eq.${digestRunId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'failed',
          error_message: `RPC failed: ${errText.slice(0, 500)}`,
          completed_at: new Date().toISOString(),
        }),
      });
      return json(500, { error: 'RPC fetch failed' });
    }
    const rows: CaptureRow[] = await rpcRes.json();

    // ── Fetch open/deferred punch-list items (best-effort; never blocks the digest) ──
    let punchItems: PunchItem[] = [];
    try {
      const punchRes = await sbFetch('/rest/v1/founder_punch_list?status=neq.done&order=sort_order.asc,created_at.asc');
      if (punchRes.ok) {
        punchItems = await punchRes.json();
      } else {
        console.error('notify-founder-digest: punch-list fetch failed', punchRes.status);
      }
    } catch (e) {
      console.error('notify-founder-digest: punch-list fetch error', e instanceof Error ? e.message : String(e));
    }

    // ── Zero path: skip only when there are no captures AND no open punch items ──
    if ((!rows || rows.length === 0) && punchItems.length === 0) {
      await sbFetch(`/rest/v1/digest_runs?id=eq.${digestRunId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'skipped_zero',
          captures_count: 0,
          completed_at: new Date().toISOString(),
        }),
      });
      console.log(`notify-founder-digest: zero captures and no punch items for ${digestDate} — no email sent`);
      return json(200, { sent: false, reason: 'zero_captures_no_punch', digest_date: digestDate });
    }

    // ── Build + send digest ──
    const captureRows: CaptureRow[] = Array.isArray(rows) ? rows : [];
    const { subject, html, text } = buildDigestEmail(captureRows, digestDate, punchItems);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: FOUNDER_EMAIL,
        subject,
        html,
        text,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => '');
      console.error('notify-founder-digest: Resend send failed', resendRes.status, errText);
      await sbFetch(`/rest/v1/digest_runs?id=eq.${digestRunId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'failed',
          captures_count: captureRows.length,
          error_message: `Resend ${resendRes.status}: ${errText.slice(0, 500)}`,
          completed_at: new Date().toISOString(),
        }),
      });
      return json(502, { error: 'Resend send failed', detail: errText });
    }

    const resendData = await resendRes.json().catch(() => ({}));
    console.log(`notify-founder-digest: sent ${digestDate} digest`, JSON.stringify({ resendId: resendData?.id, count: captureRows.length, punch: punchItems.length }));

    await sbFetch(`/rest/v1/digest_runs?id=eq.${digestRunId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'sent',
        captures_count: captureRows.length,
        completed_at: new Date().toISOString(),
      }),
    });

    return json(200, {
      sent: true,
      digest_date: digestDate,
      captures_count: captureRows.length,
      punch_items: punchItems.length,
      resend_id: resendData?.id ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('notify-founder-digest: unhandled error', msg, err);
    return json(500, { error: 'Unhandled exception', detail: msg });
  }
});
