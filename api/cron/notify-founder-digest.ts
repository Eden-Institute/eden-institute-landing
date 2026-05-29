// Vercel Cron entry point for the daily lead-magnet founder digest.
//
// Schedule: 14:00 UTC daily = 08:00 America/Chicago (CST).
// During CDT (DST, UTC-5) the digest lands at 09:00 CT — acceptable one-hour
// seasonal drift; we don't reschedule the cron entry twice a year.
//
// Pattern mirrors api/cron/drain-nurture-queue.ts (PR #55, v3.33+):
//   1. Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}`.
//      We verify before invoking anything else.
//   2. Forward to the Supabase EF with SUPABASE_SERVICE_ROLE_KEY in
//      Authorization. EF runs at verify_jwt=true default; service-role
//      JWT is always valid.
//
// Required env vars (Vercel project settings):
//   CRON_SECRET                 random; matches Vercel-injected header
//   SUPABASE_URL                e.g. https://noeqztssupewjidpvhar.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   full service-role JWT

interface EFResponse {
  sent?: boolean;
  skipped?: string;
  reason?: string;
  digest_date?: string;
  captures_count?: number;
  resend_id?: string | null;
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  // 1. Auth: verify CRON_SECRET
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('notify-founder-digest cron: CRON_SECRET env var not set');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured — CRON_SECRET missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('notify-founder-digest cron: unauthorized invocation attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Validate Supabase env
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('notify-founder-digest cron: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured — Supabase env vars missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Invoke the EF
  const efUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/notify-founder-digest`;
  const startedAt = Date.now();
  let efRes: Response;
  try {
    efRes = await fetch(efUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'vercel-cron', invoked_at: new Date().toISOString() }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('notify-founder-digest cron: EF fetch threw:', message);
    return new Response(
      JSON.stringify({ error: `EF fetch failed: ${message}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const elapsedMs = Date.now() - startedAt;
  let efBody: EFResponse | string;
  const contentType = efRes.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      efBody = await efRes.json();
    } catch {
      efBody = await efRes.text();
    }
  } else {
    efBody = await efRes.text();
  }

  console.log(
    `notify-founder-digest cron: EF returned status=${efRes.status} in ${elapsedMs}ms`,
    typeof efBody === 'object' ? JSON.stringify(efBody) : efBody
  );

  return new Response(
    JSON.stringify({
      cron_status: efRes.ok ? 'ok' : 'ef_error',
      ef_status: efRes.status,
      ef_elapsed_ms: elapsedMs,
      ef_body: efBody,
    }),
    {
      status: efRes.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export const config = { runtime: 'edge' };
